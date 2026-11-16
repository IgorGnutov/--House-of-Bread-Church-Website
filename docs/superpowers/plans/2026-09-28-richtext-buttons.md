# Форматований текст і посилання кнопок — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Тексти з описом редагуються в Storyblok як повноцінний richtext (три рівні), посилання на сторінки сайту
не ламаються від перейменувань, а кожна кнопка сайту має поле з адресою. На поточному контенті сайт виглядає піксель
у піксель так само.

**Architecture:** Документ редактора Storyblok (ProseMirror JSON) зберігається в `src/content` як є, у парі
`{uk, en}`. Межа безпеки — zod-схема (`richIssues`): allowlist вузлів, марок і атрибутів для кожного рівня, один формат
адрес `linkUrl`. `fromStory` нормалізує документ (прибирає атрибути редактора, розвʼязує посилання на історії за
`uuid` через карту маршрутів усіх історій), тож перетворення файли ↔ Storyblok точне. Рендер — `@storyblok/richtext` зі
своїми рендерерами; у шаблони HTML потрапляє лише через `Rich.astro`. Які поля форматовані, знає модель Storyblok
(`item: 'richtext'`, `level`), тож міграція контенту й проби тестів обходять записи за моделлю.

**Tech Stack:** Astro `^5.18`, zod 3 з `astro/zod`, **нова залежність `@storyblok/richtext@^5.5.2`** (лише головний
вхід `renderRichText`), `node:test`, `node-html-parser`, Playwright (вже є), Storyblok Management API (Задачі 11, 13).

**Spec:** [2026-09-28-04-richtext-buttons-design.md](../specs/2026-09-28-04-richtext-buttons-design.md) (переглянута
2026-11-16 — читати повністю, особливо «Що змінилося 2026-11-16»). Код, на який план спирається:
`src/lib/schema.mjs`, `src/lib/storyblok/{model,check,components,convert,entries}.mjs`, `src/lib/paths.mjs`,
`src/lib/seo.mjs`, `scripts/cms/{content,sync,assets,snapshot}.mjs`, `tests/helpers/{probes,content,build,links}.js`.

## Global Constraints

