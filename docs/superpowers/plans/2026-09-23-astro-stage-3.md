# Етап 3: технічне SEO — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Кожна сторінка обох локалей отримує повний `<head>` (title, description, canonical, взаємні `hreflang`, OG/Twitter, `robots`) і JSON-LD (`Organization`, `Church`, `BreadcrumbList`), а збірка сама кладе в `dist/` `sitemap.xml`, `robots.txt` і `.htaccess`; прев'ю-стенд на GitHub Pages закритий від індексації.

**Architecture:** Уся логіка — чисті функції в `src/lib/seo.mjs` (ланцюжки фолбеків, обрізання, адреси) і `src/lib/jsonld.mjs` (вузли schema.org), тестовані напряму. `src/components/Seo.astro` лише рендерить результат `resolveMeta()` і підключається з `Base.astro`; маршрути передають `path`, заголовок, текст-фолбек, свою SEO-групу й обкладинку галереї. Технічні файли пише інтеграція `src/integrations/seo-files.mjs` на `astro:build:done`: `sitemap.xml` будується **з готового HTML** (canonical, `hreflang`, `robots` кожної сторінки), тому не може розійтися з тим, що реально зібрано.

**Tech Stack:** Astro 5 (інтеграція з хуком `astro:build:done`, `vite.define`), `node:test`, `node-html-parser` (переїжджає в `dependencies` — ним тепер користується збірка).

**Spec:** [2026-09-22-02-seo-design.md](../specs/2026-09-22-02-seo-design.md) — розділи «Локалі та hreflang», «Мета-теги та ланцюжок фолбеків», «Структуровані дані (JSON-LD)», «Технічні файли», «Критерії готовності». Структура URL, перемикач мов і три нові сторінки вже зроблені на Етапі 2.
Попередні етапи: [Етап 0](2026-09-22-astro-stage-0.md), [Етап 1](2026-09-23-astro-stage-1.md), [Етап 2](2026-09-23-astro-stage-2.md). Дірки контенту: [2026-09-23-content-gaps.md](../notes/2026-09-23-content-gaps.md) (рядки 1 і 4 стосуються цього етапу).

## Global Constraints

- **Node ≥ 22**, Astro `^5.18.2`. Нових залежностей немає; `node-html-parser` `^7.1.0` переходить з `devDependencies` у `dependencies`.
- **Вигляд не змінюється.** Правки — лише в `<head>` і props маршрутів; видима розмітка `<body>` та CSS не чіпаються. Жодного `<style>` у `.astro`.
- **Усі внутрішні адреси** — через `localePath(base, lang, path)` / `assetUrl(base, src)` з `src/lib/paths.mjs` (`base = import.meta.env.BASE_URL`); абсолютні — `new URL(<шлях з base>, Astro.site)`. Домен ніде не пишеться руками: лише `SITE_URL`.
- **Канонічний хост — без `www`**, URL з кінцевим слешем, `x-default` → українська (Спека 2).
- **Контракт з адмінкою** (CLAUDE.md): будь-які дані, що пропускає схема, збираються й проходять `npm test`. Тести виводять очікування з контенту, який читають, — жодних закріплених поточних значень. Крайні випадки — пробні збірки `withBuild()` з `tests/helpers/build.js`.
- CI (`deploy.yml`) збирає й тестує **з підшляхом** і (після Задачі 5) **в режимі прев'ю** (`SITE_NOINDEX=true`). Тести на основному `dist/` мусять проходити в обох режимах; режим-залежні перевірки гілкуються за `NOINDEX` з `astro.config.mjs`, а протилежний режим доводять проби з явним `env`.
- `SITE_NOINDEX` вмикає прев'ю-режим **лише значенням рівно `true`**.
- Коментарі й назви тестів — **українською**; коментар пояснює *чому*, а не *що*.
- Windows/Git Bash: команда з `BASE_PATH` потребує `MSYS_NO_PATHCONV=1` або PowerShell.
- Кожна задача закінчується `npm test` без жодного FAIL і окремим комітом. Кінцівка кожного коміту:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## Зафіксовані рішення цього плану

Місця, де спека допускає кілька прочитань. Якщо ревʼю не згодне — правити **до** старту.

| # | Питання | Рішення | Підстава |
|---|---|---|---|
| 1 | Формат `<title>` | `seo.metaTitle` — дослівно; інакше `«<заголовок> — <назва сайту>»`, а якщо заголовок уже містить назву сайту (головна, «Дім Хліба — Кривий Ріг») — без суфікса | спека: «береться `name`/`title`». Суфікс бренду — стандарт; дубль «Дім Хліба — … — Дім Хліба» некрасивий. Ручний `— House of Bread Church` на українських деталках служінь (Етап 2, рішення 18) зникає: тепер суфікс мовою сторінки |
| 2 | Ланцюжок `description` | `seo.metaDescription` — дослівно, **без** обрізання; інакше перший наявний із: `summary`/`lead` запису → `lead` сторінки → перший абзац `body` → `homepage.about.lead`; фолбек обрізається до 160 символів по слову з «…» | спека: «`summary`/`lead`, обрізане». Останній щабель гарантує description на **кожній** сторінці (критерій готовності), навіть коли в `pages.*` немає `lead` |
| 3 | Ланцюжок `og:image` | `seo.ogImage` → обкладинка галереї (`coverImage`, у т.ч. мініатюра YouTube) → `site-settings.defaultOgImage` → `homepage.heroImage.src` | спека закінчує ланцюжок на `defaultOgImage`, але він зараз `null` — картка без картинки. Фото героя — єдине справжнє фото сайту й поле, обовʼязкове за схемою |
| 4 | SEO-група для сторінок і головної | необовʼязкове поле `seo` у `pages.*` і `homepage` (та сама схема `seo`, що в колекціях) | спека: «кожна сторінка й кожен запис колекції має групу SEO-полів». Необовʼязкове — щоб наявні дані й адмінка без поля лишалися валідними |
| 5 | Як закрити прев'ю | `SITE_NOINDEX=true` → `<meta name="robots" content="noindex">` на **кожній** сторінці, `robots.txt` = `Disallow: /`, `sitemap.xml` не пишеться. Без змінної — індексується | на GitHub Pages сайт живе під підшляхом, а `robots.txt` пошуковик читає лише з кореня хоста — працює тільки meta. `Disallow` — як велить таблиця ризиків Спеки 3. Продакшн — поведінка за замовчуванням, щоб домашня збірка не вийшла «невидимою» |
| 6 | Звідки sitemap | з готового HTML після збірки: canonical, `hreflang` і `robots` кожної сторінки; сторінки з `noindex` не потрапляють | окремий список маршрутів неминуче розійшовся б зі сторінками. Так мапа і `<head>` мають одне джерело, і `hreflang` у мапі ті самі, що на сторінці |
| 7 | Де генеруються `robots.txt`, `.htaccess` | інтеграція на `astro:build:done`, а не `public/` | обидва залежать від `SITE_URL`/`BASE_PATH`/`SITE_NOINDEX`; інтеграція пише у фактичну `outDir` — проби з `--outDir` отримують свої файли |
| 8 | `www → без www` | загальне правило `^www\.(.+)$ → https://%1` без домену у файлі; тест перевіряє, що хост `SITE_URL` не починається з `www.` | домен ще невідомий; правило не треба міняти в день запуску |
| 9 | `openingHours` | розбирається з **англійського** тексту (`times.en`; для головної — `serviceDay.en` + `serviceTime`): дні тижня + діапазон `ЧЧ:ХХ–ЧЧ:ХХ`. Немає дня або немає часу закінчення — властивість пропускається | поля — вільний текст; англійські назви днів передбачувані. Вигадувати час закінчення не можна. Дірку (у церквах вказано лише початок) записано в нотатку |
| 10 | Склад JSON-LD | один `<script type="application/ld+json">` з `@graph` на сторінку: головна — `Organization` + `Church` (з `site-settings`, `contact-info`, фото героя); сторінка церкви — `Church`; кожна підсторінка — `BreadcrumbList`, **ті самі** підписи, що у видимих `.crumbs` (у церкви — місто). `addressCountry: "UA"` константою | спека, розділ JSON-LD. Google звіряє розмітку з видимим текстом. Усі церкви обʼєднання — в Україні, окремого поля країни в даних немає |
| 11 | `og:type`, Twitter | `og:type=website` скрізь; додатково `og:site_name`, `og:url`, `og:locale:alternate`, `twitter:card=summary_large_image` | мінімальний набір спеки + дешеві теги, які читають Telegram і X |
| 12 | 301 зі старих адрес | усе — на українську: `*.dc.html?id=<slug>` → `/<розділ>/<slug>/`, без `id` — на список, списки → `/<розділ>/`, `…/index.html` → `…/` | у легасі мова в адресі не жила (localStorage), тож старе посилання — українське |
| 13 | Кешування | `.css`/`.js` — рік + `immutable` (тест гарантує, що всі вони в `_astro/` з хешем), `.woff2` — рік, картинки — 30 днів, `html/xml/txt` — `no-cache`; стиснення brotli + deflate під `IfModule` | шрифти й завантаження не мають хешу в імені — `immutable` на них небезпечний; HTML мусить оновлюватися одразу після публікації |
| 14 | Перевірка `.htaccess` | тести — текстові (правила, base, цілі легасі-редиректів існують у `dist/`); поведінку перевіряє чекліст `curl` у день запуску на домені | Apache/OpenLiteSpeed локально немає; продакшн-деплой чекає домену (Етап 0, Задача 5) |
| 15 | Що поза етапом | сторінка 404, `lastmod` у sitemap, окремі OG-картинки 1200×630 | у спеці їх немає; `lastmod` без надійних дат шкодить більше, ніж допомагає |

## Структура файлів

