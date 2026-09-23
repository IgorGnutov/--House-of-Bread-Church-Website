# Етап 0: каркас Astro і наскрізний деплой — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Порожня сторінка сайту автоматично збирається з Astro і опиняється в ефірі під HTTPS — без відомого доменного імені.

**Architecture:** Astro зі статичною збіркою. Адреса сайту існує в проєкті рівно у двох змінних оточення, які читає `astro.config.mjs`: `SITE_URL` (походження) і `BASE_PATH` (підшлях). Доки домену немає, `SITE_URL` має значення-заглушку `https://dim-hliba.invalid` (TLD `.invalid` зарезервований RFC 2606, тому випадковий витік у продакшн буде очевидно зламаним, а не тихо неправильним). Наскрізний деплой перевіряється на GitHub Pages — репозиторій уже на GitHub, тож це нуль нових акаунтів і секретів.

**Чому `BASE_PATH` — окрема змінна.** GitHub Pages віддає сторінки проєкту не з кореня, а з `/--House-of-Bread-Church-Website/`. Продакшн на власному домені віддаватиме з кореня. Якщо зашити підшлях, продакшн зламається; якщо проігнорувати — зламається прев'ю. Тому підшлях — змінна (`'/'` за замовчуванням), і кожне посилання на ассет мусить пережити обидва значення. Це перевіряється тестом, який збирає сайт із заданим `BASE_PATH` і дивиться, що вийшло в `dist/`.

**Tech Stack:** Astro 5 (статичний вивід), Node 22 LTS у CI (локально 25.8.0), `node:test` (вбудований, без залежностей) як тестовий раннер, GitHub Actions + `actions/deploy-pages`.

**Spec:** [2026-09-22-01-astro-migration-design.md](../specs/2026-09-22-01-astro-migration-design.md), розділи «Цільова структура», «Маршрутизація і локалі», «CSS», «Деплой», «Етапи» (рядок «Етап 0»).
Вхідні дані про URL і локалі — [2026-09-22-02-seo-design.md](../specs/2026-09-22-02-seo-design.md), розділи «Структура URL» і «Локалі та hreflang».

## Global Constraints

- **Домен невідомий.** Жодного абсолютного URL у коді. Єдине джерело — `process.env.SITE_URL`, фолбек `https://dim-hliba.invalid`. Захардкоджений домен будь-де — дефект.
- **Підшлях — змінна.** `process.env.BASE_PATH`, фолбек `'/'`. Захардкоджене `/--House-of-Bread-Church-Website/` будь-де — дефект.
- **Кожен шлях до ассета мусить пережити обидва значення `BASE_PATH`.** Вимога формулюється через результат, а не через механізм: у зібраному CSS шлях до `.woff2` має вести на `<base>fonts/…`. У розмітці шляхи будуються через `import.meta.env.BASE_URL` або хелпери Astro, ніколи конкатенацією рядків із `/`.
- **Українська в корені, англійська під `/en/`.** `defaultLocale: 'uk'`, `prefixDefaultLocale: false`.
- **URL із кінцевим слешем.** `trailingSlash: 'always'`, `build.format: 'directory'`.
- **Слаги англійські й спільні для обох локалей.** Відрізняє лише префікс `/en/`.
- **Дизайн переноситься 1:1.** На Етапі 0 нову верстку не пишемо взагалі — лише каркас.
- **Легасі не чіпаємо.** `index.html`, усі `*.dc.html`, `support.js`, `*-data.js` лишаються в репозиторії незмінними до Етапу 2. Astro живе в `src/` і збирається в `dist/`.
- **Шрифти самохостяться.** Nyght Serif має Regular/Bold (+курсиви) і **не має 600**; `h1..h4` — `font-weight:700`. Fixel має справжній 600.
- **Токени дизайну не вигадуються.** Значення `:root` копіюються з `index.html:27-50` буквально.
- **Node у CI — 22 LTS.**
- **Кожна задача закінчується комітом.**

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `package.json` | залежності, скрипти `dev` / `build` / `test` |
| `.gitignore` | `node_modules/`, `dist/`, `.astro/` |
| `astro.config.mjs` | `site` з `SITE_URL`, `base` з `BASE_PATH`, `trailingSlash`, i18n-конфіг |
| `src/styles/fonts.css` | 8 `@font-face` — один раз на весь сайт |
| `src/styles/tokens.css` | `:root` — один раз на весь сайт |
| `src/styles/base.css` | reset, типографіка, утиліти (`.container`, `.btn`, `.reveal`) |
| `src/layouts/Base.astro` | `<html lang>`, `<head>`, canonical, підключення трьох CSS, слоти |
| `src/pages/[...lang]/index.astro` | головна; один файл → дві локалі через `getStaticPaths()` |
| `public/fonts/**` | `.woff2`; у `dist/` лягають у `dist/fonts/…` |
| `tests/build.test.js` | твердження про вміст `dist/` після збірки |
| `.github/workflows/deploy.yml` | збірка + деплой на GitHub Pages |

