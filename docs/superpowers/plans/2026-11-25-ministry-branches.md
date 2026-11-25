# Гілки служіння — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Необовʼязковий розділ «гілок» (назва розділу з CMS + список гілок зі слайдером, назвою, описом, лідером, телефоном і кнопкою «Долучитися») на сторінці будь-якого служіння; з гілками загальні лідер/телефон/кнопка служіння зникають.

**Architecture:** Нове поле `branches` (`{title, items[]} | null | відсутнє`) у zod-схемі служіння й у моделі Storyblok (вкладена група + список). Шаблон деталки служіння рендерить окрему секцію гілок, повторюючи наявну розкладку `.layout`/`.info`. `Gallery.astro` отримує один спільний обробник стрілок для кількох слайдерів.

**Tech Stack:** Astro 5 (static), zod (`astro/zod`), Storyblok model/convert (`src/lib/storyblok/`), `node --test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-06-ministry-branches-design.md`

## Global Constraints

- Жодних `<style>` у `.astro`; стилі — у `src/styles/pages/ministry.css`; лише наявні токени, без нових кольорів; display-текст — `font-weight:700`, не 600.
- Усі внутрішні URL — через `localePath` / `assetUrl` / `linkAttrs`; шаблони читають дані лише через `siteData(Astro.locals)`.
- Кожна пара `{uk, en}` обовʼязкова обома мовами.
- Наявні файли `src/content/ministries/*.json` **не змінюються** (поле `branches` у них відсутнє).
- Служіння без гілок (або з `items: []`) рендериться байт-у-байт як зараз.
- Тести виводять очікування з контенту, який читають, і не пришпилюють поточні дані; крайові випадки — пробними збірками (`withBuild`, `tests/helpers/build.js`), `src/content` не чіпають.
- Не зупиняти dev-сервер на :4321 (якщо `npm test` його зламав — `touch astro.config.mjs`).
- Коміти з трейлером `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Служіння з `branches: { items: [] }` і без `leader` — має впасти схема (контакт потрібен), а не шаблон з `undefined`. → тест у Task 1.
2. Гілка з одним фото — без стрілок/крапок/мініатюр, і клавіатура не «зависає» на ній. → тест у Task 2 (розмітка) і Task 3 (стрілки йдуть у перший багатослайдовий).
3. Richtext і картинки медіатеки (`uploads/…`) усередині гілки проходять `toStory`→`fromStory` без втрат. → round-trip-проба в Task 1.
4. Історія Storyblok без ключа `branches` (усі наявні) → `null`, схема проходить, імпорт не бачить «змін». → тест у Task 1.
5. Справжній контент із гілками (після того як редактор їх додасть) не ламає наявні тести сторінки служіння й e2e галереї. → Task 2 і Task 3 роблять їх гілко-залежними.

---

### Task 1: Схема й модель Storyblok

**Files:**
- Modify: `src/lib/collections.mjs` (додати `hasBranches`)
- Modify: `src/lib/schema.mjs:321-335` (служіння)
- Modify: `src/lib/storyblok/model.mjs:85-97` (+ нові компоненти)
- Modify: `src/lib/storyblok/components.mjs:7` (`TABS`)
- Modify: `tests/helpers/probes.js` (проба гілки)
- Modify: `tests/cms-model.test.js:19-63`
- Test: `tests/schema.test.js`, `tests/cms-convert.test.js`, `tests/cms-model.test.js`, `tests/cms-components.test.js`

**Interfaces:**
- Produces:
  - `hasBranches(m: { branches?: { items: unknown[] } | null }): boolean` у `src/lib/collections.mjs` — `Boolean(m.branches?.items.length)`.
  - `export const ministryFields` — внутрішній `z.object(...).strict()` служіння (для `.extend/.omit` у тестах); `schemas.ministries = ministryFields.superRefine(...)`.
  - Форма даних: `branches?: { title: {uk,en}, items: Array<{ name: {uk,en}, body: richDoc{uk,en}, leader: string, phone: string, ctaUrl: string|null, media: MediaItem[] }> } | null`; `leader: string | null`, `phone: string | null`.
  - Проба `branch(name: string, extra = {})` у `tests/helpers/probes.js`: `{ name: pair(`Гілка ${name}`, `Branch ${name}`), body: rich('Опис гілки'), leader: 'Лідер гілки', phone: '+380 11 111-11-11', ctaUrl: null, media: [image(name)], ...extra }`.
  - Компоненти Storyblok `ministry_branches` («Розділ із гілками»), `ministry_branch` («Гілка»); вкладка `branches: 'Гілки'`.

- [ ] **Step 1: Failing-тести схеми** (`tests/schema.test.js`, plain Node `schemas.ministries.safeParse`)

```js
test('гілки: з гілками лідер і телефон служіння необовʼязкові', () => {
  const ok = ministry('b', { leader: null, phone: null, branches: { title: pair('Гілки', 'Branches'), items: [branch('a')] } });
  assert.equal(schemas.ministries.safeParse(ok).success, true);
  assert.equal(schemas.ministries.safeParse(ministry('b', { branches: { title: pair('Гілки', 'Branches'), items: [] } })).success, true);
  assert.equal(schemas.ministries.safeParse(ministry('b', { branches: null })).success, true);
  assert.equal(schemas.ministries.safeParse(ministry('b')).success, true); // ключа немає
});

