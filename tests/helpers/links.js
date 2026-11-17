import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from 'node-html-parser';
import { ownMarkup } from './dist.js';
import { SITE_URL } from '../../astro.config.mjs';

export function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(abs);
    return entry.name.endsWith('.html') ? [abs] : [];
  });
}

// dist/en/ministries/youth/index.html → <base>en/ministries/youth/
export const pageUrl = (dir, file, base) =>
  base + relative(dir, file).split(sep).join('/').replace(/index\.html$/, '');

const EXTERNAL = /^(?:[a-z][a-z+.-]*:|\/\/)/i; // https:, mailto:, tel:, //cdn

export function internalRefs(root) {
  return [
    ...root.querySelectorAll('a[href], link[href]').map((el) => el.getAttribute('href')),
    ...root.querySelectorAll('img[src], script[src], iframe[src]').map((el) => el.getAttribute('src')),
    ...root.querySelectorAll('source[srcset]').map((el) => el.getAttribute('srcset')),
  ].filter((ref) => ref && !ref.startsWith('#') && !EXTERNAL.test(ref));
}

// canonical, hreflang, og:url і og:image — абсолютні (так вимагають
// пошуковики й Facebook) і як «зовнішні» оминули б перевірку. Адреси під
// коренем сайту перевіряємо як внутрішні: og:image на файл, якого немає,
// з адмінки мусить валити тести (CLAUDE.md, виняток контракту).
// Абсолютні адреси на чужому хості тут свідомо пропускаються (siteRoot-фільтр
// нижче) — що canonical/hreflang/og:url ведуть саме на свій хост, перевіряє
// tests/seo.test.js, а не цей хелпер.
function absoluteRefs(root, siteRoot) {
  return [
    ...root.querySelectorAll('link[rel="canonical"], link[rel="alternate"]').map((el) => el.getAttribute('href')),
    ...root.querySelectorAll('meta[property="og:image"], meta[property="og:url"]').map((el) => el.getAttribute('content')),
  ].filter((ref) => ref?.startsWith(siteRoot)).map((ref) => new URL(ref).pathname);
}

// Кожне внутрішнє посилання й ресурс мусять вести на файл, що є у збірці,
// і лежати під base. Шлях без base локально працює, а на GitHub Pages — 404.
export function findBrokenLinks(dir, base, site = SITE_URL) {
  const siteRoot = new URL(base, site).href;
  const problems = [];
  for (const file of htmlFiles(dir)) {
    const from = pageUrl(dir, file, base);
    const root = parse(readFileSync(file, 'utf8'));
    // Якір #x без елемента з таким id мовчки нікуди не веде.
    const ids = new Set(root.querySelectorAll('[id]').map((el) => el.getAttribute('id')));
    for (const a of root.querySelectorAll('a[href^="#"]')) {
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      if (id !== '' && !ids.has(id)) problems.push(`${from}: #${id} → на сторінці немає id="${id}"`);
    }
    for (const ref of [...internalRefs(root), ...absoluteRefs(root, siteRoot)]) {
      const { pathname } = new URL(ref, `http://site.test${from}`);
      if (!pathname.startsWith(base)) {
        problems.push(`${from}: ${ref} — поза base ${base}`);
        continue;
      }
      const rel = decodeURIComponent(pathname.slice(base.length));
      const target = join(dir, rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel);
      if (!existsSync(target)) problems.push(`${from}: ${ref} → немає ${relative(dir, target)}`);
    }
  }
  return problems;
}

// Дубльований id ламає якорі й aria-звʼязки. Стрічку Facebook не перевіряємо — це чужа розмітка.
export function findDuplicateIds(dir, base = '/') {
  const problems = [];
  for (const file of htmlFiles(dir)) {
    const counts = new Map();
    for (const el of ownMarkup(readFileSync(file, 'utf8')).querySelectorAll('[id]')) {
      const id = el.getAttribute('id');
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const [id, n] of counts) if (n > 1) problems.push(`${pageUrl(dir, file, base)}: id="${id}" — ${n} разів`);
  }
  return problems;
}
