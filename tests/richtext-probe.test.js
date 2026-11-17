import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_PATH } from '../astro.config.mjs';
import { withBuild } from './helpers/build.js';
import { fillAll } from './helpers/richtext-full.js';
import { findBrokenLinks, findDuplicateIds, htmlFiles } from './helpers/links.js';
import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';

// Недопустима вкладеність HTML: парсер браузера мовчки «лагодить» її й ламає верстку.
const INVALID = ['p p', 'p ul', 'p ol', 'p div', 'p table', 'p blockquote', 'p pre', 'p h2', 'p h3', 'h2 p', 'h2 ul', 'span p', 'span ul', 'a a'].join(', ');

test('повне форматування в кожному полі: збірка, валідна розмітка, без битих посилань', { timeout: 300_000 }, () => {
  withBuild(fillAll, ({ failed, output, outDir }) => {
    assert.equal(failed, false, output.slice(-3000));
    assert.deepEqual(findBrokenLinks(outDir, BASE_PATH), []);
    assert.deepEqual(findDuplicateIds(outDir, BASE_PATH), []);
    const pages = htmlFiles(outDir).map((f) => ({ f, root: parse(readFileSync(f, 'utf8')) }));
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
