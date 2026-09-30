# Спека 5: стрічка Facebook на головній — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** У секції `#media` головної показуються 12 останніх постів сторінки Facebook у горизонтальній каруселі. Стрічка оновлюється тричі на день, а без постів сайт показує ручні картки `homepage.news.items`. Page Plugin (`fb-embed`, SDK) зникає.

**Architecture:** `npm run fb:pull` одним запитом Graph API бере 12 постів, перевіряє кожен тією самою zod-схемою, що й збірка, і завантажує картинки в `public/uploads/facebook/`. Після цього записує по JSON на пост у `src/content/facebook/` через тимчасову теку, тож старий знімок не зникає, доки не готовий новий. Збірка читає це як ще одну колекцію Astro. Шаблон бере пости через `siteData().posts()`, а логіку поста (заголовок, опис, посилання, дата, формат картинки) рахують чисті функції `src/lib/facebook.mjs`. У CI код виходу `fb:pull` керує кешем знімка: 0/2 — зберегти, 1 — відновити минулий. Окрема задача `facebook-feed` падає вже після деплою, тож власник отримує лист, а деплой не страждає. Запуски тричі на день дає Cron Trigger прев'ю-воркера: власна точка входу воркера додає до обробника Astro `scheduled`, який у слоти за Києвом викликає той самий `dispatchDeploy`, що й вебхук Storyblok.

**Tech Stack:** Astro `^5.18.2`, `@astrojs/cloudflare` 12.6 (`workerEntryPoint`), zod 3 з `astro/zod`, Node ≥ 22.9 (`fetch`, `Intl` з повним ICU), Graph API `v23.0`, GitHub Actions (`actions/cache/save|restore@v4`), Cloudflare Workers Cron Triggers, `node:test`, Playwright.

**Spec:** [2026-09-30-05-facebook-feed-design.md](../specs/2026-09-30-05-facebook-feed-design.md). Попередній етап: [Етап 5](2026-09-25-storyblok-stage-5.md).

## Global Constraints

