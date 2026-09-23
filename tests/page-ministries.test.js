import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages } from './helpers/content.js';

const ministries = readCollection('ministries').map(({ data }) => data).sort((a, b) => a.order - b.order);
const page = readPages().ministries;
const LOCALES = [['uk', ''], ['en', 'en/']];

test('/ministries/ показує всі служіння в порядку order з посиланнями на деталі', () => {
  for (const [lang, prefix] of LOCALES) {
    const cards = loadPage(`${prefix}ministries/index.html`).querySelectorAll('.min-card');
    assert.equal(cards.length, ministries.length, lang);
    cards.forEach((card, i) => {
      assert.equal(card.getAttribute('href'), href(`${prefix}ministries/${ministries[i].slug}/`));
      assert.equal(card.querySelector('h3').text, ministries[i].name[lang]);
      assert.equal(card.querySelector('.min-body p').text, ministries[i].summary[lang]);
      assert.ok(card.querySelector('.icon svg path, .icon svg circle, .icon svg rect'), `${ministries[i].slug}: без іконки`);
    });
  }
});

test('герой сторінки й лічильник беруться з даних обома мовами', () => {
  const root = loadPage('ministries/index.html');
  assert.equal(root.querySelector('.page-hero h1').text, page.title.uk);
  assert.equal(root.querySelector('.page-hero .eyebrow').text, page.eyebrow.uk);
  assert.equal(root.querySelector('.hero-count span').text, `${ministries.length} напрямків служіння`);
  assert.equal(loadPage('en/ministries/index.html').querySelector('.hero-count span').text, `${ministries.length} ministry areas`);
});

test('«назад» у шапці веде на секцію служінь головної тієї ж мови', () => {
  // Рішення 9: якір замість sessionStorage-повернення легасі.
  assert.equal(loadPage('ministries/index.html').querySelector('.back-link').getAttribute('href'), href('#ministries'));
  assert.equal(loadPage('en/ministries/index.html').querySelector('.back-link').getAttribute('href'), href('en/#ministries'));
  assert.equal(loadPage('en/ministries/index.html').querySelector('.site-footer a').getAttribute('href'), href('en/'));
});
