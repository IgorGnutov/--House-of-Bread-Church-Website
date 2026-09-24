import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htaccess, pageEntry, robotsTxt, sitemapEntries, sitemapXml } from '../lib/seo-files.mjs';

const htmlFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return htmlFiles(path);
  return entry.name.endsWith('.html') ? [path] : [];
});

// Рішення 7: файли залежать від SITE_URL/BASE_PATH/SITE_NOINDEX, тому
// пишуться після збірки у фактичну outDir, а не лежать у public/.
export default function seoFiles({ site, base, noindex }) {
  return {
    name: 'hob-seo-files',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const out = fileURLToPath(dir);
        writeFileSync(join(out, 'robots.txt'), robotsTxt({ sitemapUrl: new URL(`${base}sitemap.xml`, site).href, noindex }));
        writeFileSync(join(out, '.htaccess'), htaccess({ base }));
        // У прев'ю кожна сторінка noindex — мапа була б порожньою й лише
        // заохочувала б робота сканувати стенд.
        if (noindex) return;
        const pages = htmlFiles(out).map((file) => pageEntry(readFileSync(file, 'utf8')));
        writeFileSync(join(out, 'sitemap.xml'), sitemapXml(sitemapEntries(pages)));
      },
    },
  };
}
