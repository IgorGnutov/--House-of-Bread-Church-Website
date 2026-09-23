import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages, sortedData } from './helpers/content.js';
import { nextCyclic } from '../src/lib/collections.mjs';
import { ytId } from '../src/lib/youtube.mjs';
import { plural } from './helpers/i18n.js';

// Усе — з даних: адмінка може додати, видалити чи переставити служіння.
const ministries = sortedData(readCollection('ministries'));
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
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}ministries/index.html`);
    assert.equal(root.querySelector('.page-hero h1').text, page.title[lang]);
    assert.equal(root.querySelector('.page-hero .eyebrow')?.text, page.eyebrow?.[lang]);
    assert.equal(root.querySelector('.hero-count span').text, plural(lang, 'count.ministries', ministries.length));
  }
});

test('«назад» у шапці веде на секцію служінь головної тієї ж мови', () => {
  // Рішення 9: якір замість sessionStorage-повернення легасі.
  assert.equal(loadPage('ministries/index.html').querySelector('.back-link').getAttribute('href'), href('#ministries'));
  assert.equal(loadPage('en/ministries/index.html').querySelector('.back-link').getAttribute('href'), href('en/#ministries'));
  assert.equal(loadPage('en/ministries/index.html').querySelector('.site-footer a').getAttribute('href'), href('en/'));
});

test('кожне служіння має сторінку обома мовами з назвою, фактами й дзвінком', () => {
  for (const m of ministries) {
    for (const [lang, prefix] of LOCALES) {
      const root = loadPage(`${prefix}ministries/${m.slug}/index.html`);
      assert.equal(root.querySelector('h1').text, m.name[lang]);
      assert.equal(root.querySelector('.crumbs span').text, m.name[lang]);
      assert.equal(root.querySelector('.info h2').text, m.summary[lang]);
      assert.equal(root.querySelector('.info .desc').text, m.body[lang]);
      assert.equal(root.querySelector('.fact .val').text, m.leader);
      assert.equal(root.querySelector('.info .btn').getAttribute('href'), `tel:${m.phone.replace(/[^+\d]/g, '')}`);
      assert.equal(root.querySelector('title').text, `${m.name[lang]} — House of Bread Church`);
      assert.equal(root.querySelectorAll('.crumbs a')[1].getAttribute('href'), href(`${prefix}ministries/`));
    }
  }
});

test('галерея: слайд на кожне медіа, перший активний, відео — лише ID без iframe', () => {
  for (const m of ministries) {
    const root = loadPage(`ministries/${m.slug}/index.html`);
    const slides = root.querySelectorAll('[data-slide]');
    assert.equal(slides.length, m.media.length, m.slug);
    assert.ok(slides[0].classList.contains('is-active'), m.slug);
    // Навігація — лише коли є куди гортати.
    const nav = m.media.length > 1 ? m.media.length : 0;
    assert.equal(root.querySelectorAll('[data-dot]').length, nav, m.slug);
    assert.equal(root.querySelectorAll('[data-thumb]').length, nav, m.slug);
    assert.equal(Boolean(root.querySelector('[data-next]')), nav > 0, m.slug);
    m.media.forEach((item, i) => {
      assert.equal(slides[i].getAttribute('data-video') ?? null, item.type === 'video' ? ytId(item.src) : null, `${m.slug}#${i}`);
    });
    // iframe YouTube важкий — вставляється скриптом лише для активного слайда.
    assert.equal(root.querySelectorAll('.slide iframe').length, 0);
  }
});

test('«Інші служіння» — наступні (до чотирьох) по колу, без поточного', () => {
  ministries.forEach((m, index) => {
    const root = loadPage(`ministries/${m.slug}/index.html`);
    const expected = nextCyclic(ministries, index, 4).map((x) => href(`ministries/${x.slug}/`));
    assert.deepEqual(root.querySelectorAll('.more-card').map((c) => c.getAttribute('href')), expected, m.slug);
    assert.ok(!expected.includes(href(`ministries/${m.slug}/`)), `${m.slug}: серед інших — він сам`);
    // Без інших служінь блоку немає зовсім, а не порожня сітка з заголовком.
    assert.equal(Boolean(root.querySelector('section.more')), expected.length > 0, m.slug);
  });
});

test('шапка й футер деталки ведуть до списку тієї ж мови', () => {
  for (const m of ministries) {
    const root = loadPage(`en/ministries/${m.slug}/index.html`);
    assert.equal(root.querySelector('.back-link').getAttribute('href'), href('en/ministries/'));
    assert.equal(root.querySelector('.site-footer a').getAttribute('href'), href('en/ministries/'));
  }
});
