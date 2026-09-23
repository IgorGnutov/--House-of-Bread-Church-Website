import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages, readSingleton, sortedData } from './helpers/content.js';
import { isPageEnabled } from '../src/lib/pages.mjs';
import { assetUrl } from '../src/lib/paths.mjs';
import { withQuery } from '../src/lib/format.mjs';
import { ytId } from '../src/lib/youtube.mjs';
import { BASE_PATH } from '../astro.config.mjs';

// Очікування — з тих самих даних, що й збірка: адмінка може додати,
// видалити чи переставити будь-що, і тест має лишатися зеленим.
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

test('герой: заголовок з розміткою, фото, факти і калькулятор з даних', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    assert.equal(root.querySelector('.hero h1').innerHTML, home.hero.title[lang]);
    assert.equal(root.querySelector('[data-calc-amount]').getAttribute('value'), String(donate.defaultAmount));
    assert.deepEqual(
      root.querySelectorAll('[data-calc-add]').map((b) => b.getAttribute('data-calc-add')),
      donate.calcIncrements.map(String),
    );
    assert.equal(root.querySelector('.hero-donate-cta').getAttribute('href'), donate.liqpayUrl);
    assert.equal(root.querySelector('.hero-media-photo').getAttribute('src'), assetUrl(BASE_PATH, home.heroImage.src));
    assert.equal(root.querySelector('.hero-media source').getAttribute('srcset'), assetUrl(BASE_PATH, home.heroImage.mobileSrc));
  }
});

test('твердження віри, новини зі стрілкою і блоки «віримо» — стільки, скільки в даних', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    assert.deepEqual(root.querySelectorAll('.belief p').map((p) => p.text), home.beliefs.map((b) => b[lang]));
    const news = root.querySelectorAll('.news-card');
    assert.equal(news.length, home.news.items.length);
    // Рішення 11: стрілка — у шаблоні, тож є на обох мовах.
    for (const card of news) {
      assert.ok(card.querySelector('.news-more svg'), `${lang}: без стрілки`);
      assert.equal(card.querySelector('.news-more').text.trim(), home.news.more[lang]);
    }
    assert.deepEqual(
      root.querySelectorAll('.believe-item .n').map((n) => n.text),
      home.wwb.items.map((_, i) => String(i + 1).padStart(2, '0')),
    );
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
  assert.equal(root.querySelectorAll('.footer-col')[1].querySelectorAll('a')[0].getAttribute('href'), `tel:${contact.phone.replace(/[^+\d]/g, '')}`);
});

const ministries = sortedData(readCollection('ministries'));
const pastors = sortedData(readCollection('pastors')).filter((p) => p.group === 'pastor');
const videos = sortedData(readCollection('testimonies')).filter((x) => x.type === 'video');

test('карусель: текстові свідчення головної, за ними відео з колекції', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    const section = root.querySelector('section.testimonies');
    assert.equal(section.getAttribute('id'), 'testimonies', 'рішення 9: якір для «назад»');
    const texts = home.testimonies.items;
    const cards = section.querySelectorAll('.tst-card');
    assert.equal(cards.length, texts.length + videos.length);
    texts.forEach((x, i) => assert.equal(cards[i].querySelector('p').text, x.text[lang]));
    videos.forEach((v, i) => {
      const card = cards[texts.length + i];
      // Знахідка 3: сторінка вставляє чистий ID, а не сирий videoUrl з контенту.
      assert.equal(card.querySelector('.tst-video').getAttribute('data-yt'), ytId(v.videoUrl));
      assert.equal(card.querySelector('.tst-person span span').text, v.role[lang]);
    });
    // Гортати має сенс лише з двох карток.
    assert.equal(Boolean(section.querySelector('.tst-ctrls')), cards.length > 1);
    assert.equal(section.querySelector('.tst-foot a').getAttribute('href'), href(`${prefix}testimonies/`));
  }
});

test('перші (до трьох) служіння за order і пастори з колекції', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    const cards = root.querySelectorAll('#ministries .min-card');
    assert.deepEqual(cards.map((c) => c.getAttribute('href')), ministries.slice(0, 3).map((m) => href(`${prefix}ministries/${m.slug}/`)));
    assert.deepEqual(cards.map((c) => c.querySelector('h3').text), ministries.slice(0, 3).map((m) => m.name[lang]));
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
    assert.equal(items[1].querySelector('a').getAttribute('href'), `tel:${contact.phone.replace(/[^+\d]/g, '')}`);
    assert.equal(items[1].querySelector('a').text, contact.phoneDisplay);
    assert.equal(items[2].querySelector('a').getAttribute('href'), `mailto:${contact.email}`);
    assert.equal(root.querySelector('.service-times .time').text, `${home.contacts.svcDay[lang]} · ${contact.serviceTime}`);
    assert.equal(root.querySelector('.map-wrap iframe').getAttribute('src'), withQuery(contact.mapUrl, 'output=embed'));
    assert.deepEqual(
      root.querySelectorAll('.socials-row a').map((a) => a.getAttribute('href')),
      [settings.social.telegram, settings.social.facebook, settings.social.youtube, settings.social.instagram],
    );
    // Рішення 11: посилання на вірш — у шаблоні, на обох мовах.
    assert.equal(root.querySelector('#donate cite').text, home.donate.ref[lang]);
    assert.equal(root.querySelector('.donate-btn').getAttribute('href'), donate.liqpayUrl);
  }
});
