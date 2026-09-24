import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { BASE_PATH, SITE_URL } from '../astro.config.mjs';
import { distDir, loadPage } from './helpers/dist.js';
import { htmlFiles, pageUrl } from './helpers/links.js';
import { readCollection, readPages, readSingleton } from './helpers/content.js';
import { withBuild } from './helpers/build.js';
import { church } from './helpers/probes.js';
import { t } from './helpers/i18n.js';
import { head, jsonLd, jsonLdScripts } from './helpers/seo.js';
import { absoluteUrl, fullTitle } from '../src/lib/seo.mjs';
import { openingHours } from '../src/lib/jsonld.mjs';
import { coverImage } from '../src/lib/collections.mjs';

const T = { timeout: 180_000 };
const LOCALES = [['uk', ''], ['en', 'en/']];
const pair = (uk, en = uk) => ({ uk, en });
const abs = (rel) => new URL(`${BASE_PATH}${rel}`, SITE_URL).href;
const ofType = (nodes, type) => nodes.filter((n) => n['@type'] === type);

const built = htmlFiles(distDir).map((file) => {
  const url = pageUrl(distDir, file, BASE_PATH);
  const rel = url.slice(BASE_PATH.length);
  return { url, rel, root: parse(readFileSync(file, 'utf8')) };
});
const canonicals = new Set(built.map(({ root }) => head(root).canonical));

const settings = readSingleton('site-settings');
const contact = readSingleton('contact-info');

// Властивість має бути або рівна очікуваному, або відсутня зовсім (не null).
const assertOptional = (node, key, expected, where) => {
  if (expected === null || expected === undefined) assert.equal(key in node, false, `${where}: ${key} мав би бути відсутнім`);
  else assert.deepEqual(node[key], expected, `${where}: ${key}`);
};

test('кожна сторінка: рівно один JSON-LD, він парситься й не містить «<»', () => {
  for (const { url, root } of built) {
    const scripts = jsonLdScripts(root);
    assert.equal(scripts.length, 1, `${url}: JSON-LD-скриптів ${scripts.length}`);
    assert.doesNotMatch(scripts[0], /</, `${url}: «<» у JSON-LD`);
    assert.equal(JSON.parse(scripts[0])['@context'], 'https://schema.org', url);
  }
});

test('головна: Organization і Church з site-settings та contact-info, без стежки', () => {
  const home = readSingleton('homepage');
  for (const [lang, prefix] of LOCALES) {
    const nodes = jsonLd(loadPage(`${prefix}index.html`));
    const [org] = ofType(nodes, 'Organization');
    const [place] = ofType(nodes, 'Church');
    assert.ok(org && place, `${lang}: бракує Organization чи Church`);
    assert.equal(org.name, settings.name[lang]);
    assert.equal(org.url, abs(prefix));
    assert.equal(org.logo, absoluteUrl(SITE_URL, BASE_PATH, settings.logo[lang]));
    assert.deepEqual(org.sameAs, Object.values(settings.social));

    assert.equal(place.name, settings.name[lang]);
    assert.equal(place.url, abs(prefix));
    assert.equal(place.image, absoluteUrl(SITE_URL, BASE_PATH, home.heroImage.src));
    assert.deepEqual(place.address, {
      '@type': 'PostalAddress', streetAddress: contact.address[lang], addressLocality: contact.city[lang], addressCountry: 'UA',
    });
    assert.equal(place.telephone, contact.phone);
    assert.equal(place.email, contact.email);
    assertOptional(place, 'geo', contact.geo && { '@type': 'GeoCoordinates', latitude: contact.geo.lat, longitude: contact.geo.lng }, lang);
    assertOptional(place, 'openingHours', openingHours(`${contact.serviceDay.en} ${contact.serviceTime}`), lang);
    assert.equal(ofType(nodes, 'BreadcrumbList').length, 0, `${lang}: стежка на головній`);
  }
});

test('кожна підсторінка: BreadcrumbList від головної до себе, усі ланки — зібрані сторінки', () => {
  for (const { url, rel, root } of built) {
    if (rel === '' || rel === 'en/') continue;
    const lang = rel.startsWith('en/') ? 'en' : 'uk';
    const [crumbs] = ofType(jsonLd(root), 'BreadcrumbList');
    assert.ok(crumbs, `${url}: немає BreadcrumbList`);
    const items = crumbs.itemListElement;
    assert.deepEqual(items.map((i) => i.position), items.map((_, n) => n + 1), `${url}: позиції`);
    assert.equal(items[0].name, t(lang, 'crumb.home'), `${url}: перша ланка`);
    assert.equal(items[0].item, abs(lang === 'en' ? 'en/' : ''), `${url}: перша ланка не на головну`);
    assert.equal(items.at(-1).item, head(root).canonical, `${url}: остання ланка не на себе`);
    for (const { item } of items) assert.ok(canonicals.has(item), `${url}: ланка ${item} — не сторінка сайту`);
  }
});