**Чому тести — це твердження про `dist/`.** Юніт-тестувати в статичному сайті нічого: цінність Етапу 0 в тому, що збірка дає правильні файли за правильними адресами з правильним доменом усередині. Тому `npm test` спочатку робить `astro build`, а потім перевіряє вивід. Збірка, що впала, валить тести — саме та поведінка, яку Спека 1 вимагає від валідації колекцій пізніше.

**Поправка до Спеки 1.** Спека стверджує, що вбудований i18n Astro генерує обидві локалі з одного набору файлів. Це не так: `prefixDefaultLocale: false` дає хелпери й фолбеки маршрутизації, але самі маршрути `/en/...` треба створити. Обіцяний «один файл на сторінку» досягається rest-параметром `[...lang]` з `getStaticPaths()` — саме це робить Задача 3, із запасним варіантом на випадок відмови.

---

### Task 1: Каркас Astro і тестовий цикл

**Files:**
- Create: `package.json`, `.gitignore`, `astro.config.mjs`, `src/pages/index.astro`, `tests/build.test.js`

**Interfaces:**
- Consumes: нічого.
- Produces: `npm test` = `astro build && node --test tests/*.test.js`. Хелпери `dist(relPath) -> absolutePath` і `readDist(relPath) -> string` у `tests/build.test.js`. У `astro.config.mjs` — константи `SITE_URL` (фолбек `'https://dim-hliba.invalid'`) і `BASE_PATH` (фолбек `'/'`), прокинуті в `site` і `base`.

- [ ] **Step 1: Ініціалізувати npm-проєкт і `.gitignore`**

```bash
npm init -y
npm pkg set type=module
npm pkg set scripts.dev="astro dev"
npm pkg set scripts.build="astro build"
npm pkg set scripts.preview="astro preview"
npm pkg set scripts.test="astro build && node --test tests/*.test.js"
```

`.gitignore`:

```gitignore
node_modules/
dist/
.astro/
.superpowers/
```

- [ ] **Step 2: Написати тест, що падає**

`tests/build.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const dist = (relPath) =>
  fileURLToPath(new URL(`../dist/${relPath}`, import.meta.url));

export const readDist = (relPath) => readFileSync(dist(relPath), 'utf8');

test('збірка кладе головну в dist/index.html', () => {
  assert.ok(existsSync(dist('index.html')), 'dist/index.html не існує');
});
```

- [ ] **Step 3: Запустити тест і переконатися, що він падає**

Run: `npm test`
Expected: FAIL — `astro` ще не встановлений (`sh: astro: command not found`), тобто `dist/` не створюється.

- [ ] **Step 4: Встановити Astro і додати мінімальну конфігурацію**