- **Жодної нової залежності.** Graph API — через `fetch`, фейк — `node:http`.
- **`npm test` не ходить у мережу.** Graph API і fbcdn відтворює `tests/helpers/fake-facebook.js` (база через `FACEBOOK_GRAPH_URL`).
- **Токен ніколи не потрапляє у вивід:** кожне повідомлення `fb:pull` проходить через заміну значення токена (і його URL-кодованої форми) на `<TOKEN>`.
- **Коди виходу `fb:pull`:** 0 — знімок записано повністю; 2 — записано, але частину постів відкинула схема; 1 — нічого не записано (API, мережа, оточення).
- **`GRAPH_VERSION = 'v23.0'`**, `limit=12`, поля `message,created_time,permalink_url,full_picture,attachments{media_type,media,subattachments{media}}`.
- **Слоти:** `FEED_SLOTS = [9, 15, 20]` за `Europe/Kyiv`, cron `"10 6,7,12,13,17,18 * * *"` (UTC).
- **Деплой через Facebook не падає ніколи**; падає лише задача `facebook-feed` після деплою.
- `src/content/facebook/` і `public/uploads/facebook/` — у `.gitignore`. Порожня колекція валідна.
- Колекції `facebook` немає в `model.mjs`; `checkModel()` пропускає її явно.
- Контракт з адмінкою (CLAUDE.md): тести виводять очікування з даних, `src/content` не чіпають, проби — через `withBuild` / `HOB_CONTENT_DIR`.
- Без `<style>` в `.astro`, лише наявні токени кольорів; Nyght Serif — `font-weight:700`.
- Коментарі й назви тестів українською, коментар пояснює *чому*. ESM `.mjs`, 2 пробіли, одинарні лапки, крапка з комою.
- Файли контенту з CRLF — правити точково (Edit).
- Кожна задача закінчується зеленим `npm test` і комітом із кінцівкою `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Зафіксовані рішення цього плану

| # | Питання | Рішення | Підстава |
|---|---|---|---|
| 1 | Як шаблон отримує пости | Метод `posts()` у `Site`. `siteData()` додає його і в статичній збірці, і на прев'ю: пости завжди з колекції збірки, бо в Storyblok їх немає | CLAUDE.md: шаблони читають дані лише через `siteData` |
| 2 | Назва колекції | `facebook` (тека `src/content/facebook/`), схема `facebookPosts`, у `schemas` під ключем `facebook` | Спека: «Схема (`facebookPosts` у `src/lib/schema.mjs`)» |
| 3 | Унікальність `id` | `collectionLoader(name, key)` перевіряє поле `key` (`slug` для решти, `id` для facebook) через `assertUniqueSlugs(collection, items, field)` | Та сама обгортка, а не нова |
| 4 | Токен у запиті | query `access_token` (як у пробному запиті), вивід редагується | Документований спосіб Graph API |
| 5 | Ключ кешу | `facebook-feed-${{ github.run_id }}-${{ github.run_attempt }}` | Повторний запуск прогону інакше впирався б у вже зайнятий ключ; `restore-keys: facebook-feed-` так само знаходить останній |
| 6 | Тимчасові теки | `<ціль>.new` поруч із ціллю (`src/content/facebook.new`, `public/uploads/facebook.new`), rename після запису | rename у межах тієї самої теки; збірка їх не читає |
| 7 | Підпис стрічки для скрінрідера | новий рядок `a11y.facebookFeed` | `role="region"` потребує назви |
| 8 | `cms:pull` і картинки Facebook | `localizeAssets` не шукає збігів у `uploads/facebook` | Інакше картинка з медіатеки, однакова з постом, вела б на файл, що зникне з наступним `fb:pull` |

## Review Focus

1. **Довгий рядок без пробілів** (голе посилання першим рядком, довге слово) не дає горизонтальної прокрутки сторінки — `overflow-wrap:anywhere` і на заголовку, і на описі. Пін: e2e-фікстура має пост з URL у першому рядку, тест «немає горизонтальної прокрутки» (Задача 6).
2. **Текст поста з `<script>`, `&amp;`, `<3`** показується буквально, а не як HTML. Пін: `linkify` екранує (Задача 1) і пробна збірка з таким постом (Задача 5).
3. **Пост без `message` і без медіа** (зміна обкладинки, подія) — картка без заголовка й опису, з логотипом. Пін: `fb:pull`-тест «пост без медіа» (Задача 3) і проба на 12 постів (Задача 5).
4. **Залишки перерваного прогону** (`facebook.new` з минулого разу) не потрапляють у новий знімок. Пін: тест `fb:pull` зі сміттям у тимчасовій теці (Задача 3).
5. **`cms:pull` не прив'язує картинку медіатеки до `uploads/facebook`**. Пін: тест у `cms-pull.test.js` (Задача 3).

---

### Task 1: Чиста логіка поста (`src/lib/facebook.mjs`)

**Files:**
- Create: `src/lib/facebook.mjs`
- Test: `tests/facebook-lib.test.js`

**Interfaces:**
- Produces:
  - `splitPost(text: string) → { title: string | null, body: string | null }`
  - `linkify(text: string) → string` (безпечний HTML)
  - `formatPostDate(iso: string, lang: 'uk'|'en') → string`
  - `isWide(image: { width, height }) → boolean` (`≥ 1.5`)
  - `sortPosts(posts) → posts` (за `date` від новіших, далі `id`)
  - `postDateTime(iso) → string` (ISO для `<time datetime>`)

- [ ] **Step 1: Тести**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPostDate, isWide, linkify, postDateTime, sortPosts, splitPost } from '../src/lib/facebook.mjs';

test('splitPost: заголовок — перший непорожній рядок, опис — решта через пробіл', () => {
  assert.deepEqual(splitPost(''), { title: null, body: null });
  assert.deepEqual(splitPost('  \n \n'), { title: null, body: null });
  assert.deepEqual(splitPost('Один рядок'), { title: 'Один рядок', body: null });
  assert.deepEqual(splitPost('\n\n  Заголовок \n\nПерший\r\n  \nДругий  '), { title: 'Заголовок', body: 'Перший Другий' });
});

test('linkify: екранує текст, робить клікабельними лише http(s)', () => {
  assert.equal(linkify('<b>Тиша</b> & <3'), '&lt;b&gt;Тиша&lt;/b&gt; &amp; &lt;3');
  assert.equal(
    linkify('Дивіться https://example.com/a?b=1&c=2.'),
    'Дивіться <a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">https://example.com/a?b=1&amp;c=2</a>.',
  );
  assert.equal(linkify('javascript:alert(1)'), 'javascript:alert(1)');
  assert.equal(linkify('ftp://x.y'), 'ftp://x.y');
});

test('linkify: кінцеві розділові знаки лишаються поза посиланням, посилань кілька', () => {
  const html = linkify('(http://a.test/x), «https://b.test/y»!? кінець');
  assert.match(html, /^\(<a href="http:\/\/a\.test\/x"[^>]*>http:\/\/a\.test\/x<\/a>\), «<a href="https:\/\/b\.test\/y"[^>]*>https:\/\/b\.test\/y<\/a>»!\? кінець$/);
});

test('linkify: лапки в адресі не виходять з атрибута', () => {
  assert.equal(linkify('https://a.test/"onmouseover="x'), '<a href="https://a.test/" target="_blank" rel="noopener noreferrer">https://a.test/</a>&quot;onmouseover=&quot;x');
});

test('formatPostDate: київська дата мовою сторінки, без «р.»', () => {
  // 22:30 UTC 29 вересня — у Києві вже 30-те.
  assert.equal(formatPostDate('2026-09-29T22:30:09+0000', 'uk'), '30 вересня 2026');
  assert.equal(formatPostDate('2026-09-29T22:30:09+0000', 'en'), '30 September 2026');
  // Взимку зсув +2: 21:30 UTC — ще той самий день.
  assert.equal(formatPostDate('2027-01-14T21:30:00+0000', 'uk'), '14 січня 2027');
  assert.equal(formatPostDate('2027-01-14T22:30:00+0000', 'uk'), '15 січня 2027');
});

test('isWide: від 1.5 — широке', () => {
  assert.equal(isWide({ width: 1600, height: 900 }), true);
  assert.equal(isWide({ width: 1500, height: 1000 }), true);
  assert.equal(isWide({ width: 1200, height: 900 }), false);
  assert.equal(isWide({ width: 576, height: 1280 }), false);
});

test('sortPosts: новіші першими, на рівних датах — за id; вхід не змінюється', () => {
  const posts = [
    { id: '1_1', date: '2026-09-28T10:00:00+0000' },
    { id: '1_3', date: '2026-09-29T10:00:00+0000' },
    { id: '1_2', date: '2026-09-29T10:00:00+0000' },
  ];
  assert.deepEqual(sortPosts(posts).map((p) => p.id), ['1_2', '1_3', '1_1']);
  assert.equal(posts[0].id, '1_1');
});

test('postDateTime: валідний для <time datetime>', () => {
  assert.equal(postDateTime('2026-09-29T10:00:09+0000'), '2026-09-29T10:00:09.000Z');
});
```

