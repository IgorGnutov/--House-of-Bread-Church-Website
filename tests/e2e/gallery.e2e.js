import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';
import { readCollection, sortedData } from '../helpers/content.js';
import { t } from '../helpers/i18n.js';
import { ytEmbed, ytId } from '../../src/lib/youtube.mjs';

const site = useSite();
// Індекс активного слайда n-ї галереї сторінки (за замовчуванням — галереї служіння).
const activeIndex = (page, n = 0) =>
  page.locator('[data-gallery]').nth(n).locator('[data-slide].is-active').evaluate((el) => [...el.parentElement.children].indexOf(el));

// Запис для перевірки обирається з даних: перше служіння (за order), у якого
// є куди гортати і є відео. Конкретний slug не пришпилюється — адмінка
// може видалити будь-яке служіння. Якщо такого немає, перевіряти нема що.
// Пробне служіння з гілками (scripts/e2e-build.mjs) живе лише в збірці e2e.
const ministries = sortedData(readCollection('ministries'));
const withVideo = ministries.find((m) => m.media.length > 1 && m.media.some((x) => x.type === 'video'));
const navigable = ministries.find((m) => m.media.length > 1);

test('галерея: стрілки, крапки, мініатюри й клавіатура перемикають слайд', { skip: !navigable && 'немає служіння з кількома медіа' }, async () => {
  const page = await site.open(`ministries/${navigable.slug}/`);
  const last = navigable.media.length - 1;
  assert.equal(await activeIndex(page), 0);
  await page.locator('[data-gallery]').first().locator('[data-next]').click();
  assert.equal(await activeIndex(page), 1);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(page), 0);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(page), last, 'з першого слайда «назад» веде на останній');
  const gallery = page.locator('[data-gallery]').first();
  await gallery.locator('[data-dot]').nth(1).click();
  assert.equal(await activeIndex(page), 1);
  assert.equal(await gallery.locator('[data-dot].is-active').count(), 1);
  assert.equal(await gallery.locator('[data-thumb].is-active').count(), 1);
  await page.close();
});

test('відео вставляється лише коли його слайд стає активним', { skip: !withVideo && 'немає служіння з відео в галереї' }, async () => {
  const page = await site.open(`ministries/${withVideo.slug}/`);
  const index = withVideo.media.findIndex((x) => x.type === 'video');
  const gallery = page.locator('[data-gallery]').first();
  assert.equal(await page.locator('.slide iframe').count(), 0);
  await gallery.locator('[data-thumb]').nth(index).click();
  const frame = gallery.locator('.slide.is-active iframe');
  assert.equal(await frame.getAttribute('src'), ytEmbed(ytId(withVideo.media[index].src)));
  assert.equal(await frame.getAttribute('title'), `${withVideo.name.uk} — ${t('uk', 'a11y.video')}`);
  await page.close();
});

test('кілька слайдерів: стрілки гортають лише той, з яким взаємодіяли', async () => {
  const page = await site.open('ministries/e2e-branches/');
  const all = async () => Promise.all([0, 1, 2].map((n) => activeIndex(page, n)));
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await all(), [0, 1, 0], 'без взаємодії — перший слайдер, де є куди гортати');
  await page.locator('[data-gallery]').nth(2).locator('[data-slide].is-active').click();
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await all(), [0, 1, 1], 'після кліку по фото — лише той слайдер');
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await all(), [0, 1, 0]);
  await page.close();
});