```bash
npm install astro@^5
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';

// Єдині два місця в проєкті, де живе адреса сайту.
// Доки домену немає — зарезервований .invalid: випадковий витік буде видно одразу.
const SITE_URL = process.env.SITE_URL ?? 'https://dim-hliba.invalid';

// GitHub Pages віддає сторінки проєкту з підшляху, власний домен — з кореня.
const BASE_PATH = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Спека 1 хоче CSS, що кешується один раз на весь сайт.
    // Дефолтний 'auto' інлайнив би дрібні бандли назад у HTML — саме те, від чого йдемо.
    inlineStylesheets: 'never',
  },
  i18n: {
    defaultLocale: 'uk',
    locales: ['uk', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
```

`src/pages/index.astro` (тимчасова заглушка, її прибере Задача 3):

```astro
---
---
<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <title>Дім Хліба</title>
  </head>
  <body>
    <h1>Дім Хліба</h1>
  </body>
</html>
```

- [ ] **Step 5: Запустити тест і переконатися, що він проходить**

Run: `npm test`
Expected: PASS — `1 passing`. Якщо Astro лається на непарну версію Node — це попередження, не помилка; CI використовує 22 LTS.

- [ ] **Step 6: Коміт**

```bash
git add package.json package-lock.json .gitignore astro.config.mjs src/pages/index.astro tests/build.test.js
git commit -m "feat: Astro skeleton with SITE_URL indirection and build-output tests

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Спільні CSS і шрифти

**Files:**
- Create: `src/styles/fonts.css`, `src/styles/tokens.css`, `src/styles/base.css`
- Create: `public/fonts/nyght-serif/*.woff2`, `public/fonts/fixel/*.woff2` (копії з `fonts/`)
- Modify: `tests/build.test.js`
- Source: `index.html:16-23` (шрифти), `index.html:27-50` (токени), `index.html:51-81` (база)

**Interfaces:**
- Consumes: `dist()` / `readDist()` із Задачі 1.
- Produces: три CSS-файли, які Задача 3 імпортує в `Base.astro`. Шрифти доступні за абсолютними шляхами `/fonts/nyght-serif/*.woff2` і `/fonts/fixel/*.woff2`.

- [ ] **Step 1: Написати тест, що падає**

Додати в кінець `tests/build.test.js`:

```js
test('шрифти лежать у dist за абсолютними шляхами', () => {
  for (const f of [
    'fonts/nyght-serif/NyghtSerif-Regular.woff2',
    'fonts/nyght-serif/NyghtSerif-RegularItalic.woff2',
    'fonts/nyght-serif/NyghtSerif-Bold.woff2',
    'fonts/nyght-serif/NyghtSerif-BoldItalic.woff2',
    'fonts/fixel/FixelText-Regular.woff2',
    'fonts/fixel/FixelText-Medium.woff2',
    'fonts/fixel/FixelText-SemiBold.woff2',
    'fonts/fixel/FixelText-Bold.woff2',
  ]) {
    assert.ok(existsSync(dist(f)), `немає dist/${f}`);
  }
});

```

Шляхи всередині CSS цією задачею **не перевіряються**: доки жоден компонент не імпортує ці файли, Astro не емітить `dist/_astro/*.css` і перевіряти нічого. Цю перевірку робить Задача 3, яка підключає CSS через layout.

- [ ] **Step 2: Запустити тест і переконатися, що він падає**

Run: `npm test`
Expected: FAIL — `немає dist/fonts/nyght-serif/NyghtSerif-Regular.woff2`.

- [ ] **Step 3: Скопіювати шрифти в `public/` і створити три CSS**

```bash
mkdir -p public/fonts
cp -r fonts/nyght-serif fonts/fixel public/fonts/
```

Каталог `fonts/` у корені **лишається** — його ще читає легасі-сайт до Етапу 2.

`src/styles/fonts.css` — вісім правил із `index.html:16-23`, шляхи `./fonts/` замінені на `/fonts/`.

**Перевірено на цьому проєкті: Vite справді підставляє `base`.** Під `BASE_PATH=/--House-of-Bread-Church-Website/` зібраний `dist/_astro/*.css` містить `url(/--House-of-Bread-Church-Website/fonts/nyght-serif/NyghtSerif-Regular.woff2)`. Тож root-абсолютна форма коректна, а запасний варіант із відносними `../fonts/…` не знадобився. Перевірку робить Задача 3 — не вгадуйте, дивіться на вивід.

```css
@font-face{font-family:'Nyght Serif';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/nyght-serif/NyghtSerif-Regular.woff2') format('woff2')}
@font-face{font-family:'Nyght Serif';font-style:italic;font-weight:400;font-display:swap;src:url('/fonts/nyght-serif/NyghtSerif-RegularItalic.woff2') format('woff2')}
@font-face{font-family:'Nyght Serif';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/nyght-serif/NyghtSerif-Bold.woff2') format('woff2')}
@font-face{font-family:'Nyght Serif';font-style:italic;font-weight:700;font-display:swap;src:url('/fonts/nyght-serif/NyghtSerif-BoldItalic.woff2') format('woff2')}
@font-face{font-family:'Fixel';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/fixel/FixelText-Regular.woff2') format('woff2')}
@font-face{font-family:'Fixel';font-style:normal;font-weight:500;font-display:swap;src:url('/fonts/fixel/FixelText-Medium.woff2') format('woff2')}
@font-face{font-family:'Fixel';font-style:normal;font-weight:600;font-display:swap;src:url('/fonts/fixel/FixelText-SemiBold.woff2') format('woff2')}
@font-face{font-family:'Fixel';font-style:normal;font-weight:700;font-display:swap;src:url('/fonts/fixel/FixelText-Bold.woff2') format('woff2')}
```

`src/styles/tokens.css`:

```css
:root{
  --bg:#f9f8f5;            /* warm cream-white */
  --text-primary:#1a1918;
  --text-muted:#6b6a67;
  --accent:#F0E2C8;        /* gold — primary accent */
  --accent-strong:#DBC7A4;
  --accent-soft:rgba(240,226,200,.12);
  --ink-blue:#1e3a6e;      /* deep blue — secondary */
  --dark-section:#1a1a2e;
  --dark-section-2:#141426;
  --white:#ffffff;
  --line:rgba(26,25,24,.10);
  --shadow-sm:0 1px 3px rgba(26,25,24,.06);
  --shadow-card:0 4px 16px rgba(26,25,24,.08);
  --shadow-lg:0 18px 48px rgba(26,25,24,.14);
  --radius-sm:8px;
  --radius:12px;
  --radius-lg:16px;
  --header-h:78px;
  --maxw:1360px;
  --font-display:"Nyght Serif",Georgia,serif;
  --font-body:"Fixel",system-ui,-apple-system,sans-serif;
  --ease:cubic-bezier(.4,0,.2,1);
}
```

`src/styles/base.css` — буквальна копія `index.html:51-81`:

```css
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text-primary);font-family:var(--font-body);
  font-size:clamp(1rem,.97rem + .2vw,1.125rem);line-height:1.7;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;display:block}