- [ ] **Step 2:** `node --test tests/facebook-lib.test.js` → FAIL (модуля немає).

- [ ] **Step 3: Реалізація**

```js
// Логіка картки поста Facebook (Спека 5). Чисті функції: їх рахує шаблон
// головної на збірці й на прев'ю, а тести — без збірки.

const LOCALE_TAG = { uk: 'uk-UA', en: 'en-GB' };

// Пост — не стаття: заголовка в нього немає. Перший непорожній рядок —
// найближче до заголовка, решта — опис одним абзацом (картка обрізає його
// line-clamp, переноси там лише заважали б).
export function splitPost(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { title: null, body: null };
  return { title: lines[0], body: lines.length > 1 ? lines.slice(1).join(' ') : null };
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

// Лише http(s): інші схеми (javascript:, data:) лишаються текстом. Адреса
// закінчується на пробілі, лапці чи куті — і кінцеві розділові знаки
// речення («…див. https://x.org.») до неї не входять.
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'«»]+/gi;
const TRAILING = /[.,;:!?)»]+$/;

// Пост — чужий текст, і <b> чи <3 у ньому — просто символи. Тому весь
// текст екранується, а розмітка — лише наша, <a> навколо посилань.
export function linkify(text) {
  let html = '';
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING, '');
    html += escapeHtml(text.slice(last, match.index));
    const href = escapeHtml(url);
    html += `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`;
    last = match.index + url.length;
  }
  return html + escapeHtml(text.slice(last));
}

// Дата — київська: пост о 01:00 за Києвом у UTC ще «вчора». Частини
// збираються вручну: uk-UA додає «р.», en-US ставить місяць першим.
export function formatPostDate(iso, lang) {
  const parts = new Intl.DateTimeFormat(LOCALE_TAG[lang], {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv',
  }).formatToParts(new Date(iso));
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('day')} ${part('month')} ${part('year')}`;
}

// Facebook віддає «+0000», а <time datetime> хоче «+00:00» чи «Z».
export const postDateTime = (iso) => new Date(iso).toISOString();

// Широке медіа заповнює рамку 16:9; вужче (4:3, 1:1, reels 9:16) стоїть
// цілком — обрізання з'їло б половину кадру.
export const isWide = ({ width, height }) => width / height >= 1.5;

