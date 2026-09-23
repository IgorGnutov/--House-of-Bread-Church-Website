import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages, readSingleton } from './helpers/content.js';
import { isPageEnabled } from '../src/lib/pages.mjs';
import { ytId } from '../src/lib/youtube.mjs';

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

test('футер: соцмережі — реальні адреси, пункти-заглушки узгоджені зі станом pages.json', () => {
  const pages = readPages();
  const root = loadPage('index.html');
  assert.deepEqual(
    root.querySelectorAll('.footer-socials a').map((a) => a.getAttribute('href')),
    [settings.social.youtube, settings.social.facebook, settings.social.instagram],
  );
  // Знахідка 1: тест не має ламатися, коли замовник додасть текст на
  // /about/, /contacts/ чи /donate/ — очікування рахуємо з реального стану
  // pages.json (isPageEnabled), а не зі стану «на сьогодні».
  const expected = (id, anchor) => (isPageEnabled(pages[id]) ? href(`${id}/`) : anchor);
  const nav = root.querySelectorAll('.footer-col')[0].querySelectorAll('a').map((a) => a.getAttribute('href'));
  assert.deepEqual(nav, [expected('about', '#about'), '#ministries', '#media', expected('donate', '#donate'), href('projects/')]);
  assert.equal(root.querySelectorAll('.footer-col')[1].querySelectorAll('a')[2].getAttribute('href'), expected('contacts', '#contacts'));
  assert.equal(root.querySelectorAll('.footer-col')[1].querySelectorAll('a')[0].getAttribute('href'), `tel:${contact.phone}`);
});

const byOrder = (a, b) => a.order - b.order;
const ministries = readCollection('ministries').map(({ data }) => data).sort(byOrder);
const pastors = readCollection('pastors').map(({ data }) => data).filter((p) => p.group === 'pastor').sort(byOrder);
const videos = readCollection('testimonies').map(({ data }) => data).filter((x) => x.type === 'video').sort(byOrder);

test('карусель: чотири текстові свідчення головної і відео з колекції', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    const section = root.querySelector('section.testimonies');
    assert.equal(section.getAttribute('id'), 'testimonies', 'рішення 9: якір для «назад»');
    const cards = section.querySelectorAll('.tst-card');
    assert.equal(cards.length, home.testimonies.items.length + videos.length);
    assert.equal(cards[0].querySelector('p').text, home.testimonies.items[0].text[lang]);
    // Знахідка 3: сторінка вставляє чистий ID, а не сирий videoUrl з контенту.
    assert.equal(cards[4].querySelector('.tst-video').getAttribute('data-yt'), ytId(videos[0].videoUrl));
    assert.equal(cards[4].querySelector('.tst-person span span').text, videos[0].role[lang]);
    assert.equal(section.querySelector('.tst-foot a').getAttribute('href'), href(`${prefix}testimonies/`));
  }
});

test('перші три служіння за order і пастори з колекції', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    const cards = root.querySelectorAll('#ministries .min-card');
    assert.deepEqual(cards.map((c) => c.getAttribute('href')), ministries.slice(0, 3).map((m) => href(`${prefix}ministries/${m.slug}/`)));
    assert.equal(cards[0].querySelector('h3').text, ministries[0].name[lang]);
    assert.equal(root.querySelector('#ministries .min-foot a').getAttribute('href'), href(`${prefix}ministries/`));
    const people = root.querySelectorAll('#pastors .pastor-card');
    assert.deepEqual(people.map((c) => c.querySelector('h3').text), pastors.map((p) => p.name));
    assert.deepEqual(people.map((c) => c.querySelector('.role').text), pastors.map((p) => p.role[lang]));
    assert.equal(root.querySelector('#pastors .pastors-foot a').getAttribute('href'), href(`${prefix}pastors/`));
  }
});

test('контакти — з contact-info, пожертви — з donate-settings, вірш з <cite> обома мовами', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    const items = root.querySelectorAll('#contacts .contact-item');
    assert.equal(items[0].querySelector('.val').text, home.contacts.addr[lang]);
    assert.equal(items[1].querySelector('a').getAttribute('href'), `tel:${contact.phone}`);
    assert.equal(items[1].querySelector('a').text, contact.phoneDisplay);
    assert.equal(items[2].querySelector('a').getAttribute('href'), `mailto:${contact.email}`);
    assert.equal(root.querySelector('.service-times .time').text, `${home.contacts.svcDay[lang]} · ${contact.serviceTime}`);
    assert.equal(root.querySelector('.map-wrap iframe').getAttribute('src'), `${contact.mapUrl}&output=embed`);
    assert.deepEqual(
      root.querySelectorAll('.socials-row a').map((a) => a.getAttribute('href')),
      [settings.social.telegram, settings.social.facebook, settings.social.youtube, settings.social.instagram],
    );
    // Рішення 11: посилання на вірш — у шаблоні, на обох мовах.
    assert.equal(root.querySelector('#donate cite').text, home.donate.ref[lang]);
    assert.equal(root.querySelector('.donate-btn').getAttribute('href'), donate.liqpayUrl);
  }
});
