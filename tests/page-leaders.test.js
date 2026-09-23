import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './helpers/dist.js';
import { readCollection, readPages } from './helpers/content.js';

const resources = readCollection('leader-resources').map(({ data }) => data);
const kind = (k) => resources.filter((r) => r.kind === k).sort((a, b) => a.order - b.order);
const page = readPages().leaders;

test('документи: формат-значок, підпис, завантаження; «#» поки адреси немає', () => {
  for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
    const cards = loadPage(`${prefix}leaders/index.html`).querySelectorAll('.doc-card');
    assert.equal(cards.length, 6);
    cards.forEach((card, i) => {
      const d = kind('document')[i];
      assert.equal(card.querySelector('h3').text, d.title[lang]);
      assert.equal(card.querySelector('.doc-meta').text, d.meta[lang]);
      assert.ok(card.querySelector('.doc-ic').classList.contains(d.format));
      assert.equal(card.querySelector('.doc-ic').text, d.format.toUpperCase());
      // Дірка 2: url: null. «#» — легасі-поведінка; справжні адреси дасть замовник.
      assert.equal(card.getAttribute('href'), d.url ?? '#');
      assert.equal(card.getAttribute('download'), '');
    });
  }
});

test('посилання: іконка з даних, назва й опис обома мовами', () => {
  for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
    const root = loadPage(`${prefix}leaders/index.html`);
    const cards = root.querySelectorAll('.res-card');
    assert.deepEqual(cards.map((c) => c.querySelector('h3').text), kind('link').map((r) => r.title[lang]));
    for (const card of cards) assert.ok(card.querySelector('.res-ic svg path, .res-ic svg rect'));
    assert.equal(root.querySelector('.locked span').text, page.sections.hero_locked[lang]);
    assert.equal(root.querySelector('.help h3').text, page.help.title[lang]);
  }
});
