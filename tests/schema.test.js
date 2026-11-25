import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGE_IDS, schemas, linkUrl } from '../src/lib/schema.mjs';
import { readCollection, readPages, readSingleton } from './helpers/content.js';
import { branch, ministry } from './helpers/probes.js';

const pair = (uk, en = uk) => ({ uk, en });
const section = (items) => ({ title: pair('Гілки', 'Branches'), items });

// Схема одна на трьох: збірка Astro, скрипти Storyblok (scripts/cms) і
// тести. Якщо правило живе лише в content.config.ts, імпорт у Storyblok
// пропустив би дані, які потім валять збірку.
const COLLECTIONS = ['ministries', 'churches', 'projects', 'testimonies', 'pastors', 'leader-resources'];
const SINGLETONS = ['site-settings', 'contact-info', 'donate-settings', 'homepage'];

const assertValid = (schema, data, where) => {
  const result = schema.safeParse(data);
  assert.ok(result.success, `${where}: ${JSON.stringify(result.error?.issues)}`);
};

test('кожен справжній запис проходить схему і поза Astro', () => {
  for (const collection of COLLECTIONS) {
    for (const { file, data } of readCollection(collection)) assertValid(schemas[collection], data, `${collection}/${file}`);
  }
  for (const name of SINGLETONS) assertValid(schemas[name], readSingleton(name), name);
  for (const [id, data] of Object.entries(readPages())) assertValid(schemas.pages, data, `pages.${id}`);
});

test('PAGE_IDS — кожна з них є в pages.json (зайвий ключ — не помилка)', () => {
  // Схема не рахує записи (CLAUDE.md): pages.json може мати ключ понад
  // PAGE_IDS (нову, ще не читану шаблонами сторінку) — це не провал.
  const ids = new Set(Object.keys(readPages()));
  for (const id of PAGE_IDS) assert.ok(ids.has(id), `${id}: немає в pages.json, а шаблони його читають`);
});

test('схема з plain Node ловить ті самі помилки, що й збірка', () => {
  assert.equal(schemas.ministries.safeParse(ministry('probe', { icon: 'rocket' })).success, false);
  assert.equal(schemas.ministries.safeParse(ministry('probe')).success, true);
});

test('content.config.ts не тримає власних правил — лише завантажувачі', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/content.config.ts', import.meta.url)), 'utf8');
  assert.doesNotMatch(source, /\bz\./, 'правило схеми в content.config.ts: перенести в src/lib/schema.mjs');
});

test('homepage.pastors без role/role2: шаблон їх не читає, у Storyblok вони не переносяться', () => {
  // Дірка 18: ролі пасторів на головній беруться з колекції pastors.
  // Поле, яке ніхто не показує, редактор правив би в адмінці даремно.
  const home = readSingleton('homepage');
  assert.equal('role' in home.pastors || 'role2' in home.pastors, false, 'role/role2 ще лежать у homepage.json');
  const result = schemas.homepage.safeParse({ ...home, pastors: { ...home.pastors, role: { uk: 'Пастор', en: 'Pastor' } } });
  assert.equal(result.success, false, 'схема все ще приймає homepage.pastors.role');
  assert.match(JSON.stringify(result.error.issues), /role/);
});

test('linkUrl: адреси кнопок і посилань у тексті', () => {
  const ok = ['https://www.liqpay.ua/x', 'http://example.test', 'mailto:leaders@example.test', 'tel:+380 99 111-22-33',
    '/', '/ministries/youth/', '/#contacts', 'uploads/cms/abc-file.pdf', '#contacts'];
  const bad = ['', '#', 'javascript:alert(1)', '//evil.test/x', 'index.html#contacts', 'mailto:', 'tel:12', 'https://', 'ftp://x.test', '/\\evil.test'];
  for (const url of ok) assert.equal(linkUrl.safeParse(url).success, true, `відкинуто «${url}»`);
  for (const url of bad) assert.equal(linkUrl.safeParse(url).success, false, `пропущено «${url}»`);
});

test('гілки: з гілками лідер і телефон служіння необовʼязкові', () => {
  assertValid(schemas.ministries, ministry('b', { leader: null, phone: null, branches: section([branch('a')]) }), 'з гілками');
  assertValid(schemas.ministries, ministry('b', { branches: section([]) }), 'порожній розділ');
  assertValid(schemas.ministries, ministry('b', { branches: null }), 'null');
  assertValid(schemas.ministries, ministry('b'), 'ключа немає');
});

test('гілки: без гілок лідер і телефон обовʼязкові — помилка з точним шляхом', () => {
  for (const branches of [undefined, null, section([])]) {
    for (const key of ['leader', 'phone']) {
      const r = schemas.ministries.safeParse(ministry('b', { [key]: null, ...(branches === undefined ? {} : { branches }) }));
      assert.equal(r.success, false, `${key}, branches=${JSON.stringify(branches)}`);
      assert.ok(r.error.issues.some((i) => i.path.join('.') === key), JSON.stringify(r.error.issues));
    }
  }
});

test('гілки: правила полів гілки й назви розділу', () => {
  const bad = (b, path) => {
    const r = schemas.ministries.safeParse(ministry('b', { branches: section([b]) }));
    assert.equal(r.success, false, path);
    assert.ok(r.error.issues.some((i) => i.path.join('.').startsWith(path)), `${path}: ${JSON.stringify(r.error.issues)}`);
  };
  bad(branch('a', { media: [] }), 'branches.items.0.media');
  bad(branch('a', { phone: 'дзвоніть' }), 'branches.items.0.phone');
  bad(branch('a', { ctaUrl: '#' }), 'branches.items.0.ctaUrl');
  bad(branch('a', { name: { uk: 'Гілка', en: ' ' } }), 'branches.items.0.name.en');
  bad(branch('a', { leader: '' }), 'branches.items.0.leader');
  bad(branch('a', { extra: 1 }), 'branches.items.0');
  const r = schemas.ministries.safeParse(ministry('b', { branches: { title: { uk: 'Гілки', en: '' }, items: [] } }));
  assert.equal(r.success, false);
  assert.ok(r.error.issues.some((i) => i.path.join('.') === 'branches.title.en'), JSON.stringify(r.error.issues));
});
