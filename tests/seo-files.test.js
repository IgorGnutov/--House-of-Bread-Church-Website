import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from 'node-html-parser';
import { BASE_PATH, NOINDEX, SITE_URL } from '../astro.config.mjs';
import { distDir, distPath } from './helpers/dist.js';
import { htmlFiles, pageUrl } from './helpers/links.js';
import { withBuild } from './helpers/build.js';
import { ministry } from './helpers/probes.js';
import { head, parseSitemap } from './helpers/seo.js';
import {
  LEGACY_DETAILS, LEGACY_LISTS, htaccess, pageEntry, robotsTxt, sitemapEntries, sitemapXml,
} from '../src/lib/seo-files.mjs';

const T = { timeout: 180_000 };
const pair = (uk, en = uk) => ({ uk, en });
const abs = (rel) => new URL(`${BASE_PATH}${rel}`, SITE_URL).href;
const escapeRe = (file) => file.replace(/\./g, '\\.');

test('robotsTxt: продакшн — дозволено все й посилання на мапу, прев\'ю — закрито все', () => {
  assert.equal(robotsTxt({ sitemapUrl: 'https://example.org/sitemap.xml', noindex: false }),
    'User-agent: *\nAllow: /\n\nSitemap: https://example.org/sitemap.xml\n');
  assert.equal(robotsTxt({ sitemapUrl: 'https://example.org/sitemap.xml', noindex: true }), 'User-agent: *\nDisallow: /\n');
});

test('pageEntry: canonical, hreflang і robots зі сторінки; без canonical — null', () => {
  const html = `<html><head>
    <meta name="robots" content="noindex">
    <link rel="canonical" href="https://example.org/a/">
    <link rel="alternate" hreflang="uk" href="https://example.org/a/">
    <link rel="alternate" hreflang="en" href="https://example.org/en/a/">
    </head><body><a hreflang="en" href="/en/a/">EN</a></body></html>`;
  assert.deepEqual(pageEntry(html), {
    loc: 'https://example.org/a/',
    noindex: true,
    alternates: [{ hreflang: 'uk', href: 'https://example.org/a/' }, { hreflang: 'en', href: 'https://example.org/en/a/' }],
  });
  assert.equal(pageEntry('<html><head></head></html>'), null);
});

test('sitemapEntries: без noindex, альтернативи лише на сторінки з мапи, порядок стабільний', () => {
  const alt = (uk, en) => [{ hreflang: 'uk', href: uk }, { hreflang: 'en', href: en }, { hreflang: 'x-default', href: uk }];
  const entries = sitemapEntries([
    { loc: 'https://e.org/en/b/', noindex: false, alternates: alt('https://e.org/b/', 'https://e.org/en/b/') },
    { loc: 'https://e.org/b/', noindex: true, alternates: alt('https://e.org/b/', 'https://e.org/en/b/') },
    { loc: 'https://e.org/a/', noindex: false, alternates: alt('https://e.org/a/', 'https://e.org/en/a/') },
    null,
  ]);
  assert.deepEqual(entries, [
    { loc: 'https://e.org/a/', alternates: [{ hreflang: 'uk', href: 'https://e.org/a/' }, { hreflang: 'x-default', href: 'https://e.org/a/' }] },
    { loc: 'https://e.org/en/b/', alternates: [{ hreflang: 'en', href: 'https://e.org/en/b/' }] },
  ]);
});

test('sitemapXml: urlset з xhtml:link і екранування', () => {
  const xml = sitemapXml([{ loc: 'https://e.org/a/?x=1&y=2', alternates: [{ hreflang: 'uk', href: 'https://e.org/a/' }] }]);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'));
  assert.ok(xml.includes('<loc>https://e.org/a/?x=1&amp;y=2</loc>'));
  assert.ok(xml.includes('<xhtml:link rel="alternate" hreflang="uk" href="https://e.org/a/"/>'));
  assert.ok(xml.trimEnd().endsWith('</urlset>'));
});

test('htaccess: base, канонічний хост, https і 301 зі всіх легасі-адрес — без домену у файлі', () => {
  const text = htaccess({ base: '/sub/' });
  assert.match(text, /^RewriteBase \/sub\/$/m);
  assert.match(text, /^RewriteCond %\{HTTP_HOST\} \^www\\\.\(\.\+\)\$ \[NC\]$/m);
  assert.match(text, /^RewriteCond %\{HTTPS\} !=on$/m);
  assert.match(text, /^RewriteCond %\{HTTP:X-Forwarded-Proto\} !=https$/m, 'TLS-проксі: без цієї умови сайт за проксі редіректив би сам на себе');
  // Захоплення до першого «?» (не зачепити query string) і NE (не подвоювати кодування THE_REQUEST).
  assert.match(text, /^RewriteCond %\{THE_REQUEST\} \^\[A-Z\]\+\\s\(\[\^\\s\?\]\*\/\)index\\\.html\[\\s\?\]$/m);
  assert.match(text, /^RewriteRule \^ %1 \[R=301,L,NE\]$/m);
  assert.match(text, /^RewriteRule \^\(\.\*\[\^\/\]\)\$ \/sub\/\$1\/ \[R=301,L\]$/m, 'кінцевий слеш для тек');
  for (const [from, to] of LEGACY_DETAILS) {
    assert.ok(text.includes(`RewriteRule ^${escapeRe(from)}$ /sub/${to}%2/? [R=301,L]`), `${from}?id=…`);
    assert.ok(text.includes(`RewriteRule ^${escapeRe(from)}$ /sub/${to}? [R=301,L]`), `${from} без id`);
  }
  for (const [from, to] of LEGACY_LISTS) {
    assert.ok(text.includes(`RewriteRule ^${escapeRe(from)}$ /sub/${to}? [R=301,L]`), from);
  }
  assert.doesNotMatch(text, /invalid|github\.io|houseofbread/, 'домен у .htaccess');
});

