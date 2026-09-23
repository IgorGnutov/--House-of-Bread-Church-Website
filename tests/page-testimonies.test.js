import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection } from './helpers/content.js';

const testimonies = readCollection('testimonies').map(({ data }) => data).sort((a, b) => a.order - b.order);

test('/testimonies/: текстові й відеокартки в порядку order обома мовами', () => {
  for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
    const cards = loadPage(`${prefix}testimonies/index.html`).querySelectorAll('.tst-card');
    assert.equal(cards.length, testimonies.length);
    cards.forEach((card, i) => {
      const x = testimonies[i];
      assert.equal(card.querySelector('.tst-person b').text, x.name);
      assert.equal(card.querySelector('.tst-person span span').text, x.role[lang]);
      assert.equal(card.querySelector('.tst-avatar').text, x.name.trim()[0].toUpperCase());
      if (x.type === 'video') {
        assert.equal(card.tagName, 'ARTICLE');
        assert.equal(card.querySelector('.tst-video').getAttribute('data-yt'), x.videoUrl);
        assert.equal(card.querySelector('.tst-video img').getAttribute('src'), x.poster);
      } else {
        assert.equal(card.tagName, 'FIGURE');
        assert.equal(card.querySelector('p').text, x.text[lang]);
      }
    });
  }
});

test('«назад» веде на секцію свідчень головної', () => {
  // Рішення 9: на головній секція отримує id="testimonies" (Задача 12).
  assert.equal(loadPage('testimonies/index.html').querySelector('.back-link').getAttribute('href'), href('#testimonies'));
  assert.equal(loadPage('en/testimonies/index.html').querySelector('.site-footer a').getAttribute('href'), href('en/#testimonies'));
});
