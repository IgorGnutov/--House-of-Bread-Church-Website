import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESCRIPTION_MAX, absoluteUrl, alternates, fullTitle, pageDescription, resolveMeta, siteFallbackImage, truncate,
} from '../src/lib/seo.mjs';
import { breadcrumbNode, churchNode, jsonLdScript, openingHours, organizationNode } from '../src/lib/jsonld.mjs';

const pair = (uk, en = uk) => ({ uk, en });
const SITE = 'https://example.org/';
// JSON-круг: властивість зі значенням undefined у JSON не потрапляє — саме це
// бачить пошуковик, тож порівнюємо після серіалізації.
const json = (value) => JSON.parse(JSON.stringify(value));

test('truncate: короткий текст — як є, пробіли й переноси згорнуто', () => {
  assert.equal(truncate('  Два\n\nабзаци  '), 'Два абзаци');
});

test('truncate: довгий текст — по слову, з «…», не довше за межу', () => {
  const long = 'слово '.repeat(60);
  const out = truncate(long);
  assert.ok(out.length <= DESCRIPTION_MAX, `${out.length} > ${DESCRIPTION_MAX}`);
  assert.ok(out.endsWith('…'));
  assert.ok(!out.includes(' …'), 'пробіл перед «…»');
  assert.ok(long.startsWith(out.slice(0, -1)), 'обрізане — не префікс оригіналу');
});

test('truncate: розділовий знак перед «…» прибирається', () => {
  const text = `${'x'.repeat(150)} слово, далі ще багато тексту`;
  assert.equal(truncate(text), `${'x'.repeat(150)} слово…`);
});

test('truncate: одне довге слово ріжеться по символу', () => {
  const out = truncate('а'.repeat(300));
  assert.equal(out, `${'а'.repeat(DESCRIPTION_MAX - 1)}…`);
});

test('fullTitle: суфікс бренду, якщо заголовок його ще не містить', () => {
  assert.equal(fullTitle('Служіння', 'Дім Хліба'), 'Служіння — Дім Хліба');
  assert.equal(fullTitle('Дім Хліба — Кривий Ріг', 'Дім Хліба'), 'Дім Хліба — Кривий Ріг');
  assert.equal(fullTitle('Дім Хліба', 'Дім Хліба'), 'Дім Хліба');
});

test('fullTitle: назва бренду без останнього слова теж рахується дублем (3+ слова)', () => {
  // «House of Bread — Dnipro» вже несе основу «House of Bread» повної назви
  // «House of Bread Church» — суфікс не додається.
  assert.equal(fullTitle('House of Bread — Dnipro', 'House of Bread Church'), 'House of Bread — Dnipro');
  assert.equal(fullTitle('Ministries', 'House of Bread Church'), 'Ministries — House of Bread Church');
});

test('pageDescription: лід, інакше перший абзац прози, інакше нічого', () => {
  assert.equal(pageDescription({ title: pair('T'), lead: pair('Лід', 'Lead') }, 'en'), 'Lead');
  assert.equal(pageDescription({ title: pair('T'), body: pair('Перший.\n\nДругий.') }, 'uk'), 'Перший.');
  assert.equal(pageDescription({ title: pair('T'), body: null }, 'uk'), undefined);
});

test('absoluteUrl: відносний шлях — під base і SITE_URL, зовнішній — як є', () => {
  assert.equal(absoluteUrl(SITE, '/sub/', 'uploads/a.jpg'), 'https://example.org/sub/uploads/a.jpg');
  assert.equal(absoluteUrl(SITE, '/sub/', 'https://cdn.test/a.jpg'), 'https://cdn.test/a.jpg');
});

test('alternates: uk, en і x-default на українську', () => {
  assert.deepEqual(alternates(SITE, '/sub/', '/ministries/youth/'), [
    { hreflang: 'uk', href: 'https://example.org/sub/ministries/youth/' },
    { hreflang: 'en', href: 'https://example.org/sub/en/ministries/youth/' },
    { hreflang: 'x-default', href: 'https://example.org/sub/ministries/youth/' },
  ]);
});

test('siteFallbackImage: defaultOgImage, інакше фото героя', () => {
  const home = { heroImage: { src: 'uploads/hero.jpg' } };
  assert.equal(siteFallbackImage({ defaultOgImage: null }, home), 'uploads/hero.jpg');
  assert.equal(siteFallbackImage({ defaultOgImage: 'uploads/og.jpg' }, home), 'uploads/og.jpg');
});

const ARGS = {
  site: SITE, base: '/', lang: 'en', path: '/ministries/youth/', title: 'Youth', description: 'Summary',
  seo: null, image: 'uploads/cover.jpg', siteName: 'House of Bread Church', defaultDescription: 'Default',
  fallbackImage: 'uploads/hero.jpg', noindex: false,
};

test('resolveMeta: без SEO-полів — фолбеки', () => {
  assert.deepEqual(resolveMeta(ARGS), {
    title: 'Youth — House of Bread Church',
    description: 'Summary',
    canonical: 'https://example.org/en/ministries/youth/',
    alternates: alternates(SITE, '/', '/ministries/youth/'),
    image: 'https://example.org/uploads/cover.jpg',
    noindex: false,
    locale: 'en_US',
    localeAlternate: 'uk_UA',
    siteName: 'House of Bread Church',
  });
});

