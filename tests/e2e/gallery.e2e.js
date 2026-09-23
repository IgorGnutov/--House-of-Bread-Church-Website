import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';

const site = useSite();
const activeIndex = (page) =>
  page.locator('[data-slide].is-active').evaluate((el) => [...el.parentElement.children].indexOf(el));

test('галерея: стрілки, крапки, мініатюри й клавіатура перемикають слайд', async () => {
  const page = await site.open('ministries/youth/');
  assert.equal(await activeIndex(page), 0);
  await page.click('[data-next]');
  assert.equal(await activeIndex(page), 1);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(page), 0);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(page), 3, 'з першого слайда «назад» веде на останній');
  await page.locator('[data-dot]').nth(1).click();
  assert.equal(await activeIndex(page), 1);
  assert.equal(await page.locator('[data-dot].is-active').count(), 1);
  assert.equal(await page.locator('[data-thumb].is-active').count(), 1);
  await page.close();
});

test('відео вставляється лише коли його слайд стає активним', async () => {
  const page = await site.open('ministries/youth/');
  assert.equal(await page.locator('.slide iframe').count(), 0);
  await page.locator('[data-thumb]').nth(2).click();
  const frame = page.locator('.slide.is-active iframe');
  assert.equal(await frame.getAttribute('src'), 'https://www.youtube.com/embed/ScMzIvxBSi4?rel=0');
  assert.equal(await frame.getAttribute('title'), 'Молодь — відео');
  await page.close();
});
