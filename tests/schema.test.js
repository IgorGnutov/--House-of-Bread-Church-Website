import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGE_IDS, schemas } from '../src/lib/schema.mjs';
import { readCollection, readPages, readSingleton } from './helpers/content.js';
import { ministry } from './helpers/probes.js';

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