```
astro.config.mjs                 # + NOINDEX, vite.define __HOB_NOINDEX__, інтеграція seoFiles
package.json                     # node-html-parser → dependencies
src/
  env.d.ts                       # (новий) declare const __HOB_NOINDEX__
  content.config.ts              # seo: seo.optional() у pages і homepage
  lib/
    seo.mjs                      # (новий) truncate, fullTitle, pageDescription, absoluteUrl,
                                 #         alternates, siteFallbackImage, resolveMeta
    jsonld.mjs                   # (новий) openingHours, churchNode, organizationNode,
                                 #         breadcrumbNode, jsonLdScript
    seo-files.mjs                # (новий) robotsTxt, pageEntry, sitemapEntries, sitemapXml,
                                 #         htaccess, LEGACY_LISTS, LEGACY_DETAILS
  integrations/seo-files.mjs     # (новий) astro:build:done → robots.txt, sitemap.xml, .htaccess
  components/Seo.astro           # (новий) весь SEO-вміст <head>
  layouts/Base.astro             # props для Seo, <Seo> замість title/canonical
  layouts/SubPage.astro          # прокидає SEO-props, будує стежку для BreadcrumbList
  pages/[...lang]/**             # 13 маршрутів передають path/description/seo/image(/jsonLd)
tests/
  lib-seo.test.js                # (новий) юніти seo.mjs, jsonld.mjs
  seo.test.js                    # (новий) <head> усіх сторінок + проби
  jsonld.test.js                 # (новий) JSON-LD усіх сторінок + проба
  seo-files.test.js              # (новий) юніти seo-files.mjs, dist-файли + проба
  helpers/seo.js                 # (новий) head(), jsonLd(), parseSitemap()
  helpers/links.js               # findBrokenLinks перевіряє й абсолютні адреси під SITE_URL
  build.test.js                  # probe verify-base передає свій SITE_URL
.github/workflows/deploy.yml     # SITE_NOINDEX: 'true'
CLAUDE.md, docs/…/notes/*        # документація
```

## Review Focus

Вхідні дані, яких спека не називає, але які найімовірніше вдарять по людині, що користується сайтом чи адмінкою:

1. **Редактор заповнив SEO-поля** — `metaTitle`, `metaDescription`, `ogImage` мають перекрити фолбеки дослівно: без суфікса бренду й без обрізання. → проба в Задачі 2.
2. **Запис із `noindex: true`** — закритий обома мовами й відсутній у `sitemap.xml`; решта сторінок не страждає. → проби в Задачах 2 і 4.
3. **Назви з лапками, `&` і `<`** (`<` перед кирилицею схема пропускає) — атрибути meta валідні, JSON-LD не виходить із `<script>`, текст повертається дослівно. → юніт у Задачі 1, проба в Задачі 3.
4. **Час служінь вільним текстом** — «Sunday · 10:00» без кінця, «By appointment», «25:00» — `openingHours` пропускається, а не вигадується; збірка не падає. → юніт у Задачі 1, проба в Задачі 3.
5. **Режим збірки** — прев'ю (`SITE_NOINDEX=true`): кожна сторінка `noindex`, `Disallow: /`, sitemap немає; без змінної — навпаки. CI гоняє лише прев'ю-режим, тож продакшн-режим доводять проби з `SITE_NOINDEX: 'false'`. → проби в Задачах 2 і 4.

---

## Задача 1: чисті функції SEO і JSON-LD

**Files:**
- Create: `src/lib/seo.mjs`
- Create: `src/lib/jsonld.mjs`
- Test: `tests/lib-seo.test.js`

**Interfaces:**
- Consumes: `pick` (`src/lib/i18n.mjs`), `paragraphs` (`src/lib/format.mjs`), `assetUrl`, `localePath`, `otherLang` (`src/lib/paths.mjs`).
- Produces (`src/lib/seo.mjs`):
  - `DESCRIPTION_MAX = 160`
  - `truncate(text: string, max = 160): string`
  - `fullTitle(title: string, siteName: string): string`
  - `pageDescription(page: {lead?, body?}, lang): string | undefined`
  - `absoluteUrl(site: string, base: string, src: string): string`
  - `alternates(site, base, path): {hreflang: 'uk'|'en'|'x-default', href: string}[]`
  - `siteFallbackImage(settings, homepage): string` — `settings.defaultOgImage ?? homepage.heroImage.src`
  - `resolveMeta({site, base, lang, path, title, description?, seo?, image?, siteName, defaultDescription, fallbackImage, noindex?}) → {title, description, canonical, alternates, image, noindex, locale, localeAlternate, siteName}`
- Produces (`src/lib/jsonld.mjs`):
  - `openingHours(text: string): string | null` — `'Sa 12:00-14:00'`
  - `churchNode({id, url, name, image?, street, city, geo?, hours?, telephone?, email?, sameAs?})`
  - `organizationNode({id, url, name, logo, telephone?, email?, sameAs?})`
  - `breadcrumbNode(items: {name, url}[])`
  - `jsonLdScript(nodes: object[]): string` — JSON з `@context` і `@graph`, кожен `<` як `<`

- [ ] **Step 1: Write the failing test**

`tests/lib-seo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESCRIPTION_MAX, absoluteUrl, alternates, fullTitle, pageDescription, resolveMeta, siteFallbackImage, truncate,
} from '../src/lib/seo.mjs';
import { breadcrumbNode, churchNode, jsonLdScript, openingHours, organizationNode } from '../src/lib/jsonld.mjs';

const pair = (uk, en = uk) => ({ uk, en });
const SITE = 'https://example.org/';
// JSON-круг: властивість зі значенням undefined у JSON не потрапляє — саме це
// бачить пошуковик, тож порівнюємо після серіалізації.
const json = (value) => JSON.parse(JSON.stringify(value));

test('truncate: короткий текст — як є, пробіли й переноси згорнуто', () => {
  assert.equal(truncate('  Два\n\nабзаци  '), 'Два абзаци');
});

test('truncate: довгий текст — по слову, з «…», не довше за межу', () => {
  const long = 'слово '.repeat(60);
  const out = truncate(long);
  assert.ok(out.length <= DESCRIPTION_MAX, `${out.length} > ${DESCRIPTION_MAX}`);
  assert.ok(out.endsWith('…'));
  assert.ok(!out.includes(' …'), 'пробіл перед «…»');
  assert.ok(long.startsWith(out.slice(0, -1)), 'обрізане — не префікс оригіналу');
});

test('truncate: розділовий знак перед «…» прибирається', () => {
  const text = `${'x'.repeat(150)} слово, далі ще багато тексту`;
  assert.equal(truncate(text), `${'x'.repeat(150)} слово…`);
});

test('truncate: одне довге слово ріжеться по символу', () => {
  const out = truncate('а'.repeat(300));
  assert.equal(out, `${'а'.repeat(DESCRIPTION_MAX - 1)}…`);
});

test('fullTitle: суфікс бренду, якщо заголовок його ще не містить', () => {
  assert.equal(fullTitle('Служіння', 'Дім Хліба'), 'Служіння — Дім Хліба');
  assert.equal(fullTitle('Дім Хліба — Кривий Ріг', 'Дім Хліба'), 'Дім Хліба — Кривий Ріг');
  assert.equal(fullTitle('Дім Хліба', 'Дім Хліба'), 'Дім Хліба');
});

test('pageDescription: лід, інакше перший абзац прози, інакше нічого', () => {
  assert.equal(pageDescription({ title: pair('T'), lead: pair('Лід', 'Lead') }, 'en'), 'Lead');
  assert.equal(pageDescription({ title: pair('T'), body: pair('Перший.\n\nДругий.') }, 'uk'), 'Перший.');
  assert.equal(pageDescription({ title: pair('T'), body: null }, 'uk'), undefined);
});

test('absoluteUrl: відносний шлях — під base і SITE_URL, зовнішній — як є', () => {
  assert.equal(absoluteUrl(SITE, '/sub/', 'uploads/a.jpg'), 'https://example.org/sub/uploads/a.jpg');
  assert.equal(absoluteUrl(SITE, '/sub/', 'https://cdn.test/a.jpg'), 'https://cdn.test/a.jpg');
});

test('alternates: uk, en і x-default на українську', () => {
  assert.deepEqual(alternates(SITE, '/sub/', '/ministries/youth/'), [
    { hreflang: 'uk', href: 'https://example.org/sub/ministries/youth/' },
    { hreflang: 'en', href: 'https://example.org/sub/en/ministries/youth/' },
    { hreflang: 'x-default', href: 'https://example.org/sub/ministries/youth/' },
  ]);
});

test('siteFallbackImage: defaultOgImage, інакше фото героя', () => {
  const home = { heroImage: { src: 'uploads/hero.jpg' } };
  assert.equal(siteFallbackImage({ defaultOgImage: null }, home), 'uploads/hero.jpg');
  assert.equal(siteFallbackImage({ defaultOgImage: 'uploads/og.jpg' }, home), 'uploads/og.jpg');
});

const ARGS = {
  site: SITE, base: '/', lang: 'en', path: '/ministries/youth/', title: 'Youth', description: 'Summary',
  seo: null, image: 'uploads/cover.jpg', siteName: 'House of Bread Church', defaultDescription: 'Default',
  fallbackImage: 'uploads/hero.jpg', noindex: false,
};

test('resolveMeta: без SEO-полів — фолбеки', () => {
  assert.deepEqual(resolveMeta(ARGS), {
    title: 'Youth — House of Bread Church',
    description: 'Summary',
    canonical: 'https://example.org/en/ministries/youth/',
    alternates: alternates(SITE, '/', '/ministries/youth/'),
    image: 'https://example.org/uploads/cover.jpg',
    noindex: false,
    locale: 'en_US',
    localeAlternate: 'uk_UA',
    siteName: 'House of Bread Church',
  });
});

test('resolveMeta: SEO-поля редактора перекривають фолбеки дослівно', () => {
  const longDescription = 'word '.repeat(50).trim();
  const meta = resolveMeta({
    ...ARGS,
    seo: { metaTitle: pair('Мета', 'Meta'), metaDescription: pair('О', longDescription), ogImage: 'uploads/og.jpg', noindex: true },
  });
  assert.equal(meta.title, 'Meta');
  assert.equal(meta.description, longDescription, 'metaDescription редактора не обрізається');
  assert.equal(meta.image, 'https://example.org/uploads/og.jpg');
  assert.equal(meta.noindex, true);
});

test('resolveMeta: без опису й картинки — загальні фолбеки сайту', () => {
  const meta = resolveMeta({ ...ARGS, description: undefined, image: undefined });
  assert.equal(meta.description, 'Default');
  assert.equal(meta.image, 'https://example.org/uploads/hero.jpg');
});

test('resolveMeta: прев\'ю-режим закриває навіть запис без noindex', () => {
  const seo = { metaTitle: null, metaDescription: null, ogImage: null, noindex: false };
  assert.equal(resolveMeta({ ...ARGS, seo, noindex: true }).noindex, true);
});

test('openingHours: дні й діапазон часу з англійського тексту', () => {
  assert.equal(openingHours('Saturday · 12:00–14:00'), 'Sa 12:00-14:00');
  assert.equal(openingHours('Saturday, Sunday 9:30 - 11:00'), 'Sa,Su 09:30-11:00');
  assert.equal(openingHours('Sundays 10:00—12:00'), 'Su 10:00-12:00');
});

test('openingHours: без часу закінчення, без дня чи з неможливим часом — null', () => {
  assert.equal(openingHours('Sunday · 10:00'), null);
  assert.equal(openingHours('By appointment'), null);
  assert.equal(openingHours('12:00–14:00'), null);
  assert.equal(openingHours('Sunday 25:00–26:00'), null);
});

test('churchNode: повний вузол', () => {
  const node = churchNode({
    id: 'https://example.org/#church', url: 'https://example.org/', name: 'Дім Хліба',
    image: 'https://example.org/uploads/hero.jpg', street: 'вул. Така, 1', city: 'Кривий Ріг',
    geo: { lat: 47.9, lng: 33.39 }, hours: 'Sa 12:00-14:00', telephone: '+380991339969',
    email: 'info@example.org', sameAs: ['https://facebook.com/x'],
  });
  assert.deepEqual(json(node), {
    '@type': 'Church', '@id': 'https://example.org/#church', name: 'Дім Хліба', url: 'https://example.org/',
    image: 'https://example.org/uploads/hero.jpg',
    address: { '@type': 'PostalAddress', streetAddress: 'вул. Така, 1', addressLocality: 'Кривий Ріг', addressCountry: 'UA' },
    geo: { '@type': 'GeoCoordinates', latitude: 47.9, longitude: 33.39 },
    openingHours: 'Sa 12:00-14:00', telephone: '+380991339969', email: 'info@example.org',
    sameAs: ['https://facebook.com/x'],
  });
});

test('churchNode: без geo, годин і контактів — властивостей немає зовсім', () => {
  const node = json(churchNode({ id: 'i', url: 'u', name: 'N', street: 'S', city: 'C', geo: null, hours: null, sameAs: [] }));
  for (const key of ['geo', 'openingHours', 'telephone', 'email', 'sameAs', 'image']) {
    assert.equal(key in node, false, `${key} мав би бути відсутнім, а не null`);
  }
});

test('organizationNode: логотип і соцмережі', () => {
  assert.deepEqual(json(organizationNode({
    id: 'https://example.org/#organization', url: 'https://example.org/', name: 'Дім Хліба',
    logo: 'https://example.org/uploads/logo.png', telephone: '+380991339969', email: 'info@example.org',
    sameAs: ['https://t.me/x'],
  })), {
    '@type': 'Organization', '@id': 'https://example.org/#organization', name: 'Дім Хліба',
    url: 'https://example.org/', logo: 'https://example.org/uploads/logo.png',
    telephone: '+380991339969', email: 'info@example.org', sameAs: ['https://t.me/x'],
  });
});

test('breadcrumbNode: позиції з одиниці по порядку', () => {
  assert.deepEqual(breadcrumbNode([{ name: 'Головна', url: 'https://example.org/' }, { name: 'Служіння', url: 'https://example.org/ministries/' }]), {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Головна', item: 'https://example.org/' },
      { '@type': 'ListItem', position: 2, name: 'Служіння', item: 'https://example.org/ministries/' },
    ],
  });
});

test('jsonLdScript: жодного «<» — текст не вийде з <script>, а JSON повертає його дослівно', () => {
  const name = '</script><b>"&\' < разом';
  const out = jsonLdScript([{ '@type': 'Thing', name }]);
  assert.doesNotMatch(out, /</);
  assert.deepEqual(JSON.parse(out), { '@context': 'https://schema.org', '@graph': [{ '@type': 'Thing', name }] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/lib-seo.test.js`
