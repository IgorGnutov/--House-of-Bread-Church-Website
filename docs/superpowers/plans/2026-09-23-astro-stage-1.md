# Етап 1: контент у типізовані файли — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Увесь контент сайту переїжджає з `*-data.js` і розмітки десяти `.html` у типізовані Astro Content Collections, схема яких валідується на збірці, — без жодної правки тексту.

**Architecture:** Контент лежить у JSON-файлах під `src/content/`, схеми — у `src/content.config.ts` через `glob()` (колекції) і `file()` (одиночки). Кожне локалізоване поле — обʼєкт `{uk, en}`, обидві мови обовʼязкові: так відсутній переклад падає на збірці, а не показує українську на англійській сторінці. Перенесення робить **скрипт** (`scripts/extract-legacy-content.mjs`), а не руки: 190 ключів × 2 мови вручну — це гарантовані одруки, а скрипт до того ж лишається в репозиторії й дає Спеці 3 відтворюваний вхід. Разом із контентом скрипт пише карту `scripts/key-map.json` — куди поїхав кожен ключ; тест звіряє за нею committed-контент із легасі побайтово.

**Tech Stack:** Astro 5 (`glob`/`file` лоадери, вбудований Zod), `node:test`, `node-html-parser` (**dev**-залежність, лише для скрипта витягування), `node:vm` для читання `window.HOB_*`.

**Spec:** [2026-09-22-01-astro-migration-design.md](../specs/2026-09-22-01-astro-migration-design.md), розділи «Модель контенту», «Витягування статичного контенту», «Валідація», «Етапи» (рядок «Етап 1»).
Суміжне: [2026-09-22-03-storyblok-cms-design.md](../specs/2026-09-22-03-storyblok-cms-design.md), розділ «Відображення схеми на Storyblok» — саме ця схема лягає на Storyblok, тому імена полів міняти потім буде дорого.
Попередній етап: [2026-09-22-astro-stage-0.md](2026-09-22-astro-stage-0.md).

## Global Constraints

- **Node ≥ 22**, Astro `^5.18.2`, тестовий раннер — вбудований `node --test`. Нових **runtime**-залежностей не додаємо; `node-html-parser` ставиться як `devDependency`.
- **Текст переноситься побайтово.** Спека 1: «`homepage` заходить у модель **без жодних правок тексту**»; Спека 3: «контент у Storyblok **побайтово відповідає** тому, що лежить у файлах після Спеки 1». Помічені друкарські помилки, розбіжності uk/en і незаповнені `href="#"` **зберігаються як є** і виносяться у список для замовника, а не «покращуються».
- **Легасі не чіпаємо.** `index.html`, `*.dc.html`, `*-data.js`, `support.js` лишаються живим сайтом до Етапу 2. Скрипт витягування тільки **читає** їх.
- **`icon` — рівно 18 значень** зі списку в `index.html` (блок `const icons = {…}`): `book home media worship child youth teen order care chapel prophetic hospital biz pray mercy prison family globe`.
- **Локалі:** `uk` — типова, `en` — обовʼязкова для кожного локалізованого поля. Порожній рядок не вважається перекладом.
- **`alt` у `media[]` обовʼязкове** — воно потрібне і для доступності, і для SEO (Спека 1).
- Коментарі й назви тестів — **українською**, у стилі Етапу 0: коментар пояснює *чому*, а не *що*.
- Windows/Git Bash: будь-яка команда, що задає `BASE_PATH`, потребує `MSYS_NO_PATHCONV=1`, або запускається з PowerShell.
- Кожна задача завершується `npm test` (він = `astro build && node --test tests/*.test.js`) і окремим комітом.

## Зафіксовані рішення цього плану

Спека допускає два прочитання в кількох місцях. Нижче — вибір і підстава. Якщо ревʼю не згодне, це місця, які треба правити **до** старту, бо вони визначають форму даних.

| Питання | Рішення | Підстава |
|---|---|---|
| Де живуть 100 ключів `index.html` | одиночка `homepage`, згрупована по секціях | таблиця «Сторінки-одиночки» Спеки 1 + «100 ключів головної» у міграції Спеки 3. Рядок критеріїв «190 ключів винесені в `uk.json`/`en.json`» читаємо як «усі 190 дістали типізоване місце» |
| Де живуть заголовки сторінок-списків (`page.title` і компанія) | колекція `pages` — один файл, запис на сторінку | цільова структура Спеки 1 називає серед одиночок `pages` у множині; так `page-leaders` перестає бути винятком |
| Формат файлів контенту | JSON, не Markdown | кожне поле двомовне; у Markdown-фронтматері два `body` для однієї сторінки виглядають як милиця, а JSON 1:1 лягає на Storyblok |
| Ключі, що на різних сторінках означають різне | перейменовуються на семантичні (`foot.back` → `footBack.churches`) | `page.title` має 6 різних значень, `foot.back` — 4. Плаский словник на 190 ключів фізично не вміщує їх |
| `geo.lat` / `geo.lng` | `null` у даних, `nullable` у схемі | Спека: «нові поля, зараз їх немає ніде». Вигадувати координати не можна, а проставити їх — робота замовника при актуалізації контенту |
| `media[]` для служінь | «заморожується» з `window.HOB_ministryMedia(m)` у дані | у Storyblok функції-генератора не буде, а Спека 1 вимагає `media[]` у схемі служінь |
| «Домен» у `site-settings` (Спека 1) | **не** поле колекції; домен живе в `SITE_URL` (`astro.config.mjs`) | відхилення від спеки: домен потрібен на збірці (canonical, sitemap) ще до завантаження колекцій і залежить від середовища (превʼю на GitHub Pages проти продакшну) — тобто це конфіг, а не контент |
| `type` ресурсу лідерів (Спека 1) | змодельовано як `kind` (`document` \| `link`) + `format` (`pdf` \| `doc` \| `xls` \| `ppt`, для посилань `null`) | відхилення від спеки: одне поле `type` змішувало б «що це» (файл чи посилання) і «який файл»; у легасі це дві різні картки (`.doc-card` / `.res-card`) і клас значка |
| Порядок записів | поле `order` (індекс у легасі-масиві) у `ministries`, `churches`, `projects`, `testimonies` (у `pastors` і `leader-resources` воно вже було) | glob-завантажувач порядку не гарантує, а порядок визначає вигляд: значок «Головна церква» на індексі 0, перші три служіння на головній, блоки «ще …». Дати проєктів не впорядковані, тож сортувати за датою не можна |
| Картинки новин на головній | `news.items[].image = { src, alt }` з окремою схемою `decorativeImage`, де `alt: ""` дозволений | у легасі `alt=""` навмисно (картинка декоративна, заголовок поруч). `mediaItem` вимагає непорожній alt — змішувати їх означало б або вигадати опис, або послабити правило для галерей |
| Фон героя | окремий ключ `heroImage = { src, mobileSrc, alt }` поруч із `hero` | `hero` — словник пар `{uk, en}`, нелокалізований обʼєкт туди не лягає. Закоментоване в легасі старе фото героя (unsplash) не переноситься — його не видно |
| Українські alt / aria-label без англійського відповідника | `alt` — простий рядок (як у `mediaItem`), не пара; решта підписів — рядки в списку дірок перекладу | англійського тексту в легасі немає, а вигадувати його не можна. Пара `{uk, en: null}` ламала б правило «обидві мови обовʼязкові», тож дірка фіксується в нотатці, а не в даних |
| Підписи зі скриптових тернарників (`lang==='en' ? … : …`) | у `uk.json`/`en.json` під семантичними ключами (`badge.*`, `card.readMore`, `listCount.*`, `progress.of`, `testimony.*`), витягуються з коду сторінок, у `key-map.json` не йдуть | це видимий текст інтерфейсу з обома мовами в легасі; карта ключів рахує лише пари `data-i18n` (241), тож окремий тест звіряє ці ключі з літералами легасі |

## Розподіл 190 ключів `data-i18n`

Порахований по файлах, не на око (`index.html` — 100, обʼєднання `.dc.html` — 94, спільних імен — 4, разом унікальних — 190). Плюс один ключ живе тільки в `data-i18n-title`: `cta.liveTitle`.

| Призначення | Скільки ключів | Що саме |
|---|---|---|
| `homepage` | 100 (+`cta.liveTitle`) | усі ключі `index.html` |
| `pastors` (колекція) | 25 | `pastor1–3.{role,sub,bio}`, `elder1–8.{role,desc}` |
| `leader-resources` (колекція) | 30 | `doc1–6.{title,desc,meta}`, `res1–6.{title,desc}` |
| `pages` (колекція сторінок) | 13 | `page.{eyebrow,title,lead}`, `hero.tag`, `hero.locked`, `past.{eyebrow,title,lead}`, `elders.{eyebrow,title,lead}`, `docs.title`, `res.title` |
| `uk.json` / `en.json` | 22 | `back.*` (4), `crumb.*` (4), `cta.{directions,join}`, `fact.*` (5), `foot.{back,rights}`, `info.{eyebrow,title}`, `more.title`, `res.go`, `docs.count`, `res.count`, `help.{title,desc,btn}` |

Сума за унікальними іменами ключів менша за 190, бо чотири імені (`hero.tag`, `past.eyebrow`, `past.title`, `past.lead`) зустрічаються і на головній, і на `pastors.dc.html` **з різними значеннями**. Тест покриття (Задача 11) рахує не імена, а пари «сторінка + ключ» — їх 240, і кожна мусить мати рівно одне призначення.

## Структура файлів

```
scripts/
  lib/legacy-source.mjs        # читання легасі: window.HOB_*, пари uk/en з data-i18n
  extract-legacy-content.mjs   # CLI: пише src/content/**, src/i18n/*, scripts/key-map.json
  key-map.json                 # згенерована карта «сторінка+ключ → призначення»
src/
  content.config.ts            # усі схеми
  content/
    ministries/*.json          # 18
    churches/*.json            # 6
    projects/*.json            # 4
    testimonies/*.json         # 6
    pastors/*.json             # 11
    leader-resources/*.json    # 12
    singletons/
      site-settings.json  contact-info.json  donate-settings.json
      homepage.json  pages.json
  i18n/
    uk.json  en.json
tests/
  legacy-source.test.js        # тести бібліотеки читання
  content.test.js              # інваріанти committed-контенту (переживає Етап 2)
  content-fidelity.test.js     # звірка з легасі (видаляється на Етапі 2 разом з легасі)
  content-schema.test.js       # збірка падає на навмисно зіпсованому записі
```

## Review Focus

Класи входу, які спека передбачає, але жодна «щаслива» задача не перевіряє. Для кожного рядка тест доданий у задачу, що володіє кодом.

1. **`alt: ""` у `media[]`** — порожній рядок проходить `z.string()` і мовчки дає картинку без опису; схема мусить вимагати `.min(1)`. *Тест: Задача 3.*
2. **`icon` поза списком 18** — картка ламається мовчки; збірка має падати. *Тест: Задача 12.*
3. **Локалізоване поле без `en`** — англійська сторінка тихо показує українську. Пара `{uk, en}` обовʼязкова цілком. *Тест: Задача 3.*
4. **Дублікат `slug` між записами колекції** — дві сторінки претендують на один URL, одна тихо перетирає іншу. Ім'я файлу збігається зі `slug`, тож дублікат можливий лише як розбіжність «файл ≠ поле». *Тест: Задача 3.*
5. **YouTube `src` як голий ID, а не URL** — Спека 1 явно дозволяє обидва (`video` приймає URL або ID), тому схема не сміє відкидати 11-символьний ID. *Тест: Задача 3.*
6. **Ключ із 190 не потрапив нікуди або потрапив двічі** — тихий провал міграції, який виявиться лише на Етапі 2 порожнім текстом. *Тест: Задача 11.*

---

