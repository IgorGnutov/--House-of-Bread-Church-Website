import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
