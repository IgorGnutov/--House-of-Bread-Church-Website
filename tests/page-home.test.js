import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { href, loadPage } from './helpers/dist.js';
import { withBuild } from './helpers/build.js';
import { findBrokenLinks } from './helpers/links.js';
import { t } from './helpers/i18n.js';
import { readCollection, readPages, readSingleton, sortedData } from './helpers/content.js';
import { isPageEnabled } from '../src/lib/pages.mjs';
import { assetUrl } from '../src/lib/paths.mjs';
import { withQuery } from '../src/lib/format.mjs';
import { ytId } from '../src/lib/youtube.mjs';
import { formatPostDate, isWide, linkify, sortPosts, splitPost } from '../src/lib/facebook.mjs';
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

// Стрічка Facebook (Спека 5) — знімок fb:pull; у git його немає, тож
// основна збірка може мати і пости, і нуль постів.
const posts = readCollection('facebook');

test('твердження віри, новини зі стрілкою і блоки «віримо» — стільки, скільки в даних', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    assert.deepEqual(root.querySelectorAll('.belief p').map((p) => p.text), home.beliefs.map((b) => b[lang]));
    // Ручні картки — лише коли постів нуль.
    const news = root.querySelectorAll('.news-grid .news-card');
    assert.equal(news.length, posts.length > 0 ? 0 : home.news.items.length);
    assert.equal(root.querySelectorAll('#media .fb-card').length, posts.length);
    // Рішення 11: стрілка — у шаблоні, тож є на обох мовах.
    for (const card of news) {
      assert.ok(card.querySelector('.news-more svg'), `${lang}: без стрілки`);
      assert.equal(card.querySelector('.news-more').text.trim(), home.news.more[lang]);
    }
    assert.deepEqual(
      root.querySelectorAll('.believe-item .n').map((n) => n.text),
      home.wwb.items.map((_, i) => String(i + 1).padStart(2, '0')),
    );
    // Page Plugin прибрано: частина браузерів блокує його як трекер.
    assert.equal(root.querySelector('.fb-embed, #fb-root, .fb-page'), null);
    assert.ok(!root.toString().includes('connect.facebook.net'));
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

// ---- Стрічка Facebook: пробні збірки (Спека 5) ----
const T = { timeout: 300_000 };
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/facebook-posts.json', import.meta.url), 'utf8'));
const withPosts = (list, check, editHome) => withBuild((content) => {
  content.clear('facebook');
  list.forEach((post) => content.write('facebook', post.id, post));
  if (editHome) content.editSingleton('homepage', (data) => editHome(data.main));
}, (result) => {
  assert.equal(result.failed, false, result.output.slice(-3000));
  return check(result);
});

test('0 постів → ручні картки, без каруселі й без SDK Facebook', T, () => {
  withPosts([], ({ page }) => {
    for (const [, prefix] of LOCALES) {
      const root = page(`${prefix}index.html`);
      assert.equal(root.querySelectorAll('#media .news-grid .news-card').length, home.news.items.length);
      assert.equal(root.querySelector('#media .fb-track'), null);
      assert.equal(root.querySelector('#media .tst-ctrls'), null);
      assert.ok(!root.toString().includes('connect.facebook.net'));
    }
  });
});

test('0 постів і 0 ручних карток → ні каруселі, ні сітки', T, () => {
  withPosts([], ({ page }) => {
    const root = page('index.html');
    assert.equal(root.querySelector('#media .news-grid'), null);
    assert.equal(root.querySelector('#media .fb-track'), null);
    assert.ok(root.querySelector('#media .section-title'), 'заголовок секції лишається');
  }, (main) => { main.news.items = []; });
});

test('1 пост → картка без кнопок гортання', T, () => {
  withPosts([FIXTURE[0]], ({ page }) => {
    const root = page('index.html');
    assert.equal(root.querySelectorAll('#media .fb-card').length, 1);
    assert.equal(root.querySelector('#media .tst-ctrls'), null);
    assert.equal(root.querySelector('#media .news-grid'), null, 'ручні картки не показуються поруч із постами');
  });
});

test('12 постів → картки в порядку дат, формат медіа, текст, посилання, lang, мова дати', T, () => {
  const expected = sortPosts(FIXTURE);
  withPosts(FIXTURE, ({ page, outDir }) => {
    for (const [lang, prefix] of LOCALES) {
      const root = page(`${prefix}index.html`);
      const track = root.querySelector('#media .fb-track');
      assert.equal(track.getAttribute('role'), 'region');
      assert.equal(track.getAttribute('aria-label'), t(lang, 'a11y.facebookFeed'));
      const buttons = root.querySelectorAll('#media .tst-ctrls button');
      assert.deepEqual(buttons.map((b) => b.getAttribute('aria-label')), [t(lang, 'a11y.prevPost'), t(lang, 'a11y.nextPost')]);
      const cards = track.querySelectorAll('.fb-card');
      assert.equal(cards.length, 12);
      cards.forEach((card, i) => {
        const post = expected[i];
        const where = `${lang} #${i} ${post.id}`;
        const thumb = card.querySelector('.fb-thumb');
        const kind = post.image === null ? 'is-empty' : isWide(post.image) ? 'is-wide' : 'is-narrow';
        assert.ok(thumb.classList.contains(kind), `${where}: ${thumb.getAttribute('class')} без ${kind}`);
        if (post.image) assert.equal(thumb.querySelector('.fb-img').getAttribute('src'), assetUrl(BASE_PATH, post.image.src), where);
        // Розмита копія — лише під вузьким медіа, і скрінрідер її не читає.
        const blur = thumb.querySelector('.fb-blur');
        assert.equal(Boolean(blur), kind === 'is-narrow', where);
        if (blur) assert.equal(blur.getAttribute('aria-hidden'), 'true');
        if (kind === 'is-empty') assert.equal(thumb.querySelector('.fb-logo').getAttribute('src'), assetUrl(BASE_PATH, settings.logo[lang]), where);
        assert.equal(Boolean(thumb.querySelector('.fb-play')), post.video, where);
        assert.equal(card.querySelector('.news-date').text, formatPostDate(post.date, lang), where);
        const { title, body } = splitPost(post.text);
        const h3 = card.querySelector('h3');
        const p = card.querySelector('.news-body p');
        assert.equal(h3?.text ?? null, title, where);
        assert.equal(p?.innerHTML ?? null, body === null ? null : linkify(body), where);
        // Пост існує однією мовою: на /en/ він позначений як український.
        for (const el of [h3, p].filter(Boolean)) assert.equal(el.getAttribute('lang') ?? null, lang === 'en' ? 'uk' : null, where);
        for (const a of p?.querySelectorAll('a') ?? []) {
          assert.match(a.getAttribute('href'), /^https?:\/\//, where);
          assert.equal(a.getAttribute('target'), '_blank');
          assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
        }
        const more = card.querySelector('.news-more');
        assert.equal(more.getAttribute('href'), post.url, where);
        assert.equal(more.getAttribute('target'), '_blank');
        assert.equal(more.text.trim(), home.news.more[lang]);
        // Атрибутів Visual Editor на стрічці немає: її не редагують.
        assert.ok(!card.toString().includes('data-blok'), where);
      });
      // Чужа розмітка — буквальний текст, а не елемент сторінки.
      assert.equal(track.querySelector('script'), null);
      assert.ok(track.text.includes('<script>alert(1)</script>'));
      assert.equal(root.querySelector('#media .news-grid'), null);
    }
    assert.deepEqual(findBrokenLinks(outDir, BASE_PATH), []);
  });
});
