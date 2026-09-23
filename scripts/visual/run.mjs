// Піксельне порівняння легасі з новою збіркою: головний контроль «дизайн
// переноситься 1:1» (Спека 1, «Перевірка»). Видаляється разом із легасі.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';
import { startStaticServer } from '../lib/static-server.mjs';
import { GLOBAL_MASK, LANGS, VIEWPORTS, routes } from './routes.mjs';

const { PNG } = pngjs;
const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = join(root, '.visual');
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt === -1 ? null : process.argv[onlyAt + 1];
// 0.1% пікселів: вистачає на субпіксельне згладжування, але не на зсув
// рядка тексту чи інший колір кнопки.
const MAX_RATIO = 0.001;

async function load(context, url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  // Сторінки може ще не бути (404 без <main>) — тоді порівняння дасть FAIL
  // за розміром, а не впаде весь прогін на таймауті.
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  // Ліниві картинки нижче першого екрана інакше не завантажуються ніколи:
  // знімок повної сторінки не прокручує її.
  await page.evaluate(() => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
  });
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}

async function capture(page, route, mask) {
  const options = { animations: 'disabled', maskColor: '#ff00ff', mask: mask.map((s) => page.locator(s)) };
  if (!route.sections) return { page: PNG.sync.read(await page.screenshot({ ...options, fullPage: true })) };
  const shots = {};
  for (const [name, selector] of route.sections) {
    const el = page.locator(selector).first();
    shots[name] = (await el.count()) ? PNG.sync.read(await el.screenshot(options)) : null;
  }
  return shots;
}

function compare(id, a, b, dir) {
  if (!a || !b) return { id, ok: false, reason: `секції немає на ${a ? 'новій' : 'легасі'} сторінці` };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'legacy.png'), PNG.sync.write(a));
  writeFileSync(join(dir, 'next.png'), PNG.sync.write(b));
  if (a.width !== b.width || a.height !== b.height) {
    return { id, ok: false, reason: `розмір ${a.width}×${a.height} проти ${b.width}×${b.height}` };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  writeFileSync(join(dir, 'diff.png'), PNG.sync.write(diff));
  const ratio = pixels / (a.width * a.height);
  return { id, ok: ratio <= MAX_RATIO, reason: `${(ratio * 100).toFixed(3)}% пікселів` };
}

rmSync(outDir, { recursive: true, force: true });
const legacy = await startStaticServer(root);
const next = await startStaticServer(join(root, 'dist'));
const browser = await chromium.launch();
const report = [];

for (const route of routes().filter((r) => !only || r.name.startsWith(only))) {
  for (const lang of LANGS) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: vp.size, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      // Легасі вмикає англійську з localStorage; нова збірка його не читає.
      if (lang === 'en') {
        await context.addInitScript(() => {
          try { localStorage.setItem('hob-lang', 'en'); } catch { /* about:blank без сховища */ }
        });
      }
      const mask = [...GLOBAL_MASK, ...(route.mask ?? []), ...(lang === 'en' ? route.maskEn ?? [] : [])];
      const a = await capture(await load(context, `${legacy.origin}/${route.legacy}`), route, mask);
      const b = await capture(await load(context, `${next.origin}/${lang === 'en' ? 'en/' : ''}${route.next}`), route, mask);
      await context.close();

      for (const part of Object.keys(a)) {
        const id = route.sections ? `${route.name}-${part}-${lang}-${vp.name}` : `${route.name}-${lang}-${vp.name}`;
        const result = compare(id, a[part], b[part], join(outDir, id));
        const known = route.known?.[`${part}:${lang}`];
        if (!result.ok && known) Object.assign(result, { ok: true, known });
        report.push(result);
        console.log(`${result.known ? 'KNOWN' : result.ok ? 'OK   ' : 'FAIL '} ${id} — ${result.known ?? result.reason}`);
      }
    }
  }
}

await browser.close();
await legacy.close();
await next.close();
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
const failed = report.filter((r) => !r.ok);
console.log(`\n${report.length - failed.length}/${report.length} OK. Знімки й різниця: .visual/<id>/`);
process.exit(failed.length ? 1 : 0);
