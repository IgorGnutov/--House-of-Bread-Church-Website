import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';
import { readCollection, sortedData } from '../helpers/content.js';

const site = useSite();

// Будь-яке служіння з даних — конкретний slug адмінка може видалити.
const ministry = sortedData(readCollection('ministries'))[0];

test('перемикач веде на ту саму деталку іншою мовою', { skip: !ministry && 'немає жодного служіння' }, async () => {
  const page = await site.open(`ministries/${ministry.slug}/`);
  await page.click('.lang-toggle a[hreflang="en"]');
  await page.waitForURL(new RegExp(`/en/ministries/${ministry.slug}/$`));
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('h1').textContent(), ministry.name.en);
  await page.close();
});

test('збережена в localStorage мова нікуди не перенаправляє', async () => {
  // Спека 2: автоперехід — блокер індексації en. Імітуємо відвідувача, у
  // якого від легасі лишилося hob-lang=uk.
  const context = await site.browser.newContext();
  await context.addInitScript(() => localStorage.setItem('hob-lang', 'uk'));
  const page = await context.newPage();
  await page.goto(`${site.server.origin}/en/ministries/`);
  await page.waitForTimeout(500);
  assert.match(page.url(), /\/en\/ministries\/$/);
  await context.close();
});
