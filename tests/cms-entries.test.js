import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../src/lib/content-rules.mjs';
import { canonical, toStory } from '../src/lib/storyblok/convert.mjs';
import { ministry } from './helpers/probes.js';
import { editableAttrs, storiesToEntries, storyRoutes } from '../src/lib/storyblok/entries.mjs';
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

// Історія служіння з пробного запису; body_uk — документ Storyblok із заданими вузлами.
const probeStory = (slug, uuid, bodyUk) => {
  const story = toStory('ministries', slug, ministry(slug));
  if (bodyUk) story.content.body_uk = bodyUk;
  return { id: 1, uuid, full_slug: `ministries/${slug}`, ...story };
};
const linkDoc = (attrs, label = 'Молодь') => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: label, marks: [{ type: 'link', attrs }] }] }],
});
const linkOf = (entry) => entry.data.body.uk.content[0].content[0].marks?.[0]?.attrs;

test('посилання на історію — поточний шлях сторінки за uuid', () => {
  const link = { linktype: 'story', uuid: 'u-youth', href: 'ministries/old' };
  const at = (slug) => storiesToEntries([probeStory(slug, 'u-youth'), probeStory('a', 'u-a', linkDoc(link))]);
  const first = at('youth');
  assert.deepEqual(first.errors, []);
  assert.equal(linkOf(first.entries.find((e) => e.slug === 'a')).href, '/ministries/youth/');
  // Перейменування slug цілі: у посиланні лишився старий href, але шлях береться з uuid.
  const renamed = at('young');
  assert.equal(linkOf(renamed.entries.find((e) => e.slug === 'a')).href, '/ministries/young/');
});

test('посилання на неопубліковану історію — текст без посилання й попередження', () => {
  const link = { linktype: 'story', uuid: 'u-gone', href: 'ministries/gone' };
  const { entries, errors, warnings } = storiesToEntries([probeStory('a', 'u-a', linkDoc(link, 'Наша молодь'))]);
  assert.deepEqual(errors, []);
  const a = entries.find((e) => e.slug === 'a');
  assert.equal(linkOf(a), undefined);
  assert.equal(a.data.body.uk.content[0].content[0].text, 'Наша молодь');
  assert.ok(warnings.some((w) => w.startsWith('ministries/a: ') && w.includes('Наша молодь')), warnings.join('\n'));
});

test('storyRoutes: шляхи сайту за uuid, одиночки без сторінки — null', () => {
  const at = (full_slug, uuid) => ({ full_slug, uuid, slug: full_slug.split('/').pop() });
  const routes = storyRoutes([
    at('ministries/youth', 'u1'), at('churches/kyiv', 'u2'), at('projects/camp', 'u3'),
    at('pages/about', 'u4'), at('settings/homepage', 'u5'), at('testimonies/maria', 'u6'),
    at('pastors/ivan', 'u7'), at('leader-resources/doc-1', 'u8'), at('settings/site-settings', 'u9'),
  ]);
  assert.deepEqual([...routes], [
    ['u1', '/ministries/youth/'], ['u2', '/churches/kyiv/'], ['u3', '/projects/camp/'],
    ['u4', '/about/'], ['u5', '/'], ['u6', '/testimonies/'], ['u7', '/pastors/'], ['u8', '/leaders/'], ['u9', null],
  ]);
});

test('посилання на одиночку без сторінки — попередження називає ціль', () => {
  const link = { linktype: 'story', uuid: 'u-settings', href: 'settings/site-settings' };
  const settings = { id: 2, uuid: 'u-settings', full_slug: 'settings/site-settings', slug: 'site-settings', content: {} };
  const { warnings } = storiesToEntries([settings, probeStory('a', 'u-a', linkDoc(link, 'Налаштування'))]);
  assert.ok(warnings.some((w) => w.includes('«Налаштування» веде на «settings/site-settings», яка не має сторінки на сайті')), warnings.join('\n'));
});