test('гілки: без гілок лідер і телефон обовʼязкові — помилка з точним шляхом', () => {
  for (const branches of [undefined, null, { title: pair('Гілки', 'Branches'), items: [] }]) {
    for (const key of ['leader', 'phone']) {
      const r = schemas.ministries.safeParse(ministry('b', { [key]: null, ...(branches === undefined ? {} : { branches }) }));
      assert.equal(r.success, false);
      assert.ok(r.error.issues.some((i) => i.path.join('.') === key), JSON.stringify(r.error.issues));
    }
  }
});

test('гілки: правила полів гілки', () => {
  const bad = (b, path) => {
    const r = schemas.ministries.safeParse(ministry('b', { branches: { title: pair('Гілки', 'Branches'), items: [b] } }));
    assert.equal(r.success, false);
    assert.ok(r.error.issues.some((i) => i.path.join('.').startsWith(path)), `${path}: ${JSON.stringify(r.error.issues)}`);
  };
  bad(branch('a', { media: [] }), 'branches.items.0.media');
  bad(branch('a', { phone: 'дзвоніть' }), 'branches.items.0.phone');
  bad(branch('a', { ctaUrl: '#' }), 'branches.items.0.ctaUrl');
  bad(branch('a', { name: { uk: 'Гілка', en: ' ' } }), 'branches.items.0.name.en');
  bad(branch('a', { extra: 1 }), 'branches.items.0');
  const r = schemas.ministries.safeParse(ministry('b', { branches: { title: { uk: 'Гілки', en: '' }, items: [] } }));
  assert.equal(r.success, false);
});
```

`pair` у цьому файлі — локальний `(uk, en = uk) => ({ uk, en })`, якщо його ще немає.

- [ ] **Step 2: Failing-тести моделі й round-trip**

`tests/cms-model.test.js`: замінити всі `schemas.ministries.extend(` / `.omit(` на `ministryFields.extend(` / `.omit(` (імпорт `ministryFields`); додати:

```js
test('гілки: група служіння й поля гілки звіряються зі схемою', () => {
  assertError(errorsFor('ministries', ministryFields.extend({ branches: z.object({ title: localized, items: z.array(z.object({ name: localized }).strict()) }).strict().nullable().optional() })), '.branches');
});
```

`tests/cms-convert.test.js` → у `probes()` додати:

```js
['ministries', 'branches', ministry('branches', { leader: null, phone: null, branches: {
  title: pair('Гілки'), items: [
    branch('a', { media: [image('a'), video()], ctaUrl: 'https://example.test/join', body: { uk: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: 'uploads/b.jpg', alt: 'Фото' } }] }] }, en: docFromText('Text') } }),
    branch('b', { media: [{ type: 'image', src: 'uploads/branch-b.jpg', alt: 'Фото гілки' }] }),
  ] } })],
