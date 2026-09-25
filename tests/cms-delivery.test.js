import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DELIVERY_REGIONS, deliveryUrl, fetchStories } from '../src/lib/storyblok/delivery.mjs';
import { readContent } from '../scripts/cms/content.mjs';
import { contentDir, seedFake, withFake } from './helpers/cms.js';

// Content Delivery API — те, що читатиме кожна збірка (cms:pull) і прев'ю.
// Одиночка site-settings є завжди (її читають шаблони), тож проби правлять її.
const SETTINGS = 'settings/site-settings';
const published = (fake) => fetchStories({ token: fake.publicToken, baseUrl: fake.baseUrl, backoffMs: 1 });
const draft = (fake) => fetchStories({ token: fake.previewToken, baseUrl: fake.baseUrl, version: 'draft', backoffMs: 1 });
const find = (stories, fullSlug) => stories.find((s) => s.full_slug === fullSlug);

test('опублікована версія: по історії на кожен запис файлів, без папок', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    const stories = await published(fake);
    assert.deepEqual(stories.map((s) => s.full_slug).sort(), readContent(contentDir).map((e) => e.path).sort());
  });
});

test('правка без «Опублікувати» є в чернетці, але не в опублікованій версії', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    fake.editStory(SETTINGS, (c) => { c.name_uk = 'Чернетка'; }, { publish: false });
    assert.notEqual(find(await published(fake), SETTINGS).content.name_uk, 'Чернетка');
    assert.equal(find(await draft(fake), SETTINGS).content.name_uk, 'Чернетка');
  });
});

test('після публікації наступне читання бачить правку (cv обходить кеш CDN)', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    await published(fake); // кеш CDN прогрітий старим знімком
    fake.editStory(SETTINGS, (c) => { c.name_uk = 'Нова назва'; });
    assert.equal(find(await published(fake), SETTINGS).content.name_uk, 'Нова назва');
  });
});

test('знята з публікації історія зникає з опублікованої версії', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    fake.unpublish(SETTINGS);
    assert.equal(find(await published(fake), SETTINGS), undefined);
  });
});

test('чернетка з публічним токеном — 401, токен не потрапляє в повідомлення', async () => {
  await withFake({}, async (fake) => {
    await assert.rejects(
      fetchStories({ token: fake.publicToken, baseUrl: fake.baseUrl, version: 'draft' }),
      (error) => {
        assert.match(error.message, /401/);
        assert.ok(!error.message.includes(fake.publicToken));
        return true;
      },
    );
  });
});

test('понад сотню історій — читаються всі сторінки', async () => {
  await withFake({}, async (fake) => {
    for (let i = 0; i < 130; i++) fake.addStory({ parentSlug: '', slug: `extra-${i}`, content: { component: 'x', _uid: `u${i}` } });
    assert.equal((await published(fake)).length, 130);
  });
});

test('429 від CDN повторюється з паузою', async () => {
  await withFake({ cdnRejectEvery: 2 }, async (fake) => {
    await seedFake(fake);
    const stories = await published(fake);
    assert.ok(fake.state.rejected > 0);
    assert.equal(stories.length, readContent(contentDir).length);
  });
});

test('чернетка несе _editable на кожному блоці, опублікована — ні', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    for (const s of await draft(fake)) {
      assert.match(s.content._editable, new RegExp(`^<!--#storyblok#\\{.*"id":"${s.id}".*\\}-->$`), s.full_slug);
    }
    assert.doesNotMatch(JSON.stringify(await published(fake)), /_editable/);
  });
});

test('регіон: eu за замовчуванням, адреса тестів має перевагу, невідомий — з переліком', () => {
  assert.equal(deliveryUrl({}), DELIVERY_REGIONS.eu);
  assert.equal(deliveryUrl({ STORYBLOK_REGION: ' US ' }), DELIVERY_REGIONS.us);
  assert.equal(deliveryUrl({ STORYBLOK_DELIVERY_URL: 'http://127.0.0.1:1', STORYBLOK_REGION: 'us' }), 'http://127.0.0.1:1');
  assert.throws(() => deliveryUrl({ STORYBLOK_REGION: 'mars' }), /«mars».*eu, us/);
});
