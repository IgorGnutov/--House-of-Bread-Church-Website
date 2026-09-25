import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetRefs, readContent } from '../scripts/cms/content.mjs';
import { runImport, storyblokName } from '../scripts/cms/sync.mjs';
import { schemas } from '../src/lib/schema.mjs';
import { canonical, fromStory } from '../src/lib/storyblok/convert.mjs';
import { ContentFixture } from './helpers/build.js';
import { contentDir, fakeClient, publicDir, quietLog, withContentCopy, withFake, withPublicProbe } from './helpers/cms.js';
import { ministry } from './helpers/probes.js';

const T = { timeout: 60_000 };
// dir/pub типово — справжній контент; проби передають свою тимчасову копію.
const run = (fake, opts = {}, dir = contentDir, pub = publicDir) => {
  const out = quietLog();
  const client = fakeClient(fake);
  return runImport({ client, contentDir: dir, publicDir: pub, log: out.log, ...opts })
    .then((result) => ({ ...result, out, client }));
};

// Історії у фейку збігаються з файлами. Картинки медіатеки звіряються за
// іменем (сам вміст — у cms-verify.test.js): імʼя в Storyblok → шлях, з
// якого його залито (uploads/… чи uploads/cms/…).
function assertSpaceMatches(fake, dir = contentDir) {
  const entries = readContent(dir);
  const refByName = new Map(assetRefs(entries).map((ref) => [storyblokName(ref), ref]));
  const assetPath = (a) => (a.is_external_url ? a.filename : refByName.get(a.filename.split('/').pop()) ?? a.filename);
  for (const entry of entries) {
    const story = fake.story(entry.path);
    assert.ok(story, `${entry.path}: історії немає`);
    assert.equal(story.published, true, `${entry.path}: не опубліковано`);
    assert.deepEqual(fromStory(entry.collection, story, { assetPath }), canonical(entry.collection, entry.data), entry.path);
  }
}

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

test('демо «page» — тип контенту за замовчуванням: план перемикає простір на «site_page» перед видаленням демо-компонентів', T, async () => {
  // Живий простір, 2026-09-24: MAPI відмовляє видаляти демо-компонент,
  // поки простір досі посилається на нього як на default_root (422).
  await withFake({ seedDemo: true }, async (fake) => {
    const dry = await run(fake);
    assert.match(dry.out.text(), /^~ простір: тип контенту за замовчуванням page → site_page$/m);
    assert.equal(fake.state.defaultRoot, 'page', 'сухий прогін торкнувся простору');

    const { exitCode } = await run(fake, { apply: true });
    assert.equal(exitCode, 0);
    assert.equal(fake.state.defaultRoot, 'site_page');
    const names = fake.state.components.map((c) => c.name);
    for (const demo of ['page', 'teaser', 'grid', 'feature']) assert.equal(names.includes(demo), false, demo);

    const again = await run(fake, { apply: true });
    assert.doesNotMatch(again.out.text(), /простір/, 'рядок про default_root лишився попри те, що він уже наш');
    assert.match(again.out.text(), /0 змін/);
  });
});

test('корінна історія «home» чужого компонента — поза нашими теками, --prune її не чіпає', T, async () => {
  // Рішення 5: демо-вміст — це «home» лише якщо component: page. «home» з
  // будь-яким іншим компонентом — не наша й не демо, її не видно взагалі:
  // ні в попередженнях, ні серед зайвих історій, ні під --prune.
  await withFake({}, async (fake) => {
    fake.addStory({ slug: 'home', content: { component: 'site_page' } });
    const { exitCode, plan } = await run(fake, { apply: true, prune: true });
    assert.equal(exitCode, 0);
    assert.ok(fake.story('home'), 'чужу історію home видалено');
    assert.equal(plan.demo.some((d) => d.name === 'home'), false, 'чужа історія home потрапила в демо-вміст');
    assert.equal(
      plan.stories.some((s) => (s.remote?.full_slug ?? s.entry?.path) === 'home'),
      false,
      'чужа історія home потрапила серед наших історій (оновлення чи видалення)',
    );
    assert.equal(plan.warnings.some((w) => w.includes('«home»')), false, 'чужа історія home згадана в попередженнях');
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
      { space: null, components: [], folders: [], assets: [], stories: [], demo: [], conflicts: [], warnings: [], byPath: undefined, folderIds: undefined, unchanged: undefined });
    assert.equal(fake.writes(), writes);
    assert.equal(fake.state.uploads, uploads, 'той самий файл завантажено вдруге');
    assert.match(out.text(), /0 змін/);
  });
});

test('зміна у файлах — оновлюється лише змінена історія', T, async () => {
  // Проба замість «першого служіння» з реального контенту (CLAUDE.md: тест
  // не мусить залежати від того, що ministries непорожня).
  await withFake({}, async (fake) => {
    await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe')), async (dir) => {
      await run(fake, { apply: true }, dir);
      const target = readContent(dir).find((e) => e.collection === 'ministries' && e.slug === 'probe');
      const fixture = new ContentFixture(dir);
      const data = fixture.read('ministries', 'probe');
      fixture.write('ministries', 'probe', { ...data, summary: { ...data.summary, en: `${data.summary.en} (edited)` } });
      const { exitCode, plan } = await run(fake, { apply: true }, dir);
      assert.equal(exitCode, 0);
      assert.deepEqual(plan.stories.map((s) => `${s.action} ${s.entry.path}`), [`update ${target.path}`]);
      assertSpaceMatches(fake, dir);
    });
  });
});