a{color:var(--ink-blue);text-decoration:none;transition:color .2s var(--ease)}
a:hover{color:var(--text-primary)}
h1,h2,h3,h4{font-family:var(--font-display);font-weight:700;line-height:1.15;margin:0;color:var(--text-primary);text-wrap:balance}
ul{margin:0;padding:0;list-style:none}
button{font-family:inherit}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:4px}

/* ---- utilities ---- */
.container{width:100%;max-width:var(--maxw);margin-inline:auto;padding-inline:clamp(1.25rem,4vw,2.5rem)}
.eyebrow{font-family:var(--font-body);font-weight:600;font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;
  color:var(--text-primary);margin:0 0 1rem}
.section-title{font-size:clamp(1.8rem,3vw,2.8rem)}
.lead{color:var(--text-muted);font-size:clamp(1.05rem,1rem + .4vw,1.25rem);line-height:1.75}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;min-height:48px;padding:.85rem 1.6rem;
  border-radius:var(--radius);font-family:var(--font-body);font-weight:600;font-size:1rem;cursor:pointer;
  border:1.5px solid transparent;transition:transform .22s var(--ease),background .22s var(--ease),box-shadow .22s var(--ease),color .22s var(--ease)}
.btn-primary{background:var(--accent);color:#231a06;box-shadow:0 6px 18px rgba(240,226,200,.32)}
.btn-primary:hover{background:var(--accent-strong);color:#231a06;transform:translateY(-2px);box-shadow:0 12px 26px rgba(240,226,200,.42)}
.btn-ghost{background:rgba(255,255,255,.08);color:#fff;border-color:rgba(255,255,255,.55);backdrop-filter:blur(6px)}
.btn-ghost:hover{background:rgba(255,255,255,.16);color:#fff;transform:translateY(-2px)}
.btn-outline{background:transparent;color:var(--text-primary);border-color:var(--line)}
.btn-outline:hover{border-color:var(--accent);color:var(--text-primary);transform:translateY(-2px)}

/* reveal-on-scroll */
.reveal{opacity:0;transform:translateY(26px);transition:opacity .6s var(--ease),transform .6s var(--ease)}
.reveal.is-in{opacity:1;transform:none}
```

- [ ] **Step 4: Запустити тести і переконатися, що вони проходять**

Run: `npm test`
Expected: PASS — 2 passing.

- [ ] **Step 5: Коміт**

```bash
git add src/styles public/fonts tests/build.test.js
git commit -m "feat: extract shared font, token and base stylesheets

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Layout і дві локалі з одного файла

**Files:**
- Create: `src/layouts/Base.astro`, `src/pages/[...lang]/index.astro`
- Delete: `src/pages/index.astro`
- Modify: `tests/build.test.js`

**Interfaces:**
- Consumes: `src/styles/*.css` із Задачі 2; `dist()` / `readDist()` із Задачі 1.
- Produces: `Base.astro` з пропсами `{ lang: 'uk' | 'en', title: string, description?: string }`, іменованим слотом `head` і дефолтним слотом для тіла. Етап 3 додає в нього `hreflang`, OG і JSON-LD, тому всі сторінки зобов'язані рендеритись через нього.

- [ ] **Step 1: Написати тест, що падає**

Додати в кінець `tests/build.test.js`:

```js
test('обидві локалі збираються за реальними адресами', () => {
  assert.ok(existsSync(dist('index.html')), 'немає української головної');
  assert.ok(existsSync(dist('en/index.html')), 'немає англійської головної');
});

test('кожна локаль має свій lang і свій canonical із SITE_URL та BASE_PATH', () => {
  const uk = readDist('index.html');
  const en = readDist('en/index.html');
  const site = process.env.SITE_URL ?? 'https://dim-hliba.invalid';
  const base = process.env.BASE_PATH ?? '/';

  assert.match(uk, /<html[^>]+lang="uk"/, 'українська сторінка без lang="uk"');
  assert.match(en, /<html[^>]+lang="en"/, 'англійська сторінка без lang="en"');

  assert.ok(
    uk.includes(`<link rel="canonical" href="${site}${base}">`),
    `canonical української не дорівнює ${site}${base}`,
  );
  assert.ok(
    en.includes(`<link rel="canonical" href="${site}${base}en/">`),
    `canonical англійської не дорівнює ${site}${base}en/`,
  );
});

test('спільні стилі підключені, а не інлайняться копіями', () => {
  const uk = readDist('index.html');
  const base = process.env.BASE_PATH ?? '/';

  assert.ok(
    uk.includes(`<link rel="stylesheet" href="${base}_astro/`),
    `немає зовнішнього CSS під base ${base}`,
  );
  assert.doesNotMatch(uk, /@font-face/, '@font-face інлайниться в HTML');
});

test('шрифти адресуються з урахуванням BASE_PATH', () => {
  const base = process.env.BASE_PATH ?? '/';
  const css = readdirSync(dist('_astro'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => readDist(`_astro/${f}`))
    .join('\n');

  // Витягуємо всі url(...), що ведуть на .woff2, і дивимось, куди вони реально впираються.
  const urls = [...css.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 8, `очікували 8 посилань на .woff2, знайшли ${urls.length}`);

  for (const u of urls) {
    // Відносний і абсолютний-із-base шлях мають дати те саме місце.
    const resolved = new URL(u, `https://example.test${base}_astro/site.css`).pathname;
    assert.ok(
      resolved.startsWith(`${base}fonts/`),
      `шлях ${u} веде на ${resolved}, а мав на ${base}fonts/… — під підшляхом це 404`,
    );
  }
});
```

Дописати `readdirSync` в імпорт `node:fs` угорі файла:

```js
import { existsSync, readFileSync, readdirSync } from 'node:fs';
```

- [ ] **Step 2: Запустити тест і переконатися, що він падає**

Run: `npm test`
Expected: FAIL — `немає англійської головної` (`dist/en/index.html` не існує).

- [ ] **Step 3: Створити layout і маршрут із rest-параметром**

`src/layouts/Base.astro`:

```astro
---
import '../styles/fonts.css';
import '../styles/tokens.css';
import '../styles/base.css';

interface Props {
  lang: 'uk' | 'en';
  title: string;
  description?: string;
}

const { lang, title, description } = Astro.props;

// Astro.site — це SITE_URL з astro.config.mjs. Домен не згадується тут напряму.
const canonical = new URL(Astro.url.pathname, Astro.site).href;
---
<!doctype html>
<html lang={lang}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    <link rel="canonical" href={canonical} />
    <slot name="head" />
  </head>
  <body>
    <slot />
  </body>
</html>
```

`src/pages/[...lang]/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';

// Rest-параметр з params.lang === undefined дає корінь «/».
// Один файл — обидві локалі, як обіцяє Спека 1.
export function getStaticPaths() {
  return [
    { params: { lang: undefined }, props: { lang: 'uk' } },
    { params: { lang: 'en' }, props: { lang: 'en' } },
  ];
}

const { lang } = Astro.props;

const copy = {
  uk: { title: 'Дім Хліба', heading: 'Дім Хліба' },
  en: { title: 'House of Bread', heading: 'House of Bread' },
}[lang];
---
<Base lang={lang} title={copy.title}>
  <main class="container">
    <h1>{copy.heading}</h1>
  </main>
</Base>
```

Видалити заглушку, інакше маршрути конфліктують:

```bash
rm src/pages/index.astro
```

**Якщо Astro відмовиться від `params.lang === undefined`** і маршрут `/` не згенерується: замінити `src/pages/[...lang]/index.astro` на `src/pages/[lang]/index.astro` з `getStaticPaths`, що повертає лише `'en'`, а українську головну зробити файлом `src/pages/index.astro`, який імпортує ту саму сторінку як компонент із `src/pages-src/home.astro`. Це дві тонкі обгортки замість одного файла — прийнятна ціна; зміст сторінки все одно не дублюється.

- [ ] **Step 4: Запустити тести і переконатися, що вони проходять**

Run: `npm test`
Expected: PASS — 6 passing.

- [ ] **Step 5: Перевірити, що сайт переживає підшлях**

Це головна перевірка задачі: та сама збірка має бути коректною і з кореня, і з підшляху GitHub Pages.

Run: `BASE_PATH=/--House-of-Bread-Church-Website/ SITE_URL=https://igorgnutov.github.io npm test`
Expected: PASS — 6 passing.

**Якщо впав тест `шрифти адресуються з урахуванням BASE_PATH`** — Vite не підставив `base` в `url(/…)`. Замінити в `src/styles/fonts.css` усі вісім `url('/fonts/…')` на `url('../fonts/…')` і перезапустити обидві команди зі Step 4 і Step 5. Зібраний CSS лежить у `dist/_astro/`, тож `../fonts/` від нього веде в `<base>fonts/` за будь-якого `base`, без участі збирача. Тест правити не можна — він перевіряє вимогу, а не механізм.

- [ ] **Step 6: Перевірити очима в дев-сервері**

Run: `npm run dev`
Expected: `http://localhost:4321/` показує «Дім Хліба», `http://localhost:4321/en/` — «House of Bread»; обидві на кремовому фоні `--bg`, заголовок набраний Nyght Serif. Зупинити сервер.

- [ ] **Step 7: Коміт**

```bash
git add src/layouts src/pages src/styles tests/build.test.js
git commit -m "feat: base layout with both locales from a single route file

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Наскрізний деплой на GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm test` із Задачі 1; `dist/` як результат збірки; підтримку `BASE_PATH` із Задач 1 і 3.
- Produces: пайплайн `push to main → test → build → deploy`. Змінні `SITE_URL` і `BASE_PATH` у воркфлоу — єдині два місця, які треба буде переставити, коли з'явиться домен.

**Що потрібно від людини до кроку 2:** у налаштуваннях репозиторію GitHub Pages має бути переведений на джерело **GitHub Actions** (Settings → Pages → Build and deployment → Source: GitHub Actions). Нових акаунтів, токенів і секретів не потрібно — `GITHUB_TOKEN` видається воркфлоу автоматично.

**Наслідок, який треба розуміти до перемикання:** зараз за адресою `https://igorgnutov.github.io/--House-of-Bread-Church-Website/` віддається легасі-сайт із кореня репозиторію. Після перемикання джерела на Actions за цією адресою буде порожній каркас Astro. Легасі-файли нікуди не зникають — вони лишаються в гілці до Етапу 2 — але **публічна адреса почне показувати каркас**. Це рішення власника репозиторію, а не деталь реалізації.

- [ ] **Step 1: Написати воркфлоу**

`.github/workflows/deploy.yml`:

```yaml
name: Build and deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

# Дозволи рівно під те, що робить деплой на Pages, і нічого більше.
permissions:
  contents: read
  pages: write
  id-token: write

# Один деплой за раз; проміжні пуші не перебивають той, що вже котиться.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - uses: actions/configure-pages@v5

      # Обидві змінні задані явно: сторінки проєкту живуть під підшляхом.
      # Коли з'явиться домен — SITE_URL на нього, BASE_PATH на "/".
      - name: Build and verify output
        env:
          SITE_URL: https://igorgnutov.github.io
          BASE_PATH: /--House-of-Bread-Church-Website/
        run: npm test

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`npm test` тут навмисне замість `npm run build`: він і збирає, і перевіряє вивід — зокрема те, що під підшляхом нічого не поламалося. Зламана збірка не доїде до ефіру.

- [ ] **Step 2: Закомітити й запушити в `main`, щоб воркфлоу запустився**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: build and deploy to GitHub Pages

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: Перевірити результат в ефірі**

```bash
gh run watch
SITE=https://igorgnutov.github.io/--House-of-Bread-Church-Website
curl -sI "$SITE/" | head -1
curl -s  "$SITE/en/" | grep -o '<html[^>]*lang="[a-z]*"'
curl -s  "$SITE/en/" | grep -o '<link rel="canonical"[^>]*>'
curl -sI "$SITE/fonts/fixel/FixelText-Regular.woff2" | head -1
```

Expected: `HTTP/2 200` під HTTPS; `lang="en"`; `<link rel="canonical" href="https://igorgnutov.github.io/--House-of-Bread-Church-Website/en/">`; шрифт віддається `200`, а не `404`. Останній рядок — та сама перевірка підшляху, але вже на живому сервері.

- [ ] **Step 4: Записати в роадмап, що прев'ю-стенд змінився**

У таблиці «Зафіксовані рішення» рядок «Прев'ю-стенд» — `GitHub Pages, безкоштовно` замість Cloudflare Pages, з поміткою, що сторінки проєкту віддаються з підшляху й тому `BASE_PATH` — змінна.

```bash
git add docs/superpowers/specs/2026-09-22-00-roadmap.md
git commit -m "docs: preview stand is GitHub Pages, not Cloudflare Pages

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

### Task 5: Друга нога деплою — ukraine.com.ua ⛔ ЗАБЛОКОВАНА

**Виконується не зараз.** Потрібні: доменне ім'я, оплачений тариф «Швидкий», SSH-ключ, увімкнений SSL.

**Чому це не можна просто викреслити.** Спека 1 називає деплой на shared-хостинг єдиною частиною плану, яку ще не бачили в роботі, і ставить Етап 0 першим саме щоб перевірити її до основних вкладень. GitHub Pages доводить, що збірка й пайплайн працюють, але **нічого не доводить про Apache/OpenLiteSpeed, `.htaccess` і SSL на ukraine.com.ua**. Цей ризик лишається невідпрацьованим до цієї задачі.

**Здешевлення:** якщо тариф купити раніше за домен, хостер зазвичай видає технічний піддомен — на ньому задачу можна виконати ще до вибору імені. Варто уточнити в підтримці ukraine.com.ua.

**Files:**
- Create: `public/.htaccess`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Додати `.htaccess`** — зміст описаний у Спеці 2 (чисті URL, редірект `www → без www`, кеш, стиснення)
- [ ] **Step 2: Покласти доступи в секрети репозиторію** — `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, `DEPLOY_PATH`
- [ ] **Step 3: Додати окрему джобу `rsync` у воркфлоу.** Продакшн віддається з кореня, тому їй потрібна **власна збірка** з `BASE_PATH=/` — артефакт джоби `build` зібраний під підшлях GitHub Pages і на домен не годиться:

```yaml
  deploy-production:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci

      - name: Build for the real domain
        env:
          SITE_URL: https://<домен>
          BASE_PATH: /
        run: npm test

      - name: Deploy to ukraine.com.ua
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.SSH_HOST }}" >> ~/.ssh/known_hosts
          rsync -az --delete -e "ssh -i ~/.ssh/id_ed25519" \
            dist/ "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ secrets.DEPLOY_PATH }}"
