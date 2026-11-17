import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { schemas } from '../src/lib/schema.mjs';
import { canonical } from '../src/lib/storyblok/convert.mjs';
import { fetchStories } from '../src/lib/storyblok/delivery.mjs';
import { CMS_UPLOADS, downloadAsset, isStoryblokAsset, localAssetName } from '../scripts/cms/assets.mjs';
import { assetRefs, readContent } from '../scripts/cms/content.mjs';
import { runPull } from '../scripts/cms/snapshot.mjs';
import { diffDirs } from '../scripts/lib/diff-dirs.mjs';
import { projectRoot, withBuild } from './helpers/build.js';
import { contentDir, fakeClient, PROBE_PNG, publicDir, quietLog, seedFake, withContentCopy, withFake, withPublicProbe } from './helpers/cms.js';
import { distDir } from './helpers/dist.js';
import { ministry } from './helpers/probes.js';

// Тека контенту й копія public/ для одного прогону: справжні src/content і
// public/ тести не чіпають ніколи. from — інша тека, з якої копіюється public/.
async function withDirs(fn, from = publicDir) {
  const content = mkdtempSync(join(tmpdir(), 'hob-pull-content-'));
  const pub = mkdtempSync(join(tmpdir(), 'hob-pull-public-'));
  try {
    cpSync(from, pub, { recursive: true });
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
// Файли в uploads/cms після pull — рівно ті, на які веде контент: картинка,
// що вже лежить у public/, не стягується вдруге під іншим імʼям.
const cmsRefs = (dir) => [...new Set(assetRefs(readContent(dir)).filter((ref) => ref.startsWith(`${CMS_UPLOADS}/`)))].sort();
const cmsFiles = (pub) => {
  const dir = join(pub, CMS_UPLOADS);
  return existsSync(dir) ? readdirSync(dir).map((name) => `${CMS_UPLOADS}/${name}`).sort() : [];
};
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
      assert.deepEqual(cmsFiles(dirs.pub), cmsRefs(contentDir), 'кожна картинка медіатеки мала збігтися з файлом у public/');
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

test('картинка, вже стягнута в uploads/cms, на повторному pull лишає свій шлях', async () => {
  // src/content після cms:pull посилається на uploads/cms/…; імпорт цього
  // знімка й повторний pull мусять дати ті самі дані, а не нову копію файлу.
  const src = 'uploads/cms/0123456789ab-probe.png';
  await withPublicProbe(async (pub) => {
    await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { media: [{ type: 'image', src, alt: 'Проба' }] })), async (dir) => {
      await withFake({}, async (fake) => {
        await seedFake(fake, dir, pub);
        await withDirs(async (dirs) => {
          assert.equal((await pull(fake, dirs)).exitCode, 0);
          const probe = readContent(dirs.content).find((e) => e.path === 'ministries/probe').data;
          assert.equal(probe.media[0].src, src);
          assert.deepEqual(cmsFiles(dirs.pub), cmsRefs(dir));
          assert.ok(readFileSync(join(dirs.pub, src)).equals(PROBE_PNG));
        }, pub);
      });
    });
  }, src);
});

test('картинка, однакова з картинкою поста Facebook, не веде в uploads/facebook', async () => {
  // Спека 5: uploads/facebook — знімок fb:pull, він зникає з наступним
  // прогоном. Контент зі Storyblok, що вказує туди, став би битим посиланням.
  await withPublicProbe(async (pub) => {
    await withFake({}, async (fake) => {
      await seedFake(fake);
      const asset = await libraryAsset(fake, 'same-as-post.png');
      fake.editStory('settings/homepage', (c) => { c.heroImage[0].src = asset; });
      await withDirs(async (dirs) => {
        assert.equal((await pull(fake, dirs)).exitCode, 0);
        const home = readContent(dirs.content).find((e) => e.collection === 'homepage').data;
        assert.match(home.heroImage.src, /^uploads\/cms\//);
      }, pub);
    });
  }, 'uploads/facebook/1_2.jpg');
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
        // Стрічки Facebook у Storyblok немає: у продакшні її кладе поруч
        // fb:pull (Спека 5), тож і тут — той самий знімок, що бачила dist/.
        if (existsSync(join(contentDir, 'facebook'))) cpSync(join(contentDir, 'facebook'), fixture.path('facebook'), { recursive: true });
      }, ({ failed, output, outDir }) => {
        assert.equal(failed, false, output);
        for (const leak of ASTRO_CACHE_LEAKS) rmSync(join(outDir, leak), { recursive: true, force: true });
        assert.deepEqual(diffDirs(distDir, outDir), []);
      });
    });
  });
});