['ministries', 'branches-empty', ministry('branches-empty', { branches: { title: pair('Групи'), items: [] } })],
```

і тест:

```js
test('гілки: історія без ключа branches — null, схема проходить', () => {
  const story = toStory('ministries', 'x', ministry('x'), { asset });
  delete story.content.branches;
  const data = fromStory('ministries', story, { assetPath });
  assert.equal(data.branches, null);
  assert.equal(schemas.ministries.safeParse(data).success, true);
});
```

(Якщо `canonical` для відсутнього ключа дає `null`, round-trip-тест «кожен справжній запис» має порівнювати `canonical` — він уже так робить; переконатися, що наявні 18 служінь проходять.)

`tests/cms-components.test.js` — тест: компонент `ministry` має tab «Гілки» з ключем `branches`; існують компоненти `ministry_branches` і `ministry_branch` (`is_nestable: true`).

- [ ] **Step 3: Запустити — мають впасти**

Run: `node --test tests/schema.test.js tests/cms-model.test.js tests/cms-convert.test.js tests/cms-components.test.js`
Expected: FAIL (`branch` не експортується / `ministryFields` не визначено / `branches` невідомий ключ).

- [ ] **Step 4: Реалізація**

- `schema.mjs`: `ministryBranch` і `ministryBranches` як у спеці (розділ «Дані»); у служінні `leader: z.string().min(1).nullable()`, `phone: phone.nullable()`, `branches: ministryBranches.nullable().optional()`; `export const ministryFields = z.object({...}).strict()`; `const ministries = ministryFields.superRefine((m, ctx) => { if (hasBranches(m)) return; for (const key of ['leader', 'phone']) if (m[key] === null) ctx.addIssue({ code: 'custom', path: [key], message: `${key}: потрібен, коли в служінні немає гілок` }); })`.
- `model.mjs`: компоненти й поля рівно як у спеці (розділ «Модель Storyblok»); `leader`/`phone` служіння — `nullable: true`, `description: 'Можна лишити порожнім, якщо є гілки.'`; `ctaUrl` служіння — підпис без змін.
- `components.mjs`: `TABS` += `branches: 'Гілки'` (між `gallery` і `seo`).
- `probes.js`: `export const branch = …` (див. Interfaces).

- [ ] **Step 5: Тести проходять**

Run: `node --test tests/schema.test.js tests/cms-model.test.js tests/cms-convert.test.js tests/cms-components.test.js tests/cms-pull.test.js tests/cms-import.test.js tests/cms-verify.test.js`
Expected: PASS, усі.

- [ ] **Step 6: Commit**

```bash
git add src/lib/collections.mjs src/lib/schema.mjs src/lib/storyblok/model.mjs src/lib/storyblok/components.mjs tests/
git commit -m "feat: гілки служіння — схема й модель Storyblok"
```

---

### Task 2: Сторінка служіння з гілками

**Files:**
- Modify: `src/pages/[...lang]/ministries/[slug].astro`
- Modify: `src/styles/pages/ministry.css`
- Modify: `tests/page-ministries.test.js:47-80`
- Test: `tests/page-ministries.test.js` (нова пробна збірка)

**Interfaces:**
- Consumes: `hasBranches` (`src/lib/collections.mjs`), `branch()` (`tests/helpers/probes.js`), форма `branches` з Task 1.
- Produces: розмітка (на неї спирається Task 3):
  - `<section class="branches">` → `.container` → `<h2 class="branches-title">{title}</h2>` → для кожної гілки `<div class="layout branch">` з `<Gallery …/>` і `<div class="info">` (`<h3>` назва, `.desc` з `<Rich value={b.body}/>`, `.facts` (лідер, телефон), `a.btn` «Долучитися»).
  - Основний `.info` служіння: `.facts` і `.btn` рендеряться лише коли `!hasBranches(m)`.

- [ ] **Step 1: Failing-тест пробної збірки** (`tests/page-ministries.test.js`)

```js
test('гілки: розділ з назвою з CMS, слайдер і контакти кожної гілки; загальних контактів немає', { timeout: 180_000 }, () => {
  const withBranches = ministry('branchy', { leader: null, phone: null, branches: { title: { uk: 'Гілки', en: 'Branches' }, items: [
    branch('a', { media: [image('a1'), image('a2')], ctaUrl: 'https://example.test/join' }),
    branch('b', { phone: '+380 22 222-22-22' }),
  ] } });
  const empty = ministry('nobranch', { branches: { title: { uk: 'Гілки', en: 'Branches' }, items: [] } });
  withBuild((c) => { c.write('ministries', 'branchy', withBranches); c.write('ministries', 'nobranch', empty); }, (dist) => {
    for (const [lang, prefix] of LOCALES) {
      const root = dist.page(`${prefix}ministries/branchy/index.html`);
      assert.equal(root.querySelector('.branches-title').text, withBranches.branches.title[lang]);
      const items = root.querySelectorAll('.branch');
      assert.equal(items.length, 2);
      assert.equal(root.querySelectorAll('[data-gallery]').length, 3); // служіння + 2 гілки
      items.forEach((el, i) => assert.equal(el.querySelector('h3').text, withBranches.branches.items[i].name[lang]));
      assert.equal(items[0].querySelector('.btn').getAttribute('href'), 'https://example.test/join');
      assert.equal(items[1].querySelector('.btn').getAttribute('href'), 'tel:+380222222222');
      assert.equal(items[1].querySelector('.fact .val').text, 'Лідер гілки');
      assert.equal(items[1].querySelectorAll('[data-dot]').length, 0); // одне фото — без навігації
      const main = root.querySelector('section:not(.branches):not(.more) .info');
      assert.equal(main.querySelector('.facts'), null);
      assert.equal(main.querySelector('.btn'), null);
      const plain = dist.page(`${prefix}ministries/nobranch/index.html`);
      assert.equal(plain.querySelector('.branches'), null);
      assert.ok(plain.querySelector('.info .btn'));
    }
  });
});
```

`withBuild(prepare, check)`: `prepare` отримує `ContentFixture` (`write(collection, name, data)`), `check` — `{ failed, output, page(rel) }`; першим рядком у `check` — `assert.equal(dist.failed, false, dist.output)`.

- [ ] **Step 2: Зробити наявні тести гілко-залежними**

У тесті «кожне служіння має сторінку…» перевірки `.fact .val` і `.info .btn` обмежити основним блоком і виконувати лише `if (!hasBranches(m))`; інакше — `assert.equal(mainInfo.querySelector('.btn'), null)`. Тест галереї — брати `[data-slide]` лише з першого `[data-gallery]`.

- [ ] **Step 3: Запустити — новий тест падає**

Run: `npm run build && node --test tests/page-ministries.test.js`
Expected: FAIL на `.branches-title` (null).

- [ ] **Step 4: Реалізація шаблону й стилів**

- `[slug].astro`: `const branchy = hasBranches(m)`; `.facts` і `.btn` основного блоку — у `{!branchy && (…)}`; після основної `<section>` — `{branchy && <section class="branches">…</section>}` за розміткою з Interfaces; кнопка гілки `linkAttrs(base, lang, b.ctaUrl ?? telHref(b.phone))`; `videoTitle={`${pick(b.name, lang)} — ${t(lang, 'a11y.video')}`}`.
- `ministry.css`: лише `.branches-title` (розмір як `.more h2`) і відступ між `.branch` — наявна `.layout` уже дає колонки й одноколонковість на ≤900px; `.info h3` — той самий розмір, що `.info h2` (`1.5rem`), `font-weight:700`.

- [ ] **Step 5: Тести проходять**

Run: `npm test`
Expected: PASS повністю (включно з `site.test.js`: биті посилання, дублікати id).

- [ ] **Step 6: Візуальна перевірка «без змін»**

Run: зібрати `main` у `dist-ref` (`git stash`/worktree, `BASE_PATH=/`), поточну гілку в `dist` з `BASE_PATH=/`, потім `node scripts/lib/compare-screens.mjs dist-ref dist` і `node scripts/lib/diff-dirs.mjs dist-ref dist`.
Expected: сторінки служінь без гілок — 0 відмінностей (контент без гілок → усі 18 сторінок ідентичні, окрім спільного JS-бандла Gallery, якщо Task 3 уже злитий).

- [ ] **Step 7: Commit**

```bash
git add "src/pages/[...lang]/ministries/[slug].astro" src/styles/pages/ministry.css tests/page-ministries.test.js
git commit -m "feat: розділ гілок на сторінці служіння"
```

---

### Task 3: Стрілки клавіатури для кількох слайдерів + e2e

**Files:**
- Modify: `src/components/Gallery.astro` (лише `<script>`)
- Modify: `scripts/e2e-build.mjs` (вставити гілки в копію контенту)
- Modify: `tests/e2e/gallery.e2e.js`

**Interfaces:**
- Consumes: розмітка `.branch [data-gallery]` з Task 2; проба гілок.
- Produces: правило «останній, з яким взаємодіяли (`pointerdown`/`focusin`), інакше перший з `[data-slide]` > 1»; один `document.addEventListener('keydown', …)` на сторінку.

- [ ] **Step 1: e2e-фікстура.** У `scripts/e2e-build.mjs` після копіювання контенту записати `ministries/e2e-branches.json`: служіння з `order: 999`, `slug: 'e2e-branches'`, основна галерея з **одного** фото, `leader: null`, `phone: null`, `branches` з двома гілками по 3 фото (`https://picsum.photos/seed/…`), — будувати з `tests/helpers/probes.js` (`ministry`, `branch`, `image`).