test('resolveMeta: SEO-поля редактора перекривають фолбеки дослівно', () => {
  const longDescription = 'word '.repeat(50).trim();
  const meta = resolveMeta({
    ...ARGS,
    seo: { metaTitle: pair('Мета', 'Meta'), metaDescription: pair('О', longDescription), ogImage: 'uploads/og.jpg', noindex: true },
  });
  assert.equal(meta.title, 'Meta');
  assert.equal(meta.description, longDescription, 'metaDescription редактора не обрізається');
  assert.equal(meta.image, 'https://example.org/uploads/og.jpg');
  assert.equal(meta.noindex, true);
});

test('resolveMeta: без опису й картинки — загальні фолбеки сайту', () => {
  const meta = resolveMeta({ ...ARGS, description: undefined, image: undefined });
  assert.equal(meta.description, 'Default');
  assert.equal(meta.image, 'https://example.org/uploads/hero.jpg');
});

test('resolveMeta: прев\'ю-режим закриває навіть запис без noindex', () => {
  const seo = { metaTitle: null, metaDescription: null, ogImage: null, noindex: false };
  assert.equal(resolveMeta({ ...ARGS, seo, noindex: true }).noindex, true);
});

test('openingHours: дні й діапазон часу з англійського тексту', () => {
  assert.equal(openingHours('Saturday · 12:00–14:00'), 'Sa 12:00-14:00');
  assert.equal(openingHours('Saturday, Sunday 9:30 - 11:00'), 'Sa,Su 09:30-11:00');
  assert.equal(openingHours('Sundays 10:00—12:00'), 'Su 10:00-12:00');
});

test('openingHours: без часу закінчення, без дня чи з неможливим часом — null', () => {
  assert.equal(openingHours('Sunday · 10:00'), null);
  assert.equal(openingHours('By appointment'), null);
  assert.equal(openingHours('12:00–14:00'), null);
  assert.equal(openingHours('Sunday 25:00–26:00'), null);
});

test('openingHours: декілька служб чи діапазон днів — null, а не вигадана пара', () => {
  // Було б "We,Su 10:00-12:00" — вигадана недільна пара для середи.
  assert.equal(openingHours('Sunday 10:00–12:00, Wednesday 18:00–20:00'), null);
  // Було б "Fr,Sa 12:00-14:00" — вигадана суботня пара для п'ятничного молодіжного.
  assert.equal(openingHours('Saturday 12:00–14:00 (youth: Friday 18:00)'), null);
  // Було б "Mo,Fr 18:00-20:00" — губить вівторок-четвер.
  assert.equal(openingHours('Monday–Friday 18:00–20:00'), null);
});

test('churchNode: повний вузол', () => {
  const node = churchNode({
    id: 'https://example.org/#church', url: 'https://example.org/', name: 'Дім Хліба',
    image: 'https://example.org/uploads/hero.jpg', street: 'вул. Така, 1', city: 'Кривий Ріг',
    geo: { lat: 47.9, lng: 33.39 }, hours: 'Sa 12:00-14:00', telephone: '+380991339969',
    email: 'info@example.org', sameAs: ['https://facebook.com/x'],
  });
  assert.deepEqual(json(node), {
    '@type': 'Church', '@id': 'https://example.org/#church', name: 'Дім Хліба', url: 'https://example.org/',
    image: 'https://example.org/uploads/hero.jpg',
    address: { '@type': 'PostalAddress', streetAddress: 'вул. Така, 1', addressLocality: 'Кривий Ріг', addressCountry: 'UA' },
    geo: { '@type': 'GeoCoordinates', latitude: 47.9, longitude: 33.39 },
    openingHours: 'Sa 12:00-14:00', telephone: '+380991339969', email: 'info@example.org',
    sameAs: ['https://facebook.com/x'],
  });
});

test('churchNode: без geo, годин і контактів — властивостей немає зовсім', () => {
  const node = json(churchNode({ id: 'i', url: 'u', name: 'N', street: 'S', city: 'C', geo: null, hours: null, sameAs: [] }));
  for (const key of ['geo', 'openingHours', 'telephone', 'email', 'sameAs', 'image']) {
    assert.equal(key in node, false, `${key} мав би бути відсутнім, а не null`);
  }
});

test('organizationNode: логотип і соцмережі', () => {
  assert.deepEqual(json(organizationNode({
    id: 'https://example.org/#organization', url: 'https://example.org/', name: 'Дім Хліба',
    logo: 'https://example.org/uploads/logo.png', telephone: '+380991339969', email: 'info@example.org',
    sameAs: ['https://t.me/x'],
  })), {
    '@type': 'Organization', '@id': 'https://example.org/#organization', name: 'Дім Хліба',
    url: 'https://example.org/', logo: 'https://example.org/uploads/logo.png',
    telephone: '+380991339969', email: 'info@example.org', sameAs: ['https://t.me/x'],
  });
});

test('breadcrumbNode: позиції з одиниці по порядку', () => {
  assert.deepEqual(breadcrumbNode([{ name: 'Головна', url: 'https://example.org/' }, { name: 'Служіння', url: 'https://example.org/ministries/' }]), {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Головна', item: 'https://example.org/' },
      { '@type': 'ListItem', position: 2, name: 'Служіння', item: 'https://example.org/ministries/' },
    ],
  });
});

test('jsonLdScript: жодного «<» — текст не вийде з <script>, а JSON повертає його дослівно', () => {
  const name = '</script><b>"&\' < разом';
  const out = jsonLdScript([{ '@type': 'Thing', name }]);
  assert.doesNotMatch(out, /</);
  assert.deepEqual(JSON.parse(out), { '@context': 'https://schema.org', '@graph': [{ '@type': 'Thing', name }] });
});
