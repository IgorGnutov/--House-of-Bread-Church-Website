import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages, sortedData } from './helpers/content.js';
import { telHref } from '../src/lib/format.mjs';

const people = sortedData(readCollection('pastors'));
const group = (g) => people.filter((p) => p.group === g);
const page = readPages().pastors;

test('пастори й пресвітери у порядку order, з ролями обома мовами', () => {
  for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
    const root = loadPage(`${prefix}pastors/index.html`);
    const pastors = root.querySelectorAll('.pastor-card');
    assert.deepEqual(pastors.map((c) => c.querySelector('h3').text), group('pastor').map((p) => p.name));
    assert.deepEqual(pastors.map((c) => c.querySelector('.role').text), group('pastor').map((p) => p.role[lang]));
    const elders = root.querySelectorAll('.elder-card');
    assert.deepEqual(elders.map((c) => c.querySelector('h3').text), group('elder').map((p) => p.name));
    assert.deepEqual(elders.map((c) => c.querySelector('p').text), group('elder').map((p) => p.bio[lang]));
    assert.equal(root.querySelector('.help h3')?.text, page.help?.title[lang]);
  }
});

test('кнопки звʼязку зʼявляються лише там, де є пошта чи телефон', () => {
  const cards = loadPage('pastors/index.html').querySelectorAll('.pastor-card');
  group('pastor').forEach((p, i) => {
    const links = cards[i].querySelectorAll('.pastor-contact a').map((a) => a.getAttribute('href'));
    assert.deepEqual(links, [p.email && `mailto:${p.email}`, p.phone && telHref(p.phone)].filter(Boolean), p.slug);
  });
  assert.equal(loadPage('pastors/index.html').querySelector('.back-link').getAttribute('href'), href('#pastors'));
});
