import { parse } from 'node-html-parser';

// Рішення 5: прев'ю закрите повністю, продакшн — відкритий і вказує на мапу.
export const robotsTxt = ({ sitemapUrl, noindex }) =>
  (noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`);

// Рішення 6: мапа будується з готових сторінок — їхні canonical, hreflang і
// robots уже пораховані Seo.astro, тож мапа не може з ними розійтися.
export function pageEntry(html) {
  const root = parse(html);
  const loc = root.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (!loc) return null;
  return {
    loc,
    noindex: /noindex/i.test(root.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''),
    alternates: root.querySelectorAll('link[rel="alternate"][hreflang]')
      .map((link) => ({ hreflang: link.getAttribute('hreflang'), href: link.getAttribute('href') })),
  };
}

// Альтернатива на сторінку поза мапою (закриту noindex) — суперечливий
// сигнал пошуковику; такі посилання з мапи прибираємо.
export function sitemapEntries(pages) {
  const indexable = pages.filter((page) => page && !page.noindex);
  const locs = new Set(indexable.map((page) => page.loc));
  return indexable
    .map(({ loc, alternates }) => ({ loc, alternates: alternates.filter(({ href }) => locs.has(href)) }))
    .sort((a, b) => (a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0));
}

const xml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(({ loc, alternates }) => [
      '  <url>',
      `    <loc>${xml(loc)}</loc>`,
      ...alternates.map(({ hreflang, href }) => `    <xhtml:link rel="alternate" hreflang="${xml(hreflang)}" href="${xml(href)}"/>`),
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n');
}

// Рішення 12: 301 зі старих адрес. Мова в легасі в адресі не жила
// (localStorage), тож усе веде на українську.
export const LEGACY_LISTS = [
  ['ministries.dc.html', 'ministries/'],
  ['churches.dc.html', 'churches/'],
  ['projects.dc.html', 'projects/'],
  ['testimonies.dc.html', 'testimonies/'],
  ['pastors.dc.html', 'pastors/'],
  ['leaders.dc.html', 'leaders/'],
];
export const LEGACY_DETAILS = [
  ['ministry.dc.html', 'ministries/'],
  ['church.dc.html', 'churches/'],
  ['project.dc.html', 'projects/'],
];

const escapeRe = (file) => file.replace(/\./g, '\\.');
const TEXT_TYPES = 'text/html text/css text/plain text/xml application/xml application/javascript text/javascript application/json image/svg+xml';

// Apache / OpenLiteSpeed на ukraine.com.ua (Спека 2, «Технічні файли»).
// GitHub Pages цей файл ігнорує. Домену у файлі немає свідомо (рішення 8).
export function htaccess({ base }) {
  return [
    '# Згенеровано збіркою (src/lib/seo-files.mjs). Правки — там, не в dist.',
    'AddDefaultCharset utf-8',
    'AddType font/woff2 .woff2',
    'Options -Indexes -MultiViews',
    'DirectoryIndex index.html',
    '',
    '<IfModule mod_rewrite.c>',
    'RewriteEngine On',
    `RewriteBase ${base}`,
    '',
    '# Канонічний хост — без www; одразу на https, щоб не робити два стрибки.',
    'RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]',
    'RewriteRule ^ https://%1%{REQUEST_URI} [R=301,L]',
    '',
    '# http → https. X-Forwarded-Proto — на випадок, коли TLS знімає проксі',
    '# хостингу: без цієї умови сайт за проксі редіректив би сам на себе.',
    'RewriteCond %{HTTPS} !=on',
    'RewriteCond %{HTTP:X-Forwarded-Proto} !=https',
    'RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]',
    '',
    '# …/index.html → …/. Дивимось THE_REQUEST (що попросив браузер), інакше',
    '# внутрішній підзапит DirectoryIndex зациклився б. Захоплення до першого',
    '# «?», щоб не зачепити query string; NE — шлях із THE_REQUEST уже',
    '# закодований, повторне кодування зламало б адресу.',
    'RewriteCond %{THE_REQUEST} ^[A-Z]+\\s([^\\s?]*/)index\\.html[\\s?]',
    'RewriteRule ^ %1 [R=301,L,NE]',
    '',
    '# Легасі-деталки: ?id=<slug> → /<розділ>/<slug>/, без id — на список.',
    '# «?» у кінці цілі відкидає старий query string.',
    ...LEGACY_DETAILS.flatMap(([from, to]) => [
      'RewriteCond %{QUERY_STRING} (^|&)id=([a-z0-9-]+)',
      `RewriteRule ^${escapeRe(from)}$ ${base}${to}%2/? [R=301,L]`,
      `RewriteRule ^${escapeRe(from)}$ ${base}${to}? [R=301,L]`,
    ]),
    '# Легасі-списки.',
    ...LEGACY_LISTS.map(([from, to]) => `RewriteRule ^${escapeRe(from)}$ ${base}${to}? [R=301,L]`),
    '',
    '# Кінцевий слеш для тек: /ministries → /ministries/.',
    'RewriteCond %{REQUEST_FILENAME} -d',
    `RewriteRule ^(.*[^/])$ ${base}$1/ [R=301,L]`,
    '</IfModule>',
    '',
    '<IfModule mod_headers.c>',
    '# CSS і JS збірка кладе лише в _astro/ з хешем в імені — кешуються назавжди.',
    '<FilesMatch "\\.(css|js)$">',
    '  Header set Cache-Control "public, max-age=31536000, immutable"',
    '</FilesMatch>',
    '<FilesMatch "\\.woff2$">',
    '  Header set Cache-Control "public, max-age=31536000"',
    '</FilesMatch>',
    '# Редактор може замінити завантаження під тим самим імʼям — місяць, не рік.',
    '<FilesMatch "\\.(jpe?g|png|webp|avif|gif|svg|ico)$">',
    '  Header set Cache-Control "public, max-age=2592000"',
    '</FilesMatch>',
    '# HTML, мапа, robots — щоразу перевіряти: публікація має бути видна одразу.',
    '<FilesMatch "\\.(html|xml|txt)$">',
    '  Header set Cache-Control "no-cache"',
    '</FilesMatch>',
    '</IfModule>',
    '',
    // AddOutputFilterByType сам належить mod_filter (Apache 2.4); без цієї
    // обгортки на хостингу без mod_filter директива впала б помилкою
    // конфігурації і поклала б увесь сайт 500-кою.
    '<IfModule mod_filter.c>',
    '<IfModule mod_brotli.c>',
    `  AddOutputFilterByType BROTLI_COMPRESS ${TEXT_TYPES}`,
    '</IfModule>',
    '<IfModule mod_deflate.c>',
    `  AddOutputFilterByType DEFLATE ${TEXT_TYPES}`,
    '</IfModule>',
    '</IfModule>',
    '',
  ].join('\n');
}
