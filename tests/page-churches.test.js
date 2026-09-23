import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages, sortedData } from './helpers/content.js';
import { othersFirst } from '../src/lib/collections.mjs';
import { plural } from './helpers/i18n.js';

const churches = sortedData(readCollection('churches'));
const LOCALES = [['uk', ''], ['en', 'en/']];

test('/churches/ показує церкви за order; значок «Головна» — лише в першої', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}churches/index.html`);
    const cards = root.querySelectorAll('.church-card');
    assert.equal(cards.length, churches.length);
    cards.forEach((card, i) => {
      const c = churches[i];
      assert.equal(card.getAttribute('href'), href(`${prefix}churches/${c.slug}/`));
      assert.equal(card.querySelector('h3').text, c.name[lang]);
      assert.equal(card.querySelector('.church-city').text, c.city[lang]);
      assert.equal(card.querySelector('.church-meta').text, c.times[lang]);
      // Перша після сортування, а не order === 0: редактор може лишити дірки.
      assert.equal(card.querySelector('.badge').classList.contains('main'), i === 0, c.slug);
    });
    assert.equal(root.querySelector('.hero-count span').text, plural(lang, 'count.churches', churches.length));
    assert.equal(root.querySelector('.page-hero h1').text, readPages().churches.title[lang]);
  }
});

test('сторінка церкви: факти, маршрут за українською адресою, до трьох інших церков', () => {
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
      const expected = othersFirst(churches, c.slug, 3).map((x) => href(`${prefix}churches/${x.slug}/`));
      assert.deepEqual(others, expected);
      assert.equal(Boolean(root.querySelector('section.more')), expected.length > 0, `${c.slug}: блок «інші» без інших`);
    }
  }
});
