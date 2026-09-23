import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from 'node-html-parser';

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

// Кожне внутрішнє посилання й ресурс мусять вести на файл, що є у збірці,
// і лежати під base. Шлях без base локально працює, а на GitHub Pages — 404.
export function findBrokenLinks(dir, base) {
  const problems = [];
  for (const file of htmlFiles(dir)) {
    const from = pageUrl(dir, file, base);
    for (const ref of internalRefs(parse(readFileSync(file, 'utf8')))) {
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