## Задача 1: бібліотека читання легасі — `window.HOB_*`

**Files:**
- Create: `scripts/lib/legacy-source.mjs`
- Create: `tests/legacy-source.test.js`
- Modify: `package.json` (devDependency `node-html-parser`)

**Interfaces:**
- Produces: `readHobGlobals(fileNames: string[]): Record<string, unknown>` — виконує перелічені `*-data.js` у пісочниці `node:vm` зі спільним фейковим `window` і повертає його. Спільний `window` потрібен тому, що `HOB_ministryMedia` — функція, яку далі викликають на записах служінь.
- Produces: `PROJECT_ROOT: URL` — корінь репозиторію, щоб скрипти й тести не рахували `../` по-різному.

- [ ] **Step 1: Поставити dev-залежність**

```bash
npm install --save-dev node-html-parser@^7.0.1
```

- [ ] **Step 2: Написати падаючий тест**

Create `tests/legacy-source.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHobGlobals } from '../scripts/lib/legacy-source.mjs';

test('читає window.HOB_* із легасі-файлів даних', () => {
  const w = readHobGlobals([
    'ministries-data.js',
    'churches-data.js',
    'projects-data.js',
    'testimonies-data.js',
  ]);

  assert.equal(w.HOB_MINISTRIES.length, 18);
  assert.equal(w.HOB_CHURCHES.length, 6);
  assert.equal(w.HOB_PROJECTS.length, 4);
  assert.equal(w.HOB_TESTIMONIES.length, 6);
  assert.equal(w.HOB_MINISTRIES[0].id, 'bible-school');
});

test('галерея служінь доступна як функція і дає 4 слайди', () => {
  // Служіння — єдина колекція без media[] у джерелі: галерея генерується
  // функцією. Її треба саме викликати, інакше на Етапі 2 картинок не буде.
  const w = readHobGlobals(['ministries-data.js']);
  const media = w.HOB_ministryMedia(w.HOB_MINISTRIES[0]);

  assert.equal(media.length, 4);
  assert.equal(media[0].type, 'image');
  assert.equal(media[2].type, 'video');
  assert.ok(media[0].alt.length > 0, 'alt порожній — на Етапі 2 це буде картинка без опису');
});
```

- [ ] **Step 3: Запустити тест і переконатися, що падає**

Run: `node --test tests/legacy-source.test.js`
Expected: FAIL — `Cannot find module '../scripts/lib/legacy-source.mjs'`

- [ ] **Step 4: Реалізувати бібліотеку**

Create `scripts/lib/legacy-source.mjs`:

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const PROJECT_ROOT = new URL('../../', import.meta.url);

export const legacyPath = (name) => fileURLToPath(new URL(name, PROJECT_ROOT));

export const readLegacy = (name) => readFileSync(legacyPath(name), 'utf8');

// Файли даних — це присвоєння у window, а не модулі. Виконуємо їх у пісочниці
// зі спільним window: HOB_ministryMedia посилається на той самий обʼєкт, тому
// розкладати кожен файл у власний контекст не можна.
export function readHobGlobals(fileNames) {
  const windowObject = {};
  const context = vm.createContext({ window: windowObject });

  for (const name of fileNames) {
    vm.runInContext(readLegacy(name), context, { filename: name });
  }

  return windowObject;
}
```

- [ ] **Step 5: Запустити тест і переконатися, що проходить**

Run: `node --test tests/legacy-source.test.js`
Expected: PASS, 2 tests

- [ ] **Step 6: Коміт**

```bash
git add package.json package-lock.json scripts/lib/legacy-source.mjs tests/legacy-source.test.js
git commit -m "feat: читання легасі-даних window.HOB_* у пісочниці

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 2: бібліотека читання легасі — пари uk/en з `data-i18n`

**Files:**
- Modify: `scripts/lib/legacy-source.mjs`
- Modify: `tests/legacy-source.test.js`

**Interfaces:**
- Consumes: `readLegacy`, `PROJECT_ROOT` із Задачі 1.
- Produces: `readPageStrings(pageFile: string): Map<string, {uk: string, en: string}>` — для однієї легасі-сторінки повертає всі ключі `data-i18n` (плюс `data-i18n-title`) з українським значенням із розмітки та англійським з інлайн-словника цієї ж сторінки.
- Produces: `LEGACY_PAGES: string[]` — десять імен файлів у сталому порядку.

**Чому так.** Українських значень **немає у словнику**: `applyLang` збирає їх з DOM (`UK[key] = el.innerHTML`). Тому uk береться з розмітки як `innerHTML` (ключ `hero.title` містить `<br><em>`), а en — з інлайн-обʼєкта `EN = {…}`, свого на кожній сторінці.

- [ ] **Step 1: Написати падаючий тест**

Append to `tests/legacy-source.test.js`:

```js
import { readPageStrings, LEGACY_PAGES } from '../scripts/lib/legacy-source.mjs';

test('читає пари uk/en з головної, зберігаючи розмітку всередині значення', () => {
  const strings = readPageStrings('index.html');

  assert.equal(strings.size, 101, 'очікували 100 data-i18n + cta.liveTitle');
  assert.equal(
    strings.get('hero.title').uk,
    'Церква <em>«Дім Хліба»</em><br>Кривий Ріг',
  );
  assert.equal(strings.get('hero.title').en, 'House of Bread Church<br><em>Kryvyi Rih</em>');
  assert.equal(strings.get('cta.liveTitle').uk, 'Дивитися пряму трансляцію');
});

test('той самий ключ на різних сторінках дає різні значення', () => {
  // page.title має шість різних значень. Плаский словник на 190 ключів
  // їх не вміщує — саме тому ключі перейменовуються, а не копіюються.
  assert.equal(
    readPageStrings('pastors.dc.html').get('page.title').uk,
    'Служителі церкви «Дім Хліба»',
  );
  assert.equal(
    readPageStrings('churches.dc.html').get('page.title').uk,
    'Церкви об’єднання «Дім Хліба»',
  );
});

test('кожна з десяти легасі-сторінок читається і має англійську для кожного ключа', () => {
  assert.equal(LEGACY_PAGES.length, 10);

  for (const page of LEGACY_PAGES) {
    const strings = readPageStrings(page);
    assert.ok(strings.size > 0, `${page}: жодного ключа`);
    for (const [key, pair] of strings) {
      assert.ok(pair.uk.length > 0, `${page}: ${key} без української`);
      assert.ok(pair.en.length > 0, `${page}: ${key} без англійської`);
    }
  }
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/legacy-source.test.js`
Expected: FAIL — `readPageStrings is not a function`

- [ ] **Step 3: Реалізувати читання сторінок**

Append to `scripts/lib/legacy-source.mjs`:

```js
import { parse } from 'node-html-parser';

export const LEGACY_PAGES = [
  'index.html',
  'church.dc.html',
  'churches.dc.html',
  'leaders.dc.html',
  'ministries.dc.html',
  'ministry.dc.html',
  'pastors.dc.html',
  'project.dc.html',
  'projects.dc.html',
  'testimonies.dc.html',
];

// Англійський словник лежить інлайн як `const EN = { … };` (на .dc.html
// трапляється й EN_UI). Беремо найдовший такий літерал: на головній поруч
// є менші обʼєкти, і перший збіг був би не тим.
const readEnglishDictionary = (source) => {
  const literals = [...source.matchAll(/const\s+EN(?:_UI)?\s*=\s*(\{[\s\S]*?\n\s*\};)/g)]
    .map((m) => m[1].replace(/;$/, ''));

  if (literals.length === 0) return {};

  const widest = literals.reduce((a, b) => (b.length > a.length ? b : a));
  return vm.runInNewContext(`(${widest})`);
};

export function readPageStrings(pageFile) {
  const source = readLegacy(pageFile);
  const english = readEnglishDictionary(source);
  const root = parse(source);
  const pairs = new Map();

  for (const el of root.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    // Саме innerHTML, а не текст: значення офіційно містять розмітку
    // (див. data-i18n-html на головній), і вона є частиною контенту.
    pairs.set(key, { uk: el.innerHTML.trim(), en: english[key] ?? '' });
  }

  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    const key = el.getAttribute('data-i18n-title');
    if (pairs.has(key)) continue;
    pairs.set(key, { uk: el.getAttribute('title').trim(), en: english[key] ?? '' });
  }

  return pairs;
}
```

- [ ] **Step 4: Запустити тест і переконатися, що проходить**

Run: `node --test tests/legacy-source.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Коміт**

```bash
git add scripts/lib/legacy-source.mjs tests/legacy-source.test.js
git commit -m "feat: читання пар uk/en з розмітки та інлайн-словників легасі

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 3: схеми колекцій і колекція `ministries`

**Files:**
- Create: `src/content.config.ts`
- Create: `scripts/extract-legacy-content.mjs`
- Create: `src/content/ministries/*.json` (18 файлів, згенеровані)
- Create: `tests/content.test.js`
- Modify: `package.json` (скрипт `extract`)

**Interfaces:**
- Consumes: `readHobGlobals` (Задача 1).
- Produces: `localized` — `z.object({ uk: z.string().min(1), en: z.string().min(1) })`; використовується **всіма** наступними схемами.
- Produces: `mediaItem` — `z.object({ type: z.enum(['image','video']), src: z.string().min(1), alt: z.string().min(1) })`.
- Produces: `MINISTRY_ICONS` — кортеж з 18 значень.
- Produces: колекція `ministries` з полями `slug, icon, leader, phone, name, summary, body, media, seo`.
- Produces: `writeJson(relPath, value)` у скрипті витягування — стабільна серіалізація (2 пробіли, `\n` у кінці), щоб повторний запуск не давав шумний diff.

- [ ] **Step 1: Написати падаючі тести інваріантів**

Create `tests/content.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const contentDir = (name) =>
  fileURLToPath(new URL(`../src/content/${name}`, import.meta.url));

export const readCollection = (name) =>
  readdirSync(contentDir(name))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
      file: f,
      data: JSON.parse(readFileSync(`${contentDir(name)}/${f}`, 'utf8')),
    }));

// Рекурсивно знаходить кожну пару {uk, en} у записі — щоб перевіряти
// повноту перекладу, не перелічуючи поля кожної колекції окремо.
export function* localizedPairs(value, path = '') {
  if (value === null || typeof value !== 'object') return;
  if (typeof value.uk === 'string' && 'en' in value) {
    yield [path, value];
    return;
  }
  for (const [k, v] of Object.entries(value)) yield* localizedPairs(v, `${path}.${k}`);
}

test('усі 18 служінь на місці, ім’я файлу збігається зі slug', () => {
  const entries = readCollection('ministries');
  assert.equal(entries.length, 18);

  for (const { file, data } of entries) {
    // Дублікат slug означав би дві сторінки на одному URL: одна тихо
    // перетерла б іншу. Ім'я файлу — єдине джерело унікальності, тож
    // розбіжність «файл ≠ поле» ловимо тут.
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
  }
});

test('icon кожного служіння — зі списку 18 дозволених', () => {
  const allowed = new Set([
    'book', 'home', 'media', 'worship', 'child', 'youth', 'teen', 'order', 'care',
    'chapel', 'prophetic', 'hospital', 'biz', 'pray', 'mercy', 'prison', 'family', 'globe',
  ]);

  for (const { file, data } of readCollection('ministries')) {
    assert.ok(allowed.has(data.icon), `${file}: невідома іконка ${data.icon}`);
  }
});

test('кожне локалізоване поле служінь має непорожні uk і en', () => {
  for (const { file, data } of readCollection('ministries')) {
    for (const [path, pair] of localizedPairs(data)) {
      assert.ok(pair.uk.trim().length > 0, `${file}${path}: порожня uk`);
      // Порожня en тихо показала б українську на англійській сторінці.
      assert.ok(String(pair.en).trim().length > 0, `${file}${path}: порожня en`);
    }
  }
});

test('кожен слайд галереї має непорожній alt і допустимий src', () => {
  for (const { file, data } of readCollection('ministries')) {
    assert.ok(data.media.length > 0, `${file}: порожня галерея`);

    for (const item of data.media) {
      assert.ok(['image', 'video'].includes(item.type), `${file}: тип ${item.type}`);
      assert.ok(item.src.trim().length > 0, `${file}: порожній src`);
      // Порожній alt проходить z.string() і дає картинку без опису —
      // це одразу і доступність, і SEO (Спека 1).
      assert.ok(item.alt.trim().length > 0, `${file}: порожній alt`);
    }
  }
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/content.test.js`
Expected: FAIL — `ENOENT: no such file or directory, scandir '…/src/content/ministries'`