Expected: FAIL — `Cannot find module '…/src/lib/seo.mjs'`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/seo.mjs`:

```js
import { pick } from './i18n.mjs';
import { paragraphs } from './format.mjs';
import { assetUrl, localePath, otherLang } from './paths.mjs';

// Google показує в видачі близько 155–160 символів опису. Обрізаємо самі й
// по слову — інакше фразу обріже пошуковик посеред слова.
export const DESCRIPTION_MAX = 160;

export function truncate(text, max = DESCRIPTION_MAX) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  // Одне надовге слово без пробілів ріжемо по символу, а не лишаємо порожнім.
  const words = space > max / 2 ? cut.slice(0, space) : cut;
  return `${words.replace(/[\s,.;:—–-]+$/, '')}…`;
}

// Рішення 1: бренд у кінці заголовка, але без дубля, коли назва вже там
// («Дім Хліба — Кривий Ріг»).
export const fullTitle = (title, siteName) => (title.includes(siteName) ? title : `${title} — ${siteName}`);

// Опис сторінки з pages.*: лід, інакше перший абзац прози. undefined —
// сигнал Seo.astro взяти загальний опис сайту.
export function pageDescription(page, lang) {
  if (page.lead) return pick(page.lead, lang);
  if (page.body) return paragraphs(pick(page.body, lang))[0];
  return undefined;
}

// Пошуковики й Facebook приймають лише абсолютні адреси.
export const absoluteUrl = (site, base, src) => new URL(assetUrl(base, src), site).href;

// Спека 2: hreflang мають бути взаємними. Обидва боки будуються з того
// самого шляху без локалі, тож розійтися не можуть.
export const alternates = (site, base, path) => {
  const uk = new URL(localePath(base, 'uk', path), site).href;
  return [
    { hreflang: 'uk', href: uk },
    { hreflang: 'en', href: new URL(localePath(base, 'en', path), site).href },
    { hreflang: 'x-default', href: uk },
  ];
};

// Рішення 3: defaultOgImage зараз null — картка без картинки гірша за фото
// героя, єдине справжнє фото сайту.
export const siteFallbackImage = (settings, homepage) => settings.defaultOgImage ?? homepage.heroImage.src;

const OG_LOCALE = { uk: 'uk_UA', en: 'en_US' };

// Увесь ланцюжок фолбеків Спеки 2 в одному місці: редактор додасть запис і
// не заповнить SEO — сторінка однаково вийде з заголовком, описом і картинкою.
// Те, що редактор заповнив сам, іде дослівно.
export function resolveMeta({
  site, base, lang, path, title, description, seo, image, siteName, defaultDescription, fallbackImage, noindex = false,
}) {
  return {
    title: seo?.metaTitle ? pick(seo.metaTitle, lang) : fullTitle(title, siteName),
    description: seo?.metaDescription ? pick(seo.metaDescription, lang) : truncate(description ?? defaultDescription),
    canonical: new URL(localePath(base, lang, path), site).href,
    alternates: alternates(site, base, path),
    image: absoluteUrl(site, base, seo?.ogImage ?? image ?? fallbackImage),
    noindex: noindex || Boolean(seo?.noindex),
    locale: OG_LOCALE[lang],
    localeAlternate: OG_LOCALE[otherLang(lang)],
    siteName,
  };
}
```

`src/lib/jsonld.mjs`:

```js
// Дні тижня у форматі schema.org openingHours. Розбираємо англійський текст:
// схема вимагає обидві мови, а англійські назви днів передбачувані.
const DAYS = [
  ['monday', 'Mo'], ['tuesday', 'Tu'], ['wednesday', 'We'], ['thursday', 'Th'],
  ['friday', 'Fr'], ['saturday', 'Sa'], ['sunday', 'Su'],
];
const TIME_RANGE = /\b(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})\b/;
const hhmm = (h, m) => (Number(h) <= 23 && Number(m) <= 59 ? `${h.padStart(2, '0')}:${m}` : null);

// Рішення 9: без дня чи без часу закінчення — null. Вигадана година
// закінчення в картці пошуку гірша за її відсутність.
export function openingHours(text) {
  const days = DAYS.filter(([name]) => new RegExp(`\\b${name}s?\\b`, 'i').test(text)).map(([, code]) => code);
  const range = text.match(TIME_RANGE);
  if (days.length === 0 || !range) return null;
  const from = hhmm(range[1], range[2]);
  const to = hhmm(range[3], range[4]);
  return from && to ? `${days.join(',')} ${from}-${to}` : null;
}

// undefined, а не null: JSON.stringify пропускає властивість зовсім, а
// «"geo": null» валідатори schema.org вважають помилкою.
const optional = (value) =>
  value === null || value === undefined || (Array.isArray(value) && value.length === 0) ? undefined : value;

export function churchNode({ id, url, name, image, street, city, geo = null, hours = null, telephone, email, sameAs }) {
  return {
    '@type': 'Church',
    '@id': id,
    name,
    url,
    image: optional(image),
    // Рішення 10: усі церкви обʼєднання — в Україні; поля країни в даних немає.
    address: { '@type': 'PostalAddress', streetAddress: street, addressLocality: city, addressCountry: 'UA' },
    geo: geo ? { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lng } : undefined,
    openingHours: optional(hours),
    telephone: optional(telephone),
    email: optional(email),
    sameAs: optional(sameAs),
  };
}

export function organizationNode({ id, url, name, logo, telephone, email, sameAs }) {
  return {
    '@type': 'Organization',
    '@id': id,
    name,
    url,
    logo,
    telephone: optional(telephone),
    email: optional(email),
    sameAs: optional(sameAs),
  };
}

export const breadcrumbNode = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(({ name, url }, index) => ({ '@type': 'ListItem', position: index + 1, name, item: url })),
});

// Вміст <script> браузер не екранує: «</script>» у назві з адмінки закрив би
// тег і решта пішла б у сторінку як HTML. < — той самий «<» для JSON.
export const jsonLdScript = (nodes) =>
  JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/lib-seo.test.js`
Expected: PASS, усі тести.

- [ ] **Step 5: Повний прогін і коміт**

Run: `npm test`
Expected: PASS (нічого, крім нових юнітів, не змінилося).

```bash
git add src/lib/seo.mjs src/lib/jsonld.mjs tests/lib-seo.test.js
git commit -m "feat: чисті функції мета-тегів і JSON-LD для Етапу 3

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 2: `<head>` кожної сторінки — title, description, canonical, hreflang, OG, robots