- **Єдина нова залежність** — `@storyblok/richtext@^5.5.2` у `dependencies` (рендер працює і в прев'ю-воркері).
  Підшляхи `@storyblok/richtext/html-parser` і `/markdown-parser` **не імпортувати** (tiptap і happy-dom у бандлі воркера).
- **Межа безпеки — схема.** Бібліотека пропускає `javascript:` у `href` і мовчки рендерить дітей невідомих вузлів.
  Усе, що дозволяє схема, мусить рендеритися безпечно; все інше — падати на збірці з повідомленням, яке називає поле.
- **Рівні** (спека, «Два рівні форматування» — тепер три):
  - `card` — абзаци, `hard_break`, `emoji`; марки `bold`, `italic`, `underline`, `strike`, `superscript`, `subscript`,
    `code`. Поля: `ministries.summary`, `churches.lead`, `projects.lead`, `leader-resources.description`.
  - `inline` — усе з `card` + марки `link`, `anchor`. Поля — таблиця `richInline` спеки.
  - `rich` — усе з `inline` + `heading` (рівні 2–6), `bullet_list`, `ordered_list`, `list_item`, `blockquote`,
    `horizontal_rule`, `code_block`, `table`/`tableRow`/`tableHeader`/`tableCell`, `image`. Поля: `ministries.body`,
    `churches.body`, `projects.body`, `pages.*.body`, `pastors.bio`, `testimonies.text`.
  - Ніде: `textStyle` (колір), `highlight`, `styled`, непорожній `textAlign`, `blok`.
- **`linkUrl`** — `https://…`, `http://…`, `mailto:…@…`, `tel:` (≥ 7 символів номера), `/…` (не `//…`), `uploads/…`,
  `#якір`. Той самий валідатор для кнопок, `projects.ctaUrl` і посилань у тексті.
- **Вкладка — за адресою:** `http(s)://` → `target="_blank" rel="noopener noreferrer"`, решта — без `target`.
- **Усі нові адреси кнопок — `linkUrl.nullable()`**; порожньо → фолбек (таблиця «Кнопки» спеки).
- **Посилання на історію** (`linktype: story`) розвʼязується за `uuid` у шлях сайту; невідомий `uuid` → марка
  посилання знімається, текст лишається, попередження. Деплой не блокується.
- **Картинка в тексті:** `alt` обовʼязковий і непорожній; `src` — `https://…` або `uploads/…`.
- **Контракт з адмінкою** (CLAUDE.md): тести виводять очікування з контенту, який читають, і не пришпилюють поточних
  значень. `src/content` тести не змінюють. Граничні випадки — пробні збірки (`withBuild`).
- **Вигляд не змінюється.** Мірило `diff-dirs` — еталонна збірка `dist-before/` (Задачі 1–3), з Задачі 4 —
  `dist-t4/`. Піксель у піксель — скріншоти проти збірки з `main` (Задача 12).
- **`npm test` не ходить у мережу.** Живий простір Storyblok — лише Задачі 11 і 13, і лише з окремого «так» користувача.
- Робота в гілці `richtext-buttons`. Коментарі й назви тестів **українською**, коментар пояснює *чому*. ESM `.mjs`,
  2 пробіли, одинарні лапки, крапка з комою. У `.astro` — без `<style>` (є тест). Кольори — лише наявні токени.
- Кожна задача закінчується `npm test` без жодного FAIL і окремим комітом з кінцівкою:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## Зафіксовані рішення цього плану

| # | Питання | Рішення | Підстава |
|---|---|---|---|
| 1 | Як схема перевіряє документ | Один обхід `richIssues(value, level)` у `superRefine` (`z.any()`), issue з точним шляхом і українським поясненням | Рекурсивний union zod дає «Invalid input» по кожній гілці — редактор не зрозуміє, що не так |
| 2 | Атрибути посилання | Після нормалізації — рівно `{ href, linktype }`, `linktype` ∈ `url`/`email`/`asset` | Вкладку вибирає рендер; `story` розвʼязується в `url` (рішення 14) |
| 3 | Файл медіатеки в посиланні | `linktype: 'asset'`, `linkUrl` приймає `uploads/…`, `linkHref` веде під `base` | `cms:pull` (`localizeAssets` → `mapStrings`) переписує **будь-який** рядок з адресою файлу Storyblok на `uploads/cms/…` |
| 4 | Апостроф | Рендер замінює `&#039;` на `&#39;` | `diff-dirs` порівнює байти: однаковий запис доводить, що міграція нічого не змінила |
| 5 | Обгортка блокових полів | Без обгортки, де стилі задані предком (`.info p` у church/project, `.pastor-body p`, `.elder-card p`, `.prose p`); `<div>` лише для `ministries.body` (`.desc`) і `testimonies.text` (`.tst-text`) | Один абзац дає той самий HTML, що й зараз |
| 6 | Стилі | Класи ставить рендер (`rt-*`), правила — один раз у `src/styles/base.css`; посилання `color:inherit` + підкреслення | Правила не залежать від сторінки |
| 7 | Зміни поведінки кнопок | «Дивитися» й «Прокласти маршрут» відкриваються в новій вкладці | Одне правило вкладки для всіх кнопок |
| 8 | Скрипт міграції | `scripts/migrate-richtext.mjs` живе з Задачі 5 до Задачі 12, ідемпотентний; обхід за моделлю — `src/lib/storyblok/walk.mjs` (лишається) | Поля переходять у кількох задачах |
| 9 | Кнопки панелі Storyblok | `TOOLBAR` у `model.mjs` (Задача 5); ключі звіряються з живою формою в Задачі 11 | Документація Storyblok не завжди збігається з формою |
| 10 | Вибір мови документа | `pickRich(pair, lang)` (документ) і `pickPlain(pair, lang)` (простий текст) у `src/lib/i18n.mjs` | `pick` вимагає рядок і правильно падає на документі |
| 11 | Еталон | `npx astro build --outDir dist-before` до Задачі 1, `dist-t4` після Задачі 4; обидві в `.gitignore` | CLAUDE.md: еталон будувати всередині проєкту |
| 12 | Рядок у полі richtext (історії до імпорту) | `fromStory` читає непорожній рядок через `docFromText`, порожній — «немає» | `cms:pull` працює до імпорту; імпорт без `--force` (дані збігаються з файлами) |
| 13 | Картинка в тексті при імпорті | `toStory` пропускає `src` з `uploads/…` через той самий `ctx.asset`, що й поля-картинки, і пише `{ id, src: filename, alt, title }`. Посилання (`href`) пишуться як є | `assetRefs` (`scripts/cms/content.mjs`) викликає `toStory` з `asset`-колбеком — картинки з тексту потраплять у завантаження без нового коду |
| 14 | Карта маршрутів історій | `storyRoutes(stories): Map<uuid, string \| null>` в `entries.mjs`; `storiesToEntries` і `scripts/cms/sync.mjs` (`makePlan`, `runVerify`) передають у `fromStory` `resolveStory(uuid)` | Усі три місця вже мають повний список історій |
| 15 | Порожні атрибути редактора | `normalizeDoc` відкидає атрибути зі значенням `null`/`''`/`{}`; марку `textStyle`, у якої всі атрибути порожні, — цілком. Непорожні заборонені значення лишаються для схеми | Вставка з Word приносить `textStyle` з `color: null`; колір по-справжньому має назвати схема |

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `src/lib/richtext.mjs` (новий) | Дані richtext без рендеру: `isDoc`, `docFromText`, `normalizeDoc`, `isEmptyDoc`, `richPlain`, `mapImages` |
| `src/lib/richtext-render.mjs` (новий) | `renderRich(doc, { base, lang, inline })` над `@storyblok/richtext` |
| `src/components/Rich.astro` (новий) | Єдине місце `set:html` для richtext |
| `src/lib/schema.mjs` | `linkUrl`, `richIssues`, `localizedRich`, `localizedRichInline`, `localizedRichCard`; поля колекцій |
| `src/lib/paths.mjs` | `linkHref` (увесь `linkUrl`), `linkAttrs` |
| `src/lib/i18n.mjs`, `src/i18n/index.ts` | `pickRich`, `pickPlain` |
| `src/lib/storyblok/model.mjs` | `rich`, `richInline`, `richCard`, `url`, `TOOLBAR`; поля |
| `src/lib/storyblok/check.mjs` | звірка форматованих пар і рівнів |
| `src/lib/storyblok/components.mjs` | JSON поля `richtext` з панеллю |
| `src/lib/storyblok/convert.mjs` | читання/запис `richtext`, картинки через `asset` |
| `src/lib/storyblok/entries.mjs` | `storyRoutes`, передача `resolveStory`/`warn` у `fromStory` |
| `src/lib/storyblok/walk.mjs` (новий) | `mapRichPairs(collection, data, fn)` |
| `scripts/cms/sync.mjs` | `resolveStory` у `makePlan` і `runVerify` |
| `scripts/migrate-richtext.mjs` (тимчасовий, Задачі 5–12) | міграція `src/content` |
| `scripts/cms/richtext-probe.mjs` (тимчасовий, Задача 11) | тимчасовий компонент і історія для пробного документа |
| `scripts/lib/compare-screens.mjs`, `scripts/lib/richtext-probe-build.mjs` (нові) | скріншоти двох збірок; збірка з повним форматуванням |
| `src/styles/base.css`, `src/styles/pages/{ministry,testimonies,pastors}.css` | стилі richtext і обгорток |
| шаблони `src/pages/[...lang]/**`, `SiteHeader.astro`, `SiteFooter.astro`, `Seo.astro` | `Rich`, `pickPlain`, `linkAttrs` |
| `tests/helpers/{content,probes,links}.js`, `tests/helpers/richtext-full.js` (новий) | `domText`, `textOf`, `rich()`, якорі й дублікати `id`, повні документи рівнів |
| `tests/richtext*.test.js`, `tests/buttons.test.js` (нові), `tests/fixtures/storyblok-richtext-probe.json` (Задача 11) | див. задачі |

## Review Focus

1. **Документ зі справжнього редактора** має атрибути й порожні значення, яких немає в allowlist (`textAlign: null`, у
   посиланні `uuid`/`target`/`custom`, у картинці `id`/`copyright`/`meta_data`, `textStyle` з `color: null` після
   вставки з Word). Очікування: `fromStory` їх прибирає, схема пропускає, рендер дає чистий HTML. Тест — Задача 2
   (ручний документ), Задача 11 (фікстура з живого редактора).
2. **Посилання на ще не опубліковану чи видалену історію.** Очікування: `cms:pull` записує файли (`exitCode: 0`), текст
   лишається без посилання, у журналі — `! … посилання «…» веде на історію, якої немає серед опублікованих`. Тест —
   Задача 6.
3. **Картинка в тексті без опису в медіатеці.** Очікування: `cms:pull` нічого не записує, повідомлення називає поле й
   підказує заповнити опис у медіатеці. Тест — Задача 6.
4. **Вставка з Word з кольором чи вирівнюванням по центру.** Очікування: схема називає поле й каже, що кольори /
   вирівнювання не підтримуються. Тест — Задача 3.
5. **Enter у кінці тексту / очищене поле.** Очікування: хвостовий порожній абзац зникає; очищене обовʼязкове поле
   валить збірку з назвою поля й мови; очищене nullable-поле стає `null`. Тести — Задачі 2 і 5.

---

### Task 1: формат адрес `linkUrl`, `linkHref`, `linkAttrs`

**Files:**
- Modify: `.gitignore`, `src/lib/schema.mjs` (після `phone`; `projects.ctaUrl`), `src/lib/paths.mjs` (`linkHref`),
  `src/pages/[...lang]/projects/[slug].astro` (кнопка CTA)
- Test: `tests/lib.test.js`, `tests/schema.test.js`

**Interfaces:**
- Produces: `export const LINK_URL: RegExp`, `export const linkUrl` (zod string) у `src/lib/schema.mjs`;
  `linkHref(base, lang, url): string` приймає увесь `linkUrl`; `linkAttrs(base, lang, url): { href, target?: '_blank',
  rel?: 'noopener noreferrer' }` у `src/lib/paths.mjs`.

- [ ] **Step 0: Еталонна збірка** — до будь-яких змін коду: додати в `.gitignore` рядок `dist-before/` (з коментарем
  «Еталонна збірка для diff-dirs (Спека 4)») і `npx astro build --outDir dist-before`. Expected: `dist-before/index.html`
  існує. Не перебудовувати до кінця плану.

- [ ] **Step 1: Падаючі тести.** `tests/lib.test.js` — замінити наявний тест `linkHref` на:

```js
test('linkHref: зовнішнє, пошта, телефон і якір — як є; сторінка — з локаллю; файл — під base; інше — помилка', () => {
  assert.equal(linkHref('/', 'uk', 'https://www.liqpay.ua/x'), 'https://www.liqpay.ua/x');
  assert.equal(linkHref('/', 'en', '/#contacts'), '/en/#contacts');
  assert.equal(linkHref('/sub/', 'en', '/ministries/'), '/sub/en/ministries/');
  assert.equal(linkHref('/', 'uk', 'mailto:leaders@example.test'), 'mailto:leaders@example.test');
  assert.equal(linkHref('/', 'en', 'tel:+380991112233'), 'tel:+380991112233');
  assert.equal(linkHref('/sub/', 'en', '#contacts'), '#contacts');
  assert.equal(linkHref('/sub/', 'en', 'uploads/cms/abc-file.pdf'), '/sub/uploads/cms/abc-file.pdf');
  assert.throws(() => linkHref('/', 'uk', 'index.html#contacts'), /index\.html#contacts/);
});

test('linkAttrs: чужий сайт — у новій вкладці, свій сайт, якір, пошта й телефон — у тій самій', () => {
  assert.deepEqual(linkAttrs('/', 'uk', 'https://m.me/x'), { href: 'https://m.me/x', target: '_blank', rel: 'noopener noreferrer' });
  assert.deepEqual(linkAttrs('/sub/', 'en', '/pastors/'), { href: '/sub/en/pastors/' });
  assert.deepEqual(linkAttrs('/', 'uk', '#contacts'), { href: '#contacts' });
  assert.deepEqual(linkAttrs('/', 'uk', 'mailto:a@b.test'), { href: 'mailto:a@b.test' });
});
```

`tests/schema.test.js`:

```js
test('linkUrl: адреси кнопок і посилань у тексті', () => {
  const ok = ['https://www.liqpay.ua/x', 'http://example.test', 'mailto:leaders@example.test', 'tel:+380 99 111-22-33',
    '/', '/ministries/youth/', '/#contacts', 'uploads/cms/abc-file.pdf', '#contacts'];
  const bad = ['', '#', 'javascript:alert(1)', '//evil.test/x', 'index.html#contacts', 'mailto:', 'tel:12', 'https://', 'ftp://x.test'];
  for (const url of ok) assert.equal(linkUrl.safeParse(url).success, true, `відкинуто «${url}»`);
  for (const url of bad) assert.equal(linkUrl.safeParse(url).success, false, `пропущено «${url}»`);
});
```

- [ ] **Step 2:** `node --test tests/lib.test.js tests/schema.test.js` — FAIL (`linkAttrs`, `linkUrl` не експортуються).

- [ ] **Step 3: Реалізація.**
  - `schema.mjs`, після `phone`: `LINK_URL = /^(?:https?:\/\/\S+|mailto:\S+@\S+|tel:\+?[\d\s()-]{7,}|\/(?!\/)\S*|uploads\/\S+|#[\w-]+)$/`,
    `linkUrl = z.string().regex(LINK_URL, 'посилання: https://…, mailto:…, tel:…, /сторінка/, uploads/файл або #якір')`.
    Коментар — чому `uploads/…` (рішення 3) і чому відкинуто `//…` та голий `#`.
  - `projects.ctaUrl: linkUrl.nullable()`.
  - `paths.mjs`: `linkHref` — зовнішнє / `mailto:` / `tel:` / `#` як є, `/…` → `localePath`, `uploads/…` → `assetUrl`,
    інакше `throw` з адресою в повідомленні. `linkAttrs` — `{ href: linkHref(…), ...(isExternal(url) && { target, rel }) }`.
  - `projects/[slug].astro`: кнопка → `<a class="btn" {...linkAttrs(base, lang, p.ctaUrl)}>`; прибрати `const external`
    і невживані імпорти.

- [ ] **Step 4:** `npm test` — PASS; `node scripts/lib/diff-dirs.mjs dist-before dist` — `Збірки однакові.`

- [ ] **Step 5: Commit** — `feat: linkUrl — один формат адрес для кнопок і посилань у тексті`.

---

### Task 2: дані richtext — `src/lib/richtext.mjs`

**Files:**
- Create: `src/lib/richtext.mjs`
- Test: `tests/richtext.test.js`

**Interfaces:**
- Produces (іменовані експорти `src/lib/richtext.mjs`):
  - `isDoc(value): boolean` — обʼєкт з `type === 'doc'`;
  - `docFromText(text: string): Doc` — абзаци через порожній рядок, одиночний `\n` → `hard_break`, рядки обрізані;
  - `normalizeDoc(value, { resolveStory?: (uuid: string) => string | null, warn?: (message: string) => void } = {}): Doc | unknown`
    — для не-документа повертає вхід як є;
  - `isEmptyDoc(value): boolean` — документ без жодного блоку;
  - `richPlain(doc): string` — текстові блоки (абзаци, заголовки, пункти, клітинки, цитати) через `\n\n`, пробіли згорнуті;
    картинки, лінії й блоки коду пропускаються;
  - `mapImages(doc, fn: (attrs) => attrs): Doc` — нова копія, `fn` для `attrs` кожного вузла `image` на будь-якій глибині.

**Правила `normalizeDoc`** (саме їх перевіряють тести; все не перелічене лишається як є, щоб схема назвала):

| Що | Як |
|---|---|
| атрибути вузлів | лишаються лише відомі: `heading.level`, `heading.textAlign`*, `paragraph.textAlign`*, `ordered_list.order` (крім `1`), `code_block.class`, `tableCell`/`tableHeader`: `colspan`, `rowspan` (крім `1`), `backgroundColor`*; `image`: `src`, `alt`, `title`; `emoji`: `emoji` |
| * | лишається лише непорожнім — тоді схема його відкине з поясненням; `null`/`''` зникає (рішення 15). `colwidth` зникає завжди |
| `attrs`, що стали порожніми | ключ `attrs` прибирається |
| марки без атрибутів (`bold`, `italic`, `underline`, `strike`, `superscript`, `subscript`, `code`) | `{ type }` |
| `anchor` | `{ type, attrs: { id } }` |
| `textStyle`, `highlight`, `styled` | усі атрибути порожні → марка зникає; інакше лишається з непорожніми атрибутами (схема відкине) |
| `link`, `linktype: 'email'` | `{ href: 'mailto:' + адреса (якщо ще немає), linktype: 'email' }` |
| `link`, `linktype: 'url'` / `'asset'` | `{ href, linktype }` |
| `link`, `linktype: 'story'` | `path = resolveStory?.(uuid)`; є → `{ href: path + (anchor ? '#' + anchor : ''), linktype: 'url' }`; немає → марка зникає, `warn?.('посилання «<текст вузла>» веде на історію, якої немає серед опублікованих (uuid …)')` |
| `image` без `alt` | `alt` не додається — схема назве |
| порожні абзаци (без `text`, `emoji` і `image`) на початку й у кінці документа | прибираються; посередині лишаються |
| ідемпотентність | `normalizeDoc(normalizeDoc(x)) ≍ normalizeDoc(x)` |

- [ ] **Step 1: Падаючі тести** `tests/richtext.test.js` (хелпери `text(t, marks)`, `para(...content)`, `doc(...content)`):
  - `docFromText: абзаци — через порожній рядок, перенос — hard_break` — `'Перший.\n\nДругий\nрядок.'` → два абзаци,
    у другому `text, hard_break, text`; `'  \n\n '` → `{ type: 'doc', content: [] }`.
  - `isDoc розрізняє документ і все інше` — `''`, `'doc'`, `null`, `undefined`, `[]`, `{ type: 'paragraph' }` → `false`.
  - `normalizeDoc прибирає атрибути редактора Storyblok` — вхід: `heading {level:3, textAlign:null}`;
    `paragraph {textAlign:null}` з посиланням `{href:'https://example.test', uuid:null, anchor:null, target:'_blank',
    linktype:'url', custom:{}}` і email-посиланням `{href:'a@b.test', linktype:'email', target:'_self'}` + `bold {attrs:{}}`;
    `ordered_list {order:1}`; `image {id: 5, src:'https://a.storyblok.com/f/1/x.jpg', alt:'Опис', title:'', copyright:'',
    source:'', meta_data:{}}`; `tableCell {colspan:1, rowspan:1, colwidth:null, backgroundColor:null}`. Очікування — рівно
    за таблицею правил (`image.attrs` → `{ src, alt }`, клітинка без `attrs`, email → `mailto:a@b.test`).
  - `normalizeDoc: вставка з Word — порожній textStyle зникає, колір і центр лишаються для схеми` —
    `textStyle {color:null}` зникає; `textStyle {color:'#ff0000'}` → `{ type:'textStyle', attrs:{ color:'#ff0000' } }`;
    `paragraph {textAlign:'center'}` лишається з `attrs.textAlign`.
  - `normalizeDoc: посилання на історію — шлях за uuid, з якорем` — `resolveStory = (u) => ({ a1: '/ministries/youth/' })[u] ?? null`;
    `{linktype:'story', uuid:'a1', anchor:'team', href:'ministries/old-slug'}` →
    `{ href: '/ministries/youth/#team', linktype: 'url' }`.
  - `normalizeDoc: невідома історія — текст без посилання й попередження` — `uuid:'zz'`: у вузла немає марки `link`,
    інші марки лишаються, `warn` викликано один раз, повідомлення містить текст вузла й `zz`.
  - `normalizeDoc: порожні абзаци на краях зникають, посередині лишаються` — і `isEmptyDoc` для документа з самих
    порожніх абзаців — `true`; абзац лише з картинкою — не порожній.
  - `normalizeDoc не викидає невідоме` — `blok` і марка `highlight {color:'#ff0'}` лишаються.
  - `normalizeDoc ідемпотентна, не-документ повертає як є` — `''`, `null`.
  - `richPlain: блоки через порожній рядок, картинки й код пропускаються` — heading + абзац з `hard_break` + список +
    таблиця з однією клітинкою + `code_block` + `image` → `'Заголовок\n\nЖирний і далі\n\nпункт\n\nклітинка'`.
  - `mapImages змінює attrs картинок на будь-якій глибині` — картинка в абзаці всередині `list_item` отримує `src` з `fn`.

- [ ] **Step 2:** `node --test tests/richtext.test.js` — FAIL (`Cannot find module`).

- [ ] **Step 3: Реалізація** `src/lib/richtext.mjs` за таблицею правил. Модуль без імпортів Astro й Node (його читає
  прев'ю-воркер). Коментарі — чому кожен атрибут відкидається (редактор дописує сам; без нормалізації `cms:verify` бачив
  би «зміну» після кожного збереження).

- [ ] **Step 4:** `node --test tests/richtext.test.js` — PASS.

- [ ] **Step 5: Commit** — `feat: дані richtext — нормалізація документа Storyblok, посилання на історії, простий текст`.

---

### Task 3: схема форматованого тексту й вибір мови

**Files:**
- Modify: `src/lib/schema.mjs` (імпорт `./richtext.mjs`; блок після `localizedHtml`), `src/lib/i18n.mjs`, `src/i18n/index.ts`
- Create: `tests/helpers/richtext-full.js` (`FULL_DOC`)
- Test: `tests/richtext-schema.test.js` (новий), `tests/lib.test.js`

**Interfaces:**
- Consumes: `isDoc`, `richPlain` (Задача 2), `linkUrl` (Задача 1).
- Produces: `export const localizedRich`, `localizedRichInline`, `localizedRichCard` (`z.object({ uk, en }).strict()`,
  модель і `checkModel` упізнають їх **за тотожністю**); `pickRich(pair, lang): Doc`, `pickPlain(pair, lang): string` з
  `src/lib/i18n.mjs`, реекспорт з `src/i18n/index.ts`.

`richIssues(value, level)` — один обхід (рішення 1). Повідомлення (тести перевіряють регулярками в дужках):

| Порушення | Повідомлення |
|---|---|
| `textStyle` / `highlight` / `styled` | «колір і виділення кольором не підтримуються: дизайн використовує лише свої кольори» (`/колір/`) |
| непорожній `textAlign` | «вирівнювання не підтримується: текст вирівнює дизайн сторінки» (`/вирівнювання/`) |
| `blok` | «вставні блоки в тексті не підтримуються» (`/вставні блоки/`) |
| блоковий вузол у `inline`/`card` | «списки, заголовки, цитати, таблиці, картинки й код дозволені лише в основному тексті» (`/лише в основному тексті/`) |
| `link`/`anchor` у `card` | «посилання в цьому полі неможливі: на сайті воно стоїть усередині картки-посилання» (`/картки-посилання/`) |
| `heading.level` не 2…6 | «заголовок: рівні 2–6 (рівень 1 — заголовок сторінки)» (`/рівні 2–6/`) |
| `href` поза `linkUrl` | `${LINK_MESSAGE} (зараз «…»)` (`/посилання/`), шлях `…marks.N.attrs.href` |
| `linktype` поза `url`/`email`/`asset` | «невідомий тип посилання «…»» |
| `anchor.attrs.id` не `^[a-z0-9-]+$` | «якір: лише малі латинські літери, цифри й дефіси» (`/якір/`) |
| `image.alt` порожній | «картинка без опису (alt): заповніть опис картинки в медіатеці Storyblok» (`/опису/`) |
| `image.src` не `https://…` і не `uploads/…` | «картинка: адреса https://… або файл медіатеки» |
| `code_block` з чимось, крім `text` без марок | «блок коду: лише простий текст» |
| `table` не з `tableRow` → `tableHeader`/`tableCell` → абзаци | «таблиця: рядки → клітинки → абзаци» |
| зайве поле вузла чи марки | «зайве поле «…»», шлях — до цього поля |
| невідомий вузол чи марка | «елемент «…» тут не підтримується» |
| порожній документ / пробіли / `''` | «текст не може бути порожнім або з самих пробілів» (той самий текст, що й `text` у схемі) |
| `undefined` | «поле обовʼязкове» |
| рядок (стара модель) | «очікується форматований текст (документ редактора Storyblok)» (`/форматований текст/`) |

Дозволена структура: `doc` → блоки рівня; `list_item` → блоки рівня `rich`, крім `heading`; `blockquote` → абзаци й
списки; `tableHeader`/`tableCell` → абзаци; `image` — і блоком, і всередині абзацу (у якому місці його кладе редактор
Storyblok, покаже Задача 11 — схема приймає обидва); `text.text` — непорожній рядок. Непорожність документа:
`richPlain(value).trim() !== ''` **або** в ньому є `image`.

- [ ] **Step 1: Падаючі тести** `tests/richtext-schema.test.js`. Хелпер `issue(schema, value)` → `{ message, path }`
  першої помилки для `uk` (як у старому плані). Тести:
  - `основний текст приймає все дозволене` — `FULL_DOC.rich('uk')` з `tests/helpers/richtext-full.js` (створити тут же:
    модуль експортує `FULL_DOC = { rich, inline, card }` — функції `(lang) => Doc`, кожна з **усіма** вузлами й марками
    свого рівня, включно з посиланнями `/ministries/`, `https://example.test/`, `mailto:probe@example.test`,
    `uploads/cms/probe.pdf` (`asset`), `#probe-anchor`, якорем `probe-anchor-<lang>`, картинкою
    `{ src: 'https://example.test/probe.jpg', alt: 'Проба' }`, апострофом). `success === true` для всіх трьох рівнів
    своєю схемою.
  - `inline відкидає блоки, card — ще й посилання та якорі` — `FULL_DOC.rich` у `localizedRichInline` → `/лише в основному тексті/`;
    `FULL_DOC.inline` у `localizedRichCard` → `/картки-посилання/`.
  - `вставка з Word: колір, виділення, вирівнювання названо` — по одному повідомленню з таблиці.
  - `заголовок рівня 1, вставний блок, невідомий вузол — названо`.
  - `посилання: лише linkUrl, шлях до href` — `javascript:alert(1)`, `#`, `//evil.test`, `index.html` → `/посилання/`,
    `path === 'uk.content.0.content.0.marks.0.attrs.href'`.
  - `картинка: без alt і з чужою схемою адреси — помилка` — `alt: ''` → `/опису/`; `src: 'ftp://x'` → `/картинка/`.
  - `зайве поле — помилка з назвою поля` — `paragraph { attrs: { textAlign: null } }` (ненормалізований) →
    `/зайве поле «textAlign»|зайве поле «attrs»/`.
  - `порожньо — як для простого тексту` — `doc()`, `doc(para(text('   ')))`, `''`, `undefined`; відсутній `en` → issue з
    шляхом `en`; документ лише з картинкою — `success`.
  - `рядок старої моделі — не документ`.
  - У `tests/lib.test.js`: `pickRich / pickPlain: документ мови, без фолбеку на іншу` — `pickRich(pair,'en')` → `pair.en`;
    `pickPlain` → `richPlain`; `en: ''` і рядки → `throws /немає перекладу «en»/`.

- [ ] **Step 2:** `node --test tests/richtext-schema.test.js tests/lib.test.js` — FAIL.

- [ ] **Step 3: Реалізація.** `richDoc(level) = z.any().superRefine(…)`; три пари `z.object({ uk: richDoc(l), en: richDoc(l) }).strict()`.
  Над блоком — коментар: межа безпеки тут (бібліотека пропускає `javascript:` і невідомі вузли), чому один обхід
  (рішення 1), що означає кожен рівень. `pickRich` — той самий принцип, що `pick`: не документ → `throw`. `pickPlain = richPlain(pickRich(…))`.

- [ ] **Step 4:** ті самі тести PASS; `npm test` PASS (нові пари ще ніде не використані).

- [ ] **Step 5: Commit** — `feat: схема форматованого тексту — три рівні, allowlist вузлів, марок і адрес`.

---

### Task 4: рендер і `Rich.astro`

**Files:**
- Modify: `package.json`, `package-lock.json`, `.gitignore` (`dist-t4/`)
- Create: `src/lib/richtext-render.mjs`, `src/components/Rich.astro`
- Modify: `src/styles/base.css` (у кінець)
- Test: `tests/richtext-render.test.js`

**Interfaces:**
- Consumes: `linkHref`, `isExternal`, `assetUrl` (`src/lib/paths.mjs`), `pickRich` (Задача 3), `docFromText`, `FULL_DOC`.
- Produces: `renderRich(doc, { base: string, lang: 'uk'|'en', inline?: boolean }): string`;
  `<Rich value={pair} lang={lang} inline? />`. Класи в HTML: `rt-link`, `rt-list`, `rt-h`, `rt-quote`, `rt-code`,
  `rt-table` (обгортка `<div class="rt-table">` навколо `<table>`), `rt-img`, `rt-hr`.

- [ ] **Step 1:** `npm install @storyblok/richtext@^5.5.2`. Падаючі тести `tests/richtext-render.test.js`
  (`uk = { base: '/', lang: 'uk' }`):
  - `бібліотека 5.5.2: текст екранується, javascript: і невідомий вузол проходять — межа безпеки в схемі` — пряме
    `renderRichText` з пакета: `<script>` → `&lt;script&gt;`; посилання `javascript:alert(1)` присутнє у виході;
    невідомий вузол рендерить дітей. (Фіксує висновки спайку на поточній версії; якщо поведінка змінилась — тест
    оновлюється разом з коментарем у спеці.)
  - `текст екранується так само, як в Astro` — `docFromText(`<script>x</script> & "q" it's`)` →
    `'<p>&lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot; it&#39;s</p>'`.
  - `абзаци й марки; порожні абзаци не рендеряться` — bold, italic, underline, strike, sup, sub, code → `<strong>`, `<em>`,
    `<u>`, `<s>`, `<sup>`, `<sub>`, `<code>`; `para()` → нічого.
  - `посилання: сторінка — з мовою й base, чужий сайт — у новій вкладці, адреса екранується` — ті самі чотири випадки, що
    в `linkHref`, з `class="rt-link"`; `https://example.test/?a="b"&c` → `href="https://example.test/?a=&quot;b&quot;&amp;c" target="_blank" rel="noopener noreferrer"`.
  - `заголовки 2–6, списки з order, цитата, лінія, код` — `<h2 class="rt-h">`, `<ol class="rt-list" start="3">`,
    `<blockquote class="rt-quote">`, `<hr class="rt-hr">`, `<pre class="rt-code"><code class="language-js">`.
  - `таблиця — в обгортці з прокруткою, colspan переноситься` — `<div class="rt-table"><table>…<th>…<td colspan="2">`.
  - `картинка — під base, lazy, alt і title екрановані` — `uploads/cms/x.jpg` з `base '/sub/'` →
    `<img class="rt-img" src="/sub/uploads/cms/x.jpg" alt="…" loading="lazy" decoding="async">`.
  - `якір — span з id; емодзі — сам символ`.
  - `inline: абзаци через <br>, без <p>` — `docFromText('Перший\n\nДругий')` → `'Перший<br>Другий'`.
  - `renderRich і pickRich — лише в Rich.astro` — обхід `src/**/*.astro`, жоден інший файл не містить
    `richtext-render|pickRich`.

- [ ] **Step 2:** `node --test tests/richtext-render.test.js` — FAIL.

- [ ] **Step 3: Реалізація.** `renderRich` — `renderRichText(doc, { renderers })` з перевизначеними `link`, `paragraph`,
  `heading`, `bullet_list`, `ordered_list`, `blockquote`, `horizontal_rule`, `code_block`, `table`, `image`, `anchor`,
  `emoji`. Атрибути екрануються власною `attr()` (`&`, `"`, `<`) — бібліотека передає їх у рендерери сирими. Апостроф
  `&#039;` → `&#39;` (рішення 4). `inline` — кожен абзац рендериться окремо, непорожні склеюються `<br>`.
  `Rich.astro` — `pickRich` → `renderRich(…, { base: import.meta.env.BASE_URL, lang, inline })` → `<Fragment set:html>`.
  `base.css` — правила `rt-*` на наявних токенах: посилання `color:inherit` + підкреслення; списки з відступом;
  `.rt-h` — `var(--font-display)`, `font-weight:700` (не 600 — Nyght Serif має лише Regular/Bold), розміри за рівнем;
  `.rt-quote` — ліва лінія `var(--accent)`; `.rt-table{overflow-x:auto;max-width:100%}`; `.rt-img{max-width:100%;height:auto}`.

- [ ] **Step 4:** тести PASS; `npm test` PASS; `diff-dirs dist-before dist` — відрізняється лише CSS-файл з `base.css`
  (і посилання на новий хеш у HTML, якщо змінився). Потім `npx astro build --outDir dist-t4` (еталон з цієї задачі).

- [ ] **Step 5: Commit** — `feat: рендер форматованого тексту — @storyblok/richtext і Rich.astro`.

---

### Task 5: наскрізно одне поле — `ministries.summary` (`card`)

Проводить одне поле через увесь ланцюжок: модель, звірку, компоненти, конвертацію, міграцію, шаблони, SEO й тести.
Задачі 7–8 лише розширюють список полів.

**Files:**
- Modify: `src/lib/storyblok/{model,check,components,convert}.mjs`, `src/lib/schema.mjs` (`ministries.summary`)
- Create: `src/lib/storyblok/walk.mjs`, `scripts/migrate-richtext.mjs`
- Modify: `src/content/ministries/*.json` (скриптом)
- Modify: `src/pages/[...lang]/ministries/index.astro`, `ministries/[slug].astro`, `src/pages/[...lang]/index.astro` (картка служіння)
- Modify: `tests/helpers/content.js`, `tests/helpers/probes.js`
- Test: `tests/cms-model.test.js`, `tests/cms-components.test.js`, `tests/cms-convert.test.js`, `tests/cms-import.test.js`,
  `tests/cms-verify.test.js`, `tests/content-schema.test.js`, `tests/page-ministries.test.js`, `tests/seo.test.js`

**Interfaces:**
- Consumes: Задачі 2–4.
- Produces:
  - `model.mjs`: `export const TOOLBAR = { rich: [...], inline: [...], card: [...] }`; будівники (не експортуються)
    `rich(label, opts)`, `richInline(label, opts)`, `richCard(label, opts)` → `{ kind: 'pair', item: 'richtext', level, label, ...opts }`.
    Початкові значення `TOOLBAR` (рішення 9):
    `card: ['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', 'inlinecode', 'emoji']`,
    `inline: [...card, 'link', 'anchor']`,
    `rich: [...inline, 'paragraph', 'h2', 'h3', 'h4', 'h5', 'h6', 'list', 'olist', 'quote', 'hrule', 'code', 'table', 'image']`.
  - `walk.mjs`: `mapRichPairs(collection, data, fn: (pair, field) => pair): object` — нова копія, `fn` для кожної
    непорожньої пари з `field.item === 'richtext'` (групи, списки, `unwrap`, варіанти за `fixed`).
  - `convert.mjs`: `fromStory(collection, story, { assetPath, onBlok, resolveStory, warn })` — нові опції проходять у
    `normalizeDoc`; `readScalar('richtext')` — `null` → `''`; рядок → `docFromText` або `''` (рішення 12); документ →
    `normalizeDoc`, порожній → `''`. `writeScalar('richtext')` — документ з картинками через `mapImages` +
    `assetValue(src, ctx.asset)` → `{ id, src: filename, alt, title? }` (рішення 13); не документ → `''`.
  - `components.mjs`: `case 'richtext'` → `{ type: 'richtext', ...base, customize_toolbar: true, toolbar: TOOLBAR[field.level] }`.
  - `check.mjs`: `RICH_LEVEL = new Map([[localizedRich, 'rich'], [localizedRichInline, 'inline'], [localizedRichCard, 'card']])`;
    `unwrap` зупиняється на них; пара з `item: 'richtext'` мусить мати той самий `level`, інакше помилка
    `«у схемі форматований текст (<рівень>), у моделі <item> (<level>)»`.
  - `tests/helpers/content.js`: `domText(value)` (усі `text` документа підряд — як `node-html-parser .text`; рядок як є),
    `textOf(value)` (`richPlain` для документа); `localizedPairs` бачить і документи.
  - `tests/helpers/probes.js`: `rich(uk, en = uk) => ({ uk: docFromText(uk), en: docFromText(en) })`.

- [ ] **Step 1: Падаючі тести.**
  - `cms-model.test.js`: `форматований текст: пара richtext того самого рівня, інакше — помилка` —
    `summary: localized`, `summary: localizedRich`, `name: localizedRichCard` → помилка з `.summary` / `.name`.
  - `cms-components.test.js`: `форматоване поле — richtext з панеллю свого рівня` —
    `ministry.summary_uk` → `{ type: 'richtext', customize_toolbar: true, toolbar: TOOLBAR.card }`; наявну перевірку
    `textarea` перенести на `seo.metaDescription_uk`.
  - `cms-convert.test.js`:
    - `richtext: документ з редактора нормалізується, туди-й-назад — без змін` (Review Focus 1) — як у Задачі 2, через
      `toStory`/`fromStory`/`roundTrip`; `schemas.ministries.safeParse(data).success`.
    - `richtext: очищене поле — «немає», обовʼязкове валить схему з назвою мови` (Review Focus 5) — `''` і документ із
      самих порожніх абзаців у `summary_en` → `data.summary.en === ''`, issue з шляхом `summary.en`.
    - `richtext: рядок старої моделі читається як документ` — `'Перший.\n\nДругий.'` → `docFromText(…)`; `'   '` → `''`.
    - `richtext: історія зі старими рядками після міграції файлів — «оновити», а не конфлікт` — дані історії з рядками =
      дані файлу з документами (`fingerprint(fromStory(…)) === toStory(…).content[FINGERPRINT_FIELD]`).
  - `content-schema.test.js`: тест «розмітка в текстовому полі» перевести на `name` (`summary` більше не простий текст).

- [ ] **Step 2:** `node --test tests/cms-model.test.js tests/cms-components.test.js tests/cms-convert.test.js` — FAIL.

- [ ] **Step 3: Модель, звірка, компоненти, конвертація** — за Interfaces. `ministry.summary: richCard('Коротко')`.

- [ ] **Step 4: Схема, обхід, міграція.** `ministries.summary: localizedRichCard`. `walk.mjs` і `scripts/migrate-richtext.mjs`
  (`node scripts/migrate-richtext.mjs [тека, типово src/content]`: `readContent` → `mapRichPairs(… рядок → docFromText)` →
  `writeContent`, друкує `Записів: N.`; коментар — тимчасовий, видаляється в Задачі 12).
  Перед міграцією: `npm run cms:pull` **лише якщо** в `.env` є `STORYBLOK_PUBLIC_TOKEN` і користувач погодив; зміни —
  окремим комітом `content: знімок Storyblok перед міграцією richtext`. Run: `node scripts/migrate-richtext.mjs` —
  змінені лише `src/content/ministries/*.json`, у кожному лише `summary`.

- [ ] **Step 5: Шаблони.** `<p>{pick(m.summary, lang)}</p>` → `<p><Rich value={m.summary} lang={lang} inline /></p>` у
  `ministries/index.astro` і картці служіння в `index.astro`; `<h2>…</h2>` у `ministries/[slug].astro` — так само;
  `description={pickPlain(m.summary, lang)}`. `grep -rn "summary" src --include=*.astro` — лише `Rich` / `pickPlain`.

- [ ] **Step 6: Хелпери й тести, що читають поле як рядок.** `domText`/`textOf`/`rich` за Interfaces; `ministry()` у
  probes — `summary: rich('Коротко')`. Оновити: `page-ministries.test.js` (`domText`), `seo.test.js` (`textOf`),
  `cms-import.test.js` і `cms-verify.test.js` (правка — у простому полі `name`, а не `summary`). Решта:
  `grep -rnE "summary(\?)?(\.|\[)(uk|en|lang)" tests` — DOM → `domText(…)`, мета-опис → `textOf(…)`.

- [ ] **Step 7:** `npm test` PASS; `diff-dirs dist-t4 dist` — `Збірки однакові.` Будь-яка відмінність — дефект
  (екранування, пробіл навколо `<Rich>`), а не привід оновити еталон.

- [ ] **Step 8: Commit** — `feat: ministries.summary — форматований текст у Storyblok і на сайті`.

---

### Task 6: посилання на історії й картинки через Storyblok

**Files:**
- Modify: `src/lib/storyblok/entries.mjs`, `scripts/cms/sync.mjs` (`makePlan`, `runVerify`)
- Test: `tests/cms-entries.test.js`, `tests/cms-pull.test.js`, `tests/cms-import.test.js`, `tests/cms-verify.test.js`

**Interfaces:**
- Consumes: `fromStory(…, { resolveStory, warn })`, `writeScalar('richtext')` (Задача 5).
- Produces: `export function storyRoutes(stories): Map<string, string | null>` у `entries.mjs` — ключ `story.uuid`,
  значення — шлях сайту без мови й base: `ministries|churches|projects/<slug>` → `/<колекція>/<slug>/`;
  `pages/<id>` → `/<id>/`; `settings/homepage` → `/`; `testimonies/*` → `/testimonies/`; `pastors/*` → `/pastors/`;
  `leader-resources/*` → `/leaders/`; решта одиночок → `null`. `storiesToEntries` будує карту з усіх своїх історій і
  передає `resolveStory = (uuid) => routes.get(uuid) ?? null`, `warn = (m) => warnings.push(`${story.full_slug}: ${m}`)`.
  Для історії-одиночки без сторінки попередження: «посилання «…» веде на «…», яка не має сторінки на сайті».

- [ ] **Step 1: Падаючі тести.**
  - `cms-entries.test.js`: `посилання на історію — поточний шлях сторінки за uuid` — дві історії (служіння `youth` з
    `uuid 'u-youth'` і служіння `a`, у `body_uk` якого посилання `{ linktype:'story', uuid:'u-youth', href:'ministries/old' }`)
    → у даних `a` `href === '/ministries/youth/'`; перейменування slug `youth` → `young` у вхідних історіях дає `/ministries/young/`.
  - `cms-entries.test.js`: `посилання на неопубліковану історію — текст без посилання й попередження` (Review Focus 2) —
    `uuid` поза списком → без марки `link`, `warnings` містить `full_slug` і текст посилання, `errors` порожній.
  - `cms-pull.test.js`: `cms:pull з посиланням на неопубліковану історію записує файли` — `exitCode: 0`, журнал має `! `.
  - `cms-pull.test.js`: `картинка й файл медіатеки в тексті локалізуються` — `body_uk` з `image { src: 'https://a.storyblok.com/f/1/x/pic.jpg', alt: 'Опис' }`
    і посиланням `asset` на `…/doc.pdf` → у записаному JSON `src` і `href` починаються з `uploads/cms/`, файли є в
    `public` проби, `schemas.ministries.safeParse(…)` успішний.
  - `cms-pull.test.js`: `картинка в тексті без alt — нічого не записано, поле названо` (Review Focus 3) — `exitCode: 1`,
    повідомлення `/опису/` і `body.uk`.
  - `cms-import.test.js`: `картинка з uploads/ у тексті завантажується в медіатеку й пишеться як asset` — фейк отримує
    завантаження, у `body_uk` історії `image.attrs.src` — адреса фейку, `id` — id asset.
  - `cms-verify.test.js`: `історія з посиланням на історію збігається з файлами` — у файлі `/ministries/youth/` (`url`),
    у фейку `story`-посилання з `uuid` — `cms:verify` без розбіжностей.

- [ ] **Step 2:** `node --test tests/cms-entries.test.js tests/cms-pull.test.js tests/cms-import.test.js tests/cms-verify.test.js` — FAIL.

- [ ] **Step 3: Реалізація** — `storyRoutes` і передача опцій у `storiesToEntries`; у `makePlan` і `runVerify` — одна
  `storyRoutes(space.stories)` на прогін і `resolveStory` у кожен `fromStory`. Перевірити, що `assetRefs` збирає картинки
  з тексту без змін (`toStory` з `asset`-колбеком — рішення 13); якщо ні — виправити `writeScalar`, не `assetRefs`.

- [ ] **Step 4:** `npm test` PASS.

- [ ] **Step 5: Commit** — `feat: посилання на історії за uuid і картинки в тексті — через Storyblok туди й назад`.

---

### Task 7: решта коротких полів — `card` і `inline`

**Files:**
- Modify: `src/lib/schema.mjs`, `src/lib/storyblok/model.mjs`, `src/content/**` (скриптом)
- Modify: `src/lib/seo.mjs` (`pageDescription`), `src/components/Seo.astro` (`defaultDescription`), `src/components/SiteFooter.astro`
- Modify: `src/pages/[...lang]/{index,leaders,pastors,testimonies}.astro`, `{churches,projects,ministries}/index.astro`, `{churches,projects}/[slug].astro`
- Modify: `tests/helpers/probes.js` і тести за grep (крок 4)

**Interfaces:**
- Consumes: усе з Задач 5–6.
- Produces — поля:

| Рівень | Схема | Модель | Де в шаблоні |
|---|---|---|---|
| `card` | `churches.lead`, `projects.lead`, `leader-resources.description` | `church.lead`, `project.lead`, `resource_document.description`, `resource_link.description` | `<p>` у картках `churches/index`, `projects/index`, `leaders` (doc-card, res-card); `description=` деталок → `pickPlain` |
| `inline` | `pages.lead`, `pages.sections.past_lead`/`elders_lead`, `pages.help.desc` | `site_page.lead`, `page_sections.*_lead`, `page_help.desc` | `{page.lead && <p>…</p>}` у шести списках; `pastors.astro` секції й help; `leaders.astro` help; `pageDescription` → `pickPlain` |
| `inline` | `homepage.hero.vision`, `about.lead`, `beliefs[]`, `news.lead`, `news.items[].text`, `wwb.items[].text`, `testimonies.items[].text`, `ministries.lead`, `pastors.lead`, `donate.quote`, `donate.thanks`, `footer.about` | `home_hero.vision`, `home_about.lead`, `home_belief.text`, `home_news.lead`, `home_news_item.text`, `home_wwb_item.text`, `home_testimony.text`, `home_ministries.lead`, `home_pastors.lead`, `home_donate.quote`/`thanks`, `home_footer.about` | `index.astro` (`<span>`, `<p class="lead">`, `<p>`, текст перед `<cite>` у `<blockquote>`), `SiteFooter.astro`; `description={pickPlain(h.about.lead, lang)}`, `Seo.astro` → `pickPlain(home.about.lead, lang)` |

- [ ] **Step 1: Падаючий тест** `cms-components.test.js`: `кожне форматоване поле — richtext зі своєю панеллю; textarea — лише мета-опис`
  (обхід усіх `COMPONENTS`, `field.item === 'richtext'` → `[type, toolbar] === ['richtext', TOOLBAR[field.level]]`;
  `textarea` поза цим — лише `seo.metaDescription`). FAIL — `church.lead_uk: textarea`.

- [ ] **Step 2: Схема й модель** за таблицею; підписи й опції (`optional`) — ті самі. `long` лишається лише в
  `seo.metaDescription`. У `homepage` — `labels([...]).extend({ поле: localizedRichInline })`; `sections` — явні ключі,
  `past_lead`/`elders_lead` — `localizedRichInline.optional()`. Оновити коментар над `homepage` («hero.title — єдине поле з
  HTML; тексти з описом — форматовані, Спека 4»). `cms-model.test.js` — PASS (`checkModel()` → `[]`).

- [ ] **Step 3:** `node scripts/migrate-richtext.mjs` — у `git diff` лише поля з таблиці, рядок → документ.

- [ ] **Step 4: Шаблони, SEO, фікстури.** Кожне поле: `{pick(x, lang)}` / `{p(x)}` → `<Rich value={x} lang={lang} inline />`
  всередині того самого тегу. Простий текст: `pickPlain` у місцях з таблиці. Фікстури: `church`/`project` — `lead: rich('Лід')`,
  ресурси — `description: rich('Опис')`, `pages/full` у `cms-convert.test.js` — `rich(…)` для `lead`, `*_lead`, `help.desc`.
  Решта: `grep -rnE "\.(lead|description|desc|vision|quote|thanks|past_lead|elders_lead|about|text)(\?)?(\.|\[)(uk|en|lang)\b" tests`
  — DOM → `domText`, мета-опис → `textOf`, запис рядка у форматоване поле → `rich`.

- [ ] **Step 5:** `npm test` PASS; `diff-dirs dist-t4 dist` — `Збірки однакові.`

- [ ] **Step 6: Commit** — `feat: форматування в коротких текстах — картки без посилань, решта з посиланнями`.

---

### Task 8: основні тексти — `rich`

**Files:**
- Modify: `src/lib/schema.mjs`, `src/lib/storyblok/model.mjs`, `src/content/**` (скриптом)
- Modify: `ministries/[slug].astro`, `churches/[slug].astro`, `projects/[slug].astro`, `pastors.astro` (дві картки),
  `testimonies.astro`, `about.astro`, `contacts.astro`, `donate.astro`
- Modify: `src/styles/pages/{ministry,testimonies,pastors}.css`, `src/lib/seo.mjs`, `src/lib/format.mjs` (видалити `paragraphs`)
- Test: `tests/cms-components.test.js`, `tests/lib-seo.test.js`, `tests/lib.test.js`, `tests/pages-toggle.test.js`,
  `tests/seo.test.js`, `tests/page-{ministries,pastors,testimonies}.test.js`

**Interfaces:**
- Produces: `ministries.body`, `churches.body`, `projects.body`, `pastors.bio`, `testimonies.text` (text-варіант) —
  `localizedRich`; `pages.body` — `localizedRich.nullable().optional()`; модель — `rich(…)` з тими самими підписами,
  `site_page.body` з `{ optional: true, nullable: true }`. `paragraphs()` більше немає.

- [ ] **Step 1: Падаючий тест** `cms-components.test.js`: `основні тексти — richtext з повною панеллю` — шість полів →
  `toolbar === TOOLBAR.rich`.

- [ ] **Step 2:** схема, модель, `node scripts/migrate-richtext.mjs` — змінені лише шість полів.

- [ ] **Step 3: Шаблони й стилі** (рішення 5). Без обгортки: `churches/[slug]`, `projects/[slug]` (`.info`),
  `pastors.astro` (`.pastor-body`, `.elder-card`), `about/contacts/donate` (`<div class="prose"><Rich … /></div>`).
  З обгорткою: `<div class="desc"><Rich value={m.body} lang={lang} /></div>`,
  `<div class="tst-text"><Rich value={x.text} lang={lang} /></div>`. CSS:
  - `ministry.css`: `.info p.desc{…}` → ті самі властивості на `.info .desc`, `.info .desc p{margin:0}`, відступ між
    сусідніми блоками всередині `.desc` (`p + p`, `p + .rt-list` …) `1rem`;
  - `testimonies.css`: `.tst-card p{…}` → `.tst-card .tst-text{margin:… ;flex:1}` + `.tst-text p{font-size;line-height;margin:0}`, `p + p{margin-top:.8rem}`;
  - `pastors.css`: `.elder-card p + p{margin-top:.5rem}`.
  Перед заміною — `grep -n "\.desc\|tst-card p\|elder-card p" src/styles/pages/*.css` (інших правил для цих селекторів немає).

- [ ] **Step 4: SEO й фікстури.** `pageDescription`: `pickPlain(page.body, lang).split('\n\n')[0]`; `paragraphs` видалити
  з `format.mjs`, `seo.mjs`, `about/contacts/donate.astro` і тестів. Фікстури: probes — `body`, `bio`, `text` через `rich`;
  `lib-seo.test.js`, `pages-toggle.test.js`, `seo.test.js` — `rich('Перший.\n\nДругий.', …)`; `page-*.test.js` — `domText`.
  Решта: `grep -rnE "\.(body|bio|text)(\?)?(\.|\[)(uk|en|lang)\b" tests`.

- [ ] **Step 5:** `npm test` PASS; `diff-dirs dist-t4 dist` — відрізняються лише: CSS ministry/testimonies/pastors (і
  посилання на хеші), `**/ministries/*/index.html` (обгортка `.desc`), `testimonies/index.html` і `en/testimonies/index.html`
  (обгортка `.tst-text`). `churches/*`, `projects/*`, `about/contacts/donate` (якщо ввімкнені) — побайтово однакові.

- [ ] **Step 6: Commit** — `feat: основні тексти — повний richtext`.

---

### Task 9: адреси кнопок

**Files:**
- Modify: `src/lib/schema.mjs`, `src/lib/storyblok/model.mjs`, `scripts/migrate-richtext.mjs`, `src/content/**` (скриптом)
- Modify: `src/components/SiteHeader.astro`, `src/pages/[...lang]/{index,pastors,leaders}.astro`, `ministries/[slug].astro`, `churches/[slug].astro`
- Modify: `tests/helpers/probes.js`, `tests/cms-convert.test.js`
- Test: `tests/buttons.test.js` (новий)

**Interfaces:**
- Consumes: `linkUrl`, `linkAttrs` (Задача 1).
- Produces — усі поля `linkUrl.nullable()` (у моделі — `url(label, { nullable: true })`, де
  `url = (label, opts) => text(label, { description: LINK_HINT, ...opts })`,
  `LINK_HINT = 'https://… (інший сайт), /сторінка/ (цей сайт), #розділ (на цій сторінці), mailto:… або tel:… Порожньо — як зараз.'`):

| Поле | Кнопка (селектор у тесті) | Порожньо → |
|---|---|---|
| `homepage.cta.liveUrl` | «Трансляція» в шапці й мобільному меню | `${site-settings.social.youtube}/streams` |
| `homepage.hero.watchUrl` | `.hero-actions .btn-primary` | те саме |
| `homepage.hero.contactsUrl` | `.hero-actions .btn-ghost` | `#contacts` |
| `homepage.hero.donateUrl` | `.hero-donate-cta` | `donate-settings.liqpayUrl` |
| `homepage.news.items[].url` | `.news-more` своєї картки | `#media` |
| `homepage.{testimonies,ministries,pastors}.allUrl` | кнопка «Усі …» своєї секції | `/testimonies/`, `/ministries/`, `/pastors/` |
| `homepage.donate.btnUrl` | `.donate-btn` | `donate-settings.liqpayUrl` |
| `pages.*.help.btnUrl` | кнопка блоку help | pastors — `https://m.me/dom.hleba.org`, leaders — `mailto:leaders@houseofbread.church` (константи лишаються в шаблонах як фолбек) |
| `ministries.ctaUrl` | `.info > .btn` | `tel:` телефону служіння |
| `churches.directionsUrl` | `.info > .btn` | Google Maps за адресою (наявний `directions`) |

Підпис кожного поля в моделі називає фолбек («Посилання «Дивитися» (порожньо — трансляції YouTube)»).
`project.ctaUrl` — теж `url(…)`.

- [ ] **Step 1: Падаючі тести** `tests/buttons.test.js` — очікування з контенту, який тест читає, через
  `expected(lang, url) = { target: undefined, rel: undefined, ...linkAttrs(BASE_PATH, lang, url) }`:
  - `кнопки головної — з полів контенту, порожні — з фолбеків` (обидві мови, `dist`);
  - `«Потрібна допомога» — з help.btnUrl або константи сторінки`;
  - `служіння й церква: поле кнопки, інакше телефон і маршрут`;
  - `заповнені поля перекривають фолбеки` (`withBuild`: усі поля головної, служіння-проба з `mailto:`, церква-проба з
    `https://`, `help.btnUrl` сторінки pastors `/contacts/`) — `target="_blank"` лише на `https://`;
  - `адреса кнопки поза linkUrl валить схему з назвою поля` (`hero.contactsUrl: 'javascript:alert(1)'`).
  Перед запуском звірити селектори з шаблонами; розбіжність — виправити тест під код.
  FAIL — полів немає, «Дивитися» без `target`.

- [ ] **Step 2: Схема й модель** за таблицею; кожне поле моделі — одразу після підпису своєї кнопки.

- [ ] **Step 3: Міграція** — у `migrate-richtext.mjs` нові ключі `??= null` (усі, і в кожній новині, і в `help`, якщо
  група є). `node scripts/migrate-richtext.mjs` — у `git diff` лише нові ключі зі значенням `null`.

- [ ] **Step 4: Шаблони** — кожна кнопка `{...linkAttrs(base, lang, поле ?? фолбек)}`; прибрати жорсткі
  `target`/`rel`; невживані імпорти прибрати (`localePath` в `index.astro` ще потрібен).

- [ ] **Step 5: Фікстури** — probes: `ministry` `ctaUrl: null`, `church` `directionsUrl: null`; `pages/full` —
  `help.btnUrl: '#contacts'`; `grep -rn "help:" tests` — додати `btnUrl` у повні фікстури.

- [ ] **Step 6:** `npm test` PASS; `diff-dirs dist-t4 dist` — понад Задачу 8: головна (`target`/`rel` на «Дивитися»,
  порядок атрибутів кнопок), `churches/*` (`target`/`rel` на «Прокласти маршрут») (рішення 7). Шапка інших сторінок —
  без змін.

- [ ] **Step 7: Commit** — `feat: адреса кожної кнопки редагується в Storyblok`.

---

### Task 10: перевірки — якорі, дублікати `id`, повне форматування в кожному полі

**Files:**
- Modify: `tests/helpers/links.js`, `tests/site.test.js`, `tests/helpers/build.js` (метод `replace`)
- Create: `tests/richtext-probe.test.js`
- Modify: `tests/helpers/richtext-full.js` (`fillAll`)

**Interfaces:**
- Consumes: `mapRichPairs` (Задача 5), `FULL_DOC` (Задача 3), `withBuild`, `findBrokenLinks`.
- Produces: у `findBrokenLinks` — якорі `a[href^="#"]` без елемента з таким `id` на сторінці (`«<сторінка>: #x → на
  сторінці немає id="x"»`); `findDuplicateIds(dir): string[]` у `links.js` (`«<сторінка>: id="x" — N разів»`), сторінки
  читаються через `ownMarkup` (стрічку Facebook не перевіряємо); `ContentFixture.replace(entry, data)` (колекція — файл,
  `pages` — ключ `pages.json`, одиночка — `singletons/<name>.json`); `fillAll(fixture)` у `richtext-full.js` — кожна
  форматована пара кожного запису копії контенту → `{ uk: FULL_DOC[level]('uk'), en: FULL_DOC[level]('en') }`.

- [ ] **Step 1: Якорі й дублікати.** Додати перевірки й тест `site.test.js`: `жодного дубліката id на сторінці`.
  Run: `npm test`. Якщо падає на якорі чи `id` із **шаблону** (меню, футер) — це справжня вада сайту: не глушити, а
  зупинитися й показати список користувачу.

- [ ] **Step 2: Падаючий тест** `tests/richtext-probe.test.js`: `повне форматування в кожному полі: збірка, валідна
  розмітка, без битих посилань` (`withBuild(fillAll, …)`, таймаут 300 с):
  - збірка не впала (`output.slice(-3000)` у повідомленні);
  - `findBrokenLinks(dir, BASE_PATH)` → `[]`, `findDuplicateIds(dir)` → `[]`;
  - жодної невалідної вкладеності: `['p p','p ul','p ol','p div','p table','p blockquote','p pre','p h2','p h3','h2 p','h2 ul','span p','span ul','a a'].join(', ')` → 0;
  - на сторінках є `.rt-list`, `.rt-table`, `.rt-img` (рендер блокових полів спрацював);
  - `a.rt-link[href^="https://example.test"]` → `target="_blank"`.
  Якщо `withBuild`/`ContentFixture` не має `replace` — додати.
  Run: `npx astro build && node --test tests/richtext-probe.test.js`. FAIL лише якщо шаблон ламає розмітку — виправити
  шаблон (Задачі 5–8), а не пробу. (Знахідка «`a a`» означає поле `inline` усередині картки-посилання — його рівень має
  бути `card`: змінити рівень у схемі й моделі, а не прибирати перевірку.)

- [ ] **Step 3:** тест PASS, `npm test` PASS.

- [ ] **Step 4: Commit** — `test: якорі, дублікати id, повне форматування в кожному полі`.

---

### Task 11: пробний документ із живого редактора (лише з дозволу; потрібен користувач)

Спека, розділ «Пробний документ редактора». Змінює живий простір «Dim Hliba» лише тимчасовим компонентом і історією
поза теками сайту. **Перед `create` і `remove` — явне «так» користувача.** Без `STORYBLOK_MANAGEMENT_TOKEN` у `.env` —
зупинитися й попросити.

**Files:**
- Create (тимчасово): `scripts/cms/richtext-probe.mjs`
- Create: `tests/fixtures/storyblok-richtext-probe.json`, `tests/richtext-editor.test.js`
- Modify: за знахідками — `src/lib/richtext.mjs`, `src/lib/schema.mjs`, `src/lib/storyblok/model.mjs` (`TOOLBAR`)

**Interfaces:**
- Consumes: `buildComponents`-подібний JSON поля (`components.mjs`), `TOOLBAR`, клієнт `scripts/cms/client.mjs`.
- Produces: `node scripts/cms/richtext-probe.mjs create|fetch|remove`:
  - `create` — компонент `richtext_probe` (`is_root: true`, поля `rich`, `inline`, `card` — `richtext` з
    `TOOLBAR[level]`), тека `_probe` і історія `_probe/richtext` цього типу; друкує посилання на історію в адмінці;
  - `fetch` — `GET /stories/<id>` → `content` історії у `tests/fixtures/storyblok-richtext-probe.json` (без `_editable`,
    з `_uid`);
  - `remove` — видаляє історію, теку й компонент.
  **Ніколи** не запускати `cms:import -- --prune`, поки компонент існує (prune видалив би його посеред проби).

- [ ] **Step 1:** «так» користувача → `node scripts/cms/richtext-probe.mjs create`. Переконатися, що `npm run cms:pull`
  (dry, у тимчасову теку `-- --out <tmp> --public <tmp>`) пише `! _probe/richtext: поза папками сайту — пропущено` і
  нічого більше не змінює.

- [ ] **Step 2: Користувач заповнює історію** за списком (дати йому дослівно):
  - поле «rich»: заголовки H2–H6; абзац з жирним, курсивом, підкресленим, закресленим, верхнім і нижнім індексом, кодом,
    емодзі; посилання на сайт (`https://example.com`), на пошту, на файл з медіатеки (будь-який PDF), на сторінку сайту
    (Story → будь-яке служіння) з якорем і без; якір; маркований і нумерований (почати з 3) списки з вкладеним
    пунктом; цитату; горизонтальну лінію; блок коду; таблицю 2×2 з обʼєднаною клітинкою; дві картинки з медіатеки — одну
    з описом (alt), одну без; Enter у кінці;
  - поле «inline»: усі кнопки панелі по разу, два абзаци;
  - поле «card»: усі кнопки панелі по разу;
  - у будь-яке поле — вставка фрагмента з Word / Google Docs з кольоровим текстом і вирівнюванням по центру.
  - Зберегти (публікувати не обовʼязково). Окремо записати, які кнопки панелі показала форма і чи збігаються вони з `TOOLBAR`.

- [ ] **Step 3:** `node scripts/cms/richtext-probe.mjs fetch` → фікстура. Перевірити, що в ній немає персональних даних
  (лише текст проби); за потреби — замінити.

- [ ] **Step 4: Падаючі тести** `tests/richtext-editor.test.js` на фікстурі:
  - `документ з редактора нормалізується й проходить схему свого рівня` — для кожного поля `normalizeDoc(…, { resolveStory: () => '/ministries/probe/' })`
    → `localizedRich`/`Inline`/`Card` (`{uk: d, en: d}`) успішні, **крім** очікуваних помилок: картинка без alt (`/опису/`),
    вставка з Word (`/колір|вирівнювання/`) — тест прибирає ці вузли за типом і перевіряє решту окремо;
  - `нормалізація ідемпотентна на справжньому документі`;
  - `рендер справжнього документа — без невідомих вузлів`: `renderRich` не містить тексту, що потрапив би з невідомого
    вузла без тегу (порівняти кількість текстових вузлів `richPlain` до й після);
  - `TOOLBAR збігається з формою` — масив із кроку 2, записаний у фікстуру як `toolbarSeen`, дорівнює `TOOLBAR[level]`.
  Run — FAIL на кожній невідповідності; кожна — це зміна нормалізації, схеми чи `TOOLBAR` з окремим тестом у
  `richtext.test.js` / `richtext-schema.test.js`, а не правка фікстури.

- [ ] **Step 5:** виправлення → тести PASS → `npm test` PASS. Якщо змінився `TOOLBAR` — `cms-components.test.js` теж.

- [ ] **Step 6:** «так» користувача → `node scripts/cms/richtext-probe.mjs remove`; `git rm scripts/cms/richtext-probe.mjs`
  (одноразовий; фікстура лишається).

- [ ] **Step 7: Commit** — `test: документ зі справжнього редактора Storyblok — нормалізація, схема, панель`.

---

### Task 12: вигляд піксель у піксель, телефон, документація, прибирання

**Files:**
- Create: `scripts/lib/compare-screens.mjs`, `scripts/lib/richtext-probe-build.mjs`
- Delete: `scripts/migrate-richtext.mjs`
- Modify: `CLAUDE.md`, `.gitignore`; спека — лише якщо рішення змінилися під час реалізації

**Interfaces:**
- Produces:
  - `node scripts/lib/compare-screens.mjs <еталон> <нова> [тека відмінностей]` — обидві збірки з base `/`, кожна
    сторінка на ширинах 1440 і 390, `fullPage`, чужі хости заблоковані, анімації вимкнені, `.reveal` у кінцевому стані
    (клас — з `grep -rn "reveal" src`); побайтове порівняння PNG; відмінності — пари PNG у теці; код виходу 1, якщо є;
  - `node scripts/lib/compare-screens.mjs --overflow <збірка>` — кожна сторінка на 390: `scrollWidth > clientWidth`
    документа → `✗ <шлях>`; код виходу 1, якщо є;
  - `node scripts/lib/richtext-probe-build.mjs <outDir>` — копія `src/content` у тимчасову теку, `fillAll` (Задача 10),
    `astro build` з `BASE_PATH=/` і `HOB_CONTENT_DIR`; тимчасова тека прибирається.

- [ ] **Step 1:** обидва скрипти.

- [ ] **Step 2: Піксель у піксель.**

```bash
git worktree add ../hob-before $(git merge-base HEAD main)
(cd ../hob-before && npm ci && BASE_PATH=/ npx astro build --outDir screens-ref)
BASE_PATH=/ npx astro build --outDir screens-new
node scripts/lib/compare-screens.mjs ../hob-before/screens-ref screens-new
git worktree remove --force ../hob-before
```

На Windows / Git Bash — `MSYS_NO_PATHCONV=1`. Expected: `Сторінки однакові.` Відмінність — відкрити пари PNG; найімовірніше
CSS обгорток Задачі 8 — виправити, повторити.

- [ ] **Step 3: Телефон.** `node scripts/lib/richtext-probe-build.mjs screens-probe && node scripts/lib/compare-screens.mjs --overflow screens-probe`
  — Expected: без `✗`. Знахідка — правило в `base.css` (таблиця, картинка, довге слово в `.rt-code`), повторити.
  Переглянути очима скріншоти 390 і 1440 детальної сторінки служіння й головної з проби: заголовки, списки, цитата,
  таблиця й картинка — у стилі сайту, на токенах.

- [ ] **Step 4: Прибирання.** `git rm scripts/migrate-richtext.mjs`; `.gitignore` — `screens-*/`, прибрати `dist-t4/`,
  `dist-before/` лишити.

- [ ] **Step 5: Документація.** `CLAUDE.md`, розділ **Content**: абзац про richtext — документ редактора як є в обох
  мовах; три рівні (`localizedRich` / `localizedRichInline` / `localizedRichCard`) і що кожен дозволяє; allowlist у
  `richIssues`, бо бібліотека пропускає `javascript:` і невідомі вузли; рендер лише через `<Rich value lang inline? />`
  (єдиний `set:html` для richtext, тест); `pickPlain` для мета/JSON-LD; `linkUrl` + `linkAttrs` для посилань у тексті й
  кнопок (зовнішні — нова вкладка); усі адреси кнопок необовʼязкові з фолбеком; `mapRichPairs`. Речення «no markup in text
  fields except `homepage.hero.title`» → «plain-text fields: no markup; richtext fields: allowlisted document». Розділ
  **CMS**: `fromStory` нормалізує richtext (`normalizeDoc`), посилання на історії розвʼязує за `uuid` (`storyRoutes`), а
  невідома історія дає текст без посилання й попередження; картинки в тексті — через медіатеку туди й назад.
  `npm run cms:import -- --prune` видаляє компоненти, яких немає в моделі.

- [ ] **Step 6:** `npm test` і `npm run e2e` — PASS обидва.

- [ ] **Step 7: Commit** — `docs: richtext і посилання кнопок у CLAUDE.md; перевірка скріншотами й шириною телефона`.

---

### Task 13: імпорт у живий простір (лише з окремого дозволу)

Змінює живий простір. **Перед кожним `--apply` — явне «так» користувача.** Може йти й після злиття гілки: до імпорту
`cms:pull` читає рядки старої моделі як документи (рішення 12), а нові адреси кнопок — `null`.

- [ ] **Step 1: Свіжий знімок і план.** `npm run cms:pull` → `git diff --stat src/content` (лише правки редактора —
  показати користувачу, закомітити окремо `content: знімок Storyblok перед імпортом richtext`) → `npm test` →
  `npm run cms:import` (dry-run). Expected: оновлення компонентів (`textarea` → `richtext`, нові поля кнопок) і `update`
  історій з форматованими полями, **без конфліктів**. Конфлікт — правка в Storyblok між pull і dry-run: повторити.
  Показати план користувачу.

- [ ] **Step 2: «так» → імпорт.** `npm run cms:import -- --apply`, ще раз `npm run cms:import` (Expected: `0 змін`),
  `npm run cms:verify` (Expected: повний збіг).

- [ ] **Step 3: Перевірка в редакторі.** Відкрити служіння, головну, сторінку `pastors`: поля мають панелі своїх
  рівнів; «Коротко» — без посилання. Користувач у «Тексті» одного служіння робить список, посилання на іншу сторінку
  (Story) і картинку, зберігає — прев'ю-стенд показує форматування, Visual Editor клікає блок.

- [ ] **Step 4: Публікація.** Після «так» — опублікувати правку (або повернути). Вебхук запускає `deploy.yml`,
  `npm test` у CI проходить, сторінка на GitHub Pages показує форматування й посилання на поточну адресу.