```

- [ ] **Step 4: Вирішити долю прев'ю-стенду.** Дві збірки на кожен пуш — прийнятна ціна, доки прев'ю потрібне. Якщо після запуску продакшну GitHub Pages більше не потрібен — прибрати джоби `build`/`deploy` і лишити одну.
- [ ] **Step 5: Перевірити** — `curl -sI https://<домен>/` дає `200` під HTTPS; `curl -sI https://www.<домен>/` дає `301` на версію без `www`; `/en/` віддає `lang="en"`

---

## Критерії готовності Етапу 0

- [ ] `npm test` збирає сайт і перевіряє вивід; зламана збірка валить тести
- [ ] Обидві локалі існують за реальними адресами: `/` і `/en/`
- [ ] Шрифти й токени лежать по одному разу в спільних файлах, а не інлайняться в HTML
- [ ] Абсолютний домен існує в проєкті рівно в одному місці — `SITE_URL`
- [ ] Пуш у `main` автоматично виводить сайт в ефір під HTTPS
- [ ] Легасі-сайт у корені репозиторію не зачеплений
- [ ] ⛔ Деплой на ukraine.com.ua — Задача 5, заблокована доменом

## Що свідомо не входить в Етап 0

- Перенесення будь-якої реальної верстки — це Етап 2
- `hreflang`, OG, JSON-LD, `sitemap.xml`, `robots.txt` — Етап 3 (Спека 2)
- Content Collections і 190 ключів i18n — Етап 1
- Видалення `support.js` і легасі-HTML — кінець Етапу 2
