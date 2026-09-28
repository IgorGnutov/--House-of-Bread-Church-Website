# Форматований текст і посилання кнопок — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Довгі тексти редагуються в Storyblok як richtext (два рівні форматування), а кожна кнопка сайту має поле з адресою. На поточному контенті сайт виглядає піксель у піксель так само.

**Architecture:** Документ редактора Storyblok (ProseMirror JSON) зберігається в `src/content` як є, у парі `{uk, en}`. Межа безпеки — zod-схема: allowlist вузлів, марок і атрибутів, один формат адрес `linkUrl` для кнопок і посилань у тексті. `fromStory` нормалізує документ (прибирає атрибути, які дописує редактор), тож перетворення файли ↔ Storyblok точне. Рендер — `@storyblok/richtext` зі своїми рендерерами посилань, абзаців, списків і заголовків; у шаблони HTML потрапляє лише через `Rich.astro`. Які поля форматовані, знає модель Storyblok (`item: 'richtext'`, `level`), тому міграція контенту й проби тестів обходять записи за моделлю.

**Tech Stack:** Astro `^5.18.2`, zod 3 з `astro/zod`, **нова залежність `@storyblok/richtext@^5.3.2`** (лише головний вхід `renderRichText`), `node:test`, `node-html-parser`, Playwright (вже є, для візуального порівняння), Storyblok Management API (лише Задача 11).

**Spec:** [2026-09-28-04-richtext-buttons-design.md](../specs/2026-09-28-04-richtext-buttons-design.md). Попередній етап: [Етап 5](2026-09-25-storyblok-stage-5.md). Код, на який план спирається: `src/lib/schema.mjs`, `src/lib/storyblok/{model,check,components,convert}.mjs`, `src/lib/paths.mjs`, `src/lib/seo.mjs`, `scripts/cms/content.mjs`, `tests/helpers/{probes,content,build,links}.js`.

## Global Constraints

