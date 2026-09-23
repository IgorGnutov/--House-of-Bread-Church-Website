import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';
import { readCollection, sortedData } from '../helpers/content.js';
import { t } from '../helpers/i18n.js';
import { ytEmbed, ytId } from '../../src/lib/youtube.mjs';

const site = useSite();
const activeIndex = (page) =>
  page.locator('[data-slide].is-active').evaluate((el) => [...el.parentElement.children].indexOf(el));

// Запис для перевірки обирається з даних: перше служіння (за order), у якого
// є куди гортати і є відео. Конкретний slug не пришпилюється — адмінка
// може видалити будь-яке служіння. Якщо такого немає, перевіряти нема що.
const ministries = sortedData(readCollection('ministries'));
const withVideo = ministries.find((m) => m.media.length > 1 && m.media.some((x) => x.type === 'video'));
const navigable = ministries.find((m) => m.media.length > 1);

test('галерея: стрілки, крапки, мініатюри й клавіатура перемикають слайд', { skip: !navigable && 'немає служіння з кількома медіа' }, async () => {
  const page = await site.open(`ministries/${navigable.slug}/`);
  const last = navigable.media.length - 1;
  assert.equal(await activeIndex(page), 0);
  await page.click('[data-next]');
  assert.equal(await activeIndex(page), 1);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(page), 0);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(page), last, 'з першого слайда «назад» веде на останній');
  await page.locator('[data-dot]').nth(1).click();
  assert.equal(await activeIndex(page), 1);
  assert.equal(await page.locator('[data-dot].is-active').count(), 1);
  assert.equal(await page.locator('[data-thumb].is-active').count(), 1);
  await page.close();
});

test('відео вставляється лише коли його слайд стає активним', { skip: !withVideo && 'немає служіння з відео в галереї' }, async () => {
  const page = await site.open(`ministries/${withVideo.slug}/`);
  const index = withVideo.media.findIndex((x) => x.type === 'video');
  assert.equal(await page.locator('.slide iframe').count(), 0);
  await page.locator('[data-thumb]').nth(index).click();
  const frame = page.locator('.slide.is-active iframe');
  assert.equal(await frame.getAttribute('src'), ytEmbed(ytId(withVideo.media[index].src)));
  assert.equal(await frame.getAttribute('title'), `${withVideo.name.uk} — ${t('uk', 'a11y.video')}`);
  await page.close();
});
