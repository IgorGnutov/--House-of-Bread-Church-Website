import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './helpers/dist.js';
import { withBuild } from './helpers/build.js';
import { readCollection, readPages, readSingleton, sortedData } from './helpers/content.js';
import { church, ministry, rich } from './helpers/probes.js';
import { telHref } from '../src/lib/format.mjs';
import { linkAttrs } from '../src/lib/paths.mjs';
import { BASE_PATH } from '../astro.config.mjs';

// Адреса кожної кнопки — з поля контенту, а порожнє поле лишає стару адресу.
// Очікування — з даних, які тест читає: редактор може заповнити будь-яке поле.
const LOCALES = [['uk', ''], ['en', 'en/']];
const T = { timeout: 300_000 };
const home = readSingleton('homepage');
const settings = readSingleton('site-settings');
const donate = readSingleton('donate-settings');
const streams = `${settings.social.youtube}/streams`;
const posts = readCollection('facebook');

// Запасні адреси кнопок help: були єдиними до появи поля в даних.
const MESSENGER = 'https://m.me/dom.hleba.org';
const COORDINATOR = 'mailto:leaders@houseofbread.church';

// Без target/rel для внутрішніх адрес: undefined збігається з відсутнім атрибутом.
const expected = (lang, url) => ({ target: undefined, rel: undefined, ...linkAttrs(BASE_PATH, lang, url) });
const actual = (el) => {
  assert.ok(el, 'кнопки немає на сторінці');
  return { href: el.getAttribute('href'), target: el.getAttribute('target'), rel: el.getAttribute('rel') };
};
const norm = (attrs) => ({ target: undefined, rel: undefined, ...Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== null)) });
const check = (el, lang, url, what) => assert.deepEqual(norm(actual(el)), expected(lang, url), what);

test('кнопки головної — з полів контенту, порожні — з фолбеків', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    const where = (name) => `${lang}: ${name}`;
    check(root.querySelector('.cta-live').parentNode, lang, home.cta.liveUrl ?? streams, where('шапка'));
    check(root.querySelector('.drawer-foot a'), lang, home.cta.liveUrl ?? streams, where('мобільне меню'));
    check(root.querySelector('.hero-actions .btn-primary'), lang, home.hero.watchUrl ?? streams, where('Дивитися'));
    check(root.querySelector('.hero-actions .btn-ghost'), lang, home.hero.contactsUrl ?? '#contacts', where('Контакти'));
    check(root.querySelector('.donate-card-cta'), lang, home.hero.donateUrl ?? donate.liqpayUrl, where('Пожертвувати'));
    check(root.querySelector('.tst-foot a'), lang, home.testimonies.allUrl ?? '/testimonies/', where('усі свідчення'));
    check(root.querySelector('.min-foot a'), lang, home.ministries.allUrl ?? '/ministries/', where('усі служіння'));
    check(root.querySelector('.pastors-foot a'), lang, home.pastors.allUrl ?? '/pastors/', where('усі пастори'));
    check(root.querySelector('.donate-btn'), lang, home.donate.btnUrl ?? donate.liqpayUrl, where('пожертви'));
    // Ручні картки новин показуються лише без постів Facebook; з постами їх
    // адреси перевіряє пробна збірка нижче.
    const more = root.querySelectorAll('.news-grid .news-more');
    assert.equal(more.length, posts.length > 0 ? 0 : home.news.items.length);
    more.forEach((a, i) => check(a, lang, home.news.items[i].url ?? '#media', where(`новина ${i + 1}`)));
  }
});

test('«Потрібна допомога» — з help.btnUrl або константи сторінки', () => {
  const pages = readPages();
  for (const [id, fallback] of [['pastors', MESSENGER], ['leaders', COORDINATOR]]) {
    for (const [lang, prefix] of LOCALES) {
      const button = loadPage(`${prefix}${id}/index.html`).querySelector('.help .btn');
      const help = pages[id].help;
      assert.equal(Boolean(button), Boolean(help), `${lang}/${id}: блок help ↔ кнопка`);
      if (help) check(button, lang, help.btnUrl ?? fallback, `${lang}/${id}`);
    }
  }
});

test('служіння й церква: поле кнопки, інакше телефон і маршрут', () => {
  for (const m of sortedData(readCollection('ministries'))) {
    for (const [lang, prefix] of LOCALES) {
      const button = loadPage(`${prefix}ministries/${m.slug}/index.html`).querySelector('.info > .btn');
      check(button, lang, m.ctaUrl ?? telHref(m.phone), `${lang}/${m.slug}`);
    }
  }
  for (const c of sortedData(readCollection('churches'))) {
    // Маршрут — за українськими полями незалежно від мови сторінки (як у легасі).
    const maps = `https://www.google.com/maps?q=${encodeURIComponent(`${c.city.uk} ${c.address.uk}`)}`;
    for (const [lang, prefix] of LOCALES) {
      const button = loadPage(`${prefix}churches/${c.slug}/index.html`).querySelector('.info > .btn');
      check(button, lang, c.directionsUrl ?? maps, `${lang}/${c.slug}`);
    }
  }
});

