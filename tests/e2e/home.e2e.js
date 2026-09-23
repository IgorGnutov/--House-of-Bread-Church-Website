import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';

const site = useSite();
const MOBILE = { viewport: { width: 390, height: 844 } };

test('герой зʼявляється після завантаження, шапка темнішає після прокрутки', async () => {
  const page = await site.open('');
  await page.waitForFunction(() => document.body.classList.contains('is-loaded'));
  assert.equal(await page.locator('.site-header.is-scrolled').count(), 0);
  await page.mouse.wheel(0, 400);
  await page.waitForSelector('.site-header.is-scrolled');
  await page.close();
});

test('калькулятор: лише цифри, кнопки додають суму до введеної', async () => {
  const page = await site.open('');
  const amount = page.locator('[data-calc-amount]');
  await amount.fill('');
  await amount.pressSequentially('12');
  await page.locator('[data-calc-add="200"]').click();
  assert.equal(await amount.inputValue(), '212');
  await page.close();
});

test('шторка відкривається, закривається хрестиком, фоном і Escape', async () => {
  const page = await site.open('', MOBILE);
  const drawer = page.locator('[data-drawer]');
  for (const close of [
    () => page.click('[data-drawer-close]'),
    () => page.click('[data-drawer-scrim]', { position: { x: 20, y: 400 } }),
    () => page.keyboard.press('Escape'),
  ]) {
    await page.click('[data-drawer-open]');
    assert.equal(await drawer.getAttribute('aria-hidden'), 'false');
    assert.equal(await page.locator('[data-drawer-open]').getAttribute('aria-expanded'), 'true');
    await close();
    assert.equal(await drawer.getAttribute('aria-hidden'), 'true');
  }
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.close();
});

test('активний пункт меню стежить за секцією, блоки зʼявляються при прокрутці', async () => {
  const page = await site.open('');
  await page.locator('#union').scrollIntoViewIfNeeded();
  await page.waitForSelector('#union .reveal.is-in');
  await page.waitForSelector('.nav-link.is-active[data-nav="union"]');
  await page.close();
});
