import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetRefs, missingAssets, readContent, validateContent } from '../scripts/cms/content.mjs';
import { COLLECTIONS } from '../src/lib/storyblok/model.mjs';
import { contentDir, publicDir, withContentCopy } from './helpers/cms.js';
import { readCollection, readPages } from './helpers/content.js';
import { ministry, textTestimony } from './helpers/probes.js';

test('читає всі записи: колекції, сторінки, одиночки — кожен зі своїм шляхом у Storyblok', () => {
  const entries = readContent(contentDir);
  const expected = Object.entries(COLLECTIONS).reduce((n, [c, e]) =>
    n + (e.kind === 'collection' ? readCollection(c).length : e.kind === 'pages' ? Object.keys(readPages()).length : 1), 0);
  assert.equal(entries.length, expected);
  assert.equal(new Set(entries.map((e) => e.path)).size, entries.length, 'два записи на одному шляху');
  for (const e of entries) assert.equal(e.path, `${COLLECTIONS[e.collection].folder}/${e.slug}`);
});

test('справжній контент валідний і всі його файли на місці', () => {
  const entries = readContent(contentDir);
  assert.deepEqual(validateContent(entries), []);
  assert.deepEqual(missingAssets(entries, publicDir), []);
  for (const ref of assetRefs(entries)) assert.doesNotMatch(ref, /^https?:/, ref);
});

test('невалідний запис — помилка з файлом і полем', async () => {
  await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { name: { uk: 'Проба', en: '' } })), (dir) => {
    const errors = validateContent(readContent(dir));
    assert.ok(errors.some((e) => e.includes('ministries/probe.json') && e.includes('name.en')), errors.join('\n'));
  });
});

test('дублікат slug — помилка з обома файлами', async () => {
  await withContentCopy((c) => {
    c.write('ministries', 'probe-a', ministry('probe-twin'));
    c.write('ministries', 'probe-b', ministry('probe-twin'));
  }, (dir) => {
    const errors = validateContent(readContent(dir)).join('\n');
    assert.match(errors, /probe-twin/);
    assert.match(errors, /probe-a/);
    assert.match(errors, /probe-b/);
  });
});

test('бракує сторінки з PAGE_IDS — помилка', async () => {
  await withContentCopy((c) => c.editSingleton('pages', (pages) => { delete pages.about; }), (dir) => {
    assert.match(validateContent(readContent(dir)).join('\n'), /about/);
  });
});

test('порожня колекція (теки немає) — валідна, просто без історій', async () => {
  await withContentCopy((c) => c.clear('testimonies'), (dir) => {
    const entries = readContent(dir);
    assert.deepEqual(validateContent(entries), []);
    assert.equal(entries.some((e) => e.collection === 'testimonies'), false);
  });
});

test('шлях uploads/… на файл, якого немає, — помилка до будь-якого запиту', async () => {
  await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { media: [{ type: 'image', src: 'uploads/nope.jpg', alt: 'Проба' }] })), (dir) => {
    const errors = missingAssets(readContent(dir), publicDir);
    assert.ok(errors.some((e) => e.includes('uploads/nope.jpg')), errors.join('\n'));
  });
});

test('побитий дискримінатор (type/kind) — validateContent його називає, assetRefs/missingAssets не падають', async () => {
  await withContentCopy((c) => c.write('testimonies', 'probe', textTestimony('probe', { type: 'bogus' })), (dir) => {
    const entries = readContent(dir);
    const errors = validateContent(entries).join('\n');
    assert.match(errors, /testimonies\/probe\.json/);
    assert.doesNotThrow(() => assetRefs(entries));
    assert.doesNotThrow(() => missingAssets(entries, publicDir));
  });
});
