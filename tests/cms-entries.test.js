import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../src/lib/content-rules.mjs';
import { canonical, toStory } from '../src/lib/storyblok/convert.mjs';
import { editableAttrs, storiesToEntries } from '../src/lib/storyblok/entries.mjs';
import { readContent } from '../scripts/cms/content.mjs';
import { contentDir } from './helpers/cms.js';

// Історія CDN API з запису файлів: картинки — «з медіатеки», і назад.
const LIB = 'https://a.storyblok.com/f/1/';
const asStory = (e, id = 7) => ({
  id, full_slug: e.path,
  ...toStory(e.collection, e.slug, e.data, { asset: (src) => ({ id, filename: `${LIB}${src}` }) }),
});
const back = (asset) => (asset.filename.startsWith(LIB) ? asset.filename.slice(LIB.length) : asset.filename);

test('історії → записи того самого вигляду й даних, що з файлів', () => {
  const files = readContent(contentDir);
  const { entries, errors, warnings } = storiesToEntries(files.map((e) => asStory(e)), { assetPath: back });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(entries.map((e) => e.path).sort(), files.map((e) => e.path).sort());
  for (const e of entries) {
    const want = files.find((f) => f.path === e.path);
    assert.equal(e.collection, want.collection, e.path);
    assert.equal(e.slug, want.slug, e.path);
    assert.deepEqual(canonical(e.collection, e.data), canonical(want.collection, want.data), e.path);
  }
  assert.deepEqual(validateContent(entries), []);
});

test('папки й історії поза папками сайту пропускаються з попередженням', () => {
  const { entries, errors, warnings } = storiesToEntries([
    { id: 1, full_slug: 'ministries', slug: 'ministries', is_folder: true, content: {} },
    { id: 2, full_slug: 'home', slug: 'home', content: { component: 'page', _uid: 'x' } },
    { id: 3, full_slug: 'settings/unknown', slug: 'unknown', content: { component: 'homepage', _uid: 'y' } },
  ]);
  assert.deepEqual(entries, []);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 2);
  assert.match(warnings.join('\n'), /^home: /m);
  assert.match(warnings.join('\n'), /^settings\/unknown: /m);
});

test('чужий тип контенту в папці колекції — помилка з адресою історії', () => {
  const { entries, errors } = storiesToEntries([{ id: 1, full_slug: 'ministries/x', slug: 'x', content: { component: 'church', _uid: 'u' } }]);
  assert.deepEqual(entries, []);
  assert.match(errors[0], /^ministries\/x: /);
});

test('без одиночки validateContent називає її історію', () => {
  const without = readContent(contentDir).filter((e) => e.collection !== 'homepage');
  assert.ok(validateContent(without).some((m) => m.startsWith('settings/homepage:')), validateContent(without).join('\n'));
});

test('_editable → атрибути Visual Editor для кореня й вкладених блоків', () => {
  const home = readContent(contentDir).find((e) => e.collection === 'homepage');
  const story = asStory(home, 42);
  const mark = (blok) => {
    if (!blok || typeof blok !== 'object') return;
    if (blok.component) blok._editable = `<!--#storyblok#${JSON.stringify({ name: blok.component, space: '1', uid: blok._uid, id: '42' })}-->`;
    for (const value of Object.values(blok)) if (Array.isArray(value)) value.forEach(mark);
  };
  mark(story.content);
  const { editables } = storiesToEntries([story], { assetPath: back });
  assert.equal(editables.get('settings/homepage#')['data-blok-uid'], `42-${story.content._uid}`);
  assert.equal(editables.get('settings/homepage#hero')['data-blok-uid'], `42-${story.content.hero[0]._uid}`);
  assert.equal(JSON.parse(editables.get('settings/homepage#')['data-blok-c']).name, 'homepage');
});

test('editableAttrs: не коментар Storyblok — null', () => {
  for (const bad of [undefined, '', '<!-- x -->', '<!--#storyblok#{bad json}-->']) assert.equal(editableAttrs(bad), null, String(bad));
});