- [ ] **Step 3: Написати схеми**

Create `src/content.config.ts`:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Обидві мови обовʼязкові й непорожні. Якщо дозволити лише uk, англійська
// сторінка мовчки покаже українську — а це гірше за впалу збірку.
export const localized = z.object({
  uk: z.string().min(1),
  en: z.string().min(1),
});

// alt обовʼязкове: воно потрібне і для доступності, і для SEO (Спека 1).
// src приймає і повний YouTube-URL, і голий 11-символьний ID — Спека 1
// дозволяє обидва, тому звужувати до URL не можна.
export const mediaItem = z.object({
  type: z.enum(['image', 'video']),
  src: z.string().min(1),
  alt: z.string().min(1),
});

export const seo = z.object({
  metaTitle: localized.nullable(),
  metaDescription: localized.nullable(),
  ogImage: z.string().nullable(),
  noindex: z.boolean(),
});

// Іконки — inline SVG у коді (index.html, `const icons`). Довільне значення
// зламало б картку мовчки, тому список закритий.
export const MINISTRY_ICONS = [
  'book', 'home', 'media', 'worship', 'child', 'youth', 'teen', 'order', 'care',
  'chapel', 'prophetic', 'hospital', 'biz', 'pray', 'mercy', 'prison', 'family', 'globe',
] as const;

const ministries = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/ministries' }),
  schema: z.object({
    slug: z.string().min(1),
    icon: z.enum(MINISTRY_ICONS),
    leader: z.string().min(1),
    phone: z.string().min(1),
    name: localized,
    summary: localized,
    body: localized,
    media: z.array(mediaItem).min(1),
    seo,
  }),
});

export const collections = { ministries };
```

- [ ] **Step 4: Написати скрипт витягування**

Create `scripts/extract-legacy-content.mjs`:

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROJECT_ROOT, readHobGlobals } from './lib/legacy-source.mjs';

// Стабільна серіалізація: два пробіли й перенос у кінці. Інакше повторний
// запуск скрипта дає diff із самих лапок і ховає справжні зміни контенту.
export const writeJson = (relPath, value) => {
  const target = fileURLToPath(new URL(relPath, PROJECT_ROOT));
  mkdirSync(fileURLToPath(new URL(relPath.replace(/\/[^/]+$/, '/'), PROJECT_ROOT)), {
    recursive: true,
  });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

// SEO-поля ще ніде не заповнені: на легасі-сторінках немає жодного <title>.
// Кладемо явні null, щоб Етап 3 бачив порожнечу як дані, а не як відсутнє поле.
const emptySeo = () => ({
  metaTitle: null,
  metaDescription: null,
  ogImage: null,
  noindex: false,
});

function extractMinistries(window) {
  for (const m of window.HOB_MINISTRIES) {
    writeJson(`src/content/ministries/${m.id}.json`, {
      slug: m.id,
      icon: m.ic,
      leader: m.leader,
      phone: m.phone,
      name: { uk: m.uk[0], en: m.en[0] },
      summary: { uk: m.uk[1], en: m.en[1] },
      body: { uk: m.body, en: m.bodyEn },
      // Галерея служінь у легасі генерується функцією на льоту. У Storyblok
      // функції не буде, тому «заморожуємо» результат у дані як є.
      media: window.HOB_ministryMedia(m),
      seo: emptySeo(),
    });
  }
}

const window = readHobGlobals([
  'ministries-data.js',
  'churches-data.js',
  'projects-data.js',
  'testimonies-data.js',
]);

extractMinistries(window);
console.log('ministries: 18');
```

- [ ] **Step 5: Додати npm-скрипт і запустити витягування**

Modify `package.json`, у `"scripts"` додати:

```json
"extract": "node scripts/extract-legacy-content.mjs"
```

Run: `npm run extract`
Expected: `ministries: 18`, у `src/content/ministries/` зʼявилось 18 файлів.

- [ ] **Step 6: Запустити тести і переконатися, що проходять**

Run: `npm test`
Expected: PASS — збірка проходить (схема валідна), `tests/content.test.js` — 4 tests PASS

- [ ] **Step 7: Коміт**