- [ ] **Step 2: Failing e2e** (`tests/e2e/gallery.e2e.js`)

```js
test('кілька слайдерів: стрілки гортають лише той, з яким взаємодіяли', async () => {
  const page = await site.open('ministries/e2e-branches/');
  const active = (n) => page.locator('[data-gallery]').nth(n).locator('[data-slide].is-active')
    .evaluate((el) => [...el.parentElement.children].indexOf(el));
  await page.keyboard.press('ArrowRight');
  assert.deepEqual([await active(0), await active(1), await active(2)], [0, 1, 0], 'без взаємодії — перший багатослайдовий');
  await page.locator('[data-gallery]').nth(2).locator('[data-slide].is-active img').click();
  await page.keyboard.press('ArrowRight');
  assert.deepEqual([await active(1), await active(2)], [1, 1]);
  await page.close();
});
```

Наявні тести: `activeIndex` рахувати в межах `page.locator('[data-gallery]').first()`; вибір `navigable` — лише серед служінь, у яких перша галерея має > 1 медіа (`m.media.length > 1`), як і зараз.

- [ ] **Step 3: Запустити — падає**

Run: `npm run e2e -- tests/e2e/gallery.e2e.js` (або як запускає `package.json`)
Expected: FAIL — `[1, 1, 1]` (усі гортаються разом).

