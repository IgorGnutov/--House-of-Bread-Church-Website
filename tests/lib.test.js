import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localePath, assetUrl, linkHref, otherLang, localeParams } from '../src/lib/paths.mjs';
import { pick, createT } from '../src/lib/i18n.mjs';
import { ytId, ytEmbed, ytThumb } from '../src/lib/youtube.mjs';
import { sortedData, nextCyclic, othersFirst, coverImage } from '../src/lib/collections.mjs';
import { formatDate, initial, telHref, paragraphs } from '../src/lib/format.mjs';
import {
  MINISTRY_ICON_NAMES, MINISTRY_ICON_PATHS, RESOURCE_ICON_NAMES, RESOURCE_ICON_PATHS,
} from '../src/lib/icons.mjs';
import * as svg from '../src/lib/svg.mjs';
import { isPageEnabled } from '../src/lib/pages.mjs';

test('localePath: uk у корені, en під /en/, base зберігається', () => {
  assert.equal(localePath('/', 'uk', '/'), '/');
  assert.equal(localePath('/', 'en', '/'), '/en/');
  assert.equal(localePath('/', 'uk', '/ministries/youth/'), '/ministries/youth/');
  assert.equal(localePath('/sub/', 'en', '/ministries/youth/'), '/sub/en/ministries/youth/');
  // Якір секції головної мусить лишатися в тій самій мові.
  assert.equal(localePath('/sub/', 'en', '/#contacts'), '/sub/en/#contacts');
});

test('localePath відкидає відносний шлях і невідому локаль', () => {
  // Відносний шлях — це легасі-звичка (відносне посилання з «?id=…»); під
  // підшляхом він дає інший URL на кожній глибині вкладеності.
  assert.throws(() => localePath('/', 'uk', 'ministries/'), /«\/»/);
  assert.throws(() => localePath('/', 'de', '/'), /локаль/);
});

test('assetUrl: зовнішні адреси як є, локальні — під base', () => {
  assert.equal(assetUrl('/sub/', 'uploads/logo.png'), '/sub/uploads/logo.png');
  assert.equal(assetUrl('/sub/', '/uploads/logo.png'), '/sub/uploads/logo.png');
  assert.equal(assetUrl('/sub/', 'https://picsum.photos/x'), 'https://picsum.photos/x');
});

test('linkHref: зовнішнє як є, внутрішнє — з локаллю, інше — помилка', () => {
  assert.equal(linkHref('/', 'uk', 'https://www.liqpay.ua/x'), 'https://www.liqpay.ua/x');
  assert.equal(linkHref('/', 'en', '/#contacts'), '/en/#contacts');
  assert.throws(() => linkHref('/', 'uk', 'index.html#contacts'), /index\.html#contacts/);
});

test('otherLang і localeParams дають рівно дві локалі з uk у корені', () => {
  assert.equal(otherLang('uk'), 'en');
  assert.equal(otherLang('en'), 'uk');
  assert.deepEqual(localeParams(), [
    { params: { lang: undefined }, props: { lang: 'uk' } },
    { params: { lang: 'en' }, props: { lang: 'en' } },
  ]);
});

test('pick повертає переклад і падає на відсутньому', () => {
  assert.equal(pick({ uk: 'Молодь', en: 'Youth' }, 'en'), 'Youth');
  // Фолбек на українську тихо показав би її на англійській сторінці —
  // гірше за впалу збірку (та сама логіка, що в схемі Етапу 1).
  assert.throws(() => pick({ uk: 'Молодь', en: '' }, 'en'), /en/);
  assert.throws(() => pick(undefined, 'uk'), /uk/);
});

test('t шукає ключ за крапкою і падає на відсутньому', () => {
  const t = createT({ uk: { a: { b: 'в' } }, en: { a: { b: 'c' } } });
  assert.equal(t('en', 'a.b'), 'c');
  assert.throws(() => t('uk', 'a.x'), /a\.x/);
  assert.throws(() => t('uk', 'a'), /a/, 'гілка словника — не рядок');
});

test('ytId розпізнає всі форми посилань і голий ID', () => {
  for (const src of [
    'https://www.youtube.com/watch?v=ScMzIvxBSi4',
    'https://youtu.be/ScMzIvxBSi4',
    'https://www.youtube.com/embed/ScMzIvxBSi4',
    'https://www.youtube.com/shorts/ScMzIvxBSi4',
    'ScMzIvxBSi4',
  ]) {
    assert.equal(ytId(src), 'ScMzIvxBSi4', src);
  }
  assert.equal(ytId('https://vimeo.com/123'), null);
  assert.equal(ytId(''), null);
  assert.equal(ytId(null), null);
});

test('ytEmbed і ytThumb дають ті самі адреси, що й легасі', () => {
  assert.equal(ytEmbed('ScMzIvxBSi4'), 'https://www.youtube.com/embed/ScMzIvxBSi4?rel=0');
  assert.equal(
    ytEmbed('ScMzIvxBSi4', { autoplay: true }),
    'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1&rel=0',
  );
  assert.equal(ytThumb('ScMzIvxBSi4'), 'https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg');
});

test('sortedData сортує за order, а не за порядком файлів', () => {
  const entries = [{ data: { slug: 'b', order: 1 } }, { data: { slug: 'a', order: 0 } }];
  assert.deepEqual(sortedData(entries).map((x) => x.slug), ['a', 'b']);
});

test('nextCyclic бере наступні по колу і ніколи не повертає сам запис', () => {
  const list = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(nextCyclic(list, 3, 4), ['e', 'a', 'b', 'c']);
  // Легасі на коротшому списку показав би сам запис серед «інших».
  assert.deepEqual(nextCyclic(['a', 'b', 'c'], 0, 4), ['b', 'c']);
});

test('othersFirst бере перші N без поточного', () => {
  const list = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }, { slug: 'd' }];
  assert.deepEqual(othersFirst(list, 'b', 3).map((x) => x.slug), ['a', 'c', 'd']);
});

