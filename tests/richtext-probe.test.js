import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_PATH } from '../astro.config.mjs';
import { withBuild } from './helpers/build.js';
import { fillAll } from './helpers/richtext-full.js';
import { findBrokenLinks, findDuplicateIds, htmlFiles } from './helpers/links.js';
import { readFileSync } from 'node:fs';
import { ownMarkup } from './helpers/dist.js';

// Недопустима вкладеність HTML: парсер браузера мовчки «лагодить» її й ламає верстку.
const INVALID = ['p p', 'p ul', 'p ol', 'p div', 'p table', 'p blockquote', 'p pre', 'p h2', 'p h3', 'h2 p', 'h2 ul', 'span p', 'span ul', 'a a'].join(', ');

// Без preserveTagNesting парсер мовчки закриває <p> перед вкладеним <p>/<div> і вада
// шаблону зникає ще до перевірки; стрічку Facebook не перевіряємо (ownMarkup).
const parseStrict = (html) => ownMarkup(html, { preserveTagNesting: true });

test('перевірка вкладеності справді ловить блок усередині <p>', () => {
  for (const html of ['<p>a<div>b</div></p>', '<p>a<p>b</p></p>']) {
    assert.ok(parseStrict(html).querySelectorAll(INVALID).length > 0, html);
  }
});

test('повне форматування в кожному полі: збірка, валідна розмітка, без битих посилань', { timeout: 300_000 }, () => {
  withBuild(fillAll, ({ failed, output, outDir }) => {
    assert.equal(failed, false, output.slice(-3000));
    assert.deepEqual(findBrokenLinks(outDir, BASE_PATH), []);
    assert.deepEqual(findDuplicateIds(outDir, BASE_PATH), []);
    const pages = htmlFiles(outDir).map((f) => ({ f, root: parseStrict(readFileSync(f, 'utf8')) }));
    const nested = pages.flatMap(({ f, root }) => root.querySelectorAll(INVALID).map((el) => `${f}: ${el.tagName}`));
    assert.deepEqual(nested, []);
    for (const sel of ['.rt-list', '.rt-table', '.rt-img']) {
      assert.ok(pages.some(({ root }) => root.querySelector(sel)), `ніде немає ${sel}`);
    }
    for (const { f, root } of pages) {
      for (const a of root.querySelectorAll('a.rt-link[href^="https://example.test"]')) {
        assert.equal(a.getAttribute('target'), '_blank', `${f}: ${a.getAttribute('href')}`);
      }
    }
  }, { timeout: 280_000 });
});
