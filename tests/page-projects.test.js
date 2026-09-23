import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, sortedData } from './helpers/content.js';
import { othersFirst } from '../src/lib/collections.mjs';
import { formatDate } from '../src/lib/format.mjs';
import { linkHref } from '../src/lib/paths.mjs';
import { BASE_PATH } from '../astro.config.mjs';

const projects = sortedData(readCollection('projects'));
const LOCALES = [['uk', ''], ['en', 'en/']];

test('/projects/: картки за order, дата мовою сторінки, прогрес і відео лише де вони є', () => {
  for (const [lang, prefix] of LOCALES) {
    const cards = loadPage(`${prefix}projects/index.html`).querySelectorAll('.project-card');
    assert.equal(cards.length, projects.length);
    cards.forEach((card, i) => {
      const p = projects[i];
      assert.equal(card.getAttribute('href'), href(`${prefix}projects/${p.slug}/`));
      assert.equal(card.querySelector('h3').text, p.title[lang]);
      assert.equal(card.querySelector('.cat').text, p.category[lang]);
      assert.equal(card.querySelector('.project-meta').text, formatDate(p.date, lang));
      assert.equal(Boolean(card.querySelector('.project-progress')), p.progress !== null, p.slug);
      assert.equal(Boolean(card.querySelector('.vflag')), p.media.some((m) => m.type === 'video'), p.slug);
    });
  }
});

test('сторінка проєкту: показники, прогрес за даними, CTA в мові сторінки', () => {
  for (const p of projects) {
    for (const [lang, prefix] of LOCALES) {
      const root = loadPage(`${prefix}projects/${p.slug}/index.html`);
      assert.equal(root.querySelector('h1').text, p.title[lang]);
      assert.deepEqual(root.querySelectorAll('.stat .l').map((s) => s.text), p.stats.map((s) => s.label[lang]));
      assert.equal(Boolean(root.querySelector('.stats')), p.stats.length > 0, `${p.slug}: порожній блок показників`);
      // Проєкт без прогресу не має порожнього (схованого) блока.
      assert.equal(Boolean(root.querySelector('.info-progress')), p.progress !== null, p.slug);
      if (p.progress) {
        assert.equal(root.querySelector('.info-progress .bar span').getAttribute('style'), `width:${p.progress.percent}%`);
      }
      const cta = root.querySelector('.info .btn');
      assert.equal(Boolean(cta), p.ctaUrl !== null, p.slug);
      if (p.ctaUrl) {
        // Внутрішній CTA лишається в мові сторінки (дірка 11), зовнішній — у новій вкладці.
        assert.equal(cta.getAttribute('href'), linkHref(BASE_PATH, lang, p.ctaUrl));
        assert.equal(cta.getAttribute('target') ?? null, p.ctaUrl.startsWith('https://') ? '_blank' : null, p.slug);
      }
      const others = root.querySelectorAll('.more-card').map((a) => a.getAttribute('href'));
      assert.deepEqual(others, othersFirst(projects, p.slug, 3).map((x) => href(`${prefix}projects/${x.slug}/`)));
    }
  }
});
