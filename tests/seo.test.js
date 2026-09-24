import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { BASE_PATH, NOINDEX, SITE_URL } from '../astro.config.mjs';
import { distDir } from './helpers/dist.js';
import { findBrokenLinks, htmlFiles, pageUrl } from './helpers/links.js';
import { readCollection, readPages, readSingleton } from './helpers/content.js';
import { withBuild } from './helpers/build.js';
import { ministry, project } from './helpers/probes.js';
import { head } from './helpers/seo.js';
import { absoluteUrl, fullTitle, pageDescription, siteFallbackImage, truncate, DESCRIPTION_MAX } from '../src/lib/seo.mjs';
import { coverImage } from '../src/lib/collections.mjs';
import { isPageEnabled } from '../src/lib/pages.mjs';

const T = { timeout: 180_000 };
const LOCALES = [['uk', ''], ['en', 'en/']];
const pair = (uk, en = uk) => ({ uk, en });
const abs = (rel) => new URL(`${BASE_PATH}${rel}`, SITE_URL).href;
const assertBuilt = ({ failed, output }) => assert.equal(failed, false, `збірка впала на валідних даних:\n${output.slice(-3000)}`);

const built = htmlFiles(distDir).map((file) => {
  const url = pageUrl(distDir, file, BASE_PATH);
  const rel = url.slice(BASE_PATH.length);
  const lang = rel.startsWith('en/') ? 'en' : 'uk';
  return { url, rel, lang, neutral: lang === 'en' ? rel.slice('en/'.length) : rel, head: head(parse(readFileSync(file, 'utf8'))) };
});
const byRel = new Map(built.map((p) => [p.rel, p]));

const settings = readSingleton('site-settings');
const home = readSingleton('homepage');
const fallbackImage = siteFallbackImage(settings, home);
// Проба нижче раніше посилалась на 'uploads/hero-cross.jpg' напряму: реальний
// файл, який редактор вільний замінити чи видалити (він же не частина проби,
// а фото героя головної). CLAUDE.md — «ніколи не закріплювати поточні дані»,
// тож беремо той самий шлях, що й насправді лежить у heroImage.src.
const heroSrc = home.heroImage.src;