- **Єдина нова залежність** — `@storyblok/richtext@^5.3.2` у `dependencies` (рендер працює і в прев'ю-воркері). Підшляхи `@storyblok/richtext/html-parser` і `/markdown-parser` **не імпортувати**: вони тягнуть tiptap і happy-dom у бандл воркера.
- **Межа безпеки — схема.** Бібліотека пропускає `javascript:` у `href` і мовчки рендерить дітей невідомих вузлів. Усе, що дозволяє схема, мусить рендеритися безпечно; все інше — падати на збірці з повідомленням, яке називає поле.
- **Рівні:** `block` — абзац, `h3`, маркований і нумерований список (з вкладеними), перенос рядка, жирний, курсив, посилання. `inline` — абзац, перенос рядка, жирний, курсив, посилання. Поля кожного рівня — таблиця «Два рівні форматування» у спеці.
- **`linkUrl`** — `https://…`, `http://…`, `mailto:…@…`, `tel:` (≥ 7 символів номера), `/…` (не `//…`), `uploads/…`, `#якір`. Той самий валідатор для кнопок, `projects.ctaUrl` і посилань у тексті.
- **Вкладка — за адресою:** `http(s)://` → `target="_blank" rel="noopener noreferrer"`, решта — без `target`.
- **Контракт з адмінкою** (CLAUDE.md): тести виводять очікування з контенту, який читають, і не пришпилюють поточних значень. `src/content` тести не змінюють. Граничні випадки — пробні збірки (`withBuild`, `withContentCopy`).
- **Вигляд не змінюється.** Мірило `diff-dirs` — еталонна збірка `dist-before/` (Задачі 1–3), з Задачі 4 — `dist-t4/`. Задачі 1–3, 5 і 6 не змінюють жодного байта виходу, Задача 4 — лише CSS, Задачі 7–8 — лише перелічені в них відмінності. Піксель у піксель — скріншоти проти збірки з `main` (Задача 10).
- **`npm test` не ходить у мережу.** Живий простір Storyblok — лише Задача 11 і лише з окремого дозволу користувача.
- Робота в гілці `richtext-buttons`. Коментарі й назви тестів **українською**, коментар пояснює *чому*. ESM `.mjs`, 2 пробіли, одинарні лапки, крапка з комою. У `.astro` — без `<style>` (є тест). Кольори — лише наявні токени.
- Кожна задача закінчується `npm test` без жодного FAIL і окремим комітом з кінцівкою:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## Зафіксовані рішення цього плану

Уточнення, які зʼявилися під час планування. Якщо ревʼю не згодне — правити **до** старту. Рішення 1, 3, 5, 6, 7, 8 і 13 уже внесено в спеку.

| # | Питання | Рішення | Підстава |
|---|---|---|---|
| 1 | Як схема перевіряє документ | Не рекурсивними `z.object` / `z.lazy`, а одним обходом `richIssues(value, level)` у `superRefine` (`z.any()`), який додає issue з точним шляхом (`body.uk.content.0.content.2.marks.0.attrs.href`) і українським поясненням | Рекурсивний union zod на невідомому вузлі видає «Invalid input» по кожній гілці union — редактор не зрозуміє, що не так. Обхід знає, *чому* вузол заборонений (таблиця, список в інлайн-полі, посилання на історію) |
| 2 | Атрибути посилання | Після нормалізації — рівно `{ href, linktype }`. `target`, `uuid`, `anchor`, `custom` відкидаються; вкладку вибирає рендер за адресою | Одне правило для кнопок і тексту. Редактор не може зробити внутрішнє посилання, що відкривається в новій вкладці, і навпаки — так і задумано |
| 3 | Посилання на файл медіатеки Storyblok | `linktype: 'asset'` дозволений; `linkUrl` приймає `uploads/…`, а `linkHref` веде його під `base` (`assetUrl`) | `cms:pull` переписує **будь-який** рядок з адресою файлу Storyblok на відносний `uploads/cms/…` (`scripts/cms/assets.mjs`, `mapStrings`) — вже після перевірок. Без `uploads/…` у `linkUrl` посилання на PDF пройшло б `cms:pull` і завалило б `astro build`. Існування файлу перевіряє `findBrokenLinks` (виняток контракту з CLAUDE.md) |
| 4 | Апостроф | Рендер замінює `&#039;` (бібліотека) на `&#39;` (Astro) | Той самий символ, але `diff-dirs` порівнює байти. Однаковий запис доводить, що міграція інлайн-полів не змінила жодної сторінки. У контенті 33 апострофи |
| 5 | Обгортка блокових полів | Без обгортки там, де стилі сторінки задані предком (`.info p` у church/project, `.pastor-body p`, `.elder-card p`, `.prose p`) — абзаци стають на місце старого `<p>`. Обгортка `<div>` лише для `ministries.body` (`.desc`, стиль на класі самого `<p>`) і `testimonies.text` (`.tst-text`, бо `p{flex:1}` на кожному абзаці ділив би вільне місце) | Мінімум змін розмітки: один абзац дає той самий HTML, що й зараз, крім двох обгорток |
| 6 | Стилі списків, `h3`, посилань | Класи ставить рендер (`rt-list`, `rt-h`, `rt-link`), правила — один раз у `src/styles/base.css`. Посилання: `color:inherit` + підкреслення | Правила не залежать від сторінки. `inherit` читається і на темному першому екрані, і на світлих секціях |
| 7 | Зміни поведінки кнопок | Дві, обидві через правило вкладки: «Дивитися» в першому екрані й «Прокласти маршрут» на сторінці церкви тепер відкриваються в новій вкладці | Спека називала лише першу; маршрут (Google Maps) зараз теж зовнішній без `_blank`. Одне правило для всіх кнопок важливіше за збереження непослідовності |
| 8 | Скрипт міграції | `scripts/migrate-richtext.mjs` живе з Задачі 5 до Задачі 10 (його перезапускають Задачі 6–8, він ідемпотентний) і видаляється в Задачі 10. Обхід за моделлю — окремий модуль `src/lib/storyblok/walk.mjs`, він лишається (ним користується проба Задачі 9) | Поля переходять у трьох задачах: один ідемпотентний скрипт простіший за три |
| 9 | Кнопки панелі Storyblok | `block`: `bold, italic, link, paragraph, h3, list, olist`; `inline`: `bold, italic, link` | Назви кнопок — з документації Storyblok. Живу форму перевіряє Задача 11; розбіжність стає зміною `TOOLBAR` |
| 10 | Вибір мови документа | `pickRich(pair, lang)` (документ) і `pickPlain(pair, lang)` (простий текст) поруч із `pick` у `src/lib/i18n.mjs` | `pick` вимагає рядок і правильно падає на документі. Та сама відмова без фолбеку на іншу мову |
| 11 | Еталон | `npx astro build --outDir dist-before` на коміті до Задачі 1, з Задачі 4 — `dist-t4`; обидві теки — у `.gitignore`. Для скріншотів — окрема збірка `main` у git worktree (Задача 10) | CLAUDE.md: еталон будувати всередині проєкту. Скріншотам потрібен `BASE_PATH=/`, а `dist-before` зібрано з типовим |
| 12 | Живий простір | Задача 11 — лише з окремого «так» користувача, у погодженому ним порядку | Імпорт оновлює всі історії з форматованими полями |
| 13 | Рядок у полі richtext (історії Storyblok до імпорту нової моделі) | `fromStory` перетворює непорожній рядок на документ тим самим `docFromText`, що й міграція; порожній рядок — «немає» | Імпорт порівнює **дані** (`fingerprint(fromStory(remote))`), а не сирий JSON (`scripts/cms/sync.mjs`, `makePlan`). Тож: (1) `cms:pull` у CI працює і до імпорту в живий простір — злиття гілки не блокує деплой; (2) `--force` не потрібен: дані збігаються з файлами, відрізняється лише відбиток, тож імпорт чесно оновлює історію, а правка редактора між `cms:pull` і імпортом так само дає конфлікт. |

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `src/lib/richtext.mjs` (новий) | Дані richtext без рендеру: `isDoc`, `docFromText`, `normalizeDoc`, `isEmptyDoc`, `richPlain` |
| `src/lib/richtext-render.mjs` (новий) | `renderRich(doc, { base, lang, inline })` над `@storyblok/richtext` |
| `src/components/Rich.astro` (новий) | Єдине місце `set:html` для richtext |
| `src/lib/schema.mjs` | `linkUrl`, `richIssues`, `localizedRich`, `localizedRichInline`; поля колекцій |
| `src/lib/paths.mjs` | `linkHref` (увесь `linkUrl`), `linkAttrs` |
| `src/lib/i18n.mjs`, `src/i18n/index.ts` | `pickRich`, `pickPlain` |
| `src/lib/storyblok/model.mjs` | `rich`, `richInline`, `url`, `TOOLBAR`; поля |
| `src/lib/storyblok/check.mjs` | звірка форматованих пар |
| `src/lib/storyblok/components.mjs` | JSON поля `richtext` з панеллю |
| `src/lib/storyblok/convert.mjs` | читання/запис `richtext` |
| `src/lib/storyblok/walk.mjs` (новий) | `mapRichPairs(collection, data, fn)` — обхід форматованих пар за моделлю |
| `scripts/migrate-richtext.mjs` (тимчасовий, Задачі 5–10) | міграція `src/content` |
| `scripts/lib/compare-screens.mjs` (новий) | скріншоти двох збірок і побайтове порівняння PNG |
| `src/styles/base.css`, `src/styles/pages/{ministry,testimonies,pastors}.css` | стилі richtext і обгорток |
| шаблони `src/pages/[...lang]/**`, `SiteHeader.astro`, `SiteFooter.astro`, `Seo.astro` | `Rich`, `pickPlain`, `linkAttrs` |
| `tests/helpers/{content,probes,links}.js` | `domText`, `textOf`, `rich()`, перевірка якорів |
| `tests/richtext.test.js`, `tests/richtext-schema.test.js`, `tests/richtext-render.test.js`, `tests/richtext-probe.test.js`, `tests/buttons.test.js` (нові) | див. задачі |

## Review Focus

1. **Документ зі справжнього редактора Storyblok** має атрибути, яких немає в allowlist (`textAlign: null`, у посиланні `uuid`, `target`, `custom`). Очікування: `fromStory` їх прибирає, схема пропускає, `cms:verify` не бачить різниці. Тест — Задача 5, крок 1 (`cms-convert.test.js`), і живий документ — Задача 11.
2. **Посилання на PDF з медіатеки Storyblok у тексті.** Очікування: `cms:pull` завантажує файл, `href` стає `uploads/cms/…`, збірка проходить, посилання веде на файл під `base`. Тест — Задача 9, крок 5.
3. **Enter у кінці тексту / очищене поле.** Очікування: хвостовий порожній абзац зникає без сліду; очищене обовʼязкове поле валить збірку з назвою поля й мови; очищене nullable-поле стає `null`. Тести — Задача 2 (нормалізація) і Задача 5 (конвертація).
4. **Апострофи, лапки й `&` у тексті.** Очікування: екрануються так само, як Astro, і сторінка побайтово та сама. Тест — Задача 4, крок 1, і `diff-dirs` у Задачах 5–6.
5. **Внутрішня адреса кнопки під sub-path GitHub Pages і в `/en/`.** Очікування: `/ministries/` з `base` `/repo/` на англійській стає `/repo/en/ministries/`. Тест — Задача 1, крок 1 (`linkAttrs` з `base` `/sub/`), і `findBrokenLinks` у CI (деплой збирає з `BASE_PATH`).

---

## Задача 1: формат адрес `linkUrl`, `linkHref`, `linkAttrs`

**Files:**
- Modify: `.gitignore`
- Modify: `src/lib/schema.mjs` (після `phone`, рядок ~57; `projects.ctaUrl`, рядок ~151)
- Modify: `src/lib/paths.mjs:20-26`
- Modify: `src/pages/[...lang]/projects/[slug].astro` (кнопка CTA, рядок ~75; `const external`, рядок ~31)
- Test: `tests/lib.test.js`, `tests/schema.test.js`

**Interfaces:**
- Produces: `export const LINK_URL: RegExp`, `export const linkUrl: ZodString` (`src/lib/schema.mjs`); `linkHref(base, lang, url): string` приймає увесь `linkUrl`; `linkAttrs(base, lang, url): { href: string, target?: '_blank', rel?: 'noopener noreferrer' }` (`src/lib/paths.mjs`).

- [ ] **Step 0: Еталонна збірка**

До будь-яких змін коду:

```bash
printf '\n# Еталонна збірка для diff-dirs і скріншотів (Спека 4)\ndist-before/\n' >> .gitignore
npx astro build --outDir dist-before
```

Expected: `dist-before/index.html` існує. Цю теку не перебудовувати до кінця плану.

- [ ] **Step 1: Написати падаючі тести**

У `tests/lib.test.js` замінити тест `linkHref: зовнішнє як є, внутрішнє — з локаллю, інше — помилка` (рядки ~36-40) на:

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
  assert.deepEqual(linkAttrs('/', 'uk', 'tel:+380991112233'), { href: 'tel:+380991112233' });
});
```

Додати `linkAttrs` в імпорт з `../src/lib/paths.mjs` (рядок 3).

У `tests/schema.test.js` додати (і `linkUrl` в імпорт з `../src/lib/schema.mjs`):

```js
test('linkUrl: адреси кнопок і посилань у тексті', () => {
  const ok = [
    'https://www.liqpay.ua/x', 'http://example.test', 'mailto:leaders@example.test', 'tel:+380 99 111-22-33',
    '/', '/ministries/youth/', '/#contacts', 'uploads/cms/abc-file.pdf', '#contacts',
  ];
  const bad = ['', '#', 'javascript:alert(1)', '//evil.test/x', 'index.html#contacts', 'mailto:', 'tel:12', 'https://', 'ftp://x.test'];
  for (const url of ok) assert.equal(linkUrl.safeParse(url).success, true, `відкинуто «${url}»`);
  for (const url of bad) assert.equal(linkUrl.safeParse(url).success, false, `пропущено «${url}»`);
});
```

- [ ] **Step 2: Переконатися, що тести падають**

Run: `node --test tests/lib.test.js tests/schema.test.js`
Expected: FAIL — `linkAttrs` не експортується, `linkUrl` не експортується.

- [ ] **Step 3: Реалізація**

`src/lib/schema.mjs`, одразу після визначення `phone`:

```js
// Адреса кнопки чи посилання в тексті (Спека 4) — один формат для всіх:
// чужий сайт, пошта, телефон, сторінка сайту («/…» — шаблон додає мову й
// base), файл сайту («uploads/…»: так cms:pull записує файли медіатеки
// Storyblok, і посилання на PDF інакше валило б збірку) або якір на тій
// самій сторінці. «//…» — чужий хост без схеми, голий «#» — заглушка.
export const LINK_URL = /^(?:https?:\/\/\S+|mailto:\S+@\S+|tel:\+?[\d\s()-]{7,}|\/(?!\/)\S*|uploads\/\S+|#[\w-]+)$/;
export const linkUrl = z.string().regex(LINK_URL, 'посилання: https://…, mailto:…, tel:…, /сторінка/, uploads/файл або #якір');
```

`projects.ctaUrl` (замінити коментар і `z.string().regex(/^(https:\/\/|\/)/).nullable()`):

```js
  // Формат — linkUrl: той самий, що в кнопок головної (Спека 4).
  ctaUrl: linkUrl.nullable(),
```

`src/lib/paths.mjs` — замінити `linkHref` і додати `linkAttrs` одразу після нього:

```js
// Посилання з даних (кнопки, ctaUrl, посилання в тексті; формат — linkUrl у
// schema.mjs): чужий сайт, пошта, телефон і якір — як є; сторінка сайту
// лишається в мові поточної сторінки; файл сайту — під base.
export function linkHref(base, lang, url) {
  if (isExternal(url) || /^(?:mailto:|tel:|#)/.test(url)) return url;
  if (url.startsWith('/')) return localePath(base, lang, url);
  if (url.startsWith('uploads/')) return assetUrl(base, url);
  throw new Error(`посилання має бути https://…, mailto:…, tel:…, /…, uploads/… або #…: ${url}`);
}

// Атрибути кнопки з адресою з даних. Чужий сайт — у новій вкладці, як LiqPay
// і YouTube; свій сайт, якір, пошта й телефон — у тій самій (Спека 4).
export const linkAttrs = (base, lang, url) => ({
  href: linkHref(base, lang, url),
  ...(isExternal(url) && { target: '_blank', rel: 'noopener noreferrer' }),
});
```

`src/pages/[...lang]/projects/[slug].astro`: видалити коментар і рядок `const external = …`; з імпорту прибрати `isExternal` і `linkHref`, якщо вони більше ніде не вживаються, і додати `linkAttrs`. Кнопку замінити на:

```astro
          <a class="btn" {...linkAttrs(base, lang, p.ctaUrl)}>
```

- [ ] **Step 4: Тести проходять, вихід не змінився**

Run: `npm test`
Expected: PASS.
Run: `node scripts/lib/diff-dirs.mjs dist-before dist`
Expected: `Збірки однакові.`

- [ ] **Step 5: Commit**

```bash
git add .gitignore src/lib/schema.mjs src/lib/paths.mjs "src/pages/[...lang]/projects/[slug].astro" tests/lib.test.js tests/schema.test.js
git commit -m "feat: linkUrl — один формат адрес для кнопок і посилань у тексті

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 2: дані richtext — `src/lib/richtext.mjs`

**Files:**
- Create: `src/lib/richtext.mjs`
- Test: `tests/richtext.test.js`

**Interfaces:**
- Produces (усі — іменовані експорти `src/lib/richtext.mjs`):
  - `isDoc(value): boolean` — обʼєкт з `type === 'doc'`;
  - `docFromText(text: string): Doc` — абзаци через порожній рядок, одиночний `\n` → `hard_break`;
  - `normalizeDoc(value): Doc | unknown` — для не-документа повертає вхід як є;
  - `isEmptyDoc(value): boolean` — документ без жодного блоку (після нормалізації);
  - `richPlain(doc): string` — абзаци, підзаголовки й пункти через `\n\n`, пробіли згорнуті.

- [ ] **Step 1: Написати падаючі тести**

`tests/richtext.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docFromText, isDoc, isEmptyDoc, normalizeDoc, richPlain } from '../src/lib/richtext.mjs';

const text = (t, marks) => ({ type: 'text', text: t, ...(marks && { marks }) });
const para = (...content) => ({ type: 'paragraph', ...(content.length > 0 && { content }) });

test('docFromText: абзаци — через порожній рядок, перенос — hard_break', () => {
  assert.deepEqual(docFromText('Перший.\n\nДругий\nрядок.'), {
    type: 'doc',
    content: [para(text('Перший.')), para(text('Другий'), { type: 'hard_break' }, text('рядок.'))],
  });
  assert.deepEqual(docFromText('  \n\n '), { type: 'doc', content: [] });
});

test('isDoc розрізняє документ і все інше', () => {
  assert.equal(isDoc({ type: 'doc', content: [] }), true);
  for (const v of ['', 'doc', null, undefined, [], { type: 'paragraph' }]) assert.equal(isDoc(v), false, JSON.stringify(v));
});

test('normalizeDoc прибирає атрибути редактора Storyblok і лишає ті, що читає шаблон', () => {
  const fromEditor = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3, textAlign: null }, content: [text('Заголовок')] },
      { type: 'paragraph', attrs: { textAlign: null }, content: [
        text('сайт', [{ type: 'link', attrs: { href: 'https://example.test', uuid: null, anchor: null, target: '_blank', linktype: 'url', custom: {} } }]),
        text('пошта', [{ type: 'link', attrs: { href: 'a@b.test', linktype: 'email', target: '_self' } }, { type: 'bold', attrs: {} }]),
      ] },
      { type: 'ordered_list', attrs: { order: 1 }, content: [{ type: 'list_item', content: [para(text('раз'))] }] },
      { type: 'ordered_list', attrs: { order: 4 }, content: [{ type: 'list_item', content: [para(text('чотири'))] }] },
    ],
  };
  assert.deepEqual(normalizeDoc(fromEditor), {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [text('Заголовок')] },
      para(
        text('сайт', [{ type: 'link', attrs: { href: 'https://example.test', linktype: 'url' } }]),
        // Storyblok пише email-посилання голою адресою.
        text('пошта', [{ type: 'link', attrs: { href: 'mailto:a@b.test', linktype: 'email' } }, { type: 'bold' }]),
      ),
      { type: 'ordered_list', content: [{ type: 'list_item', content: [para(text('раз'))] }] },
      { type: 'ordered_list', attrs: { order: 4 }, content: [{ type: 'list_item', content: [para(text('чотири'))] }] },
    ],
  });
});

test('normalizeDoc: порожні абзаци на краях зникають, посередині лишаються', () => {
  const doc = { type: 'doc', content: [para(), para({ type: 'hard_break' }), para(text('a')), para(), para(text('b')), para()] };
  assert.deepEqual(normalizeDoc(doc).content, [para(text('a')), para(), para(text('b'))]);
  assert.equal(isEmptyDoc(normalizeDoc({ type: 'doc', content: [para(), para()] })), true);
  assert.equal(isEmptyDoc(normalizeDoc(docFromText('a'))), false);
});

test('normalizeDoc не викидає невідоме — його назве схема', () => {
  const table = { type: 'table', attrs: { x: 1 }, content: [] };
  const underline = { type: 'underline', attrs: { y: 2 } };
  const doc = normalizeDoc({ type: 'doc', content: [table, para(text('a', [underline]))] });
  assert.deepEqual(doc.content[0], table);
  assert.deepEqual(doc.content[1].content[0].marks, [underline]);
});

test('normalizeDoc ідемпотентна, не-документ повертає як є', () => {
  const once = normalizeDoc({ type: 'doc', content: [para(), para(text('x', [{ type: 'link', attrs: { href: 'q@w.test', linktype: 'email' } }]))] });
  assert.deepEqual(normalizeDoc(once), once);
  assert.equal(normalizeDoc(''), '');
  assert.equal(normalizeDoc(null), null);
});

test('richPlain: абзаци, підзаголовки й пункти — через порожній рядок', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [text('Заголовок')] },
      para(text('Жирний', [{ type: 'bold' }]), text('  і'), { type: 'hard_break' }, text('далі')),
      { type: 'bullet_list', content: [{ type: 'list_item', content: [para(text('пункт'))] }] },
      para(),
    ],
  };
  assert.equal(richPlain(doc), 'Заголовок\n\nЖирний і далі\n\nпункт');
  assert.equal(richPlain({ type: 'doc', content: [] }), '');
});
```

- [ ] **Step 2: Переконатися, що тести падають**

Run: `node --test tests/richtext.test.js`
Expected: FAIL — `Cannot find module '../src/lib/richtext.mjs'`.

- [ ] **Step 3: Реалізація**

`src/lib/richtext.mjs`:

```js
// Форматований текст (Спека 4) — документ редактора Storyblok (ProseMirror)
// як є: {type: 'doc', content: [...]}. Тут лише дані, без рендеру й без
// Astro: модуль читають схема, конвертація Storyblok і прев'ю-воркер.

export const isDoc = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && value.type === 'doc';

// Простий текст → документ: абзаци — через порожній рядок, одиночний
// перенос — hard_break. Так мігрує старий контент і будуються проби тестів.
export function docFromText(text) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: p.split('\n').flatMap((line, i) => [
        ...(i > 0 ? [{ type: 'hard_break' }] : []),
        ...(line.trim() ? [{ type: 'text', text: line.trim() }] : []),
      ]),
    })),
  };
}

// Атрибути, які читає рендер. Решту (textAlign: null, uuid, custom, target —
// вкладку вибирає рендер за адресою) редактор Storyblok дописує сам. Без
// нормалізації схема бачила б зайві поля, а cms:verify — «зміну» після
// кожного збереження.
const NODE_ATTRS = { heading: ['level'], ordered_list: ['order'] };
const KNOWN_NODES = new Set(['paragraph', 'heading', 'bullet_list', 'ordered_list', 'list_item', 'text', 'hard_break']);
const KNOWN_MARKS = new Set(['bold', 'italic', 'link']);

function normalizeMark(mark) {
  if (!KNOWN_MARKS.has(mark?.type)) return mark;
  if (mark.type !== 'link') return { type: mark.type };
  const { href = '', linktype = 'url' } = mark.attrs ?? {};
  // Storyblok пише email-посилання голою адресою, без «mailto:».
  const target = linktype === 'email' && !href.startsWith('mailto:') ? `mailto:${href}` : href;
  return { type: 'link', attrs: { href: target, linktype } };
}

// Невідомий вузол чи марка лишаються як є: схема назве їх, а не сторінка
// мовчки втратить текст.
function normalizeNode(node) {
  if (!KNOWN_NODES.has(node?.type)) return node;
  const out = { type: node.type };
  const keep = NODE_ATTRS[node.type];
  if (keep) {
    const attrs = Object.fromEntries(keep.filter((k) => node.attrs?.[k] != null).map((k) => [k, node.attrs[k]]));
    // Нумерація з 1 — типова; без неї документ з редактора й з міграції однакові.
    if (attrs.order === 1) delete attrs.order;
    if (Object.keys(attrs).length > 0) out.attrs = attrs;
  }
  if (node.type === 'text') {
    out.text = node.text;
    const marks = (node.marks ?? []).map(normalizeMark);
    if (marks.length > 0) out.marks = marks;
  }
  if (Array.isArray(node.content) && node.content.length > 0) out.content = node.content.map(normalizeNode);
  return out;
}

const blankParagraph = (node) => node?.type === 'paragraph' && !(node.content ?? []).some((n) => n?.type === 'text');

// Порожні абзаци на краях — слід Enter у редакторі, а не зміст.
export function normalizeDoc(value) {
  if (!isDoc(value)) return value;
  const content = (Array.isArray(value.content) ? value.content : []).map(normalizeNode);
  while (content.length > 0 && blankParagraph(content[0])) content.shift();
  while (content.length > 0 && blankParagraph(content.at(-1))) content.pop();
  return { type: 'doc', content };
}

export const isEmptyDoc = (value) => isDoc(value) && (value.content ?? []).length === 0;

const inlineText = (nodes = []) => nodes.map((n) => {
  if (n?.type === 'text') return n.text ?? '';
  if (n?.type === 'hard_break') return ' ';
  return inlineText(n?.content);
}).join('');

// Простий текст для місць, де розмітки бути не може: мета-опис, JSON-LD.
// Блоки — через порожній рядок, щоб «перший абзац» лишався першим абзацом.
export function richPlain(doc) {
  const blocks = [];
  const walk = (nodes = []) => {
    for (const node of nodes) {
      if (node?.type === 'paragraph' || node?.type === 'heading') {
        const text = inlineText(node.content).replace(/\s+/g, ' ').trim();
        if (text) blocks.push(text);
      } else if (Array.isArray(node?.content)) {
        walk(node.content);
      }
    }
  };
  walk(doc?.content);
  return blocks.join('\n\n');
}
```

- [ ] **Step 4: Тести проходять**

Run: `node --test tests/richtext.test.js`
Expected: PASS (7 тестів).

- [ ] **Step 5: Commit**

```bash
git add src/lib/richtext.mjs tests/richtext.test.js
git commit -m "feat: дані richtext — документ Storyblok, нормалізація, простий текст

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 3: схема форматованого тексту й вибір мови

**Files:**
- Modify: `src/lib/schema.mjs` (імпорт; блок після `localizedHtml`, рядок ~50)
- Modify: `src/lib/i18n.mjs` (після `pick`)
- Modify: `src/i18n/index.ts`
- Test: `tests/richtext-schema.test.js` (новий), `tests/lib.test.js`

**Interfaces:**
- Consumes: `isDoc`, `richPlain` (Задача 2), `linkUrl` (Задача 1).
- Produces: `export const localizedRich`, `export const localizedRichInline` (`src/lib/schema.mjs`) — `z.object({ uk, en }).strict()`; модель і `checkModel` упізнають їх **за тотожністю**. `pickRich(pair, lang): Doc`, `pickPlain(pair, lang): string` з `src/lib/i18n.mjs` і `src/i18n`.

- [ ] **Step 1: Написати падаючі тести**

`tests/richtext-schema.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizedRich, localizedRichInline } from '../src/lib/schema.mjs';
import { docFromText } from '../src/lib/richtext.mjs';

const text = (t, marks) => ({ type: 'text', text: t, ...(marks && { marks }) });
const para = (...content) => ({ type: 'paragraph', content });
const doc = (...content) => ({ type: 'doc', content });
const link = (href, linktype = 'url') => ({ type: 'link', attrs: { href, linktype } });
const li = (...content) => ({ type: 'list_item', content });
const both = (value) => ({ uk: value, en: value });

// Повідомлення й шлях першої помилки української версії.
function issue(schema, value) {
  const result = schema.safeParse(both(value));
  assert.equal(result.success, false, `пропущено: ${JSON.stringify(value)}`);
  const first = result.error.issues.find((i) => i.path[0] === 'uk');
  return { message: first.message, path: first.path.join('.') };
}

const FULL = doc(
  { type: 'heading', attrs: { level: 3 }, content: [text('Підзаголовок')] },
  para(
    text('Жирний', [{ type: 'bold' }]), text(' курсив', [{ type: 'italic' }]), { type: 'hard_break' },
    text('сторінка', [link('/ministries/')]), text(' сайт', [link('https://example.test/')]),
    text(' пошта', [link('mailto:a@b.test', 'email')]), text(' файл', [link('uploads/cms/x.pdf', 'asset')]),
    text(' якір', [link('#contacts')]),
  ),
  { type: 'bullet_list', content: [li(para(text('пункт')), { type: 'ordered_list', attrs: { order: 2 }, content: [li(para(text('вкладений')))] })] },
);

test('основний текст приймає все дозволене', () => {
  const result = localizedRich.safeParse(both(FULL));
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
});

test('інлайн-текст: абзаци, жирний, курсив, посилання, перенос — так; список і підзаголовок — ні', () => {
  assert.equal(localizedRichInline.safeParse(both(doc(para(text('a', [{ type: 'bold' }]), { type: 'hard_break' }, text('b'))), para(text('c'))))).success, true);
  assert.match(issue(localizedRichInline, doc({ type: 'bullet_list', content: [li(para(text('a')))] })).message, /лише в основному тексті/);
  assert.match(issue(localizedRichInline, doc({ type: 'heading', attrs: { level: 3 }, content: [text('a')] })).message, /лише в основному тексті/);
});

test('непідтримувані елементи названо', () => {
  assert.match(issue(localizedRich, doc({ type: 'table', content: [] })).message, /таблиці/);
  assert.match(issue(localizedRich, doc({ type: 'blok', attrs: { body: [] } })).message, /вставлені блоки/);
  assert.match(issue(localizedRich, doc(para({ type: 'image', attrs: { src: 'x' } }))).message, /картинки/);
  assert.match(issue(localizedRich, doc(para(text('a', [{ type: 'underline' }])))).message, /лише жирний, курсив і посилання/);
  assert.match(issue(localizedRich, doc({ type: 'heading', attrs: { level: 2 }, content: [text('a')] })).message, /рівня 3/);
});

test('посилання: лише linkUrl; на історію Storyblok — з підказкою', () => {
  for (const href of ['javascript:alert(1)', '#', '//evil.test', 'index.html']) {
    const found = issue(localizedRich, doc(para(text('a', [link(href)]))));
    assert.match(found.message, /посилання/, href);
    assert.equal(found.path, 'uk.content.0.content.0.marks.0.attrs.href', href);
  }
  assert.match(issue(localizedRich, doc(para(text('a', [link('/ministries/youth', 'story')])))).message, /вкажіть адресу вручну/);
});

test('зайве поле (ненормалізований документ) — помилка з назвою поля', () => {
  const found = issue(localizedRich, doc({ type: 'paragraph', attrs: { textAlign: null }, content: [text('a')] }));
  // attrs в абзаці не буває: textAlign дописує редактор, прибирає normalizeDoc.
  assert.match(found.message, /зайве поле «attrs»/);
  assert.equal(found.path, 'uk.content.0.attrs');
});

test('порожньо — як для простого тексту: порожній документ, пробіли, рядок, відсутність', () => {
  for (const value of [doc(), doc(para(text('   '))), '', undefined]) {
    assert.match(issue(localizedRich, value).message, /порожн|обовʼязков/, JSON.stringify(value));
  }
  const result = localizedRich.safeParse({ uk: docFromText('Текст') });
  assert.ok(result.error.issues.some((i) => i.path.join('.') === 'en'), 'немає помилки про en');
});

test('рядок старої моделі — не документ', () => {
  assert.match(issue(localizedRich, 'Старий текст').message, /форматований текст/);
});
```

У `tests/lib.test.js` додати (і `pickRich`, `pickPlain` в імпорт з `../src/lib/i18n.mjs` — подивіться, звідки файл уже імпортує `pick`, і додайте туди ж; `docFromText` — з `../src/lib/richtext.mjs`):

```js
test('pickRich / pickPlain: документ мови, без фолбеку на іншу', () => {
  const pair = { uk: docFromText('Перший.\n\nДругий.'), en: docFromText('First.') };
  assert.deepEqual(pickRich(pair, 'en'), pair.en);
  assert.equal(pickPlain(pair, 'uk'), 'Перший.\n\nДругий.');
  assert.throws(() => pickRich({ uk: pair.uk, en: '' }, 'en'), /немає перекладу «en»/);
  assert.throws(() => pickRich({ uk: 'рядок', en: 'string' }, 'uk'), /немає перекладу «uk»/);
});
```

- [ ] **Step 2: Переконатися, що тести падають**

Run: `node --test tests/richtext-schema.test.js tests/lib.test.js`
Expected: FAIL — `localizedRich` / `pickRich` не експортуються.

- [ ] **Step 3: Реалізація**

`src/lib/schema.mjs` — імпорт на початку файлу:

```js
import { isDoc, richPlain } from './richtext.mjs';
```

Одразу після `localizedHtml`:

```js
// Форматований текст (Спека 4) — документ редактора Storyblok. Бібліотека
// рендеру пропускає javascript: у href і мовчки рендерить дітей невідомих
// вузлів, тож межа безпеки — тут: лише перелічені вузли, марки й атрибути.
// Один обхід замість рекурсивних z.object: він знає, *чому* вузол
// заборонений, і каже це редактору, а не «Invalid input» по кожній гілці.
// block — основні тексти; inline — усе, що шаблон ставить у <p> чи <h2>.
const RICH_BLOCKS = {
  block: ['paragraph', 'heading', 'bullet_list', 'ordered_list'],
  list: ['paragraph', 'bullet_list', 'ordered_list'],
  inline: ['paragraph'],
};
const BLOCK_ONLY = ['heading', 'bullet_list', 'ordered_list'];
const UNSUPPORTED = {
  table: 'таблиці', image: 'картинки', blok: 'вставлені блоки', blockquote: 'цитати',
  code_block: 'блоки коду', horizontal_rule: 'розділювачі', emoji: 'емодзі',
};
const EMPTY_TEXT = 'текст не може бути порожнім або з самих пробілів';
const LINK_MESSAGE = 'посилання: https://…, mailto:…, tel:…, /сторінка/, uploads/файл або #якір';

function richIssues(value, level) {
  const issues = [];
  const add = (path, message) => issues.push({ path, message });
  const extraKeys = (node, path, allowed) => {
    for (const key of Object.keys(node)) if (!allowed.includes(key)) add([...path, key], `зайве поле «${key}»`);
  };
  const unsupported = (node, path, where) => {
    const type = node?.type;
    if (UNSUPPORTED[type]) add(path, `${UNSUPPORTED[type]} у цьому полі не підтримуються`);
    else if (where === 'inline' && BLOCK_ONLY.includes(type)) add(path, 'списки й підзаголовки дозволені лише в основному тексті');
    else add(path, `елемент «${type}» тут не підтримується`);
  };
  const marks = (list, path) => {
    if (!Array.isArray(list)) return add(path, 'marks: очікується список');
    list.forEach((mark, i) => {
      const at = [...path, i];
      if (mark?.type === 'bold' || mark?.type === 'italic') return extraKeys(mark, at, ['type']);
      if (mark?.type !== 'link') return add(at, `оформлення «${mark?.type}» не підтримується: лише жирний, курсив і посилання`);
      extraKeys(mark, at, ['type', 'attrs']);
      const { href, linktype, ...rest } = mark.attrs ?? {};
      for (const key of Object.keys(rest)) add([...at, 'attrs', key], `зайве поле «${key}»`);
      // Storyblok кешує href посилання на історію і не оновлює його, коли
      // історію перейменовують.
      if (linktype === 'story') return add([...at, 'attrs', 'href'], 'посилання на історію Storyblok не підтримуються: вкажіть адресу вручну, напр. /ministries/youth/');
      if (!['url', 'email', 'asset'].includes(linktype)) add([...at, 'attrs', 'linktype'], `невідомий тип посилання «${linktype}»`);
      if (!linkUrl.safeParse(href).success) add([...at, 'attrs', 'href'], `${LINK_MESSAGE} (зараз «${href}»)`);
    });
  };
  const inline = (nodes, path) => {
    if (nodes === undefined) return;
    if (!Array.isArray(nodes)) return add(path, 'content: очікується список');
    nodes.forEach((node, i) => {
      const at = [...path, i];
      if (node?.type === 'hard_break') return extraKeys(node, at, ['type']);
      if (node?.type !== 'text') return unsupported(node, at, 'text');
      extraKeys(node, at, ['type', 'text', 'marks']);
      if (typeof node.text !== 'string' || node.text === '') add([...at, 'text'], 'порожній фрагмент тексту');
      if (node.marks !== undefined) marks(node.marks, [...at, 'marks']);
    });
  };
  const blocks = (nodes, path, where) => {
    if (!Array.isArray(nodes)) return add(path, 'content: очікується список');
    nodes.forEach((node, i) => {
      const at = [...path, i];
      if (!RICH_BLOCKS[where].includes(node?.type)) return unsupported(node, at, where);
      if (node.type === 'paragraph') {
        extraKeys(node, at, ['type', 'content']);
        return inline(node.content, [...at, 'content']);
      }
      if (node.type === 'heading') {
        extraKeys(node, at, ['type', 'attrs', 'content']);
        if (node.attrs?.level !== 3 || Object.keys(node.attrs).length !== 1) add([...at, 'attrs'], 'підзаголовок: лише рівня 3 (H3)');
        return inline(node.content, [...at, 'content']);
      }
      extraKeys(node, at, node.type === 'ordered_list' ? ['type', 'attrs', 'content'] : ['type', 'content']);
      if (node.attrs !== undefined) {
        const { order, ...rest } = node.attrs;
        for (const key of Object.keys(rest)) add([...at, 'attrs', key], `зайве поле «${key}»`);
        if (!Number.isInteger(order) || order < 1) add([...at, 'attrs', 'order'], 'нумерація списку: ціле число від 1');
      }
      if (!Array.isArray(node.content) || node.content.length === 0) return add([...at, 'content'], 'порожній список');
      node.content.forEach((item, j) => {
        const itemAt = [...at, 'content', j];
        if (item?.type !== 'list_item') return add(itemAt, 'у списку — лише пункти');
        extraKeys(item, itemAt, ['type', 'content']);
        blocks(item.content ?? [], [...itemAt, 'content'], 'list');
      });
    });
  };

  if (value === undefined) add([], 'поле обовʼязкове');
  else if (typeof value === 'string' && value.trim() === '') add([], EMPTY_TEXT);
  else if (!isDoc(value)) add([], 'очікується форматований текст (документ редактора Storyblok)');
  else {
    extraKeys(value, [], ['type', 'content']);
    blocks(value.content ?? [], ['content'], level);
    if (issues.length === 0 && richPlain(value).trim() === '') add([], EMPTY_TEXT);
  }
  return issues;
}

const richDoc = (level) => z.any().superRefine((value, ctx) => {
  for (const { path, message } of richIssues(value, level)) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
});

// Модель Storyblok і checkModel упізнають ці пари за тотожністю, як localized.
export const localizedRich = z.object({ uk: richDoc('block'), en: richDoc('block') }).strict();
export const localizedRichInline = z.object({ uk: richDoc('inline'), en: richDoc('inline') }).strict();
```

`src/lib/i18n.mjs` — імпорт на початку й дві функції після `pick`:

```js
import { isDoc, richPlain } from './richtext.mjs';
```

```js
// Форматований текст (Спека 4): той самий принцип, що в pick, — порожня чи
// неперекладена мова валить збірку, а не показує іншу.
export function pickRich(pair, lang) {
  const value = pair?.[lang];
  if (!isDoc(value)) throw new Error(`немає перекладу «${lang}» у ${JSON.stringify(pair)?.slice(0, 200)}`);
  return value;
}

// Простий текст форматованого поля: мета-опис, JSON-LD.
export const pickPlain = (pair, lang) => richPlain(pickRich(pair, lang));
```

`src/i18n/index.ts` — рядок реекспорту:

```ts
export { pick, pickPlain, pickRich } from '../lib/i18n.mjs';
```

- [ ] **Step 4: Тести проходять**

Run: `node --test tests/richtext-schema.test.js tests/lib.test.js`
Expected: PASS.
Run: `npm test`
Expected: PASS (нові пари ще ніде не використані).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.mjs src/lib/i18n.mjs src/i18n/index.ts tests/richtext-schema.test.js tests/lib.test.js
git commit -m "feat: схема форматованого тексту — allowlist вузлів, марок і адрес

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 4: рендер і `Rich.astro`

**Files:**
- Modify: `package.json`, `package-lock.json` (залежність)
- Create: `src/lib/richtext-render.mjs`
- Create: `src/components/Rich.astro`
- Modify: `src/styles/base.css` (у кінець)
- Test: `tests/richtext-render.test.js`

**Interfaces:**
- Consumes: `linkHref`, `isExternal` (`src/lib/paths.mjs`), `pickRich` (Задача 3), `docFromText` (Задача 2).
- Produces: `renderRich(doc, { base: string, lang: 'uk'|'en', inline?: boolean }): string` (`src/lib/richtext-render.mjs`). Компонент `<Rich value={pair} lang={lang} inline? />` (`src/components/Rich.astro`). Класи в HTML: `rt-link` (посилання), `rt-list` (`ul`/`ol`), `rt-h` (`h3`).

- [ ] **Step 1: Встановити залежність і написати падаючі тести**

```bash
npm install @storyblok/richtext@^5.3.2
```

`tests/richtext-render.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderRich } from '../src/lib/richtext-render.mjs';
import { docFromText } from '../src/lib/richtext.mjs';