test('легасі-редиректи покривають усі 10 старих сторінок і ведуть на зібрані', () => {
  // Набір легасі-файлів — історія (видалені в кутовері Етапу 2), він не зміниться.
  const legacy = ['index.html', ...LEGACY_LISTS.map(([from]) => from), ...LEGACY_DETAILS.map(([from]) => from)].sort();
  assert.deepEqual(legacy, [
    'church.dc.html', 'churches.dc.html', 'index.html', 'leaders.dc.html', 'ministries.dc.html',
    'ministry.dc.html', 'pastors.dc.html', 'project.dc.html', 'projects.dc.html', 'testimonies.dc.html',
  ]);
  for (const [, to] of [...LEGACY_LISTS, ...LEGACY_DETAILS]) {
    assert.ok(existsSync(distPath(`${to}index.html`)), `редирект на ${to}, а такої сторінки немає`);
  }
});

test('dist: .htaccess із base збірки; усі CSS/JS — у _astro/, тож «immutable» безпечний', () => {
  const text = readFileSync(distPath('.htaccess'), 'utf8');
  assert.ok(text.includes(`RewriteBase ${BASE_PATH}`));
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  for (const file of walk(distDir).filter((f) => /\.(css|js)$/.test(f))) {
    const rel = relative(distDir, file).split(sep).join('/');
    assert.match(rel, /^_astro\//, `${rel}: CSS/JS поза _astro/ отримав би рік кешу без хешу в імені`);
  }
});

test('канонічний хост SITE_URL — без www (Спека 2)', () => {
  assert.doesNotMatch(new URL(SITE_URL).hostname, /^www\./);
});

test('dist: robots.txt і sitemap.xml відповідають режиму збірки', () => {
  const robots = readFileSync(distPath('robots.txt'), 'utf8');
  if (NOINDEX) {
    assert.equal(robots, robotsTxt({ sitemapUrl: abs('sitemap.xml'), noindex: true }));
    assert.equal(existsSync(distPath('sitemap.xml')), false, 'прев\'ю не публікує мапу');
    return;
  }
  assert.equal(robots, robotsTxt({ sitemapUrl: abs('sitemap.xml'), noindex: false }));
  const urls = parseSitemap(readFileSync(distPath('sitemap.xml'), 'utf8'));
  const pages = htmlFiles(distDir).map((file) => head(parse(readFileSync(file, 'utf8'))));
  const indexable = pages.filter((h) => h.robots !== 'noindex');
  assert.deepEqual(urls.map((u) => u.loc).sort(), indexable.map((h) => h.canonical).sort(), 'мапа ≠ сторінки без noindex');
  for (const u of urls) {
    const page = indexable.find((h) => h.canonical === u.loc);
    assert.deepEqual(u.alternates, page.alternates, `${u.loc}: hreflang у мапі ≠ hreflang на сторінці`);
  }
});

test('проба продакшну: noindex-запис поза мапою, увімкнена сторінка в ній, порожня колекція — лише список', T, () => {
  withBuild((content) => {
    content.write('ministries', 'map-hidden', ministry('map-hidden', {
      seo: { metaTitle: null, metaDescription: null, ogImage: null, noindex: true },
    }));
    content.clear('projects');
    content.editSingleton('pages', (pages) => { pages.about.body = pair('Текст про церкву.', 'About the church.'); });
  }, (result) => {
    assert.equal(result.failed, false, result.output.slice(-3000));
    const urls = parseSitemap(readFileSync(join(result.outDir, 'sitemap.xml'), 'utf8'));
    const locs = new Set(urls.map((u) => u.loc));
    for (const prefix of ['', 'en/']) {
      assert.equal(locs.has(abs(`${prefix}ministries/map-hidden/`)), false, `${prefix}: noindex-запис у мапі`);
      assert.ok(locs.has(abs(`${prefix}about/`)), `${prefix}: увімкненої сторінки немає в мапі`);
      assert.ok(locs.has(abs(`${prefix}projects/`)), `${prefix}: список проєктів зник з мапи`);
      assert.equal([...locs].some((l) => l.startsWith(abs(`${prefix}projects/`)) && l !== abs(`${prefix}projects/`)), false,
        `${prefix}: деталка проєкту без записів`);
    }
    for (const u of urls) {
      assert.deepEqual(Object.keys(u.alternates).sort(), ['en', 'uk', 'x-default'], `${u.loc}: набір hreflang`);
      for (const href of Object.values(u.alternates)) assert.ok(locs.has(href), `${u.loc}: hreflang ${href} поза мапою`);
    }
    assert.ok(readFileSync(join(result.outDir, 'robots.txt'), 'utf8').includes(`Sitemap: ${abs('sitemap.xml')}`));
    // CI збирає лише прев'ю (SITE_NOINDEX=true), тож «мапа = сторінки без noindex»
    // вище перевіряється лише локально. Ця проба продакшн-режиму завжди в CI —
    // тож саме тут звіряємо hreflang мапи зі сторінкою, яку вона описує.
    const byCanonical = new Map(htmlFiles(result.outDir).map((file) => {
      const url = new URL(pageUrl(result.outDir, file, BASE_PATH), SITE_URL).href;
      return [url, head(parse(readFileSync(file, 'utf8')))];
    }));
    for (const u of urls) {
      const page = byCanonical.get(u.loc);
      assert.ok(page, `${u.loc}: сторінки з таким canonical немає в збірці`);
      assert.deepEqual(u.alternates, page.alternates, `${u.loc}: hreflang у мапі ≠ hreflang на сторінці`);
    }
  }, { env: { SITE_NOINDEX: 'false' } });
});
