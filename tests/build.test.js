import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SITE_URL, BASE_PATH } from '../astro.config.mjs';

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

  assert.match(uk, /<html[^>]+lang="uk"/, 'українська сторінка без lang="uk"');
  assert.match(en, /<html[^>]+lang="en"/, 'англійська сторінка без lang="en"');

  // Компонуємо очікувані URL через new URL(), а не конкатенацією рядків: SITE_URL
  // і BASE_PATH можуть прийти з довільним/відсутнім кінцевим слешем, і лише
  // URL-композиція дає той самий коректний результат, що й сама Astro.
  const canonicalUk = new URL(BASE_PATH, SITE_URL).href;
  const canonicalEn = new URL(`${BASE_PATH}en/`, SITE_URL).href;

  assert.ok(
    uk.includes(`<link rel="canonical" href="${canonicalUk}">`),
    `canonical української не дорівнює ${canonicalUk}`,
  );
  assert.ok(
    en.includes(`<link rel="canonical" href="${canonicalEn}">`),
    `canonical англійської не дорівнює ${canonicalEn}`,
  );
});

test('спільні стилі підключені, а не інлайняться копіями', () => {
  const uk = readDist('index.html');

  assert.ok(
    uk.includes(`<link rel="stylesheet" href="${BASE_PATH}_astro/`),
    `немає зовнішнього CSS під base ${BASE_PATH}`,
  );
  assert.doesNotMatch(uk, /@font-face/, '@font-face інлайниться в HTML');
});

test('шрифти адресуються з урахуванням BASE_PATH', () => {
  const css = readdirSync(dist('_astro'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => readDist(`_astro/${f}`))
    .join('\n');

  // Витягуємо всі url(...), що ведуть на .woff2, і дивимось, куди вони реально впираються.
  const urls = [...css.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 8, `очікували 8 посилань на .woff2, знайшли ${urls.length}`);

  // Той самий принцип: URL-композиція відносно фіктивного походження, а не
  // рядкова конкатенація з BASE_PATH, яка розсипається, якщо той без слешу.
  const cssHref = new URL(`${BASE_PATH}_astro/site.css`, 'https://example.test');
  const expectedPrefix = new URL(`${BASE_PATH}fonts/`, 'https://example.test').pathname;

  for (const u of urls) {
    const resolved = new URL(u, cssHref).pathname;
    assert.ok(
      resolved.startsWith(expectedPrefix),
      `шлях ${u} веде на ${resolved}, а мав на ${expectedPrefix}… — під підшляхом це 404`,
    );
  }
});

test(
  'SITE_URL і BASE_PATH дійсно керують збіркою, а не лише їхні фолбеки',
  { timeout: 120_000 },
  () => {
    // Окрема, справді інша збірка (не default env з npm test) — єдиний спосіб
    // довести, що індирекція наскрізна: захардкоджений домен, змішаний із
    // обчисленим підшляхом, пройшов би кожен інший тест у цьому файлі.
    const outDir = mkdtempSync(join(tmpdir(), 'hob-astro-verify-'));
    const projectRoot = fileURLToPath(new URL('..', import.meta.url));
    try {
      execFileSync(
        process.execPath,
        [join(projectRoot, 'node_modules/astro/astro.js'), 'build', '--outDir', outDir],
        {
          cwd: projectRoot,
          env: { ...process.env, SITE_URL: 'https://verify.invalid', BASE_PATH: 'verify-base' },
          stdio: 'pipe',
        },
      );

      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      assert.ok(
        html.includes('https://verify.invalid/verify-base/'),
        'canonical не підхопив довільні SITE_URL/BASE_PATH цієї збірки',
      );

      const css = readdirSync(join(outDir, '_astro'))
        .filter((f) => f.endsWith('.css'))
        .map((f) => readFileSync(join(outDir, '_astro', f), 'utf8'))
        .join('\n');

      for (const [label, text] of [['HTML', html], ['CSS', css]]) {
        assert.doesNotMatch(text, /dim-hliba\.invalid/, `фолбек-домен просочився у ${label}`);
        assert.doesNotMatch(
          text,
          /--House-of-Bread-Church-Website/,
          `захардкоджений підшлях просочився у ${label}`,
        );
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  },
);
