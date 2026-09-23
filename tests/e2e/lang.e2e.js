import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';

const site = useSite();

test('перемикач веде на ту саму деталку іншою мовою', async () => {
  const page = await site.open('ministries/youth/');
  await page.click('.lang-toggle a[hreflang="en"]');
  await page.waitForURL(/\/en\/ministries\/youth\/$/);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('h1').textContent(), 'Youth');
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
