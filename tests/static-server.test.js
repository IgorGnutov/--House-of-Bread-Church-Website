import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFile, startStaticServer } from '../scripts/lib/static-server.mjs';

const root = mkdtempSync(join(tmpdir(), 'hob-serve-'));
mkdirSync(join(root, 'ministries'));
writeFileSync(join(root, 'index.html'), 'home');
writeFileSync(join(root, 'ministries/index.html'), 'list');
// F1: назва фікстури — legacy.html, а не ministry.dc.html, щоб пізніший
// git grep на легасі-назви сторінок (Задача 15) лишався порожнім.
writeFileSync(join(root, 'legacy.html'), 'legacy');
process.on('exit', () => rmSync(root, { recursive: true, force: true }));

test('каталог віддає index.html, query і hash відкидаються', () => {
  assert.equal(resolveFile(root, '/'), join(root, 'index.html'));
  assert.equal(resolveFile(root, '/ministries/'), join(root, 'ministries/index.html'));
  // Легасі-деталі живуть на ?id= — той самий файл для будь-якого id.
  assert.equal(resolveFile(root, '/legacy.html?id=youth'), join(root, 'legacy.html'));
  assert.equal(resolveFile(root, '/%D0%B0.html'), null);
});

test('вихід за корінь і неіснуючий файл — null', () => {
  assert.equal(resolveFile(root, '/../../etc/passwd'), null);
  assert.equal(resolveFile(root, '/nope/'), null);
});

test('сервер віддає файл із типом і 404 на відсутній', async () => {
  const site = await startStaticServer(root);
  try {
    const ok = await fetch(`${site.origin}/ministries/`);
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type'), /text\/html/);
    assert.equal(await ok.text(), 'list');
    assert.equal((await fetch(`${site.origin}/nope.css`)).status, 404);
  } finally {
    await site.close();
  }
});
