import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { startStaticServer } from './static-server.mjs';

const WIDTHS = [1440, 390];

// Сторінки збірки — усі index.html (і 404.html) відносно кореня; адреса як на статичному хостингу.
const walk = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

export function pagesOf(root) {
  return walk(root)
    .map((f) => relative(root, f).split(sep).join('/'))
    .filter((f) => f.endsWith('index.html') || f === '404.html')
    .map((f) => (f === '404.html' ? '/404.html' : `/${f.replace(/index\.html$/, '')}`))
    .sort();
}

// Анімації вимкнено, а .reveal (home.css) — у кінцевому стані: інакше знімок залежить від того, що
// встигло проявитись. Чужі хости блокуються: шрифти й картинки сайту свої, а зовнішнє (YouTube,
// Facebook) мінялося б між прогонами.
async function openPage(browser, origin, path, width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  await page.goto(`${origin}${path}`, { waitUntil: 'load' });
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}'
      + '.reveal{opacity:1!important;transform:none!important}',
  });
  await page.evaluate(async () => {
    for (const el of document.querySelectorAll('.reveal')) el.classList.add('is-in');
    // Прокрутка донизу підвантажує lazy-картинки, щоб fullPage-знімок їх містив.
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
    // Картинка, що так і не завантажилась (прихована lazy), не повинна вішати прогін: чекаємо до 3 с.
    await Promise.race([
      Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  });
  return page;
}

const slug = (path) => (path.replace(/^\/|\/$/g, '').replace(/[^\w.-]+/g, '_') || 'home');

export async function compare(refDir, newDir, outDir) {
  const [a, b] = await Promise.all([startStaticServer(resolve(refDir)), startStaticServer(resolve(newDir))]);
  const browser = await chromium.launch();
  const diffs = [];
  try {
    const refPages = pagesOf(refDir);
    const newPages = pagesOf(newDir);
    for (const p of new Set([...refPages, ...newPages])) {
      if (!refPages.includes(p) || !newPages.includes(p)) {
        diffs.push(`${p}: сторінка є лише в ${refPages.includes(p) ? 'еталоні' : 'новій збірці'}`);
        continue;
      }
      for (const width of WIDTHS) {
        const shots = [];
        for (const origin of [a.origin, b.origin]) {
          const page = await openPage(browser, origin, p, width);
          shots.push(await page.screenshot({ fullPage: true }));
          await page.close();
        }
        if (!shots[0].equals(shots[1])) {
          diffs.push(`${p} @${width}`);
          if (outDir) {
            mkdirSync(outDir, { recursive: true });
            writeFileSync(join(outDir, `${slug(p)}-${width}-ref.png`), shots[0]);
            writeFileSync(join(outDir, `${slug(p)}-${width}-new.png`), shots[1]);
          }
        }
      }
    }
  } finally {
    await browser.close();
    await a.close();
    await b.close();
  }
  return diffs;
}

// Горизонтальна прокрутка на телефоні: документ ширший за вікно.
export async function overflow(dir) {
  const server = await startStaticServer(resolve(dir));
  const browser = await chromium.launch();
  const bad = [];
  try {
    for (const p of pagesOf(dir)) {
      const page = await openPage(browser, server.origin, p, 390);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (wide) bad.push(p);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return bad;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] === '--overflow') {
    const bad = await overflow(args[1]);
    for (const p of bad) console.log(`✗ ${p}`);
    if (!bad.length) console.log('Горизонтальної прокрутки немає.');
    process.exit(bad.length ? 1 : 0);
  }
  const [ref, nu, out = 'screens-diff'] = args;
  const diffs = await compare(ref, nu, out);
  for (const d of diffs) console.log(`✗ ${d}`);
  console.log(diffs.length ? `Відмінностей: ${diffs.length}; пари PNG — у ${out}` : 'Сторінки однакові.');
  process.exit(diffs.length ? 1 : 0);
}
