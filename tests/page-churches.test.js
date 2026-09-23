import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages } from './helpers/content.js';

const churches = readCollection('churches').map(({ data }) => data).sort((a, b) => a.order - b.order);
const LOCALES = [['uk', ''], ['en', 'en/']];

test('/churches/ показує церкви за order; значок «Головна» — лише в order 0', () => {
  for (const [lang, prefix] of LOCALES) {
    const cards = loadPage(`${prefix}churches/index.html`).querySelectorAll('.church-card');
    assert.equal(cards.length, churches.length);
    cards.forEach((card, i) => {
      const c = churches[i];
      assert.equal(card.getAttribute('href'), href(`${prefix}churches/${c.slug}/`));
      assert.equal(card.querySelector('h3').text, c.name[lang]);
      assert.equal(card.querySelector('.church-city').text, c.city[lang]);
      assert.equal(card.querySelector('.church-meta').text, c.times[lang]);
      assert.equal(card.querySelector('.badge').classList.contains('main'), c.order === 0, c.slug);
    });
  }
  assert.equal(loadPage('churches/index.html').querySelector('.hero-count span').text, `${churches.length} церков в об’єднанні`);
  assert.equal(loadPage('churches/index.html').querySelector('.page-hero h1').text, readPages().churches.title.uk);
});

test('сторінка церкви: факти, маршрут за українською адресою, три інші церкви', () => {
  for (const c of churches) {
    for (const [lang, prefix] of LOCALES) {
      const root = loadPage(`${prefix}churches/${c.slug}/index.html`);
      assert.equal(root.querySelector('h1').text, c.name[lang]);
      assert.equal(root.querySelector('.crumbs span').text, c.city[lang]);
      assert.equal(root.querySelector('.info .eyebrow').text, c.role[lang]);
      const vals = root.querySelectorAll('.fact .val').map((v) => v.text);
      assert.deepEqual(vals, [c.address[lang], c.times[lang], c.pastor]);
      // Легасі будував запит до карт з українських полів на обох мовах.
      assert.equal(
        root.querySelector('.info .btn').getAttribute('href'),
        `https://www.google.com/maps?q=${encodeURIComponent(`${c.city.uk} ${c.address.uk}`)}`,
      );
      const others = root.querySelectorAll('.more-card').map((a) => a.getAttribute('href'));
      assert.deepEqual(others, churches.filter((x) => x.slug !== c.slug).slice(0, 3).map((x) => href(`${prefix}churches/${x.slug}/`)));
    }
  }
});
