import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readContent } from '../scripts/cms/content.mjs';
import { runImport } from '../scripts/cms/sync.mjs';
import { schemas } from '../src/lib/schema.mjs';
import { canonical, fromStory } from '../src/lib/storyblok/convert.mjs';
import { contentDir, fakeClient, publicDir, quietLog, withContentCopy, withFake } from './helpers/cms.js';
import { ministry } from './helpers/probes.js';

const T = { timeout: 60_000 };
const run = (fake, opts = {}) => {
  const out = quietLog();
  return runImport({ client: fakeClient(fake), contentDir, publicDir, log: out.log, ...opts })
    .then((result) => ({ ...result, out }));
};

// Історії у фейку збігаються з файлами. Картинки медіатеки звіряються за
// іменем (сам вміст — у cms-verify.test.js).
function assertSpaceMatches(fake, dir = contentDir) {
  const entries = readContent(dir);
  const assetPath = (a) => (a.is_external_url ? a.filename : `uploads/${a.filename.split('/').pop()}`);
  for (const entry of entries) {
    const story = fake.story(entry.path);
    assert.ok(story, `${entry.path}: історії немає`);
    assert.equal(story.published, true, `${entry.path}: не опубліковано`);
    assert.deepEqual(fromStory(entry.collection, story, { assetPath }), canonical(entry.collection, entry.data), entry.path);
  }
}

const firstMinistry = () => readContent(contentDir).find((e) => e.collection === 'ministries');

test('сухий прогін: план не порожній, у простір — жодного запису', T, async () => {
  await withFake({ seedDemo: true }, async (fake) => {
    const { exitCode, plan, out } = await run(fake);
    assert.equal(exitCode, 0);
    assert.ok(plan.stories.length > 0 && plan.components.length > 0);
    assert.equal(fake.writes(), 0, 'сухий прогін щось записав');
    assert.match(out.text(), /--apply/);
  });
});

test('--apply: компоненти, папки, файли, історії — усе опубліковано, демо-вміст прибрано', T, async () => {
  await withFake({ seedDemo: true }, async (fake) => {
    const { exitCode } = await run(fake, { apply: true });
    assert.equal(exitCode, 0);
    assertSpaceMatches(fake);
    const names = fake.state.components.map((c) => c.name);
    for (const demo of ['page', 'teaser', 'grid', 'feature']) assert.equal(names.includes(demo), false, demo);
    assert.equal(fake.story('home'), undefined, 'демо-історія home лишилась');
    const folder = fake.state.stories.find((s) => s.is_folder && s.slug === 'ministries');
    assert.deepEqual(folder.content.content_types, ['ministry']);
  });
});

test('повторний імпорт без змін у файлах — «0 змін», жодного запису й завантаження', T, async () => {
  // Review Focus 1: фейк, як і Storyblok, дописує свої ключі до компонентів
  // і asset — це не зміна.
  await withFake({ seedDemo: true }, async (fake) => {
    await run(fake, { apply: true });
    const writes = fake.writes();
    const uploads = fake.state.uploads;
    const { plan, out } = await run(fake, { apply: true });
    assert.equal(plan.conflicts.length, 0);
    assert.deepEqual({ ...plan, byPath: undefined, folderIds: undefined, unchanged: undefined },
      { components: [], folders: [], assets: [], stories: [], demo: [], conflicts: [], warnings: [], byPath: undefined, folderIds: undefined, unchanged: undefined });
    assert.equal(fake.writes(), writes);
    assert.equal(fake.state.uploads, uploads, 'той самий файл завантажено вдруге');
    assert.match(out.text(), /0 змін/);
  });
});

test('зміна у файлах — оновлюється лише змінена історія', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    const target = firstMinistry();
    await withContentCopy((c) => {
      const data = c.read('ministries', target.source.replace(/^ministries\/|\.json$/g, ''));
      c.write('ministries', target.source.replace(/^ministries\/|\.json$/g, ''), { ...data, summary: { ...data.summary, en: `${data.summary.en} (edited)` } });
    }, async (dir) => {
      const out = quietLog();
      const { exitCode, plan } = await runImport({ client: fakeClient(fake), contentDir: dir, publicDir, apply: true, log: out.log });
      assert.equal(exitCode, 0);
      assert.deepEqual(plan.stories.map((s) => `${s.action} ${s.entry.path}`), [`update ${target.path}`]);
      assertSpaceMatches(fake, dir);
    });
  });
});

