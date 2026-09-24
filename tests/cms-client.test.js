import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientFromEnv, createClient, REGIONS } from '../scripts/cms/client.mjs';
import { fakeClient, withFake } from './helpers/cms.js';

test('токен іде в Authorization як є, без Bearer', async () => {
  await withFake({}, async (fake) => {
    const { components } = await fakeClient(fake).get('/components');
    assert.deepEqual(components, []);
    await assert.rejects(fakeClient(fake, { token: `Bearer ${fake.token}` }).get('/components'), /401/);
  });
});

test('черга тримає ліміт: не частіше rps запитів на секунду', async () => {
  await withFake({}, async (fake) => {
    const client = fakeClient(fake, { rps: 10 });
    const started = Date.now();
    for (let i = 0; i < 6; i++) await client.get('/components');
    assert.ok(Date.now() - started >= 450, `6 запитів при 10/с за ${Date.now() - started} мс`);
  });
});

test('429 повторюється з паузою, і запит зрештою проходить', async () => {
  // Лічильник запитів (rejectEvery), а не часове вікно: під повним прогоном
  // тестів годинник ненадійний, а тут саме 429 і його обробку й перевіряємо.
  await withFake({ rejectEvery: 2 }, async (fake) => {
    const client = fakeClient(fake, { backoffMs: 40 });
    for (let i = 0; i < 6; i++) await client.get('/components');
    assert.ok(fake.state.rejected > 0, 'фейк жодного разу не відповів 429 — тест нічого не перевірив');
    assert.equal(client.stats.retries, fake.state.rejected);
  });
});

test('вичерпані повтори — помилка з кодом, без токена в тексті', async () => {
  await withFake({ limit: 0 }, async (fake) => {
    const client = fakeClient(fake, { retries: 2, backoffMs: 1 });
    const error = await client.get('/components').catch((e) => e);
    assert.match(error.message, /429/);
    assert.doesNotMatch(error.message, new RegExp(fake.token));
  });
});

test('all() збирає всі сторінки', async () => {
  await withFake({}, async (fake) => {
    for (let i = 0; i < 150; i++) fake.addStory({ slug: `s-${i}`, content: { component: 'x' } });
    const stories = await fakeClient(fake).all('/stories', 'stories');
    assert.equal(stories.length, 150);
    assert.equal(new Set(stories.map((s) => s.id)).size, 150);
  });
});

test('завантаження в медіатеку: підписаний запит → сховище → finish_upload', async () => {
  await withFake({}, async (fake) => {
    const client = fakeClient(fake);
    const bytes = Buffer.from([1, 2, 3, 250]);
    const asset = await client.upload('logo.v2.png', bytes, 'image/png');
    assert.ok(asset.id);
    assert.match(asset.filename, /logo_v2\.png$/, 'імʼя параметризоване, як у Storyblok');
    assert.deepEqual(await client.download(asset.filename), bytes);
  });
});

test('clientFromEnv: бракує змінної — повідомлення з її назвою, без токена', () => {
  // Review Focus 5.
  assert.throws(() => clientFromEnv({}), /STORYBLOK_MANAGEMENT_TOKEN/);
  assert.throws(() => clientFromEnv({ STORYBLOK_MANAGEMENT_TOKEN: 'secret-x' }), (e) => /STORYBLOK_SPACE_ID/.test(e.message) && !/secret-x/.test(e.message));
  assert.throws(() => clientFromEnv({ STORYBLOK_MANAGEMENT_TOKEN: 't', STORYBLOK_SPACE_ID: '1', STORYBLOK_REGION: 'mars' }), /mars/);
  assert.equal(REGIONS.eu, 'https://mapi.storyblok.com');
  assert.ok(clientFromEnv({ STORYBLOK_MANAGEMENT_TOKEN: 't', STORYBLOK_SPACE_ID: '1', STORYBLOK_REGION: 'EU' }));
  assert.ok(clientFromEnv({ STORYBLOK_MANAGEMENT_TOKEN: 't', STORYBLOK_SPACE_ID: '1' }), 'регіон типово EU');
});

test('createClient без обовʼязкових параметрів — помилка одразу, а не на першому запиті', () => {
  assert.throws(() => createClient({ spaceId: '1', baseUrl: 'http://x' }), /token/);
});