**Files:**
- Modify: `astro.config.mjs`
- Create: `src/env.d.ts`
- Modify: `src/content.config.ts` (схеми `homepage` і `pages`)
- Create: `src/components/Seo.astro`
- Modify: `src/layouts/Base.astro`, `src/layouts/SubPage.astro`
- Modify: усі 13 файлів `src/pages/[...lang]/**/*.astro`
- Modify: `tests/helpers/links.js`, `tests/build.test.js`
- Create: `tests/helpers/seo.js`, `tests/seo.test.js`

**Interfaces:**
- Consumes: `resolveMeta`, `siteFallbackImage`, `pageDescription`, `fullTitle`, `truncate`, `absoluteUrl` (Задача 1); `coverImage` (`src/lib/collections.mjs`); `withBuild` (`tests/helpers/build.js`); `ministry`, `project` (`tests/helpers/probes.js`).
- Produces:
  - `astro.config.mjs`: `export const NOINDEX: boolean`; глобальна константа збірки `__HOB_NOINDEX__`.
  - `Seo.astro` / `Base.astro` props: `{ lang: 'uk'|'en'; path: string /* без локалі й base, «/ministries/youth/» */; title: string; description?: string; seo?: SeoFields | null; image?: string; breadcrumbs?: {name: string; href: string}[]; jsonLd?: Record<string, unknown>[] }` (`breadcrumbs`/`jsonLd` використовує Задача 3).
  - `SubPage.astro` props: наявні + `description?`, `seo?`, `image?`.
  - `tests/helpers/seo.js`: `head(root) → {title, description, robots, canonical, alternates: {uk, en, 'x-default'}, og: Record<string,string>, twitterCard}`.
  - `findBrokenLinks(dir, base, site = SITE_URL)` — додатково перевіряє canonical, `hreflang`, `og:url`, `og:image`, що лежать під `new URL(base, site)`.

- [ ] **Step 1: Спільний хелпер тестів**

`tests/helpers/seo.js`:

```js
// <head> сторінки у вигляді, зручному для порівнянь. node-html-parser
// повертає атрибути вже розкодованими («&amp;» → «&»), тож порівнюємо з
// текстом даних напряму.
export function head(root) {
  const meta = (attr, key) => root.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content');
  return {
    title: root.querySelector('title')?.text,
    description: meta('name', 'description'),
    robots: meta('name', 'robots'),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    alternates: Object.fromEntries(
      root.querySelectorAll('link[rel="alternate"][hreflang]').map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]),
    ),
    og: Object.fromEntries(
      root.querySelectorAll('meta[property^="og:"]').map((m) => [m.getAttribute('property'), m.getAttribute('content')]),
    ),
    twitterCard: meta('name', 'twitter:card'),
  };
}
```

- [ ] **Step 2: Write the failing test**

`tests/seo.test.js`:

```js
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
      seo: { metaTitle: pair('Мета-заголовок', 'Meta title'), metaDescription: pair('Мета-опис', 'Meta description'), ogImage: 'uploads/hero-cross.jpg', noindex: false },
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
      assert.equal(custom.og['og:image'], abs('uploads/hero-cross.jpg'), `${lang}: ogImage`);
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx astro build && node --test tests/seo.test.js`
Expected: FAIL — `NOINDEX` не експортується з `astro.config.mjs` (`SyntaxError: … does not provide an export named 'NOINDEX'`).

- [ ] **Step 4: Режим прев'ю в конфігу**

`astro.config.mjs` — після `BASE_PATH`:

```js
// Прев'ю-стенд (GitHub Pages зараз, Cloudflare Pages у Спеці 3) закритий від
// індексації: noindex на кожній сторінці (рішення 5 плану Етапу 3). Вмикає
// лише рівно 'true': продакшн-збірка без змінної індексується.
export const NOINDEX = process.env.SITE_NOINDEX === 'true';
```

і в `defineConfig({...})` додати:

```js
  vite: {
    // Константа для Seo.astro: той самий NOINDEX, що бачать тести.
    define: { __HOB_NOINDEX__: JSON.stringify(NOINDEX) },
  },
```

`src/env.d.ts`:

```ts
// Підставляє vite.define з astro.config.mjs (режим прев'ю, SITE_NOINDEX).
declare const __HOB_NOINDEX__: boolean;
```

- [ ] **Step 5: SEO-група для головної й сторінок**

`src/content.config.ts`, схема `homepage` — останнім полем після `footer: labels([...])`:

```ts
    // Спека 2: SEO-група в кожної сторінки. Необовʼязкова — без неї діють
    // фолбеки (Seo.astro).
    seo: seo.optional(),
```

схема `pages` — після `body: localized.nullable().optional(),`:

```ts
    seo: seo.optional(),
```

- [ ] **Step 6: `Seo.astro`**

`src/components/Seo.astro`:

```astro
---
import { getEntry, type CollectionEntry } from 'astro:content';
import { pick } from '../i18n';
import { resolveMeta, siteFallbackImage } from '../lib/seo.mjs';
import { breadcrumbNode, jsonLdScript } from '../lib/jsonld.mjs';

type SeoFields = CollectionEntry<'ministries'>['data']['seo'];

export interface Props {
  lang: 'uk' | 'en';
  // Шлях без локалі й base: «/ministries/youth/». З нього будуються і
  // canonical, і обидва hreflang — тому вони не можуть розійтися.
  path: string;
  // Видимий заголовок сторінки; <title> з нього — лише якщо немає metaTitle.
  title: string;
  // Текст-фолбек для description (summary, lead, перший абзац).
  description?: string;
  seo?: SeoFields | null;
  // Обкладинка галереї (src як у даних) — фолбек og:image.
  image?: string;
  breadcrumbs?: { name: string; href: string }[];
  jsonLd?: Record<string, unknown>[];
}

const { lang, path, title, description, seo, image, breadcrumbs, jsonLd = [] } = Astro.props;
const base = import.meta.env.BASE_URL;
const site = Astro.site!.href;
const settings = (await getEntry('site-settings', 'main'))!.data;
const home = (await getEntry('homepage', 'main'))!.data;

const meta = resolveMeta({
  site, base, lang, path, title, description, seo, image,
  siteName: pick(settings.name, lang),
  defaultDescription: pick(home.about.lead, lang),
  fallbackImage: siteFallbackImage(settings, home),
  noindex: __HOB_NOINDEX__,
});
const nodes = [
  ...jsonLd,
  ...(breadcrumbs ? [breadcrumbNode(breadcrumbs.map(({ name, href }) => ({ name, url: new URL(href, site).href })))] : []),
];
---
<title>{meta.title}</title>
<meta name="description" content={meta.description} />
{meta.noindex && <meta name="robots" content="noindex" />}
<link rel="canonical" href={meta.canonical} />
{meta.alternates.map(({ hreflang, href }) => <link rel="alternate" hreflang={hreflang} href={href} />)}
<meta property="og:type" content="website" />
<meta property="og:site_name" content={meta.siteName} />
<meta property="og:title" content={meta.title} />
<meta property="og:description" content={meta.description} />
<meta property="og:url" content={meta.canonical} />
<meta property="og:image" content={meta.image} />
<meta property="og:locale" content={meta.locale} />
<meta property="og:locale:alternate" content={meta.localeAlternate} />
<meta name="twitter:card" content="summary_large_image" />
{nodes.length > 0 && <script is:inline type="application/ld+json" set:html={jsonLdScript(nodes)} />}
```

- [ ] **Step 7: `Base.astro` і `SubPage.astro`**

`src/layouts/Base.astro` — повністю:

```astro
---
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/base.css';
import Seo, { type Props as SeoProps } from '../components/Seo.astro';

type Props = SeoProps;

const { lang } = Astro.props;
---
<!doctype html>
<html lang={lang}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Seo {...Astro.props} />
    <slot name="head" />
  </head>
  <body>
    <slot />
  </body>
</html>
```

`src/layouts/SubPage.astro` — повністю:

```astro
---
import Base from './Base.astro';
import SubHeader from '../components/SubHeader.astro';
import SubFooter from '../components/SubFooter.astro';
import type { Props as SeoProps } from '../components/Seo.astro';

interface Props {
  lang: 'uk' | 'en';
  title: string;
  path: string;
  back: { href: string; label: string };
  footBack: { href: string; label: string };
  description?: string;
  seo?: SeoProps['seo'];
  image?: string;
}

const { lang, title, path, back, footBack, description, seo, image } = Astro.props;
---
<Base lang={lang} title={title} path={path} description={description} seo={seo} image={image}>
  <SubHeader lang={lang} path={path} back={back} />
  <main>
    <slot />
  </main>
  <SubFooter lang={lang} back={footBack} />
</Base>
```

- [ ] **Step 8: Маршрути передають SEO-props**

Головна, `src/pages/[...lang]/index.astro`:

```astro
<Base lang={lang} title={p(settings.name)}>
```
→
```astro
<Base lang={lang} path="/" title={p(settings.name)} description={p(h.about.lead)} seo={h.seo}>
```

Сторінки з `pages.*` — додати імпорт у фронтматер (глибина відносного шляху як у сусідніх імпортів: `../../lib/seo.mjs` для файлів у `[...lang]/`, `../../../lib/seo.mjs` для `churches/`, `ministries/`, `projects/`):

```ts
import { pageDescription } from '../../lib/seo.mjs';
```

і два props у виклик `SubPage`:

- `about.astro`, `contacts.astro`, `donate.astro` — рядок `<SubPage lang={lang} title={pick(page.title, lang)} path="/about/"` (відповідно `/contacts/`, `/donate/`) доповнити наступним рядком:

  ```astro
    description={pageDescription(page, lang)} seo={page.seo}
  ```

- `leaders.astro`, `pastors.astro`, `testimonies.astro`, `churches/index.astro`, `ministries/index.astro`, `projects/index.astro` — після рядка `path="/…/"` додати:

  ```astro
    description={pageDescription(page, lang)}
    seo={page.seo}
  ```

Деталки (у кожній `coverImage` уже імпортовано):

- `ministries/[slug].astro`:

  ```astro
    title={`${name} — House of Bread Church`}
    path={`/ministries/${m.slug}/`}
  ```
  →
  ```astro
    title={name}
    path={`/ministries/${m.slug}/`}
    description={pick(m.summary, lang)}
    seo={m.seo}
    image={coverImage(m.media).src}
  ```

