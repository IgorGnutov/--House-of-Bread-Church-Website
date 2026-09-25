import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { canonical } from '../src/lib/storyblok/convert.mjs';
import { fetchStories } from '../src/lib/storyblok/delivery.mjs';
import { CMS_UPLOADS, downloadAsset, isStoryblokAsset, localAssetName } from '../scripts/cms/assets.mjs';
import { readContent } from '../scripts/cms/content.mjs';
import { runPull } from '../scripts/cms/snapshot.mjs';
import { diffDirs } from '../scripts/lib/diff-dirs.mjs';
import { projectRoot, withBuild } from './helpers/build.js';
import { contentDir, fakeClient, PROBE_PNG, publicDir, quietLog, seedFake, withContentCopy, withFake } from './helpers/cms.js';
import { distDir } from './helpers/dist.js';
import { ministry } from './helpers/probes.js';

// Тека контенту й копія public/ для одного прогону: справжні src/content і
// public/ тести не чіпають ніколи.
async function withDirs(fn) {
  const content = mkdtempSync(join(tmpdir(), 'hob-pull-content-'));
  const pub = mkdtempSync(join(tmpdir(), 'hob-pull-public-'));
  try {
    cpSync(publicDir, pub, { recursive: true });
    return await fn({ content, pub });
  } finally {
    rmSync(content, { recursive: true, force: true });
    rmSync(pub, { recursive: true, force: true });
  }
}

// Фейк віддає файли медіатеки зі своєї адреси, а не з a.storyblok.com.
const fakeAsset = (fake) => (s) => isStoryblokAsset(s) || s.startsWith(`${fake.baseUrl}/f/`);
const pull = async (fake, dirs, log = quietLog().log) => runPull({
  stories: await fetchStories({ token: fake.publicToken, baseUrl: fake.baseUrl }),
  contentDir: dirs.content, publicDir: dirs.pub, download: (url) => downloadAsset(url), isAsset: fakeAsset(fake), log,
});
const byPath = (entries) => new Map(entries.map((e) => [e.path, canonical(e.collection, e.data)]));
const libraryAsset = async (fake, name) => {
  const { id, filename } = await fakeClient(fake).upload(name, PROBE_PNG, 'image/png');
  return { id, filename, fieldtype: 'asset', is_external_url: false };
};

test('Storyblok → файли: ті самі дані, картинки медіатеки — ті самі файли з public/', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    await withDirs(async (dirs) => {
      assert.equal((await pull(fake, dirs)).exitCode, 0);
      assert.deepEqual(byPath(readContent(dirs.content)), byPath(readContent(contentDir)));
      assert.equal(existsSync(join(dirs.pub, CMS_UPLOADS)), false, 'кожна картинка медіатеки мала збігтися з файлом у public/');
    });
  });
});

test('нова картинка редактора — у uploads/cms, і дані ведуть на неї', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    // Імʼя ASCII: фейк зберігає файл під сирим ключем, а fetch кодує
    // кирилицю в адресі. Кирилицю в імені перевіряє тест localAssetName нижче.
    const asset = await libraryAsset(fake, 'Photo_1.PNG');
    fake.editStory('settings/homepage', (c) => { c.heroImage[0].src = asset; });
    await withDirs(async (dirs) => {
      assert.equal((await pull(fake, dirs)).exitCode, 0);
      const home = readContent(dirs.content).find((e) => e.collection === 'homepage').data;
      assert.match(home.heroImage.src, /^uploads\/cms\/[0-9a-f]{12}-photo-1\.png$/);
      assert.ok(readFileSync(join(dirs.pub, home.heroImage.src)).equals(PROBE_PNG));
    });
  });
});

test('адреса медіатеки, вставлена як «зовнішня», теж стає локальним файлом', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    const asset = await libraryAsset(fake, 'external.png');
    fake.editStory('settings/homepage', (c) => { c.heroImage[0].src = { ...asset, id: null, is_external_url: true }; });
    await withDirs(async (dirs) => {
      assert.equal((await pull(fake, dirs)).exitCode, 0);
      const home = readContent(dirs.content).find((e) => e.collection === 'homepage').data;
      assert.match(home.heroImage.src, /^uploads\/cms\//);
    });
  });
});

test('невалідна опублікована історія: помилка з назвою поля, жоден файл не змінено', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    fake.editStory('settings/site-settings', (c) => { c.name_en = ''; });
    await withDirs(async (dirs) => {
      cpSync(contentDir, dirs.content, { recursive: true });
      const log = quietLog();
      const { exitCode, problems } = await pull(fake, dirs, log.log);
      assert.equal(exitCode, 1);
      assert.ok(problems.some((p) => p.startsWith('settings/site-settings → name.en')), problems.join('\n'));
      assert.deepEqual(diffDirs(contentDir, dirs.content), []);
      assert.match(log.text(), /файли не змінено/);
    });
  });
});

