import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';
import { readCollection, sortedData } from '../helpers/content.js';
import { t } from '../helpers/i18n.js';
import { ytEmbed, ytId } from '../../src/lib/youtube.mjs';

const site = useSite();
// Скільки відеосвідчень і які — вирішує адмінка; очікування — з даних.
const videos = sortedData(readCollection('testimonies')).filter((x) => x.type === 'video');

test('клік по відеосвідченню вставляє плеєр з автозапуском замість кнопки', { skip: videos.length === 0 && 'немає відеосвідчень' }, async () => {
  const page = await site.open('testimonies/');
  assert.equal(await page.locator('.tst-grid iframe').count(), 0);
  await page.locator('.tst-video').first().click();
  const frame = page.locator('.tst-grid iframe').first();
  assert.equal(await frame.getAttribute('src'), ytEmbed(ytId(videos[0].videoUrl), { autoplay: true }));
  assert.equal(await frame.getAttribute('title'), t('uk', 'testimony.videoLabel'));
  assert.equal(await page.locator('.tst-video').count(), videos.length - 1, 'решта відеокарток лишилися кнопками');
  await page.close();
});
