import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGACY_PAGES, readPageStrings } from '../scripts/lib/legacy-source.mjs';

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
