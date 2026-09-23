import { before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startStaticServer } from '../../scripts/lib/static-server.mjs';

// Одна збірка (npm run e2e робить astro build з base «/»), один браузер
// на файл тестів; кожен тест відкриває свою сторінку.
export function useSite() {
  const site = {};
  before(async () => {
    site.server = await startStaticServer(fileURLToPath(new URL('../../dist', import.meta.url)));
    site.browser = await chromium.launch();
  });
  after(async () => {
    await site.browser?.close();
    await site.server?.close();
  });
  site.open = async (path, { viewport = { width: 1440, height: 900 } } = {}) => {
    const page = await site.browser.newPage({ viewport });
    await page.goto(`${site.server.origin}/${path}`, { waitUntil: 'load' });
    return page;
  };
  return site;
}