test('заповнені поля перекривають фолбеки', T, () => {
  const url = {
    live: 'https://example.test/live', watch: '/contacts/', contacts: '#donate', donate: 'tel:+380000000001',
    news: ['https://example.test/news-1', '/projects/'], testimonies: '/churches/', ministries: 'mailto:min@example.test',
    pastors: 'https://example.test/pastors', btn: '/leaders/', help: '/contacts/', ministry: 'mailto:join@example.test',
    church: 'https://example.test/route',
  };
  withBuild((content) => {
    // Без постів Facebook показуються ручні картки — на них і перевіряємо адреси новин.
    content.clear('facebook');
    content.editSingleton('homepage', ({ main }) => {
      main.cta.liveUrl = url.live;
      Object.assign(main.hero, { watchUrl: url.watch, contactsUrl: url.contacts, donateUrl: url.donate });
      main.news.items = main.news.items.slice(0, 2).map((item, i) => ({ ...item, url: url.news[i] }));
      main.testimonies.allUrl = url.testimonies;
      main.ministries.allUrl = url.ministries;
      main.pastors.allUrl = url.pastors;
      main.donate.btnUrl = url.btn;
    });
    content.editSingleton('pages', (pages) => {
      pages.pastors.help = { title: { uk: 'Т', en: 'T' }, desc: rich('Опис'), btn: { uk: 'К', en: 'B' }, btnUrl: url.help };
    });
    content.write('ministries', 'probe-btn', ministry('probe-btn', { ctaUrl: url.ministry }));
    content.write('churches', 'probe-btn', church('probe-btn', { directionsUrl: url.church }));
  }, (result) => {
    assert.equal(result.failed, false, result.output.slice(-3000));
    for (const [lang, prefix] of LOCALES) {
      const root = result.page(`${prefix}index.html`);
      const at = (selector, what, want) => check(root.querySelector(selector), lang, want, `${lang}: ${what}`);
      check(root.querySelector('.cta-live').parentNode, lang, url.live, `${lang}: шапка`);
      check(root.querySelector('.drawer-foot a'), lang, url.live, `${lang}: мобільне меню`);
      at('.hero-actions .btn-primary', 'Дивитися', url.watch);
      at('.hero-actions .btn-ghost', 'Контакти', url.contacts);
      at('.donate-card-cta', 'Пожертвувати', url.donate);
      at('.tst-foot a', 'усі свідчення', url.testimonies);
      at('.min-foot a', 'усі служіння', url.ministries);
      at('.pastors-foot a', 'усі пастори', url.pastors);
      at('.donate-btn', 'пожертви', url.btn);
      const more = root.querySelectorAll('.news-grid .news-more');
      assert.equal(more.length, 2);
      more.forEach((a, i) => check(a, lang, url.news[i], `${lang}: новина ${i + 1}`));
      check(result.page(`${prefix}pastors/index.html`).querySelector('.help .btn'), lang, url.help, `${lang}: help`);
      check(result.page(`${prefix}ministries/probe-btn/index.html`).querySelector('.info > .btn'), lang, url.ministry, `${lang}: служіння`);
      check(result.page(`${prefix}churches/probe-btn/index.html`).querySelector('.info > .btn'), lang, url.church, `${lang}: церква`);
    }
    // Нова вкладка — лише для чужих сайтів (https), не для пошти, телефону й шляхів сайту.
    const root = result.page('index.html');
    const blank = (selector) => root.querySelector(selector).getAttribute('target') === '_blank';
    assert.equal(blank('.hero-actions .btn-primary'), false, 'шлях сайту');
    assert.equal(blank('.donate-card-cta'), false, 'tel:');
    assert.equal(blank('.min-foot a'), false, 'mailto:');
    assert.equal(blank('.pastors-foot a'), true, 'https://');
    assert.equal(result.page('churches/probe-btn/index.html').querySelector('.info > .btn').getAttribute('target'), '_blank');
    assert.equal(result.page('ministries/probe-btn/index.html').querySelector('.info > .btn').getAttribute('target') ?? null, null);
  });
});

test('адреса кнопки поза linkUrl валить схему з назвою поля', T, () => {
  withBuild((content) => {
    content.editSingleton('homepage', ({ main }) => { main.hero.contactsUrl = 'javascript:alert(1)'; });
  }, (result) => {
    assert.equal(result.failed, true, 'збірка пройшла з javascript:-адресою кнопки');
    assert.match(result.output, /contactsUrl/, `у помилці немає назви поля:\n${result.output.slice(-2000)}`);
  });
});