test('історію змінено в Storyblok — імпорт її не перезаписує без --force', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    const target = firstMinistry();
    fake.editStory(target.path, (content) => { content.summary_en = 'Правка редактора'; });
    const refused = await run(fake, { apply: true });
    assert.equal(refused.exitCode, 1);
    assert.deepEqual(refused.plan.conflicts.map((c) => c.entry.path), [target.path]);
    assert.equal(fake.story(target.path).content.summary_en, 'Правка редактора', 'правку редактора стерто');
    assert.match(refused.out.text(), /--force/);

    const forced = await run(fake, { apply: true, force: true });
    assert.equal(forced.exitCode, 0);
    assertSpaceMatches(fake);
  });
});

test('зайва історія в нашій папці — попередження; видаляє лише --prune', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    fake.addStory({ parentSlug: 'ministries', slug: 'stray', content: { component: 'ministry' } });
    const warned = await run(fake, { apply: true });
    assert.equal(warned.exitCode, 0);
    assert.ok(fake.story('ministries/stray'), 'без --prune зайве видалено');
    assert.match(warned.out.text(), /ministries\/stray/);
    await run(fake, { apply: true, prune: true });
    assert.equal(fake.story('ministries/stray'), undefined);
  });
});

test('невалідні дані — жодного запиту в Storyblok узагалі', T, async () => {
  await withFake({}, async (fake) => {
    await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { icon: 'rocket' })), async (dir) => {
      const out = quietLog();
      const { exitCode, errors } = await runImport({ client: fakeClient(fake), contentDir: dir, publicDir, apply: true, log: out.log });
      assert.equal(exitCode, 1);
      assert.ok(errors.some((e) => e.includes('ministries/probe.json')));
      assert.equal(fake.requests(), 0, 'запит пішов попри невалідні дані');
    });
  });
});

test('файл uploads/…, якого немає, — жодного запиту', T, async () => {
  await withFake({}, async (fake) => {
    await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { media: [{ type: 'image', src: 'uploads/nope.jpg', alt: 'Проба' }] })), async (dir) => {
      const { exitCode } = await runImport({ client: fakeClient(fake), contentDir: dir, publicDir, apply: true, log: quietLog().log });
      assert.equal(exitCode, 1);
      assert.equal(fake.requests(), 0);
    });
  });
});

test('ліміт і 429 — повний імпорт усе одно доходить до кінця', T, async () => {
  await withFake({ limit: 20, windowMs: 100 }, async (fake) => {
    const { exitCode } = await run(fake, { apply: true });
    assert.equal(exitCode, 0);
    assert.ok(fake.state.rejected > 0, 'жодного 429 — тест нічого не перевірив');
    assertSpaceMatches(fake);
  });
});

test('обірваний --apply: повторний запуск дописує решту без конфліктів', T, async () => {
  // Review Focus 2: мережа чи 500 посеред імпорту на 3 запити/с — реальність.
  await withFake({ failOnWrite: 60 }, async (fake) => {
    await assert.rejects(run(fake, { apply: true }), /500/);
    const { exitCode, plan } = await run(fake, { apply: true });
    assert.equal(exitCode, 0);
    assert.equal(plan.conflicts.length, 0);
    assertSpaceMatches(fake);
  });
});

test('компонент, змінений в адмінці, повертається до моделі', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    fake.state.components.find((c) => c.name === 'ministry').display_name = 'Хтось перейменував';
    const { plan } = await run(fake, { apply: true });
    assert.deepEqual(plan.components.map((c) => `${c.action} ${c.component.name}`), ['update ministry']);
    assert.equal(fake.state.components.find((c) => c.name === 'ministry').display_name, 'Служіння');
  });
});

test('дані з Storyblok проходять ту саму схему, що й файли', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    for (const entry of readContent(contentDir)) {
      const data = fromStory(entry.collection, fake.story(entry.path), { assetPath: (a) => a.filename });
      const result = schemas[entry.collection].safeParse(data);
      assert.ok(result.success, `${entry.path}: ${JSON.stringify(result.error?.issues)}`);
    }
  });
});