const text = (t, marks) => ({ type: 'text', text: t, ...(marks && { marks }) });
const para = (...content) => ({ type: 'paragraph', ...(content.length > 0 && { content }) });
const doc = (...content) => ({ type: 'doc', content });
const link = (href, linktype = 'url') => ({ type: 'link', attrs: { href, linktype } });
const uk = { base: '/', lang: 'uk' };

test('текст екранується так само, як в Astro (апостроф — &#39;)', () => {
  assert.equal(renderRich(docFromText(`<script>x</script> & "q" it's`), uk), '<p>&lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot; it&#39;s</p>');
});

test('абзаци, жирний, курсив, перенос; порожні абзаци не рендеряться', () => {
  const html = renderRich(doc(para(text('a', [{ type: 'bold' }]), { type: 'hard_break' }, text('b', [{ type: 'italic' }])), para(), para(text('c'))), uk);
  assert.equal(html, '<p><strong>a</strong><br><em>b</em></p><p>c</p>');
});

test('посилання: сторінка — з мовою й base, чужий сайт — у новій вкладці, адреса екранується', () => {
  const html = (href, opts) => renderRich(doc(para(text('x', [link(href)]))), opts);
  assert.equal(html('/ministries/', { base: '/sub/', lang: 'en' }), '<p><a class="rt-link" href="/sub/en/ministries/">x</a></p>');
  assert.equal(html('https://example.test/?a="b"&c', uk), '<p><a class="rt-link" href="https://example.test/?a=&quot;b&quot;&amp;c" target="_blank" rel="noopener noreferrer">x</a></p>');
  assert.equal(html('mailto:a@b.test', uk), '<p><a class="rt-link" href="mailto:a@b.test">x</a></p>');
  assert.equal(html('uploads/cms/f.pdf', { base: '/sub/', lang: 'uk' }), '<p><a class="rt-link" href="/sub/uploads/cms/f.pdf">x</a></p>');
});

test('підзаголовок і списки — з класами rt-h / rt-list, нумерація з order', () => {
  const li = (t) => ({ type: 'list_item', content: [para(text(t))] });
  const html = renderRich(doc(
    { type: 'heading', attrs: { level: 3 }, content: [text('H')] },
    { type: 'bullet_list', content: [li('a')] },
    { type: 'ordered_list', attrs: { order: 3 }, content: [li('b')] },
    { type: 'ordered_list', content: [li('c')] },
  ), uk);
  assert.equal(html, '<h3 class="rt-h">H</h3><ul class="rt-list"><li><p>a</p></li></ul><ol class="rt-list" start="3"><li><p>b</p></li></ol><ol class="rt-list"><li><p>c</p></li></ol>');
});

