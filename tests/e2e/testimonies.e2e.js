import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';

const site = useSite();

test('клік по відеосвідченню вставляє плеєр з автозапуском замість кнопки', async () => {
  const page = await site.open('testimonies/');
  assert.equal(await page.locator('.tst-grid iframe').count(), 0);
  await page.locator('.tst-video').first().click();
  const frame = page.locator('.tst-grid iframe').first();
  assert.equal(await frame.getAttribute('src'), 'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1&rel=0');
  assert.equal(await frame.getAttribute('title'), 'Відеосвідчення');
  assert.equal(await page.locator('.tst-video').count(), 1, 'друга відеокартка лишилася кнопкою');
  await page.close();
});