test('coverImage: перше фото, а для галереї з одних відео — мініатюра YouTube', () => {
  assert.deepEqual(
    coverImage([
      { type: 'video', src: 'https://youtu.be/ScMzIvxBSi4', alt: 'Відео' },
      { type: 'image', src: 'https://x/1.jpg', alt: 'Фото' },
    ]),
    { src: 'https://x/1.jpg', alt: 'Фото' },
  );
  // Легасі клав у <img> саме посилання YouTube — битий значок замість картки.
  assert.deepEqual(
    coverImage([{ type: 'video', src: 'ScMzIvxBSi4', alt: 'Відео' }]),
    { src: 'https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg', alt: 'Відео' },
  );
});

test('formatDate дає ту саму дату, що й легасі в браузері, незалежно від поясу збірки', () => {
  assert.equal(formatDate('2026-01-10', 'uk'), '10 січня 2026 р.');
  assert.equal(formatDate('2026-01-10', 'en'), 'January 10, 2026');
});

test('initial, telHref і paragraphs', () => {
  assert.equal(initial(' олена'), 'О');
  assert.equal(initial(''), '?');
  assert.equal(telHref('+380 99 133-99-69'), 'tel:+380991339969');
  assert.deepEqual(paragraphs('Перший.\n\nДругий\nрядок.\n\n\n'), ['Перший.', 'Другий\nрядок.']);
});

test('іконки служінь — рівно 18 легасі-значень, кожна з непорожнім SVG', () => {
  assert.deepEqual(MINISTRY_ICON_NAMES, [
    'book', 'home', 'media', 'worship', 'child', 'youth', 'teen', 'order', 'care',
    'chapel', 'prophetic', 'hospital', 'biz', 'pray', 'mercy', 'prison', 'family', 'globe',
  ]);
  for (const name of MINISTRY_ICON_NAMES) assert.match(MINISTRY_ICON_PATHS[name], /^<(path|circle|rect)/);
});

test('іконки ресурсів — шість значень із розмітки легасі-сторінки лідерів', () => {
  assert.deepEqual(RESOURCE_ICON_NAMES, ['book', 'music', 'video', 'calendar', 'shield', 'users']);
  for (const name of RESOURCE_ICON_NAMES) assert.match(RESOURCE_ICON_PATHS[name], /^<(path|circle|rect)/);
});

test('кожен спільний SVG — один цілий елемент <svg>', () => {
  for (const [name, markup] of Object.entries(svg)) {
    assert.match(markup, /^<svg [^>]*>.*<\/svg>$/s, name);
  }
});

test('isPageEnabled: сторінка вмикається лише з текстом', () => {
  assert.equal(isPageEnabled({ title: { uk: 'а', en: 'b' }, body: null }), false);
  assert.equal(isPageEnabled({ title: { uk: 'а', en: 'b' } }), false);
  assert.equal(isPageEnabled({ title: { uk: 'а', en: 'b' }, body: { uk: 'т', en: 't' } }), true);
});