- `churches/[slug].astro`:

  ```astro
    title={pick(c.name, lang)}
    path={`/churches/${c.slug}/`}
  ```
  →
  ```astro
    title={pick(c.name, lang)}
    path={`/churches/${c.slug}/`}
    description={pick(c.lead, lang)}
    seo={c.seo}
    image={coverImage(c.media).src}
  ```

- `projects/[slug].astro`:

  ```astro
    title={title}
    path={`/projects/${p.slug}/`}
  ```
  →
  ```astro
    title={title}
    path={`/projects/${p.slug}/`}
    description={pick(p.lead, lang)}
    seo={p.seo}
    image={coverImage(p.media).src}
  ```

- [ ] **Step 9: Перевірка битих посилань бачить абсолютні адреси**

`tests/helpers/links.js` — додати імпорт і функцію, змінити `findBrokenLinks`:

```js
import { SITE_URL } from '../../astro.config.mjs';
```

```js
// canonical, hreflang, og:url і og:image — абсолютні (так вимагають
// пошуковики й Facebook) і як «зовнішні» оминули б перевірку. Адреси під
// коренем сайту перевіряємо як внутрішні: og:image на файл, якого немає,
// з адмінки мусить валити тести (CLAUDE.md, виняток контракту).
function absoluteRefs(root, siteRoot) {
  return [
    ...root.querySelectorAll('link[rel="canonical"], link[rel="alternate"]').map((el) => el.getAttribute('href')),
    ...root.querySelectorAll('meta[property="og:image"], meta[property="og:url"]').map((el) => el.getAttribute('content')),
  ].filter((ref) => ref?.startsWith(siteRoot)).map((ref) => new URL(ref).pathname);
}
```

```js
export function findBrokenLinks(dir, base, site = SITE_URL) {
  const siteRoot = new URL(base, site).href;
  const problems = [];
  for (const file of htmlFiles(dir)) {
    const from = pageUrl(dir, file, base);
    const root = parse(readFileSync(file, 'utf8'));
    for (const ref of [...internalRefs(root), ...absoluteRefs(root, siteRoot)]) {
```

(решта тіла циклу без змін).

`tests/build.test.js` — у пробі `verify-base`:

```js
      assert.deepEqual(findBrokenLinks(outDir, '/verify-base/'), []);
```
→
```js
      assert.deepEqual(findBrokenLinks(outDir, '/verify-base/', 'https://verify.invalid'), []);
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, включно з `tests/seo.test.js` (обидві проби) і наявними `build.test.js` (canonical головної) та `site.test.js`.

Додатково — режим прев'ю під підшляхом, як у CI (PowerShell):

```powershell
$env:SITE_URL='https://igorgnutov.github.io'; $env:BASE_PATH='/--House-of-Bread-Church-Website/'; $env:SITE_NOINDEX='true'; npm test; Remove-Item Env:SITE_URL, Env:BASE_PATH, Env:SITE_NOINDEX
```
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add astro.config.mjs src/env.d.ts src/content.config.ts src/components/Seo.astro src/layouts src/pages tests/helpers/seo.js tests/helpers/links.js tests/build.test.js tests/seo.test.js
git commit -m "feat: мета-теги, canonical, взаємні hreflang, OG і robots на кожній сторінці

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 3: JSON-LD — `Organization`, `Church`, `BreadcrumbList`

**Files:**
- Modify: `src/layouts/SubPage.astro`
- Modify: `src/pages/[...lang]/index.astro`
- Modify: `src/pages/[...lang]/churches/[slug].astro`, `ministries/[slug].astro`, `projects/[slug].astro`
- Modify: `tests/helpers/seo.js`
- Create: `tests/jsonld.test.js`

**Interfaces:**
- Consumes: `churchNode`, `organizationNode`, `openingHours` (Задача 1); `absoluteUrl` (Задача 1); props `breadcrumbs`, `jsonLd` у `Base.astro`/`Seo.astro` (Задача 2); `head()` (Задача 2).
- Produces:
  - `SubPage.astro` props: + `parent?: {href: string; label: string}` (проміжна ланка стежки), `crumb?: string` (підпис останньої ланки, за замовчуванням `title`), `jsonLd?`. `SubPage` завжди передає `Base` стежку `[головна, parent?, поточна]`.
  - `tests/helpers/seo.js`: `jsonLdScripts(root) → string[]` (сирий вміст), `jsonLd(root) → object[]` (усі вузли `@graph`).

- [ ] **Step 1: Хелпер тестів**

`tests/helpers/seo.js` — дописати:

```js
// Сирий вміст JSON-LD: перевіряємо і те, що він парситься, і те, що в ньому
// немає «<», який закрив би <script>.
export const jsonLdScripts = (root) =>
  root.querySelectorAll('script[type="application/ld+json"]').map((script) => script.rawText);

export const jsonLd = (root) => jsonLdScripts(root).flatMap((raw) => JSON.parse(raw)['@graph']);
```

- [ ] **Step 2: Write the failing test**

`tests/jsonld.test.js`:

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx astro build && node --test tests/jsonld.test.js`
Expected: FAIL — «рівно один JSON-LD»: `JSON-LD-скриптів 0`.

- [ ] **Step 4: Стежка в `SubPage.astro`**

`src/layouts/SubPage.astro` — повністю:

```astro
---
import Base from './Base.astro';
import SubHeader from '../components/SubHeader.astro';
import SubFooter from '../components/SubFooter.astro';
import type { Props as SeoProps } from '../components/Seo.astro';
import { t } from '../i18n';
import { localePath } from '../lib/paths.mjs';

interface Props {
  lang: 'uk' | 'en';
  title: string;
  path: string;
  back: { href: string; label: string };
  footBack: { href: string; label: string };
  description?: string;
  seo?: SeoProps['seo'];
  image?: string;
  jsonLd?: SeoProps['jsonLd'];
  // Проміжна ланка стежки (список розділу на деталках).
  parent?: { href: string; label: string };
  // Підпис останньої ланки, якщо він не заголовок (у церкви — місто).
  crumb?: string;
}

const { lang, title, path, back, footBack, description, seo, image, jsonLd, parent, crumb } = Astro.props;
const base = import.meta.env.BASE_URL;
// Рішення 10: ті самі підписи, що у видимих .crumbs, — Google звіряє
// розмітку з текстом сторінки.
const breadcrumbs = [
  { name: t(lang, 'crumb.home'), href: localePath(base, lang, '/') },
  ...(parent ? [{ name: parent.label, href: parent.href }] : []),
  { name: crumb ?? title, href: localePath(base, lang, path) },
];
---
<Base lang={lang} title={title} path={path} description={description} seo={seo} image={image} jsonLd={jsonLd} breadcrumbs={breadcrumbs}>
  <SubHeader lang={lang} path={path} back={back} />
  <main>
    <slot />
  </main>
  <SubFooter lang={lang} back={footBack} />
</Base>
```

- [ ] **Step 5: Деталки передають `parent` (і церква — `crumb`)**

`ministries/[slug].astro` — у фронтматер після `const tel = …`:

```ts
const parent = { href: list, label: t(lang, 'crumb.ministries') };
```

у виклик `SubPage` додати `parent={parent}`, а видимі крихти перевести на ту саму константу:

```astro
    <Crumbs lang={lang} parent={{ href: list, label: t(lang, 'crumb.ministries') }} current={name} />
```
→
```astro
    <Crumbs lang={lang} parent={parent} current={name} />
```

`projects/[slug].astro` — так само з `t(lang, 'crumb.projects')` і `current={title}`.

`churches/[slug].astro` — так само з `t(lang, 'crumb.churches')` і `current={city}`, а в `SubPage` ще `crumb={city}`.

- [ ] **Step 6: `Church` на сторінці церкви**

`churches/[slug].astro` — імпорти:

```ts
import { churchNode, openingHours } from '../../../lib/jsonld.mjs';
import { absoluteUrl } from '../../../lib/seo.mjs';
```

у фронтматер після `const directions = …`:

```ts
const site = Astro.site!.href;
const cover = coverImage(c.media);
// @id — з української адреси: обидві мовні сторінки описують ту саму церкву.
const jsonLd = [churchNode({
  id: `${new URL(localePath(base, 'uk', `/churches/${c.slug}/`), site).href}#church`,
  url: new URL(localePath(base, lang, `/churches/${c.slug}/`), site).href,
  name: pick(c.name, lang),
  image: absoluteUrl(site, base, cover.src),
  street: pick(c.address, lang),
  city,
  geo: c.geo,
  hours: openingHours(c.times.en),
})];
```

у `SubPage`: `image={coverImage(c.media).src}` → `image={cover.src}` і додати `jsonLd={jsonLd}`.

- [ ] **Step 7: `Organization` і `Church` на головній**

`index.astro` — імпорти:

```ts
import { churchNode, openingHours, organizationNode } from '../../lib/jsonld.mjs';
import { absoluteUrl } from '../../lib/seo.mjs';
```

у фронтматер перед `const BELIEF_MARK = …`:

```ts
// Спека 2, JSON-LD: картка в локальній видачі — з тих самих contact-info і
// site-settings, що й контакти на сторінці. @id — з української адреси:
// обидві мови описують ту саму організацію й ту саму церкву.
const site = Astro.site!.href;
const homeUrl = new URL(localePath(base, lang, '/'), site).href;
const entityId = new URL(localePath(base, 'uk', '/'), site).href;
const sameAs = Object.values(settings.social);
const jsonLd = [
  organizationNode({
    id: `${entityId}#organization`, url: homeUrl, name: p(settings.name),
    logo: absoluteUrl(site, base, settings.logo[lang]), telephone: contact.phone, email: contact.email, sameAs,
  }),
  churchNode({
    id: `${entityId}#church`, url: homeUrl, name: p(settings.name),
    image: absoluteUrl(site, base, h.heroImage.src), street: p(contact.address), city: p(contact.city),
    geo: contact.geo, hours: openingHours(`${contact.serviceDay.en} ${contact.serviceTime}`),
    telephone: contact.phone, email: contact.email, sameAs,
  }),
];
```

і `<Base … seo={h.seo}>` → `<Base … seo={h.seo} jsonLd={jsonLd}>`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, включно з `tests/jsonld.test.js` і пробою.

- [ ] **Step 9: Commit**

```bash
git add src/layouts/SubPage.astro src/pages tests/helpers/seo.js tests/jsonld.test.js
git commit -m "feat: JSON-LD — Organization і Church на головній, Church церков, стежка на підсторінках

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 4: `sitemap.xml`, `robots.txt`, `.htaccess`

