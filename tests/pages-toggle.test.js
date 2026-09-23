import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { BASE_PATH } from '../astro.config.mjs';
import { distPath } from './helpers/dist.js';
import { isPageEnabled } from '../src/lib/pages.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const pagesFile = join(projectRoot, 'src/content/singletons/pages.json');
const MARKER = '__probe_body__';

// Тест тимчасово вписує текст у справжній pages.json (file()-завантажувач
// іншого джерела не бачить). Якщо попередній прогін убили посеред збірки,
// маркер лишився — повертаємо файл з git до старту.
before(() => {
  if (readFileSync(pagesFile, 'utf8').includes(MARKER)) {
    execFileSync('git', ['checkout', '--', pagesFile], { cwd: projectRoot });
  }
});

test('наявність /about/, /contacts/, /donate/ у збірці й футері збігається з isPageEnabled', () => {
  // Знахідка 1: раніше тест жорстко очікував «нема ніде» — щойно замовник
  // вписав би прозу в pages.json, CI ламався б на самій ознаці роботи.
  // Тепер очікування рахуються з тих самих даних, що й сама збірка.
  const pages = JSON.parse(readFileSync(pagesFile, 'utf8'));
  const footer = readFileSync(distPath('index.html'), 'utf8');
  for (const id of ['about', 'contacts', 'donate']) {
    const enabled = isPageEnabled(pages[id]);
    assert.equal(existsSync(distPath(`${id}/index.html`)), enabled, `/${id}/: наявність сторінки не збігається з isPageEnabled`);
    assert.equal(existsSync(distPath(`en/${id}/index.html`)), enabled, `/en/${id}/: наявність сторінки не збігається з isPageEnabled`);
    assert.equal(new RegExp(`href="[^"]*/${id}/"`).test(footer), enabled, `футер: посилання на /${id}/ не збігається з isPageEnabled`);
  }
});

test('текст вмикає сторінку обома мовами і посилання у футері', { timeout: 180_000 }, () => {
  const original = readFileSync(pagesFile, 'utf8');
  const outDir = mkdtempSync(join(tmpdir(), 'hob-pages-'));
  try {
    const pages = JSON.parse(original);
    pages.about.body = { uk: `Перший абзац ${MARKER}.\n\nДругий абзац.`, en: `First paragraph ${MARKER}.\n\nSecond.` };
    writeFileSync(pagesFile, JSON.stringify(pages, null, 2));
    execFileSync(process.execPath, [join(projectRoot, 'node_modules/astro/astro.js'), 'build', '--outDir', outDir], {
      cwd: projectRoot, stdio: 'pipe', timeout: 150_000, killSignal: 'SIGKILL',
    });

    for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
      const page = parse(readFileSync(join(outDir, `${prefix}about/index.html`), 'utf8'));
      assert.equal(page.querySelector('h1').text, pages.about.title[lang]);
      assert.equal(page.querySelectorAll('.prose p').length, 2, `${lang}: абзаци не розділені`);
      const home = parse(readFileSync(join(outDir, `${prefix}index.html`), 'utf8'));
      const aboutLink = home.querySelectorAll('.footer-col')[0].querySelector('a');
      // Тимчасова збірка успадковує env, тож під BASE_PATH (Задача 14) теж.
      assert.equal(aboutLink.getAttribute('href'), `${BASE_PATH}${prefix}about/`);
    }
    // Решта дві лишилися вимкненими — сторінки вмикаються по одній.
    assert.equal(existsSync(join(outDir, 'contacts/index.html')), false);
  } finally {
    writeFileSync(pagesFile, original);
    rmSync(outDir, { recursive: true, force: true });
  }
});
