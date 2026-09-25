import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { parse } from 'node-html-parser';
import { projectRoot } from './helpers/build.js';
import { seedFake, withContentCopy } from './helpers/cms.js';
import { startFakeStoryblok } from './helpers/fake-storyblok.js';
import { htmlFiles } from './helpers/links.js';
import { ministry, person } from './helpers/probes.js';

// Прев'ю-стенд наживо: astro dev у режимі HOB_PREVIEW проти фейкового
// Storyblok. Адаптер Cloudflare у dev не потрібен (platformProxy вимкнено),
// а middleware, маршрути й шаблони — ті самі, що у воркері.
const ASTRO = join(projectRoot, 'node_modules/astro/astro.js');
const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const freePort = () => new Promise((resolve) => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

async function startDev(env) {
  const port = await freePort();
  const child = spawn(process.execPath, [ASTRO, 'dev', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: projectRoot, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 240; i++) {
    try {
      await fetch(`${origin}/robots-probe.txt`);
      return { origin, stop: () => child.kill('SIGKILL') };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  child.kill('SIGKILL');
  throw new Error(`astro dev не піднявся:\n${output}`);
}

let fake;
let dev;
const PREVIEW_ENV = () => ({
  HOB_PREVIEW: 'true', BASE_PATH: '/', SITE_URL: 'https://preview.test', SITE_NOINDEX: '',
  STORYBLOK_PREVIEW_TOKEN: fake.previewToken, STORYBLOK_SPACE_ID: fake.spaceId, STORYBLOK_DELIVERY_URL: fake.baseUrl,
  STORYBLOK_WEBHOOK_SECRET: 'whsec', GITHUB_DISPATCH_TOKEN: 'ghp_test', GITHUB_REPOSITORY: 'owner/repo',
});

before(async () => {
  fake = await startFakeStoryblok();
  // Проби: детальна сторінка й картка пастора є завжди, незалежно від
  // справжніх даних (колекції можуть бути порожні).
  await withContentCopy((fixture) => {
    fixture.write('ministries', 'probe-editable', ministry('probe-editable'));
    fixture.write('pastors', 'probe-editable', person('probe-editable', 'pastor'));
  }, (dir) => seedFake(fake, dir));
  dev = await startDev(PREVIEW_ENV());
}, { timeout: 180_000 });

after(async () => {
  dev?.stop();
  await fake?.close();
});

function editorUrl(path) {
  const ts = Math.floor(Date.now() / 1000);
  const url = new URL(path, dev.origin);
  url.searchParams.set('_storyblok', '1');
  url.searchParams.set('_storyblok_tk[space_id]', fake.spaceId);
  url.searchParams.set('_storyblok_tk[timestamp]', String(ts));
  url.searchParams.set('_storyblok_tk[token]', sha1(`${fake.spaceId}:${fake.previewToken}:${ts}`));
  return url;
}
const get = (url, headers = {}) => fetch(url, { headers, redirect: 'manual' });
const session = async () => (await get(editorUrl('/'))).headers.get('set-cookie').split(';')[0];
const SETTINGS = 'settings/site-settings';

test('без доступу редактора — 403, noindex і жодного запиту за чернеткою', async () => {
  const requests = fake.state.cdnRequests;
  const res = await get(`${dev.origin}/`);
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(fake.state.cdnRequests, requests);
});

test('редактор бачить неопубліковану чернетку; стенд закритий від індексації', async () => {
  fake.editStory(SETTINGS, (c) => { c.name_uk = 'Назва з чернетки'; }, { publish: false });
  const res = await get(editorUrl('/'));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Назва з чернетки/);
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('set-cookie') ?? '', /^hob_editor=.*SameSite=None; Partitioned$/);
});

test('сесія з cookie: перехід усередині iframe без параметрів Storyblok', async () => {
  const res = await get(`${dev.origin}/ministries/`, { cookie: await session() });
  assert.equal(res.status, 200);
});

test('невідомий префікс мови, неіснуючий запис, вимкнена сторінка — 404', async () => {
  const cookie = await session();
  for (const path of ['/foo/ministries/', '/ministries/no-such-ministry/']) {
    assert.equal((await get(`${dev.origin}${path}`, { cookie })).status, 404, path);
  }
  const about = fake.story('pages/about').content;
  const original = { uk: about.body_uk, en: about.body_en };
  fake.editStory('pages/about', (c) => { c.body_uk = ''; c.body_en = ''; }, { publish: false });
  try {
    assert.equal((await get(`${dev.origin}/about/`, { cookie })).status, 404);
  } finally {
    fake.editStory('pages/about', (c) => { c.body_uk = original.uk; c.body_en = original.en; }, { publish: false });
  }
});

test('адреса історії з Visual Editor веде на сторінку сайту', async () => {
  const res = await get(editorUrl('/pages/leaders'));
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /^\/leaders\/\?_storyblok=1&/);
});

test('чернетка, яка не пройде публікацію, — 500 з переліком полів', async () => {
  const original = fake.story(SETTINGS).content.name_en;
  fake.editStory(SETTINGS, (c) => { c.name_en = ''; }, { publish: false });
  try {
    const res = await get(editorUrl('/'));
    assert.equal(res.status, 500);
    assert.match(await res.text(), /settings\/site-settings → name\.en/);
  } finally {
    fake.editStory(SETTINGS, (c) => { c.name_en = original; }, { publish: false });
  }
});

test('збірка прев\'ю: воркер Cloudflare і жодної статичної сторінки', { timeout: 300_000 }, () => {
  const outDir = mkdtempSync(join(tmpdir(), 'hob-preview-dist-'));
  try {
    execFileSync(process.execPath, [ASTRO, 'build', '--outDir', outDir], {
      cwd: projectRoot, env: { ...process.env, ...PREVIEW_ENV() }, stdio: 'pipe', timeout: 280_000, killSignal: 'SIGKILL',
    });
    const worker = join(outDir, '_worker.js');
    assert.ok(existsSync(worker), 'немає _worker.js');
    assert.deepEqual(htmlFiles(outDir), []);
    // Стенд — Cloudflare Worker зі статичними файлами (*.pages.dev блокують
    // DNS частини провайдерів, *.workers.dev — ні). Серверний код лежить у
    // теці виходу, тож wrangler не мусить викласти його як публічний файл.
    assert.match(readFileSync(join(outDir, '.assetsignore'), 'utf8'), /^_worker\.js$/m);
    const wrangler = JSON.parse(readFileSync(join(projectRoot, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
    assert.equal(wrangler.main, './dist/_worker.js/index.js');
    assert.ok(existsSync(join(outDir, '_worker.js', 'index.js')), 'немає _worker.js/index.js — main у wrangler.jsonc хибний');
    assert.deepEqual(wrangler.assets, { binding: 'ASSETS', directory: './dist' });
    assert.ok(wrangler.compatibility_flags.includes('nodejs_compat'));
    // Інакше кожен wrangler deploy стирав би змінні, задані в панелі Cloudflare.
    assert.equal(wrangler.keep_vars, true);
    // Workers Free приймає воркер до 3 МБ у стисненому вигляді (рішення 20).
    const walk = (dir) => readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
    const files = statSync(worker).isDirectory() ? walk(worker) : [worker];
    const gzipped = files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);
    assert.ok(gzipped < 3 * 1024 * 1024, `воркер ${Math.round(gzipped / 1024)} КБ у стисненому вигляді — більше ліміту Workers Free`);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

const uidOf = (story, blok = story.content) => `${story.id}-${blok._uid}`;

test('Visual Editor: секція головної несе _editable свого блоку, Bridge підключено', async () => {
  const root = parse(await (await get(editorUrl('/'))).text());
  const home = fake.story('settings/homepage');
  assert.equal(root.querySelector('section.hero').getAttribute('data-blok-uid'), uidOf(home, home.content.hero[0]));
  assert.equal(root.querySelector('footer.site-footer').getAttribute('data-blok-uid'), uidOf(home, home.content.footer[0]));
  assert.ok(root.querySelector('script[src="https://app.storyblok.com/f/storyblok-v2-latest.js"]'));
});

test('детальна сторінка — корінь запису; сторінка зі списком — page-hero', async () => {
  const cookie = await session();
  const detail = parse(await (await get(`${dev.origin}/ministries/probe-editable/`, { cookie })).text());
  assert.equal(detail.querySelector('.detail-top').getAttribute('data-blok-uid'), uidOf(fake.story('ministries/probe-editable')));
  const list = parse(await (await get(`${dev.origin}/ministries/`, { cookie })).text());
  assert.equal(list.querySelector('.page-hero').getAttribute('data-blok-uid'), uidOf(fake.story('pages/ministries')));
});

test('картка пастора розмічена його історією (власної сторінки немає)', async () => {
  const root = parse(await (await get(`${dev.origin}/pastors/`, { cookie: await session() })).text());
  const uid = uidOf(fake.story('pastors/probe-editable'));
  assert.ok(root.querySelectorAll('[data-blok-uid]').some((el) => el.getAttribute('data-blok-uid') === uid));
});

test('вебхук не потребує доступу редактора, але без підпису — 401', async () => {
  const res = await fetch(`${dev.origin}/api/storyblok-publish`, { method: 'POST', body: '{"action":"published"}', redirect: 'manual' });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
});