test('inline: абзаци через <br>, без <p> — поле стоїть у шаблоні всередині <p>/<h2>', () => {
  assert.equal(renderRich(docFromText('Перший\n\nДругий'), { ...uk, inline: true }), 'Перший<br>Другий');
  assert.equal(renderRich(doc(para(), para(text('a')), para()), { ...uk, inline: true }), 'a');
});

test('renderRich і set:html для форматованого тексту — лише в Rich.astro', () => {
  const astroFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const abs = join(dir, e.name);
    return e.isDirectory() ? astroFiles(abs) : abs.endsWith('.astro') ? [abs] : [];
  });
  for (const file of astroFiles('src')) {
    if (file.endsWith(join('components', 'Rich.astro'))) continue;
    assert.doesNotMatch(readFileSync(file, 'utf8'), /richtext-render|pickRich/, `${file}: форматований текст — лише через <Rich>`);
  }
});
```

- [ ] **Step 2: Переконатися, що тести падають**

Run: `node --test tests/richtext-render.test.js`
Expected: FAIL — `Cannot find module '../src/lib/richtext-render.mjs'`.

- [ ] **Step 3: Реалізація**

`src/lib/richtext-render.mjs`:

```js
import { renderRichText } from '@storyblok/richtext';
import { isExternal, linkHref } from './paths.mjs';

// Рендер форматованого тексту (Спека 4). Безпеку дає схема: сюди доходять
// лише дозволені вузли й адреси (richIssues у schema.mjs). Бібліотека
// екранує текст, а атрибути в свої рендерери передає як є — їх екрануємо тут.
const attr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Astro екранує апостроф як &#39;, бібліотека — як &#039;. Символ той самий,
// але diff-dirs порівнює байти: однаковий запис доводить, що перехід на
// richtext не змінив жодної сторінки.
const astroEscapes = (html) => html.replaceAll('&#039;', '&#39;');

