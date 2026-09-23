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
