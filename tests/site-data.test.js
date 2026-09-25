import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { notFound, pageLang } from '../src/lib/routing.mjs';
import { makeSite } from '../src/lib/site.mjs';
import { projectRoot } from './helpers/build.js';

const e = (collection, slug, data) => ({ collection, slug, data });

test('list: за order, потім slug; порожня колекція — []', () => {
  const store = makeSite([
    e('ministries', 'b', { slug: 'b', order: 1 }), e('ministries', 'a', { slug: 'a', order: 1 }), e('ministries', 'c', { slug: 'c', order: 0 }),
  ]);
  assert.deepEqual(store.list('ministries').map((x) => x.slug), ['c', 'a', 'b']);
  assert.deepEqual(store.list('churches'), []);
});

test('one і page: відсутній запис — помилка з назвою, а не undefined у шаблоні', () => {
  const store = makeSite([e('homepage', 'homepage', { x: 1 }), e('pages', 'about', { body: null })]);
  assert.deepEqual(store.one('homepage'), { x: 1 });
  assert.deepEqual(store.page('about'), { body: null });
  assert.throws(() => store.one('contact-info'), /contact-info/);
  assert.throws(() => store.page('leaders'), /leaders/);
});

test('list на одиночці і one на колекції — помилка', () => {
  assert.throws(() => makeSite([]).list('homepage'), /homepage/);
  assert.throws(() => makeSite([]).one('ministries'), /ministries/);
});

test('edit: поза прев\'ю — {}; на прев\'ю — атрибути за шляхом історії й полем', () => {
  const attrs = { 'data-blok-uid': '1-u' };
  const store = makeSite([], new Map([['settings/homepage#hero', attrs], ['ministries/youth#', attrs], ['pages/about#', attrs]]));
  assert.deepEqual(store.edit('homepage', null, 'hero'), attrs);
  assert.deepEqual(store.edit('ministries', 'youth'), attrs);
  assert.deepEqual(store.edit('pages', 'about'), attrs);
  assert.deepEqual(store.edit('ministries', 'other'), {});
  assert.deepEqual(makeSite([]).edit('ministries', 'youth'), {});
});

test('pageLang: props статичної збірки, параметр адреси серверного режиму, невідомий префікс — null', () => {
  assert.equal(pageLang({ props: { lang: 'en' }, params: {} }), 'en');
  assert.equal(pageLang({ props: {}, params: {} }), 'uk');
  assert.equal(pageLang({ props: {}, params: { lang: 'en' } }), 'en');
  assert.equal(pageLang({ props: {}, params: { lang: 'foo' } }), null);
  assert.equal(notFound().status, 404);
});

const sources = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const abs = join(dir, entry.name);
  if (entry.isDirectory()) return sources(abs);
  return /\.(astro|ts|mjs|js)$/.test(entry.name) ? [abs] : [];
});

// Прев'ю підміняє дані лише в siteData(): шаблон, що ходить у astro:content
// напряму, показав би редактору файли замість чернетки.
test('до astro:content ходять лише site-data.ts і content.config.ts', () => {
  const allowed = new Set(['src/lib/site-data.ts', 'src/content.config.ts']);
  const offenders = sources(join(projectRoot, 'src'))
    .map((f) => relative(projectRoot, f).split(sep).join('/'))
    .filter((f) => !allowed.has(f))
    .filter((f) => /import\s+(?!type\b)[^;]*?from\s+['"]astro:content['"]/.test(readFileSync(join(projectRoot, f), 'utf8')));
  assert.deepEqual(offenders, []);
});