// Службові для тестів тексту: документ Storyblok з одним абзацом/вузлом.
const docOf = (...nodes) => ({ type: 'doc', content: nodes });
const para = (...inline) => ({ type: 'paragraph', content: inline });
const probeDirs = (fn) => withContentCopy((c) => c.write('ministries', 'probe', ministry('probe')), fn);

test('cms:pull з посиланням на неопубліковану історію записує файли', async () => {
  await probeDirs(async (dir) => {
    await withFake({}, async (fake) => {
      await seedFake(fake, dir);
      const link = { type: 'text', text: 'Колишня', marks: [{ type: 'link', attrs: { linktype: 'story', uuid: 'gone-uuid', href: 'ministries/gone' } }] };
      fake.editStory('ministries/probe', (c) => { c.body_uk = docOf(para(link)); });
      await withDirs(async (dirs) => {
        const log = quietLog();
        assert.equal((await pull(fake, dirs, log.log)).exitCode, 0);
        assert.match(log.text(), /^! ministries\/probe: .*Колишня/m);
        const probe = readContent(dirs.content).find((e) => e.path === 'ministries/probe').data;
        assert.equal(probe.body.uk.content[0].content[0].marks, undefined);
      });
    });
  });
});

test('картинка й файл медіатеки в тексті локалізуються', async () => {
  // Схема приймає в тексті лише https://… (як і справжній Storyblok), тож адреси —
  // a.storyblok.com, а завантаження підміняє заглушка: мережі немає.
  const pic = 'https://a.storyblok.com/f/1/x/pic.jpg';
  const pdf = 'https://a.storyblok.com/f/1/x/doc.pdf';
  const bytes = { [pic]: PROBE_PNG, [pdf]: Buffer.from('%PDF-1.4 probe') };
  await probeDirs(async (dir) => {
    await withFake({}, async (fake) => {
      await seedFake(fake, dir);
      const file = { type: 'text', text: 'Файл', marks: [{ type: 'link', attrs: { linktype: 'asset', href: pdf } }] };
      fake.editStory('ministries/probe', (c) => {
        c.body_uk = docOf({ type: 'image', attrs: { id: 5, src: pic, alt: 'Опис' } }, para(file));
      });
      await withDirs(async (dirs) => {
        const stories = await fetchStories({ token: fake.publicToken, baseUrl: fake.baseUrl });
        const result = await runPull({
          stories, contentDir: dirs.content, publicDir: dirs.pub, download: async (url) => bytes[url], log: quietLog().log,
        });
        assert.equal(result.exitCode, 0, result.problems.join(', '));
        const probe = readContent(dirs.content).find((e) => e.path === 'ministries/probe').data;
        const [image, text] = probe.body.uk.content;
        const href = text.content[0].marks[0].attrs.href;
        assert.match(image.attrs.src, /^uploads\/cms\//);
        assert.match(href, /^uploads\/cms\//);
        assert.ok(existsSync(join(dirs.pub, image.attrs.src)));
        assert.ok(existsSync(join(dirs.pub, href)));
        assert.equal(schemas.ministries.safeParse(probe).success, true);
      });
    });
  });
});

test('картинка в тексті без alt — нічого не записано, поле названо', async () => {
  await probeDirs(async (dir) => {
    await withFake({}, async (fake) => {
      await seedFake(fake, dir);
      const pic = await libraryAsset(fake, 'noalt.png');
      fake.editStory('ministries/probe', (c) => { c.body_uk = docOf({ type: 'image', attrs: { id: pic.id, src: pic.filename } }); });
      await withDirs(async (dirs) => {
        cpSync(dir, dirs.content, { recursive: true });
        const { exitCode, problems } = await pull(fake, dirs);
        assert.equal(exitCode, 1);
        assert.ok(problems.some((p) => /опису/.test(p) && p.includes('body.uk')), problems.join('\n'));
        assert.deepEqual(diffDirs(dir, dirs.content), []);
      });
    });
  });
});