export const sortPosts = (posts) => [...posts].sort(
  (a, b) => Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
);
```

- [ ] **Step 4:** `node --test tests/facebook-lib.test.js` → PASS.
- [ ] **Step 5:** Commit `feat: логіка картки поста Facebook (Спека 5)`.

---

### Task 2: Колекція `facebook` — схема, завантажувач, `siteData().posts()`

**Files:**
- Modify: `src/lib/schema.mjs` (нова `facebookPosts`, ключ `facebook` у `schemas`)
- Modify: `src/lib/collections.mjs` (`assertUniqueSlugs(collection, items, field = 'slug')`)
- Modify: `src/content.config.ts` (`collectionLoader(name, key)`, колекція `facebook`)
- Modify: `src/lib/storyblok/check.mjs` (`NOT_IN_CMS`)
- Modify: `src/lib/site-data.ts`, `src/env.d.ts`
- Modify: `.gitignore`
- Test: `tests/content-schema.test.js`, `tests/cms-model.test.js`, `tests/lib.test.js`

**Interfaces:**
- Consumes: `sortPosts` (Task 1).
- Produces: `schemas.facebook` / `facebookPosts`; `Site.posts(): FacebookPost[]` (відсортовані); `FacebookPost = { id, date, url, text, video, image: { src, width, height } | null }`.

- [ ] **Step 1: Тести схеми** — у `tests/content-schema.test.js` (пробні збірки) і юніт-перевірки `safeParse` у `tests/facebook-lib.test.js`:

```js
// tests/facebook-lib.test.js (дописати)
import { schemas } from '../src/lib/schema.mjs';
const post = (extra = {}) => ({
  id: '238298299705573_1515024300669995', date: '2026-09-29T10:00:09+0000',
  url: 'https://www.facebook.com/1266500102189084/posts/1515024300669995', text: 'Текст', video: false,
  image: { src: 'uploads/facebook/238298299705573_1515024300669995.jpg', width: 576, height: 1280 }, ...extra,
});
const ok = (data) => schemas.facebook.safeParse(data).success;

test('схема поста: цілісність id, дати, адреси й картинки', () => {
  assert.equal(ok(post()), true);
  assert.equal(ok(post({ image: null, text: '' })), true, 'порожній текст і пост без картинки валідні');
  assert.equal(ok(post({ text: '<b>Тиша</b> <3' })), true, 'розмітка в тексті поста — просто текст');
  for (const id of ['1515024300669995', '238_x', '../x_1', '']) assert.equal(ok(post({ id })), false, id);
  for (const date of ['2026-09-29', 'вчора', '2026-13-45T10:00:00+0000']) assert.equal(ok(post({ date })), false, date);
  for (const url of ['http://www.facebook.com/x', 'https://evil.test/x', 'https://www.facebook.com.evil.test/x']) assert.equal(ok(post({ url })), false, url);
  for (const image of [
    { src: '/uploads/facebook/a.jpg', width: 1, height: 1 },
    { src: 'https://scontent.xx.fbcdn.net/a.jpg', width: 1, height: 1 },
    { src: 'uploads/facebook/a.jpg', width: 0, height: 1 },
    { src: 'uploads/facebook/a.jpg', width: 1.5, height: 1 },
    { src: 'uploads/facebook/a.jpg', width: 1 },
  ]) assert.equal(ok(post({ image })), false, JSON.stringify(image));
  assert.equal(ok({ ...post(), extra: 1 }), false, 'невідомий ключ');
});
```

```js
// tests/content-schema.test.js (дописати): дубль id — лише завантажувач бачить обидва файли.
test('два пости з однаковим id валять збірку з назвами обох файлів', T, () => {
  const data = { id: '1_2', date: '2026-09-29T10:00:09+0000', url: 'https://www.facebook.com/1/posts/2', text: '', video: false, image: null };
  const { failed, output } = withBuild((content) => {
    content.write('facebook', 'probe-a', data);
    content.write('facebook', 'probe-b', data);
  }, (result) => result);
  assert.equal(failed, true, 'збірка пройшла з дублікатом id');
  assert.match(output, /probe-a/);
  assert.match(output, /probe-b/);
});