test('історію змінено в Storyblok — імпорт її не перезаписує без --force', T, async () => {
  // Проба замість «першого служіння» з реального контенту — та сама причина.
  await withFake({}, async (fake) => {
    await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe')), async (dir) => {
      await run(fake, { apply: true }, dir);
      const target = readContent(dir).find((e) => e.collection === 'ministries' && e.slug === 'probe');
      fake.editStory(target.path, (content) => { content.summary_en = 'Правка редактора'; });
      const refused = await run(fake, { apply: true }, dir);
      assert.equal(refused.exitCode, 1);
      assert.deepEqual(refused.plan.conflicts.map((c) => c.entry.path), [target.path]);
      assert.equal(fake.story(target.path).content.summary_en, 'Правка редактора', 'правку редактора стерто');
      assert.match(refused.out.text(), /--force/);

      const forced = await run(fake, { apply: true, force: true }, dir);
      assert.equal(forced.exitCode, 0);
      assertSpaceMatches(fake, dir);
    });
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

test('asset у Storyblok підписаний, але не довантажений у сховище — не блокує імпорт', T, async () => {
  // Review Focus 2: обірваний попередній --apply лишає asset без файлу в
  // сховищі (POST /assets/ пройшов, POST у сховище — ні). Звірка за вмістом
  // не мусить впасти на такому кандидаті — лише не визнати його збігом.
  // Проба з файлом медіатеки: справжній контент може обійтися без жодного
  // uploads/… (усі картинки — зовнішні URL), а assetRefs тоді порожній.
  await withPublicProbe(async (pub) => {
    await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { media: [{ type: 'image', src: 'uploads/probe.png', alt: 'Проба' }] })), async (dir) => {
      await withFake({}, async (fake) => {
        const ref = assetRefs(readContent(dir))[0];
        const name = storyblokName(ref);
        fake.state.assets.push({ id: 999999, filename: `${fake.baseUrl}/f/${fake.spaceId}/999999/${name}` });
        const uploads = fake.state.uploads;
        const { exitCode } = await run(fake, { apply: true }, dir, pub);
        assert.equal(exitCode, 0);
        assert.equal(fake.state.uploads, uploads + assetRefs(readContent(dir)).length, 'файл не завантажено після недовантаженого кандидата');
        assertSpaceMatches(fake, dir);
      });
    });
  });
});

test('картинка, стягнута cms:pull (uploads/cms/…), — імпортується без втрати теки', T, async () => {
  // Після Етапу 5 src/content — знімок cms:pull: нова картинка редактора
  // лежить у uploads/cms/, а не просто в uploads/.
  const src = 'uploads/cms/0123456789ab-probe.png';
  await withPublicProbe(async (pub) => {
    await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { media: [{ type: 'image', src, alt: 'Проба' }] })), async (dir) => {
      await withFake({}, async (fake) => {
        const { exitCode } = await run(fake, { apply: true }, dir, pub);
        assert.equal(exitCode, 0);
        assertSpaceMatches(fake, dir);
      });
    });
  }, src);
});

test('ліміт і 429 — повний імпорт усе одно доходить до кінця', T, async () => {
  // Лічильник запитів (rejectEvery), не часове вікно: під повним прогоном
  // тестів годинник ненадійний (Review Focus, два незалежні прогони бачили
  // «0 змін» — жодного 429).
  await withFake({ rejectEvery: 5 }, async (fake) => {
    const { exitCode, client } = await run(fake, { apply: true });
    assert.equal(exitCode, 0);
    assert.ok(fake.state.rejected > 0, 'жодного 429 — тест нічого не перевірив');
    assert.equal(client.stats.retries, fake.state.rejected);
    assertSpaceMatches(fake);
  });
});

test('обірваний --apply: повторний запуск дописує решту без конфліктів', T, async () => {
  // Review Focus 2: мережа чи 500 посеред імпорту на 3 запити/с — реальність.
  // Номер запису-на-запис, що впаде, рахуємо із сухого прогону на окремому
  // фейку, а не пришпилюємо число (CLAUDE.md): компоненти + папки + два
  // запити на файл (підпис і finish_upload) — усе, що йде до історій, — і
  // ще кілька, щоб влучити посеред списку історій, а не в його край.
  const dryPlan = await withFake({}, (fake) => run(fake, {}).then((r) => r.plan));
  const beforeStories = dryPlan.components.length + dryPlan.folders.length + dryPlan.assets.length * 2;
  const mid = Math.max(1, Math.floor(dryPlan.stories.length / 2));
  const failOnWrite = beforeStories + mid;

  await withFake({ failOnWrite }, async (fake) => {
    await assert.rejects(run(fake, { apply: true }), /500/);
    const entries = readContent(contentDir);
    const written = entries.filter((e) => fake.story(e.path));
    assert.ok(written.length > 0, 'жоден запис не встиг записатися до обриву');
    assert.ok(written.length < entries.length, 'усі записи встигли записатися до обриву — обрив не посеред списку');

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
