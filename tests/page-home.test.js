import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readSingleton } from './helpers/content.js';

const home = readSingleton('homepage');
const contact = readSingleton('contact-info');
const donate = readSingleton('donate-settings');
const settings = readSingleton('site-settings');
const LOCALES = [['uk', ''], ['en', 'en/']];

test('меню: якорі секцій і реальні адреси обʼєднання та проєктів у мові сторінки', () => {
  for (const [lang, prefix] of LOCALES) {
    const links = loadPage(`${prefix}index.html`).querySelectorAll('.nav-desktop .nav-link');
    assert.deepEqual(links.map((a) => a.getAttribute('href')), [
      '#home', '#about', '#ministries', '#media', href(`${prefix}churches/`), '#donate', href(`${prefix}projects/`), '#contacts',
    ]);
    assert.equal(links[0].text, home.nav.home[lang]);
    assert.equal(loadPage(`${prefix}index.html`).querySelector('.cta-leaders').getAttribute('href'), href(`${prefix}leaders/`));
  }
});

test('герой: заголовок з розміткою, факти і калькулятор з даних', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    assert.equal(root.querySelector('.hero h1').innerHTML, home.hero.title[lang]);
    assert.equal(root.querySelector('[data-calc-amount]').getAttribute('value'), String(donate.defaultAmount));
    assert.deepEqual(
      root.querySelectorAll('[data-calc-add]').map((b) => b.getAttribute('data-calc-add')),
      donate.calcIncrements.map(String),
    );
    assert.equal(root.querySelector('.hero-donate-cta').getAttribute('href'), donate.liqpayUrl);
    assert.equal(root.querySelector('.hero-media-photo').getAttribute('src'), href('uploads/hero-cross.jpg'));
    assert.equal(root.querySelector('.hero-media source').getAttribute('srcset'), href('uploads/hero-cross-mobile.jpg'));
  }
});

test('сім тверджень віри, три новини зі стрілкою, чотири блоки «віримо»', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    assert.deepEqual(root.querySelectorAll('.belief p').map((p) => p.text), home.beliefs.map((b) => b[lang]));
    const news = root.querySelectorAll('.news-card');
    assert.equal(news.length, 3);
    // Рішення 11: стрілка — у шаблоні, тож є на обох мовах.
    for (const card of news) assert.ok(card.querySelector('.news-more svg'), `${lang}: без стрілки`);
    assert.equal(news[0].querySelector('.news-more').text.trim(), home.news.more[lang]);
    assert.deepEqual(root.querySelectorAll('.believe-item .n').map((n) => n.text), ['01', '02', '03', '04']);
    assert.equal(root.querySelector('.fb-page').getAttribute('data-href'), settings.social.facebook);
  }
});

test('футер: соцмережі — реальні адреси, нові сторінки поки ведуть на якорі', () => {
  const root = loadPage('index.html');
  assert.deepEqual(
    root.querySelectorAll('.footer-socials a').map((a) => a.getAttribute('href')),
    [settings.social.youtube, settings.social.facebook, settings.social.instagram],
  );
  const nav = root.querySelectorAll('.footer-col')[0].querySelectorAll('a').map((a) => a.getAttribute('href'));
  // Рішення 10: /about/ і /donate/ вимкнені (body: null) — посилань на них немає.
  assert.deepEqual(nav, ['#about', '#ministries', '#media', '#donate', href('projects/')]);
  assert.equal(root.querySelectorAll('.footer-col')[1].querySelectorAll('a')[2].getAttribute('href'), '#contacts');
  assert.equal(root.querySelectorAll('.footer-col')[1].querySelectorAll('a')[0].getAttribute('href'), `tel:${contact.phone}`);
});
