import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FB_UPLOADS } from '../scripts/facebook/feed.mjs';
import { projectRoot } from './helpers/build.js';
import {
  IMAGE_BYTES, PAGE_ID, TOKEN, albumPost, photoPost, sharePost, startFakeFacebook, textPost, videoPost,
} from './helpers/fake-facebook.js';

// npm run fb:pull проти фейкового Graph API (Спека 5): справжній CLI у
// дочірньому процесі — так видно і код виходу, і все, що потрапило б у лог CI.
const PULL = join(projectRoot, 'scripts/facebook/pull.mjs');
let fake;
before(async () => { fake = await startFakeFacebook(); });
after(async () => { await fake?.close(); });

function run(dirs, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [PULL, '--out', dirs.content, '--public', dirs.pub], {
      cwd: projectRoot,
      env: {
        ...process.env, FACEBOOK_PAGE_ID: PAGE_ID, FACEBOOK_PAGE_TOKEN: TOKEN, FACEBOOK_GRAPH_URL: fake.origin, ...env,
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      // Токен не сміє зʼявитися у виводі за жодного сценарію.
      assert.ok(!stdout.includes(TOKEN) && !stderr.includes(TOKEN), `токен у виводі:\n${stdout}\n${stderr}`);
      resolve({ code, stdout, stderr });
    });
  });
}

async function withDirs(fn) {
  const root = mkdtempSync(join(tmpdir(), 'hob-fb-'));
  const dirs = { content: join(root, 'content'), pub: join(root, 'public') };
  mkdirSync(dirs.content);
  mkdirSync(dirs.pub);
  try {
    return await fn(dirs);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const records = (dirs) => {
  const dir = join(dirs.content, 'facebook');
  return existsSync(dir) ? Object.fromEntries(readdirSync(dir).map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))])) : {};
};
const images = (dirs) => {
  const dir = join(dirs.pub, ...FB_UPLOADS.split('/'));
  return existsSync(dir) ? readdirSync(dir).sort() : [];
};
const id = (n) => `${PAGE_ID}_${n}`;
const image = (n, width, height) => ({ src: `${FB_UPLOADS}/${id(n)}.jpg`, width, height });

test('відео, альбом, репост, фото й текст без медіа → записи й картинки, код 0', async () => {
  fake.fail = null;
  fake.posts = [videoPost(fake, 1), albumPost(fake, 2), sharePost(fake, 3), photoPost(fake, 4), textPost(5)];
  await withDirs(async (dirs) => {
    const { code, stdout } = await run(dirs);
    assert.equal(code, 0, stdout);
    const got = records(dirs);
    assert.deepEqual(Object.keys(got).sort(), [1, 2, 3, 4, 5].map((n) => `${id(n)}.json`));
    const raw = fake.posts[0];
    assert.deepEqual(got[`${id(1)}.json`], {
      id: id(1), date: raw.created_time, url: raw.permalink_url, text: raw.message, video: true, image: image(1, 720, 1280),
    });
    // Альбом: розміри першої підкартинки.
    assert.deepEqual(got[`${id(2)}.json`].image, image(2, 1200, 900));
    assert.equal(got[`${id(2)}.json`].video, false);
    assert.deepEqual(got[`${id(3)}.json`].image, image(3, 600, 600));
    assert.deepEqual(got[`${id(4)}.json`].image, image(4, 1600, 900));
    assert.deepEqual(got[`${id(5)}.json`], { ...got[`${id(5)}.json`], image: null, video: false });
    assert.deepEqual(images(dirs), [1, 2, 3, 4].map((n) => `${id(n)}.jpg`));
    assert.ok(readFileSync(join(dirs.pub, image(1).src)).equals(IMAGE_BYTES));
  });
});

test('пост без тексту — порожній text, а не пропуск запису', async () => {
  fake.fail = null;
  const { message, ...silent } = textPost(6);
  fake.posts = [silent];
  await withDirs(async (dirs) => {
    assert.equal((await run(dirs)).code, 0);
    assert.equal(records(dirs)[`${id(6)}.json`].text, '');
  });
});

test('новий прогін прибирає застарілі пости й картинки', async () => {
  fake.fail = null;
  await withDirs(async (dirs) => {
    fake.posts = [photoPost(fake, 1), photoPost(fake, 2)];
    assert.equal((await run(dirs)).code, 0);
    fake.posts = [photoPost(fake, 3)];
    assert.equal((await run(dirs)).code, 0);
    assert.deepEqual(Object.keys(records(dirs)), [`${id(3)}.json`]);
    assert.deepEqual(images(dirs), [`${id(3)}.jpg`]);
  });
});

