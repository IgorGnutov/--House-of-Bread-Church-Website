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
    }
  }
});

test('галерея: слайд на кожне медіа, перший активний, відео — лише ID без iframe', () => {
  const m = ministries.find((x) => x.slug === 'youth');
  const root = loadPage('ministries/youth/index.html');
  const slides = root.querySelectorAll('[data-slide]');
  assert.equal(slides.length, m.media.length);
  assert.ok(slides[0].classList.contains('is-active'));
  assert.equal(root.querySelectorAll('[data-dot]').length, m.media.length);
  assert.equal(root.querySelectorAll('[data-thumb]').length, m.media.length);
  // iframe YouTube важкий — вставляється скриптом лише для активного слайда.
  assert.equal(slides[2].getAttribute('data-video'), 'ScMzIvxBSi4');
  assert.equal(root.querySelectorAll('.slide iframe').length, 0);
});

test('«Інші служіння» — наступні чотири по колу, без поточного', () => {
  const last = ministries.at(-1);
  const cards = loadPage(`ministries/${last.slug}/index.html`).querySelectorAll('.more-card');
  assert.deepEqual(
    cards.map((c) => c.getAttribute('href')),
    ministries.slice(0, 4).map((x) => href(`ministries/${x.slug}/`)),
  );
});

test('шапка й футер деталки ведуть до списку тієї ж мови', () => {
  const root = loadPage('en/ministries/youth/index.html');
  assert.equal(root.querySelector('.back-link').getAttribute('href'), href('en/ministries/'));
  assert.equal(root.querySelector('.site-footer a').getAttribute('href'), href('en/ministries/'));
  assert.equal(root.querySelectorAll('.crumbs a')[1].getAttribute('href'), href('en/ministries/'));
});
