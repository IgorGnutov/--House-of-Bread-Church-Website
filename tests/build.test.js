import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const dist = (relPath) =>
  fileURLToPath(new URL(`../dist/${relPath}`, import.meta.url));

export const readDist = (relPath) => readFileSync(dist(relPath), 'utf8');

test('збірка кладе головну в dist/index.html', () => {
  assert.ok(existsSync(dist('index.html')), 'dist/index.html не існує');
});

test('шрифти лежать у dist за абсолютними шляхами', () => {
  for (const f of [
    'fonts/nyght-serif/NyghtSerif-Regular.woff2',
    'fonts/nyght-serif/NyghtSerif-RegularItalic.woff2',
    'fonts/nyght-serif/NyghtSerif-Bold.woff2',
    'fonts/nyght-serif/NyghtSerif-BoldItalic.woff2',
    'fonts/fixel/FixelText-Regular.woff2',
    'fonts/fixel/FixelText-Medium.woff2',
    'fonts/fixel/FixelText-SemiBold.woff2',
    'fonts/fixel/FixelText-Bold.woff2',
  ]) {
    assert.ok(existsSync(dist(f)), `немає dist/${f}`);
  }
});

test('обидві локалі збираються за реальними адресами', () => {
  assert.ok(existsSync(dist('index.html')), 'немає української головної');
  assert.ok(existsSync(dist('en/index.html')), 'немає англійської головної');
});

test('кожна локаль має свій lang і свій canonical із SITE_URL та BASE_PATH', () => {
  const uk = readDist('index.html');
  const en = readDist('en/index.html');
  const site = process.env.SITE_URL ?? 'https://dim-hliba.invalid';
  const base = process.env.BASE_PATH ?? '/';

  assert.match(uk, /<html[^>]+lang="uk"/, 'українська сторінка без lang="uk"');
  assert.match(en, /<html[^>]+lang="en"/, 'англійська сторінка без lang="en"');

  assert.ok(
    uk.includes(`<link rel="canonical" href="${site}${base}">`),
    `canonical української не дорівнює ${site}${base}`,
  );
  assert.ok(
    en.includes(`<link rel="canonical" href="${site}${base}en/">`),
    `canonical англійської не дорівнює ${site}${base}en/`,
  );
});

test('спільні стилі підключені, а не інлайняться копіями', () => {
  const uk = readDist('index.html');
  const base = process.env.BASE_PATH ?? '/';

  assert.ok(
    uk.includes(`<link rel="stylesheet" href="${base}_astro/`),
    `немає зовнішнього CSS під base ${base}`,
  );
  assert.doesNotMatch(uk, /@font-face/, '@font-face інлайниться в HTML');
});

test('шрифти адресуються з урахуванням BASE_PATH', () => {
  const base = process.env.BASE_PATH ?? '/';
  const css = readdirSync(dist('_astro'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => readDist(`_astro/${f}`))
    .join('\n');

  // Витягуємо всі url(...), що ведуть на .woff2, і дивимось, куди вони реально впираються.
  const urls = [...css.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 8, `очікували 8 посилань на .woff2, знайшли ${urls.length}`);

  for (const u of urls) {
    // Відносний і абсолютний-із-base шлях мають дати те саме місце.
    const resolved = new URL(u, `https://example.test${base}_astro/site.css`).pathname;
    assert.ok(
      resolved.startsWith(`${base}fonts/`),
      `шлях ${u} веде на ${resolved}, а мав на ${base}fonts/… — під підшляхом це 404`,
    );
  }
});
