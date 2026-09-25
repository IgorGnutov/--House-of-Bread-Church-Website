import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { BASE_PATH } from '../astro.config.mjs';
import { distDir, distPath, loadPage } from './helpers/dist.js';
import { findBrokenLinks, htmlFiles, pageUrl } from './helpers/links.js';

const pages = htmlFiles(distDir).map((file) => {
  const url = pageUrl(distDir, file, BASE_PATH);
  const rel = url.slice(BASE_PATH.length);
  return { file, url, rel, lang: rel.startsWith('en/') || rel === 'en/' ? 'en' : 'uk', root: parse(readFileSync(file, 'utf8')) };
});

test('кожне внутрішнє посилання й ресурс ведуть на наявний файл', () => {
  assert.deepEqual(findBrokenLinks(distDir, BASE_PATH), []);
});

test('жодного посилання на легасі-адреси', () => {
  for (const { url, root } of pages) {
    for (const a of root.querySelectorAll('a[href]')) {
      assert.doesNotMatch(a.getAttribute('href'), /\.dc\.html|(^|\/)index\.html/, `${url}: ${a.getAttribute('href')}`);
    }
  }
});

test('lang у <html> відповідає префіксу адреси', () => {
  for (const { url, lang, root } of pages) {
    assert.equal(root.querySelector('html').getAttribute('lang'), lang, url);
  }
});

test('перемикач мов веде на ту саму сторінку іншою мовою', () => {
  for (const { url, rel, lang, root } of pages) {
    const neutral = lang === 'en' ? rel.slice('en/'.length) : rel;
    const toggles = root.querySelectorAll('.lang-toggle');
    assert.ok(toggles.length > 0, `${url}: немає перемикача мов`);
    for (const toggle of toggles) {
      assert.equal(toggle.querySelector('a[hreflang="uk"]').getAttribute('href'), `${BASE_PATH}${neutral}`, url);
      assert.equal(toggle.querySelector('a[hreflang="en"]').getAttribute('href'), `${BASE_PATH}en/${neutral}`, url);
      assert.equal(toggle.querySelector('a.is-active').getAttribute('hreflang'), lang, `${url}: активна не та мова`);
    }
  }
});

test('англійські сторінки не ведуть на українські', () => {
  for (const { url, lang, root } of pages) {
    if (lang !== 'en') continue;
    for (const a of root.querySelectorAll('a[href]')) {
      if (a.getAttribute('hreflang') === 'uk') continue; // перемикач мов — єдиний дозволений вихід
      const ref = a.getAttribute('href');
      if (ref.startsWith('#') || /^[a-z]+:/i.test(ref)) continue;
      const { pathname } = new URL(ref, `http://site.test${url}`);
      assert.ok(pathname.startsWith(`${BASE_PATH}en/`), `${url}: ${ref} мовчки перемикає на українську`);
    }
  }
});

test('немає localStorage і автоперенаправлення за мовою', () => {
  // Спека 2: автоперехід за збереженою мовою — блокер індексації en.
  const assets = readdirSync(join(distDir, '_astro')).filter((f) => f.endsWith('.js'));
  for (const text of [...pages.map((p) => readFileSync(p.file, 'utf8')), ...assets.map((f) => readFileSync(join(distDir, '_astro', f), 'utf8'))]) {
    assert.doesNotMatch(text, /localStorage|hob-lang/);
  }
});

test('стилі сторінки підключаються після спільних — перевизначення :root виграє', () => {
  // Рішення 4: на пʼяти сторінках --maxw:1200px. Якщо CSS сторінки прийде
  // раніше за tokens.css, переможе 1360px, і контейнер тихо розшириться.
  const css = loadPage('ministries/index.html')
    .querySelectorAll('link[rel="stylesheet"]')
    .map((link) => readFileSync(distPath(link.getAttribute('href').slice(BASE_PATH.length)), 'utf8'))
    .join('\n');
  const shared = css.indexOf('--maxw:1360px');
  const own = css.lastIndexOf('--maxw:1200px');
  assert.ok(shared !== -1 && own !== -1, 'не знайдено одного з --maxw');
  assert.ok(shared < own, 'токени підключені після стилів сторінки');
});

test('жодного <style> у .astro — стилі лише глобальними файлами', () => {
  const src = fileURLToPath(new URL('../src', import.meta.url));
  const astroFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? astroFiles(join(dir, e.name)) : e.name.endsWith('.astro') ? [join(dir, e.name)] : []);
  for (const file of astroFiles(src)) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /<style[\s>]/, `${file}: scoped-стилі змінюють специфічність легасі`);
  }
});

// Спека 3: браузер відвідувача не звертається до Storyblok, а розмітка
// Visual Editor живе лише на прев'ю-стенді.
test('жодної адреси Storyblok і розмітки Visual Editor у продакшн-збірці', () => {
  for (const { url, root } of pages) {
    for (const el of root.querySelectorAll('[src], [href], [srcset], meta[content]')) {
      for (const attr of ['src', 'href', 'srcset', 'content']) {
        const value = el.getAttribute(attr);
        if (value) assert.doesNotMatch(value, /storyblok\.com/i, `${url}: ${attr}="${value}"`);
      }
    }
    assert.equal(root.querySelectorAll('[data-blok-c], [data-blok-uid]').length, 0, `${url}: атрибути Visual Editor`);
  }
});
