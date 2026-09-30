import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { dispatchDeploy } from '../src/preview/dispatch.mjs';
import { handlePublishHook } from '../src/preview/hook.mjs';

const env = { STORYBLOK_WEBHOOK_SECRET: 'whsec', GITHUB_DISPATCH_TOKEN: 'ghp_secret', GITHUB_REPOSITORY: 'owner/repo' };
const sign = (body, secret = 'whsec') => createHmac('sha1', secret).update(body).digest('hex');
const event = (action) => JSON.stringify({ text: 'x', action, space_id: 1, story_id: 2, full_slug: 'ministries/youth' });
function github(status = 204) {
  const calls = [];
  return { calls, fetch: async (url, init) => { calls.push({ url, init }); return new Response(status === 204 ? null : 'Bad credentials', { status }); } };
}

test('публікація з чинним підписом запускає деплой main', async () => {
  const gh = github();
  const body = event('published');
  const res = await handlePublishHook({ body, signature: sign(body), env, fetch: gh.fetch });
  assert.equal(res.status, 202);
  assert.equal(gh.calls.length, 1);
  assert.equal(gh.calls[0].url, 'https://api.github.com/repos/owner/repo/actions/workflows/deploy.yml/dispatches');
  assert.equal(gh.calls[0].init.method, 'POST');
  assert.equal(gh.calls[0].init.headers.Authorization, 'Bearer ghp_secret');
  assert.deepEqual(JSON.parse(gh.calls[0].init.body), { ref: 'main' });
});

test('зняття з публікації, видалення, переміщення — теж перезбірка', async () => {
  for (const action of ['unpublished', 'deleted', 'moved']) {
    const gh = github();
    const body = event(action);
    assert.equal((await handlePublishHook({ body, signature: sign(body), env, fetch: gh.fetch })).status, 202, action);
    assert.equal(gh.calls.length, 1, action);
  }
});

test('без підпису, з чужим секретом чи під інше тіло — 401 і жодного запиту до GitHub', async () => {
  const body = event('published');
  for (const signature of [null, '', sign(body, 'other'), sign(event('deleted'))]) {
    const gh = github();
    assert.equal((await handlePublishHook({ body, signature, env, fetch: gh.fetch })).status, 401, String(signature));
    assert.equal(gh.calls.length, 0);
  }
});

test('інші події — 202 без перезбірки', async () => {
  const gh = github();
  const body = event('entry_saved');
  assert.equal((await handlePublishHook({ body, signature: sign(body), env, fetch: gh.fetch })).status, 202);
  assert.equal(gh.calls.length, 0);
});

test('GitHub відмовив — 502, токена в тексті немає', async () => {
  const body = event('published');
  const res = await handlePublishHook({ body, signature: sign(body), env, fetch: github(401).fetch });
  assert.equal(res.status, 502);
  assert.ok(!(await res.text()).includes('ghp_secret'));
});

test('стенд не налаштовано — 500 з назвами змінних, без значень', async () => {
  const res = await handlePublishHook({ body: '{}', signature: 'x', env: { GITHUB_DISPATCH_TOKEN: 'ghp_secret' }, fetch: github().fetch });
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.match(text, /STORYBLOK_WEBHOOK_SECRET/);
  assert.match(text, /GITHUB_REPOSITORY/);
  assert.ok(!text.includes('ghp_secret'));
});

// Спека 5: той самий запуск деплою викликає і cron прев'ю-воркера.
test('dispatchDeploy: запуск workflow з гілки, змінні перекривають типові', async () => {
  const gh = github();
  assert.deepEqual(await dispatchDeploy(env, gh.fetch), { ok: true });
  assert.deepEqual(JSON.parse(gh.calls[0].init.body), { ref: 'main' });
  assert.equal(gh.calls[0].init.headers.Authorization, 'Bearer ghp_secret');
  const custom = github();
  await dispatchDeploy({ ...env, GITHUB_WORKFLOW: 'other.yml', GITHUB_REF: 'preview' }, custom.fetch);
  assert.equal(custom.calls[0].url, 'https://api.github.com/repos/owner/repo/actions/workflows/other.yml/dispatches');
  assert.deepEqual(JSON.parse(custom.calls[0].init.body), { ref: 'preview' });
});

test('dispatchDeploy: без змінних — жодного запиту; відмова GitHub — помилка без токена', async () => {
  const gh = github();
  const missing = await dispatchDeploy({}, gh.fetch);
  assert.equal(missing.ok, false);
  assert.match(missing.error, /GITHUB_DISPATCH_TOKEN, GITHUB_REPOSITORY/);
  assert.equal(gh.calls.length, 0);
  const refused = await dispatchDeploy(env, github(401).fetch);
  assert.equal(refused.ok, false);
  assert.match(refused.error, /GitHub 401/);
  assert.ok(!refused.error.includes('ghp_secret'));
});
