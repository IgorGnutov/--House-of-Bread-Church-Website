import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readCollection, readPages, readSingleton, localizedPairs } from './helpers/content.js';

// Лише правила, які схема сама не виражає. Кількості записів, конкретні
// імена, адреси й тексти редактор міняє в адмінці — тести їх не пришпилюють
// (контракт: будь-які валідні за схемою дані проходять npm test).

const COLLECTIONS = ['ministries', 'churches', 'projects', 'testimonies', 'pastors', 'leader-resources'];

test('відсутні адреси ресурсів — null, а не заглушка «#»', () => {
  // null чесно каже «адреси ще немає»; «#» у даних не відрізнити від
  // справжньої адреси, і картка тихо вела б у нікуди.
  for (const { file, data } of readCollection('leader-resources')) {
    assert.notEqual(data.url, '#', `${file}: заглушка # у даних`);
  }
});

test('розмітка в контенті лише там, де її рендерить шаблон (hero.title)', () => {
  // Дірка 17: стрілка «Читати далі» і <cite> вірша живуть у шаблоні. Розмітка
  // в будь-якому іншому полі або вивелась би текстом, або подвоїла б іконку.
  const sources = [
    ['homepage', readSingleton('homepage')],
    ['pages', readPages()],
    ...COLLECTIONS.flatMap((name) => readCollection(name).map(({ file, data }) => [`${name}/${file}`, data])),
  ];
  for (const [where, data] of sources) {
    for (const [path, pair] of localizedPairs(data)) {
      if (where === 'homepage' && path === '.hero.title') continue;
      for (const lang of ['uk', 'en']) {
        assert.doesNotMatch(pair[lang], /<[a-z/]/i, `${where}${path}.${lang}: розмітка в тексті`);
      }
    }
  }
});

test('uk.json і en.json мають однаковий набір ключів', () => {
  const flatten = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`));

  const uk = flatten(JSON.parse(readFileSync(
    fileURLToPath(new URL('../src/i18n/uk.json', import.meta.url)), 'utf8')));
  const en = flatten(JSON.parse(readFileSync(
    fileURLToPath(new URL('../src/i18n/en.json', import.meta.url)), 'utf8')));

  // Розбіжність означає, що на англійській сторінці підпис кнопки
  // просто зникне — і помітить це вже відвідувач, а не збірка.
  assert.deepEqual(uk.sort(), en.sort());
});

test('кожне значення в uk.json і en.json — непорожній рядок', () => {
  // Словники не проходять через схему Astro, тож порожній рядок чи null
  // тут ніхто б не зловив — кнопка просто стала б безіменною.
  const leaves = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([k, v]) =>
      v !== null && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]);

  for (const locale of ['uk', 'en']) {
    const dict = JSON.parse(readFileSync(
      fileURLToPath(new URL(`../src/i18n/${locale}.json`, import.meta.url)), 'utf8'));
    for (const [key, value] of leaves(dict)) {
      assert.equal(typeof value, 'string', `${locale}.json ${key}: не рядок`);
      assert.ok(value.trim().length > 0, `${locale}.json ${key}: порожній рядок`);
    }
  }
});

test('лічильники словника мають усі форми множини й місце для числа', () => {
  // plural() обирає форму через Intl.PluralRules: для української це
  // one/few/many/other. Бракує форми — лічильник упаде саме на тій
  // кількості, до якої редактор дійде першим.
  for (const locale of ['uk', 'en']) {
    const dict = JSON.parse(readFileSync(
      fileURLToPath(new URL(`../src/i18n/${locale}.json`, import.meta.url)), 'utf8'));
    for (const [key, forms] of Object.entries(dict.count)) {
      assert.deepEqual(Object.keys(forms).sort(), ['few', 'many', 'one', 'other'], `${locale} count.${key}`);
      for (const form of Object.values(forms)) assert.match(form, /\{n\}/, `${locale} count.${key}: без {n}`);
    }
  }
});
