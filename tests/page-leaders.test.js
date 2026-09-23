import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './helpers/dist.js';
import { readCollection, readPages, sortedData } from './helpers/content.js';
import { assetUrl } from '../src/lib/paths.mjs';
import { BASE_PATH } from '../astro.config.mjs';
import { plural } from './helpers/i18n.js';

const resources = sortedData(readCollection('leader-resources'));
const kind = (k) => resources.filter((r) => r.kind === k);
const page = readPages().leaders;
const LOCALES = [['uk', ''], ['en', 'en/']];

test('документи: формат-значок, підпис, завантаження; «#» поки адреси немає', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}leaders/index.html`);
    const docs = kind('document');
    const cards = root.querySelectorAll('.doc-card');
    assert.equal(cards.length, docs.length);
    cards.forEach((card, i) => {
      const d = docs[i];
      assert.equal(card.querySelector('h3').text, d.title[lang]);
      assert.equal(card.querySelector('.doc-meta')?.text, d.meta?.[lang]);
      assert.ok(card.querySelector('.doc-ic').classList.contains(d.format));
      assert.equal(card.querySelector('.doc-ic').text, d.format.toUpperCase());
      // Дірка 2: url: null. «#» — легасі-поведінка; справжні адреси дасть замовник.
      assert.equal(card.getAttribute('href'), d.url == null ? '#' : assetUrl(BASE_PATH, d.url));
      assert.equal(card.getAttribute('download'), '');
    });
    // Лічильник — з даних, а не статичний рядок словника (дірка 20).
    const count = root.querySelectorAll('.sec-head .count').map((c) => c.text);
    const expected = [
      ...(docs.length > 0 ? [plural(lang, 'count.docs', docs.length)] : []),
      ...(kind('link').length > 0 ? [plural(lang, 'count.resources', kind('link').length)] : []),
    ];
    assert.deepEqual(count, expected);
  }
});

test('посилання: іконка з даних, назва й опис обома мовами', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}leaders/index.html`);
    const cards = root.querySelectorAll('.res-card');
    assert.deepEqual(cards.map((c) => c.querySelector('h3').text), kind('link').map((r) => r.title[lang]));
    for (const card of cards) assert.ok(card.querySelector('.res-ic svg path, .res-ic svg rect'));
    assert.equal(root.querySelector('.locked span')?.text, page.sections?.hero_locked?.[lang]);
    assert.equal(root.querySelector('.help h3')?.text, page.help?.title[lang]);
  }
});