```bash
git add src/content.config.ts src/content/ministries scripts/extract-legacy-content.mjs tests/content.test.js package.json
git commit -m "feat: схеми колекцій і 18 служінь у типізованих даних

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 4: колекція `churches`

**Files:**
- Modify: `src/content.config.ts`
- Modify: `scripts/extract-legacy-content.mjs`
- Create: `src/content/churches/*.json` (6 файлів, згенеровані)
- Modify: `tests/content.test.js`

**Interfaces:**
- Consumes: `localized`, `mediaItem`, `seo`, `writeJson`, `readCollection`, `localizedPairs`.
- Produces: колекція `churches` з полями `slug, pastor, geo, name, city, role, address, times, lead, body, media, seo`, де `geo` — `{lat, lng} | null`.

- [ ] **Step 1: Написати падаючий тест**

Append to `tests/content.test.js`:

```js
test('усі 6 церков на місці, з двомовними полями і галереєю', () => {
  const entries = readCollection('churches');
  assert.equal(entries.length, 6);

  for (const { file, data } of entries) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.ok(data.media.length > 0, `${file}: порожня галерея`);

    for (const [path, pair] of localizedPairs(data)) {
      assert.ok(pair.uk.trim().length > 0, `${file}${path}: порожня uk`);
      assert.ok(String(pair.en).trim().length > 0, `${file}${path}: порожня en`);
    }
    for (const item of data.media) {
      assert.ok(item.alt.trim().length > 0, `${file}: порожній alt`);
    }
  }
});

test('координати церков присутні як поле, поки що порожні', () => {
  // Спека: geo — нове поле, джерела немає ніде. Явний null означає
  // «знаємо, що бракує»; відсутнє поле означало б «забули про нього».
  for (const { file, data } of readCollection('churches')) {
    assert.ok('geo' in data, `${file}: немає поля geo`);
    assert.equal(data.geo, null, `${file}: координати вигадані, а джерела немає`);
  }
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/content.test.js`
Expected: FAIL — `ENOENT … src/content/churches`

- [ ] **Step 3: Додати схему**

Append to `src/content.config.ts` (перед `export const collections`):

```ts
// Координати нового поля geo немає в жодному легасі-джерелі. Nullable, щоб
// збірка проходила зараз, а Етап 3 (JSON-LD Church) бачив явну порожнечу.
export const geoPoint = z.object({ lat: z.number(), lng: z.number() }).nullable();

const churches = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/churches' }),
  schema: z.object({
    slug: z.string().min(1),
    pastor: z.string().min(1),
    geo: geoPoint,
    name: localized,
    city: localized,
    role: localized,
    address: localized,
    times: localized,
    lead: localized,
    body: localized,
    media: z.array(mediaItem).min(1),
    seo,
  }),
});
```

І розширити експорт: `export const collections = { ministries, churches };`

- [ ] **Step 4: Додати витягування**

Append to `scripts/extract-legacy-content.mjs` (перед викликами внизу):

```js
function extractChurches(window) {
  for (const c of window.HOB_CHURCHES) {
    writeJson(`src/content/churches/${c.id}.json`, {
      slug: c.id,
      pastor: c.pastor,
      geo: null,
      name: { uk: c.name, en: c.en.name },
      city: { uk: c.city, en: c.en.city },
      role: { uk: c.role, en: c.en.role },
      address: { uk: c.address, en: c.en.address },
      times: { uk: c.times, en: c.en.times },
      lead: { uk: c.lead, en: c.en.lead },
      body: { uk: c.body, en: c.en.body },
      media: c.media,
      seo: emptySeo(),
    });
  }
}
```

І додати виклик поруч із рештою:

```js
extractChurches(window);
console.log('churches: 6');
```

- [ ] **Step 5: Запустити витягування і тести**

Run: `npm run extract && npm test`
Expected: `churches: 6`; збірка проходить; `tests/content.test.js` — 6 tests PASS

- [ ] **Step 6: Коміт**

```bash
git add src/content.config.ts src/content/churches scripts/extract-legacy-content.mjs tests/content.test.js
git commit -m "feat: 6 церков об'єднання у типізованих даних

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 5: колекція `projects`

**Files:**
- Modify: `src/content.config.ts`
- Modify: `scripts/extract-legacy-content.mjs`
- Create: `src/content/projects/*.json` (4 файли, згенеровані)
- Modify: `tests/content.test.js`

**Interfaces:**
- Consumes: `localized`, `mediaItem`, `seo`, `writeJson`, `readCollection`, `localizedPairs`.
- Produces: колекція `projects` з полями `slug, date, progress, ctaUrl, title, category, status, period, lead, body, stats, ctaLabel, media, seo`.

**Особливість джерела.** У `projects-data.js` `progress.percent` і `cta.url` є лише в українському обʼєкті, а в `en` їх немає — вони не локалізовані. Тому в моделі вони виносяться нагору (`progress`, `ctaUrl`), а локалізованими лишаються `raised`/`goal` і `ctaLabel`. `stats` — масив, де число однакове, а підпис локалізований.

- [ ] **Step 1: Написати падаючий тест**

Append to `tests/content.test.js`:

```js
test('усі 4 проєкти на місці, з локалізованими підписами показників', () => {
  const entries = readCollection('projects');
  assert.equal(entries.length, 4);

  for (const { file, data } of entries) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.match(data.date, /^\d{4}-\d{2}-\d{2}$/, `${file}: дата не ISO`);
    assert.ok(data.stats.length > 0, `${file}: немає показників`);

    for (const stat of data.stats) {
      assert.ok(stat.n.trim().length > 0, `${file}: показник без числа`);
      assert.ok(stat.label.uk.trim().length > 0, `${file}: показник без uk-підпису`);
      assert.ok(stat.label.en.trim().length > 0, `${file}: показник без en-підпису`);
    }
    for (const [path, pair] of localizedPairs(data)) {
      assert.ok(pair.uk.trim().length > 0, `${file}${path}: порожня uk`);
      assert.ok(String(pair.en).trim().length > 0, `${file}${path}: порожня en`);
    }
  }
});

test('нелокалізовані поля проєкту не роздвоєні по мовах', () => {
  // percent і url у джерелі є тільки в українському обʼєкті. Якби ми
  // зробили їх локалізованими, англійська версія лишилась би без них.
  const withProgress = readCollection('projects').filter(({ data }) => data.progress !== null);
  assert.ok(withProgress.length >= 1, 'жоден проєкт не має прогресу — дані загублені');

  for (const { file, data } of withProgress) {
    assert.equal(typeof data.progress.percent, 'number', `${file}: percent не число`);
    assert.ok(data.progress.raised.uk.length > 0, `${file}: зібрано без uk`);
    assert.ok(data.progress.raised.en.length > 0, `${file}: зібрано без en`);
  }
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/content.test.js`
Expected: FAIL — `ENOENT … src/content/projects`

- [ ] **Step 3: Додати схему**

Append to `src/content.config.ts`:

```ts
const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: z.object({
    slug: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // percent і url у джерелі не локалізовані — тримаємо їх поза парами
    // {uk,en}, інакше англійська версія лишилася б без них.
    progress: z
      .object({ percent: z.number(), raised: localized, goal: localized })
      .nullable(),
    ctaUrl: z.string().min(1).nullable(),
    title: localized,
    category: localized,
    status: localized,
    period: localized,
    lead: localized,
    body: localized,
    stats: z.array(z.object({ n: z.string().min(1), label: localized })).min(1),
    ctaLabel: localized,
    media: z.array(mediaItem).min(1),
    seo,
  }),
});
```

І розширити експорт: `export const collections = { ministries, churches, projects };`

- [ ] **Step 4: Додати витягування**

Append to `scripts/extract-legacy-content.mjs`:

```js
function extractProjects(window) {
  for (const p of window.HOB_PROJECTS) {
    writeJson(`src/content/projects/${p.id}.json`, {
      slug: p.id,
      date: p.date,
      progress: p.progress
        ? {
            percent: p.progress.percent,
            raised: { uk: p.progress.raised, en: p.en.progress.raised },
            goal: { uk: p.progress.goal, en: p.en.progress.goal },
          }
        : null,
      ctaUrl: p.cta?.url ?? null,
      title: { uk: p.title, en: p.en.title },
      category: { uk: p.category, en: p.en.category },
      status: { uk: p.status, en: p.en.status },
      period: { uk: p.period, en: p.en.period },
      lead: { uk: p.lead, en: p.en.lead },
      body: { uk: p.body, en: p.en.body },
      stats: p.stats.map((s, i) => ({
        n: s.n,
        label: { uk: s.l, en: p.en.stats[i].l },
      })),
      ctaLabel: { uk: p.cta.label, en: p.en.cta.label },
      media: p.media,
      seo: emptySeo(),
    });
  }
}
```

І виклик:

```js
extractProjects(window);
console.log('projects: 4');
```

- [ ] **Step 5: Запустити витягування і тести**

Run: `npm run extract && npm test`
Expected: `projects: 4`; збірка проходить; `tests/content.test.js` — 8 tests PASS

- [ ] **Step 6: Коміт**

```bash
git add src/content.config.ts src/content/projects scripts/extract-legacy-content.mjs tests/content.test.js
git commit -m "feat: 4 проєкти церкви у типізованих даних

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 6: колекція `testimonies`

**Files:**
- Modify: `src/content.config.ts`
- Modify: `scripts/extract-legacy-content.mjs`
- Create: `src/content/testimonies/*.json` (6 файлів, згенеровані)
- Modify: `tests/content.test.js`

**Interfaces:**
- Consumes: `localized`, `writeJson`, `readCollection`.
- Produces: колекція `testimonies` — дискримінований союз за `type`: `text` має `text: localized`, `video` має `videoUrl` і `poster`. Спільні поля: `slug`, `name`, `role: localized`.

**Особливість джерела.** У текстових свідченнях `name` однакове для обох мов (`en` містить лише `text` і `role`), у відео — `en` містить лише `role`. Тому `name` нелокалізоване, `role` локалізоване, `text` є лише в текстових.

- [ ] **Step 1: Написати падаючий тест**

Append to `tests/content.test.js`:

```js
test('усі 6 свідчень на місці: 4 текстових і 2 відео', () => {
  const entries = readCollection('testimonies');
  assert.equal(entries.length, 6);

  const byType = entries.reduce((acc, { data }) => {
    acc[data.type] = (acc[data.type] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byType, { text: 4, video: 2 });

  for (const { file, data } of entries) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.ok(data.name.trim().length > 0, `${file}: без імені`);
    assert.ok(data.role.uk.trim().length > 0, `${file}: роль без uk`);
    assert.ok(data.role.en.trim().length > 0, `${file}: роль без en`);
  }
});

test('відеосвідчення мають посилання і постер, текстові — двомовний текст', () => {
  for (const { file, data } of readCollection('testimonies')) {
    if (data.type === 'video') {
      assert.ok(data.videoUrl.trim().length > 0, `${file}: відео без посилання`);
      assert.ok(data.poster.trim().length > 0, `${file}: відео без постера`);
    } else {
      assert.ok(data.text.uk.trim().length > 0, `${file}: текст без uk`);
      assert.ok(data.text.en.trim().length > 0, `${file}: текст без en`);
    }
  }
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/content.test.js`
Expected: FAIL — `ENOENT … src/content/testimonies`

- [ ] **Step 3: Додати схему**

Append to `src/content.config.ts`:

```ts
// Текстове й відеосвідчення мають різні обовʼязкові поля. Союз за type
// не дає покласти відео без посилання й текст без тексту.
const testimonyBase = {
  slug: z.string().min(1),
  name: z.string().min(1),
  role: localized,
};

const testimonies = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/testimonies' }),
  schema: z.discriminatedUnion('type', [
    z.object({ ...testimonyBase, type: z.literal('text'), text: localized }),
    z.object({
      ...testimonyBase,
      type: z.literal('video'),
      videoUrl: z.string().min(1),
      poster: z.string().min(1),
    }),
  ]),
});
```

І розширити експорт: `export const collections = { ministries, churches, projects, testimonies };`

- [ ] **Step 4: Додати витягування**

Append to `scripts/extract-legacy-content.mjs`:

```js
function extractTestimonies(window) {
  for (const t of window.HOB_TESTIMONIES) {
    const base = {
      slug: t.id,
      type: t.type,
      name: t.name,
      role: { uk: t.role, en: t.en.role },
    };

    writeJson(
      `src/content/testimonies/${t.id}.json`,
      t.type === 'video'
        ? { ...base, videoUrl: t.yt, poster: t.img }
        : { ...base, text: { uk: t.text, en: t.en.text } },
    );
  }
}
```

І виклик:

```js
extractTestimonies(window);
console.log('testimonies: 6');
```

- [ ] **Step 5: Запустити витягування і тести**

Run: `npm run extract && npm test`
Expected: `testimonies: 6`; збірка проходить; `tests/content.test.js` — 10 tests PASS

- [ ] **Step 6: Коміт**

```bash
git add src/content.config.ts src/content/testimonies scripts/extract-legacy-content.mjs tests/content.test.js
git commit -m "feat: 6 свідчень у типізованих даних

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 7: колекція `pastors` — витягування з розмітки

**Files:**
- Modify: `src/content.config.ts`
- Modify: `scripts/extract-legacy-content.mjs`
- Create: `src/content/pastors/*.json` (11 файлів, згенеровані)
- Modify: `tests/content.test.js`

**Interfaces:**
- Consumes: `localized`, `writeJson`, `readPageStrings`, `readLegacy`, `readCollection`.
- Produces: колекція `pastors` з полями `slug, name, photo, order, group ('pastor'|'elder'), role, subtitle, bio`.

**Особливість джерела.** У `pastors.dc.html` немає жодного файлу даних. Імена лежать у `<h3>` **без** ключів i18n (тобто однакові для обох мов), фото — в `src` сусідньої `<img>`, а ролі й описи — під ключами `pastor1–3.{role,sub,bio}` та `elder1–8.{role,desc}`. У пресвітерів немає `sub`, тому `subtitle` — nullable. `slug` утворюється транслітерацією імені; таблиця транслітерації задана явно, бо автоматична дала б різні результати в різних середовищах.

- [ ] **Step 1: Написати падаючий тест**

Append to `tests/content.test.js`:

```js
test('усі 11 служителів витягнуті: 3 пастори і 8 пресвітерів', () => {
  const entries = readCollection('pastors');
  assert.equal(entries.length, 11);

  const byGroup = entries.reduce((acc, { data }) => {
    acc[data.group] = (acc[data.group] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byGroup, { pastor: 3, elder: 8 });
});

test('кожен служитель має імʼя, фото, порядок і двомовну роль', () => {
  const orders = new Set();

  for (const { file, data } of readCollection('pastors')) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.ok(data.name.trim().length > 0, `${file}: без імені`);
    assert.match(data.photo, /^https?:\/\//, `${file}: фото не є посиланням`);
    assert.ok(data.role.uk.trim().length > 0, `${file}: роль без uk`);
    assert.ok(data.role.en.trim().length > 0, `${file}: роль без en`);
    assert.ok(data.bio.uk.trim().length > 0, `${file}: опис без uk`);
    assert.ok(data.bio.en.trim().length > 0, `${file}: опис без en`);

    // Порядок задає розкладку сторінки. Дублікат означав би, що двоє
    // претендують на одне місце, і сортування стало б недетермінованим.
    const orderKey = `${data.group}:${data.order}`;
    assert.ok(!orders.has(orderKey), `${file}: дублікат порядку ${orderKey}`);
    orders.add(orderKey);
  }
});

test('старший пастор перенесений разом із підзаголовком', () => {
  const senior = readCollection('pastors').find(({ data }) => data.slug === 'valerii-hryhorash');
  assert.ok(senior, 'немає запису Валерія Григораша');
  assert.equal(senior.data.name, 'Валерій Григораш');
  assert.equal(senior.data.role.uk, 'Старший пастор');
  assert.equal(senior.data.subtitle.uk, 'Засновник і старший пастор');
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/content.test.js`
Expected: FAIL — `ENOENT … src/content/pastors`

- [ ] **Step 3: Додати схему**

Append to `src/content.config.ts`:

```ts
const pastors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/pastors' }),
  schema: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    photo: z.string().min(1),
    order: z.number().int().nonnegative(),
    group: z.enum(['pastor', 'elder']),
    role: localized,
    // У пресвітерів підзаголовка немає — у легасі це ключ лише в pastorN.
    subtitle: localized.nullable(),
    bio: localized,
  }),
});
```

І розширити експорт відповідно.

- [ ] **Step 4: Додати транслітерацію у бібліотеку читання**

Append to `scripts/lib/legacy-source.mjs`:

```js
// Таблиця задана явно, бо localeCompare/normalize дають різні результати
// в різних збірках Node, а slug має бути стабільним назавжди: він стане URL.
const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'iu', я: 'ia', "'": '', '’': '',
};

export const slugifyName = (name) =>
  name
    .toLowerCase()
    .split('')
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
```

- [ ] **Step 5: Додати витягування пасторів**

Append to `scripts/extract-legacy-content.mjs`:

```js
import { parse } from 'node-html-parser';
import { readLegacy, readPageStrings, slugifyName } from './lib/legacy-source.mjs';

// Карта «звідки → куди» для кожного ключа data-i18n. Заповнюється тими самими
// функціями, що пишуть дані, — тоді вона не може розійтися з тим, що записано.
// Задача 11 звіряє за нею перенесене з легасі побайтово.
export const keyMap = [];
export const mapKey = (page, key, destination) => keyMap.push({ page, key, destination });

function extractPastors() {
  const strings = readPageStrings('pastors.dc.html');
  const root = parse(readLegacy('pastors.dc.html'));
  const pair = (key) => strings.get(key);

  const cards = [
    ...root.querySelectorAll('.pastor-card').map((el, i) => ({ el, group: 'pastor', i })),
    ...root.querySelectorAll('.elder-card').map((el, i) => ({ el, group: 'elder', i })),
  ];

  for (const { el, group, i } of cards) {
    const prefix = group === 'pastor' ? `pastor${i + 1}` : `elder${i + 1}`;
    const name = el.querySelector('h3').textContent.trim();
    const slug = slugifyName(name);

    writeJson(`src/content/pastors/${slug}.json`, {
      slug,
      name,
      photo: el.querySelector('img').getAttribute('src'),
      order: i,
      group,
      role: pair(`${prefix}.role`),
      subtitle: group === 'pastor' ? pair(`${prefix}.sub`) : null,
      bio: group === 'pastor' ? pair(`${prefix}.bio`) : pair(`${prefix}.desc`),
    });

    mapKey('pastors.dc.html', `${prefix}.role`, `pastors:${slug}.role`);
    mapKey('pastors.dc.html', `${prefix}.${group === 'pastor' ? 'bio' : 'desc'}`, `pastors:${slug}.bio`);
    if (group === 'pastor') mapKey('pastors.dc.html', `${prefix}.sub`, `pastors:${slug}.subtitle`);
  }

  console.log(`pastors: ${cards.length}`);
}
```

І виклик `extractPastors();` поруч із рештою.

Класи звірені з розміткою: у `pastors.dc.html` є `.pastor-card` (3 штуки,
всередині `.pastor-photo` і `.pastor-body`) та `.elder-card` (8 штук).

- [ ] **Step 6: Запустити витягування і тести**

Run: `npm run extract && npm test`
Expected: `pastors: 11`; збірка проходить; `tests/content.test.js` — 13 tests PASS

- [ ] **Step 7: Коміт**

```bash
git add src/content.config.ts src/content/pastors scripts/ tests/content.test.js
git commit -m "feat: 11 служителів витягнуті з розмітки в колекцію

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 8: колекція `leader-resources`

**Files:**
- Modify: `src/content.config.ts`
- Modify: `scripts/extract-legacy-content.mjs`
- Create: `src/content/leader-resources/*.json` (12 файлів, згенеровані)
- Modify: `tests/content.test.js`

**Interfaces:**
- Consumes: `localized`, `writeJson`, `readPageStrings`, `readLegacy`, `readCollection`.
- Produces: колекція `leader-resources` з полями `slug, kind ('document'|'link'), order, url, format, title, description, meta`.

**Особливість джерела.** У `leaders.dc.html` всі 6 документів і всі 6 посилань мають `href="#"` — реальних адрес немає. Це **зберігається як є** (`url: null`), бо вигадати їх ми не можемо, а мовчазна заглушка `#` у даних виглядала б як справжня адреса. Тип файлу читається з класу значка (`doc-ic pdf` → `pdf`). У посилань немає `meta`, у документів воно є (`PDF · 1.8 МБ`) і локалізоване.

- [ ] **Step 1: Написати падаючий тест**

Append to `tests/content.test.js`:

```js
test('усі 12 ресурсів лідерів витягнуті: 6 документів і 6 посилань', () => {
  const entries = readCollection('leader-resources');
  assert.equal(entries.length, 12);

  const byKind = entries.reduce((acc, { data }) => {
    acc[data.kind] = (acc[data.kind] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byKind, { document: 6, link: 6 });
});

test('документи несуть формат і двомовне підписання, посилання — ні', () => {
  for (const { file, data } of readCollection('leader-resources')) {
    assert.ok(data.title.uk.trim().length > 0, `${file}: назва без uk`);
    assert.ok(data.title.en.trim().length > 0, `${file}: назва без en`);

    if (data.kind === 'document') {
      assert.ok(['pdf', 'doc', 'xls', 'ppt'].includes(data.format), `${file}: формат ${data.format}`);
      assert.ok(data.meta.uk.trim().length > 0, `${file}: документ без підпису`);
    } else {
      assert.equal(data.format, null, `${file}: у посилання зʼявився формат файлу`);
      assert.equal(data.meta, null, `${file}: у посилання зʼявився підпис файлу`);
    }
  }
});

test('відсутні адреси збережені як null, а не як заглушка «#»', () => {
  // У легасі всі href дорівнюють "#". Записати "#" у дані означало б
  // видати заглушку за адресу; null чесно каже «замовник ще не дав».
  for (const { file, data } of readCollection('leader-resources')) {
    assert.notEqual(data.url, '#', `${file}: заглушка # потрапила в дані`);
  }
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/content.test.js`
Expected: FAIL — `ENOENT … src/content/leader-resources`

- [ ] **Step 3: Додати схему**

Append to `src/content.config.ts`:

```ts
const leaderResources = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/leader-resources' }),
  schema: z.object({
    slug: z.string().min(1),
    kind: z.enum(['document', 'link']),
    order: z.number().int().nonnegative(),
    // У легасі всі href — "#". null чесніше за заглушку: заглушку
    // неможливо відрізнити від справжньої адреси при перевірці.
    url: z.string().min(1).nullable(),
    format: z.enum(['pdf', 'doc', 'xls', 'ppt']).nullable(),
    title: localized,
    description: localized,
    meta: localized.nullable(),
  }),
});
```

І розширити експорт (ключ колекції — `'leader-resources'`):

```ts
export const collections = {
  ministries, churches, projects, testimonies, pastors,
  'leader-resources': leaderResources,
};
```

- [ ] **Step 4: Додати витягування**

Append to `scripts/extract-legacy-content.mjs`:

```js
function extractLeaderResources() {
  const strings = readPageStrings('leaders.dc.html');
  const root = parse(readLegacy('leaders.dc.html'));
  const href = (el) => {
    const value = el.getAttribute('href');
    return value && value !== '#' ? value : null;
  };

  root.querySelectorAll('.doc-card').forEach((el, i) => {
    const n = i + 1;
    writeJson(`src/content/leader-resources/document-${n}.json`, {
      slug: `document-${n}`,
      kind: 'document',
      order: i,
      url: href(el),
      // Формат читається з класу значка: <span class="doc-ic pdf">.
      format: el.querySelector('.doc-ic').classNames.split(/\s+/).find((c) => c !== 'doc-ic'),
      title: strings.get(`doc${n}.title`),
      description: strings.get(`doc${n}.desc`),
      meta: strings.get(`doc${n}.meta`),
    });

    for (const [legacy, moved] of [['title', 'title'], ['desc', 'description'], ['meta', 'meta']]) {
      mapKey('leaders.dc.html', `doc${n}.${legacy}`, `leader-resources:document-${n}.${moved}`);
    }
  });

  root.querySelectorAll('.res-card').forEach((el, i) => {
    const n = i + 1;
    writeJson(`src/content/leader-resources/link-${n}.json`, {
      slug: `link-${n}`,
      kind: 'link',
      order: i,
      url: href(el),
      format: null,
      title: strings.get(`res${n}.title`),
      description: strings.get(`res${n}.desc`),
      meta: null,
    });

    mapKey('leaders.dc.html', `res${n}.title`, `leader-resources:link-${n}.title`);
    mapKey('leaders.dc.html', `res${n}.desc`, `leader-resources:link-${n}.description`);
  });

  console.log('leader-resources: 12');
}
```

І виклик `extractLeaderResources();`.

- [ ] **Step 5: Запустити витягування і тести**

Run: `npm run extract && npm test`
Expected: `leader-resources: 12`; збірка проходить; `tests/content.test.js` — 16 tests PASS

- [ ] **Step 6: Коміт**

```bash
git add src/content.config.ts src/content/leader-resources scripts/extract-legacy-content.mjs tests/content.test.js
git commit -m "feat: 12 ресурсів лідерів витягнуті з розмітки в колекцію

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 9: глобалі — `site-settings`, `contact-info`, `donate-settings`

**Files:**
- Modify: `src/content.config.ts`
- Modify: `scripts/extract-legacy-content.mjs`
- Create: `src/content/singletons/site-settings.json`
- Create: `src/content/singletons/contact-info.json`
- Create: `src/content/singletons/donate-settings.json`
- Modify: `tests/content.test.js`

**Interfaces:**
- Consumes: `localized`, `geoPoint`, `writeJson`, `readPageStrings`.
- Produces: три колекції-одиночки через лоадер `file()`. Кожен файл — обʼєкт `{ "main": { … } }`: `file()` робить ключі верхнього рівня ідентифікаторами записів, тож одиночка — це один запис із `id === 'main'`.
- Produces: `readSingleton(name)` у `tests/content.test.js` — читає `src/content/singletons/<name>.json` і повертає `.main`.

**Джерела фактів** (усі — з `index.html`, звірити перед записом):
адреса `вул. Федора Караманиця, 33` / `33 Fedora Karamanytsia St.`; місто `Кривий Ріг` / `Kryvyi Rih`; телефон `+380991339969`, показується як `099 133 99 69`; пошта `info@houseofbread.church`; служіння — субота, `12:00–14:00`; карта `https://www.google.com/maps?cid=14553890085252701377`; Facebook `https://www.facebook.com/dom.hleba.org`; YouTube `https://www.youtube.com/@Dim-Hliba`; Instagram `https://www.instagram.com/dim_hliba_kr/`; Telegram `https://t.me/domhleba_kr`; LiqPay `https://www.liqpay.ua/uk/checkout/card/donatedh`; пресети калькулятора — стартова сума `500` і кнопки `+200/+500/+1000`.

- [ ] **Step 1: Написати падаючий тест**

Append to `tests/content.test.js`:

```js
const readSingleton = (name) =>
  JSON.parse(readFileSync(contentDir(`singletons/${name}.json`), 'utf8')).main;

test('контакти — єдине джерело правди і містять усі факти для JSON-LD', () => {
  const contact = readSingleton('contact-info');

  assert.equal(contact.phone, '+380991339969');
  assert.equal(contact.email, 'info@houseofbread.church');
  assert.equal(contact.address.uk, 'вул. Федора Караманиця, 33');
  assert.equal(contact.address.en, '33 Fedora Karamanytsia St.');
  assert.equal(contact.city.uk, 'Кривий Ріг');
  assert.ok(contact.serviceDay.uk.trim().length > 0, 'немає дня служіння');
  assert.ok(contact.serviceTime.trim().length > 0, 'немає часу служіння');
  assert.match(contact.mapUrl, /^https:\/\//);

  // Координати потрібні розмітці Church на Етапі 3, джерела немає ніде.
  // Явний null означає «знаємо, що бракує», а не «забули поле».
  assert.equal(contact.geo, null);
});

test('усі чотири соцмережі перенесені як абсолютні адреси', () => {
  const social = readSingleton('site-settings').social;

  for (const key of ['facebook', 'youtube', 'instagram', 'telegram']) {
    assert.match(social[key], /^https:\/\//, `${key}: не абсолютна адреса`);
  }
});

test('пожертви: посилання LiqPay і пресети калькулятора', () => {
  const donate = readSingleton('donate-settings');

  assert.match(donate.liqpayUrl, /^https:\/\/www\.liqpay\.ua\//);
  assert.equal(donate.defaultAmount, 500);
  assert.deepEqual(donate.quickAmounts, [200, 500, 1000]);
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/content.test.js`
Expected: FAIL — `ENOENT … singletons/contact-info.json`

- [ ] **Step 3: Додати схеми**

Append to `src/content.config.ts`:

```ts
import { file } from 'astro/loaders';

// Одиночка = один запис із id "main". file() робить ключі верхнього рівня
// ідентифікаторами, тож обгортка {"main": …} — це ціна того, щоб одиночка
// теж валідувалася схемою на збірці, а не читалася як сирий JSON.
const siteSettings = defineCollection({
  loader: file('src/content/singletons/site-settings.json'),
  schema: z.object({
    name: localized,
    logo: z.string().min(1),
    defaultOgImage: z.string().nullable(),
    social: z.object({
      facebook: z.string().url(),
      youtube: z.string().url(),
      instagram: z.string().url(),
      telegram: z.string().url(),
    }),
  }),
});

const contactInfo = defineCollection({
  loader: file('src/content/singletons/contact-info.json'),
  schema: z.object({
    address: localized,
    city: localized,
    geo: geoPoint,
    phone: z.string().min(1),
    phoneDisplay: z.string().min(1),
    email: z.string().email(),
    serviceDay: localized,
    serviceTime: z.string().min(1),
    mapUrl: z.string().url(),
  }),
});

const donateSettings = defineCollection({
  loader: file('src/content/singletons/donate-settings.json'),
  schema: z.object({
    liqpayUrl: z.string().url(),
    defaultAmount: z.number().int().positive(),
    quickAmounts: z.array(z.number().int().positive()).min(1),
  }),
});
```

І розширити експорт: `siteSettings, contactInfo, donateSettings`.

- [ ] **Step 4: Додати витягування**

Append to `scripts/extract-legacy-content.mjs`:

```js
function extractGlobals() {
  const home = readPageStrings('index.html');

  writeJson('src/content/singletons/site-settings.json', {
    main: {
      name: { uk: 'Дім Хліба', en: 'House of Bread Church' },
      logo: 'uploads/logo_white.png',
      defaultOgImage: null,
      social: {
        facebook: 'https://www.facebook.com/dom.hleba.org',
        youtube: 'https://www.youtube.com/@Dim-Hliba',
        instagram: 'https://www.instagram.com/dim_hliba_kr/',
        telegram: 'https://t.me/domhleba_kr',
      },
    },
  });

  writeJson('src/content/singletons/contact-info.json', {
    main: {
      // Адреса й день служіння беруться з ключів головної, а не набиваються
      // вручну: так вони гарантовано збігаються з тим, що зараз в ефірі.
      address: home.get('hero.addr'),
      city: { uk: 'Кривий Ріг', en: 'Kryvyi Rih' },
      geo: null,
      phone: '+380991339969',
      phoneDisplay: '099 133 99 69',
      email: 'info@houseofbread.church',
      serviceDay: home.get('con.svcDay'),
      serviceTime: '12:00–14:00',
      mapUrl: 'https://www.google.com/maps?cid=14553890085252701377',
    },
  });

  writeJson('src/content/singletons/donate-settings.json', {
    main: {
      liqpayUrl: 'https://www.liqpay.ua/uk/checkout/card/donatedh',
      defaultAmount: 500,
      quickAmounts: [200, 500, 1000],
    },
  });

  console.log('singletons: site-settings, contact-info, donate-settings');
}
```

І виклик `extractGlobals();`.

`uploads/logo_white.png` — реальний файл, саме він стоїть у `index.html:408`
і в футері. Інших логотипів у `uploads/` немає.

- [ ] **Step 5: Запустити витягування і тести**

Run: `npm run extract && npm test`
Expected: збірка проходить; `tests/content.test.js` — 19 tests PASS

- [ ] **Step 6: Коміт**

```bash
git add src/content.config.ts src/content/singletons scripts/extract-legacy-content.mjs tests/content.test.js
git commit -m "feat: глобалі сайту, контактів і пожертв як одиночки зі схемою

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 10: одиночка `homepage` — 100 ключів головної

**Files:**
- Modify: `src/content.config.ts`
- Modify: `scripts/extract-legacy-content.mjs`
- Create: `src/content/singletons/homepage.json`
- Modify: `tests/content.test.js`

**Interfaces:**
- Consumes: `localized`, `writeJson`, `readPageStrings`.
- Produces: колекція-одиночка `homepage`; усередині — групи `nav, cta, hero, about, beliefs[7], news{…, items[3]}, fb, wwb{…, items[4]}, testimonies{…, items[4], all}, ministries, pastors, contacts, donate, footer`.

**Чому групи, а не плаский словник.** Спека вимагає «згруповані по секціях», і Спека 3 робить із цього історію з вкладеними блоками. Плаский `{'hero.title': …}` довелося б перегруповувати вручну на Етапі 4.

- [ ] **Step 1: Написати падаючий тест**

Append to `tests/content.test.js`:

```js
test('головна перенесена посекційно, з правильною кількістю повторюваних блоків', () => {
  const home = readSingleton('homepage');

  assert.equal(home.beliefs.length, 7, 'сім тверджень віри');
  assert.equal(home.news.items.length, 3, 'три новинні картки');
  assert.equal(home.wwb.items.length, 4, 'чотири блоки «у що віримо»');
  assert.equal(home.testimonies.items.length, 4, 'чотири свідчення в каруселі');
  assert.equal(Object.keys(home.nav).length, 9, 'девʼять пунктів меню');
});

test('текст головної перенесений побайтово, разом із розміткою всередині', () => {
  const home = readSingleton('homepage');

  // hero.title містить <em> і <br>. Якби ми зберігали текст, а не розмітку,
  // заголовок головної втратив би курсив і перенос — тобто змінив вигляд.
  assert.equal(home.hero.title.uk, 'Церква <em>«Дім Хліба»</em><br>Кривий Ріг');
  assert.equal(home.hero.title.en, 'House of Bread Church<br><em>Kryvyi Rih</em>');
  assert.equal(home.donate.ref.uk, '2 Коринтян 9:6–7');
});

test('кожне поле головної двомовне й непорожнє', () => {
  for (const [path, pair] of localizedPairs(readSingleton('homepage'))) {
    assert.ok(pair.uk.trim().length > 0, `homepage${path}: порожня uk`);
    assert.ok(String(pair.en).trim().length > 0, `homepage${path}: порожня en`);
  }
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/content.test.js`
Expected: FAIL — `ENOENT … singletons/homepage.json`

- [ ] **Step 3: Додати схему**

Append to `src/content.config.ts`:

```ts
const homepage = defineCollection({
  loader: file('src/content/singletons/homepage.json'),
  schema: z.object({
    nav: z.record(z.string(), localized),
    cta: z.record(z.string(), localized),
    hero: z.record(z.string(), localized),
    about: z.record(z.string(), localized),
    // Рівно сім тверджень віри: у легасі це belief.1…belief.7. Масив довільної
    // довжини мовчки проковтнув би загублене твердження.
    beliefs: z.array(localized).length(7),
    news: z.object({
      eyebrow: localized, title: localized, lead: localized, more: localized,
      items: z.array(z.object({ date: localized, title: localized, text: localized })).length(3),
    }),
    fb: z.object({ title: localized, text: localized }),
    wwb: z.object({
      eyebrow: localized, title: localized,
      items: z.array(z.object({ title: localized, text: localized })).length(4),
    }),
    testimonies: z.object({
      eyebrow: localized, title: localized, all: localized,
      items: z.array(z.object({ text: localized, name: localized, role: localized })).length(4),
    }),
    ministries: z.record(z.string(), localized),
    pastors: z.record(z.string(), localized),
    contacts: z.record(z.string(), localized),
    donate: z.record(z.string(), localized),
    footer: z.record(z.string(), localized),
  }),
});
```

І розширити експорт.

- [ ] **Step 4: Додати витягування**

Append to `scripts/extract-legacy-content.mjs`:

```js
function extractHomepage() {
  const s = readPageStrings('index.html');
  const get = (key) => {
    const pair = s.get(key);
    if (!pair) throw new Error(`index.html: немає ключа ${key}`);
    return pair;
  };
  // Відбирає всі ключі з префіксом і скидає префікс: nav.home → home.
  // Секції з нумерованими блоками (news, wwb, tst) так брати не можна —
  // group('news') захопив би і news.1.date, — тому вони зібрані явно.
  const group = (prefix) =>
    Object.fromEntries(
      [...s.keys()]
        .filter((k) => k.startsWith(`${prefix}.`))
        .map((k) => [k.slice(prefix.length + 1), s.get(k)]),
    );

  writeJson('src/content/singletons/homepage.json', {
    main: {
      nav: group('nav'),
      cta: group('cta'),
      hero: group('hero'),
      about: group('about'),
      beliefs: [1, 2, 3, 4, 5, 6, 7].map((n) => get(`belief.${n}`)),
      news: {
        eyebrow: get('news.eyebrow'), title: get('news.title'),
        lead: get('news.lead'), more: get('news.more'),
        items: [1, 2, 3].map((n) => ({
          date: get(`news.${n}.date`), title: get(`news.${n}.title`), text: get(`news.${n}.text`),
        })),
      },
      fb: { title: get('fb.title'), text: get('fb.text') },
      wwb: {
        eyebrow: get('wwb.eyebrow'), title: get('wwb.title'),
        items: [1, 2, 3, 4].map((n) => ({ title: get(`wwb.${n}.t`), text: get(`wwb.${n}.d`) })),
      },
      testimonies: {
        eyebrow: get('tst.eyebrow'), title: get('tst.title'), all: get('tst.all'),
        items: [1, 2, 3, 4].map((n) => ({
          text: get(`tst.${n}.text`), name: get(`tst.${n}.name`), role: get(`tst.${n}.role`),
        })),
      },
      ministries: group('min'),
      pastors: group('past'),
      contacts: group('con'),
      donate: group('don'),
      footer: group('foot'),
    },
  });

  // Реєструємо, куди поїхав кожен ключ головної. Відображення префіксів на
  // імена груп задане тут один раз — саме за цією картою Задача 11 доводить,
  // що жоден із 240 ключів не загубився і не продублювався.
  const GROUP_OF_PREFIX = {
    nav: 'nav', cta: 'cta', hero: 'hero', about: 'about',
    min: 'ministries', past: 'pastors', con: 'contacts', don: 'donate', foot: 'footer',
  };

  for (const key of s.keys()) {
    const [prefix, ...rest] = key.split('.');

    if (prefix === 'belief') { mapKey('index.html', key, `homepage:beliefs.${Number(rest[0]) - 1}`); continue; }
    if (prefix === 'news' && rest.length === 2) {
      mapKey('index.html', key, `homepage:news.items.${Number(rest[0]) - 1}.${rest[1]}`); continue;
    }
    if (prefix === 'news') { mapKey('index.html', key, `homepage:news.${rest[0]}`); continue; }
    if (prefix === 'fb') { mapKey('index.html', key, `homepage:fb.${rest[0]}`); continue; }
    if (prefix === 'wwb' && rest.length === 2) {
      const field = rest[1] === 't' ? 'title' : 'text';
      mapKey('index.html', key, `homepage:wwb.items.${Number(rest[0]) - 1}.${field}`); continue;
    }
    if (prefix === 'wwb') { mapKey('index.html', key, `homepage:wwb.${rest[0]}`); continue; }
    if (prefix === 'tst' && rest.length === 2) {
      mapKey('index.html', key, `homepage:testimonies.items.${Number(rest[0]) - 1}.${rest[1]}`); continue;
    }
    if (prefix === 'tst') { mapKey('index.html', key, `homepage:testimonies.${rest[0]}`); continue; }

    const groupName = GROUP_OF_PREFIX[prefix];
    if (!groupName) throw new Error(`index.html: префікс ${prefix} не має групи`);
    mapKey('index.html', key, `homepage:${groupName}.${rest.join('.')}`);
  }

  console.log('homepage: 100 ключів');
}
```

І виклик `extractHomepage();`.

`group('don')` віддає ключ `ref` — саме так він і лишається (`donate.ref`),
без перейменування: жодного конфлікту з іншими ключами немає, а зайве
перейменування довелося б памʼятати ще й у Спеці 3.

- [ ] **Step 5: Запустити витягування і тести**

Run: `npm run extract && npm test`
Expected: збірка проходить; `tests/content.test.js` — 22 tests PASS

- [ ] **Step 6: Коміт**

```bash
git add src/content.config.ts src/content/singletons/homepage.json scripts/extract-legacy-content.mjs tests/content.test.js
git commit -m "feat: 100 ключів головної як посекційна одиночка

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 11: колекція `pages`, словники `uk.json`/`en.json` і тест покриття

**Files:**
- Modify: `src/content.config.ts`
- Modify: `scripts/extract-legacy-content.mjs`
- Create: `src/content/singletons/pages.json`
- Create: `src/i18n/uk.json`, `src/i18n/en.json`
- Create: `scripts/key-map.json` (згенерована)
- Create: `tests/content-fidelity.test.js`
- Modify: `tests/content.test.js`

**Interfaces:**
- Consumes: `localized`, `writeJson`, `readPageStrings`, `LEGACY_PAGES`.
- Produces: колекція `pages` — дев’ять записів: шість перенесених (`churches`, `ministries`, `projects`, `testimonies`, `pastors`, `leaders`) з `eyebrow, title, lead` і трьома необовʼязковими групами, та три нові (`about`, `contacts`, `donate`) лише із `title` і `body: null`.
- Produces: `src/i18n/uk.json` і `src/i18n/en.json` — плаский словник із **однаковим** набором ключів у обох файлах.
- Produces: `scripts/key-map.json` — масив `{page, key, destination}`, де `destination` — рядок виду `homepage:hero.title`, `pastors:valerii-hryhorash.role`, `i18n:footBack.churches`.

**Перейменування ключів, що конфліктують.** `foot.back` має 4 різні значення, `info.title` — 2, `more.title` — 3, `help.*` — по 2. Плаский словник їх не вміщує, тому:

| Легасі | Сторінки | Новий ключ |
|---|---|---|
| `foot.back` | churches/leaders/ministries/pastors/projects/testimonies | `footBack.home` |
| `foot.back` | church | `footBack.churches` |
| `foot.back` | ministry | `footBack.ministries` |
| `foot.back` | project | `footBack.projects` |
| `info.title` | church | `info.aboutChurch` |
| `info.title` | project | `info.aboutProject` |
| `more.title` | church | `more.churches` |
| `more.title` | ministry | `more.ministries` |
| `more.title` | project | `more.projects` |
| `help.{title,desc,btn}` | leaders | `pages:leaders.help.*` (контент сторінки) |
| `help.{title,desc,btn}` | pastors | `pages:pastors.help.*` (контент сторінки) |

Решта (`back.*`, `crumb.*`, `cta.directions`, `cta.join`, `fact.*`, `foot.rights`, `info.eyebrow`, `res.go`, `docs.count`, `res.count`) мають на всіх сторінках однакове значення і переїжджають під тими самими іменами.

- [ ] **Step 1: Написати падаючий тест покриття**

Create `tests/content-fidelity.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGACY_PAGES, readPageStrings } from '../scripts/lib/legacy-source.mjs';

// Цей файл звіряє перенесений контент із живим легасі. Він свідомо помре
// разом із легасі на Етапі 2 — до того моменту він єдиний доводить, що
// перенесення не загубило й не переписало жодного рядка.
const read = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

const keyMap = read('../scripts/key-map.json');

const sources = {
  homepage: read('../src/content/singletons/homepage.json').main,
  pages: read('../src/content/singletons/pages.json'),
  i18n: { uk: read('../src/i18n/uk.json'), en: read('../src/i18n/en.json') },
};

// destination виду "homepage:hero.title" → пара {uk, en} із перенесених даних.
function resolve(destination) {
  const [root, path] = destination.split(':');
  const steps = path.split('.');

  if (root === 'i18n') {
    return { uk: steps.reduce((o, k) => o?.[k], sources.i18n.uk),
             en: steps.reduce((o, k) => o?.[k], sources.i18n.en) };
  }
  if (root === 'homepage') return steps.reduce((o, k) => o?.[k], sources.homepage);
  if (root === 'pages') return steps.reduce((o, k) => o?.[k], sources.pages);

  const [file, ...rest] = steps;
  const entry = read(`../src/content/${root}/${file}.json`);
  return rest.reduce((o, k) => o?.[k], entry);
}

test('кожна пара «сторінка + ключ» із легасі має рівно одне призначення', () => {
  const mapped = new Set(keyMap.map(({ page, key }) => `${page}|${key}`));
  assert.equal(mapped.size, keyMap.length, 'у карті є дублікати');

  let total = 0;
  for (const page of LEGACY_PAGES) {
    for (const key of readPageStrings(page).keys()) {
      total += 1;
      assert.ok(mapped.has(`${page}|${key}`), `${page}: ключ ${key} нікуди не перенесений`);
    }
  }
  assert.equal(keyMap.length, total, 'у карті є призначення для неіснуючих ключів');
});

test('значення за призначенням побайтово дорівнює легасі, обома мовами', () => {
  const byPage = new Map(LEGACY_PAGES.map((p) => [p, readPageStrings(p)]));

  for (const { page, key, destination } of keyMap) {
    const legacy = byPage.get(page).get(key);
    const moved = resolve(destination);

    assert.ok(moved, `${page}:${key} → ${destination}: призначення не існує`);
    assert.equal(moved.uk, legacy.uk, `${page}:${key} → ${destination}: розійшлася uk`);
    assert.equal(moved.en, legacy.en, `${page}:${key} → ${destination}: розійшлася en`);
  }
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає**

Run: `node --test tests/content-fidelity.test.js`
Expected: FAIL — `ENOENT … scripts/key-map.json`

- [ ] **Step 3: Додати схему сторінок**

Append to `src/content.config.ts`:

```ts
const pages = defineCollection({
  loader: file('src/content/singletons/pages.json'),
  schema: z.object({
    // Обовʼязковий лише заголовок: три нові сторінки (about, contacts, donate)
    // ще не мають ані надзаголовка, ані прози. Порожні рядки замість
    // optional виглядали б як заповнений контент.
    title: localized,
    eyebrow: localized.optional(),
    lead: localized.optional(),
    heroTag: localized.optional(),
    // Додаткові заголовки секцій є лише в pastors і leaders.
    sections: z.record(z.string(), localized).optional(),
    help: z.object({ title: localized, desc: localized, btn: localized }).optional(),
    body: localized.nullable().optional(),
  }),
});
```

І розширити експорт.

- [ ] **Step 4: Додати витягування сторінок, словників і карти**

Append to `scripts/extract-legacy-content.mjs`. `keyMap` і `mapKey` уже оголошені в Задачі 7 — тут лише останні дві групи ключів:

```js
// Ключі, що на кожній сторінці означають те саме, — переїжджають як є.
const SHARED_UI_KEYS = [
  'back.home', 'back.churches', 'back.ministries', 'back.projects',
  'crumb.home', 'crumb.churches', 'crumb.ministries', 'crumb.projects',
  'cta.directions', 'cta.join',
  'fact.address', 'fact.leader', 'fact.pastor', 'fact.phone', 'fact.times',
  'foot.rights', 'info.eyebrow', 'res.go', 'docs.count', 'res.count',
];

// Ключі, що на різних сторінках означають різне, — перейменовуються.
const RENAMED_UI_KEYS = {
  'churches.dc.html|foot.back': 'footBack.home',
  'leaders.dc.html|foot.back': 'footBack.home',
  'ministries.dc.html|foot.back': 'footBack.home',
  'pastors.dc.html|foot.back': 'footBack.home',
  'projects.dc.html|foot.back': 'footBack.home',
  'testimonies.dc.html|foot.back': 'footBack.home',
  'church.dc.html|foot.back': 'footBack.churches',
  'ministry.dc.html|foot.back': 'footBack.ministries',
  'project.dc.html|foot.back': 'footBack.projects',
  'church.dc.html|info.title': 'info.aboutChurch',
  'project.dc.html|info.title': 'info.aboutProject',
  'church.dc.html|more.title': 'more.churches',
  'ministry.dc.html|more.title': 'more.ministries',
  'project.dc.html|more.title': 'more.projects',
};

function extractPagesAndUi() {
  const uk = {};
  const en = {};
  const pagesOut = {};
  // Плаский ключ «a.b» розкладаємо у вкладений обʼєкт: тест покриття
  // резолвить призначення саме по крапках.
  const put = (target, dotted, value) => {
    const steps = dotted.split('.');
    const last = steps.pop();
    steps.reduce((o, k) => (o[k] ??= {}), target)[last] = value;
  };

  const PAGE_SLUGS = {
    'churches.dc.html': 'churches',
    'ministries.dc.html': 'ministries',
    'projects.dc.html': 'projects',
    'testimonies.dc.html': 'testimonies',
    'pastors.dc.html': 'pastors',
    'leaders.dc.html': 'leaders',
  };

  for (const page of LEGACY_PAGES.filter((p) => p !== 'index.html')) {
    const strings = readPageStrings(page);
    const slug = PAGE_SLUGS[page];

    for (const [key, pair] of strings) {
      // Ключі служителів і ресурсів лідерів уже зареєстровані в Задачах 7–8 —
      // тут їх пропускаємо, інакше в карті зʼявився б дублікат.
      if (/^(pastor[1-3]|elder[1-8])\.(role|sub|bio|desc)$/.test(key)) continue;
      if (/^(doc|res)[1-6]\.(title|desc|meta)$/.test(key)) continue;

      if (slug && ['page.eyebrow', 'page.title', 'page.lead'].includes(key)) {
        put(pagesOut, `${slug}.${key.split('.')[1]}`, pair);
        mapKey(page, key, `pages:${slug}.${key.split('.')[1]}`);
        continue;
      }
      if (slug && key === 'hero.tag') {
        put(pagesOut, `${slug}.heroTag`, pair);
        mapKey(page, key, `pages:${slug}.heroTag`);
        continue;
      }
      if (slug && ['hero.locked', 'docs.title', 'res.title', 'past.eyebrow', 'past.title',
                   'past.lead', 'elders.eyebrow', 'elders.title', 'elders.lead'].includes(key)) {
        const name = key.replace('.', '_');
        put(pagesOut, `${slug}.sections.${name}`, pair);
        mapKey(page, key, `pages:${slug}.sections.${name}`);
        continue;
      }
      if (slug && key.startsWith('help.')) {
        const name = key.split('.')[1];
        put(pagesOut, `${slug}.help.${name}`, pair);
        mapKey(page, key, `pages:${slug}.help.${name}`);
        continue;
      }

      const renamed = RENAMED_UI_KEYS[`${page}|${key}`];
      const uiKey = renamed ?? (SHARED_UI_KEYS.includes(key) ? key : null);
      if (!uiKey) throw new Error(`${page}: ключ ${key} нікуди не призначений`);

      put(uk, uiKey, pair.uk);
      put(en, uiKey, pair.en);
      mapKey(page, key, `i18n:${uiKey}`);
    }
  }

  // Три нові сторінки (Спека 1: page-about, page-contacts, page-donate) у легасі
  // не існують. Заводимо їх із заголовком із пункту меню й порожньою прозою:
  // Етапу 2 потрібен запис, щоб було що рендерити, а текст напише замовник.
  const home = readPageStrings('index.html');
  for (const [pageSlug, navKey] of [
    ['about', 'nav.about'], ['contacts', 'nav.contacts'], ['donate', 'nav.donations'],
  ]) {
    pagesOut[pageSlug] = { title: home.get(navKey), body: null };
  }

  writeJson('src/content/singletons/pages.json', pagesOut);
  writeJson('src/i18n/uk.json', uk);
  writeJson('src/i18n/en.json', en);
  console.log(`pages: ${Object.keys(pagesOut).length}, i18n: ${keyMap.filter((k) => k.destination.startsWith('i18n:')).length} призначень`);
}
```

Заголовки трьох нових сторінок **не** реєструються в `key-map.json`: вони не
перенесені, а скопійовані з пунктів меню, які вже поїхали в `homepage`. Карта
відповідає на питання «куди дівся кожен легасі-ключ», і одна пара «сторінка +
ключ» у ній мусить мати рівно одне призначення.

Наприкінці скрипта:

```js
extractPagesAndUi();
writeJson('scripts/key-map.json', keyMap);
console.log(`key-map: ${keyMap.length} пар`);
```

- [ ] **Step 5: Запустити витягування і тест покриття**

Run: `npm run extract && node --test tests/content-fidelity.test.js`
Expected: `key-map: 240 пар`; обидва тести PASS

- [ ] **Step 6: Додати тест однакового набору ключів у словниках**

Append to `tests/content.test.js`:

```js
test('дев’ять сторінок мають запис: шість перенесених і три нові порожні', () => {
  const pages = JSON.parse(readFileSync(contentDir('singletons/pages.json'), 'utf8'));

  assert.deepEqual(Object.keys(pages).sort(), [
    'about', 'churches', 'contacts', 'donate', 'leaders',
    'ministries', 'pastors', 'projects', 'testimonies',
  ]);

  for (const slug of ['churches', 'ministries', 'projects', 'testimonies', 'pastors', 'leaders']) {
    assert.ok(pages[slug].lead.uk.trim().length > 0, `${slug}: перенесена сторінка без ліду`);
  }
  for (const slug of ['about', 'contacts', 'donate']) {
    // Проза цих сторінок — робота замовника. Явний null означає «ще немає»,
    // а вигаданий текст мовчки поїхав би в ефір як справжній.
    assert.equal(pages[slug].body, null, `${slug}: у нової сторінки зʼявився вигаданий текст`);
    assert.ok(pages[slug].title.uk.trim().length > 0, `${slug}: без заголовка`);
  }
});

test('uk.json і en.json мають однаковий набір ключів', () => {
  const flatten = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`));

  const uk = flatten(JSON.parse(readFileSync(
    fileURLToPath(new URL('../src/i18n/uk.json', import.meta.url)), 'utf8')));
  const en = flatten(JSON.parse(readFileSync(
    fileURLToPath(new URL('../src/i18n/en.json', import.meta.url)), 'utf8')));

  // Розбіжність означає, що на англійській сторінці підпис кнопки
  // просто зникне — і помітить це вже відвідувач, а не збірка.
  assert.deepEqual(uk.sort(), en.sort());
});
```

- [ ] **Step 7: Запустити всі тести**

Run: `npm test`
Expected: збірка проходить; усі тести PASS

- [ ] **Step 8: Коміт**

```bash
git add src/content.config.ts src/content/singletons/pages.json src/i18n scripts/ tests/
git commit -m "feat: заголовки сторінок, словники інтерфейсу і карта покриття 240 ключів

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 12: збірка падає на зіпсованому записі

**Files:**
- Create: `tests/content-schema.test.js`

**Interfaces:**
- Consumes: готові колекції з Задач 3–11.

**Чому окремий тест.** Спека вимагає: «Якщо у записі зникне `slug` або `icon` буде не зі списку — **збірка падає з помилкою**, а не сторінка ламається в продакшені». Це твердження про поведінку інструмента, і воно перевіряється лише справжньою збіркою на справді зіпсованих даних. Механіка та сама, що в Етапі 0 для `SITE_URL`: окремий процес `astro build` у власний `--outDir`.

- [ ] **Step 1: Написати падаючий тест**

Create `tests/content-schema.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

// Зіпсований запис кладеться у справжню теку колекції — інакше glob його не
// побачить, і тест перевіряв би не те. Прибирається у finally завжди.
function buildWith(entryFileName, entryData) {
  const entryPath = join(projectRoot, 'src/content/ministries', entryFileName);
  const outDir = mkdtempSync(join(tmpdir(), 'hob-schema-'));
  try {
    writeFileSync(entryPath, JSON.stringify(entryData), 'utf8');
    execFileSync(
      process.execPath,
      [join(projectRoot, 'node_modules/astro/astro.js'), 'build', '--outDir', outDir],
      { cwd: projectRoot, stdio: 'pipe' },
    );
    return { failed: false, output: '' };
  } catch (error) {
    return { failed: true, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  } finally {
    rmSync(entryPath, { force: true });
    rmSync(outDir, { recursive: true, force: true });
  }
}

const validMinistry = {
  slug: '__probe',
  icon: 'book',
  leader: 'Тест',
  phone: '+380000000000',
  name: { uk: 'Тест', en: 'Test' },
  summary: { uk: 'Тест', en: 'Test' },
  body: { uk: 'Тест', en: 'Test' },
  media: [{ type: 'image', src: 'https://example.test/a.jpg', alt: 'Тест' }],
  seo: { metaTitle: null, metaDescription: null, ogImage: null, noindex: false },
};

test('коректний запис збірку не ламає', { timeout: 120_000 }, () => {
  const { failed, output } = buildWith('__probe.json', validMinistry);
  assert.equal(failed, false, `валідний запис завалив збірку:\n${output}`);
});

test('невідома іконка валить збірку', { timeout: 120_000 }, () => {
  const { failed, output } = buildWith('__probe.json', { ...validMinistry, icon: 'rocket' });
  assert.equal(failed, true, 'збірка пройшла з іконкою поза списком 18');
  assert.match(output, /icon/i, 'у помилці не названо поле icon');
});

test('відсутній slug валить збірку', { timeout: 120_000 }, () => {
  const { slug, ...withoutSlug } = validMinistry;
  const { failed } = buildWith('__probe.json', withoutSlug);
  assert.equal(failed, true, 'збірка пройшла без slug');
});

test('порожній alt у галереї валить збірку', { timeout: 120_000 }, () => {
  const broken = {
    ...validMinistry,
    media: [{ type: 'image', src: 'https://example.test/a.jpg', alt: '' }],
  };
  const { failed } = buildWith('__probe.json', broken);
  assert.equal(failed, true, 'збірка пройшла з картинкою без опису');
});

test('локалізоване поле без англійської валить збірку', { timeout: 120_000 }, () => {
  const broken = { ...validMinistry, name: { uk: 'Тест', en: '' } };
  const { failed } = buildWith('__probe.json', broken);
  assert.equal(failed, true, 'збірка пройшла з порожнім перекладом');
});

test('голий YouTube-ID у відео збірку не ламає', { timeout: 120_000 }, () => {
  // Спека 1: video src приймає URL або ID. Схема не сміє звужувати до URL.
  const withBareId = {
    ...validMinistry,
    media: [{ type: 'video', src: 'ScMzIvxBSi4', alt: 'Відео' }],
  };
  const { failed, output } = buildWith('__probe.json', withBareId);
  assert.equal(failed, false, `голий ID відкинутий схемою:\n${output}`);
});
```

- [ ] **Step 2: Запустити тест і переконатися, що падає там, де треба**

Run: `node --test tests/content-schema.test.js`
Expected: усі 6 тестів PASS, якщо схеми з Задач 3–11 на місці. Якщо якийсь падає — це справжній дефект схеми, і правити треба `src/content.config.ts`, а не тест.

- [ ] **Step 3: Переконатися, що тест не лишає сміття**

Run: `git status --porcelain`
Expected: порожньо, крім самого нового тесту — `__probe.json` прибраний.

- [ ] **Step 4: Коміт**

```bash
git add tests/content-schema.test.js
git commit -m "test: збірка падає на зіпсованому записі колекції

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 13: записати відкриті питання контенту і оновити CLAUDE.md

**Files:**
- Create: `docs/superpowers/notes/2026-09-23-content-gaps.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: результати Задач 3–12.

**Чому це частина плану, а не «потім».** Перенесення оголило дірки в даних, які ми свідомо **не** латали. Якщо їх не записати зараз, на Етапі 3 (JSON-LD потребує координат) і при передачі редактору вони спливуть як сюрприз.

- [ ] **Step 1: Написати нотатку про дірки в контенті**

Create `docs/superpowers/notes/2026-09-23-content-gaps.md`:

```markdown
# Дірки в контенті, виявлені при перенесенні (Етап 1)

Перенесення було побайтовим: нічого з переліченого **не** виправлено в даних.
Це робота замовника на кроці «Актуалізація контенту» (див. дорожню карту).

| # | Що | Де | Наслідок, якщо лишити |
|---|---|---|---|
| 1 | `geo.lat` / `geo.lng` відсутні | `contact-info`, усі 6 церков | Етап 3 не зможе видати розмітку `Church` з координатами |
| 2 | Усі 12 ресурсів лідерів мають `url: null` (у легасі `href="#"`) | `leader-resources` | сторінка для лідерів показує картки, які нікуди не ведуть |
| 3 | `tst.4.text` англійською коротший за той самий текст у `testimonies-data.js` (бракує «with family») | `homepage.testimonies.items[3]` проти `vitalii-s` | одне свідчення двома різними англійськими текстами на різних сторінках |
| 4 | `seo.*` порожні в усіх записах | усі колекції | Етап 3 дасть мета-теги з фолбеків, а не з контенту |
| 5 | 31 зображення — заглушки `picsum.photos` / `unsplash.com` | усі галереї, фото служителів | реальних фото немає, OG-картинки теж |
| 6 | `/about/`, `/contacts/`, `/donate/` мають лише заголовок із меню, `body: null` | `pages.about`, `pages.contacts`, `pages.donate` | сторінки збудуються порожніми й не ранжуватимуться (це вже зафіксовано в дорожній карті) |
```

- [ ] **Step 2: Оновити CLAUDE.md**

У `CLAUDE.md` замінити абзац про Етап 0 на опис нового стану: контент живе у `src/content/**` під схемою з `src/content.config.ts`; додати `-data.js` і легасі `.html` не можна, їх читає лише `scripts/extract-legacy-content.mjs`; `npm run extract` перезаписує згенеровані файли; легасі-сайт усе ще в ефірі до Етапу 2.

Дослівний блок для заміни (поточний починається з `> **Stage 0 in progress`):

```markdown
> **Етап 1 завершено (міграція на Astro).** Контент сайту лежить у типізованих Content
> Collections: дані — `src/content/**`, схеми — `src/content.config.ts`, словники інтерфейсу —
> `src/i18n/{uk,en}.json`. Файли під `src/content/` **згенеровані** скриптом
> `npm run extract` з легасі (`*-data.js`, `index.html`, `*.dc.html`) — правити їх руками можна,
> але наступний `npm run extract` перезапише; якщо правка постійна, міняйте джерело або сам
> скрипт. `npm test` = `astro build` (він же валідує схему колекцій) + `node --test`.
> Легасі `.html` і `*-data.js` **досі є живим сайтом** до Етапу 2 — не чіпайте їх, і не чекайте,
> що зміна під `src/` на них вплине. На Windows/Git Bash команда зі змінною `BASE_PATH`
> потребує `MSYS_NO_PATHCONV=1` або запуску з PowerShell. Решта цього файлу описує легасі-сайт
> і буде переписана наприкінці Етапу 2.
```

- [ ] **Step 3: Прогнати повний набір тестів**

Run: `npm test`
Expected: збірка проходить; усі тести PASS

- [ ] **Step 4: Коміт**

```bash
git add docs/superpowers/notes/2026-09-23-content-gaps.md CLAUDE.md
git commit -m "docs: дірки в контенті після перенесення і оновлений CLAUDE.md

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Критерії готовності Етапу 1

- [ ] Весь контент сайту лежить у Content Collections зі схемою; `astro build` валідує його
- [ ] 18 служінь, 6 церков, 4 проєкти, 6 свідчень, 11 служителів, 12 ресурсів лідерів
- [ ] 4 одиночки (`site-settings`, `contact-info`, `donate-settings`, `homepage`) і колекція `pages` з девʼяти записів, включно з `about`, `contacts`, `donate` зі Спеки 1
- [ ] Усі 240 пар «сторінка + ключ» мають рівно одне призначення, і значення збігаються з легасі побайтово
- [ ] `uk.json` і `en.json` мають однаковий набір ключів
- [ ] Збірка падає на невідомій іконці, відсутньому `slug`, порожньому `alt` і порожньому перекладі
- [ ] Легасі-файли не змінені (`git diff` по `index.html`, `*.dc.html`, `*-data.js`, `support.js` — порожній)
- [ ] Дірки в контенті записані, `CLAUDE.md` оновлений

**Поза обсягом Етапу 1** (щоб не виникало спокуси): жодної `.astro`-сторінки, жодного компонента, жодного рендеру колекцій — це Етап 2. Мета-теги і JSON-LD — Етап 3.
