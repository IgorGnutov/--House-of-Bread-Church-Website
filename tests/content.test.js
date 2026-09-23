import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const contentDir = (name) =>
  fileURLToPath(new URL(`../src/content/${name}`, import.meta.url));

export const readCollection = (name) =>
  readdirSync(contentDir(name))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
      file: f,
      data: JSON.parse(readFileSync(`${contentDir(name)}/${f}`, 'utf8')),
    }));

// Рекурсивно знаходить кожну пару {uk, en} у записі — щоб перевіряти
// повноту перекладу, не перелічуючи поля кожної колекції окремо.
export function* localizedPairs(value, path = '') {
  if (value === null || typeof value !== 'object') return;
  if (typeof value.uk === 'string' && 'en' in value) {
    yield [path, value];
    return;
  }
  for (const [k, v] of Object.entries(value)) yield* localizedPairs(v, `${path}.${k}`);
}

test('усі 18 служінь на місці, ім’я файлу збігається зі slug', () => {
  const entries = readCollection('ministries');
  assert.equal(entries.length, 18);

  for (const { file, data } of entries) {
    // Дублікат slug означав би дві сторінки на одному URL: одна тихо
    // перетерла б іншу. Ім'я файлу — єдине джерело унікальності, тож
    // розбіжність «файл ≠ поле» ловимо тут.
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
  }
});

test('icon кожного служіння — зі списку 18 дозволених', () => {
  const allowed = new Set([
    'book', 'home', 'media', 'worship', 'child', 'youth', 'teen', 'order', 'care',
    'chapel', 'prophetic', 'hospital', 'biz', 'pray', 'mercy', 'prison', 'family', 'globe',
  ]);

  for (const { file, data } of readCollection('ministries')) {
    assert.ok(allowed.has(data.icon), `${file}: невідома іконка ${data.icon}`);
  }
});

test('кожне локалізоване поле служінь має непорожні uk і en', () => {
  for (const { file, data } of readCollection('ministries')) {
    for (const [path, pair] of localizedPairs(data)) {
      assert.ok(pair.uk.trim().length > 0, `${file}${path}: порожня uk`);
      // Порожня en тихо показала б українську на англійській сторінці.
      assert.ok(String(pair.en).trim().length > 0, `${file}${path}: порожня en`);
    }
  }
});

test('кожен слайд галереї має непорожній alt і допустимий src', () => {
  for (const { file, data } of readCollection('ministries')) {
    assert.ok(data.media.length > 0, `${file}: порожня галерея`);

    for (const item of data.media) {
      assert.ok(['image', 'video'].includes(item.type), `${file}: тип ${item.type}`);
      assert.ok(item.src.trim().length > 0, `${file}: порожній src`);
      // Порожній alt проходить z.string() і дає картинку без опису —
      // це одразу і доступність, і SEO (Спека 1).
      assert.ok(item.alt.trim().length > 0, `${file}: порожній alt`);
    }
  }
});

test('усі 6 церков на місці, з двомовними полями і галереєю', () => {
  const entries = readCollection('churches');
  assert.equal(entries.length, 6);

  for (const { file, data } of entries) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.ok(data.media.length > 0, `${file}: порожня галерея`);

    for (const [path, pair] of localizedPairs(data)) {
      assert.ok(pair.uk.trim().length > 0, `${file}${path}: порожня uk`);
      assert.ok(String(pair.en).trim().length > 0, `${file}${path}: порожня en`);
    }
    for (const item of data.media) {
      assert.ok(item.alt.trim().length > 0, `${file}: порожній alt`);
    }
  }
});

test('координати церков присутні як поле, поки що порожні', () => {
  // Спека: geo — нове поле, джерела немає ніде. Явний null означає
  // «знаємо, що бракує»; відсутнє поле означало б «забули про нього».
  for (const { file, data } of readCollection('churches')) {
    assert.ok('geo' in data, `${file}: немає поля geo`);
    assert.equal(data.geo, null, `${file}: координати вигадані, а джерела немає`);
  }
});

test('усі 4 проєкти на місці, з локалізованими підписами показників', () => {
  const entries = readCollection('projects');
  assert.equal(entries.length, 4);

  for (const { file, data } of entries) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.match(data.date, /^\d{4}-\d{2}-\d{2}$/, `${file}: дата не ISO`);
    assert.ok(data.stats.length > 0, `${file}: немає показників`);

    for (const stat of data.stats) {
      assert.ok(stat.n.trim().length > 0, `${file}: показник без числа`);
      assert.ok(stat.label.uk.trim().length > 0, `${file}: показник без uk-підпису`);
      assert.ok(stat.label.en.trim().length > 0, `${file}: показник без en-підпису`);
    }
    for (const [path, pair] of localizedPairs(data)) {
      assert.ok(pair.uk.trim().length > 0, `${file}${path}: порожня uk`);
      assert.ok(String(pair.en).trim().length > 0, `${file}${path}: порожня en`);
    }
  }
});

test('нелокалізовані поля проєкту не роздвоєні по мовах', () => {
  // percent і url у джерелі є тільки в українському обʼєкті. Якби ми
  // зробили їх локалізованими, англійська версія лишилась би без них.
  const withProgress = readCollection('projects').filter(({ data }) => data.progress !== null);
  assert.ok(withProgress.length >= 1, 'жоден проєкт не має прогресу — дані загублені');

  for (const { file, data } of withProgress) {
    assert.equal(typeof data.progress.percent, 'number', `${file}: percent не число`);
    assert.ok(data.progress.raised.uk.length > 0, `${file}: зібрано без uk`);
    assert.ok(data.progress.raised.en.length > 0, `${file}: зібрано без en`);
  }
});
