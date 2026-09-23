import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection } from './helpers/content.js';

const projects = readCollection('projects').map(({ data }) => data).sort((a, b) => a.order - b.order);
const LOCALES = [['uk', ''], ['en', 'en/']];

test('/projects/: картки за order, дата українською, прогрес лише де він є', () => {
  const cards = loadPage('projects/index.html').querySelectorAll('.project-card');
  assert.equal(cards.length, projects.length);
  cards.forEach((card, i) => {
    const p = projects[i];
    assert.equal(card.getAttribute('href'), href(`projects/${p.slug}/`));
    assert.equal(card.querySelector('h3').text, p.title.uk);
    assert.equal(card.querySelector('.cat').text, p.category.uk);
    assert.equal(Boolean(card.querySelector('.project-progress')), p.progress !== null, p.slug);
    assert.equal(Boolean(card.querySelector('.vflag')), p.media.some((m) => m.type === 'video'), p.slug);
  });
  const canteen = cards[projects.findIndex((p) => p.slug === 'social-canteen')];
  assert.equal(canteen.querySelector('.project-meta').text, '10 січня 2026 р.');
  const en = loadPage('en/projects/index.html').querySelectorAll('.project-card');
  assert.equal(en[projects.findIndex((p) => p.slug === 'social-canteen')].querySelector('.project-meta').text, 'January 10, 2026');
});

test('сторінка проєкту: показники, прогрес за даними, CTA в мові сторінки', () => {
  for (const p of projects) {
    for (const [lang, prefix] of LOCALES) {
      const root = loadPage(`${prefix}projects/${p.slug}/index.html`);
      assert.equal(root.querySelector('h1').text, p.title[lang]);
      assert.deepEqual(root.querySelectorAll('.stat .l').map((s) => s.text), p.stats.map((s) => s.label[lang]));
      // Проєкт без прогресу не має порожнього (схованого) блока.
      assert.equal(Boolean(root.querySelector('.info-progress')), p.progress !== null, p.slug);
      if (p.progress) {
        assert.equal(root.querySelector('.info-progress .bar span').getAttribute('style'), `width:${p.progress.percent}%`);
      }
      const cta = root.querySelector('.info .btn');
      assert.equal(Boolean(cta), p.ctaUrl !== null, p.slug);
      if (p.ctaUrl?.startsWith('https://')) assert.equal(cta.getAttribute('target'), '_blank');
    }
  }
  // Внутрішній CTA лишається в мові сторінки (дірка 11).
  assert.equal(loadPage('en/projects/social-canteen/index.html').querySelector('.info .btn').getAttribute('href'), href('en/#contacts'));
  assert.equal(loadPage('projects/social-canteen/index.html').querySelector('.info .btn').hasAttribute('target'), false);
});
