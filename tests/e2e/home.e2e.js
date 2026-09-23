import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';
import { readCollection, readSingleton } from '../helpers/content.js';

const site = useSite();
// Прирости калькулятора й кількість свідчень редагуються в адмінці —
// очікування беремо з даних, а без потрібних даних тест пропускається.
const [increment] = readSingleton('donate-settings').calcIncrements;
const videoCount = readCollection('testimonies').filter(({ data }) => data.type === 'video').length;
const carouselCount = readSingleton('homepage').testimonies.items.length + videoCount;
const MOBILE = { viewport: { width: 390, height: 844 } };

test('герой зʼявляється після завантаження, шапка темнішає після прокрутки', async () => {
  const page = await site.open('');
  await page.waitForFunction(() => document.body.classList.contains('is-loaded'));
  assert.equal(await page.locator('.site-header.is-scrolled').count(), 0);
  await page.mouse.wheel(0, 400);
  await page.waitForSelector('.site-header.is-scrolled');
  await page.close();
});

test('калькулятор: лише цифри, кнопки додають суму до введеної', { skip: increment === undefined && 'немає кнопок калькулятора' }, async () => {
  const page = await site.open('');
  const amount = page.locator('[data-calc-amount]');
  await amount.fill('');
  await amount.pressSequentially('12');
  await page.locator(`[data-calc-add="${increment}"]`).first().click();
  assert.equal(await amount.inputValue(), String(12 + increment));
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

test('карусель свідчень гортається кнопками', { skip: carouselCount < 2 && 'у каруселі менше двох карток' }, async () => {
  const page = await site.open('');
  const track = page.locator('[data-tst-track]');
  await track.scrollIntoViewIfNeeded();
  // Початок — не 0: у <figure> типова браузерна margin 40px (як і в легасі),
  // а scroll-snap mandatory притягує стрічку до краю першої картки.
  const start = await track.evaluate((el) => el.scrollLeft);
  await page.click('[data-tst-next]');
  await page.waitForFunction((s) => document.querySelector('[data-tst-track]').scrollLeft > s, start);
  await page.click('[data-tst-prev]');
  await page.waitForFunction((s) => document.querySelector('[data-tst-track]').scrollLeft === s, start);
  await page.close();
});

test('відеосвідчення на головній вставляє плеєр по кліку', { skip: videoCount === 0 && 'немає відеосвідчень' }, async () => {
  const page = await site.open('');
  const button = page.locator('[data-tst-track] .tst-video').first();
  await button.scrollIntoViewIfNeeded();
  await button.click();
  assert.match(await page.locator('[data-tst-track] iframe').first().getAttribute('src'), /autoplay=1&rel=0$/);
  await page.close();
});

test('«назад» з підсторінки повертає до її секції на головній', async () => {
  // Рішення 9: замість sessionStorage — якір у посиланні «назад».
  // Facebook блокується, як у порівнянні (рішення 23): його iframe
  // довантажується посеред плавної прокрутки і зсуває #pastors на ~300px —
  // це сторонній вміст, а не те, куди веде посилання.
  // Свідчення теж: посилання з Задачі 8 веде на #testimonies, а перевірка
  // посилань фрагменти ігнорує — наявність якоря доводить лише цей тест.
  for (const section of ['pastors', 'testimonies', 'ministries']) {
    const page = await site.browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route(/facebook\.(net|com)/, (route) => route.abort());
    await page.goto(`${site.server.origin}/${section}/`, { waitUntil: 'load' });
    await page.click('.back-link');
    await page.waitForURL(new RegExp(`/#${section}$`));
    await page.waitForFunction((id) => {
      const top = document.getElementById(id).getBoundingClientRect().top;
      return Math.abs(top) < 5;
    }, section);
    await page.close();
  }
});