test('кожна сторінка: title, description, canonical на себе й повний набір OG', () => {
  for (const { url, lang, head: h } of built) {
    assert.ok(h.title?.trim(), `${url}: без <title>`);
    assert.ok(h.description?.trim(), `${url}: без description`);
    assert.equal(h.canonical, new URL(url, SITE_URL).href, `${url}: canonical не на себе`);
    assert.equal(h.og['og:url'], h.canonical, `${url}: og:url`);
    assert.equal(h.og['og:title'], h.title, `${url}: og:title`);
    assert.equal(h.og['og:description'], h.description, `${url}: og:description`);
    assert.equal(h.og['og:type'], 'website', `${url}: og:type`);
    assert.equal(h.og['og:site_name'], settings.name[lang], `${url}: og:site_name`);
    assert.match(h.og['og:image'] ?? '', /^https?:\/\//, `${url}: og:image не абсолютний`);
    assert.equal(h.og['og:locale'], lang === 'uk' ? 'uk_UA' : 'en_US', `${url}: og:locale`);
    assert.equal(h.og['og:locale:alternate'], lang === 'uk' ? 'en_US' : 'uk_UA', `${url}: og:locale:alternate`);
    assert.equal(h.twitterCard, 'summary_large_image', `${url}: twitter:card`);
  }
});

test('hreflang: uk, en і x-default на українську, взаємні на обох мовах', () => {
  for (const p of built) {
    const alt = p.head.alternates;
    assert.deepEqual(Object.keys(alt).sort(), ['en', 'uk', 'x-default'], `${p.url}: набір hreflang`);
    assert.equal(alt.uk, abs(p.neutral), `${p.url}: hreflang uk`);
    assert.equal(alt.en, abs(`en/${p.neutral}`), `${p.url}: hreflang en`);
    assert.equal(alt['x-default'], alt.uk, `${p.url}: x-default не на українську`);
    assert.equal(alt[p.lang], p.head.canonical, `${p.url}: hreflang своєї мови ≠ canonical`);
    const twin = byRel.get(p.lang === 'uk' ? `en/${p.neutral}` : p.neutral);
    assert.ok(twin, `${p.url}: немає сторінки-пари іншою мовою`);
    assert.deepEqual(twin.head.alternates, alt, `${p.url}: hreflang не взаємні`);
  }
});

// Сторінки записів із seo.noindex (обидві мови) — з контенту, не з пам'яті.
function noindexRels() {
  const rels = new Set();
  const add = (neutral) => { rels.add(neutral); rels.add(`en/${neutral}`); };
  for (const section of ['ministries', 'churches', 'projects']) {
    for (const { data } of readCollection(section)) if (data.seo.noindex) add(`${section}/${data.slug}/`);
  }
  for (const [id, page] of Object.entries(readPages())) if (page.seo?.noindex) add(`${id}/`);
  if (home.seo?.noindex) add('');
  return rels;
}

test('robots: у прев\'ю — noindex на кожній сторінці, інакше — лише в записів із seo.noindex', () => {
  const expected = noindexRels();
  for (const p of built) {
    const want = NOINDEX || expected.has(p.rel);
    assert.equal(p.head.robots === 'noindex', want, `${p.url}: robots «${p.head.robots ?? 'немає'}», очікувалось ${want ? 'noindex' : 'без robots'}`);
  }
});

test('деталки: title, description й og:image — з SEO-полів, інакше з назви, опису й галереї', () => {
  const details = [['ministries', 'name', 'summary'], ['churches', 'name', 'lead'], ['projects', 'title', 'lead']];
  for (const [section, titleKey, textKey] of details) {
    for (const { data } of readCollection(section)) {
      for (const [lang, prefix] of LOCALES) {
        const p = byRel.get(`${prefix}${section}/${data.slug}/`);
        assert.ok(p, `немає ${prefix}${section}/${data.slug}/`);
        const { seo } = data;
        assert.equal(p.head.title, seo.metaTitle?.[lang] ?? fullTitle(data[titleKey][lang], settings.name[lang]), `${p.url}: title`);
        assert.equal(p.head.description, seo.metaDescription?.[lang] ?? truncate(data[textKey][lang]), `${p.url}: description`);
        assert.equal(p.head.og['og:image'], absoluteUrl(SITE_URL, BASE_PATH, seo.ogImage ?? coverImage(data.media).src), `${p.url}: og:image`);
      }
    }
  }
});

test('головна й сторінки pages.*: title, description й og:image — з SEO-полів або заголовка, ліда, прози', () => {
  for (const [lang, prefix] of LOCALES) {
    const p = byRel.get(prefix);
    assert.equal(p.head.title, home.seo?.metaTitle?.[lang] ?? fullTitle(settings.name[lang], settings.name[lang]), `${p.url}: title`);
    assert.equal(p.head.description, home.seo?.metaDescription?.[lang] ?? truncate(home.about.lead[lang]), `${p.url}: description`);
    assert.equal(p.head.og['og:image'], absoluteUrl(SITE_URL, BASE_PATH, home.seo?.ogImage ?? fallbackImage), `${p.url}: og:image`);
  }
  for (const [id, page] of Object.entries(readPages())) {
    for (const [lang, prefix] of LOCALES) {
      const p = byRel.get(`${prefix}${id}/`);
      if (!p) {
        assert.equal(isPageEnabled(page), false, `немає ${prefix}${id}/, хоча сторінка ввімкнена`);
        continue;
      }
      const text = pageDescription(page, lang) ?? home.about.lead[lang];
      assert.equal(p.head.title, page.seo?.metaTitle?.[lang] ?? fullTitle(page.title[lang], settings.name[lang]), `${p.url}: title`);
      assert.equal(p.head.description, page.seo?.metaDescription?.[lang] ?? truncate(text), `${p.url}: description`);
      assert.equal(p.head.og['og:image'], absoluteUrl(SITE_URL, BASE_PATH, page.seo?.ogImage ?? fallbackImage), `${p.url}: og:image`);
    }
  }
});

const LONG = pair('Довгий опис служіння. '.repeat(20), 'A long ministry summary. '.repeat(20));
const noSeo = { metaTitle: null, metaDescription: null, ogImage: null, noindex: false };

test('проба: SEO-поля редактора перекривають фолбеки, noindex — на обох мовах, довгий опис обрізано, бита og:image ловиться', T, () => {
  withBuild((content) => {
    content.write('ministries', 'seo-custom', ministry('seo-custom', {
      seo: { metaTitle: pair('Мета-заголовок', 'Meta title'), metaDescription: pair('Мета-опис', 'Meta description'), ogImage: heroSrc, noindex: false },
    }));
    content.write('ministries', 'seo-hidden', ministry('seo-hidden', { seo: { ...noSeo, noindex: true } }));
    content.write('ministries', 'seo-long', ministry('seo-long', { summary: LONG }));
    content.write('projects', 'seo-broken-og', project('seo-broken-og', { seo: { ...noSeo, ogImage: 'uploads/missing-og.jpg' } }));
    content.editSingleton('pages', (pages) => {
      pages.about.body = pair('Перший абзац про церкву.\n\nДругий абзац.', 'First paragraph about the church.\n\nSecond paragraph.');
      delete pages.about.lead;
    });
  }, (result) => {
    assertBuilt(result);
    for (const [lang, prefix] of LOCALES) {
      const custom = head(result.page(`${prefix}ministries/seo-custom/index.html`));
      assert.equal(custom.title, pair('Мета-заголовок', 'Meta title')[lang], `${lang}: metaTitle не дослівно`);
      assert.equal(custom.description, pair('Мета-опис', 'Meta description')[lang], `${lang}: metaDescription`);
      assert.equal(custom.og['og:image'], absoluteUrl(SITE_URL, BASE_PATH, heroSrc), `${lang}: ogImage`);
      assert.equal(custom.robots, undefined, `${lang}: зайвий robots`);

      assert.equal(head(result.page(`${prefix}ministries/seo-hidden/index.html`)).robots, 'noindex', `${lang}: noindex запису`);

      const long = head(result.page(`${prefix}ministries/seo-long/index.html`)).description;
      assert.ok(long.length <= DESCRIPTION_MAX && long.endsWith('…'), `${lang}: не обрізано: ${long}`);
      assert.ok(LONG[lang].startsWith(long.slice(0, -1)), `${lang}: обрізане — не початок опису`);

      assert.equal(
        head(result.page(`${prefix}about/index.html`)).description,
        lang === 'uk' ? 'Перший абзац про церкву.' : 'First paragraph about the church.',
        `${lang}: опис сторінки без ліда — перший абзац прози`,
      );
    }
    const broken = findBrokenLinks(result.outDir, BASE_PATH);
    assert.ok(broken.length > 0 && broken.every((line) => line.includes('seo-broken-og') && line.includes('missing-og.jpg')),
      `бита og:image мала б бути єдиною знахідкою:\n${broken.join('\n')}`);
  }, { env: { SITE_NOINDEX: 'false' } });
});

test('проба прев\'ю: SITE_NOINDEX=true закриває кожну сторінку', T, () => {
  withBuild(() => {}, (result) => {
    assertBuilt(result);
    for (const file of htmlFiles(result.outDir)) {
      assert.equal(head(parse(readFileSync(file, 'utf8'))).robots, 'noindex', `${file}: прев'ю відкрите для індексації`);
    }
  }, { env: { SITE_NOINDEX: 'true' } });
});
