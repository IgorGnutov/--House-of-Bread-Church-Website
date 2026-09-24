import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINISTRY_ICON_NAMES } from '../src/lib/icons.mjs';
import { buildComponents, buildFolders, ROOT_COMPONENTS } from '../src/lib/storyblok/components.mjs';
import { COLLECTIONS, COMPONENTS, FINGERPRINT_FIELD, FOLDERS } from '../src/lib/storyblok/model.mjs';

const components = buildComponents();
const byName = new Map(components.map((c) => [c.name, c]));
const fieldsOf = (c) => Object.entries(c.schema).filter(([, f]) => f.type !== 'tab');
const tabsOf = (c) => Object.entries(c.schema).filter(([, f]) => f.type === 'tab');

test('компонент на кожен компонент моделі, корені — типи контенту, решта — вкладені', () => {
  assert.deepEqual([...byName.keys()].sort(), Object.keys(COMPONENTS).sort());
  for (const c of components) {
    assert.equal(c.is_root, ROOT_COMPONENTS.has(c.name), c.name);
    assert.equal(c.is_nestable, !c.is_root, c.name);
    assert.ok(c.display_name, `${c.name}: без підпису`);
  }
});

test('наші назви не перетинаються з демо-вмістом, який прибирає перший імпорт', () => {
  for (const demo of ['page', 'teaser', 'grid', 'feature']) assert.equal(byName.has(demo), false, demo);
  for (const reserved of ['content']) assert.equal(byName.has(reserved), false, reserved);
});

test('пара uk/en — два поля з підписами (укр.) / (англ.)', () => {
  const ministry = byName.get('ministry').schema;
  assert.equal(ministry.name_uk.display_name, `${COMPONENTS.ministry.fields.name.label} (укр.)`);
  assert.equal(ministry.name_en.display_name, `${COMPONENTS.ministry.fields.name.label} (англ.)`);
  assert.equal(ministry.summary_uk.type, 'textarea');
  assert.equal(ministry.name_uk.type, 'text');
});

test('блоки посилаються лише на наявні компоненти', () => {
  for (const c of components) {
    for (const [key, f] of fieldsOf(c)) {
      if (f.type !== 'bloks') continue;
      assert.equal(f.restrict_components, true, `${c.name}.${key}`);
      for (const name of f.component_whitelist) assert.ok(byName.has(name), `${c.name}.${key} → ${name}`);
    }
  }
});

test('обовʼязкова група — рівно один блок, nullable/optional — максимум один', () => {
  const church = byName.get('church').schema;
  assert.equal(church.seo.maximum, 1);
  assert.equal(church.seo.minimum, 1);
  assert.equal(church.seo.required, true);
  assert.equal(church.geo.maximum, 1);
  assert.equal('required' in church.geo, false);
  assert.equal(byName.get('site_page').schema.seo.required, undefined);
});

test('required у формі — там, де схема не дозволяє порожнечі', () => {
  const ministry = byName.get('ministry').schema;
  assert.equal(ministry.leader.required, true);
  assert.equal(ministry.media.required, true, 'порожня галерея — помилка схеми');
  assert.equal(byName.get('pastor').schema.email.required, undefined, 'nullable');
  assert.equal(byName.get('home_news_image').schema.alt.required, undefined, 'alt новини може бути порожнім');
  assert.equal(byName.get('resource_document').schema.format.required, true, 'формат документа — обовʼязковий');
  assert.equal(byName.get('seo').schema.noindex.required, undefined, 'галочка не буває обовʼязковою');
});

test('списки значень беруться з коду, а не пишуться вдруге', () => {
  const icon = byName.get('ministry').schema.icon;
  assert.equal(icon.type, 'option');
  assert.deepEqual(icon.options.map((o) => o.value), MINISTRY_ICON_NAMES);
  assert.equal('source' in icon, false, 'source «self» — це відсутній ключ');
  assert.deepEqual(byName.get('pastor').schema.group.options, [{ name: 'Пастор', value: 'pastor' }, { name: 'Пресвітер', value: 'elder' }]);
});

test('картинки — asset з дозволеною зовнішньою адресою', () => {
  const photo = byName.get('pastor').schema.photo;
  assert.equal(photo.type, 'asset');
  assert.deepEqual(photo.filetypes, ['images']);
  assert.equal(photo.allow_external_url, true);
});

test('документ лідерів — назва й посилання на хмару, а не файл у медіатеці', () => {
  // Рішення замовника (план, рішення 11): файли — посиланнями на Google Диск тощо.
  const doc = byName.get('resource_document').schema;
  assert.equal(doc.url.type, 'text');
  assert.equal(doc.title_uk.type, 'text');
  assert.equal(doc.title_en.type, 'text');
});

test('у кореня вкладки покривають кожне поле рівно раз, відбиток — у «Службове»', () => {
  for (const name of ROOT_COMPONENTS) {
    const c = byName.get(name);
    const keys = fieldsOf(c).map(([k]) => k).sort();
    const inTabs = tabsOf(c).flatMap(([, t]) => t.keys).sort();
    assert.deepEqual(inTabs, keys, name);
    for (const [key] of tabsOf(c)) assert.match(key, /^tab-[0-9a-f-]{36}$/, `${name}: ключ вкладки`);
    const service = tabsOf(c).find(([, t]) => t.display_name === 'Службове');
    assert.ok(service?.[1].keys.includes(FINGERPRINT_FIELD), `${name}: відбиток не у «Службове»`);
  }
  assert.equal(tabsOf(byName.get('seo')).length, 0, 'вкладені блоки — без вкладок');
});

test('ключі полів не збігаються зі службовими ключами Storyblok', () => {
  for (const c of components) for (const [key] of fieldsOf(c)) assert.ok(!['component', '_uid', '_editable'].includes(key), `${c.name}.${key}`);
});

test('генерація детермінована — інакше повторний імпорт оновлював би компоненти', () => {
  assert.deepEqual(buildComponents(), components);
});

test('папка на кожну папку моделі, обмежена рівно типами своїх колекцій', () => {
  const folders = buildFolders();
  assert.deepEqual(folders.map((f) => f.slug).sort(), Object.keys(FOLDERS).sort());
  for (const folder of folders) {
    const expected = Object.values(COLLECTIONS).filter((c) => c.folder === folder.slug).flatMap((c) => c.variants);
    assert.deepEqual(folder.content_types, expected, folder.slug);
    assert.equal(folder.default_root, expected[0]);
    assert.equal(folder.name, FOLDERS[folder.slug]);
  }
});
