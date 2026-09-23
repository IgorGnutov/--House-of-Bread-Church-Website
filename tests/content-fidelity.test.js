import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { LEGACY_PAGES, readLegacy, readPageStrings } from '../scripts/lib/legacy-source.mjs';

// Цей файл звіряє перенесений контент із живим легасі. Він свідомо помре
// разом із легасі на Етапі 2 — до того моменту він єдиний доводить, що
// перенесення не загубило й не переписало жодного рядка.
const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

const keyMap = read('../scripts/key-map.json');

const sources = {
  homepage: read('../src/content/singletons/homepage.json').main,
  pages: read('../src/content/singletons/pages.json'),
  i18n: { uk: read('../src/i18n/uk.json'), en: read('../src/i18n/en.json') },
};

// destination виду "homepage:hero.title" → пара {uk, en} із перенесених даних.
function resolve(destination) {
  const [root, path] = destination.split(':');
  const steps = path.split('.');

  if (root === 'i18n') {
    return { uk: steps.reduce((o, k) => o?.[k], sources.i18n.uk),
             en: steps.reduce((o, k) => o?.[k], sources.i18n.en) };
  }
  if (root === 'homepage') return steps.reduce((o, k) => o?.[k], sources.homepage);
  if (root === 'pages') return steps.reduce((o, k) => o?.[k], sources.pages);

  const [file, ...rest] = steps;
  const entry = read(`../src/content/${root}/${file}.json`);
  return rest.reduce((o, k) => o?.[k], entry);
}

test('кожна пара «сторінка + ключ» із легасі має рівно одне призначення', () => {
  const mapped = new Set(keyMap.map(({ page, key }) => `${page}|${key}`));
  assert.equal(mapped.size, keyMap.length, 'у карті є дублікати');

  let total = 0;
  for (const page of LEGACY_PAGES) {
    for (const key of readPageStrings(page).keys()) {
      total += 1;
      assert.ok(mapped.has(`${page}|${key}`), `${page}: ключ ${key} нікуди не перенесений`);
    }
  }
  assert.equal(keyMap.length, total, 'у карті є призначення для неіснуючих ключів');
});

test('значення за призначенням побайтово дорівнює легасі, обома мовами', () => {
  const byPage = new Map(LEGACY_PAGES.map((p) => [p, readPageStrings(p)]));

  for (const { page, key, destination } of keyMap) {
    const legacy = byPage.get(page).get(key);
    const moved = resolve(destination);

    assert.ok(moved, `${page}:${key} → ${destination}: призначення не існує`);
    assert.equal(moved.uk, legacy.uk, `${page}:${key} → ${destination}: розійшлася uk`);
    assert.equal(moved.en, legacy.en, `${page}:${key} → ${destination}: розійшлася en`);
  }
});

// Рядки інтерфейсу, що в легасі живуть лише в тернарниках скриптів
// (lang==='en' ? '…' : '…'), а не в data-i18n, — карта ключів їх не бачить.
// Рядок таблиці — «ключ + файл, де він трапляється»; один ключ може жити
// в кількох файлах, тоді рядків кілька.
const SCRIPT_UI_KEYS = [
  { key: 'badge.mainChurch', file: 'churches.dc.html' },
  { key: 'badge.union', file: 'churches.dc.html' },
  { key: 'badge.video', file: 'projects.dc.html' },
  { key: 'card.readMore', file: 'churches.dc.html' },
  { key: 'card.readMore', file: 'ministries.dc.html' },
  { key: 'card.readMore', file: 'projects.dc.html' },
  { key: 'listCount.churches', file: 'churches.dc.html' },
  { key: 'listCount.ministries', file: 'ministries.dc.html' },
  { key: 'progress.of', file: 'projects.dc.html' },
  { key: 'progress.of', file: 'project.dc.html' },
  { key: 'testimony.videoLabel', file: 'testimonies.dc.html' },
  { key: 'testimony.watch', file: 'testimonies.dc.html' },
];

// Значення всіх рядкових літералів файлу, з уже розкритими escape-кодами:
// у churches.dc.html апостроф записаний як ’, а на екран іде сам
// символ — порівнювати треба те, що бачить відвідувач, а не сирий байт.
const literalValues = (page) => {
  const values = new Set();
  for (const [literal] of readLegacy(page).matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g)) {
    try { values.add(vm.runInNewContext(literal)); } catch { /* не JS-літерал, напр. в атрибуті */ }
  }
  return values;
};

const pick = (dict, dotted) => dotted.split('.').reduce((o, k) => o?.[k], dict);

test('рядки зі скриптових тернарників є в словниках побайтово', () => {
  const byPage = new Map();

  for (const { key, file } of SCRIPT_UI_KEYS) {
    if (!byPage.has(file)) byPage.set(file, literalValues(file));
    const literals = byPage.get(file);
    const uk = pick(sources.i18n.uk, key);
    const en = pick(sources.i18n.en, key);

    assert.equal(typeof uk, 'string', `${key}: немає в uk.json`);
    assert.equal(typeof en, 'string', `${key}: немає в en.json`);
    assert.ok(literals.has(uk), `${key}: uk ${JSON.stringify(uk)} не трапляється в ${file}`);
    assert.ok(literals.has(en), `${key}: en ${JSON.stringify(en)} не трапляється в ${file}`);
  }
});

test('кожен тернарник мови з двома літералами має ключ у таблиці', () => {
  // Таблиця вище складена вручну — цей тест ловить тернарник, який у неї
  // не потрапив (новий або пропущений), замість мовчки лишити його в коді.
  const ternary = /lang\s*===?\s*'en'\s*\?\s*('(?:[^'\\]|\\.)*')\s*:\s*('(?:[^'\\]|\\.)*')/g;

  for (const page of LEGACY_PAGES) {
    for (const [, enLiteral, ukLiteral] of readLegacy(page).matchAll(ternary)) {
      const en = vm.runInNewContext(enLiteral);
      const uk = vm.runInNewContext(ukLiteral);
      // Формат дати ('en-US' : 'uk-UA') — параметр локалі, а не текст.
      if (en === 'en-US') continue;

      const row = SCRIPT_UI_KEYS.find(({ key, file }) =>
        file === page && pick(sources.i18n.en, key) === en && pick(sources.i18n.uk, key) === uk);
      assert.ok(row, `${page}: тернарник ${JSON.stringify(en)} / ${JSON.stringify(uk)} без ключа`);
    }
  }
});