function renderers(base, lang) {
  return {
    link: ({ attrs, children }) => {
      const blank = isExternal(attrs.href) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a class="rt-link" href="${attr(linkHref(base, lang, attrs.href))}"${blank}>${children}</a>`;
    },
    // Порожній абзац — слід Enter у редакторі, на сторінці він лише відступ.
    paragraph: ({ children }) => (children ? `<p>${children}</p>` : ''),
    heading: ({ attrs, children }) => `<h${attrs.level} class="rt-h">${children}</h${attrs.level}>`,
    bullet_list: ({ children }) => `<ul class="rt-list">${children}</ul>`,
    ordered_list: ({ attrs, children }) => `<ol class="rt-list"${attrs?.order > 1 ? ` start="${attrs.order}"` : ''}>${children}</ol>`,
  };
}

export function renderRich(doc, { base, lang, inline = false }) {
  const options = { renderers: renderers(base, lang) };
  if (!inline) return astroEscapes(renderRichText(doc, options));
  // Інлайн-поле стоїть у шаблоні всередині <p> чи <h2>: абзац у абзаці —
  // невалідна розмітка, тож абзаци — через <br>, без обгорток.
  return astroEscapes(doc.content
    .map((p) => renderRichText({ type: 'doc', content: p.content ?? [] }, options))
    .filter(Boolean)
    .join('<br>'));
}
```

`src/components/Rich.astro`:

```astro
---
// Єдине місце, де форматований текст потрапляє в set:html (Спека 4, тест у
// tests/richtext-render.test.js). Безпеку дає схема, екранування — рендер.
import { pickRich } from '../lib/i18n.mjs';
import { renderRich } from '../lib/richtext-render.mjs';

interface Props {
  value: { uk: unknown; en: unknown };
  lang: 'uk' | 'en';
  inline?: boolean;
}

const { value, lang, inline = false } = Astro.props;
const html = renderRich(pickRich(value, lang), { base: import.meta.env.BASE_URL, lang, inline });
---
<Fragment set:html={html} />
```

`src/styles/base.css` — у кінець файлу:

```css
/* Форматований текст (Спека 4). Класи ставить рендер (richtext-render.mjs),
   тож правила не залежать від сторінки; абзаци, як і раніше, стилізує
   сторінка. Посилання — кольором тексту навколо: читається і на темному
   першому екрані, і на світлих секціях. */
.rt-link{color:inherit;text-decoration:underline;text-underline-offset:.15em}
.rt-link:hover{color:inherit;opacity:.8}
.rt-list{margin:0 0 1.2rem;padding-left:1.4rem}
.rt-list li{margin:.35rem 0}
.rt-list li p{margin:0}
.rt-list .rt-list{margin:.35rem 0 0}
.rt-h{font-family:var(--font-display);font-weight:700;font-size:1.3rem;line-height:1.3;margin:1.6rem 0 .6rem;color:var(--ink-blue)}
```

- [ ] **Step 4: Тести проходять, вихід не змінився**

Run: `node --test tests/richtext-render.test.js`
Expected: PASS (6 тестів).
Run: `npm test`
Expected: PASS.
Run: `node scripts/lib/diff-dirs.mjs dist-before dist`
Expected: рівно одна відмінність — CSS-файл, у який збирається `base.css` (`_astro/*.css`; назва з хешем може відрізнятися, тоді це «є лише в …» для старої й нової назви). HTML — без змін, крім посилання на новий хеш CSS, якщо Astro його змінив. Жодних інших відмінностей.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/richtext-render.mjs src/components/Rich.astro src/styles/base.css tests/richtext-render.test.js
git commit -m "feat: рендер форматованого тексту — @storyblok/richtext і Rich.astro

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> Від цієї задачі еталон для `diff-dirs` — не `dist-before`, а збірка **після** Задачі 4 (CSS уже інший). Перед Задачею 5: `npx astro build --outDir dist-t4` і `dist-t4/` у `.gitignore`.

---

## Задача 5: наскрізно одне поле — `ministries.summary`

Ця задача проводить одне інлайн-поле через увесь ланцюжок: модель, звірку, компоненти, конвертацію, міграцію, шаблони, SEO й тести. Задачі 6–7 лише розширюють список полів.

**Files:**
- Modify: `src/lib/storyblok/model.mjs` (будівники після `html`, рядок ~17; `ministry.summary`)
- Modify: `src/lib/storyblok/check.mjs` (`unwrap`, `compareField`)
- Modify: `src/lib/storyblok/components.mjs` (`scalar`)
- Modify: `src/lib/storyblok/convert.mjs` (`writeScalar`, `readScalar`)
- Create: `src/lib/storyblok/walk.mjs`
- Create: `scripts/migrate-richtext.mjs`
- Modify: `src/lib/schema.mjs` (`ministries.summary`)
- Modify: `src/content/ministries/*.json` (скриптом)
- Modify: `src/pages/[...lang]/ministries/index.astro:55`, `src/pages/[...lang]/ministries/[slug].astro:41,64`, `src/pages/[...lang]/index.astro:246`
- Modify: `tests/helpers/content.js`, `tests/helpers/probes.js`
- Test: `tests/cms-model.test.js`, `tests/cms-components.test.js`, `tests/cms-convert.test.js`, `tests/cms-import.test.js`, `tests/cms-verify.test.js`, `tests/content-schema.test.js`, `tests/page-ministries.test.js`, `tests/seo.test.js`

**Interfaces:**
- Consumes: `localizedRichInline`, `localizedRich` (Задача 3), `normalizeDoc`, `isDoc`, `isEmptyDoc`, `docFromText` (Задача 2), `Rich.astro` (Задача 4), `pickPlain` (Задача 3).
- Produces:
  - `model.mjs`: `export const TOOLBAR = { block: [...], inline: [...] }`; будівники `rich(label, opts)` → `{ kind: 'pair', item: 'richtext', level: 'block', label, ...opts }` і `richInline(label, opts)` → те саме з `level: 'inline'` (не експортуються).
  - `walk.mjs`: `mapRichPairs(collection: string, data: object, fn: (pair, field) => pair): object` — нова копія запису, `fn` викликається для кожної непорожньої пари з `field.item === 'richtext'`.
  - `tests/helpers/content.js`: `domText(value): string` — текст поля так, як його дає `node-html-parser` `.text` (для документа — усі `text` підряд, для рядка — сам рядок); `textOf(value): string` — `richPlain` для документа, рядок як є.
  - `tests/helpers/probes.js`: `export const rich = (uk, en = uk) => ({ uk: docFromText(uk), en: docFromText(en) })`.

- [ ] **Step 1: Написати падаючі тести**

`tests/cms-model.test.js` — додати `localizedRich, localizedRichInline` в імпорт зі схеми й тест:

```js
test('форматований текст: пара richtext того самого рівня, інакше — помилка', () => {
  assertError(errorsFor('ministries', schemas.ministries.extend({ summary: localized })), '.summary');
  assertError(errorsFor('ministries', schemas.ministries.extend({ summary: localizedRich })), '.summary');
  assertError(errorsFor('ministries', schemas.ministries.extend({ name: localizedRichInline })), '.name');
});
```

`tests/cms-components.test.js` — у тесті `пара uk/en — два поля з підписами` замінити рядок `assert.equal(ministry.summary_uk.type, 'textarea');` на:

```js
  assert.equal(byName.get('seo').schema.metaDescription_uk.type, 'textarea');
```

і додати тест (`TOOLBAR` — в імпорт з `model.mjs`):

```js
test('форматоване поле — richtext з панеллю рівно з дозволених кнопок', () => {
  const summary = byName.get('ministry').schema.summary_uk;
  assert.equal(summary.type, 'richtext');
  assert.equal(summary.customize_toolbar, true);
  assert.deepEqual(summary.toolbar, TOOLBAR.inline);
});
```

`tests/cms-convert.test.js` — додати тести:

```js
test('richtext: документ з редактора Storyblok нормалізується, туди-й-назад — без змін (Review Focus 1)', () => {
  const story = toStory('ministries', 'm', ministry('m'), { asset });
  story.content.summary_uk = {
    type: 'doc',
    content: [
      { type: 'paragraph', attrs: { textAlign: null }, content: [
        { type: 'text', text: 'Жирний', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' і ' },
        { type: 'text', text: 'пошта', marks: [{ type: 'link', attrs: { href: 'a@b.test', uuid: null, anchor: null, target: '_self', linktype: 'email', custom: {} } }] },
      ] },
      { type: 'paragraph', attrs: { textAlign: null } },
    ],
  };
  const data = fromStory('ministries', story);
  assert.deepEqual(data.summary.uk, {
    type: 'doc',
    content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Жирний', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' і ' },
      { type: 'text', text: 'пошта', marks: [{ type: 'link', attrs: { href: 'mailto:a@b.test', linktype: 'email' } }] },
    ] }],
  });
  const result = schemas.ministries.safeParse(data);
  assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  assert.deepEqual(roundTrip('ministries', 'm', data), data);
});

test('richtext: очищене поле (\'\' чи самі порожні абзаци) — «немає», обовʼязкове валить схему з назвою мови (Review Focus 3)', () => {
  for (const empty of ['', { type: 'doc', content: [{ type: 'paragraph' }, { type: 'paragraph', attrs: { textAlign: null } }] }]) {
    const story = toStory('ministries', 'm', ministry('m'), { asset });
    story.content.summary_en = empty;
    const data = fromStory('ministries', story);
    assert.equal(data.summary.en, '');
    const result = schemas.ministries.safeParse(data);
    assert.ok(result.error.issues.some((i) => i.path.join('.') === 'summary.en'), JSON.stringify(empty));
  }
});

test('richtext: рядок старої моделі (textarea) читається як документ — тим самим docFromText, що й міграція (рішення 13)', () => {
  const story = toStory('ministries', 'm', ministry('m'), { asset });
  story.content.summary_uk = 'Перший абзац.\n\nДругий.';
  story.content.summary_en = '   ';
  const data = fromStory('ministries', story);
  assert.deepEqual(data.summary.uk, docFromText('Перший абзац.\n\nДругий.'));
  assert.equal(data.summary.en, '');
});

test('richtext: історія зі старими рядками після міграції файлів — «оновити», а не конфлікт (рішення 13)', () => {
  // Та сама перевірка, що в makePlan: дані історії = дані файлу, відбиток — старий.
  const data = ministry('m');
  const story = toStory('ministries', 'm', data, { asset });
  story.content.summary_uk = 'Коротко';
  story.content.summary_en = 'Коротко';
  story.content[FINGERPRINT_FIELD] = 'відбиток, записаний до міграції';
  assert.equal(fingerprint(fromStory('ministries', story, { assetPath })), toStory('ministries', 'm', data, { asset }).content[FINGERPRINT_FIELD]);
});
```

У тесті `неперекладене поле не підміняється українським — схема падає` нічого не змінювати: `summary_en = ''` і далі дає `''` (тепер через гілку `richtext`).

- [ ] **Step 2: Переконатися, що тести падають**

Run: `node --test tests/cms-model.test.js tests/cms-components.test.js tests/cms-convert.test.js`
Expected: FAIL — `TOOLBAR` не експортується; `summary_uk.type` — `textarea`; `summary.uk` — рядок.

У `tests/cms-convert.test.js` до імпортів додати `docFromText` з `../src/lib/richtext.mjs` і `ministry` з `./helpers/probes.js`, якщо його там ще немає (`fingerprint`, `FINGERPRINT_FIELD` уже імпортовані).

- [ ] **Step 3: Модель, звірка, компоненти, конвертація**

`src/lib/storyblok/model.mjs` — після рядка `const html = …`:

```js
// Форматований текст (Спека 4): пара полів richtext. block — основні тексти
// (списки, підзаголовки); inline — усе, що шаблон ставить у <p> чи <h2>.
// Панель редактора — рівно з того, що пропускає схема (richIssues).
export const TOOLBAR = {
  block: ['bold', 'italic', 'link', 'paragraph', 'h3', 'list', 'olist'],
  inline: ['bold', 'italic', 'link'],
};
const rich = (label, opts = {}) => ({ kind: 'pair', item: 'richtext', level: 'block', label, ...opts });
const richInline = (label, opts = {}) => ({ kind: 'pair', item: 'richtext', level: 'inline', label, ...opts });
```

У `ministry.fields`: `summary: long('Коротко'),` → `summary: richInline('Коротко'),`.

`src/lib/storyblok/check.mjs`:
- імпорт: `import { localized, localizedHtml, localizedRich, localizedRichInline, schemas as SCHEMAS } from '../schema.mjs';`
- після імпортів:

```js
// Форматовані пари модель упізнає за тотожністю, як localized, і звіряє рівень.
const RICH_LEVEL = new Map([[localizedRich, 'block'], [localizedRichInline, 'inline']]);
```

- у `unwrap`: `if (s === localized || s === localizedHtml) break;` → `if (s === localized || s === localizedHtml || RICH_LEVEL.has(s)) break;`
- у `compareField`: `const isText = s === localized || s === localizedHtml;` → `const isText = s === localized || s === localizedHtml || RICH_LEVEL.has(s);`, а гілку `if (isText) { … }` усередині `if (field.kind === 'pair')` замінити на:

```js
    if (isText) {
      if ((s === localizedHtml) !== Boolean(field.markup)) errors.push(`${path}: розмітка (localizedHtml) у схемі й моделі не збігається`);
      const level = RICH_LEVEL.get(s);
      if (level || field.item === 'richtext') {
        if (field.item !== 'richtext' || field.level !== level) {
          errors.push(`${path}: у схемі ${level ? `форматований текст (${level})` : 'простий текст'}, у моделі ${field.item}${field.level ? ` (${field.level})` : ''}`);
        }
        return;
      }
      if (!['text', 'textarea'].includes(field.item)) errors.push(`${path}: текстова пара в моделі має тип ${field.item}`);
      return;
    }
```

`src/lib/storyblok/components.mjs` — імпорт `TOOLBAR` з `./model.mjs`; у `scalar` перед `default:`:

```js
    case 'richtext':
      return { type: 'richtext', ...base, customize_toolbar: true, toolbar: TOOLBAR[field.level] };
```

`src/lib/storyblok/convert.mjs` — імпорт `import { docFromText, isDoc, isEmptyDoc, normalizeDoc } from '../richtext.mjs';`.
У `writeScalar` перед `default:`:

```js
    case 'richtext': return isDoc(value) ? value : '';
```

У `readScalar` перед `default:`:

```js
    case 'richtext': {
      // Рядок — поле старої моделі (textarea) в історії, яку ще не
      // переімпортовано: читаємо так само, як міграція файлів. Тоді cms:pull
      // працює і до імпорту, а імпорт бачить ті самі дані й лише оновлює
      // історію, без --force (рішення 13 плану Спеки 4).
      if (value == null) return '';
      if (typeof value === 'string') return value.trim() ? docFromText(value) : '';
      // Порожнє поле Storyblok віддає і як '', і як документ із самих
      // порожніх абзаців — для схеми це однаково «немає».
      const doc = normalizeDoc(value);
      return isEmptyDoc(doc) ? '' : doc;
    }
```

- [ ] **Step 4: Схема, обхід за моделлю, міграція контенту**

`src/lib/schema.mjs`, `ministries`: `summary: localized,` → `summary: localizedRichInline,`.

`src/lib/storyblok/walk.mjs`:

```js
import { COLLECTIONS, COMPONENTS } from './model.mjs';

// Обхід запису за моделлю: fn отримує кожну пару {uk, en} поля richtext і
// повертає нову. Які поля форматовані, знає лише модель, а потрібно це і
// міграції контенту (Спека 4), і пробі «повне форматування в кожному полі».
const variant = (names, data) => names.find((name) =>
  Object.entries(COMPONENTS[name].fixed ?? {}).every(([key, value]) => data?.[key] === value)) ?? names[0];

function mapBlok(name, data, fn) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return data;
  const out = { ...data };
  for (const [key, field] of Object.entries(COMPONENTS[name].fields)) {
    const value = out[key];
    if (value == null) continue;
    if (field.kind === 'pair' && field.item === 'richtext') out[key] = fn(value, field);
    else if (field.kind === 'group') out[key] = mapBlok(field.component, value, fn);
    else if (field.kind === 'list' && Array.isArray(value)) {
      out[key] = value.map((item) => (field.unwrap
        ? mapBlok(field.components[0], { [field.unwrap]: item }, fn)[field.unwrap]
        : mapBlok(variant(field.components, item), item, fn)));
    }
  }
  return out;
}

export const mapRichPairs = (collection, data, fn) => mapBlok(variant(COLLECTIONS[collection].variants, data), data, fn);
```

`scripts/migrate-richtext.mjs`:

```js
import { readContent, writeContent } from './cms/content.mjs';
import { docFromText } from '../src/lib/richtext.mjs';
import { mapRichPairs } from '../src/lib/storyblok/walk.mjs';

// Одноразова міграція Спеки 4: рядки полів, які модель оголосила richtext,
// стають документами. Ідемпотентна — Задачі 6–8 перезапускають її після
// розширення моделі. Видаляється в Задачі 10.
// node scripts/migrate-richtext.mjs [тека контенту, типово src/content]
const dir = process.argv[2] ?? 'src/content';
const toDoc = (pair) => Object.fromEntries(Object.entries(pair).map(([lang, v]) => [lang, typeof v === 'string' ? docFromText(v) : v]));
const entries = readContent(dir).map((e) => ({ ...e, data: mapRichPairs(e.collection, e.data, toDoc) }));
writeContent(dir, entries);
console.log(`Записів: ${entries.length}.`);
```

Run: `npm run cms:pull` — **лише якщо** в `.env` є `STORYBLOK_PUBLIC_TOKEN` і користувач погодив (правки редактора потрапляють у файли; якщо `git status` після нього показує зміни, закомітити їх окремим комітом `content: знімок Storyblok перед міграцією richtext` і сказати користувачу). Без токена — пропустити, сід-контент у репозиторії і є джерелом.
Run: `node scripts/migrate-richtext.mjs`
Expected: `Записів: N.`; `git diff --stat src/content` — змінені лише `src/content/ministries/*.json`, у кожному — лише `summary`.

- [ ] **Step 5: Шаблони**

`src/pages/[...lang]/ministries/index.astro`: імпорт `import Rich from '../../../components/Rich.astro';` (перевірте відносний шлях за наявним імпортом компонентів у файлі); рядок `<p>{pick(m.summary, lang)}</p>` →

```astro
            <p><Rich value={m.summary} lang={lang} inline /></p>
```

`src/pages/[...lang]/ministries/[slug].astro`: імпорт `Rich` і `pickPlain` (з того ж модуля, звідки файл імпортує `pick`); `description={pick(m.summary, lang)}` → `description={pickPlain(m.summary, lang)}`; `<h2>{pick(m.summary, lang)}</h2>` →

```astro
        <h2><Rich value={m.summary} lang={lang} inline /></h2>
```

`src/pages/[...lang]/index.astro`: імпорт `import Rich from '../../components/Rich.astro';`; у картці служіння `<p>{p(m.summary)}</p>` →

```astro
          <div class="min-body"><h3>{p(m.name)}</h3><p><Rich value={m.summary} lang={lang} inline /></p></div>
```

Перевірити, що `summary` більше ніде не йде в `pick`: `grep -rn "summary" src --include=*.astro` — усі входження через `Rich` або `pickPlain`.

- [ ] **Step 6: Хелпери й тести, що читають поле як рядок**

`tests/helpers/content.js` — імпорт `import { isDoc, richPlain } from '../../src/lib/richtext.mjs';` і в кінець:

```js
// Текст поля так, як його дає node-html-parser (.text): для документа —
// усі текстові вузли підряд (між <p> і на місці <br> .text нічого не
// додає), для простого тексту — сам рядок.
const collect = (node) => (node?.type === 'text' ? node.text : (node?.content ?? []).map(collect).join(''));
export const domText = (value) => (isDoc(value) ? collect(value) : value);

// Простий текст поля — як його бачать мета-опис і JSON-LD.
export const textOf = (value) => (isDoc(value) ? richPlain(value) : value);
```

У `localizedPairs` умову `if (typeof value.uk === 'string' && 'en' in value)` → `if ((typeof value.uk === 'string' || isDoc(value.uk)) && 'en' in value)` — інакше перевірка повноти перекладу мовчки оминала б форматовані поля.

`tests/helpers/probes.js` — імпорт `import { docFromText } from '../../src/lib/richtext.mjs';`, після `pair`:

```js
// Форматований текст (Спека 4) — документ з простого рядка.
export const rich = (uk, en = uk) => ({ uk: docFromText(uk), en: docFromText(en) });
```

У `ministry`: `summary: pair('Коротко')` → `summary: rich('Коротко')`.

Оновити тести, що читають `summary` як рядок:
- `tests/page-ministries.test.js`: імпорт `domText` з `./helpers/content.js`; рядок 23 → `assert.equal(card.querySelector('.min-body p').text, domText(ministries[i].summary[lang]));`; рядок 51 → `assert.equal(root.querySelector('.info h2').text, domText(m.summary[lang]));`.
- `tests/seo.test.js`: імпорт `textOf`; у тесті «деталки…» `truncate(data[textKey][lang])` → `truncate(textOf(data[textKey][lang]))`.
- `tests/cms-import.test.js:123`: правка тепер — у простому полі: `fixture.write('ministries', 'probe', { ...data, name: { ...data.name, en: `${data.name.en} (edited)` } });`.
- `tests/cms-verify.test.js:35-41`: `content.summary_en = 'Інший текст'` → `content.name_en = 'Інший текст'`; `summary.en:` → `name.en:`; `target.data.summary.en` → `target.data.name.en`.
- `tests/content-schema.test.js:124-127`: правило «розмітка в простому тексті» перевіряти на полі, що лишилося простим: `ministry('probe', { name: { uk: 'Дуже <b>важливо</b>', en: 'Important' } })`, коментар — «Шаблон виводить назву як простий текст».

Потім знайти решту місць, де тести читають `summary` як рядок:

```bash
grep -rnE "summary(\?)?(\.|\[)(uk|en|lang)" tests
```

Кожне входження, яке порівнює з DOM, обгорнути в `domText(…)`, з текстом мета-опису — в `textOf(…)`.

- [ ] **Step 7: Тести проходять, вихід не змінився**

Run: `npm test`
Expected: PASS.
Run: `node scripts/lib/diff-dirs.mjs dist-t4 dist`
Expected: `Збірки однакові.` Будь-яка відмінність — дефект (найімовірніше екранування чи пробіл навколо `<Rich>`): знайти причину, а не оновлювати еталон.

- [ ] **Step 8: Commit**

```bash
git add src/lib src/components scripts/migrate-richtext.mjs src/content/ministries src/pages tests
git commit -m "feat: ministries.summary — форматований текст у Storyblok і на сайті

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 6: решта інлайн-полів

**Files:**
- Modify: `src/lib/schema.mjs`, `src/lib/storyblok/model.mjs`
- Modify: `src/content/**` (скриптом)
- Modify: `src/lib/seo.mjs:36-39`, `src/components/Seo.astro:36`, `src/components/SiteFooter.astro:37`
- Modify: `src/pages/[...lang]/{index,leaders,pastors,testimonies}.astro`, `src/pages/[...lang]/{churches,projects,ministries}/index.astro`, `src/pages/[...lang]/{churches,projects}/[slug].astro`
- Modify: `tests/helpers/probes.js`
- Test: `tests/cms-convert.test.js`, `tests/lib-seo.test.js`, `tests/page-home.test.js`, `tests/seo.test.js` та інші за grep (крок 4)

**Interfaces:**
- Consumes: усе з Задачі 5.
- Produces: поля з таблиці нижче — `localizedRichInline` у схемі й `richInline(…)` у моделі.

| Схема (`src/lib/schema.mjs`) | Модель (`model.mjs`) | Шаблон |
|---|---|---|
| `churches.lead` | `church.lead` | `churches/index.astro:59` `<p>`; `churches/[slug].astro:54` `description` |
| `projects.lead` | `project.lead` | `projects/index.astro:56` `<p>`; `projects/[slug].astro:38` `description` |
| `leader-resources.description` | `resource_document.description`, `resource_link.description` | `leaders.astro:63`, `:86` `<p>` |
| `pages.lead` | `site_page.lead` (`{ optional: true }`) | `<p>` у `churches/index:38`, `ministries/index:39`, `projects/index:39`, `pastors:47`, `testimonies:48`, `leaders:46`; `seo.mjs` `pageDescription` |
| `pages.sections.past_lead`, `elders_lead` | `page_sections.past_lead`, `elders_lead` (`{ optional: true }`) | `pastors.astro:58`, `:85` `<p>` |
| `pages.help.desc` | `page_help.desc` | `leaders.astro:101`, `pastors.astro:102` `<p>` |
| `homepage.hero.vision` | `home_hero.vision` | `index.astro:96` усередині `<span style="font-weight: 700">` |
| `homepage.about.lead` | `home_about.lead` | `index.astro:132` `<p class="lead">`; `index.astro:77` `description`; `Seo.astro:36` `defaultDescription` |
| `homepage.beliefs[]` | `home_belief.text` | `index.astro:138` `<p>` |
| `homepage.news.lead`, `news.items[].text` | `home_news.lead`, `home_news_item.text` | `index.astro:149`, `:156` `<p>` |
| `homepage.fb.text` | `home_fb.text` | `index.astro:163` `<span>` |
| `homepage.wwb.items[].text` | `home_wwb_item.text` | `index.astro:190` `<p>` |
| `homepage.testimonies.items[].text` | `home_testimony.text` | `index.astro:205` `<p>` |
| `homepage.ministries.lead`, `pastors.lead` | `home_ministries.lead`, `home_pastors.lead` | `index.astro:237`, `:263` `<p class="lead">` |
| `homepage.donate.quote`, `donate.thanks` | `home_donate.quote`, `home_donate.thanks` | `index.astro:312` (текст перед `<cite>` у `<blockquote>`), `:316` `<p class="donate-thanks">` |
| `homepage.footer.about` | `home_footer.about` | `SiteFooter.astro:37` `<p>` |

- [ ] **Step 1: Написати падаючий тест**

`tests/cms-components.test.js`:

```js
test('кожне форматоване поле моделі — richtext зі своєю панеллю, решта textarea — лише мета-опис', () => {
  for (const [name, def] of Object.entries(COMPONENTS)) {
    const schema = byName.get(name).schema;
    for (const [key, field] of Object.entries(def.fields)) {
      if (field.kind !== 'pair') continue;
      for (const side of ['uk', 'en']) {
        const f = schema[`${key}_${side}`];
        if (field.item === 'richtext') assert.deepEqual([f.type, f.toolbar], ['richtext', TOOLBAR[field.level]], `${name}.${key}_${side}`);
        else if (f.type === 'textarea') assert.ok(field.markup || (name === 'seo' && key === 'metaDescription'), `${name}.${key}_${side}: textarea поза richtext`);
      }
    }
  }
});
```

Run: `node --test tests/cms-components.test.js`
Expected: FAIL — `church.lead_uk: textarea поза richtext`.

- [ ] **Step 2: Схема й модель**

`src/lib/schema.mjs` — за таблицею:
- `churches`: `lead: localizedRichInline,`; `projects`: `lead: localizedRichInline,`; `leaderResources`: `description: localizedRichInline,`.
- `pages`: `lead: localizedRichInline.optional(),`; у `sections` ключі `past_lead` і `elders_lead` — `localizedRichInline.optional()`, решта — `localized.optional()`:

```js
  sections: z
    .object({
      ...Object.fromEntries(['hero_locked', 'docs_title', 'res_title', 'past_eyebrow', 'past_title', 'elders_eyebrow', 'elders_title']
        .map((key) => [key, localized.optional()])),
      past_lead: localizedRichInline.optional(),
      elders_lead: localizedRichInline.optional(),
    })
    .strict()
    .optional(),
  help: z.object({ title: localized, desc: localizedRichInline, btn: localized }).strict().optional(),
```

- `homepage`:

```js
  hero: labels(['tag', 'addr', 'time', 'watch', 'donate', 'scroll']).extend({ title: localizedHtml, vision: localizedRichInline }),
  …
  about: labels(['eyebrow', 'title', 'beliefsTitle']).extend({ lead: localizedRichInline }),
  beliefs: z.array(localizedRichInline),
  news: z.object({
    eyebrow: localized, title: localized, lead: localizedRichInline, more: localized,
    items: z.array(z.object({ date: localized, title: localized, text: localizedRichInline, image: decorativeImage }).strict()),
  }).strict(),
  fb: z.object({ title: localized, text: localizedRichInline }).strict(),
  wwb: z.object({
    eyebrow: localized, title: localized,
    items: z.array(z.object({ title: localized, text: localizedRichInline }).strict()),
  }).strict(),
  testimonies: z.object({
    eyebrow: localized, title: localized, all: localized,
    items: z.array(z.object({ text: localizedRichInline, name: localized, role: localized }).strict()),
  }).strict(),
  ministries: labels(['eyebrow', 'title', 'all']).extend({ lead: localizedRichInline }),
  pastors: labels(['eyebrow', 'title', 'all']).extend({ lead: localizedRichInline }),
  …
  donate: labels(['eyebrow', 'title', 'ref', 'btn']).extend({ quote: localizedRichInline, thanks: localizedRichInline }),
  footer: labels(['navTitle', 'contactsTitle', 'socialTitle', 'copy', 'built', 'addr']).extend({ about: localizedRichInline }),
```

Оновити коментар над `homepage` («title — єдине поле з розміткою…»): «hero.title — єдине поле з HTML (localizedHtml); довгі тексти — форматовані (localizedRichInline, Спека 4)».

`src/lib/storyblok/model.mjs` — кожне поле з колонки «Модель»: `long('…')` → `richInline('…')`, з тими самими підписами й опціями (`{ optional: true }` лишається). `long` після цього лишається лише в `seo.metaDescription`.

Run: `node --test tests/cms-model.test.js tests/cms-components.test.js`
Expected: PASS (`checkModel()` — `[]`).

- [ ] **Step 3: Міграція контенту**

Run: `node scripts/migrate-richtext.mjs`
Expected: змінені `src/content/{churches,projects,leader-resources}/*.json` і `src/content/singletons/{pages,homepage}.json`; у `git diff` — лише поля з таблиці, рядок → документ.

- [ ] **Step 4: Шаблони, SEO, фікстури тестів**

Шаблони — для кожного рядка таблиці: `<тег …>{pick(x, lang)}</тег>` (чи `{p(x)}` у `index.astro`) → `<тег …><Rich value={x} lang={lang} inline /></тег>`; кожен змінений файл імпортує `Rich` (відносний шлях — як у сусідніх імпортів компонентів). Приклади, що відрізняються від загального правила:

```astro
<!-- index.astro:96 -->
        <span style="font-weight: 700"><Rich value={h.hero.vision} lang={lang} inline /></span><br><span style="font-weight: 700">{p(h.hero.addr)}</span>
<!-- index.astro:138 -->
      {h.beliefs.map((b) => <li class="belief"><span class="belief-mark" aria-hidden="true"><Fragment set:html={BELIEF_MARK} /></span><p><Rich value={b} lang={lang} inline /></p></li>)}
<!-- index.astro:312 -->
    <blockquote><Rich value={h.donate.quote} lang={lang} inline />
      <cite>{p(h.donate.ref)}</cite>
    </blockquote>
<!-- pastors.astro:47 (так само testimonies, leaders, churches/ministries/projects index) -->
    {page.lead && <p><Rich value={page.lead} lang={lang} inline /></p>}
```

Простий текст замість `pick`:
- `index.astro:77`: `description={p(h.about.lead)}` → `description={pickPlain(h.about.lead, lang)}` (імпорт `pickPlain` з `../../i18n`).
- `Seo.astro:36`: `defaultDescription: pick(home.about.lead, lang),` → `defaultDescription: pickPlain(home.about.lead, lang),`.
- `churches/[slug].astro:54`, `projects/[slug].astro:38`: `description={pick(x.lead, lang)}` → `description={pickPlain(x.lead, lang)}`.
- `src/lib/seo.mjs`, `pageDescription`: `if (page.lead) return pick(page.lead, lang);` → `if (page.lead) return pickPlain(page.lead, lang);` (імпорт `pickPlain` з `./i18n.mjs`).

Фікстури:
- `tests/helpers/probes.js`: `church` — `lead: rich('Лід')`; `project` — `lead: rich('Лід')`; `documentResource`, `linkResource` — `description: rich('Опис')`.
- `tests/cms-convert.test.js` (фікстура `pages/full`, рядки ~51-54): імпорт `rich` з `./helpers/probes.js`; `lead: rich('Вступ\nз переносом')`; у `sections` — `past_lead` і `elders_lead` через `rich(k)`, решта через `pair(k)`:

```js
      sections: Object.fromEntries(['hero_locked', 'docs_title', 'res_title', 'past_eyebrow', 'past_title', 'past_lead',
        'elders_eyebrow', 'elders_title', 'elders_lead'].map((k) => [k, k.endsWith('_lead') ? rich(k) : pair(k)])),
      help: { title: pair('Допомога'), desc: rich('Опис'), btn: pair('Кнопка') },
```

- `tests/lib-seo.test.js:51`: `lead: rich('Лід', 'Lead')` (імпорт `rich`).
- `tests/page-home.test.js:48`: `home.beliefs.map((b) => domText(b[lang]))`; `:93`: `domText(x.text[lang])` (імпорт `domText`).
- `tests/seo.test.js:111`: `truncate(textOf(home.about.lead[lang]))`; `:121`: `pageDescription(page, lang) ?? textOf(home.about.lead[lang])`.

Решта місць:

```bash
grep -rnE "\.(lead|description|desc|vision|quote|thanks|past_lead|elders_lead|about|text)(\?)?(\.|\[)(uk|en|lang)\b" tests
```

Кожне входження, що порівнює з DOM, → `domText(…)`; з мета-описом → `textOf(…)`; фікстура, яка пише рядок у форматоване поле, → `rich(…)`.

- [ ] **Step 5: Тести проходять, вихід не змінився**

Run: `npm test`
Expected: PASS.
Run: `node scripts/lib/diff-dirs.mjs dist-t4 dist`
Expected: `Збірки однакові.`

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: інлайн-форматування в усіх коротких текстах

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 7: блокові поля — основні тексти

**Files:**
- Modify: `src/lib/schema.mjs`, `src/lib/storyblok/model.mjs`
- Modify: `src/content/**` (скриптом)
- Modify: `src/pages/[...lang]/ministries/[slug].astro:65`, `churches/[slug].astro:80`, `projects/[slug].astro:62`, `pastors.astro:67,89`, `testimonies.astro:71`, `about.astro:34`, `contacts.astro:35`, `donate.astro:35`
- Modify: `src/styles/pages/ministry.css:30`, `src/styles/pages/testimonies.css:31`, `src/styles/pages/pastors.css:59`
- Modify: `src/lib/seo.mjs` (`pageDescription`), `src/lib/format.mjs` (видалити `paragraphs`)
- Modify: `tests/helpers/probes.js`
- Test: `tests/cms-convert.test.js`, `tests/lib-seo.test.js`, `tests/lib.test.js`, `tests/pages-toggle.test.js`, `tests/seo.test.js`, `tests/page-ministries.test.js`, `tests/page-pastors.test.js`, `tests/page-testimonies.test.js`

**Interfaces:**
- Consumes: усе з Задач 3–6.
- Produces: поля `ministries.body`, `churches.body`, `projects.body`, `pages.body`, `pastors.bio`, `testimonies.text` (text-варіант) — `localizedRich` / `rich(…)`. `paragraphs()` більше немає.

- [ ] **Step 1: Написати падаючий тест**

`tests/cms-components.test.js`:

```js
test('основні тексти — richtext з повною панеллю', () => {
  const fields = [['ministry', 'body'], ['church', 'body'], ['project', 'body'], ['site_page', 'body'], ['pastor', 'bio'], ['testimony_text', 'text']];
  for (const [name, key] of fields) assert.deepEqual(byName.get(name).schema[`${key}_uk`].toolbar, TOOLBAR.block, `${name}.${key}`);
});
```

Run: `node --test tests/cms-components.test.js`
Expected: FAIL.

- [ ] **Step 2: Схема, модель, міграція**

`src/lib/schema.mjs`: `ministries.body`, `churches.body`, `projects.body` → `localizedRich`; `pastors.bio` → `localizedRich`; у text-варіанті `testimonies` `text: localized` → `text: localizedRich`; `pages.body` → `localizedRich.nullable().optional()`.

`src/lib/storyblok/model.mjs`: `ministry.body`, `church.body`, `project.body` → `rich('Текст')`; `pastor.bio` → `rich('Опис')`; `testimony_text.text` → `rich('Свідчення')`; `site_page.body` → `rich('Текст сторінки (без нього сторінка не публікується)', { optional: true, nullable: true })`.

Run: `node scripts/migrate-richtext.mjs`
Expected: у `git diff` змінені лише шість полів, рядок → документ.

- [ ] **Step 3: Шаблони й стилі**

Без обгортки — абзаци стають на місце старого `<p>`, стилі предка діють як раніше (рішення 5):

```astro
<!-- churches/[slug].astro:80, projects/[slug].astro:62 -->
        <Rich value={c.body} lang={lang} />
<!-- projects: value={p.body} -->
<!-- pastors.astro:67 -->
            <Rich value={p.bio} lang={lang} />
<!-- pastors.astro:89 — у рядку elder-card: <p>{pick(p.bio, lang)}</p> → -->
<Rich value={p.bio} lang={lang} />
<!-- about.astro:34, contacts.astro:35, donate.astro:35 -->
    <div class="prose"><Rich value={page.body!} lang={lang} /></div>
```

З обгорткою:

```astro
<!-- ministries/[slug].astro:65 -->
        <div class="desc"><Rich value={m.body} lang={lang} /></div>
<!-- testimonies.astro:71 -->
            <div class="tst-text"><Rich value={x.text} lang={lang} /></div>
```

Імпорти: кожен змінений файл імпортує `Rich`; з `about/contacts/donate.astro` прибрати імпорт `paragraphs`.

`src/styles/pages/ministry.css:30` — `.info p.desc{…}` замінити на:

```css
.info .desc{color:var(--text-muted);line-height:1.75;margin:0 0 1.5rem}
.info .desc p{margin:0}
.info .desc p + p,.info .desc p + .rt-list,.info .desc .rt-list + p{margin-top:1rem}
```

`src/styles/pages/testimonies.css:31` — `.tst-card p{…}` замінити на:

```css
.tst-card .tst-text{margin:.5rem 0 1.5rem;flex:1}
.tst-text p{font-size:1.05rem;line-height:1.65;margin:0}
.tst-text p + p{margin-top:.8rem}
```

`src/styles/pages/pastors.css` — після `.elder-card p{…}` (рядок 59):

```css
.elder-card p + p{margin-top:.5rem}
```

Перед кожною заміною CSS переконатися, що в тому ж файлі немає інших правил для замінюваного селектора: `grep -n "\.desc\|tst-card p\|elder-card p" src/styles/pages/*.css`.

- [ ] **Step 4: SEO, `paragraphs`, фікстури**

`src/lib/seo.mjs`, `pageDescription`: `if (page.body) return paragraphs(pick(page.body, lang))[0];` →

```js
  // Перший абзац прози: richPlain розділяє блоки порожнім рядком.
  if (page.body) return pickPlain(page.body, lang).split('\n\n')[0];
```

Прибрати імпорт `paragraphs` із `seo.mjs`. У `src/lib/format.mjs` видалити `paragraphs` разом із коментарем над нею; `grep -rn "paragraphs" src tests` — видалити й тест `paragraphs` у `tests/lib.test.js`, якщо він є.

Фікстури:
- `tests/helpers/probes.js`: `ministry`, `church`, `project` — `body: rich('Текст')`; `textTestimony` — `text: rich('Свідчення')`; `person` — `bio: rich('Опис')`.
- `tests/cms-convert.test.js` (`pages/full`): `body: rich('Текст сторінки')`.
- `tests/lib-seo.test.js:52`: `body: rich('Перший.\n\nДругий.')` → очікування `'Перший.'` лишається.
- `tests/pages-toggle.test.js:30`: `pages.about.body = rich('Перший абзац.\n\nДругий абзац.', 'First paragraph.\n\nSecond.');` (імпорт `rich`). Якщо тест порівнює абзаци з DOM через `paragraphs` чи `split`, порівнювати з `richPlain(pages.about.body[lang]).split('\n\n')`.
- `tests/seo.test.js:141`: `pages.about.body = rich('Перший абзац про церкву.\n\nДругий абзац.', 'First paragraph about the church.\n\nSecond paragraph.');`.
- `tests/page-ministries.test.js:52`: `assert.equal(root.querySelector('.info .desc').text, domText(m.body[lang]));`.
- `tests/page-pastors.test.js:19`: `group('elder').map((p) => domText(p.bio[lang]))`.
- `tests/page-testimonies.test.js:28`: `assert.equal(card.querySelector('.tst-text').text, domText(x.text[lang]));`.

Решта: `grep -rnE "\.(body|bio|text)(\?)?(\.|\[)(uk|en|lang)\b" tests` — те саме правило, що в Задачі 6.

- [ ] **Step 5: Тести проходять; відмінності виходу — лише очікувані**

Run: `npm test`
Expected: PASS.
Run: `node scripts/lib/diff-dirs.mjs dist-t4 dist`
Expected: відрізняються лише:
- CSS-файли сторінок ministry, testimonies, pastors (і посилання на них у HTML, якщо змінився хеш);
- `**/ministries/*/index.html` (обгортка `.desc`) і `testimonies/index.html`, `en/testimonies/index.html` (обгортка `.tst-text`).

`churches/*`, `projects/*`, `about/contacts/donate` (якщо ввімкнені) мають збігатися побайтово; `pastors/index.html` — теж, крім посилання на змінений CSS. Будь-яка інша відмінність — дефект. Для перевірки конкретної сторінки: `diff <(tr '>' '\n' < dist-t4/ministries/youth/index.html) <(tr '>' '\n' < dist/ministries/youth/index.html)` — різниця лише в обгортці.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: основні тексти — повне форматування (абзаци, h3, списки)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 8: адреси кнопок

**Files:**
- Modify: `src/lib/schema.mjs`, `src/lib/storyblok/model.mjs`
- Modify: `scripts/migrate-richtext.mjs` (заповнення нових полів)
- Modify: `src/content/singletons/{homepage,pages}.json`, `src/content/{ministries,churches}/*.json` (скриптом)
- Modify: `src/components/SiteHeader.astro:16,46,75`, `src/pages/[...lang]/index.astro:49,101,105,118,156,226,252,273,315`, `src/pages/[...lang]/pastors.astro:31,104`, `src/pages/[...lang]/leaders.astro:30,103`, `src/pages/[...lang]/ministries/[slug].astro:70`, `src/pages/[...lang]/churches/[slug].astro:86`
- Modify: `tests/helpers/probes.js`, `tests/cms-convert.test.js`
- Test: `tests/buttons.test.js` (новий)

**Interfaces:**
- Consumes: `linkUrl` (Задача 1), `linkAttrs` (Задача 1).
- Produces: поля (усі — `linkUrl`; «nullable» — `linkUrl.nullable()`):

| Поле | Обовʼязкове | Порожньо → | Кнопка |
|---|---|---|---|
| `homepage.cta.liveUrl` | nullable | `${site-settings.social.youtube}/streams` | «Трансляція», шапка й мобільне меню |
| `homepage.hero.watchUrl` | nullable | те саме | «Дивитися» |
| `homepage.hero.contactsUrl` | так | — | «Контакти» в першому екрані |
| `homepage.hero.donateUrl` | nullable | `donate-settings.liqpayUrl` | «Пожертвувати» в першому екрані |
| `homepage.news.items[].url` | так | — | «Більше» в новині |
| `homepage.testimonies.allUrl` / `ministries.allUrl` / `pastors.allUrl` | так | — | «Усі …» |
| `homepage.donate.btnUrl` | nullable | `donate-settings.liqpayUrl` | кнопка блоку пожертв |
| `pages.*.help.btnUrl` | так (у групі `help`) | — | «Потрібна допомога» |
| `ministries.ctaUrl` | nullable | `tel:` телефону служіння | «Приєднатися до служіння» |
| `churches.directionsUrl` | nullable | Google Maps за адресою | «Прокласти маршрут» |

- [ ] **Step 1: Написати падаючі тести**

`tests/buttons.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { BASE_PATH } from '../astro.config.mjs';
import { schemas } from '../src/lib/schema.mjs';
import { linkAttrs } from '../src/lib/paths.mjs';
import { withBuild } from './helpers/build.js';
import { readCollection, readPages, readSingleton, sortedData } from './helpers/content.js';
import { church, ministry } from './helpers/probes.js';

// Кожна кнопка веде на адресу зі свого поля (Спека 4). Очікування —
// з контенту, який тест читає; фолбеки порожніх полів — пробною збіркою.
const LOCALES = [['uk', ''], ['en', 'en/']];
const html = (dir, rel) => parse(readFileSync(`${dir}/${rel}index.html`, 'utf8'));
const attrs = (el) => ({ href: el.getAttribute('href'), target: el.getAttribute('target'), rel: el.getAttribute('rel') });
const expected = (lang, url) => ({ target: undefined, rel: undefined, ...linkAttrs(BASE_PATH, lang, url) });

function assertHomeButtons(dir) {
  const home = readSingleton('homepage');
  const settings = readSingleton('site-settings');
  const donate = readSingleton('donate-settings');
  const streams = `${settings.social.youtube}/streams`;
  for (const [lang, prefix] of LOCALES) {
    const root = html(dir, prefix);
    assert.deepEqual(attrs(root.querySelector('.hero-actions .btn-primary')), expected(lang, home.hero.watchUrl ?? streams), 'Дивитися');
    assert.deepEqual(attrs(root.querySelector('.hero-actions .btn-ghost')), expected(lang, home.hero.contactsUrl), 'Контакти');
    assert.deepEqual(attrs(root.querySelector('.hero-donate-cta')), expected(lang, home.hero.donateUrl ?? donate.liqpayUrl), 'Пожертвувати');
    assert.deepEqual(attrs(root.querySelector('.donate-btn')), expected(lang, home.donate.btnUrl ?? donate.liqpayUrl), 'блок пожертв');
    root.querySelectorAll('.news-more').forEach((a, i) => assert.deepEqual(attrs(a), expected(lang, home.news.items[i].url), `новина ${i}`));
    for (const [section, key] of [['#testimonies', 'testimonies'], ['#ministries', 'ministries'], ['#pastors', 'pastors']]) {
      const button = root.querySelector(`${section} .btn-outline, ${section} .btn-ghost`);
      if (button) assert.deepEqual(attrs(button), expected(lang, home[key].allUrl), `Усі: ${key}`);
    }
  }
}

test('кнопки головної — з полів контенту, порожні — з налаштувань', () => {
  assertHomeButtons('dist');
});

test('«Потрібна допомога» — з help.btnUrl своєї сторінки', () => {
  for (const [id, page] of Object.entries(readPages())) {
    if (!page.help) continue;
    for (const [lang, prefix] of LOCALES) {
      const root = html('dist', `${prefix}${id}/`);
      assert.deepEqual(attrs(root.querySelector('.help .btn')), expected(lang, page.help.btnUrl), `${prefix}${id}/`);
    }
  }
});

test('служіння й церква: поле кнопки, інакше телефон і маршрут', () => {
  for (const { data: m } of readCollection('ministries')) {
    const root = html('dist', `ministries/${m.slug}/`);
    const tel = `tel:${m.phone.replace(/[^+\d]/g, '')}`;
    assert.deepEqual(attrs(root.querySelector('.info > .btn')), expected('uk', m.ctaUrl ?? tel), m.slug);
  }
  for (const { data: c } of readCollection('churches')) {
    const root = html('dist', `churches/${c.slug}/`);
    const maps = `https://www.google.com/maps?q=${encodeURIComponent(`${c.city.uk} ${c.address.uk}`)}`;
    assert.deepEqual(attrs(root.querySelector('.info > .btn')), expected('uk', c.directionsUrl ?? maps), c.slug);
  }
});

test('заповнені необовʼязкові поля перекривають фолбеки', { timeout: 180_000 }, () => {
  withBuild((content) => {
    content.editSingleton('homepage', (h) => {
      h.cta.liveUrl = 'https://example.test/live';
      h.hero.watchUrl = '/projects/';
      h.hero.donateUrl = 'https://example.test/pay';
      h.donate.btnUrl = '#contacts';
    });
    content.write('ministries', 'probe', ministry('probe', { ctaUrl: 'mailto:probe@example.test' }));
    content.write('churches', 'probe', church('probe', { directionsUrl: 'https://example.test/map' }));
  }, ({ failed, output, dir }) => {
    assert.equal(failed, false, output);
    const root = html(dir, 'en/');
    assert.deepEqual(attrs(root.querySelector('.hero-actions .btn-primary')), expected('en', '/projects/'));
    assert.deepEqual(attrs(root.querySelector('.hero-donate-cta')), expected('en', 'https://example.test/pay'));
    assert.deepEqual(attrs(root.querySelector('.donate-btn')), expected('en', '#contacts'));
    assert.equal(root.querySelector('.site-header a[href="https://example.test/live"]')?.getAttribute('target'), '_blank');
    assert.deepEqual(attrs(html(dir, 'ministries/probe/').querySelector('.info > .btn')), expected('uk', 'mailto:probe@example.test'));
    assert.deepEqual(attrs(html(dir, 'churches/probe/').querySelector('.info > .btn')), expected('uk', 'https://example.test/map'));
  });
});

test('адреса кнопки поза linkUrl валить схему з назвою поля', () => {
  const home = readSingleton('homepage');
  const broken = { ...home, hero: { ...home.hero, contactsUrl: 'javascript:alert(1)' } };
  const result = schemas.homepage.safeParse(broken);
  assert.ok(result.error.issues.some((i) => i.path.join('.') === 'hero.contactsUrl'));
});
```

Перед запуском звірити з кодом: сигнатуру колбеку `withBuild` (`tests/helpers/build.js` — які поля отримує другий аргумент і як називається тека збірки), назву методу `editSingleton` (`tests/helpers/build.js:51`), експорт `BASE_PATH` з `astro.config.mjs` (його імпортує `tests/seo.test.js`) і селектори (`.info > .btn` у `ministries/[slug].astro` і `churches/[slug].astro`, кнопки «Усі …» в `index.astro:226,252,273` — клас і `id` секції). Якщо щось відрізняється — виправити тест під реальний код, а не код під тест.

Run: `npm test` (потрібна свіжа збірка `dist`)
Expected: FAIL — `hero.contactsUrl` / `help.btnUrl` відсутні, `.hero-actions .btn-primary` без `target`.

- [ ] **Step 2: Схема й модель**

`src/lib/schema.mjs`:

```js
  cta: labels(['live', 'liveTitle']).extend({ liveUrl: linkUrl.nullable() }),
  hero: labels(['tag', 'addr', 'time', 'watch', 'donate', 'scroll']).extend({
    title: localizedHtml, vision: localizedRichInline,
    // Спека 4: порожньо — трансляції YouTube і LiqPay з налаштувань.
    watchUrl: linkUrl.nullable(), contactsUrl: linkUrl, donateUrl: linkUrl.nullable(),
  }),
```

- `news.items[]` — додати `url: linkUrl`; `testimonies` — `allUrl: linkUrl`; `ministries`, `pastors` — `.extend({ lead: localizedRichInline, allUrl: linkUrl })`; `donate` — `.extend({ quote: …, thanks: …, btnUrl: linkUrl.nullable() })`.
- `pages.help`: `z.object({ title: localized, desc: localizedRichInline, btn: localized, btnUrl: linkUrl }).strict().optional()`.
- `ministries`: `ctaUrl: linkUrl.nullable(),` (коментар: «Порожньо — дзвінок на phone служіння»); `churches`: `directionsUrl: linkUrl.nullable(),` («Порожньо — Google Maps за адресою»).

`src/lib/storyblok/model.mjs` — після `const text = field('text');`:

```js
// Адреса кнопки (linkUrl у схемі). Підказка в самій формі: редактор не
// бачить схеми, а «/…» і «#…» без пояснення незрозумілі.
const LINK_HINT = 'https://… (інший сайт), /сторінка/ (цей сайт), #розділ (на цій сторінці), mailto:… або tel:…';
const url = (label, opts = {}) => text(label, { description: LINK_HINT, ...opts });
```

Поля моделі (кожне — одразу після підпису своєї кнопки):
- `home_cta`: `liveUrl: url('Посилання кнопки (порожньо — трансляції YouTube)', { nullable: true })`;
- `home_hero`: після `watch` — `watchUrl: url('Посилання «Дивитися» (порожньо — трансляції YouTube)', { nullable: true })`; `contactsUrl: url('Посилання кнопки «Контакти»')`; після `donate` — `donateUrl: url('Посилання «Пожертвувати» (порожньо — LiqPay з налаштувань)', { nullable: true })`;
- `home_news_item`: `url: url('Посилання «Більше»')`;
- `home_testimonies`, `home_ministries`, `home_pastors`: після `all` — `allUrl: url('Посилання кнопки «Усі …»')` (у підписі — назва розділу: «Усі свідчення», «Усі служіння», «Усі пастори»);
- `home_donate`: після `btn` — `btnUrl: url('Посилання кнопки (порожньо — LiqPay з налаштувань)', { nullable: true })`;
- `page_help`: `btnUrl: url('Посилання кнопки')`;
- `ministry`: після `phone` — `ctaUrl: url('Посилання кнопки (порожньо — дзвінок на телефон)', { nullable: true })`;
- `church`: після `pastor` — `directionsUrl: url('Посилання «Прокласти маршрут» (порожньо — Google Maps за адресою)', { nullable: true })`;
- `project.ctaUrl`: підпис → `url('Посилання кнопки', { nullable: true })`.

Run: `node --test tests/cms-model.test.js`
Expected: PASS.

- [ ] **Step 3: Міграція — поточні адреси в нові поля**

`scripts/migrate-richtext.mjs` — перед `writeContent`:

```js
// Нові поля кнопок (Задача 8): поточні адреси з шаблонів; null — «як зараз»
// (фолбек на налаштування чи дані запису).
const HELP = { pastors: 'https://m.me/dom.hleba.org', leaders: 'mailto:leaders@houseofbread.church' };
const BUTTONS = {
  homepage: (h) => {
    h.cta.liveUrl ??= null;
    h.hero.watchUrl ??= null;
    h.hero.contactsUrl ??= '#contacts';
    h.hero.donateUrl ??= null;
    for (const item of h.news.items) item.url ??= '#media';
    h.testimonies.allUrl ??= '/testimonies/';
    h.ministries.allUrl ??= '/ministries/';
    h.pastors.allUrl ??= '/pastors/';
    h.donate.btnUrl ??= null;
  },
  pages: (page, id) => {
    if (!page.help || page.help.btnUrl) return;
    if (!HELP[id]) throw new Error(`pages.${id}.help: невідома адреса кнопки — додайте її в HELP`);
    page.help.btnUrl = HELP[id];
  },
  ministries: (m) => { m.ctaUrl ??= null; },
  churches: (c) => { c.directionsUrl ??= null; },
};
for (const e of entries) BUTTONS[e.collection]?.(e.data, e.slug);
```

Run: `node scripts/migrate-richtext.mjs`
Expected: у `git diff` — лише нові ключі кнопок.

- [ ] **Step 4: Шаблони**

`src/components/SiteHeader.astro`: імпорт `linkAttrs` з `../lib/paths.mjs`; `const streams = …` → `const live = cta.liveUrl ?? `${settings.social.youtube}/streams`;`. Рядок 46: `<LangSwitch lang={lang} path="/" /><a href={streams} target="_blank" rel="noopener noreferrer">` → `<LangSwitch lang={lang} path="/" /><a {...linkAttrs(base, lang, live)}>`. Рядок 75: `<a href={streams} target="_blank" rel="noopener noreferrer" class="btn btn-primary" …>` → `<a {...linkAttrs(base, lang, live)} class="btn btn-primary" …>`.

`src/pages/[...lang]/index.astro`: імпорт `linkAttrs`; `streams` (рядок 49) лишається фолбеком.

```astro
        <a class="btn btn-primary" {...linkAttrs(base, lang, h.hero.watchUrl ?? streams)}>
        …
        <a class="btn btn-ghost" {...linkAttrs(base, lang, h.hero.contactsUrl)}><span>{p(h.nav.contacts)}</span></a>
        …
      <a class="btn btn-primary hero-donate-cta" {...linkAttrs(base, lang, h.hero.donateUrl ?? donate.liqpayUrl)}><span>{p(h.hero.donate)}</span></a>
        …
<!-- рядок 156: news-more -->
<a class="news-more" {...linkAttrs(base, lang, n.url)}>{p(h.news.more)} <Fragment set:html={ARROW_NEWS} /></a>
<!-- рядки 226, 252, 273: href={localePath(base, lang, '/testimonies/')} → {...linkAttrs(base, lang, h.testimonies.allUrl)}; так само ministries, pastors -->
    <a {...linkAttrs(base, lang, h.donate.btnUrl ?? donate.liqpayUrl)} class="donate-btn">{p(h.donate.btn)}</a>
```

`pastors.astro`: видалити `const MESSENGER = …` (рядок 31); кнопка → `<a class="btn" {...linkAttrs(base, lang, help.btnUrl)}>`.
`leaders.astro`: видалити `const COORDINATOR = …` (рядок 30); кнопка → `<a class="btn" {...linkAttrs(base, lang, help.btnUrl)}>`.
`ministries/[slug].astro:70`: `<a class="btn" href={tel}>` → `<a class="btn" {...linkAttrs(base, lang, m.ctaUrl ?? tel)}>` (посилання телефону у фактах лишається `href={tel}`).
`churches/[slug].astro:86`: `<a class="btn" href={directions}>` → `<a class="btn" {...linkAttrs(base, lang, c.directionsUrl ?? directions)}>`.

У кожному файлі переконатися, що `base` визначено (`const base = import.meta.env.BASE_URL;`), і прибрати імпорти, що стали невживаними (`localePath` в `index.astro` ще потрібен для карток служінь).

- [ ] **Step 5: Фікстури**

- `tests/helpers/probes.js`: `ministry` — `ctaUrl: null`; `church` — `directionsUrl: null`.
- `tests/cms-convert.test.js` (`pages/full`): `help: { title: pair('Допомога'), desc: rich('Опис'), btn: pair('Кнопка'), btnUrl: '#contacts' }`.
- Інші фікстури з `help` чи повним `homepage`: `grep -rn "help:" tests` — додати `btnUrl`.

- [ ] **Step 6: Тести проходять; відмінності виходу — лише очікувані**

Run: `npm test`
Expected: PASS.
Run: `node scripts/lib/diff-dirs.mjs dist-t4 dist`
Expected, понад відмінності Задачі 7: головна (`index.html`, `en/index.html`) — `target`/`rel` на «Дивитися» й порядок атрибутів `donate-btn`; `churches/*/index.html` — `target`/`rel` на «Прокласти маршрут» (рішення 7). Решта сторінок з шапкою — без змін (атрибути «Трансляції» ті самі й у тому ж порядку).

- [ ] **Step 7: Commit**

```bash
git add src scripts/migrate-richtext.mjs tests
git commit -m "feat: адреса кожної кнопки редагується в Storyblok

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 9: перевірки — якорі, повне форматування в кожному полі, файли медіатеки

**Files:**
- Modify: `tests/helpers/links.js` (`findBrokenLinks`)
- Create: `tests/richtext-probe.test.js`
- Test: `tests/cms-pull.test.js`

**Interfaces:**
- Consumes: `mapRichPairs` (Задача 5), `withBuild`, `findBrokenLinks`, фейк Storyblok (`tests/helpers/fake-storyblok.js`).

- [ ] **Step 1: Якорі в `findBrokenLinks`**

У `tests/helpers/links.js`, у циклі по файлах `findBrokenLinks`, після циклу по `ref`:

```js
    // Якір на тій самій сторінці (кнопка «Контакти» → #contacts, посилання
    // в тексті): без елемента з таким id клік нікуди не веде (Спека 4).
    for (const href of root.querySelectorAll('a[href^="#"]').map((a) => a.getAttribute('href'))) {
      const id = decodeURIComponent(href.slice(1));
      if (id && !root.getElementById(id)) problems.push(`${from}: ${href} → на сторінці немає id="${id}"`);
    }
```

Run: `npm test`
Expected: PASS. Якщо падає на якорі, прописаному в шаблоні (меню, футер), — це справжня бита кнопка сайту: **не** глушити перевірку, а зупинитися й показати користувачу список (виправлення шаблону — окреме рішення).

- [ ] **Step 2: Пробна збірка з повним форматуванням — падаючий тест**

`tests/richtext-probe.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { BASE_PATH } from '../astro.config.mjs';
import { readContent } from '../scripts/cms/content.mjs';
import { mapRichPairs } from '../src/lib/storyblok/walk.mjs';
import { withBuild } from './helpers/build.js';
import { findBrokenLinks, htmlFiles } from './helpers/links.js';

// Кожне форматоване поле кожного запису отримує все, що дозволяє його
// рівень, — шаблони мусять це витримати (контракт з адмінкою): збірка
// проходить, розмітка валідна, посилання не биті.
const t = (text, marks) => ({ type: 'text', text, ...(marks && { marks }) });
const link = (href, linktype = 'url') => [{ type: 'link', attrs: { href, linktype } }];
const para = (lang) => ({
  type: 'paragraph',
  content: [
    t('Жирний', [{ type: 'bold' }]), t(' курсив', [{ type: 'italic' }]), { type: 'hard_break' },
    t(' сторінка', link('/ministries/')), t(' сайт', link('https://example.test/')),
    t(' пошта', link('mailto:probe@example.test', 'email')), t(lang === 'uk' ? ' ʼапостроф' : " it's"),
  ],
});
const FULL = {
  block: (lang) => ({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [t('Підзаголовок')] },
      para(lang),
      { type: 'bullet_list', content: [{ type: 'list_item', content: [
        { type: 'paragraph', content: [t('пункт')] },
        { type: 'ordered_list', attrs: { order: 2 }, content: [{ type: 'list_item', content: [{ type: 'paragraph', content: [t('вкладений')] }] }] },
      ] }] },
      para(lang),
    ],
  }),
  inline: (lang) => ({ type: 'doc', content: [para(lang), para(lang)] }),
};

// Блок усередині абзацу чи заголовка — невалідна розмітка; node-html-parser
// вкладає елементи так, як їх записано, тож вкладеність видно селектором.
const NESTED = ['p p', 'p ul', 'p ol', 'p h3', 'p div', 'h2 p', 'h2 ul', 'h3 p', 'span p', 'span ul', 'a a'].join(', ');

test('повне форматування в кожному полі: збірка, валідна розмітка, без битих посилань', { timeout: 300_000 }, () => {
  withBuild((content) => {
    for (const entry of readContent(content.dir)) {
      const data = mapRichPairs(entry.collection, entry.data, (pair, field) => ({ uk: FULL[field.level]('uk'), en: FULL[field.level]('en') }));
      content.replace(entry, data);
    }
  }, ({ failed, output, dir }) => {
    assert.equal(failed, false, output.slice(-3000));
    assert.deepEqual(findBrokenLinks(dir, BASE_PATH), []);
    let lists = 0;
    for (const file of htmlFiles(dir)) {
      const root = parse(readFileSync(file, 'utf8'));
      const nested = root.querySelectorAll(NESTED);
      assert.equal(nested.length, 0, `${file}: ${nested.slice(0, 3).map((n) => n.parentNode.rawTagName + '>' + n.rawTagName).join(', ')}`);
      lists += root.querySelectorAll('.rt-list').length;
      for (const a of root.querySelectorAll('a.rt-link[href^="https://example.test"]')) assert.equal(a.getAttribute('target'), '_blank', file);
    }
    assert.ok(lists > 0, 'жодного списку на сторінках — рендер блокових полів не спрацював');
  });
});
```

Звірити з `tests/helpers/build.js`: як `withBuild` дає доступ до теки копії контенту й чи є метод замінити запис (`write(collection, name, data)`, `editSingleton(name, fn)`). Якщо методу `replace(entry, data)` немає — додати його до класу фікстури в `tests/helpers/build.js`:

```js
  // Запис у вигляді readContent (scripts/cms/content.mjs): колекція — файл,
  // сторінка — ключ pages.json, одиночка — main.
  replace(entry, data) {
    if (entry.collection === 'pages') return this.editSingleton('pages', (pages) => { pages[entry.slug] = data; });
    if (entry.source.startsWith('singletons/')) return this.editSingleton(entry.collection, () => data);
    return this.write(entry.collection, entry.source.split('/').pop().replace(/\.json$/, ''), data);
  }
```

(Перевірити, що `editSingleton` замінює `main` значенням, яке повертає колбек, або змінює обʼєкт на місці, — і підлаштувати тіло під нього.)

Run: `npx astro build && node --test tests/richtext-probe.test.js`
Expected: FAIL лише якщо шаблон десь ламає розмітку. Кожна знахідка — дефект шаблону з Задач 5–7 (напр. інлайн-поле в `<span>` рендериться блоково): виправити шаблон, а не пробу.

- [ ] **Step 3: Проба проходить**

Run: `node --test tests/richtext-probe.test.js`
Expected: PASS.

- [ ] **Step 4: Посилання на файл медіатеки Storyblok — падаючий тест (Review Focus 2)**

У `tests/cms-pull.test.js` знайти тест, який перевіряє, що `cms:pull` завантажує картинку медіатеки й переписує адресу на `uploads/cms/…` (за ним — як у цьому файлі будується фейк, історія й колбек `download`). Поруч додати тест за тим самим шаблоном: історія служіння, у `summary_uk` якої посилання `{ type: 'link', attrs: { href: 'https://a.storyblok.com/f/1/x/doc.pdf', linktype: 'asset' } }`. Очікування:
- `runPull` повертає `exitCode: 0`;
- у записаному `src/content/ministries/<slug>.json` `href` посилання починається з `uploads/cms/` і закінчується на `doc.pdf`;
- файл існує в теці `public` проби;
- `schemas.ministries.safeParse(записані дані).success === true` (тобто `linkUrl` приймає переписану адресу).

Run: `node --test tests/cms-pull.test.js`
Expected: PASS одразу, якщо Задачі 1–5 зроблені правильно (`uploads/…` у `linkUrl`, глибокий `mapStrings`). FAIL — дефект у `linkUrl` чи нормалізації, виправити там.

- [ ] **Step 5: Повний прогін і commit**

Run: `npm test`
Expected: PASS.

```bash
git add tests
git commit -m "test: якорі кнопок, повне форматування в кожному полі, файл медіатеки в тексті

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 10: вигляд піксель у піксель, документація, прибирання

**Files:**
- Create: `scripts/lib/compare-screens.mjs`
- Delete: `scripts/migrate-richtext.mjs`
- Modify: `CLAUDE.md`, `.gitignore`; спека — лише якщо рішення змінилися під час реалізації

- [ ] **Step 1: Скрипт порівняння скріншотів**

`scripts/lib/compare-screens.mjs`:

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { htmlFiles, pageUrl } from '../../tests/helpers/links.js';
import { startStaticServer } from './static-server.mjs';

// Дві збірки (base «/») — скріншот кожної сторінки на двох ширинах і
// побайтове порівняння PNG. «Дизайн перенесено піксель у піксель» (CLAUDE.md)
// перевіряється так само після кожної зміни шаблонів.
// Чужі хости (YouTube, Facebook, карта) заблоковані: їхній вміст щоразу інший.
// node scripts/lib/compare-screens.mjs <еталон> <нова> [тека для відмінностей]
const [refDir, newDir, outDir = 'screens-diff'] = process.argv.slice(2);
const VIEWPORTS = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];

async function shoot(browser, origin, path, viewport) {
  const page = await browser.newPage({ viewport });
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  await page.goto(`${origin}${path}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // Анімації появи (.reveal, data-anim) — у кінцевий стан.
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
  const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await page.close();
  return png;
}

const [ref, next] = await Promise.all([startStaticServer(refDir), startStaticServer(newDir)]);
const browser = await chromium.launch();
const diffs = [];
try {
  for (const file of htmlFiles(refDir)) {
    const path = pageUrl(refDir, file, '/');
    for (const viewport of VIEWPORTS) {
      const [a, b] = [await shoot(browser, ref.origin, path, viewport), await shoot(browser, next.origin, path, viewport)];
      if (!a.equals(b)) {
        diffs.push(`${path} @${viewport.width}`);
        mkdirSync(outDir, { recursive: true });
        const name = `${path.replace(/\W+/g, '_') || 'root'}-${viewport.width}`;
        writeFileSync(join(outDir, `${name}-ref.png`), a);
        writeFileSync(join(outDir, `${name}-new.png`), b);
      }
    }
  }
} finally {
  await browser.close();
  await Promise.all([ref.close(), next.close()]);
}
for (const d of diffs) console.log(`✗ ${d}`);
console.log(diffs.length > 0 ? `Відмінностей: ${diffs.length} (PNG — у ${outDir}/).` : 'Сторінки однакові.');
process.exitCode = diffs.length > 0 ? 1 : 0;
```

Перевірити назву класу, який робить `.reveal` видимим (`grep -rn "reveal" src/scripts src/pages | head` — у скрипті головної), і підставити її замість `is-visible`.

- [ ] **Step 2: Дві збірки з base «/» і порівняння**

`dist-before` зібрано з типовим `BASE_PATH`. Для скріншотів обидві збірки мають бути з `BASE_PATH=/`:

```bash
git worktree add ../hob-before $(git merge-base HEAD main)
(cd ../hob-before && npm ci && BASE_PATH=/ npx astro build --outDir screens-ref)
BASE_PATH=/ npx astro build --outDir screens-new
node scripts/lib/compare-screens.mjs ../hob-before/screens-ref screens-new
git worktree remove --force ../hob-before
```

Кожна збірка — всередині свого проєкту (CLAUDE.md: `--outDir` поза cwd отримує ще й файли `.astro/`). На Windows / Git Bash — з префіксом `MSYS_NO_PATHCONV=1`. `screens-new/` і `screens-diff/` — у `.gitignore`.
Expected: `Сторінки однакові.` Очікуваних відмінностей немає: зміни `target` не видно, а нові правила `base.css` на поточний контент (самі абзаци) не діють. Якщо відмінності є — відкрити пари PNG з `screens-diff/`; найімовірніше це CSS обгорток із Задачі 7 (`.desc`, `.tst-text`): виправити, перезібрати, повторити.

- [ ] **Step 3: Прибирання**

```bash
git rm scripts/migrate-richtext.mjs
```

У `.gitignore` додати `screens-new/` і `screens-diff/`; прибрати `dist-t4/`; `dist-before/` лишити.

- [ ] **Step 4: Документація**

`CLAUDE.md`, розділ **Content** — після речення про «Every localized field is `{uk, en}`…» додати:

```markdown
Long texts are **richtext** (Spec 4): the Storyblok editor's document (`{type:'doc', content:[…]}`) is stored as-is in
both languages. Two levels — `localizedRich` (body texts: paragraphs, `h3`, lists, bold/italic/links) and
`localizedRichInline` (everything a template puts inside `<p>`/`<h2>`: no lists or headings); the allowlist lives in
`richIssues` (`src/lib/schema.mjs`), because `@storyblok/richtext` renders `javascript:` links and unknown nodes.
Render only via `<Rich value={pair} lang={lang} inline? />` (`src/components/Rich.astro`, the only `set:html` for
richtext — enforced by a test); plain text for meta/JSON-LD via `pickPlain`. Links in text and every button URL use one
format, `linkUrl` (`https://`, `mailto:`, `tel:`, `/page/`, `uploads/file`, `#anchor`), rendered with
`linkAttrs(base, lang, url)` (external → new tab). Which fields are richtext is known to the model
(`item: 'richtext'`); `mapRichPairs` (`src/lib/storyblok/walk.mjs`) walks them.
```

У розділі **CMS** — після речення про `convert.mjs`: «`fromStory` normalizes richtext (`normalizeDoc`: drops editor-only attributes like `textAlign`, trims empty edge paragraphs, adds `mailto:` to email links), so files → Storyblok → files is exact.»

Спека вже містить рішення цього плану; якщо під час реалізації якесь рішення змінилося — оновити відповідний розділ спеки тим самим комітом.

- [ ] **Step 5: Повний прогін і commit**

Run: `npm test` і `npm run e2e`
Expected: PASS обидва.

```bash
git add -A scripts CLAUDE.md docs .gitignore
git commit -m "docs: richtext і посилання кнопок у CLAUDE.md і спеці; перевірка скріншотами

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 11: живий простір Storyblok (лише з окремого дозволу)

Ця задача змінює живий простір «Dim Hliba». **Перед кожним кроком з `--apply` — явне «так» користувача.** Без токенів у `.env` — зупинитися й попросити.

- [ ] **Step 1: Свіжий знімок і план**

```bash
npm run cms:pull          # правки редактора з моменту Задачі 5; рядки textarea приходять уже документами (рішення 13)
git diff --stat src/content
npm test
npm run cms:import        # dry-run
```

Expected: `git diff` — лише правки редактора (показати їх користувачу й закомітити окремо: `content: знімок Storyblok перед імпортом richtext`); `npm test` PASS; план імпорту — оновлення компонентів (`textarea` → `richtext`, нові поля кнопок) і `update` кожної історії з форматованими полями, **без конфліктів**. Конфлікт означає правку в Storyblok між `cms:pull` і dry-run — повторити Step 1. Показати план користувачу.

- [ ] **Step 2: Імпорт — лише після «так»**

```bash
npm run cms:import -- --apply
npm run cms:import        # dry-run ще раз
npm run cms:verify
```

Expected: другий dry-run — `0 змін`; `cms:verify` — повний збіг. (`cms:verify` порівнює дані, тож збіг був би й до імпорту; доказ того, що в просторі вже документи, — `0 змін` у другому dry-run: відбитки оновлено.)

- [ ] **Step 3: Перевірка форми й панелі в редакторі**

В адмінці Storyblok відкрити служіння, головну й сторінку `pastors`:
- поле «Коротко» — richtext з кнопками лише «жирний, курсив, посилання»; «Текст» — ще й абзац, H3, списки (рішення 9: якщо назви кнопок у панелі інші — виправити `TOOLBAR`, `npm run cms:import -- --apply`, повторити);
- у «Тексті» одного служіння зробити жирне слово, список і посилання `/projects/`, зберегти;
- `npm run cms:pull` з `version=draft` недоступний, тож перевірити на прев'ю-стенді: сторінка служіння показує форматування, у Visual Editor блок клікається;
- взяти документ цього поля з Management API (`GET /v1/spaces/{id}/stories/{story}`) і додати його як фікстуру в тест `richtext: документ з редактора Storyblok нормалізується…` (`tests/cms-convert.test.js`) замість ручного прикладу, якщо атрибути відрізняються. Якщо `fromStory` чи схема відкидають реальний документ — це дефект нормалізації: червоний тест, потім виправлення.

- [ ] **Step 4: Опублікувати й перевірити деплой**

Після «так» користувача — повернути правку служіння або опублікувати її. Вебхук запускає `deploy.yml`, `npm test` у CI проходить, сторінка на GitHub Pages показує форматування.

- [ ] **Step 5: Commit фікстури (якщо змінювалась)**

```bash
git add tests/cms-convert.test.js src/lib
git commit -m "test: документ зі справжнього редактора Storyblok у тесті нормалізації

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