test('помилка API → код 1, старий знімок і картинки не змінено', async () => {
  await withDirs(async (dirs) => {
    fake.fail = null;
    fake.posts = [photoPost(fake, 1)];
    assert.equal((await run(dirs)).code, 0);
    const before = { records: records(dirs), images: images(dirs) };
    for (const [why, setup, env] of [
      ['500 Graph API', () => { fake.fail = { status: 500 }; }, {}],
      ['хибний токен', () => { fake.fail = null; }, { FACEBOOK_PAGE_TOKEN: `${TOKEN}x` }],
      ['мережа', () => { fake.fail = null; }, { FACEBOOK_GRAPH_URL: 'http://127.0.0.1:9' }],
    ]) {
      setup();
      const { code, stderr } = await run(dirs, env);
      assert.equal(code, 1, why);
      assert.match(stderr, /✗/, why);
      assert.deepEqual({ records: records(dirs), images: images(dirs) }, before, why);
    }
    fake.fail = null;
  });
});

test('без токена чи id сторінки — код 1 з назвою змінної', async () => {
  await withDirs(async (dirs) => {
    for (const name of ['FACEBOOK_PAGE_TOKEN', 'FACEBOOK_PAGE_ID']) {
      const { code, stderr } = await run(dirs, { [name]: '' });
      assert.equal(code, 1, name);
      assert.match(stderr, new RegExp(name));
    }
    assert.deepEqual(records(dirs), {});
  });
});

test('картинка не завантажилась → у поста image: null, код 0, рядок у лозі', async () => {
  fake.fail = null;
  fake.posts = [photoPost(fake, 1), photoPost(fake, 2)];
  fake.missing = new Set([`${2}.jpg`]);
  try {
    await withDirs(async (dirs) => {
      const { code, stdout } = await run(dirs);
      assert.equal(code, 0);
      assert.equal(records(dirs)[`${id(2)}.json`].image, null);
      assert.deepEqual(records(dirs)[`${id(1)}.json`].image, image(1, 1600, 900));
      assert.deepEqual(images(dirs), [`${id(1)}.jpg`]);
      assert.match(stdout, new RegExp(`${id(2)}: картинку не завантажено`));
    });
  } finally {
    fake.missing = new Set();
  }
});

test('невалідні пости відкинуто, решта записана, код 2', async () => {
  fake.fail = null;
  const { permalink_url: _, ...noUrl } = photoPost(fake, 2);
  fake.posts = [photoPost(fake, 1), noUrl, { ...photoPost(fake, 3), id: '../../evil' }, photoPost(fake, 1)];
  await withDirs(async (dirs) => {
    const { code, stdout } = await run(dirs);
    assert.equal(code, 2, stdout);
    assert.deepEqual(Object.keys(records(dirs)), [`${id(1)}.json`]);
    assert.deepEqual(images(dirs), [`${id(1)}.jpg`]);
    assert.match(stdout, new RegExp(`${id(2)} відкинуто: url`));
    assert.match(stdout, /id повторюється/);
    assert.ok(!existsSync(join(dirs.pub, 'evil.jpg')) && !existsSync(join(dirs.content, '..', 'evil.jpg')));
  });
});

test('залишки перерваного прогону не потрапляють у знімок', async () => {
  fake.fail = null;
  fake.posts = [photoPost(fake, 1)];
  await withDirs(async (dirs) => {
    mkdirSync(join(dirs.content, 'facebook.new'), { recursive: true });
    writeFileSync(join(dirs.content, 'facebook.new', 'stale.json'), '{}');
    mkdirSync(join(dirs.pub, 'uploads', 'facebook.new'), { recursive: true });
    writeFileSync(join(dirs.pub, 'uploads', 'facebook.new', 'stale.jpg'), 'x');
    assert.equal((await run(dirs)).code, 0);
    assert.deepEqual(Object.keys(records(dirs)), [`${id(1)}.json`]);
    assert.deepEqual(images(dirs), [`${id(1)}.jpg`]);
    assert.equal(existsSync(join(dirs.content, 'facebook.new')), false);
    assert.equal(existsSync(join(dirs.pub, 'uploads', 'facebook.new')), false);
  });
});

test('нуль постів — порожній знімок, код 0', async () => {
  fake.fail = null;
  fake.posts = [];
  await withDirs(async (dirs) => {
    assert.equal((await run(dirs)).code, 0);
    assert.deepEqual(records(dirs), {});
  });
});