test('підписи стежки — як у видимих .crumbs і заголовках', () => {
  const sections = [['ministries', (d, l) => d.name[l]], ['churches', (d, l) => d.city[l]], ['projects', (d, l) => d.title[l]]];
  for (const [section, current] of sections) {
    for (const { data } of readCollection(section)) {
      for (const [lang, prefix] of LOCALES) {
        const [crumbs] = ofType(jsonLd(loadPage(`${prefix}${section}/${data.slug}/index.html`)), 'BreadcrumbList');
        assert.deepEqual(crumbs.itemListElement.map((i) => i.name),
          [t(lang, 'crumb.home'), t(lang, `crumb.${section}`), current(data, lang)], `${prefix}${section}/${data.slug}/`);
      }
    }
  }
  for (const [id, page] of Object.entries(readPages())) {
    for (const [lang, prefix] of LOCALES) {
      const found = built.find((b) => b.rel === `${prefix}${id}/`);
      if (!found) continue; // вимкнена сторінка (body: null) — перевіряє seo.test.js
      const [crumbs] = ofType(jsonLd(found.root), 'BreadcrumbList');
      assert.deepEqual(crumbs.itemListElement.map((i) => i.name), [t(lang, 'crumb.home'), page.title[lang]], found.url);
    }
  }
});

test('сторінка церкви: Church з назвою, адресою, координатами й годинами з даних', () => {
  for (const { data: c } of readCollection('churches')) {
    for (const [lang, prefix] of LOCALES) {
      const where = `${prefix}churches/${c.slug}/`;
      const [place] = ofType(jsonLd(loadPage(`${where}index.html`)), 'Church');
      assert.ok(place, `${where}: немає Church`);
      assert.equal(place.name, c.name[lang]);
      assert.equal(place.url, abs(where));
      assert.equal(place.image, absoluteUrl(SITE_URL, BASE_PATH, coverImage(c.media).src));
      assert.deepEqual(place.address, {
        '@type': 'PostalAddress', streetAddress: c.address[lang], addressLocality: c.city[lang], addressCountry: 'UA',
      });
      assertOptional(place, 'geo', c.geo && { '@type': 'GeoCoordinates', latitude: c.geo.lat, longitude: c.geo.lng }, where);
      assertOptional(place, 'openingHours', openingHours(c.times.en), where);
    }
  }
});

test('проба: координати виводяться, вільний час без діапазону пропускається, лапки й «<» не ламають розмітку', T, () => {
  const name = pair('Церква «Лоза» & "друзі" <разом>', 'Church "Vine" & < 5 friends');
  withBuild((content) => {
    content.editSingleton('contact-info', ({ main }) => { main.geo = { lat: 47.91, lng: 33.39 }; });
    content.write('churches', 'ld-probe', church('ld-probe', {
      name, geo: { lat: 48.46, lng: 35.04 }, times: pair('За домовленістю', 'By appointment'),
    }));
  }, (result) => {
    assert.equal(result.failed, false, result.output.slice(-3000));
    for (const [lang, prefix] of LOCALES) {
      const [homeChurch] = ofType(jsonLd(result.page(`${prefix}index.html`)), 'Church');
      assert.deepEqual(homeChurch.geo, { '@type': 'GeoCoordinates', latitude: 47.91, longitude: 33.39 }, `${lang}: geo головної`);

      const root = result.page(`${prefix}churches/ld-probe/index.html`);
      assert.doesNotMatch(jsonLdScripts(root)[0], /</, `${lang}: «<» у JSON-LD`);
      const [place] = ofType(jsonLd(root), 'Church');
      assert.equal(place.name, name[lang], `${lang}: назва не дослівно`);
      assert.deepEqual(place.geo, { '@type': 'GeoCoordinates', latitude: 48.46, longitude: 35.04 });
      assert.equal('openingHours' in place, false, `${lang}: вигаданий openingHours`);
      assert.equal(head(root).title, fullTitle(name[lang], settings.name[lang]), `${lang}: <title> з лапками`);
      assert.equal(head(root).og['og:title'], head(root).title, `${lang}: og:title з лапками`);
    }
  });
});