test('знята з публікації історія зникає з файлів, а не лишається з минулого разу', async () => {
  await withContentCopy((fixture) => fixture.write('ministries', 'probe-gone', ministry('probe-gone')), async (dir) => {
    await withFake({}, async (fake) => {
      await seedFake(fake, dir);
      fake.unpublish('ministries/probe-gone');
      await withDirs(async (dirs) => {
        cpSync(dir, dirs.content, { recursive: true });
        assert.equal((await pull(fake, dirs)).exitCode, 0);
        assert.equal(existsSync(join(dirs.content, 'ministries', 'probe-gone.json')), false);
      });
    });
  });
});

test('адреси файлів Storyblok у всіх формах — і лише вони', () => {
  for (const url of [
    'https://a.storyblok.com/f/1/2x3/abc/x.jpg', '//a.storyblok.com/f/1/x.jpg',
    'https://s3.amazonaws.com/a.storyblok.com/f/1/x.jpg', 'https://a-us.storyblok.com/f/1/x.jpg',
  ]) assert.ok(isStoryblokAsset(url), url);
  for (const value of ['https://picsum.photos/1', 'uploads/logo.png', 'https://evil.test/a.storyblok.com/f/1', 42, null]) {
    assert.equal(isStoryblokAsset(value), false, String(value));
  }
});

test('локальне імʼя: детерміноване, безпечне для URL, однакове для // і s3', () => {
  assert.match(localAssetName('https://a.storyblok.com/f/1/800x600/abc/Фото%20Літо.JPG'), /^uploads\/cms\/[0-9a-f]{12}-file\.jpg$/);
  assert.match(localAssetName('https://a.storyblok.com/f/1/x/y/hero-cross.jpg'), /^uploads\/cms\/[0-9a-f]{12}-hero-cross\.jpg$/);
  assert.equal(
    localAssetName('//a.storyblok.com/f/1/x/y/hero-cross.jpg'),
    localAssetName('https://s3.amazonaws.com/a.storyblok.com/f/1/x/y/hero-cross.jpg'),
  );
});

// CLI — асинхронно: execFileSync заблокував би event loop, і фейк у цьому ж
// процесі не відповів би.
const runCli = (args, env) => promisify(execFile)(process.execPath, [join(projectRoot, 'scripts/cms/pull.mjs'), ...args], {
  cwd: projectRoot, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
}).then(() => ({ code: 0, out: '' }), (error) => ({ code: error.code, out: `${error.stdout}${error.stderr}` }));

test('cms:pull без токена: код 1 і назва змінної — жодного тихого фолбеку на файли', async () => {
  await withDirs(async (dirs) => {
    const { code, out } = await runCli(['--out', dirs.content, '--public', dirs.pub], {});
    assert.equal(code, 1);
    assert.match(out, /STORYBLOK_PUBLIC_TOKEN/);
  });
});

test('cms:pull на фейку: записує контент у вказану теку', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    await withDirs(async (dirs) => {
      const { code, out } = await runCli(['--out', dirs.content, '--public', dirs.pub], {
        STORYBLOK_PUBLIC_TOKEN: fake.publicToken, STORYBLOK_DELIVERY_URL: fake.baseUrl,
      });
      assert.equal(code, 0, out);
      assert.ok(existsSync(join(dirs.content, 'singletons', 'homepage.json')));
    });
  });
});

// Критерій спеки: «Astro збирає сайт зі Storyblok; сторінки не відрізняються
// від версії на файлах». dist/ — збірка npm test з src/content.
//
// Збірка з --outDir поза текою проєкту пише серверні чанки в .astro/ і
// копіює всю цю теку у вихід (getOutDirWithinCwd в Astro 5), разом зі
// службовими файлами content layer. Це не сторінки сайту і в dist/ їх
// немає — прибираються рівно вони; будь-який інший зайвий файл тест покаже.
const ASTRO_CACHE_LEAKS = ['collections', 'content-assets.mjs', 'content-modules.mjs'];
test('сайт, зібраний зі Storyblok, побайтово дорівнює зібраному з файлів', { timeout: 300_000 }, async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    await withDirs(async (dirs) => {
      assert.equal((await pull(fake, dirs)).exitCode, 0);
      withBuild((fixture) => {
        rmSync(fixture.dir, { recursive: true, force: true });
        cpSync(dirs.content, fixture.dir, { recursive: true });
      }, ({ failed, output, outDir }) => {
        assert.equal(failed, false, output);
        for (const leak of ASTRO_CACHE_LEAKS) rmSync(join(outDir, leak), { recursive: true, force: true });
        assert.deepEqual(diffDirs(distDir, outDir), []);
      });
    });
  });
});