test('невалідний пост валить збірку в схемі', T, () => {
  expectFailure('facebook', { id: 'x', date: '2026-09-29T10:00:09+0000', url: 'https://www.facebook.com/1', text: '', video: false, image: null }, /id/, 'збірка пройшла з id не у форматі Facebook');
});
```

```js
// tests/cms-model.test.js (дописати)
test('стрічку Facebook у Storyblok не редагують: колекція в схемі є, у моделі — ні', () => {
  assert.ok('facebook' in schemas);
  assert.equal('facebook' in COLLECTIONS, false);
  assert.deepEqual(checkModel(), []);
});
```

- [ ] **Step 2:** запустити — FAIL (`schemas.facebook` undefined).

- [ ] **Step 3: Схема** (`src/lib/schema.mjs`, перед `schemas`):

```js
// Стрічка Facebook (Спека 5): знімок, який пише npm run fb:pull, а не
// редактор. Два свідомі винятки із загальних правил: text — не {uk, en}
// (пост існує однією мовою), і в ньому немає заборони розмітки — «<3» чи
// «<b>» у чужому пості лише текст (шаблон екранує), і такий пост не має
// зупиняти деплой.
export const facebookPosts = z.object({
  // Із id складається імʼя файлу картинки — формат захищає від «../».
  id: z.string().regex(/^\d+_\d+$/, 'id: формат Facebook «<сторінка>_<пост>»'),
  date: z.string().datetime({ offset: true, message: 'date: ISO-дата з часом' }),
  url: z.string().regex(/^https:\/\/www\.facebook\.com\//, 'url: посилання https://www.facebook.com/…'),
  text: z.string(),
  video: z.boolean(),
  image: z.object({
    src: z.string().regex(/^uploads\//, 'image.src: відносний шлях uploads/…'),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).strict().nullable(),
}).strict();
```

і в `schemas` — `facebook: facebookPosts`.

- [ ] **Step 4: Унікальність id.** `assertUniqueSlugs(collection, items, field = 'slug')`: повідомлення `${collection}: ${field} «${slug}» уже зайнятий записом «…» — дайте запису «…» інший ${field}`. `collectionLoader(name, key = 'slug')` передає `entry.data[key]` і `key`. Колекція: `facebook: defineCollection({ loader: collectionLoader('facebook', 'id'), schema: schemas.facebook })`.

- [ ] **Step 5: `checkModel`.** У `check.mjs`: `const NOT_IN_CMS = new Set(['facebook']);` і `continue` для таких колекцій у циклі по `schemas`, з коментарем «Стрічку Facebook пише fb:pull, у Storyblok її не редагують (Спека 5)».

- [ ] **Step 6: `siteData`.**

```ts
// src/lib/site-data.ts
import { sortPosts } from './facebook.mjs';
export type FacebookPost = CollectionEntry<'facebook'>['data'];
export interface Site {
  // …
  posts(): FacebookPost[];
}
// Стрічку Facebook у Storyblok не редагують (Спека 5): і збірка, і прев'ю
// беруть її з колекції цієї збірки (fb:pull перед astro build).
export async function siteData(locals?: App.Locals): Promise<Site> {
  const site = locals?.site ?? (await fromCollections());
  const posts = sortPosts((await getCollection('facebook')).map((entry) => entry.data));
  return { ...site, posts: () => posts };
}
```

`fromCollections` повертає `Omit<Site, 'posts'>`; `env.d.ts`: `site?: Omit<import('./lib/site-data').Site, 'posts'>`.

- [ ] **Step 7:** `.gitignore`:

```
# Стрічка Facebook (Спека 5): знімок npm run fb:pull, не джерело
src/content/facebook/
public/uploads/facebook/
```

- [ ] **Step 8:** `npm test` → PASS. Commit `feat: колекція постів Facebook — схема, унікальність id, siteData().posts()`.

---

### Task 3: `npm run fb:pull`

**Files:**
- Create: `scripts/facebook/feed.mjs` (ядро), `scripts/facebook/pull.mjs` (CLI)
- Create: `tests/helpers/fake-facebook.js`, `tests/facebook-pull.test.js`
- Modify: `package.json` (`"fb:pull": "node --env-file-if-exists=.env scripts/facebook/pull.mjs"`)
- Modify: `scripts/cms/assets.mjs` (не шукати збігів у `uploads/facebook`), `tests/cms-pull.test.js`

**Interfaces:**
- Consumes: `schemas.facebook` (Task 2).
- Produces: `GRAPH_VERSION`, `GRAPH_URL`, `POST_LIMIT`, `FB_UPLOADS = 'uploads/facebook'`, `FB_CONTENT = 'facebook'`, `postsUrl(graphUrl, pageId, token)`, `redactor(token) → (s) => string`, `toRecord(post)`, `runFeedPull({ pageId, token, graphUrl, contentDir, publicDir, fetch, log, error }) → { exitCode }`. CLI: `--out <тека контенту> --public <тека public>`; змінні `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_TOKEN`, `FACEBOOK_GRAPH_URL`.

- [ ] **Step 1: Фейк Graph API** (`tests/helpers/fake-facebook.js`): HTTP-сервер на `127.0.0.1:0`. `GET /<GRAPH_VERSION>/<page>/posts` — перевіряє `access_token`; при хибному токені чи `fake.fail = { status }` — `{ error: { message: 'Invalid OAuth access token <token>', code: 190 } }` (текст свідомо містить токен); інакше `{ data: fake.posts, paging: { next: '<origin>/…?access_token=<token>&after=x' } }`. `GET /img/<name>` — байти `public/uploads/hero-cross.jpg`, або 404 для імен з `fake.missing`. Помічники-пости: `videoPost`, `albumPost`, `sharePost`, `photoPost`, `textPost`.

- [ ] **Step 2: Тести** (`tests/facebook-pull.test.js`) — CLI у дочірньому процесі (`spawnSync`), теки в `tmpdir`:
  - відео / альбом (розміри з першої підкартинки) / репост / фото / текст без медіа → записи дорівнюють очікуваним (`video`, `image`), код 0, картинки лежать у `public/uploads/facebook/<id>.jpg` і збігаються з байтами фейка;
  - другий прогін з іншим набором прибирає застарілі пости й картинки;
  - помилка API (хибний токен, 500) → код 1, старий знімок і картинки не змінено;
  - немає `FACEBOOK_PAGE_TOKEN` / `FACEBOOK_PAGE_ID` → код 1 з назвою змінної;
  - картинка 404 → у поста `image: null`, код 0, рядок у лозі;
  - пост без `permalink_url` / з битим id → відкинуто, решта записана, код 2;
  - сміття в `facebook.new` з минулого прогону у знімок не потрапляє (Review Focus 4);
  - у жодному сценарії stdout/stderr не містять токена.

- [ ] **Step 3: Реалізація `feed.mjs`** — див. код у репозиторії; ключові правила:
  - валідація схемою **до** завантаження картинки (id стає імʼям файлу);
  - дубль id у відповіді — відкинуто з попередженням (код 2);
  - запис у `<ціль>.new`, після всього — `rm` цілі й `rename`; теки `.new` прибираються і на старті, і в `finally`;
  - усе, що йде в лог, — через `redactor(token)`.

- [ ] **Step 4:** `scripts/cms/assets.mjs`: `known` будується з `uploads/`, крім `uploads/facebook/`. Тест у `cms-pull.test.js`: файл у `public/uploads/facebook/`, байт у байт як картинка медіатеки → запис веде в `uploads/cms/…`.

- [ ] **Step 5:** `npm test` → PASS. Commit `feat: npm run fb:pull — знімок стрічки Facebook`.

---

### Task 4: Розклад — `dispatchDeploy`, `shouldDispatch`, точка входу воркера

**Files:**
- Create: `src/preview/dispatch.mjs`, `src/preview/schedule.mjs`, `src/preview/worker.ts`
- Modify: `src/preview/hook.mjs`, `astro.config.mjs`, `wrangler.jsonc`
- Test: `tests/preview-hook.test.js`, `tests/preview-schedule.test.js`, `tests/preview.test.js`

**Interfaces:**
- Produces: `dispatchDeploy(env, fetch) → Promise<{ ok: true } | { ok: false, error: string }>`; `FEED_SLOTS`; `shouldDispatch(scheduledTime: number) → boolean`; `handleScheduled({ scheduledTime, env, fetch, log }) → Promise<{ dispatched: boolean }>`; `createExports(manifest)` з `fetch` і `scheduled`.

- [ ] **Step 1: Тести розкладу** (`tests/preview-schedule.test.js`):

```js
const wrangler = JSON.parse(readFileSync(join(projectRoot, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const [cron] = wrangler.triggers.crons;
// Моменти спрацювань cron за одну добу UTC.
function firings(day) {
  const [minute, hours] = cron.split(' ');
  return hours.split(',').map((h) => Date.parse(`${day}T${h.padStart(2, '0')}:${minute.padStart(2, '0')}:00Z`));
}
const kyivHour = (ms) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Kyiv' }).format(ms));

test('кожен слот рівно раз на добу — улітку, взимку й у дні переходу годинника', () => {
  for (const day of ['2026-07-15', '2027-01-15', '2026-10-25', '2027-03-28']) {
    const hit = firings(day).filter(shouldDispatch).map(kyivHour);
    assert.deepEqual(hit, FEED_SLOTS, day);
  }
});
test('cron — одна позиція, щохвилини :10', …);
test('cron-обробник викликає GitHub лише в слот', …);
test('помилка GitHub — рядок у лозі без токена, без винятку', …);
```

- [ ] **Step 2: Тести `dispatchDeploy`** у `preview-hook.test.js`: адреса, заголовки, `ref`; `GITHUB_WORKFLOW`/`GITHUB_REF` перекривають типові; без змінних — `{ ok: false }` без запиту; відмова GitHub — `{ ok: false, error }` без токена.

- [ ] **Step 3: Реалізація.** `dispatch.mjs` — тіло запиту з `hook.mjs`; `hook.mjs` після перевірки підпису й події викликає `dispatchDeploy` і на `!ok` відповідає 502 з `error`. `schedule.mjs` — `FEED_SLOTS`, `shouldDispatch`, `handleScheduled`. `worker.ts`:

```ts
import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { handle } from '@astrojs/cloudflare/handler';
import { handleScheduled } from './schedule.mjs';

type Handle = typeof handle;
export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      fetch: (request: Parameters<Handle>[2], env: Parameters<Handle>[3], context: Parameters<Handle>[4]) =>
        handle(manifest, app, request, env, context),
      scheduled: (controller: { scheduledTime: number }, env: Record<string, unknown>, context: { waitUntil(p: Promise<unknown>): void }) => {
        context.waitUntil(handleScheduled({ scheduledTime: controller.scheduledTime, env }));
      },
    },
  };
}
```

`astro.config.mjs`: `cloudflare({ platformProxy: { enabled: false }, imageService: 'passthrough', workerEntryPoint: { path: 'src/preview/worker.ts' } })`. `wrangler.jsonc`: `"triggers": { "crons": ["10 6,7,12,13,17,18 * * *"] }`.

- [ ] **Step 4:** `preview.test.js`, тест збірки прев'ю: у `_worker.js` є обробник `scheduled`.
- [ ] **Step 5:** `npm test` → PASS. Commit `feat: cron прев'ю-воркера запускає деплой тричі на день`.

---

### Task 5: Карусель постів на головній

**Files:**
- Create: `src/scripts/carousel.mjs`, `tests/fixtures/facebook-posts.json`
- Modify: `src/pages/[...lang]/index.astro`, `src/styles/pages/home.css`, `src/i18n/{uk,en}.json`
- Modify: `src/lib/schema.mjs`, `src/lib/storyblok/model.mjs`, `src/content/singletons/homepage.json` (прибрати `homepage.fb`)
- Test: `tests/page-home.test.js`

**Interfaces:**
- Consumes: `Site.posts()` (Task 2), `splitPost`, `linkify`, `formatPostDate`, `isWide`, `postDateTime` (Task 1).
- Produces: `bindCarousel(track: HTMLElement, prev: Element | null, next: Element | null)`; розмітка `.fb-track[data-fb-track]` з `article.news-card.fb-card`, кнопки `[data-fb-prev]`/`[data-fb-next]` у `.tst-ctrls`.

- [ ] **Step 1: Фікстура** `tests/fixtures/facebook-posts.json` — 12 постів із різними датами (перемішаний порядок у файлі): широкі (`uploads/hero-cross.jpg` 1900×1266, `uploads/logo.png` 1484×628), вузькі (`uploads/hero-cross-mobile.jpg` 900×1351, `uploads/draw-95de…png` 1113×838), без картинки, без тексту, з посиланнями, з `<script>` і `&amp;` у тексті, з URL першим рядком, відео.

- [ ] **Step 2: Тести** (`tests/page-home.test.js`):
  - основна збірка: якщо в `src/content/facebook` є пости — карток `.fb-card` стільки ж і немає `.news-grid`; інакше — ручні картки; `connect.facebook.net`, `.fb-embed`, `#fb-root` немає ніколи;
  - проба: 0 постів → ручні картки, немає `.fb-track`;
  - проба: 0 постів і 0 ручних карток → немає ні того, ні іншого;
  - проба: 1 пост → немає `.tst-ctrls` у `#media`;
  - проба: 12 постів з фікстури → 12 карток у порядку дат; класи `is-wide`/`is-narrow`/`is-empty` за розмірами; `lang="uk"` на заголовку й описі `/en/`; посилання з опису мають `target="_blank" rel="noopener noreferrer"`; текст з `<script>` — буквальний; «Читати далі» → `url`; дата — `formatPostDate`; `role="region"` з `aria-label`; `findBrokenLinks` чистий.

- [ ] **Step 3: Прибрати `homepage.fb`** зі схеми, `model.mjs` (`fb` і `home_fb`) і `homepage.json` (точково, CRLF).

- [ ] **Step 4: Шаблон.** У `#media`: пости → `.fb-track` + кнопки від двох постів; інакше `news-grid`, якщо ручних карток більше нуля. Прибрати `#fb-root`, SDK, `fb-embed`, `fbLocale`, `fbCaption`, `fbShort`. Карусель свідчень і стрічки — через `bindCarousel`.

- [ ] **Step 5: CSS** (`home.css`): `.fb-track` як `.tst-track`; `.fb-card{flex:0 0 calc((100% - 3 * 1.5rem) / 4)}`, на 1024px — `calc((100% - 1.5rem) / 2)`, на 680px — `100%`; `.fb-thumb` 16:9 на `--dark-section`; `is-narrow` — `contain` поверх розмитої копії; `is-empty` — логотип по центру; `.fb-play`; `line-clamp` 2 і 5; `overflow-wrap:anywhere`. Видалити правила `.fb-embed`.

- [ ] **Step 6:** i18n: `a11y.prevPost`, `a11y.nextPost`, `a11y.facebookFeed` в обох мовах.
- [ ] **Step 7:** `npm test` → PASS. Commit `feat: карусель постів Facebook у «Медіа та новини» замість Page Plugin`.

---

### Task 6: E2E

**Files:**
- Modify: `scripts/e2e-build.mjs` (тимчасова копія контенту з постами з фікстури, `HOB_CONTENT_DIR`)
- Modify: `tests/e2e/home.e2e.js`

- [ ] **Step 1:** `e2e-build.mjs` копіює `src/content` у `tmpdir`, замінює `facebook/` постами з `tests/fixtures/facebook-posts.json` і збирає з `HOB_CONTENT_DIR`; тимчасова тека прибирається у `finally`.
- [ ] **Step 2: Тести:** стрілки гортають `[data-fb-track]` (вперед — `scrollLeft` росте, назад — повертається); на 1440px видно рівно 4 картки, на 390px — 1 (картка «видна», якщо вміщується в прямокутник стрічки); на 1440 і 390 `scrollWidth` документа не більший за `clientWidth`.
- [ ] **Step 3:** `npm run e2e` → PASS. Commit `test: e2e каруселі постів Facebook`.

---

### Task 7: CI і документація

**Files:**
- Modify: `.github/workflows/deploy.yml`, `tests/deploy.test.js`
- Modify: `CLAUDE.md`, `docs/superpowers/notes/2026-09-23-content-gaps.md` (рядок 22 — закрито)

- [ ] **Step 1: Тести** (`deploy.test.js`): крок `Pull Facebook feed` (`id: fb`) іде після `cms:pull` і до `npm test`, має `set +e`, пише `code=$?` у `$GITHUB_OUTPUT`, секрет `FACEBOOK_PAGE_TOKEN` і `vars.FACEBOOK_PAGE_ID`; `actions/cache/save` з умовою `steps.fb.outputs.code != '1'`, `actions/cache/restore` з `== '1'` і `restore-keys: facebook-feed-`, обидва до `npm test`, обидва кешують обидві теки; `build.outputs.facebook`; задача `facebook-feed`: `needs: [build, deploy]`, `if: always()`, падає при коді ≠ 0.
- [ ] **Step 2:** `deploy.yml` за спекою.
- [ ] **Step 3:** CLAUDE.md: команда `fb:pull`, колекція `facebook` і її два винятки, cron воркера, кроки CI, налаштування власника.
- [ ] **Step 4:** `npm test` → PASS. Commit `ci: стрічка Facebook у деплої — кеш знімка й задача-сигнал`.

## Налаштування, яке робить власник (після злиття)

1. GitHub: секрет `FACEBOOK_PAGE_TOKEN`, змінна `FACEBOOK_PAGE_ID=238298299705573`.
2. Cloudflare Workers Builds (`dim-hliba-preview`): ті самі два значення як build-секрети; команда збірки `npm run fb:pull || true; npm run build`.
3. `npm run cms:import -- --apply` — прибрати `homepage.fb` із компонента Storyblok.
