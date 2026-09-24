import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetRefs, readContent } from '../scripts/cms/content.mjs';
import { diffValues, runImport, runVerify } from '../scripts/cms/sync.mjs';
import { contentDir, fakeClient, publicDir, quietLog, withFake } from './helpers/cms.js';

const T = { timeout: 60_000 };
const verify = async (fake) => {
  const out = quietLog();
  const result = await runVerify({ client: fakeClient(fake), contentDir, publicDir, log: out.log });
  return { ...result, out };
};
const imported = async (fn) => withFake({}, async (fake) => {
  await runImport({ client: fakeClient(fake), contentDir, publicDir, apply: true, log: quietLog().log });
  await fn(fake);
});
const firstMinistry = () => readContent(contentDir).find((e) => e.collection === 'ministries');

test('після імпорту — нуль розбіжностей (критерій приймання Етапу 4)', T, async () => {
  await imported(async (fake) => {
    const { exitCode, diffs, out } = await verify(fake);
    assert.deepEqual(diffs, []);
    assert.equal(exitCode, 0);
    assert.match(out.text(), /Розбіжностей немає/);
  });
});

test('змінене поле — рядок із шляхом, обома значеннями й ненульовим кодом', T, async () => {
  await imported(async (fake) => {
    const target = firstMinistry();
    fake.editStory(target.path, (content) => { content.summary_en = 'Інший текст'; });
    const { exitCode, diffs } = await verify(fake);
    assert.equal(exitCode, 1);
    assert.equal(diffs.length, 1, diffs.join('\n'));
    assert.ok(diffs[0].startsWith(`${target.path} → summary.en:`), diffs[0]);
    // Довге значення у звіті обрізається — звіряємо його початок.
    assert.ok(diffs[0].includes(JSON.stringify(target.data.summary.en).slice(0, 40)), diffs[0]);
    assert.ok(diffs[0].includes('"Інший текст"'), diffs[0]);
  });
});

test('картинка медіатеки з іншим вмістом — розбіжність за SHA-256', T, async () => {
  await imported(async (fake) => {
    const refs = assetRefs(readContent(contentDir));
    assert.ok(refs.length > 0, 'у контенті немає жодного файлу медіатеки — тест нічого не перевіряє');
    const [key] = fake.state.files.keys();
    fake.state.files.set(key, Buffer.from('not the same image'));
    const { exitCode, diffs } = await verify(fake);
    assert.equal(exitCode, 1);
    assert.ok(diffs.some((d) => refs.some((ref) => d.includes(ref))), diffs.join('\n'));
  });
});

test('історії немає / зайва історія / неопубліковані зміни — теж розбіжності', T, async () => {
  await imported(async (fake) => {
    const target = firstMinistry();
    fake.state.stories = fake.state.stories.filter((s) => s.full_slug !== target.path);
    fake.addStory({ parentSlug: 'ministries', slug: 'stray', content: { component: 'ministry' } });
    const other = readContent(contentDir).find((e) => e.collection === 'churches');
    fake.editStory(other.path, () => {}, { publish: false });
    const { diffs } = await verify(fake);
    assert.ok(diffs.some((d) => d.startsWith(`${target.path}:`) && d.includes('немає')), diffs.join('\n'));
    assert.ok(diffs.some((d) => d.startsWith('ministries/stray:')), diffs.join('\n'));
    assert.ok(diffs.some((d) => d.startsWith(`${other.path}:`) && d.includes('неопубліков')), diffs.join('\n'));
  });
});

test('diffValues: шлях до кожної розбіжності, відсутній ключ ≠ null', () => {
  assert.deepEqual(diffValues({ a: { uk: 'x', en: 'y' } }, { a: { uk: 'x', en: 'z' } }), [{ path: 'a.en', expected: 'y', actual: 'z' }]);
  assert.deepEqual(diffValues({ m: [{ s: 1 }] }, { m: [{ s: 1 }, { s: 2 }] }), [{ path: 'm[1]', expected: undefined, actual: { s: 2 } }]);
  assert.deepEqual(diffValues({ b: null }, {}), [{ path: 'b', expected: null, actual: undefined }]);
  assert.deepEqual(diffValues({ x: 1, y: [1, 2] }, { y: [1, 2], x: 1 }), []);
});