- [ ] **Step 4: Реалізація** у `<script>` `Gallery.astro`: цикл по `[data-gallery]` реєструє контролер `{ root, go, cur, size }` у масив; `pointerdown`/`focusin` на `root` ставить його активним; один `keydown` на `document` гортає `active ?? controllers.find((c) => c.size > 1)`. Решта поведінки (лінивий iframe, крапки, мініатюри) без змін.

- [ ] **Step 5: Тести проходять**

Run: `npm run e2e` і `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Gallery.astro scripts/e2e-build.mjs tests/e2e/gallery.e2e.js
git commit -m "feat: стрілки гортають слайдер, з яким взаємодіяли"
```

---

### Task 4: Документація

**Files:**
- Modify: `CLAUDE.md` (розділ Content — абзац «Гілки служіння (Spec 6)»; розділ Next — живий `cms:import` для нових компонентів і пункт для інструкції редактора Етапу 6)

- [ ] **Step 1:** Абзац у `CLAUDE.md` → Content: `ministries.branches` (optional+nullable група, `hasBranches`), правило «leader/phone обовʼязкові лише без гілок», `ministryFields` для тестів, стрілки Gallery. У Next: `npm run cms:import` (dry-run → `--apply` → dry-run 0 змін → `cms:verify`), інструкція Етапу 6 має описати вкладку «Гілки».
- [ ] **Step 2:** `npm test` — PASS.
- [ ] **Step 3: Commit** `docs: гілки служіння в CLAUDE.md`.