**Files:**
- Create: `src/lib/seo-files.mjs`
- Create: `src/integrations/seo-files.mjs`
- Modify: `astro.config.mjs`, `package.json`, `package-lock.json`
- Modify: `tests/helpers/seo.js`, `tests/seo.test.js` (проба прев'ю)
- Create: `tests/seo-files.test.js`

**Interfaces:**
- Consumes: `NOINDEX`, `SITE_URL`, `BASE_PATH` (`astro.config.mjs`); `head()` (Задача 2); `<link rel="canonical">`, `<link rel="alternate" hreflang>`, `<meta name="robots">` у кожній сторінці (Задача 2).
- Produces (`src/lib/seo-files.mjs`):
  - `robotsTxt({ sitemapUrl: string, noindex: boolean }): string`
  - `pageEntry(html: string): { loc, noindex: boolean, alternates: {hreflang, href}[] } | null`
  - `sitemapEntries(pages): { loc, alternates }[]` — без `noindex`, альтернативи лише на сторінки з мапи, сортування за `loc`
  - `sitemapXml(entries): string`
  - `LEGACY_LISTS`, `LEGACY_DETAILS: [legacyFile: string, target: string][]`
  - `htaccess({ base: string }): string`
- Produces: `src/integrations/seo-files.mjs` — `export default function seoFiles({ site, base, noindex })` → інтеграція Astro, що пише `robots.txt`, `.htaccess` і (не в прев'ю) `sitemap.xml` у `outDir`.
- Produces: `tests/helpers/seo.js` — `parseSitemap(xml) → { loc, alternates: Record<hreflang, href> }[]`.

- [ ] **Step 1: Хелпер тестів**

`tests/helpers/seo.js` — дописати:

```js
// sitemap.xml пише наш власний генератор з фіксованою розміткою, тож
// регулярних виразів досить — XML-парсер тут не потрібен.
export function parseSitemap(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: body.match(/<loc>([^<]+)<\/loc>/)[1],
    alternates: Object.fromEntries(
      [...body.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g)].map(([, lang, href]) => [lang, href]),
    ),
  }));
}
```

- [ ] **Step 2: Write the failing test**

`tests/seo-files.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from 'node-html-parser';
import { BASE_PATH, NOINDEX, SITE_URL } from '../astro.config.mjs';
import { distDir, distPath } from './helpers/dist.js';
import { htmlFiles } from './helpers/links.js';
import { withBuild } from './helpers/build.js';
import { ministry } from './helpers/probes.js';
import { head, parseSitemap } from './helpers/seo.js';
import {
  LEGACY_DETAILS, LEGACY_LISTS, htaccess, pageEntry, robotsTxt, sitemapEntries, sitemapXml,
} from '../src/lib/seo-files.mjs';

const T = { timeout: 180_000 };
const pair = (uk, en = uk) => ({ uk, en });
const abs = (rel) => new URL(`${BASE_PATH}${rel}`, SITE_URL).href;
const escapeRe = (file) => file.replace(/\./g, '\\.');

test('robotsTxt: продакшн — дозволено все й посилання на мапу, прев\'ю — закрито все', () => {
  assert.equal(robotsTxt({ sitemapUrl: 'https://example.org/sitemap.xml', noindex: false }),
    'User-agent: *\nAllow: /\n\nSitemap: https://example.org/sitemap.xml\n');
  assert.equal(robotsTxt({ sitemapUrl: 'https://example.org/sitemap.xml', noindex: true }), 'User-agent: *\nDisallow: /\n');
});

test('pageEntry: canonical, hreflang і robots зі сторінки; без canonical — null', () => {
  const html = `<html><head>
    <meta name="robots" content="noindex">
    <link rel="canonical" href="https://example.org/a/">
    <link rel="alternate" hreflang="uk" href="https://example.org/a/">
    <link rel="alternate" hreflang="en" href="https://example.org/en/a/">
    </head><body><a hreflang="en" href="/en/a/">EN</a></body></html>`;
  assert.deepEqual(pageEntry(html), {
    loc: 'https://example.org/a/',
    noindex: true,
    alternates: [{ hreflang: 'uk', href: 'https://example.org/a/' }, { hreflang: 'en', href: 'https://example.org/en/a/' }],
  });
  assert.equal(pageEntry('<html><head></head></html>'), null);
});

test('sitemapEntries: без noindex, альтернативи лише на сторінки з мапи, порядок стабільний', () => {
  const alt = (uk, en) => [{ hreflang: 'uk', href: uk }, { hreflang: 'en', href: en }, { hreflang: 'x-default', href: uk }];
  const entries = sitemapEntries([
    { loc: 'https://e.org/en/b/', noindex: false, alternates: alt('https://e.org/b/', 'https://e.org/en/b/') },
    { loc: 'https://e.org/b/', noindex: true, alternates: alt('https://e.org/b/', 'https://e.org/en/b/') },
    { loc: 'https://e.org/a/', noindex: false, alternates: alt('https://e.org/a/', 'https://e.org/en/a/') },
    null,
  ]);
  assert.deepEqual(entries, [
    { loc: 'https://e.org/a/', alternates: [] },
    { loc: 'https://e.org/en/b/', alternates: [{ hreflang: 'en', href: 'https://e.org/en/b/' }] },
  ]);
});

test('sitemapXml: urlset з xhtml:link і екранування', () => {
  const xml = sitemapXml([{ loc: 'https://e.org/a/?x=1&y=2', alternates: [{ hreflang: 'uk', href: 'https://e.org/a/' }] }]);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'));
  assert.ok(xml.includes('<loc>https://e.org/a/?x=1&amp;y=2</loc>'));
  assert.ok(xml.includes('<xhtml:link rel="alternate" hreflang="uk" href="https://e.org/a/"/>'));
  assert.ok(xml.trimEnd().endsWith('</urlset>'));
});

test('htaccess: base, канонічний хост, https і 301 зі всіх легасі-адрес — без домену у файлі', () => {
  const text = htaccess({ base: '/sub/' });
  assert.match(text, /^RewriteBase \/sub\/$/m);
  assert.match(text, /^RewriteCond %\{HTTP_HOST\} \^www\\\.\(\.\+\)\$ \[NC\]$/m);
  assert.match(text, /^RewriteCond %\{HTTPS\} !=on$/m);
  for (const [from, to] of LEGACY_DETAILS) {
    assert.ok(text.includes(`RewriteRule ^${escapeRe(from)}$ /sub/${to}%2/? [R=301,L]`), `${from}?id=…`);
    assert.ok(text.includes(`RewriteRule ^${escapeRe(from)}$ /sub/${to}? [R=301,L]`), `${from} без id`);
  }
  for (const [from, to] of LEGACY_LISTS) {
    assert.ok(text.includes(`RewriteRule ^${escapeRe(from)}$ /sub/${to}? [R=301,L]`), from);
  }
  assert.doesNotMatch(text, /invalid|github\.io|houseofbread/, 'домен у .htaccess');
});

test('легасі-редиректи покривають усі 10 старих сторінок і ведуть на зібрані', () => {
  // Набір легасі-файлів — історія (видалені в кутовері Етапу 2), він не зміниться.
  const legacy = ['index.html', ...LEGACY_LISTS.map(([from]) => from), ...LEGACY_DETAILS.map(([from]) => from)].sort();
  assert.deepEqual(legacy, [
    'church.dc.html', 'churches.dc.html', 'index.html', 'leaders.dc.html', 'ministries.dc.html',
    'ministry.dc.html', 'pastors.dc.html', 'project.dc.html', 'projects.dc.html', 'testimonies.dc.html',
  ]);
  for (const [, to] of [...LEGACY_LISTS, ...LEGACY_DETAILS]) {
    assert.ok(existsSync(distPath(`${to}index.html`)), `редирект на ${to}, а такої сторінки немає`);
  }
});

test('dist: .htaccess із base збірки; усі CSS/JS — у _astro/, тож «immutable» безпечний', () => {
  const text = readFileSync(distPath('.htaccess'), 'utf8');
  assert.ok(text.includes(`RewriteBase ${BASE_PATH}`));
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  for (const file of walk(distDir).filter((f) => /\.(css|js)$/.test(f))) {
    const rel = relative(distDir, file).split(sep).join('/');
    assert.match(rel, /^_astro\//, `${rel}: CSS/JS поза _astro/ отримав би рік кешу без хешу в імені`);
  }
});

test('канонічний хост SITE_URL — без www (Спека 2)', () => {
  assert.doesNotMatch(new URL(SITE_URL).hostname, /^www\./);
});

test('dist: robots.txt і sitemap.xml відповідають режиму збірки', () => {
  const robots = readFileSync(distPath('robots.txt'), 'utf8');
  if (NOINDEX) {
    assert.equal(robots, robotsTxt({ sitemapUrl: abs('sitemap.xml'), noindex: true }));
    assert.equal(existsSync(distPath('sitemap.xml')), false, 'прев\'ю не публікує мапу');
    return;
  }
  assert.equal(robots, robotsTxt({ sitemapUrl: abs('sitemap.xml'), noindex: false }));
  const urls = parseSitemap(readFileSync(distPath('sitemap.xml'), 'utf8'));
  const pages = htmlFiles(distDir).map((file) => head(parse(readFileSync(file, 'utf8'))));
  const indexable = pages.filter((h) => h.robots !== 'noindex');
  assert.deepEqual(urls.map((u) => u.loc).sort(), indexable.map((h) => h.canonical).sort(), 'мапа ≠ сторінки без noindex');
  for (const u of urls) {
    const page = indexable.find((h) => h.canonical === u.loc);
    assert.deepEqual(u.alternates, page.alternates, `${u.loc}: hreflang у мапі ≠ hreflang на сторінці`);
  }
});

test('проба продакшну: noindex-запис поза мапою, увімкнена сторінка в ній, порожня колекція — лише список', T, () => {
  withBuild((content) => {
    content.write('ministries', 'map-hidden', ministry('map-hidden', {
      seo: { metaTitle: null, metaDescription: null, ogImage: null, noindex: true },
    }));
    content.clear('projects');
    content.editSingleton('pages', (pages) => { pages.about.body = pair('Текст про церкву.', 'About the church.'); });
  }, (result) => {
    assert.equal(result.failed, false, result.output.slice(-3000));
    const urls = parseSitemap(readFileSync(join(result.outDir, 'sitemap.xml'), 'utf8'));
    const locs = new Set(urls.map((u) => u.loc));
    for (const prefix of ['', 'en/']) {
      assert.equal(locs.has(abs(`${prefix}ministries/map-hidden/`)), false, `${prefix}: noindex-запис у мапі`);
      assert.ok(locs.has(abs(`${prefix}about/`)), `${prefix}: увімкненої сторінки немає в мапі`);
      assert.ok(locs.has(abs(`${prefix}projects/`)), `${prefix}: список проєктів зник з мапи`);
      assert.equal([...locs].some((l) => l.startsWith(abs(`${prefix}projects/`)) && l !== abs(`${prefix}projects/`)), false,
        `${prefix}: деталка проєкту без записів`);
    }
    for (const u of urls) {
      assert.deepEqual(Object.keys(u.alternates).sort(), ['en', 'uk', 'x-default'], `${u.loc}: набір hreflang`);
      for (const href of Object.values(u.alternates)) assert.ok(locs.has(href), `${u.loc}: hreflang ${href} поза мапою`);
    }
    assert.ok(readFileSync(join(result.outDir, 'robots.txt'), 'utf8').includes(`Sitemap: ${abs('sitemap.xml')}`));
  }, { env: { SITE_NOINDEX: 'false' } });
});
```

У `tests/seo.test.js`, у пробі прев'ю, після циклу по сторінках дописати:

```js
    assert.equal(existsSync(join(result.outDir, 'sitemap.xml')), false, 'прев\'ю не публікує мапу');
    assert.equal(readFileSync(join(result.outDir, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
```

і доповнити імпорти файлу: `existsSync` з `node:fs`, `join` з `node:path`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx astro build && node --test tests/seo-files.test.js`
Expected: FAIL — `Cannot find module '…/src/lib/seo-files.mjs'`.

- [ ] **Step 4: Генератори**

`node-html-parser` тепер потрібен самій збірці:

Run: `npm install --save node-html-parser@^7.1.0`
Expected: пакет переїхав у `dependencies` у `package.json`, `package-lock.json` оновлено.

`src/lib/seo-files.mjs`:

```js
import { parse } from 'node-html-parser';

// Рішення 5: прев'ю закрите повністю, продакшн — відкритий і вказує на мапу.
export const robotsTxt = ({ sitemapUrl, noindex }) =>
  (noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`);

// Рішення 6: мапа будується з готових сторінок — їхні canonical, hreflang і
// robots уже пораховані Seo.astro, тож мапа не може з ними розійтися.
export function pageEntry(html) {
  const root = parse(html);
  const loc = root.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (!loc) return null;
  return {
    loc,
    noindex: /noindex/i.test(root.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''),
    alternates: root.querySelectorAll('link[rel="alternate"][hreflang]')
      .map((link) => ({ hreflang: link.getAttribute('hreflang'), href: link.getAttribute('href') })),
  };
}

// Альтернатива на сторінку поза мапою (закриту noindex) — суперечливий
// сигнал пошуковику; такі посилання з мапи прибираємо.
export function sitemapEntries(pages) {
  const indexable = pages.filter((page) => page && !page.noindex);
  const locs = new Set(indexable.map((page) => page.loc));
  return indexable
    .map(({ loc, alternates }) => ({ loc, alternates: alternates.filter(({ href }) => locs.has(href)) }))
    .sort((a, b) => (a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0));
}

const xml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(({ loc, alternates }) => [
      '  <url>',
      `    <loc>${xml(loc)}</loc>`,
      ...alternates.map(({ hreflang, href }) => `    <xhtml:link rel="alternate" hreflang="${xml(hreflang)}" href="${xml(href)}"/>`),
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n');
}

// Рішення 12: 301 зі старих адрес. Мова в легасі в адресі не жила
// (localStorage), тож усе веде на українську.
export const LEGACY_LISTS = [
  ['ministries.dc.html', 'ministries/'],
  ['churches.dc.html', 'churches/'],
  ['projects.dc.html', 'projects/'],
  ['testimonies.dc.html', 'testimonies/'],
  ['pastors.dc.html', 'pastors/'],
  ['leaders.dc.html', 'leaders/'],
];
export const LEGACY_DETAILS = [
  ['ministry.dc.html', 'ministries/'],
  ['church.dc.html', 'churches/'],
  ['project.dc.html', 'projects/'],
];

const escapeRe = (file) => file.replace(/\./g, '\\.');
const TEXT_TYPES = 'text/html text/css text/plain text/xml application/xml application/javascript text/javascript application/json image/svg+xml';

// Apache / OpenLiteSpeed на ukraine.com.ua (Спека 2, «Технічні файли»).
// GitHub Pages цей файл ігнорує. Домену у файлі немає свідомо (рішення 8).
export function htaccess({ base }) {
  return [
    '# Згенеровано збіркою (src/lib/seo-files.mjs). Правки — там, не в dist.',
    'AddDefaultCharset utf-8',
    'AddType font/woff2 .woff2',
    'Options -Indexes -MultiViews',
    'DirectoryIndex index.html',
    '',
    '<IfModule mod_rewrite.c>',
    'RewriteEngine On',
    `RewriteBase ${base}`,
    '',
    '# Канонічний хост — без www; одразу на https, щоб не робити два стрибки.',
    'RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]',
    'RewriteRule ^ https://%1%{REQUEST_URI} [R=301,L]',
    '',
    '# http → https. X-Forwarded-Proto — на випадок, коли TLS знімає проксі',
    '# хостингу: без цієї умови сайт за проксі редіректив би сам на себе.',
    'RewriteCond %{HTTPS} !=on',
    'RewriteCond %{HTTP:X-Forwarded-Proto} !=https',
    'RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]',
    '',
    '# …/index.html → …/. Дивимось THE_REQUEST (що попросив браузер), інакше',
    '# внутрішній підзапит DirectoryIndex зациклився б.',
    'RewriteCond %{THE_REQUEST} ^[A-Z]+\\s(\\S*/)index\\.html[\\s?]',
    'RewriteRule ^ %1 [R=301,L]',
    '',
    '# Легасі-деталки: ?id=<slug> → /<розділ>/<slug>/, без id — на список.',
    '# «?» у кінці цілі відкидає старий query string.',
    ...LEGACY_DETAILS.flatMap(([from, to]) => [
      'RewriteCond %{QUERY_STRING} (^|&)id=([a-z0-9-]+)',
      `RewriteRule ^${escapeRe(from)}$ ${base}${to}%2/? [R=301,L]`,
      `RewriteRule ^${escapeRe(from)}$ ${base}${to}? [R=301,L]`,
    ]),
    '# Легасі-списки.',
    ...LEGACY_LISTS.map(([from, to]) => `RewriteRule ^${escapeRe(from)}$ ${base}${to}? [R=301,L]`),
    '',
    '# Кінцевий слеш для тек: /ministries → /ministries/.',
    'RewriteCond %{REQUEST_FILENAME} -d',
    `RewriteRule ^(.*[^/])$ ${base}$1/ [R=301,L]`,
    '</IfModule>',
    '',
    '<IfModule mod_headers.c>',
    '# CSS і JS збірка кладе лише в _astro/ з хешем в імені — кешуються назавжди.',
    '<FilesMatch "\\.(css|js)$">',
    '  Header set Cache-Control "public, max-age=31536000, immutable"',
    '</FilesMatch>',
    '<FilesMatch "\\.woff2$">',
    '  Header set Cache-Control "public, max-age=31536000"',
    '</FilesMatch>',
    '# Редактор може замінити завантаження під тим самим імʼям — місяць, не рік.',
    '<FilesMatch "\\.(jpe?g|png|webp|avif|gif|svg|ico)$">',
    '  Header set Cache-Control "public, max-age=2592000"',
    '</FilesMatch>',
    '# HTML, мапа, robots — щоразу перевіряти: публікація має бути видна одразу.',
    '<FilesMatch "\\.(html|xml|txt)$">',
    '  Header set Cache-Control "no-cache"',
    '</FilesMatch>',
    '</IfModule>',
    '',
    '<IfModule mod_brotli.c>',
    `  AddOutputFilterByType BROTLI_COMPRESS ${TEXT_TYPES}`,
    '</IfModule>',
    '<IfModule mod_deflate.c>',
    `  AddOutputFilterByType DEFLATE ${TEXT_TYPES}`,
    '</IfModule>',
    '',
  ].join('\n');
}
```

- [ ] **Step 5: Інтеграція**

`src/integrations/seo-files.mjs`:

```js
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htaccess, pageEntry, robotsTxt, sitemapEntries, sitemapXml } from '../lib/seo-files.mjs';

const htmlFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return htmlFiles(path);
  return entry.name.endsWith('.html') ? [path] : [];
});

// Рішення 7: файли залежать від SITE_URL/BASE_PATH/SITE_NOINDEX, тому
// пишуться після збірки у фактичну outDir, а не лежать у public/.
export default function seoFiles({ site, base, noindex }) {
  return {
    name: 'hob-seo-files',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const out = fileURLToPath(dir);
        writeFileSync(join(out, 'robots.txt'), robotsTxt({ sitemapUrl: new URL(`${base}sitemap.xml`, site).href, noindex }));
        writeFileSync(join(out, '.htaccess'), htaccess({ base }));
        // У прев'ю кожна сторінка noindex — мапа була б порожньою й лише
        // заохочувала б робота сканувати стенд.
        if (noindex) return;
        const pages = htmlFiles(out).map((file) => pageEntry(readFileSync(file, 'utf8')));
        writeFileSync(join(out, 'sitemap.xml'), sitemapXml(sitemapEntries(pages)));
      },
    },
  };
}
```

`astro.config.mjs` — імпорт угорі:

```js
import seoFiles from './src/integrations/seo-files.mjs';
```

і в `defineConfig({...})`:

```js
  integrations: [seoFiles({ site: SITE_URL, base: BASE_PATH, noindex: NOINDEX })],
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, включно з `tests/seo-files.test.js` і доповненою пробою прев'ю в `tests/seo.test.js`.

Режим CI (PowerShell):

```powershell
$env:SITE_URL='https://igorgnutov.github.io'; $env:BASE_PATH='/--House-of-Bread-Church-Website/'; $env:SITE_NOINDEX='true'; npm test; Remove-Item Env:SITE_URL, Env:BASE_PATH, Env:SITE_NOINDEX
```
Expected: PASS.

Прочитати `dist/sitemap.xml`, `dist/robots.txt`, `dist/.htaccess` після звичайного `npm run build` очима: мапа містить обидві мови з трьома `xhtml:link` у кожному `<url>`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/seo-files.mjs src/integrations/seo-files.mjs astro.config.mjs package.json package-lock.json tests/helpers/seo.js tests/seo.test.js tests/seo-files.test.js
git commit -m "feat: sitemap.xml з готових сторінок, robots.txt і .htaccess зі збірки

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 5: прев'ю закрите в деплої, документація, чекліст запуску

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/notes/2026-09-23-content-gaps.md`
- Create: `docs/superpowers/notes/2026-09-23-seo-launch-checklist.md`
- Modify: `docs/superpowers/specs/2026-09-22-02-seo-design.md` (розділ «Критерії готовності»)

**Interfaces:**
- Consumes: усе з Задач 1–4.
- Produces: деплой на GitHub Pages у режимі прев'ю; задокументований SEO-шар.

- [ ] **Step 1: Деплой у режимі прев'ю**

`.github/workflows/deploy.yml`, крок `Build and verify output`, у `env:` після `BASE_PATH`:

```yaml
          # Прев'ю-стенд закритий від індексації (Спека 2): noindex на кожній
          # сторінці, robots.txt з Disallow, без sitemap. Продакшн-збірка на
          # домені — без цієї змінної.
          SITE_NOINDEX: 'true'
```

- [ ] **Step 2: `CLAUDE.md`**

Після розділу `## Styling` додати:

```markdown
## SEO

`<head>` comes from `src/components/Seo.astro` (via `Base.astro`): title, description, canonical,
reciprocal `hreflang` (uk / en / x-default → uk), OG + Twitter, `robots`, and one JSON-LD `@graph`.
Every route passes `path` (without locale or base), its visible `title` and a fallback `description`;
records also pass their `seo` group and gallery cover (`image`). Fallbacks (`resolveMeta` in
`src/lib/seo.mjs`): `seo.metaTitle` → `<title> — <site name>`; `seo.metaDescription` → summary / lead /
first body paragraph → `homepage.about.lead`, cut to 160 chars; `seo.ogImage` → gallery cover →
`site-settings.defaultOgImage` → hero photo. Editor-filled SEO fields are used verbatim. JSON-LD nodes
live in `src/lib/jsonld.mjs`: `Organization` + `Church` on the homepage, `Church` on church pages,
`BreadcrumbList` on every sub-page (built by `SubPage.astro`, same labels as the visible crumbs).
`robots.txt`, `.htaccess` and `sitemap.xml` (built from the pages' own canonical / hreflang / robots)
are written after the build by `src/integrations/seo-files.mjs`. `SITE_NOINDEX=true` (the GitHub Pages
preview) puts `noindex` on every page, `Disallow: /` in robots.txt and skips the sitemap.
Launch checks for the production domain: `docs/superpowers/notes/2026-09-23-seo-launch-checklist.md`.
```

У розділі `## Commands` після рядка про `SITE_URL=… BASE_PATH=/sub/ npm test` додати:
`` - Preview mode (as in CI): add `SITE_NOINDEX=true`. ``

У розділі `## Content`, у переліку винятку контракту, `(`uploads/…` in a photo, poster, hero image, gallery `src` or resource `url`` доповнити на `(`uploads/…` in a photo, poster, hero image, gallery `src`, resource `url`, `seo.ogImage` or `defaultOgImage``.

У розділі `## Deploy` доповнити першу фразу: `` … → `npm test` with the Pages `SITE_URL`/`BASE_PATH` and `SITE_NOINDEX=true` → GitHub Pages. ``

Розділ `## Next` замінити на:

```markdown
## Next

Stage 4 (Spec 3): Storyblok model and data import. Before launch on the domain: production deploy
(Stage 0 plan, Task 5) and the SEO launch checklist. Open content gaps for the customer:
`docs/superpowers/notes/2026-09-23-content-gaps.md`.
```

- [ ] **Step 3: Дірки контенту**

`docs/superpowers/notes/2026-09-23-content-gaps.md`:

- у рядку 1 у колонку «Наслідок» дописати: `**Етап 3:** JSON-LD `Church` виводить `geo`, щойно координати зʼявляться; поки `null` — розмітка без координат, картка в локальній видачі слабша.`
- у рядку 4 дописати: `**Етап 3:** фолбеки працюють (назва/опис/обкладинка); SEO-група тепер є й у `pages.*` та `homepage` (необовʼязкова).`
- дописати рядки таблиці:

```markdown
| 23 | `site-settings.defaultOgImage` — `null` | `site-settings` | картка при поширенні сторінки без галереї (головна, списки, пастори, лідери) бере фото героя з хрестом; потрібна брендова картинка 1200×630 |
| 24 | У більшості церков час служіння без часу закінчення («Sunday · 10:00») | `churches/*.json` → `times` | `openingHours` у JSON-LD цих церков не виводиться (вигадувати кінець не можна, рішення 9 Етапу 3); у форматі «День · ЧЧ:ХХ–ЧЧ:ХХ» зʼявиться сам |
| 25 | `<title>` головної — лише «Дім Хліба» / «House of Bread Church» | `homepage.seo.metaTitle` (поля ще немає в даних) | головна не містить наміру «церква Кривий Ріг» (Спека 2, «Розподіл цільових запитів»); напр. «Дім Хліба — християнська церква в Кривому Розі» — формулювання замовника |
```

- [ ] **Step 4: Чекліст запуску**

`docs/superpowers/notes/2026-09-23-seo-launch-checklist.md`:

````markdown
# Чекліст SEO в день запуску на домені

Поведінку `.htaccess`, картки Facebook і валідність розмітки неможливо перевірити
локально (Етап 3, рішення 14). Прогнати один раз після першого продакшн-деплою
(Етап 0, Задача 5), підставивши домен замість `example.org`.

## Збірка

- [ ] Продакшн-збірка: `SITE_URL=https://example.org`, `BASE_PATH=/`, **без** `SITE_NOINDEX`.
- [ ] `https://example.org/robots.txt` — `Allow: /` і `Sitemap: https://example.org/sitemap.xml`.
- [ ] На будь-якій сторінці **немає** `<meta name="robots" content="noindex">`.

## Редиректи й заголовки

```sh
curl -sI http://example.org/                             # 301 → https://example.org/
curl -sI https://www.example.org/ministries/             # 301 → https://example.org/ministries/
curl -sI https://example.org/ministries                  # 301 → https://example.org/ministries/
curl -sI https://example.org/index.html                  # 301 → https://example.org/
curl -sI https://example.org/ministries/index.html       # 301 → https://example.org/ministries/
curl -sI "https://example.org/ministry.dc.html?id=youth" # 301 → https://example.org/ministries/youth/
curl -sI https://example.org/church.dc.html              # 301 → https://example.org/churches/
curl -sI https://example.org/pastors.dc.html             # 301 → https://example.org/pastors/
curl -sI https://example.org/                            # 200, Cache-Control: no-cache
curl -sI -H 'Accept-Encoding: br, gzip' https://example.org/   # Content-Encoding: br або gzip
```

- [ ] Будь-який `https://example.org/_astro/*.css` — `Cache-Control: public, max-age=31536000, immutable`.
- [ ] Жодного ланцюжка з більш ніж одного 301 і жодного циклу (`curl -sIL`).

## Розмітка й картки

- [ ] Facebook Sharing Debugger: `/`, `/en/`, одна сторінка служіння — заголовок, опис і картинка підтягуються.
- [ ] validator.schema.org: `/` (Organization, Church), сторінка церкви (Church), сторінка служіння (BreadcrumbList) — без помилок.

## Search Console

- [ ] Додати ресурс домену, надіслати `sitemap.xml`.
- [ ] Через 1–2 тижні: у звіті індексування є обидві мови; немає помилок `hreflang`.
````

- [ ] **Step 5: Критерії готовності в спеці**

`docs/superpowers/specs/2026-09-22-02-seo-design.md`, розділ «Критерії готовності» — позначити `[x]` пункти: нові URL обох локалей; `<title>` і `description`; `canonical` і взаємні `hreflang`; JSON-LD; `sitemap.xml` і `robots.txt`; перемикач мов; прев'ю закритий. Пункти про картку Facebook і `.htaccess` лишити `[ ]` і дописати до кожного: ` — теги/правила є; перевірка на домені: [чекліст](../notes/2026-09-23-seo-launch-checklist.md)`.

- [ ] **Step 6: Фінальна перевірка обох режимів**

Run: `npm test`
Expected: PASS.

Режим CI (PowerShell):

```powershell
$env:SITE_URL='https://igorgnutov.github.io'; $env:BASE_PATH='/--House-of-Bread-Church-Website/'; $env:SITE_NOINDEX='true'; npm test; Remove-Item Env:SITE_URL, Env:BASE_PATH, Env:SITE_NOINDEX
```
Expected: PASS.

Run: `npm run e2e`
Expected: PASS (видимий інтерфейс не змінювався).

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/deploy.yml CLAUDE.md docs/superpowers
git commit -m "chore: прев'ю закрите від індексації, SEO в CLAUDE.md, чекліст запуску

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Критерії готовності Етапу 3

- [ ] `npm test` зелений і локально (продакшн-режим), і в режимі CI (підшлях + `SITE_NOINDEX=true`); `npm run e2e` зелений.
- [ ] На кожній сторінці обох мов: `<title>`, `description`, canonical на себе, взаємні `hreflang` uk/en/x-default, OG з абсолютною `og:image`, рівно один JSON-LD.
- [ ] SEO-поля редактора перекривають фолбеки дослівно; `noindex` запису закриває обидві мови й прибирає їх з мапи (проби).
- [ ] `sitemap.xml` = усі сторінки без `noindex`, з тими самими `hreflang`, що на сторінках; `robots.txt` на неї посилається.
- [ ] `.htaccess` у `dist/`: HTTPS, без `www`, кінцевий слеш, `index.html`, 301 з 10 легасі-адрес, кеш, стиснення.
- [ ] GitHub Pages-збірка — `noindex` на кожній сторінці, `Disallow: /`, без мапи.
- [ ] Вигляд сторінок не змінився.
