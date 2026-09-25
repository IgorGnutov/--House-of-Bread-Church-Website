import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { editorAccess } from '../src/preview/access.mjs';
import { deniedPage, problemsPage } from '../src/preview/pages.mjs';
import { storyRedirect } from '../src/preview/routes.mjs';

const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const NOW = Date.UTC(2026, 8, 25, 12);
const SECONDS = Math.floor(NOW / 1000);
const opts = { spaceId: '1', previewToken: 'prev', now: NOW };
// Адреса, з якою Visual Editor відкриває сторінку в iframe.
function tkUrl(path, { space = '1', ts = SECONDS, token } = {}) {
  const url = new URL(`https://preview.test${path}`);
  url.searchParams.set('_storyblok', '42');
  url.searchParams.set('_storyblok_tk[space_id]', space);
  url.searchParams.set('_storyblok_tk[timestamp]', String(ts));
  url.searchParams.set('_storyblok_tk[token]', token ?? sha1(`${space}:prev:${ts}`));
  return url;
}

test('чинний токен редактора → доступ і cookie сесії для iframe', async () => {
  const access = await editorAccess({ url: tkUrl('/'), ...opts });
  assert.equal(access.ok, true);
  assert.match(access.setCookie, /^hob_editor=\d+\.[0-9a-f]{64}; Path=\/; Max-Age=3600; HttpOnly; Secure; SameSite=None; Partitioned$/);
});

test('без токена, з чужим простором, простроченим чи підробленим — відмова', async () => {
  for (const url of [
    new URL('https://preview.test/'), tkUrl('/', { space: '2' }),
    tkUrl('/', { ts: SECONDS - 7200 }), tkUrl('/', { token: 'f'.repeat(40) }),
  ]) assert.equal((await editorAccess({ url, ...opts })).ok, false, url.search);
});

test('сесія: чинна cookie пускає; прострочена чи з іншим ключем — ні', async () => {
  const { setCookie } = await editorAccess({ url: tkUrl('/'), ...opts });
  const cookie = setCookie.split(';')[0];
  const plain = new URL('https://preview.test/ministries/');
  assert.equal((await editorAccess({ url: plain, cookieHeader: `a=1; ${cookie}`, ...opts })).ok, true);
  assert.equal((await editorAccess({ url: plain, cookieHeader: cookie, ...opts, now: NOW + 3601_000 })).ok, false);
  assert.equal((await editorAccess({ url: plain, cookieHeader: cookie, ...opts, previewToken: 'other' })).ok, false);
  assert.equal((await editorAccess({ url: plain, cookieHeader: 'hob_editor=garbage', ...opts })).ok, false);
});

test('без налаштованого токена прев\'ю — відмова навіть з «чинними» параметрами', async () => {
  assert.equal((await editorAccess({ url: tkUrl('/'), spaceId: '1', previewToken: '', now: NOW })).ok, false);
});

test('адреса історії з Visual Editor → сторінка сайту, query зберігається', () => {
  const cases = [
    ['/pages/about', '/about/'], ['/pages/about/', '/about/'], ['/en/pages/leaders', '/en/leaders/'],
    ['/settings/homepage', '/'], ['/en/settings/site-settings', '/en/'],
    ['/testimonies/anna', '/testimonies/'], ['/pastors/ivan', '/pastors/'], ['/leader-resources/guide', '/leaders/'],
    ['/ministries/youth', '/ministries/youth/'], ['/en', '/en/'], ['/pages/unknown', '/pages/unknown/'],
    ['/', null], ['/en/', null], ['/ministries/youth/', null], ['/about/', null], ['/_astro/x.css', null], ['/fonts/a.woff2', null],
  ];
  for (const [path, want] of cases) assert.equal(storyRedirect(new URL(`https://p.test${path}`), '/'), want, path);
  assert.equal(storyRedirect(new URL('https://p.test/pages/about?_storyblok=1'), '/'), '/about/?_storyblok=1');
  assert.equal(storyRedirect(new URL('https://p.test/sub/pages/about'), '/sub/'), '/sub/about/');
});

test('службові сторінки: noindex, текст екрановано', () => {
  assert.match(deniedPage(), /<meta name="robots" content="noindex">/);
  const html = problemsPage(['settings/site-settings → name.en: <b>порожньо</b>']);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /&lt;b&gt;порожньо&lt;\/b&gt;/);
});
