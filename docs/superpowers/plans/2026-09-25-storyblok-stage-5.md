# Етап 5: Astro читає Storyblok, прев'ю-стенд, Visual Editor, вебхук — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Продакшн-сайт збирається з опублікованого контенту Storyblok, а картинки медіатеки лежать поруч із ним. Редактор бачить чернетку на прев'ю-стенді Cloudflare Pages у Visual Editor. «Опублікувати» запускає деплой, і невалідний контент до сайту не доходить.

**Architecture:** Збірка не отримує нового завантажувача. `npm run cms:pull` через Content Delivery API читає опубліковану версію, проганяє її через `fromStory` і ті самі перевірки, що й імпорт, завантажує файли медіатеки в `public/` і записує контент у форматі `src/content`. Після цього `astro build` і `npm test` працюють як раніше, тобто з усім контрактом «що пропускає схема, те збирається». Прев'ю — це друга конфігурація тієї самої збірки (`HOB_PREVIEW=true`): серверний режим, адаптер Cloudflare і middleware. На кожен запит middleware читає чернетку, перевіряє доступ редактора і передає дані шаблонам через `Astro.locals`. Шаблони читають дані лише через один шар `siteData()`, тому не знають, звідки дані прийшли. Вебхук Storyblok приймає маршрут прев'ю-стенду: він перевіряє підпис і запускає `deploy.yml` через GitHub API. Цей самий запуск `deploy.yml` оновлює й статичну копію сайту на Cloudflare Pages (Задача 10): окремим завданням, з тим самим контентом, що пройшов `npm test`.

**Tech Stack:** Astro `^5.18.2`, **нова залежність `@astrojs/cloudflare` `^12`** (рядок адаптера для Astro 5), Node ≥ 22.9 (`--env-file-if-exists`, вбудовані `fetch`, Web Crypto), zod 3 з `astro/zod`, `node:test`, Storyblok Content Delivery API v2, Storyblok Bridge v2 (скрипт з CDN Storyblok, лише на прев'ю), GitHub Actions `workflow_dispatch`, Cloudflare Pages (Git-інтеграція).

**Spec:** [2026-09-22-03-storyblok-cms-design.md](../specs/2026-09-22-03-storyblok-cms-design.md): розділи «Інтеграція з Astro», «Прев'ю-стенд і Visual Editor», «Публікація», «Ризики», критерії готовності 3–8. Етап 6 (передача редактору, інструкція) сюди **не** входить.
Попередній етап: [Етап 4](2026-09-24-storyblok-stage-4.md). Код, на який план спирається: `src/lib/storyblok/{model,convert}.mjs`, `scripts/cms/{client,content,sync}.mjs`, `tests/helpers/{fake-storyblok,cms,build}.js`.

## Global Constraints

- **Node ≥ 22.9** (`engines` у `package.json`): `cms:pull` запускається через `node --env-file-if-exists=.env`, бо в CI файлу `.env` немає, а `--env-file` без файлу падає. Astro `^5.18.2`. **Єдина нова залежність** — `@astrojs/cloudflare@^12`. Якщо `npm install` пропонує мажор, що вимагає Astro 6, закріпити `^12`. SDK Storyblok не встановлюється: CDN API — через `fetch`, Bridge — через `<script src>` лише на прев'ю.
- **Статичний вихід не змінюється.** Після Задач 5, 7 і 8 `dist/` збігається з `dist/` до них побайтово. Перевіряє `node scripts/lib/diff-dirs.mjs` (Задача 3). У продакшн-HTML немає `data-blok-*`, Bridge і жодної адреси `storyblok.com` (тест у Задачі 3).
- **Токени — за принципом найменших прав:**
  - Management-токен лише локально в `.env`: імпорт і звірка Етапу 4.
  - Public-токен (лише опублікована версія) — секрет GitHub `STORYBLOK_PUBLIC_TOKEN`.
  - Preview-токен (чернетки), секрет вебхука й GitHub-токен з правом лише на Actions цього репозиторію — лише в секретах Cloudflare.
  - Токен Cloudflare API з правом лише «Cloudflare Pages: Edit» і id акаунта — секрети GitHub `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` (деплой статичної копії, Задача 10).
  - Токен доставки передається в query, тому адреса запиту не потрапляє в жодне повідомлення про помилку.
- **`npm test` не ходить у мережу й не потребує токенів.** CDN API, Management API і Storyblok-файли відтворює фейк (`tests/helpers/fake-storyblok.js`). Живий простір, GitHub і Cloudflare залучаються лише в Задачі 11.
- **Контракт з адмінкою** (CLAUDE.md): тести виводять очікування з контенту, який читають, і не пришпилюють поточних значень. `src/content` і `public/` тести не змінюють ніколи. Для змін — `ContentFixture`, `withContentCopy`, тимчасова копія `public/`.
- **Робота в гілці `stage-5-storyblok`.** Після Задачі 4 деплой вимагає секрет `STORYBLOK_PUBLIC_TOKEN`, тому злиття в `main` — лише в Задачі 11, коли секрет уже заданий. Інакше перший же пуш зламає деплой.
- Коментарі й назви тестів **українською**. Коментар пояснює *чому*, а не *що*. ESM `.mjs`, 2 пробіли, одинарні лапки, крапка з комою. У `.astro` — без `<style>` (є тест).
- Файли контенту в робочому дереві з CRLF (`core.autocrlf=true`). Правити їх точково (Edit), не перезаписом.
- Кожна задача закінчується `npm test` без жодного FAIL і окремим комітом. Кінцівка кожного коміту:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## Зафіксовані рішення цього плану

У цих місцях спека допускає кілька прочитань, або рішення потребує згоди. Якщо ревʼю не згодне, правити **до** старту.

| # | Питання | Рішення | Підстава |
|---|---|---|---|
| 1 | Як Astro «читає Storyblok» | Окремого завантажувача Astro немає. `cms:pull` записує опубліковану версію у формат `src/content` (через `fromStory`), далі звичайна збірка | Контракт «схема пропускає → `npm test` зелений» (CLAUDE.md) уже стереже саме файли. Тести читають `src/content` (`tests/helpers/content.js`), тож у CI вони автоматично перевіряють контент редактора. Власний завантажувач дублював би валідацію (`assertUniqueSlugs`, id одиночок), а тести однаково потребували б файлів. `fromStory` лишається єдиним перетворенням |
| 2 | Звідки CI бере контент | Кожна збірка `main` (пуш коду, вебхук, ручний запуск) спершу виконує `cms:pull`. Без токена збірка **падає**, фолбеку на файли репозиторію немає | Після Етапу 5 джерело правди — Storyblok. Пуш коду, зібраний з `src/content`, мовчки відкотив би сайт до стану на момент Етапу 4 |
| 3 | Роль `src/content` після етапу | Зразковий знімок: офлайн-розробка, тести, проби. Сам не оновлюється. Оновити вручну: `npm run cms:pull` і коміт | Автокоміт з CI — окрема інфраструктура без потреби (YAGNI). Історію правок веде Storyblok |
| 4 | Який API читає контент | Content Delivery API v2. Для CI — Public-токен (`version=published`), для прев'ю — Preview-токен (`version=draft`). Перед читанням береться `cv` з `/v2/cdn/spaces/me` | Management-токен має повні права, і в CI він не потрібен. Без `cv` CDN може віддати знімок до останньої публікації, і збірка з вебхука не побачила б щойно опублікованої правки |
| 5 | Картинки на збірці | Завантажується будь-яка адреса файлів Storyblok (`a.storyblok.com`, `//…`, `s3.amazonaws.com/a.storyblok.com`, регіональні `a-xx`) у будь-якому рядковому полі. Якщо вміст збігається з файлом у `public/uploads/`, береться той самий шлях. Інакше — `public/uploads/cms/<sha12>-<імʼя>` (тека в `.gitignore`, очищається кожним `cms:pull`). Зовнішні адреси не зі Storyblok (заглушки picsum/unsplash) лишаються як є | Спека: браузер відвідувача не звертається до Storyblok. Збіг за вмістом робить збірку зі Storyblok побайтово рівною збірці з файлів — це і є критерій приймання |
| 6 | Стискання й розміри картинок | **Не в цьому етапі.** Завантажуються оригінали | Сайт і зараз не генерує розмірів. Критерій спеки — «завантажуються на білді й лежать поруч». Перерахунок розмірів змінив би вихід, перевірений піксель у піксель. Кандидат в окреме завдання після реальних фото (дірка 5) |
| 7 | Прев'ю-режим | `HOB_PREVIEW=true` → `output: 'server'`, адаптер `@astrojs/cloudflare`, інтеграція `src/integrations/preview.mjs` (middleware + маршрут вебхука). `PREVIEW` вмикає `NOINDEX` і `trailingSlash: 'ignore'` | Спека: «у серверному режимі, з draft-токеном». Друга конфігурація тієї самої збірки, без окремого застосунку |
| 8 | Як шаблони отримують дані | Лише через `siteData(Astro.locals)` → `{ list, one, page, edit }` (`src/lib/site-data.ts` над чистим `makeSite` у `src/lib/site.mjs`). `astro:content` імпортують тільки `site-data.ts` і `content.config.ts` (тест). Маршрути шукають запис за `Astro.params`, а не беруть з `props`: у серверному режимі `getStaticPaths` не викликається | Інакше прев'ю мало б другу копію логіки кожної сторінки. Вихід статичної збірки від цього не змінюється, це перевіряє `diff-dirs` |
| 9 | Хто бачить прев'ю | Лише запит із чинним `_storyblok_tk` (sha1 від `space:previewToken:timestamp`, не старший за годину) або з підписаною cookie сесії `hob_editor` (HMAC-SHA256, 1 год, `SameSite=None; Secure; Partitioned; HttpOnly`). Решта отримує 403 без жодного запиту за чернеткою | Спека: «прев'ю бачить лише редактор». Cookie потрібна, бо посилання всередині iframe не несуть параметрів Storyblok. Якщо браузер блокує cookie третьої сторони (Safari), переходи всередині iframe дають 403 з підказкою відкрити сторінку зі списку історій. Відкриття з адмінки працює завжди |
| 10 | «Зміни видно наживо» | Bridge: `change` / `published` (збереження в редакторі) → `location.reload()`, сторінка рендериться з чернетки заново. Оновлення на кожне натискання клавіші (подія `input`) **не в цьому етапі** | Перерендер незбереженої історії потребує POST-рендеру й повторної ініціалізації скриптів галереї. Це окрема робота з ризиком для перевіреного дизайну. Затримка «Зберегти → видно» — 1–2 с. Якщо замовник вимагатиме живого набору, це окреме завдання |
| 11 | Що клікається у Visual Editor | Атрибути `_editable` (формат `storyblokEditable` з `@storyblok/js`: `data-blok-c`, `data-blok-uid`) на: `page-hero` кожної сторінки з `pages`, `detail-top` детальних сторінок, картках свідчень / пасторів / ресурсів лідерів (власних сторінок у них немає), секціях головної (`hero`, `about`, `news`, `wwb`, `testimonies`, `ministries`, `pastors`, `contacts`, `donate`) і футері головної (`footer`). Одиночки `site-settings`, `contact-info`, `donate-settings` не розмічаються: редагуються формою, після збереження видно на `/` | Visual Editor відкриває лише блоки поточної історії. Розмітка там, де історія реально показується. Клік по окремому текстовому полю Storyblok не підтримує (гранулярність — блок) |
| 12 | Адреса історії у Visual Editor | Middleware прев'ю перенаправляє (302, зі збереженням query) адреси `full_slug` на сторінки сайту: `pages/<id>` → `/<id>/`, `settings/*` → `/`, `testimonies/*` → `/testimonies/`, `pastors/*` → `/pastors/`, `leader-resources/*` → `/leaders/`, решту — на ту саму адресу з кінцевим `/`. Мову дає префікс `/en/` другої адреси прев'ю в налаштуваннях Visual Editor | Не потрібно поле «Real path» у кожній історії, тож імпорт Етапу 4 не змінюється |
| 13 | Невалідна чернетка на прев'ю | Замість сторінки — 500 зі списком полів українською (формат `validateContent`), `noindex` | Редактор бачить причину до публікації. Інакше про неї знав би лише розробник з листа GitHub про впалу збірку |
| 14 | Вебхук | Storyblok → `POST /api/storyblok-publish` на прев'ю-стенді. Там перевіряється підпис (`webhook-signature` = HMAC-SHA1 сирого тіла секретом вебхука) і на подіях `published` / `unpublished` / `deleted` / `moved` викликається `POST /repos/{repo}/actions/workflows/deploy.yml/dispatches` `{ref: 'main'}` з fine-grained PAT (лише Actions: write на цей репозиторій) | Тіло вебхука Storyblok не налаштовується, а GitHub чекає свій формат і токен, тому потрібен перекладач. Прев'ю-стенд — єдиний наш сервер. `concurrency: pages` у `deploy.yml` тримає одну збірку в черзі, тож пачка публікацій дає одну-дві збірки |
| 15 | Гейт вебхукового деплою і «1–2 хвилини» | Повний `npm test`, як і для пушу. **Заміряно 2026-09-25: `npm test` — ~2,5 хв локально**, з цим етапом додається ще ~1 хв. Від «Опублікувати» до сайту вийде ~4–5 хв, а не 1–2 хв зі спеки | Контракт CLAUDE.md: `npm test` стереже деплой. Швидкий гейт (без проб, які тестують код, а не контент) можливий, але це послаблення сітки безпеки. **Погоджено 2026-09-25: ~4–5 хв прийнятно**, швидкий гейт не робимо. Фактичний час записується в Задачі 11 |
| 16 | Продакшн-хостинг | Вебхук запускає поточний `deploy.yml` (GitHub Pages). Коли зʼявиться домен і rsync (Етап 0, Задача 5), крок `cms:pull` лишається перед `npm test` і в тому workflow | Домену ще немає. Критерій «зміна доходить до сайту» перевіряється на GitHub Pages |
| 17 | Конфігурація Cloudflare Pages | Git-інтеграція Cloudflare, налаштування в панелі: команда `npm run build`, вихід `dist`, змінні збірки, прапорець `nodejs_compat`, секрети. `wrangler.toml` у репозиторій **не** додається | З `wrangler.toml` Pages вважає його джерелом правди для змінних, а змінні збірки (`HOB_PREVIEW`, `SITE_URL`) задаються в панелі. Одне місце — менше розбіжностей. `nodejs_compat` потрібен для `node:crypto` у `convert.mjs` |
| 18 | Деталі API, яких документація не підтверджує (заголовок підпису вебхука, формат `_editable` у CDN-відповіді, чи викликає Astro middleware для адрес без маршруту, `locals.runtime.env` у адаптері 12) | Фейк відтворює документовану поведінку, а невизначене про Astro перевіряє тест на `astro dev`. Задача 11 проганяє живі сервіси. Кожна розбіжність спершу стає зміною фейку й червоним тестом, потім виправленням | Та сама процедура, що в Етапі 4 (рішення 15) |
| 19 | Статична копія сайту на Cloudflare Pages | **Варіант А (обрано 2026-09-25).** Після `npm test` у тому самому завданні `build`, де вже лежить стягнутий контент, сайт збирається вдруге: `BASE_PATH=/`, `SITE_URL=${{ vars.CLOUDFLARE_SITE_URL }}`, `SITE_NOINDEX=true`, вихід у `dist-cloudflare`. Цю теку завантажує окреме завдання `deploy-cloudflare` командою `wrangler pages deploy` (проєкт Direct Upload). Усе вмикає змінна репозиторію `CLOUDFLARE_PROJECT`: поки її немає, кроки пропускаються | Одна схема збірки: копія оновлюється на тих самих подіях (пуш, вебхук, ручний запуск) і з тим самим контентом, що пройшов `npm test`. Окреме завдання — щоб збій Cloudflare не зупиняв деплой на GitHub Pages. Вимикач дозволяє злити гілку до налаштування Cloudflare. `noindex` — бо копія дублює основний сайт. Щоб зробити копію продакшном, досить змінити `CLOUDFLARE_SITE_URL` на домен і прибрати `SITE_NOINDEX` (далі — чекліст SEO) |
| 20 | Ліміти Cloudflare | **Копія:** файл ≤ 25 МБ, ≤ 20 000 файлів. `cms:pull` завантажує оригінали (рішення 6), тож завелике фото зламає лише деплой копії, бо це окреме завдання. **Прев'ю (Workers Free):** воркер ≤ 3 МБ у стисненому вигляді — тест у Задачі 7; ≤ 10 мс CPU на запит — замір у Задачі 11. Якщо не вкладається, вирішуємо з користувачем: Workers Paid ($5/міс) або прев'ю читає лише історії поточної сторінки (тоді список помилок рішення 13 стосується лише її) | Ліміти відомі наперед — їх треба перевірити, а не сподіватися, що пронесе. Процесорного часу рендеру я не міряв, тому потрібен замір |

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `src/lib/storyblok/delivery.mjs` (новий) | `fetchStories`, `deliveryUrl`, `DELIVERY_REGIONS`: CDN API v2, `cv`, пагінація, повтор 429. Лише `fetch` — працює в Node і у воркері |
| `src/lib/storyblok/entries.mjs` (новий) | `storiesToEntries`, `editableAttrs`: історії → записи вигляду `readContent` + атрибути Visual Editor |
| `src/lib/storyblok/convert.mjs` | `fromStory` отримує `onBlok(blok, path)` |
| `src/lib/content-rules.mjs` (новий) | `validateContent` (перенесено з `scripts/cms/content.mjs`, + перевірка одиночок). Без `fs` |
| `src/lib/site.mjs` (новий) | `makeSite(entries, editables)` → `{ list, one, page, edit }` |
| `src/lib/site-data.ts` (новий) | `siteData(locals)`: з `locals.site` (прев'ю) або з колекцій Astro. Типи `Site`, `PageId` |
| `src/lib/routing.mjs` (новий) | `pageLang(astro)`, `notFound()` |
| `scripts/cms/assets.mjs` (новий) | `isStoryblokAsset`, `localAssetName`, `localizeAssets`, `downloadAsset`, `CMS_UPLOADS` |
| `scripts/cms/content.mjs` | + `writeContent(dir, entries)`; `validateContent` реекспортується |
| `scripts/cms/snapshot.mjs` (новий) | `runPull`: історії → перевірки → картинки → файли |
| `scripts/cms/pull.mjs` (новий) | CLI `npm run cms:pull` |
| `scripts/lib/diff-dirs.mjs` (новий) | `diffDirs(a, b)` + CLI: побайтове порівняння двох збірок |
| `src/preview/access.mjs`, `routes.mjs`, `pages.mjs`, `env.mjs`, `hook.mjs` (нові) | Чисті частини прев'ю: доступ редактора, адреси історій, службові сторінки, змінні середовища, вебхук |
| `src/preview/middleware.mjs`, `publish-hook.mjs` (нові) | Middleware прев'ю й ендпоінт вебхука (підключає лише інтеграція) |
| `src/integrations/preview.mjs` (новий) | Інтеграція прев'ю: `addMiddleware`, `injectRoute` |
| `src/components/PreviewBridge.astro` (новий) | Скрипт Bridge, лише коли `locals.preview` |
| `astro.config.mjs`, `src/env.d.ts`, `package.json`, `.gitignore`, `.github/workflows/deploy.yml` | Конфігурація режимів, типи `App.Locals`, скрипти й залежність, деплой |
| 13 маршрутів `src/pages/[...lang]/**`, `Seo.astro`, `SiteHeader.astro`, `SiteFooter.astro`, `SubHeader.astro`, `Base.astro` | Перехід на `siteData`, розмітка `_editable`, Bridge |
| `tests/helpers/fake-storyblok.js`, `tests/helpers/cms.js` | CDN API у фейку, опубліковані знімки, `seedFake`, `PROBE_PNG` |
| `tests/cms-delivery.test.js`, `cms-entries.test.js`, `cms-pull.test.js`, `deploy.test.js`, `site-data.test.js`, `preview-lib.test.js`, `preview-hook.test.js`, `preview.test.js` (нові) | Тести відповідних модулів; `preview.test.js` — інтеграційний на `astro dev` і збірці прев'ю |
| `CLAUDE.md`, спека 3, `notes/…seo-launch-checklist.md` | Документація (Задача 12) |

## Review Focus

Ситуації, які спека передбачає, але які найлегше пропустити. Кожна прикріплена тестом до своєї задачі.

1. **Пуш коду після Етапу 5 збирає застарілий контент з репозиторію.** Кожна збірка `main` мусить іти через `cms:pull`, а без токена — падати, а не тихо брати `src/content`. Тести: Задача 4 (порядок кроків у `deploy.yml`) і Задача 3 (CLI без токена: код 1, назва змінної).
2. **CDN віддає знімок до останньої публікації.** Вебхукова збірка стартує за секунди після «Опублікувати». Без `cv` вона зібрала б старе. Фейк кешує відповіді за `cv` так само, як CDN. Тест у Задачі 1.
3. **Чернетка чи видалений запис потрапляє в продакшн.** Правка без «Опублікувати» не мусить дійти до сайту. Знята з публікації чи видалена історія мусить зникнути з файлів, а не лишитися з минулого прогону. Тести в Задачах 1 і 3.
4. **Адреса Storyblok у продакшн-HTML.** Редактор вставляє адресу файлу медіатеки як «зовнішню» чи в поле-посилання, або API віддає `//a.storyblok.com/…` чи `s3.amazonaws.com/…`. Кожна така адреса мусить стати локальним файлом, а збірка — не містити `storyblok.com` в жодному `src` / `href` / `srcset` / `content`. Тести в Задачі 3.
5. **Прев'ю відкрили не з Visual Editor** (переслане посилання, робот) **або перейшли за посиланням усередині iframe.** Перше — 403 без жодного запиту за чернеткою й з `X-Robots-Tag: noindex`. Друге — доступ за cookie сесії. Тести в Задачах 6 і 7.

---

## Задача 1: Content Delivery API — клієнт і фейк

**Files:**
- Create: `src/lib/storyblok/delivery.mjs`
- Modify: `tests/helpers/fake-storyblok.js`, `tests/helpers/cms.js`
- Test: `tests/cms-delivery.test.js`

**Interfaces:**
- Consumes: `startFakeStoryblok`, `fakeClient`, `withFake`, `quietLog`, `contentDir`, `publicDir` (Етап 4); `runImport` з `scripts/cms/sync.mjs`; `readContent` з `scripts/cms/content.mjs`.
- Produces:
  - `fetchStories({ token, baseUrl, version = 'published' | 'draft', fetch?, retries?, backoffMs? }) → Promise<Story[]>` — історії без папок, `{ id, uuid, name, slug, full_slug, content }`.
  - `deliveryUrl(env) → string`: `env.STORYBLOK_DELIVERY_URL` (лише тести) або адреса регіону `env.STORYBLOK_REGION` (типово `eu`).
  - `DELIVERY_REGIONS`.
  - Фейк: опції `publicToken = 'public-token'`, `previewToken = 'preview-token'`, `cdnRejectEvery = null`. Поля `fake.publicToken`, `fake.previewToken`, `fake.state.cdnRequests`, `fake.state.version`. Методи `fake.unpublish(fullSlug)`, `fake.remove(fullSlug)`.
  - `tests/helpers/cms.js`: `seedFake(fake, dir = contentDir)`, `PROBE_PNG` (експорт).

- [ ] **Step 1: Фейк — опубліковані знімки й CDN API**

У `tests/helpers/fake-storyblok.js`:

1. У параметри `startFakeStoryblok` додати `publicToken = 'public-token', previewToken = 'preview-token', cdnRejectEvery = null`. У `state` додати `version: 1, cdnCache: new Map(), cdnRequests: 0`.

2. Одразу після `fullSlugOf` додати:

```js
  // Опублікована версія — знімок на момент публікації: правка без
  // «Опублікувати» до неї не доходить (так Storyblok відділяє чернетку).
  // version — cv простору: росте з кожною публікацією, як у CDN API.
  const publishNow = (story) => {
    story.published = true;
    story.unpublished_changes = false;
    story.published_content = structuredClone(story.content);
    state.version++;
  };
  // MAPI не віддає знімка опублікованої версії — лише фейк тримає його поруч.
  const mapiView = ({ published_content, ...rest }) => rest;
```

3. У `addStory` створювати історію з `published: false` і після `state.stories.push(story)` викликати `if (published) publishNow(story);`.

4. Усі місця, де історія стає опублікованою (`GET /stories/:id/publish`, `PUT` з `body.publish`, `editStory` з `publish`), замінити на `publishNow(story)` / `publishNow(s)`. `DELETE /stories/:id` після видалення робить `state.version++`.

5. `listItem` → `({ content, published_content, ...rest }) => rest`. Кожна MAPI-відповідь з однією історією (`{ story }` у POST, GET, PUT, publish, DELETE) віддає `mapiView(story)`.

6. Перед рядком `// Групу шляху зроблено необовʼязковою…` додати маршрут CDN:

```js
    if (method === 'GET' && url.pathname.startsWith('/v2/cdn/')) return cdn(url, res);
```

7. Над `async function handle` додати:

```js
  // Visual Editor знаходить блок за _editable (формат CDN API для version=draft).
  const withEditable = (value, story) => {
    if (Array.isArray(value)) return value.map((v) => withEditable(v, story));
    if (!value || typeof value !== 'object') return value;
    const out = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withEditable(v, story)]));
    if (typeof out.component === 'string' && out._uid) {
      out._editable = `<!--#storyblok#${JSON.stringify({ name: out.component, space: spaceId, uid: out._uid, id: String(story.id) })}-->`;
    }
    return out;
  };

  // Content Delivery API v2: токен у query. Опублікована версія кешується за
  // cv, як на CDN Storyblok: запит без cv чи зі старою cv отримує той знімок,
  // що вже лежить у кеші (Review Focus 2). Чернетка — лише з preview-токеном.
  function cdn(url, res) {
    const token = url.searchParams.get('token');
    const access = token === previewToken ? 'preview' : token === publicToken ? 'public' : null;
    if (!access) return send(res, 401, { error: 'Unauthorized' });
    state.cdnRequests++;
    if (cdnRejectEvery && state.cdnRequests % cdnRejectEvery === 0) {
      state.rejected++;
      return send(res, 429, { error: 'Too Many Requests' });
    }
    if (url.pathname === '/v2/cdn/spaces/me') return send(res, 200, { space: { id: Number(spaceId), name: 'Fake', version: state.version } });
    if (url.pathname !== '/v2/cdn/stories') return send(res, 404, { error: 'not found' });
    const version = url.searchParams.get('version') ?? 'published';
    if (version === 'draft' && access !== 'preview') return send(res, 401, { error: 'draft needs a preview token' });
    const perPage = Math.min(Number(url.searchParams.get('per_page') ?? 25), 100);
    const page = Number(url.searchParams.get('page') ?? 1);
    const key = `${url.searchParams.get('cv') ?? '-'}|${perPage}|${page}`;
    if (version === 'published' && state.cdnCache.has(key)) return send(res, 200, ...state.cdnCache.get(key));
    const all = state.stories
      .filter((s) => !s.is_folder && (version === 'draft' || s.published_content))
      .map((s) => ({
        id: s.id, uuid: s.uuid, name: s.name, slug: s.slug, full_slug: s.full_slug,
        content: version === 'draft' ? withEditable(s.content, s) : structuredClone(s.published_content),
      }));
    const reply = [
      { stories: all.slice((page - 1) * perPage, page * perPage), cv: state.version },
      { total: String(all.length), 'per-page': String(perPage) },
    ];
    if (version === 'published') state.cdnCache.set(key, reply);
    return send(res, 200, ...reply);
  }
```

8. В обʼєкт, який повертає фабрика, додати `publicToken, previewToken`, а також:

```js
    // Редактор зняв історію з публікації / видалив її.
    unpublish(fullSlug) {
      const s = story(fullSlug);
      s.published = false;
      delete s.published_content;
      state.version++;
    },
    remove(fullSlug) {
      const s = story(fullSlug);
      state.stories = state.stories.filter((x) => x.id !== s.id);
      state.version++;
    },
```

У `editStory` параметр `publish` лишити як є, а всередині викликати `publishNow(s)`.

- [ ] **Step 2: Хелпер `seedFake` і експорт `PROBE_PNG`**

У `tests/helpers/cms.js` додати імпорт `import { runImport } from '../../scripts/cms/sync.mjs';`, замінити `const PROBE_PNG` на `export const PROBE_PNG` і дописати:

```js
// Фейк у стані «Етап 4 завершено»: увесь контент залито й опубліковано.
export async function seedFake(fake, dir = contentDir) {
  const { exitCode } = await runImport({ client: fakeClient(fake), contentDir: dir, publicDir, apply: true, log: quietLog().log });
  if (exitCode !== 0) throw new Error('seedFake: імпорт у фейк не вдався');
}
```

- [ ] **Step 3: Написати тест, що падає**

`tests/cms-delivery.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DELIVERY_REGIONS, deliveryUrl, fetchStories } from '../src/lib/storyblok/delivery.mjs';
import { readContent } from '../scripts/cms/content.mjs';
import { contentDir, seedFake, withFake } from './helpers/cms.js';

// Content Delivery API — те, що читатиме кожна збірка (cms:pull) і прев'ю.
// Одиночка site-settings є завжди (її читають шаблони), тож проби правлять її.
const SETTINGS = 'settings/site-settings';
const published = (fake) => fetchStories({ token: fake.publicToken, baseUrl: fake.baseUrl, backoffMs: 1 });
const draft = (fake) => fetchStories({ token: fake.previewToken, baseUrl: fake.baseUrl, version: 'draft', backoffMs: 1 });
const find = (stories, fullSlug) => stories.find((s) => s.full_slug === fullSlug);

test('опублікована версія: по історії на кожен запис файлів, без папок', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    const stories = await published(fake);
    assert.deepEqual(stories.map((s) => s.full_slug).sort(), readContent(contentDir).map((e) => e.path).sort());
  });
});

test('правка без «Опублікувати» є в чернетці, але не в опублікованій версії', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    fake.editStory(SETTINGS, (c) => { c.name_uk = 'Чернетка'; }, { publish: false });
    assert.notEqual(find(await published(fake), SETTINGS).content.name_uk, 'Чернетка');
    assert.equal(find(await draft(fake), SETTINGS).content.name_uk, 'Чернетка');
  });
});

test('після публікації наступне читання бачить правку (cv обходить кеш CDN)', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    await published(fake); // кеш CDN прогрітий старим знімком
    fake.editStory(SETTINGS, (c) => { c.name_uk = 'Нова назва'; });
    assert.equal(find(await published(fake), SETTINGS).content.name_uk, 'Нова назва');
  });
});

test('знята з публікації історія зникає з опублікованої версії', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    fake.unpublish(SETTINGS);
    assert.equal(find(await published(fake), SETTINGS), undefined);
  });
});

test('чернетка з публічним токеном — 401, токен не потрапляє в повідомлення', async () => {
  await withFake({}, async (fake) => {
    await assert.rejects(
      fetchStories({ token: fake.publicToken, baseUrl: fake.baseUrl, version: 'draft' }),
      (error) => {
        assert.match(error.message, /401/);
        assert.ok(!error.message.includes(fake.publicToken));
        return true;
      },
    );
  });
});

test('понад сотню історій — читаються всі сторінки', async () => {
  await withFake({}, async (fake) => {
    for (let i = 0; i < 130; i++) fake.addStory({ parentSlug: '', slug: `extra-${i}`, content: { component: 'x', _uid: `u${i}` } });
    assert.equal((await published(fake)).length, 130);
  });
});

test('429 від CDN повторюється з паузою', async () => {
  await withFake({ cdnRejectEvery: 2 }, async (fake) => {
    await seedFake(fake);
    const stories = await published(fake);
    assert.ok(fake.state.rejected > 0);
    assert.equal(stories.length, readContent(contentDir).length);
  });
});

test('чернетка несе _editable на кожному блоці, опублікована — ні', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    for (const s of await draft(fake)) {
      assert.match(s.content._editable, new RegExp(`^<!--#storyblok#\\{.*"id":"${s.id}".*\\}-->$`), s.full_slug);
    }
    assert.doesNotMatch(JSON.stringify(await published(fake)), /_editable/);
  });
});

test('регіон: eu за замовчуванням, адреса тестів має перевагу, невідомий — з переліком', () => {
  assert.equal(deliveryUrl({}), DELIVERY_REGIONS.eu);
  assert.equal(deliveryUrl({ STORYBLOK_REGION: ' US ' }), DELIVERY_REGIONS.us);
  assert.equal(deliveryUrl({ STORYBLOK_DELIVERY_URL: 'http://127.0.0.1:1', STORYBLOK_REGION: 'us' }), 'http://127.0.0.1:1');
  assert.throws(() => deliveryUrl({ STORYBLOK_REGION: 'mars' }), /«mars».*eu, us/);
});
```

- [ ] **Step 4: Запустити — має впасти**

Run: `node --test tests/cms-delivery.test.js`
Expected: FAIL — `Cannot find module '…/src/lib/storyblok/delivery.mjs'`.

- [ ] **Step 5: Реалізація**

`src/lib/storyblok/delivery.mjs`:

```js
// Content Delivery API v2: опублікована версія (cms:pull на кожній збірці)
// і чернетка (прев'ю-стенд). Лише fetch і URL — модуль працює і в Node, і у
// воркері Cloudflare. Management API (scripts/cms/client.mjs) тут не
// потрібен: токени доставки дають лише читання.

export const DELIVERY_REGIONS = {
  eu: 'https://api.storyblok.com',
  us: 'https://api-us.storyblok.com',
  ca: 'https://api-ca.storyblok.com',
  ap: 'https://api-ap.storyblok.com',
  cn: 'https://app.storyblokchina.cn',
};

const PER_PAGE = 100;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// STORYBLOK_DELIVERY_URL — лише для тестів (фейк на localhost); справжні
// середовища задають регіон.
export function deliveryUrl(env) {
  if (env.STORYBLOK_DELIVERY_URL) return env.STORYBLOK_DELIVERY_URL;
  const region = String(env.STORYBLOK_REGION || 'eu').trim().toLowerCase();
  const url = DELIVERY_REGIONS[region];
  if (!url) throw new Error(`STORYBLOK_REGION «${region}» невідомий; можливі: ${Object.keys(DELIVERY_REGIONS).join(', ')}`);
  return url;
}

export async function fetchStories({ token, baseUrl, version = 'published', fetch = globalThis.fetch, retries = 5, backoffMs = 500 }) {
  if (!token) throw new Error('fetchStories: немає token');
  if (version !== 'published' && version !== 'draft') throw new Error(`fetchStories: невідома версія «${version}»`);

  async function get(path, query) {
    const url = new URL(`/v2/cdn/${path}`, baseUrl);
    for (const [key, value] of Object.entries({ ...query, token })) url.searchParams.set(key, String(value));
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url);
      if (res.status === 429 && attempt < retries) {
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      // Токен їде в query, тож повна адреса в повідомлення не йде — лише шлях.
      if (!res.ok) throw new Error(`Storyblok CDN ${path}: ${res.status} ${text.slice(0, 300)}`);
      return { data: JSON.parse(text), headers: res.headers };
    }
  }

  // cv — версія кешу простору, росте з кожною публікацією. Без неї CDN може
  // віддати знімок до останньої публікації, і збірка з вебхука зібрала б
  // сайт без щойно опублікованої правки.
  const { data: me } = await get('spaces/me', {});
  const cv = me.space?.version;
  const stories = [];
  for (let page = 1; ; page++) {
    const { data, headers } = await get('stories', { version, per_page: PER_PAGE, page, ...(cv != null && { cv }) });
    const batch = data.stories ?? [];
    stories.push(...batch);
    const total = Number(headers.get('total'));
    if (batch.length < PER_PAGE || (total > 0 && stories.length >= total)) return stories;
  }
}
```

- [ ] **Step 6: Тести зелені — і нові, і всі тести Етапу 4 на фейку**

Run: `node --test --test-concurrency=1 tests/cms-*.test.js`
Expected: PASS. Якщо падає тест імпорту чи звірки Етапу 4, значить у MAPI-відповідь просочився `published_content` (крок 1.5) або змінилася семантика `published`.

- [ ] **Step 7: Повний прогін і коміт**

Run: `npm test` → Expected: 0 FAIL.

```bash
git add src/lib/storyblok/delivery.mjs tests/helpers/fake-storyblok.js tests/helpers/cms.js tests/cms-delivery.test.js
git commit -m "feat: Content Delivery API Storyblok — клієнт і фейк з опублікованими знімками

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 2: історії → записи, атрибути Visual Editor, перевірки без `fs`

**Files:**
- Create: `src/lib/storyblok/entries.mjs`, `src/lib/content-rules.mjs`
- Modify: `src/lib/storyblok/convert.mjs` (`readBlok`, `fromStory`), `scripts/cms/content.mjs` (`validateContent` переїжджає)
- Test: `tests/cms-entries.test.js`, `tests/cms-convert.test.js` (+1 тест)

**Interfaces:**
- Consumes: `fromStory`, `toStory`, `storyPath`, `canonical` (convert.mjs); `COLLECTIONS` (model.mjs); `readContent` (scripts/cms/content.mjs).
- Produces:
  - `fromStory(collection, story, { assetPath?, onBlok? })`, де `onBlok(blok, path)` викликається для кожного блоку. `path`: `''` — корінь, `'hero'` — група, `'news.items.0'` — елемент списку.
  - `storiesToEntries(stories, { assetPath? }) → { entries, errors, warnings, editables }`:
    - `entries` — `{ collection, slug, source, path, data }`, як у `readContent` (`slug` одиночки — `COLLECTIONS[c].slug`, сторінки — її id);
    - `editables: Map<'<storyPath>#<path>', { 'data-blok-c': string, 'data-blok-uid': string }>`.
  - `editableAttrs(editable: string) → attrs | null`.
  - `validateContent(entries) → string[]` з `src/lib/content-rules.mjs`. `scripts/cms/content.mjs` реекспортує його без змін в інтерфейсі.

- [ ] **Step 1: Тест `onBlok`, що падає**

Дописати в `tests/cms-convert.test.js` (імпорти `fromStory`, `toStory` уже є; додати `readSingleton` з `./helpers/content.js`, якщо його немає):

```js
test('fromStory повідомляє onBlok про кожен блок зі шляхом поля й не змінює даних', () => {
  const story = toStory('homepage', 'homepage', readSingleton('homepage'), {
    asset: (src) => ({ id: 1, filename: `https://a.storyblok.com/f/1/${src}` }),
  });
  const seen = [];
  const data = fromStory('homepage', story, { onBlok: (blok, path) => seen.push([path, blok.component]) });
  assert.deepEqual(seen[0], ['', 'homepage']);
  assert.ok(seen.some(([path, component]) => path === 'hero' && component === 'home_hero'), JSON.stringify(seen));
  assert.deepEqual(data, fromStory('homepage', story));
});
```

- [ ] **Step 2: Тести `storiesToEntries` / `validateContent`, що падають**

`tests/cms-entries.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../src/lib/content-rules.mjs';
import { canonical, toStory } from '../src/lib/storyblok/convert.mjs';
import { editableAttrs, storiesToEntries } from '../src/lib/storyblok/entries.mjs';
import { readContent } from '../scripts/cms/content.mjs';
import { contentDir } from './helpers/cms.js';

// Історія CDN API з запису файлів: картинки — «з медіатеки», і назад.
const LIB = 'https://a.storyblok.com/f/1/';
const asStory = (e, id = 7) => ({
  id, full_slug: e.path,
  ...toStory(e.collection, e.slug, e.data, { asset: (src) => ({ id, filename: `${LIB}${src}` }) }),
});
const back = (asset) => (asset.filename.startsWith(LIB) ? asset.filename.slice(LIB.length) : asset.filename);

test('історії → записи того самого вигляду й даних, що з файлів', () => {
  const files = readContent(contentDir);
  const { entries, errors, warnings } = storiesToEntries(files.map((e) => asStory(e)), { assetPath: back });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.deepEqual(entries.map((e) => e.path).sort(), files.map((e) => e.path).sort());
  for (const e of entries) {
    const want = files.find((f) => f.path === e.path);
    assert.equal(e.collection, want.collection, e.path);
    assert.equal(e.slug, want.slug, e.path);
    assert.deepEqual(canonical(e.collection, e.data), canonical(want.collection, want.data), e.path);
  }
  assert.deepEqual(validateContent(entries), []);
});

test('папки й історії поза папками сайту пропускаються з попередженням', () => {
  const { entries, errors, warnings } = storiesToEntries([
    { id: 1, full_slug: 'ministries', slug: 'ministries', is_folder: true, content: {} },
    { id: 2, full_slug: 'home', slug: 'home', content: { component: 'page', _uid: 'x' } },
    { id: 3, full_slug: 'settings/unknown', slug: 'unknown', content: { component: 'homepage', _uid: 'y' } },
  ]);
  assert.deepEqual(entries, []);
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 2);
  assert.match(warnings.join('\n'), /^home: /m);
  assert.match(warnings.join('\n'), /^settings\/unknown: /m);
});

test('чужий тип контенту в папці колекції — помилка з адресою історії', () => {
  const { entries, errors } = storiesToEntries([{ id: 1, full_slug: 'ministries/x', slug: 'x', content: { component: 'church', _uid: 'u' } }]);
  assert.deepEqual(entries, []);
  assert.match(errors[0], /^ministries\/x: /);
});

test('без одиночки validateContent називає її історію', () => {
  const without = readContent(contentDir).filter((e) => e.collection !== 'homepage');
  assert.ok(validateContent(without).some((m) => m.startsWith('settings/homepage:')), validateContent(without).join('\n'));
});

test('_editable → атрибути Visual Editor для кореня й вкладених блоків', () => {
  const home = readContent(contentDir).find((e) => e.collection === 'homepage');
  const story = asStory(home, 42);
  const mark = (blok) => {
    if (!blok || typeof blok !== 'object') return;
    if (blok.component) blok._editable = `<!--#storyblok#${JSON.stringify({ name: blok.component, space: '1', uid: blok._uid, id: '42' })}-->`;
    for (const value of Object.values(blok)) if (Array.isArray(value)) value.forEach(mark);
  };
  mark(story.content);
  const { editables } = storiesToEntries([story], { assetPath: back });
  assert.equal(editables.get('settings/homepage#')['data-blok-uid'], `42-${story.content._uid}`);
  assert.equal(editables.get('settings/homepage#hero')['data-blok-uid'], `42-${story.content.hero[0]._uid}`);
  assert.equal(JSON.parse(editables.get('settings/homepage#')['data-blok-c']).name, 'homepage');
});

test('editableAttrs: не коментар Storyblok — null', () => {
  for (const bad of [undefined, '', '<!-- x -->', '<!--#storyblok#{bad json}-->']) assert.equal(editableAttrs(bad), null, String(bad));
});
```

- [ ] **Step 3: Запустити — має впасти**

Run: `node --test tests/cms-entries.test.js tests/cms-convert.test.js`
Expected: FAIL — немає модулів `content-rules.mjs` / `entries.mjs`; у тесті `onBlok` масив `seen` порожній.

- [ ] **Step 4: `onBlok` у `convert.mjs`**

У `readBlok` додати параметр `path = ''`. Першим рядком після перевірки `def` викликати хук:

```js
  // Прев'ю (Visual Editor) звʼязує DOM з блоком за _editable. Збирає їх той,
  // хто передав onBlok; самі дані від цього не змінюються.
  ctx.onBlok?.(blok, path);
```

У циклі полів обчислювати `const at = path ? `${path}.${key}` : key;` і передавати шлях далі:
- група: `bloks.length === 1 ? readBlok(bloks[0], ctx, at) : bloks.map((b, i) => readBlok(b, ctx, `${at}.${i}`))`;
- список: `bloks.map((b, i) => (field.unwrap ? readBlok(b, ctx, `${at}.${i}`)[field.unwrap] : readBlok(b, ctx, `${at}.${i}`)))`.

`fromStory`: сигнатура `{ assetPath = (asset) => asset.filename, onBlok } = {}`, виклик `readBlok(story.content, { assetPath, onBlok }, '')`.

- [ ] **Step 5: `src/lib/content-rules.mjs`**

Перенести `validateContent` з `scripts/cms/content.mjs` без змін у правилах і дописати перевірку одиночок:

```js
import { assertUniqueSlugs } from './collections.mjs';
import { PAGE_IDS, schemas } from './schema.mjs';
import { COLLECTIONS } from './storyblok/model.mjs';

// Ті самі перевірки, що й збірка (схема, унікальність slug, id сторінок,
// одиночки), для записів, прочитаних не завантажувачем Astro: імпорт
// (файли), cms:pull і прев'ю (Storyblok). Без fs — працює і у воркері
// прев'ю-стенду. API Storyblok обовʼязковості полів не перевіряє, тож
// невалідні дані мусять зупинитися тут.
export function validateContent(entries) {
  const errors = [];
  for (const { collection, source, data } of entries) {
    if (data === undefined) {
      errors.push(`${source}: бракує запису «main»`);
      continue;
    }
    const result = schemas[collection].safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(`${source} → ${issue.path.join('.') || '(запис)'}: ${issue.message}`);
    }
  }
  for (const [collection, entry] of Object.entries(COLLECTIONS)) {
    if (entry.kind === 'collection') {
      try {
        assertUniqueSlugs(collection, entries.filter((e) => e.collection === collection).map((e) => ({ id: e.source, slug: e.slug })));
      } catch (error) {
        errors.push(error.message);
      }
    }
    // Одиночку шаблони читають завжди: без неї сторінка впала б на «Cannot
    // read properties of undefined» (content.config.ts, singletonLoader).
    if (entry.kind === 'singleton' && !entries.some((e) => e.collection === collection)) {
      errors.push(`${entry.folder}/${entry.slug}: історії немає — її читають шаблони`);
    }
  }
  const pageIds = new Set(entries.filter((e) => e.collection === 'pages').map((e) => e.slug));
  const missing = PAGE_IDS.filter((id) => !pageIds.has(id));
  if (missing.length > 0) errors.push(`singletons/pages.json: бракує сторінок ${missing.map((id) => `«${id}»`).join(', ')} — їх читають шаблони`);
  return errors;
}
```

У `scripts/cms/content.mjs` видалити функцію `validateContent` і невживані тепер імпорти `assertUniqueSlugs`, `PAGE_IDS`, `schemas`. Додати:

```js
// Правила — у src/lib/content-rules.mjs: їх перевіряє й прев'ю-стенд, де fs немає.
export { validateContent } from '../../src/lib/content-rules.mjs';
```

- [ ] **Step 6: `src/lib/storyblok/entries.mjs`**

```js
import { fromStory, storyPath } from './convert.mjs';
import { COLLECTIONS } from './model.mjs';

// Історія Storyblok → запис того самого вигляду, що readContent дає з
// файлів ({ collection, slug, source, path, data }). Так cms:pull і прев'ю
// перевіряють і записують дані тим самим validateContent.

function collectionOf(story) {
  const [folder, slug, ...rest] = story.full_slug.split('/');
  if (!slug || rest.length > 0) return null;
  for (const [name, entry] of Object.entries(COLLECTIONS)) {
    if (entry.folder !== folder) continue;
    if (entry.kind !== 'singleton' || entry.slug === slug) return name;
  }
  return null;
}

// Атрибути, за якими Visual Editor знаходить блок, — той самий формат, що
// storyblokEditable() з @storyblok/js (SDK не підключаємо).
export function editableAttrs(editable) {
  const match = typeof editable === 'string' && editable.match(/^<!--#storyblok#(.*)-->$/s);
  if (!match) return null;
  try {
    const options = JSON.parse(match[1]);
    return { 'data-blok-c': JSON.stringify(options), 'data-blok-uid': `${options.id}-${options.uid}` };
  } catch {
    return null;
  }
}

export function storiesToEntries(stories, { assetPath } = {}) {
  const entries = [];
  const errors = [];
  const warnings = [];
  const editables = new Map();
  for (const story of stories) {
    if (story.is_folder) continue;
    const collection = collectionOf(story);
    if (!collection) {
      warnings.push(`${story.full_slug}: поза папками сайту — пропущено`);
      continue;
    }
    const path = storyPath(collection, story.slug);
    const onBlok = (blok, at) => {
      const attrs = editableAttrs(blok._editable);
      if (attrs) editables.set(`${path}#${at}`, attrs);
    };
    try {
      const data = fromStory(collection, story, { ...(assetPath && { assetPath }), onBlok });
      entries.push({ collection, slug: story.slug, source: story.full_slug, path, data });
    } catch (error) {
      errors.push(`${story.full_slug}: ${error.message}`);
    }
  }
  return { entries, errors, warnings, editables };
}
```

- [ ] **Step 7: Тести зелені**

Run: `node --test --test-concurrency=1 tests/cms-*.test.js`
Expected: PASS (разом з імпортом і звіркою Етапу 4, які тепер беруть `validateContent` через реекспорт).

- [ ] **Step 8: Повний прогін і коміт**

Run: `npm test` → Expected: 0 FAIL.

```bash
git add src/lib/storyblok/entries.mjs src/lib/content-rules.mjs src/lib/storyblok/convert.mjs scripts/cms/content.mjs tests/cms-entries.test.js tests/cms-convert.test.js
git commit -m "feat: історії Storyblok → записи сайту й атрибути Visual Editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 3: `npm run cms:pull` — Storyblok у файли, картинки поруч із сайтом

**Files:**
- Create: `scripts/cms/assets.mjs`, `scripts/cms/snapshot.mjs`, `scripts/cms/pull.mjs`, `scripts/lib/diff-dirs.mjs`
- Modify: `scripts/cms/content.mjs` (+ `writeContent`), `package.json` (скрипт, `engines`), `.gitignore`, `tests/site.test.js` (+1 тест)
- Test: `tests/cms-pull.test.js`

**Interfaces:**
- Consumes: `fetchStories`, `deliveryUrl` (Задача 1); `storiesToEntries`, `validateContent` (Задача 2); `publicUrl` з `scripts/cms/sync.mjs`; `COLLECTIONS`; `PAGE_IDS`; `withBuild` (`tests/helpers/build.js`); `distDir` (`tests/helpers/dist.js`).
- Produces:
  - `isStoryblokAsset(value) → boolean`.
  - `localAssetName(url) → 'uploads/cms/<sha12>-<stem><ext>'`.
  - `localizeAssets(entries, { publicDir, download, isAsset? }) → Promise<{ entries, downloaded, reused }>`.
  - `downloadAsset(url, fetch?) → Promise<Buffer>`.
  - `CMS_UPLOADS = 'uploads/cms'`.
  - `writeContent(dir, entries)`: обернення `readContent`.
  - `runPull({ stories, contentDir, publicDir, download, isAsset?, log? }) → Promise<{ exitCode, problems }>`.
  - `diffDirs(a, b) → string[]`; CLI `node scripts/lib/diff-dirs.mjs <a> <b>` (код 1 при відмінностях).
  - `npm run cms:pull [-- --out <тека контенту>] [--public <тека public>]`. Змінні: `STORYBLOK_PUBLIC_TOKEN` (обовʼязкова), `STORYBLOK_REGION`, `STORYBLOK_DELIVERY_URL` (лише тести).

- [ ] **Step 1: Тест, що падає**

`tests/cms-pull.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { canonical } from '../src/lib/storyblok/convert.mjs';
import { fetchStories } from '../src/lib/storyblok/delivery.mjs';
import { CMS_UPLOADS, downloadAsset, isStoryblokAsset, localAssetName } from '../scripts/cms/assets.mjs';
import { readContent } from '../scripts/cms/content.mjs';
import { runPull } from '../scripts/cms/snapshot.mjs';
import { diffDirs } from '../scripts/lib/diff-dirs.mjs';
import { projectRoot, withBuild } from './helpers/build.js';
import { contentDir, fakeClient, PROBE_PNG, publicDir, quietLog, seedFake, withContentCopy, withFake } from './helpers/cms.js';
import { distDir } from './helpers/dist.js';
import { ministry } from './helpers/probes.js';

// Тека контенту й копія public/ для одного прогону: справжні src/content і
// public/ тести не чіпають ніколи.
async function withDirs(fn) {
  const content = mkdtempSync(join(tmpdir(), 'hob-pull-content-'));
  const pub = mkdtempSync(join(tmpdir(), 'hob-pull-public-'));
  try {
    cpSync(publicDir, pub, { recursive: true });
    return await fn({ content, pub });
  } finally {
    rmSync(content, { recursive: true, force: true });
    rmSync(pub, { recursive: true, force: true });
  }
}

// Фейк віддає файли медіатеки зі своєї адреси, а не з a.storyblok.com.
const fakeAsset = (fake) => (s) => isStoryblokAsset(s) || s.startsWith(`${fake.baseUrl}/f/`);
const pull = async (fake, dirs, log = quietLog().log) => runPull({
  stories: await fetchStories({ token: fake.publicToken, baseUrl: fake.baseUrl }),
  contentDir: dirs.content, publicDir: dirs.pub, download: (url) => downloadAsset(url), isAsset: fakeAsset(fake), log,
});
const byPath = (entries) => new Map(entries.map((e) => [e.path, canonical(e.collection, e.data)]));
const libraryAsset = async (fake, name) => {
  const { id, filename } = await fakeClient(fake).upload(name, PROBE_PNG, 'image/png');
  return { id, filename, fieldtype: 'asset', is_external_url: false };
};

test('Storyblok → файли: ті самі дані, картинки медіатеки — ті самі файли з public/', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    await withDirs(async (dirs) => {
      assert.equal((await pull(fake, dirs)).exitCode, 0);
      assert.deepEqual(byPath(readContent(dirs.content)), byPath(readContent(contentDir)));
      assert.equal(existsSync(join(dirs.pub, CMS_UPLOADS)), false, 'кожна картинка медіатеки мала збігтися з файлом у public/');
    });
  });
});

test('нова картинка редактора — у uploads/cms, і дані ведуть на неї', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    // Імʼя ASCII: фейк зберігає файл під сирим ключем, а fetch кодує
    // кирилицю в адресі. Кирилицю в імені перевіряє тест localAssetName нижче.
    const asset = await libraryAsset(fake, 'Photo_1.PNG');
    fake.editStory('settings/homepage', (c) => { c.heroImage[0].src = asset; });
    await withDirs(async (dirs) => {
      assert.equal((await pull(fake, dirs)).exitCode, 0);
      const home = readContent(dirs.content).find((e) => e.collection === 'homepage').data;
      assert.match(home.heroImage.src, /^uploads\/cms\/[0-9a-f]{12}-photo-1\.png$/);
      assert.ok(readFileSync(join(dirs.pub, home.heroImage.src)).equals(PROBE_PNG));
    });
  });
});

test('адреса медіатеки, вставлена як «зовнішня», теж стає локальним файлом', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    const asset = await libraryAsset(fake, 'external.png');
    fake.editStory('settings/homepage', (c) => { c.heroImage[0].src = { ...asset, id: null, is_external_url: true }; });
    await withDirs(async (dirs) => {
      assert.equal((await pull(fake, dirs)).exitCode, 0);
      const home = readContent(dirs.content).find((e) => e.collection === 'homepage').data;
      assert.match(home.heroImage.src, /^uploads\/cms\//);
    });
  });
});

test('невалідна опублікована історія: помилка з назвою поля, жоден файл не змінено', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    fake.editStory('settings/site-settings', (c) => { c.name_en = ''; });
    await withDirs(async (dirs) => {
      cpSync(contentDir, dirs.content, { recursive: true });
      const log = quietLog();
      const { exitCode, problems } = await pull(fake, dirs, log.log);
      assert.equal(exitCode, 1);
      assert.ok(problems.some((p) => p.startsWith('settings/site-settings → name.en')), problems.join('\n'));
      assert.deepEqual(diffDirs(contentDir, dirs.content), []);
      assert.match(log.text(), /файли не змінено/);
    });
  });
});

test('знята з публікації історія зникає з файлів, а не лишається з минулого разу', async () => {
  await withContentCopy((fixture) => fixture.write('ministries', 'probe-gone', ministry('probe-gone')), async (dir) => {
    await withFake({}, async (fake) => {
      await seedFake(fake, dir);
      fake.unpublish('ministries/probe-gone');
      await withDirs(async (dirs) => {
        cpSync(dir, dirs.content, { recursive: true });
        assert.equal((await pull(fake, dirs)).exitCode, 0);
        assert.equal(existsSync(join(dirs.content, 'ministries', 'probe-gone.json')), false);
      });
    });
  });
});

test('адреси файлів Storyblok у всіх формах — і лише вони', () => {
  for (const url of [
    'https://a.storyblok.com/f/1/2x3/abc/x.jpg', '//a.storyblok.com/f/1/x.jpg',
    'https://s3.amazonaws.com/a.storyblok.com/f/1/x.jpg', 'https://a-us.storyblok.com/f/1/x.jpg',
  ]) assert.ok(isStoryblokAsset(url), url);
  for (const value of ['https://picsum.photos/1', 'uploads/logo.png', 'https://evil.test/a.storyblok.com/f/1', 42, null]) {
    assert.equal(isStoryblokAsset(value), false, String(value));
  }
});

test('локальне імʼя: детерміноване, безпечне для URL, однакове для // і s3', () => {
  assert.match(localAssetName('https://a.storyblok.com/f/1/800x600/abc/Фото%20Літо.JPG'), /^uploads\/cms\/[0-9a-f]{12}-file\.jpg$/);
  assert.match(localAssetName('https://a.storyblok.com/f/1/x/y/hero-cross.jpg'), /^uploads\/cms\/[0-9a-f]{12}-hero-cross\.jpg$/);
  assert.equal(
    localAssetName('//a.storyblok.com/f/1/x/y/hero-cross.jpg'),
    localAssetName('https://s3.amazonaws.com/a.storyblok.com/f/1/x/y/hero-cross.jpg'),
  );
});

// CLI — асинхронно: execFileSync заблокував би event loop, і фейк у цьому ж
// процесі не відповів би.
const runCli = (args, env) => promisify(execFile)(process.execPath, [join(projectRoot, 'scripts/cms/pull.mjs'), ...args], {
  cwd: projectRoot, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
}).then(() => ({ code: 0, out: '' }), (error) => ({ code: error.code, out: `${error.stdout}${error.stderr}` }));

test('cms:pull без токена: код 1 і назва змінної — жодного тихого фолбеку на файли', async () => {
  await withDirs(async (dirs) => {
    const { code, out } = await runCli(['--out', dirs.content, '--public', dirs.pub], {});
    assert.equal(code, 1);
    assert.match(out, /STORYBLOK_PUBLIC_TOKEN/);
  });
});

test('cms:pull на фейку: записує контент у вказану теку', async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    await withDirs(async (dirs) => {
      const { code, out } = await runCli(['--out', dirs.content, '--public', dirs.pub], {
        STORYBLOK_PUBLIC_TOKEN: fake.publicToken, STORYBLOK_DELIVERY_URL: fake.baseUrl,
      });
      assert.equal(code, 0, out);
      assert.ok(existsSync(join(dirs.content, 'singletons', 'homepage.json')));
    });
  });
});

// Критерій спеки: «Astro збирає сайт зі Storyblok; сторінки не відрізняються
// від версії на файлах». dist/ — збірка npm test з src/content.
test('сайт, зібраний зі Storyblok, побайтово дорівнює зібраному з файлів', { timeout: 300_000 }, async () => {
  await withFake({}, async (fake) => {
    await seedFake(fake);
    await withDirs(async (dirs) => {
      assert.equal((await pull(fake, dirs)).exitCode, 0);
      withBuild((fixture) => {
        rmSync(fixture.dir, { recursive: true, force: true });
        cpSync(dirs.content, fixture.dir, { recursive: true });
      }, ({ failed, output, outDir }) => {
        assert.equal(failed, false, output);
        assert.deepEqual(diffDirs(distDir, outDir), []);
      });
    });
  });
});
```

У `tests/site.test.js` дописати:

```js
// Спека 3: браузер відвідувача не звертається до Storyblok, а розмітка
// Visual Editor живе лише на прев'ю-стенді.
test('жодної адреси Storyblok і розмітки Visual Editor у продакшн-збірці', () => {
  for (const { url, root } of pages) {
    for (const el of root.querySelectorAll('[src], [href], [srcset], meta[content]')) {
      for (const attr of ['src', 'href', 'srcset', 'content']) {
        const value = el.getAttribute(attr);
        if (value) assert.doesNotMatch(value, /storyblok\.com/i, `${url}: ${attr}="${value}"`);
      }
    }
    assert.equal(root.querySelectorAll('[data-blok-c], [data-blok-uid]').length, 0, `${url}: атрибути Visual Editor`);
  }
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `node --test tests/cms-pull.test.js`
Expected: FAIL — `Cannot find module '…/scripts/cms/assets.mjs'`.

- [ ] **Step 3: `scripts/lib/diff-dirs.mjs`**

```js
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const walk = (dir) => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

// Дві збірки файл у файл. Одна перевірка на два питання: «сторінки не
// відрізняються від версії на файлах» (Спека 3) і «рефакторинг не змінив
// виходу» (Задачі 5, 7, 8 плану Етапу 5).
export function diffDirs(a, b) {
  const files = (root) => new Set(walk(root).map((f) => relative(root, f).split(sep).join('/')));
  const left = files(a);
  const right = files(b);
  const out = [];
  for (const f of [...new Set([...left, ...right])].sort()) {
    if (!right.has(f)) out.push(`${f}: є лише в ${a}`);
    else if (!left.has(f)) out.push(`${f}: є лише в ${b}`);
    else if (!readFileSync(join(a, f)).equals(readFileSync(join(b, f)))) out.push(`${f}: вміст відрізняється`);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [a, b] = process.argv.slice(2);
  const diffs = diffDirs(a, b);
  for (const d of diffs) console.log(`✗ ${d}`);
  console.log(diffs.length > 0 ? `Відмінностей: ${diffs.length}.` : 'Збірки однакові.');
  process.exitCode = diffs.length > 0 ? 1 : 0;
}
```

- [ ] **Step 4: `scripts/cms/assets.mjs`**

```js
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { publicUrl } from './sync.mjs';

// Спека 3: картинки з медіатеки завантажуються на збірці й лежать поруч із
// сайтом — браузер відвідувача не звертається до Storyblok. Будь-яка адреса
// файлів Storyblok стає локальним файлом: і в полі-картинці, і вставлена
// редактором як «зовнішня», і в полі-посиланні.
export const CMS_UPLOADS = 'uploads/cms';
const ASSET_HOST = /^(?:https?:)?\/\/(?:s3\.amazonaws\.com\/)?a(?:-[a-z]{2})?\.storyblok\.com\//i;

export const isStoryblokAsset = (value) => typeof value === 'string' && ASSET_HOST.test(value);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Імʼя детерміноване (та сама адреса — той самий файл на кожній збірці) і
// безпечне для URL. Storyblok імʼя вже параметризує, але «Фото 1.JPG» лишає
// кирилицю й пробіли.
export function localAssetName(url) {
  const href = publicUrl(url);
  const file = decodeURIComponent(new URL(href).pathname.split('/').pop() || '');
  const ext = extname(file).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const stem = file.slice(0, file.length - extname(file).length).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  return `${CMS_UPLOADS}/${sha256(href).slice(0, 12)}-${stem}${ext}`;
}

export async function downloadAsset(url, fetch = globalThis.fetch) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`не вдалося завантажити ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function filesUnder(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)]));
  } catch {
    return [];
  }
}

function mapStrings(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]));
  return value;
}

// Файл, байт у байт такий самий, як наявний у public/uploads (картинки,
// залиті імпортом Етапу 4), отримує той самий шлях. Тоді збірка зі Storyblok
// не відрізняється від збірки з файлів, і public/ не росте дублікатами.
// uploads/cms очищається щоразу: видалена з контенту картинка не лишиться в dist.
export async function localizeAssets(entries, { publicDir, download, isAsset = isStoryblokAsset }) {
  rmSync(join(publicDir, ...CMS_UPLOADS.split('/')), { recursive: true, force: true });
  const known = new Map();
  for (const file of filesUnder(join(publicDir, 'uploads'))) {
    known.set(sha256(readFileSync(file)), relative(publicDir, file).split(sep).join('/'));
  }
  const urls = new Set();
  for (const e of entries) mapStrings(e.data, (s) => (isAsset(s) && urls.add(s), s));
  const local = new Map();
  let downloaded = 0;
  let reused = 0;
  for (const url of [...urls].sort()) {
    const bytes = await download(publicUrl(url));
    const hash = sha256(bytes);
    if (known.has(hash)) {
      local.set(url, known.get(hash));
      reused++;
      continue;
    }
    const rel = localAssetName(url);
    mkdirSync(dirname(join(publicDir, rel)), { recursive: true });
    writeFileSync(join(publicDir, rel), bytes);
    known.set(hash, rel);
    local.set(url, rel);
    downloaded++;
  }
  return { entries: entries.map((e) => ({ ...e, data: mapStrings(e.data, (s) => local.get(s) ?? s) })), downloaded, reused };
}
```

- [ ] **Step 5: `writeContent` у `scripts/cms/content.mjs`**

Додати до імпортів `mkdirSync, rmSync, writeFileSync` (з `node:fs`) і `PAGE_IDS` (з `../../src/lib/schema.mjs`). Дописати:

```js
// Обернення readContent: той самий розклад файлів, що читає збірка. Теки
// колекцій створюються заново — запис, видалений чи знятий з публікації в
// Storyblok, не лишається з минулого прогону (Review Focus 3).
export function writeContent(dir, entries) {
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  for (const [collection, entry] of Object.entries(COLLECTIONS)) {
    if (entry.kind === 'collection') rmSync(join(dir, collection), { recursive: true, force: true });
  }
  mkdirSync(join(dir, 'singletons'), { recursive: true });
  const pages = {};
  for (const e of entries) {
    const entry = COLLECTIONS[e.collection];
    if (entry.kind === 'collection') {
      mkdirSync(join(dir, e.collection), { recursive: true });
      writeFileSync(join(dir, e.collection, `${e.slug}.json`), json(e.data));
    } else if (entry.kind === 'pages') {
      pages[e.slug] = e.data;
    } else {
      writeFileSync(join(dir, 'singletons', `${e.collection}.json`), json({ main: e.data }));
    }
  }
  // Порядок сторінок як у PAGE_IDS: diff знімка в git показує зміни, а не перестановки.
  const ordered = Object.fromEntries(Object.entries(pages).sort(([a], [b]) => PAGE_IDS.indexOf(a) - PAGE_IDS.indexOf(b)));
  writeFileSync(join(dir, 'singletons', 'pages.json'), json(ordered));
}
```

- [ ] **Step 6: `scripts/cms/snapshot.mjs`**

```js
import { validateContent } from '../../src/lib/content-rules.mjs';
import { storiesToEntries } from '../../src/lib/storyblok/entries.mjs';
import { CMS_UPLOADS, isStoryblokAsset, localizeAssets } from './assets.mjs';
import { writeContent } from './content.mjs';

// cms:pull: опублікований Storyblok → файли того самого вигляду, що
// src/content. Далі astro build і npm test ідуть звичайним шляхом, з тими ж
// перевірками, що стерегли файли (CLAUDE.md, контракт з адмінкою).
// Перевірки — до будь-якого запису: невалідний контент не лишає по собі
// напівзаписаних файлів.
export async function runPull({ stories, contentDir, publicDir, download, isAsset = isStoryblokAsset, log = console.log }) {
  const { entries, errors, warnings } = storiesToEntries(stories);
  for (const w of warnings) log(`! ${w}`);
  const problems = [...errors, ...validateContent(entries)];
  if (problems.length > 0) {
    for (const p of problems) log(`✗ ${p}`);
    log(`Контент у Storyblok не проходить перевірки (${problems.length}) — файли не змінено.`);
    return { exitCode: 1, problems };
  }
  const result = await localizeAssets(entries, { publicDir, download, isAsset });
  writeContent(contentDir, result.entries);
  log(`Записано історій: ${entries.length}. Картинки медіатеки: ${result.reused} збіглися з public/, ${result.downloaded} завантажено в ${CMS_UPLOADS}/.`);
  return { exitCode: 0, problems: [] };
}
```

- [ ] **Step 7: CLI `scripts/cms/pull.mjs`, `package.json`, `.gitignore`**

```js
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deliveryUrl, fetchStories } from '../../src/lib/storyblok/delivery.mjs';
import { downloadAsset, isStoryblokAsset } from './assets.mjs';
import { runPull } from './snapshot.mjs';

// npm run cms:pull                                  — опублікована версія → src/content, картинки → public/uploads/cms
// npm run cms:pull -- --out <тека> --public <тека>  — інші теки (порівняння збірок, тести)
// Токен — Public (лише опублікована версія): у CI секрет STORYBLOK_PUBLIC_TOKEN,
// локально — .env.
const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const OPTIONS = ['--out', '--public'];
const bad = args.filter((a, i) => a.startsWith('--') && (!OPTIONS.includes(a) || !args[i + 1] || args[i + 1].startsWith('--')));
if (bad.length > 0) {
  console.error(`невідомі або неповні параметри: ${bad.join(' ')} (можливі: --out <тека>, --public <тека>)`);
  process.exit(2);
}
const option = (name, fallback) => (args.includes(name) ? resolve(args[args.indexOf(name) + 1]) : fallback);

try {
  const token = process.env.STORYBLOK_PUBLIC_TOKEN;
  if (!token) throw new Error('немає STORYBLOK_PUBLIC_TOKEN (Storyblok → Settings → Access Tokens, рівень Public; у CI — секрет репозиторію)');
  const baseUrl = deliveryUrl(process.env);
  // Фейк у тестах віддає файли медіатеки зі своєї адреси, а не з a.storyblok.com.
  const fakeFiles = process.env.STORYBLOK_DELIVERY_URL ? `${new URL(baseUrl).origin}/f/` : null;
  const { exitCode } = await runPull({
    stories: await fetchStories({ token, baseUrl, version: 'published' }),
    contentDir: option('--out', join(root, 'src/content')),
    publicDir: option('--public', join(root, 'public')),
    download: (url) => downloadAsset(url),
    isAsset: (s) => isStoryblokAsset(s) || (fakeFiles !== null && typeof s === 'string' && s.startsWith(fakeFiles)),
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}
```

`package.json`:
- у `scripts` додати `"cms:pull": "node --env-file-if-exists=.env scripts/cms/pull.mjs"`;
- `engines.node` → `">=22.9"`.

`.gitignore`, у кінець:

```
# Картинки медіатеки Storyblok, завантажені cms:pull (Етап 5) — знімок збірки, не джерело
public/uploads/cms/
```

- [ ] **Step 8: Тести зелені**

Run: `npm test`
Expected: 0 FAIL. Якщо тест рівності збірок показує відмінність, треба знайти, що в шаблоні залежить від порядку ключів або від різниці «немає ↔ null». Кандидат — `Object.values(settings.social)` у `index.astro`: порядок полів `fromStory` — порядок моделі, а він має збігатися з файлами. Виправляти модель або конвертер, а не шаблон, і не послаблювати тест.

- [ ] **Step 9: Коміт**

```bash
git add scripts/cms/assets.mjs scripts/cms/snapshot.mjs scripts/cms/pull.mjs scripts/cms/content.mjs scripts/lib/diff-dirs.mjs package.json .gitignore tests/cms-pull.test.js tests/site.test.js
git commit -m "feat: cms:pull — опублікований Storyblok у файли, картинки медіатеки поруч із сайтом

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 4: деплой збирає контент зі Storyblok

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Test: `tests/deploy.test.js`

**Interfaces:**
- Consumes: `npm run cms:pull` (Задача 3).
- Produces: крок `Pull published content from Storyblok` перед `npm test`; секрет `STORYBLOK_PUBLIC_TOKEN`; `workflow_dispatch`, який запускає вебхук (Задача 9).

- [ ] **Step 1: Тест, що падає**

`tests/deploy.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Після Етапу 5 джерело правди — Storyblok. Збірка main з src/content
// мовчки відкотила б сайт до стану репозиторію (Review Focus 1).
const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/deploy.yml', import.meta.url)), 'utf8');

test('кожна збірка main бере опублікований контент зі Storyblok до npm test', () => {
  const pull = workflow.indexOf('run: npm run cms:pull');
  const gate = workflow.indexOf('run: npm test');
  assert.ok(pull > 0, 'немає кроку npm run cms:pull');
  assert.ok(gate > pull, 'cms:pull має йти перед npm test');
  assert.match(workflow, /STORYBLOK_PUBLIC_TOKEN:\s*\$\{\{\s*secrets\.STORYBLOK_PUBLIC_TOKEN\s*\}\}/);
});

test('вебхук публікації може запустити деплой', () => {
  assert.match(workflow, /^\s{2}workflow_dispatch:/m);
});

test('у CI немає токенів запису чи чернеток', () => {
  assert.doesNotMatch(workflow, /MANAGEMENT_TOKEN|PREVIEW_TOKEN/);
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `node --test tests/deploy.test.js`
Expected: FAIL — «немає кроку npm run cms:pull».

- [ ] **Step 3: `deploy.yml`**

Між `- uses: actions/configure-pages@v5` і `- name: Build and verify output` вставити:

```yaml
      # Етап 5: джерело правди — Storyblok. Кожна збірка main (пуш коду,
      # вебхук публікації, ручний запуск) бере опубліковану версію. Без
      # токена крок падає — тихо зібрати застарілий src/content не можна.
      # Токен Public дає лише читання опублікованого.
      - name: Pull published content from Storyblok
        env:
          STORYBLOK_PUBLIC_TOKEN: ${{ secrets.STORYBLOK_PUBLIC_TOKEN }}
          STORYBLOK_REGION: eu
        run: npm run cms:pull
```

Над `concurrency:` доповнити коментар:

```yaml
# Один деплой за раз; проміжні пуші не перебивають той, що вже котиться.
# GitHub тримає в черзі лише одну збірку групи: пачка публікацій у
# Storyblok (кожна — вебхук) дає одну-дві збірки, а не десять.
```

- [ ] **Step 4: Тести зелені, коміт**

Run: `npm test` → Expected: 0 FAIL.

```bash
git add .github/workflows/deploy.yml tests/deploy.test.js
git commit -m "ci: деплой збирає опублікований контент зі Storyblok

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

> Цей коміт у `main` без секрету `STORYBLOK_PUBLIC_TOKEN` зламає деплой. Гілку зливати лише в Задачі 11, крок 4.

---

## Задача 5: один шар даних для шаблонів — `siteData()`

**Files:**
- Create: `src/lib/site.mjs`, `src/lib/site-data.ts`, `src/lib/routing.mjs`
- Modify: `src/env.d.ts`; усі 13 маршрутів `src/pages/[...lang]/**/*.astro`; `src/components/{Seo,SiteHeader,SiteFooter,SubHeader}.astro`
- Test: `tests/site-data.test.js`

**Interfaces:**
- Consumes: `byOrder` (collections.mjs), `storyPath` (convert.mjs), `COLLECTIONS` (model.mjs).
- Produces:
  - `makeSite(entries, editables = new Map()) → Site`, де `entries` — `{ collection, slug, data }`.
  - `Site`: `list(name)` — записи за `order`, потім `slug`, порожня колекція → `[]`; `one(name)` — одиночка; `page(id)`; `edit(collection, slug = null, field = '')` → атрибути або `{}`.
  - `siteData(locals?) → Promise<Site>`: `locals.site` або колекції Astro. Типи `Site`, `PageId`.
  - `pageLang(astro) → 'uk' | 'en' | null`, `notFound() → Response 404`.
  - `App.Locals`: `site?: Site`, `preview?: boolean`.
  - У шаблонах змінна шару даних зветься **`store`**: імʼя `site` уже зайняте (`Astro.site!.href` в `index.astro` і `churches/[slug].astro`).

- [ ] **Step 1: Знімок збірки «до»**

Run: `npx astro build --outDir "$TEMP/hob-before-5"` (у PowerShell — `$env:TEMP\hob-before-5`)
Expected: збірка без помилок. Ця тека — еталон для кроку 7.

- [ ] **Step 2: Тест, що падає**

`tests/site-data.test.js`:

```js
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
```

- [ ] **Step 3: Запустити — має впасти**

Run: `node --test tests/site-data.test.js`
Expected: FAIL — немає `src/lib/routing.mjs` / `site.mjs`.

- [ ] **Step 4: `site.mjs`, `routing.mjs`, `site-data.ts`, `env.d.ts`**

`src/lib/site.mjs`:

```js
import { byOrder } from './collections.mjs';
import { storyPath } from './storyblok/convert.mjs';
import { COLLECTIONS } from './storyblok/model.mjs';

// Єдиний вхід шаблонів до даних. Статична збірка наповнює його з колекцій
// Astro (site-data.ts), прев'ю-стенд — з чернетки Storyblok на кожен запит
// (src/preview/middleware.mjs). Шаблони не знають, звідки дані.
export function makeSite(entries, editables = new Map()) {
  const by = new Map();
  for (const entry of entries) {
    if (!by.has(entry.collection)) by.set(entry.collection, []);
    by.get(entry.collection).push(entry);
  }
  const expect = (name, kind) => {
    if (COLLECTIONS[name]?.kind !== kind) throw new Error(`site: «${name}» — не ${kind}`);
  };
  return {
    // Те саме сортування, що sortedData: order, потім slug.
    list(name) {
      expect(name, 'collection');
      return (by.get(name) ?? []).map((e) => e.data).sort(byOrder);
    },
    one(name) {
      expect(name, 'singleton');
      const found = by.get(name)?.[0];
      if (!found) throw new Error(`site: немає одиночки «${name}»`);
      return found.data;
    },
    page(id) {
      const found = (by.get('pages') ?? []).find((e) => e.slug === id);
      if (!found) throw new Error(`site: немає сторінки «${id}»`);
      return found.data;
    },
    // Атрибути Visual Editor для блоку історії. Поза прев'ю — {}: у
    // продакшн-HTML не додається нічого.
    edit(collection, slug = null, field = '') {
      if (editables.size === 0) return {};
      return editables.get(`${storyPath(collection, slug ?? COLLECTIONS[collection].slug)}#${field}`) ?? {};
    },
  };
}
```

`src/lib/routing.mjs`:

```js
// Статична збірка передає мову в props (localeParams), серверний режим
// прев'ю — лише параметром адреси. Невідомий префікс (/foo/about/) не є
// сторінкою сайту: null, і маршрут відповідає 404.
export function pageLang(astro) {
  if (astro.props?.lang) return astro.props.lang;
  const param = astro.params?.lang;
  if (param === undefined) return 'uk';
  return param === 'en' ? 'en' : null;
}

export const notFound = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
```

`src/lib/site-data.ts`:

```ts
import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';
import { makeSite } from './site.mjs';
import { COLLECTIONS } from './storyblok/model.mjs';

type Data<C extends CollectionKey> = CollectionEntry<C>['data'];
type ListName = 'ministries' | 'churches' | 'projects' | 'testimonies' | 'pastors' | 'leader-resources';
type SingletonName = 'site-settings' | 'contact-info' | 'donate-settings' | 'homepage';
export type PageId = 'about' | 'contacts' | 'donate' | 'churches' | 'ministries' | 'projects' | 'testimonies' | 'pastors' | 'leaders';

export interface Site {
  list<C extends ListName>(name: C): Data<C>[];
  one<C extends SingletonName>(name: C): Data<C>;
  page(id: PageId): Data<'pages'>;
  edit(collection: CollectionKey, slug?: string | null, field?: string): Record<string, string>;
}

// Статична збірка: колекції Astro (content.config.ts — ті самі схеми й
// перевірки). Без кешу на рівні модуля: в astro dev правка файлу контенту
// видна одразу, а getCollection і так читає зі сховища в памʼяті.
async function fromCollections(): Promise<Site> {
  const entries = [];
  for (const [collection, entry] of Object.entries(COLLECTIONS)) {
    for (const { id, data } of await getCollection(collection as CollectionKey)) {
      const slug = entry.kind === 'collection' ? (data as { slug: string }).slug : entry.kind === 'pages' ? id : entry.slug;
      entries.push({ collection, slug, data });
    }
  }
  return makeSite(entries) as Site;
}

// Прев'ю-стенд кладе в locals дані чернетки (src/preview/middleware.mjs).
export async function siteData(locals?: App.Locals): Promise<Site> {
  return locals?.site ?? fromCollections();
}
```

`src/env.d.ts`, дописати в кінець:

```ts
declare namespace App {
  interface Locals {
    // Прев'ю-стенд: дані чернетки Storyblok на цей запит (src/preview/middleware.mjs).
    site?: import('./lib/site-data').Site;
    // Сторінку відкрив редактор у Visual Editor: підключити Bridge.
    preview?: boolean;
  }
}
```

- [ ] **Step 5: Маршрути й компоненти на `siteData`**

Спільне для всіх файлів:
- прибрати імпорт з `astro:content` і, якщо стали невживаними, `sortedData`;
- додати `import { siteData } from '<відносний шлях>/lib/site-data';` і, в маршрутах, `import { notFound, pageLang } from '<…>/lib/routing.mjs';`;
- `const { lang } = Astro.props;` замінити на `const lang = pageLang(Astro);` з перевіркою, наведеною нижче. Решта фронтматеру і вся розмітка лишаються як є.

**Детальні сторінки.** Приклад — `ministries/[slug].astro`, повний новий початок фронтматеру до `const base`:

```astro
export async function getStaticPaths() {
  const ministries = (await siteData()).list('ministries');
  return localeParams().flatMap(({ params, props }) =>
    ministries.map((ministry) => ({ params: { ...params, slug: ministry.slug }, props })));
}

// Запис шукається тут, а не береться з props: у серверному режимі прев'ю
// getStaticPaths не викликається, є лише адреса.
const store = await siteData(Astro.locals);
const lang = pageLang(Astro);
const ministries = store.list('ministries');
const index = ministries.findIndex((x) => x.slug === Astro.params.slug);
if (!lang || index < 0) return notFound();
const m = ministries[index];
// «Інші служіння» — наступні чотири по колу, як у легасі.
const related = nextCyclic(ministries, index, 4);
```

`churches/[slug].astro` — так само з `store.list('churches')`, `const c = churches[index]; const others = othersFirst(churches, c.slug, 3);`.
`projects/[slug].astro` — `store.list('projects')`, `const p = projects[index]; const others = othersFirst(projects, p.slug, 3);`.

**Сторінки з `body`** (`about`, `contacts`, `donate`; приклад — `about`):

```astro
export async function getStaticPaths() {
  return isPageEnabled((await siteData()).page('about')) ? localeParams() : [];
}

const store = await siteData(Astro.locals);
const lang = pageLang(Astro);
const page = store.page('about');
if (!lang || !isPageEnabled(page)) return notFound();
```

Потім `const base…` і решта як були, з заміною:
- `contacts`: `const contact = store.one('contact-info');`;
- `donate`: `const donate = store.one('donate-settings'); const heroDonate = store.one('homepage').hero.donate;`.

**Списки й головна** (`index`, `churches/index`, `ministries/index`, `projects/index`, `testimonies`, `pastors`, `leaders`): `getStaticPaths` лишається `localeParams()`. Після нього:

```astro
const store = await siteData(Astro.locals);
const lang = pageLang(Astro);
if (!lang) return notFound();
```

Далі заміни один до одного:
- `(await getEntry('pages', 'X'))!.data` → `store.page('X')`;
- `(await getEntry('C', 'main'))!.data` → `store.one('C')`;
- `sortedData(await getCollection('C'))` → `store.list('C')`.

Приклад `index.astro`: `const ministries = store.list('ministries').slice(0, 3);`, `const videoTestimonies = store.list('testimonies').filter((x) => x.type === 'video').map(…)`.

**Компоненти:**
- `SiteHeader.astro`: `const store = await siteData(Astro.locals); const settings = store.one('site-settings'); const { nav, cta } = store.one('homepage');`.
- `SubHeader.astro`: `const settings = (await siteData(Astro.locals)).one('site-settings');`.
- `SiteFooter.astro`: `const store = await siteData(Astro.locals); const home = store.one('homepage'); const settings = store.one('site-settings'); const contact = store.one('contact-info');`. `pageOr` стає синхронною: `const pageOr = (id: 'about' | 'contacts' | 'donate', anchor: string) => isPageEnabled(store.page(id)) ? localePath(base, lang, `/${id}/`) : anchor;`, і з трьох викликів прибрати `await`.
- `Seo.astro`: `import type { CollectionEntry } from 'astro:content';` (лише тип) + `import { siteData } from '../lib/site-data';`; `const store = await siteData(Astro.locals); const settings = store.one('site-settings'); const home = store.one('homepage');`.

- [ ] **Step 6: Тести зелені**

Run: `npm test`
Expected: 0 FAIL, зокрема охоронний тест `astro:content`.

- [ ] **Step 7: Вихід не змінився**

Run: `node scripts/lib/diff-dirs.mjs "$TEMP/hob-before-5" dist`
Expected: `Збірки однакові.` Будь-яка відмінність означає, що рефакторинг змінив поведінку. Шукати в тому маршруті, чий файл названо, і виправляти до коміту.

- [ ] **Step 8: Коміт**

```bash
git add src/lib/site.mjs src/lib/site-data.ts src/lib/routing.mjs src/env.d.ts src/pages src/components tests/site-data.test.js
git commit -m "refactor: шаблони читають дані лише через siteData()

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 6: прев'ю — доступ редактора, адреси історій, службові сторінки

**Files:**
- Create: `src/preview/access.mjs`, `src/preview/routes.mjs`, `src/preview/pages.mjs`, `src/preview/env.mjs`
- Test: `tests/preview-lib.test.js`

**Interfaces:**
- Consumes: `localePath` (paths.mjs), `PAGE_IDS` (schema.mjs).
- Produces:
  - `editorAccess({ url: URL, cookieHeader?: string | null, spaceId, previewToken, now: number }) → Promise<{ ok: boolean, setCookie?: string }>`.
  - `sha1Hex(text)`, `hmacHex(algorithm, key, text)`, `safeEqual(a, b)` — Web Crypto, працюють у Node і у воркері.
  - `SESSION_COOKIE = 'hob_editor'`.
  - `storyRedirect(url: URL, base: string) → string | null`; `sitePathForStory(fullSlug) → string | null`.
  - `deniedPage() → string`, `problemsPage(problems: string[]) → string` — HTML з `noindex`.
  - `previewEnv(locals) → Record<string, string>`.

- [ ] **Step 1: Тест, що падає**

`tests/preview-lib.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { editorAccess } from '../src/preview/access.mjs';
import { deniedPage, problemsPage } from '../src/preview/pages.mjs';
import { storyRedirect } from '../src/preview/routes.mjs';

const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const NOW = Date.UTC(2026, 8, 25, 12);
const SECONDS = Math.floor(NOW / 1000);
const opts = { spaceId: '1', previewToken: 'prev', now: NOW };
// Адреса, з якою Visual Editor відкриває сторінку в iframe.
function tkUrl(path, { space = '1', ts = SECONDS, token } = {}) {
  const url = new URL(`https://preview.test${path}`);
  url.searchParams.set('_storyblok', '42');
  url.searchParams.set('_storyblok_tk[space_id]', space);
  url.searchParams.set('_storyblok_tk[timestamp]', String(ts));
  url.searchParams.set('_storyblok_tk[token]', token ?? sha1(`${space}:prev:${ts}`));
  return url;
}

test('чинний токен редактора → доступ і cookie сесії для iframe', async () => {
  const access = await editorAccess({ url: tkUrl('/'), ...opts });
  assert.equal(access.ok, true);
  assert.match(access.setCookie, /^hob_editor=\d+\.[0-9a-f]{64}; Path=\/; Max-Age=3600; HttpOnly; Secure; SameSite=None; Partitioned$/);
});

test('без токена, з чужим простором, простроченим чи підробленим — відмова', async () => {
  for (const url of [
    new URL('https://preview.test/'), tkUrl('/', { space: '2' }),
    tkUrl('/', { ts: SECONDS - 7200 }), tkUrl('/', { token: 'f'.repeat(40) }),
  ]) assert.equal((await editorAccess({ url, ...opts })).ok, false, url.search);
});

test('сесія: чинна cookie пускає; прострочена чи з іншим ключем — ні', async () => {
  const { setCookie } = await editorAccess({ url: tkUrl('/'), ...opts });
  const cookie = setCookie.split(';')[0];
  const plain = new URL('https://preview.test/ministries/');
  assert.equal((await editorAccess({ url: plain, cookieHeader: `a=1; ${cookie}`, ...opts })).ok, true);
  assert.equal((await editorAccess({ url: plain, cookieHeader: cookie, ...opts, now: NOW + 3601_000 })).ok, false);
  assert.equal((await editorAccess({ url: plain, cookieHeader: cookie, ...opts, previewToken: 'other' })).ok, false);
  assert.equal((await editorAccess({ url: plain, cookieHeader: 'hob_editor=garbage', ...opts })).ok, false);
});

test('без налаштованого токена прев\'ю — відмова навіть з «чинними» параметрами', async () => {
  assert.equal((await editorAccess({ url: tkUrl('/'), spaceId: '1', previewToken: '', now: NOW })).ok, false);
});

test('адреса історії з Visual Editor → сторінка сайту, query зберігається', () => {
  const cases = [
    ['/pages/about', '/about/'], ['/pages/about/', '/about/'], ['/en/pages/leaders', '/en/leaders/'],
    ['/settings/homepage', '/'], ['/en/settings/site-settings', '/en/'],
    ['/testimonies/anna', '/testimonies/'], ['/pastors/ivan', '/pastors/'], ['/leader-resources/guide', '/leaders/'],
    ['/ministries/youth', '/ministries/youth/'], ['/en', '/en/'], ['/pages/unknown', '/pages/unknown/'],
    ['/', null], ['/en/', null], ['/ministries/youth/', null], ['/about/', null], ['/_astro/x.css', null], ['/fonts/a.woff2', null],
  ];
  for (const [path, want] of cases) assert.equal(storyRedirect(new URL(`https://p.test${path}`), '/'), want, path);
  assert.equal(storyRedirect(new URL('https://p.test/pages/about?_storyblok=1'), '/'), '/about/?_storyblok=1');
  assert.equal(storyRedirect(new URL('https://p.test/sub/pages/about'), '/sub/'), '/sub/about/');
});

test('службові сторінки: noindex, текст екрановано', () => {
  assert.match(deniedPage(), /<meta name="robots" content="noindex">/);
  const html = problemsPage(['settings/site-settings → name.en: <b>порожньо</b>']);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /&lt;b&gt;порожньо&lt;\/b&gt;/);
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `node --test tests/preview-lib.test.js`
Expected: FAIL — немає модулів `src/preview/*`.

- [ ] **Step 3: `src/preview/access.mjs`**

```js
// Прев'ю бачить лише редактор (Спека 3). Visual Editor відкриває сторінку з
// _storyblok_tk[space_id|timestamp|token], де token = sha1(space:previewToken:timestamp)
// (документація Storyblok, перевірка preview-токена). Посилання всередині
// iframe цих параметрів не несуть, тож далі доступ тримає підписана cookie.
// Лише Web Crypto — працює і в Node, і у воркері Cloudflare.
export const SESSION_COOKIE = 'hob_editor';
const SESSION_SECONDS = 3600;
const TOKEN_MAX_AGE_SECONDS = 3600;
const enc = new TextEncoder();
const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const sha1Hex = async (text) => hex(await crypto.subtle.digest('SHA-1', enc.encode(text)));

export async function hmacHex(algorithm, key, text) {
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: algorithm }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(text)));
}

// Без раннього виходу: час відповіді не підказує, скільки символів збіглося.
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validEditorToken(params, { spaceId, previewToken, now }) {
  const space = params.get('_storyblok_tk[space_id]');
  const timestamp = params.get('_storyblok_tk[timestamp]');
  const token = params.get('_storyblok_tk[token]');
  if (!space || !timestamp || !token || space !== String(spaceId)) return false;
  const age = now / 1000 - Number(timestamp);
  // П'ять хвилин «з майбутнього» — запас на розбіжність годинників.
  if (!Number.isFinite(age) || age > TOKEN_MAX_AGE_SECONDS || age < -300) return false;
  return safeEqual(token, await sha1Hex(`${space}:${previewToken}:${timestamp}`));
}

const sessionMac = (previewToken, expires) => hmacHex('SHA-256', previewToken, `hob-editor:${expires}`);

async function sessionCookie(previewToken, now) {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  // SameSite=None + Partitioned: cookie ставиться всередині iframe
  // app.storyblok.com, тобто в сторонньому контексті.
  return `${SESSION_COOKIE}=${expires}.${await sessionMac(previewToken, expires)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=None; Partitioned`;
}

async function validSession(cookieHeader, { previewToken, now }) {
  const value = (cookieHeader ?? '').split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const [expires, mac] = (value ?? '').split('.');
  if (!expires || !mac || !(Number(expires) * 1000 > now)) return false;
  return safeEqual(mac, await sessionMac(previewToken, expires));
}

// Новий токен редактора — нова сесія; чинна cookie — доступ; інакше —
// відмова (і middleware не робить жодного запиту за чернеткою).
export async function editorAccess({ url, cookieHeader, spaceId, previewToken, now }) {
  if (!previewToken || !spaceId) return { ok: false };
  if (await validEditorToken(url.searchParams, { spaceId, previewToken, now })) {
    return { ok: true, setCookie: await sessionCookie(previewToken, now) };
  }
  return { ok: await validSession(cookieHeader, { previewToken, now }) };
}
```

- [ ] **Step 4: `src/preview/routes.mjs`**

```js
import { localePath } from '../lib/paths.mjs';
import { PAGE_IDS } from '../lib/schema.mjs';

// Visual Editor відкриває історію за адресою «<прев'ю>/<full_slug>», а
// адреси сайту інші: pages/about → /about/, settings/* → /, у свідчень,
// пасторів і ресурсів лідерів власних сторінок немає.
const LIST_ONLY = { testimonies: '/testimonies/', pastors: '/pastors/', 'leader-resources': '/leaders/' };
const DETAIL = new Set(['ministries', 'churches', 'projects']);

export function sitePathForStory(fullSlug) {
  const [folder, slug, ...rest] = fullSlug.replace(/^\/+|\/+$/g, '').split('/');
  if (!folder || !slug || rest.length > 0) return null;
  if (folder === 'settings') return '/';
  if (folder === 'pages') return PAGE_IDS.includes(slug) ? `/${slug}/` : null;
  if (LIST_ONLY[folder]) return LIST_ONLY[folder];
  if (DETAIL.has(folder)) return `/${folder}/${slug}/`;
  return null;
}

// Адреса для 302 або null, якщо адреса вже є сторінкою сайту. Адреса без
// кінцевого «/» (так її дає Storyblok) отримує його: маршрути сайту — з ним.
export function storyRedirect(url, base) {
  if (!url.pathname.startsWith(base)) return null;
  let rest = url.pathname.slice(base.length);
  let lang = 'uk';
  if (rest === 'en' || rest.startsWith('en/')) {
    lang = 'en';
    rest = rest.slice(2).replace(/^\//, '');
  }
  if (/\.[a-z0-9]+$/i.test(rest)) return null; // файли (/_astro/…, /fonts/…) — не історії
  const path = sitePathForStory(rest) ?? (rest === '' ? '/' : `/${rest.replace(/\/?$/, '/')}`);
  const href = localePath(base, lang, path);
  return href === url.pathname ? null : `${href}${url.search}`;
}
```

- [ ] **Step 5: `src/preview/pages.mjs` і `src/preview/env.mjs`**

```js
// Службові сторінки прев'ю: рядок HTML, без шаблонів сайту — вони
// показуються саме тоді, коли дані для шаблонів узяти не можна.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const layout = (title, body) => `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head><body style="font:16px/1.5 system-ui,sans-serif;max-width:48rem;margin:3rem auto;padding:0 1rem">${body}</body></html>`;

export const deniedPage = () => layout(
  'Прев\'ю лише для редактора',
  '<h1>Прев\'ю лише для редактора</h1><p>Відкрийте сторінку з Storyblok: оберіть історію в списку — вона відкриється у Visual Editor. Доступ діє годину.</p>',
);

// Рішення 13: редактор бачить, чому чернетка не пройде публікацію, ще до «Опублікувати».
export const problemsPage = (problems) => layout(
  'Чернетка не пройде публікацію',
  `<h1>Чернетка не пройде публікацію</h1><p>З таким контентом сайт не збереться. Виправте поля й збережіть історію:</p><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`,
);
```

`src/preview/env.mjs`:

```js
// Змінні прев'ю-стенду: у воркері Cloudflare — locals.runtime.env (змінні й
// секрети проєкту Pages), в astro dev і тестах — process.env.
export function previewEnv(locals) {
  let runtime = {};
  try {
    runtime = locals?.runtime?.env ?? {};
  } catch {
    // Поза воркером адаптер може кидати на доступі до runtime.
  }
  return { ...(globalThis.process?.env ?? {}), ...runtime };
}
```

- [ ] **Step 6: Тести зелені, коміт**

Run: `npm test` → Expected: 0 FAIL.

```bash
git add src/preview tests/preview-lib.test.js
git commit -m "feat: прев'ю — доступ редактора, адреси історій, службові сторінки

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 7: серверний режим прев'ю на Cloudflare

**Files:**
- Create: `src/integrations/preview.mjs`, `src/preview/middleware.mjs`
- Modify: `astro.config.mjs`, `package.json` (залежність)
- Test: `tests/preview.test.js`

**Interfaces:**
- Consumes: `fetchStories`, `deliveryUrl` (Задача 1); `storiesToEntries` (Задача 2); `validateContent` (Задача 2); `makeSite` (Задача 5); `editorAccess`, `storyRedirect`, `deniedPage`, `problemsPage`, `previewEnv` (Задача 6).
- Produces:
  - `PREVIEW` (експорт `astro.config.mjs`); `HOB_PREVIEW=true` → `output: 'server'` + адаптер Cloudflare.
  - `NOINDEX = PREVIEW || SITE_NOINDEX === 'true'`.
  - Middleware ставить `locals.site`, `locals.preview = true`, і на кожній відповіді — `X-Robots-Tag: noindex`, `Cache-Control: no-store`.
  - Змінні стенду: `STORYBLOK_PREVIEW_TOKEN`, `STORYBLOK_SPACE_ID`, `STORYBLOK_REGION`, `STORYBLOK_DELIVERY_URL` (лише тести).
  - Хелпер тесту `startDev(env)` (усередині `tests/preview.test.js`).

- [ ] **Step 1: Залежність**

Run: `npm install @astrojs/cloudflare@^12`
Expected: `package.json` → `dependencies` містить `"@astrojs/cloudflare": "^12.…"`, `npm ls astro` — одна версія 5.x. Якщо npm вимагає Astro 6, скасувати й закріпити останній `12.x`.

- [ ] **Step 2: Знімок збірки «до»**

Run: `npx astro build --outDir "$TEMP/hob-before-7"`

- [ ] **Step 3: Тест, що падає**

`tests/preview.test.js`:

```js
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { projectRoot } from './helpers/build.js';
import { seedFake } from './helpers/cms.js';
import { startFakeStoryblok } from './helpers/fake-storyblok.js';
import { htmlFiles } from './helpers/links.js';

// Прев'ю-стенд наживо: astro dev у режимі HOB_PREVIEW проти фейкового
// Storyblok. Адаптер Cloudflare у dev не потрібен (platformProxy вимкнено),
// а middleware, маршрути й шаблони — ті самі, що у воркері.
const ASTRO = join(projectRoot, 'node_modules/astro/astro.js');
const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const freePort = () => new Promise((resolve) => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

async function startDev(env) {
  const port = await freePort();
  const child = spawn(process.execPath, [ASTRO, 'dev', '--port', String(port), '--host', '127.0.0.1'], {
    cwd: projectRoot, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 240; i++) {
    try {
      await fetch(`${origin}/robots-probe.txt`);
      return { origin, stop: () => child.kill('SIGKILL') };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  child.kill('SIGKILL');
  throw new Error(`astro dev не піднявся:\n${output}`);
}

let fake;
let dev;
const PREVIEW_ENV = () => ({
  HOB_PREVIEW: 'true', BASE_PATH: '/', SITE_URL: 'https://preview.test', SITE_NOINDEX: '',
  STORYBLOK_PREVIEW_TOKEN: fake.previewToken, STORYBLOK_SPACE_ID: fake.spaceId, STORYBLOK_DELIVERY_URL: fake.baseUrl,
});

before(async () => {
  fake = await startFakeStoryblok();
  await seedFake(fake);
  dev = await startDev(PREVIEW_ENV());
}, { timeout: 180_000 });

after(async () => {
  dev?.stop();
  await fake?.close();
});

function editorUrl(path) {
  const ts = Math.floor(Date.now() / 1000);
  const url = new URL(path, dev.origin);
  url.searchParams.set('_storyblok', '1');
  url.searchParams.set('_storyblok_tk[space_id]', fake.spaceId);
  url.searchParams.set('_storyblok_tk[timestamp]', String(ts));
  url.searchParams.set('_storyblok_tk[token]', sha1(`${fake.spaceId}:${fake.previewToken}:${ts}`));
  return url;
}
const get = (url, headers = {}) => fetch(url, { headers, redirect: 'manual' });
const session = async () => (await get(editorUrl('/'))).headers.get('set-cookie').split(';')[0];
const SETTINGS = 'settings/site-settings';

test('без доступу редактора — 403, noindex і жодного запиту за чернеткою', async () => {
  const requests = fake.state.cdnRequests;
  const res = await get(`${dev.origin}/`);
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(fake.state.cdnRequests, requests);
});

test('редактор бачить неопубліковану чернетку; стенд закритий від індексації', async () => {
  fake.editStory(SETTINGS, (c) => { c.name_uk = 'Назва з чернетки'; }, { publish: false });
  const res = await get(editorUrl('/'));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Назва з чернетки/);
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(res.headers.get('set-cookie') ?? '', /^hob_editor=.*SameSite=None; Partitioned$/);
});

test('сесія з cookie: перехід усередині iframe без параметрів Storyblok', async () => {
  const res = await get(`${dev.origin}/ministries/`, { cookie: await session() });
  assert.equal(res.status, 200);
});

test('невідомий префікс мови, неіснуючий запис, вимкнена сторінка — 404', async () => {
  const cookie = await session();
  for (const path of ['/foo/ministries/', '/ministries/no-such-ministry/']) {
    assert.equal((await get(`${dev.origin}${path}`, { cookie })).status, 404, path);
  }
  const about = fake.story('pages/about').content;
  const original = { uk: about.body_uk, en: about.body_en };
  fake.editStory('pages/about', (c) => { c.body_uk = ''; c.body_en = ''; }, { publish: false });
  try {
    assert.equal((await get(`${dev.origin}/about/`, { cookie })).status, 404);
  } finally {
    fake.editStory('pages/about', (c) => { c.body_uk = original.uk; c.body_en = original.en; }, { publish: false });
  }
});

test('адреса історії з Visual Editor веде на сторінку сайту', async () => {
  const res = await get(editorUrl('/pages/leaders'));
  assert.equal(res.status, 302);
  assert.match(res.headers.get('location'), /^\/leaders\/\?_storyblok=1&/);
});

test('чернетка, яка не пройде публікацію, — 500 з переліком полів', async () => {
  const original = fake.story(SETTINGS).content.name_en;
  fake.editStory(SETTINGS, (c) => { c.name_en = ''; }, { publish: false });
  try {
    const res = await get(editorUrl('/'));
    assert.equal(res.status, 500);
    assert.match(await res.text(), /settings\/site-settings → name\.en/);
  } finally {
    fake.editStory(SETTINGS, (c) => { c.name_en = original; }, { publish: false });
  }
});

test('збірка прев\'ю: воркер Cloudflare і жодної статичної сторінки', { timeout: 300_000 }, () => {
  const outDir = mkdtempSync(join(tmpdir(), 'hob-preview-dist-'));
  try {
    execFileSync(process.execPath, [ASTRO, 'build', '--outDir', outDir], {
      cwd: projectRoot, env: { ...process.env, ...PREVIEW_ENV() }, stdio: 'pipe', timeout: 280_000, killSignal: 'SIGKILL',
    });
    const worker = join(outDir, '_worker.js');
    assert.ok(existsSync(worker), 'немає _worker.js');
    assert.deepEqual(htmlFiles(outDir), []);
    // Workers Free приймає воркер до 3 МБ у стисненому вигляді (рішення 20).
    const walk = (dir) => readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
    const files = statSync(worker).isDirectory() ? walk(worker) : [worker];
    const gzipped = files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);
    assert.ok(gzipped < 3 * 1024 * 1024, `воркер ${Math.round(gzipped / 1024)} КБ у стисненому вигляді — більше ліміту Workers Free`);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 4: Запустити — має впасти**

Run: `node --test tests/preview.test.js`
Expected: FAIL — `/` без токена віддає 200 (режиму прев'ю ще немає).

- [ ] **Step 5: Інтеграція й middleware**

`src/integrations/preview.mjs`:

```js
// Прев'ю-стенд (Спека 3): лише в режимі HOB_PREVIEW. Статична збірка цієї
// інтеграції не має — ні middleware, ні маршрутів у dist/ не зʼявляється.
export default function preview() {
  return {
    name: 'hob-preview',
    hooks: {
      'astro:config:setup': ({ addMiddleware }) => {
        addMiddleware({ entrypoint: './src/preview/middleware.mjs', order: 'pre' });
      },
    },
  };
}
```

`src/preview/middleware.mjs`:

```js
import { defineMiddleware } from 'astro:middleware';
import { validateContent } from '../lib/content-rules.mjs';
import { makeSite } from '../lib/site.mjs';
import { deliveryUrl, fetchStories } from '../lib/storyblok/delivery.mjs';
import { storiesToEntries } from '../lib/storyblok/entries.mjs';
import { editorAccess } from './access.mjs';
import { previewEnv } from './env.mjs';
import { deniedPage, problemsPage } from './pages.mjs';
import { storyRedirect } from './routes.mjs';

const html = (body, status) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

// Кожна відповідь стенду — noindex заголовком (Спека 3, ризики): робот
// бачить його і на 403/500, де <meta robots> може не бути. no-store — щоб
// ні Cloudflare, ні браузер не показали редактору вчорашню чернетку.
// Заголовки відповіді next() можуть бути незмінні — тому копія.
function finish(response, access) {
  const out = new Response(response.body, response);
  out.headers.set('X-Robots-Tag', 'noindex');
  out.headers.set('Cache-Control', 'no-store');
  if (access?.setCookie) out.headers.append('Set-Cookie', access.setCookie);
  return out;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const env = previewEnv(context.locals);
  const access = await editorAccess({
    url: context.url,
    cookieHeader: context.request.headers.get('cookie'),
    spaceId: env.STORYBLOK_SPACE_ID,
    previewToken: env.STORYBLOK_PREVIEW_TOKEN,
    now: Date.now(),
  });
  if (!access.ok) return finish(html(deniedPage(), 403));

  const target = storyRedirect(context.url, import.meta.env.BASE_URL);
  if (target) return finish(new Response(null, { status: 302, headers: { location: target } }), access);

  // Чернетка на кожен запит: ~70 історій — один запит CDN (per_page=100).
  const stories = await fetchStories({ token: env.STORYBLOK_PREVIEW_TOKEN, baseUrl: deliveryUrl(env), version: 'draft' });
  const { entries, errors, editables } = storiesToEntries(stories);
  const problems = [...errors, ...validateContent(entries)];
  if (problems.length > 0) return finish(html(problemsPage(problems), 500), access);

  context.locals.site = makeSite(entries, editables);
  context.locals.preview = true;
  return finish(await next(), access);
});
```

- [ ] **Step 6: `astro.config.mjs`**

Додати імпорти:

```js
import cloudflare from '@astrojs/cloudflare';
import preview from './src/integrations/preview.mjs';
```

Після `BASE_PATH` оголосити `PREVIEW`, а `NOINDEX` переписати:

```js
// Прев'ю-стенд (Спека 3): серверний режим на Cloudflare Pages, кожен запит
// рендериться з чернетки Storyblok. Продакшн лишається статичним.
export const PREVIEW = process.env.HOB_PREVIEW === 'true';

// Прев'ю-стенди закриті від індексації: noindex на кожній сторінці
// (рішення 5 плану Етапу 3). Вмикає рівно 'true' або режим прев'ю — стенд
// Cloudflare закритий, навіть якщо SITE_NOINDEX забули задати.
export const NOINDEX = PREVIEW || process.env.SITE_NOINDEX === 'true';
```

У `defineConfig`:
- `trailingSlash: PREVIEW ? 'ignore' : 'always'`. Коментар: у прев'ю адреси Storyblok приходять без «/», і їх має побачити middleware (`storyRedirect`), а не відсікти маршрутизатор;
- `integrations: PREVIEW ? [preview()] : [seoFiles({ site: SITE_URL, base: BASE_PATH, noindex: NOINDEX })]`. Коментар: sitemap/robots/.htaccess будуються з HTML статичної збірки, у серверного режиму його немає;
- `...(PREVIEW && { output: 'server', adapter: cloudflare({ platformProxy: { enabled: false }, imageService: 'passthrough' }) })`. Коментар: `platformProxy` вимкнено, бо змінні в dev дає `process.env` (`previewEnv`); `passthrough` — бо `astro:assets` сайт не використовує.

- [ ] **Step 7: Тести зелені**

Run: `node --test tests/preview.test.js`
Expected: PASS.

Якщо падає тест `/pages/leaders` → 302 (Astro не викликав middleware для адреси без маршруту, рішення 18): додати в інтеграцію `injectRoute({ pattern: '/404', entrypoint: './src/preview/NotFound.astro', prerender: false })`. Сторінка без стилів, `Astro.response.status = 404`, текст «Сторінки немає». Серверний режим рендерить маршрут `404` для кожної адреси без маршруту, і middleware для нього викликається. Rest-маршрут (`/[...story]`) не годиться: він конфліктує з `[...lang]`. У статичній збірці цього маршруту немає. Спершу тест червоний, потім це виправлення.

Якщо в збірці немає `_worker.js`: адаптер 12 для Pages кладе воркер у `dist/_worker.js/` (тека) — `existsSync` це приймає. Якщо шлях інший, звірити з документацією адаптера й виправити тест за фактичним виходом.

- [ ] **Step 8: Статичний вихід не змінився, повний прогін, коміт**

Run: `npm test`, потім `node scripts/lib/diff-dirs.mjs "$TEMP/hob-before-7" dist`
Expected: 0 FAIL; `Збірки однакові.`

```bash
git add astro.config.mjs package.json package-lock.json src/integrations/preview.mjs src/preview/middleware.mjs tests/preview.test.js
git commit -m "feat: прев'ю-стенд — серверний режим на Cloudflare з чернетки Storyblok

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 8: Visual Editor — `_editable` і Bridge

**Files:**
- Create: `src/components/PreviewBridge.astro`
- Modify: `src/layouts/Base.astro`, 13 маршрутів (розмітка за таблицею нижче), `src/components/SiteFooter.astro`
- Test: `tests/preview.test.js` (+3 тести), `tests/site.test.js` (тест із Задачі 3 уже стереже продакшн)

**Interfaces:**
- Consumes: `store.edit(collection, slug?, field?)` (Задача 5), `locals.preview` (Задача 7).
- Produces: атрибути `data-blok-c` / `data-blok-uid` на блоках прев'ю; скрипт `https://app.storyblok.com/f/storyblok-v2-latest.js` і перезавантаження сторінки на `change` / `published`.

- [ ] **Step 1: Знімок збірки «до»**

Run: `npx astro build --outDir "$TEMP/hob-before-8"`

- [ ] **Step 2: Тести, що падають**

У `tests/preview.test.js`:

1. Додати імпорти: `import { parse } from 'node-html-parser';`, `import { withContentCopy } from './helpers/cms.js';`, `import { ministry, person } from './helpers/probes.js';`.

2. У `before` сіяти фейк з копії контенту з пробами. Детальна сторінка й картка пастора тоді є завжди, незалежно від справжніх даних (контракт: колекції можуть бути порожні). Замість `await seedFake(fake);`:

```js
  await withContentCopy((fixture) => {
    fixture.write('ministries', 'probe-editable', ministry('probe-editable'));
    fixture.write('pastors', 'probe-editable', person('probe-editable', 'pastor'));
  }, (dir) => seedFake(fake, dir));
```

3. Дописати тести:

```js
const uidOf = (story, blok = story.content) => `${story.id}-${blok._uid}`;

test('Visual Editor: секція головної несе _editable свого блоку, Bridge підключено', async () => {
  const root = parse(await (await get(editorUrl('/'))).text());
  const home = fake.story('settings/homepage');
  assert.equal(root.querySelector('section.hero').getAttribute('data-blok-uid'), uidOf(home, home.content.hero[0]));
  assert.equal(root.querySelector('footer.site-footer').getAttribute('data-blok-uid'), uidOf(home, home.content.footer[0]));
  assert.ok(root.querySelector('script[src="https://app.storyblok.com/f/storyblok-v2-latest.js"]'));
});

test('детальна сторінка — корінь запису; сторінка зі списком — page-hero', async () => {
  const cookie = await session();
  const detail = parse(await (await get(`${dev.origin}/ministries/probe-editable/`, { cookie })).text());
  assert.equal(detail.querySelector('.detail-top').getAttribute('data-blok-uid'), uidOf(fake.story('ministries/probe-editable')));
  const list = parse(await (await get(`${dev.origin}/ministries/`, { cookie })).text());
  assert.equal(list.querySelector('.page-hero').getAttribute('data-blok-uid'), uidOf(fake.story('pages/ministries')));
});

test('картка пастора розмічена його історією (власної сторінки немає)', async () => {
  const root = parse(await (await get(`${dev.origin}/pastors/`, { cookie: await session() })).text());
  const uid = uidOf(fake.story('pastors/probe-editable'));
  assert.ok(root.querySelectorAll('[data-blok-uid]').some((el) => el.getAttribute('data-blok-uid') === uid));
});
```

`person(slug, group, extra)` — з `tests/helpers/probes.js`. Якщо проба пастора потребує `photo` з файлом, вона вже зовнішня (`https://example.test/…`), тож `seedFake` не падає на відсутньому файлі.

- [ ] **Step 3: Запустити — має впасти**

Run: `node --test tests/preview.test.js`
Expected: FAIL — `data-blok-uid` дорівнює `null`, скрипту Bridge немає.

- [ ] **Step 4: `PreviewBridge.astro` і `Base.astro`**

`src/components/PreviewBridge.astro`:

```astro
---
// Лише прев'ю-стенд (Спека 3): Bridge звʼязує клік по сторінці з формою
// блоку у Visual Editor. У статичній збірці компонент не виводить нічого —
// живим відвідувачам скрипт Storyblok не вантажиться.
const on = Astro.locals.preview === true;
---
{on && <script is:inline src="https://app.storyblok.com/f/storyblok-v2-latest.js"></script>}
{on && (
  <script is:inline>
    // Рішення 10: збережена правка → сторінка заново рендериться з чернетки.
    if (window.StoryblokBridge) {
      new window.StoryblokBridge().on(['change', 'published'], () => window.location.reload());
    }
  </script>
)}
```

`src/layouts/Base.astro`: `import PreviewBridge from '../components/PreviewBridge.astro';` і `<PreviewBridge />` одразу після `<slot />` у `<body>`.

- [ ] **Step 5: Розмітка `_editable`**

У кожному місці з таблиці до першого тега додається `{...store.edit(…)}`. Змінна `store` уже є у фронтматері (Задача 5). У `SiteFooter.astro` вона теж є.

| Файл | Елемент | Виклик |
|---|---|---|
| `about`, `contacts`, `donate`, `leaders`, `pastors`, `testimonies`, `churches/index`, `ministries/index`, `projects/index` | `<section class="page-hero">` | `store.edit('pages', '<id сторінки>')` (id = імʼя маршруту: `about`, …, `churches`, `ministries`, `projects`) |
| `ministries/[slug]` | `<section class="detail-top">` | `store.edit('ministries', m.slug)` |
| `churches/[slug]` | `<section class="detail-top">` | `store.edit('churches', c.slug)` |
| `projects/[slug]` | `<section class="detail-top">` | `store.edit('projects', p.slug)` |
| `testimonies` | корінь картки, яку повертає `testimonies.map(…)` (обидві гілки — текстова й відео) | `store.edit('testimonies', x.slug)` |
| `pastors` | корінь картки в `pastors.map(…)` і в `elders.map(…)` | `store.edit('pastors', p.slug)` |
| `leaders` | корінь картки в `documents.map(…)` і в `links.map(…)` | `store.edit('leader-resources', d.slug)` / `store.edit('leader-resources', r.slug)` |
| `index` | `<section class="hero" …>` | `store.edit('homepage', null, 'hero')` |
| `index` | `section.about`, `section.news`, `section.believe-strip`, `section.testimonies`, `section.ministries`, `section.pastors`, `section.contacts`, `section.donate` | `store.edit('homepage', null, '<поле>')`: `about`, `news`, `wwb`, `testimonies`, `ministries`, `pastors`, `contacts`, `donate` |
| `SiteFooter.astro` | `<footer class="site-footer" …>` | `store.edit('homepage', null, 'footer')` |

Приклад: `<section class="detail-top" {...store.edit('ministries', m.slug)}>`.

- [ ] **Step 6: Тести зелені, продакшн без змін**

Run: `npm test`, потім `node scripts/lib/diff-dirs.mjs "$TEMP/hob-before-8" dist`
Expected: 0 FAIL (разом з тестом `site.test.js`, що в продакшн-HTML немає `data-blok-*` і `storyblok.com`); `Збірки однакові.`

- [ ] **Step 7: Коміт**

```bash
git add src/components/PreviewBridge.astro src/layouts/Base.astro src/pages src/components/SiteFooter.astro tests/preview.test.js
git commit -m "feat: Visual Editor — блоки сторінок звʼязані з історіями, Bridge на прев'ю

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 9: вебхук публікації → деплой

**Files:**
- Create: `src/preview/hook.mjs`, `src/preview/publish-hook.mjs`
- Modify: `src/integrations/preview.mjs` (`injectRoute`), `src/preview/middleware.mjs` (пропуск маршруту вебхука)
- Test: `tests/preview-hook.test.js`, `tests/preview.test.js` (+1 тест)

**Interfaces:**
- Consumes: `hmacHex`, `safeEqual` (Задача 6), `previewEnv` (Задача 6); `workflow_dispatch` у `deploy.yml` (Задача 4).
- Produces:
  - `handlePublishHook({ body: string, signature: string | null, env, fetch? }) → Promise<Response>`: 202 (запущено / проігноровано), 400, 401, 500 (не налаштовано), 502 (GitHub відмовив).
  - `PUBLISH_HOOK_PATH = 'api/storyblok-publish'` (від `base`).
  - Змінні стенду: `STORYBLOK_WEBHOOK_SECRET`, `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPOSITORY` (`owner/repo`), необовʼязкові `GITHUB_WORKFLOW` (типово `deploy.yml`) і `GITHUB_REF` (типово `main`).

- [ ] **Step 1: Тест, що падає**

`tests/preview-hook.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handlePublishHook } from '../src/preview/hook.mjs';

const env = { STORYBLOK_WEBHOOK_SECRET: 'whsec', GITHUB_DISPATCH_TOKEN: 'ghp_secret', GITHUB_REPOSITORY: 'owner/repo' };
const sign = (body, secret = 'whsec') => createHmac('sha1', secret).update(body).digest('hex');
const event = (action) => JSON.stringify({ text: 'x', action, space_id: 1, story_id: 2, full_slug: 'ministries/youth' });
function github(status = 204) {
  const calls = [];
  return { calls, fetch: async (url, init) => { calls.push({ url, init }); return new Response(status === 204 ? null : 'Bad credentials', { status }); } };
}

test('публікація з чинним підписом запускає деплой main', async () => {
  const gh = github();
  const body = event('published');
  const res = await handlePublishHook({ body, signature: sign(body), env, fetch: gh.fetch });
  assert.equal(res.status, 202);
  assert.equal(gh.calls.length, 1);
  assert.equal(gh.calls[0].url, 'https://api.github.com/repos/owner/repo/actions/workflows/deploy.yml/dispatches');
  assert.equal(gh.calls[0].init.method, 'POST');
  assert.equal(gh.calls[0].init.headers.Authorization, 'Bearer ghp_secret');
  assert.deepEqual(JSON.parse(gh.calls[0].init.body), { ref: 'main' });
});

test('зняття з публікації, видалення, переміщення — теж перезбірка', async () => {
  for (const action of ['unpublished', 'deleted', 'moved']) {
    const gh = github();
    const body = event(action);
    assert.equal((await handlePublishHook({ body, signature: sign(body), env, fetch: gh.fetch })).status, 202, action);
    assert.equal(gh.calls.length, 1, action);
  }
});

test('без підпису, з чужим секретом чи під інше тіло — 401 і жодного запиту до GitHub', async () => {
  const body = event('published');
  for (const signature of [null, '', sign(body, 'other'), sign(event('deleted'))]) {
    const gh = github();
    assert.equal((await handlePublishHook({ body, signature, env, fetch: gh.fetch })).status, 401, String(signature));
    assert.equal(gh.calls.length, 0);
  }
});

test('інші події — 202 без перезбірки', async () => {
  const gh = github();
  const body = event('entry_saved');
  assert.equal((await handlePublishHook({ body, signature: sign(body), env, fetch: gh.fetch })).status, 202);
  assert.equal(gh.calls.length, 0);
});

test('GitHub відмовив — 502, токена в тексті немає', async () => {
  const body = event('published');
  const res = await handlePublishHook({ body, signature: sign(body), env, fetch: github(401).fetch });
  assert.equal(res.status, 502);
  assert.ok(!(await res.text()).includes('ghp_secret'));
});

test('стенд не налаштовано — 500 з назвами змінних, без значень', async () => {
  const res = await handlePublishHook({ body: '{}', signature: 'x', env: { GITHUB_DISPATCH_TOKEN: 'ghp_secret' }, fetch: github().fetch });
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.match(text, /STORYBLOK_WEBHOOK_SECRET/);
  assert.match(text, /GITHUB_REPOSITORY/);
  assert.ok(!text.includes('ghp_secret'));
});
```

У `tests/preview.test.js`:
- у `PREVIEW_ENV` додати `STORYBLOK_WEBHOOK_SECRET: 'whsec', GITHUB_DISPATCH_TOKEN: 'ghp_test', GITHUB_REPOSITORY: 'owner/repo'`;
- дописати тест:

```js
test('вебхук не потребує доступу редактора, але без підпису — 401', async () => {
  const res = await fetch(`${dev.origin}/api/storyblok-publish`, { method: 'POST', body: '{"action":"published"}', redirect: 'manual' });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `node --test tests/preview-hook.test.js tests/preview.test.js`
Expected: FAIL — немає `src/preview/hook.mjs`; POST вебхука отримує 403 від middleware.

- [ ] **Step 3: `src/preview/hook.mjs`**

```js
import { hmacHex, safeEqual } from './access.mjs';

// Storyblok → GitHub Actions (рішення 14). Тіло вебхука Storyblok задати
// не можна, а GitHub чекає свій формат і токен — стенд перекладає одне в
// інше. Підпис — HMAC-SHA1 сирого тіла секретом вебхука (заголовок
// webhook-signature): без нього будь-хто міг би ганяти збірки.
export const PUBLISH_HOOK_PATH = 'api/storyblok-publish';
const REBUILD = new Set(['published', 'unpublished', 'deleted', 'moved']);
const REQUIRED = ['STORYBLOK_WEBHOOK_SECRET', 'GITHUB_DISPATCH_TOKEN', 'GITHUB_REPOSITORY'];

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function handlePublishHook({ body, signature, env, fetch = globalThis.fetch }) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) return json(500, { error: `на стенді не задано ${missing.join(', ')}` });
  if (!safeEqual(signature ?? '', await hmacHex('SHA-1', env.STORYBLOK_WEBHOOK_SECRET, body))) {
    return json(401, { error: 'invalid signature' });
  }
  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return json(400, { error: 'invalid json' });
  }
  if (!REBUILD.has(event.action)) return json(202, { ignored: event.action ?? null });
  const workflow = env.GITHUB_WORKFLOW || 'deploy.yml';
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dim-hliba-preview',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: env.GITHUB_REF || 'main' }),
  });
  if (!res.ok) return json(502, { error: `GitHub ${res.status}: ${(await res.text()).slice(0, 200)}` });
  return json(202, { dispatched: event.action, story: event.full_slug ?? null });
}
```

- [ ] **Step 4: Ендпоінт, маршрут, пропуск у middleware**

`src/preview/publish-hook.mjs`:

```js
import { previewEnv } from './env.mjs';
import { handlePublishHook } from './hook.mjs';

export const prerender = false;

// Сире тіло — саме його підписує Storyblok.
export const POST = async ({ request, locals }) => handlePublishHook({
  body: await request.text(),
  signature: request.headers.get('webhook-signature'),
  env: previewEnv(locals),
});
```

`src/integrations/preview.mjs`: хук приймає `({ addMiddleware, injectRoute })` і після `addMiddleware` додає:

```js
        // Вебхук публікації (Задача 9): лише на стенді, у статичній збірці маршруту немає.
        injectRoute({ pattern: '/api/storyblok-publish', entrypoint: './src/preview/publish-hook.mjs', prerender: false });
```

`src/preview/middleware.mjs`: імпорт `import { PUBLISH_HOOK_PATH } from './hook.mjs';` і першими рядками в `onRequest`:

```js
  // Вебхук Storyblok приходить без сесії редактора — його стереже підпис (hook.mjs).
  if (context.url.pathname === `${import.meta.env.BASE_URL}${PUBLISH_HOOK_PATH}`) return finish(await next());
```

- [ ] **Step 5: Тести зелені, коміт**

Run: `npm test` → Expected: 0 FAIL.

```bash
git add src/preview/hook.mjs src/preview/publish-hook.mjs src/preview/middleware.mjs src/integrations/preview.mjs tests/preview-hook.test.js tests/preview.test.js
git commit -m "feat: вебхук публікації Storyblok запускає деплой

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 10: статична копія сайту на Cloudflare Pages

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Test: `tests/deploy.test.js` (+2 тести)

**Interfaces:**
- Consumes: крок `cms:pull` і `npm test` у завданні `build` (Задача 4); `workflow_dispatch`, який запускає вебхук (Задача 9).
- Produces:
  - крок `Build Cloudflare Pages copy` → `dist-cloudflare/`;
  - артефакт `dist-cloudflare`;
  - завдання `deploy-cloudflare`.
  - Налаштування репозиторію (задаються в Задачі 11): змінні `CLOUDFLARE_PROJECT`, `CLOUDFLARE_SITE_URL`; секрети `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

- [ ] **Step 1: Тести, що падають**

У `tests/deploy.test.js` читання файлу нормалізувати до LF: у робочому дереві Windows він з CRLF (`core.autocrlf`), а регулярки нижче шукають межі кроків за `\n`:

```js
const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/deploy.yml', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
```

Дописати:

```js
// Відрізок workflow від кроку / завдання до наступного — щоб перевіряти env
// саме цього кроку, а не будь-якого у файлі.
function section(start, end) {
  const i = workflow.indexOf(start);
  assert.ok(i >= 0, `немає «${start.trim()}»`);
  const rest = workflow.slice(i + start.length);
  const j = rest.search(end);
  return j < 0 ? rest : rest.slice(0, j);
}
const step = (name) => section(`- name: ${name}`, /\n {6}- /);
const job = (name) => section(`\n  ${name}:\n`, /\n {2}[a-z][a-z-]*:\n/);

// Рішення 19: копія — той самий контент і код, що пройшли npm test, інша
// лише адреса. Дубль основного сайту закритий від індексації.
test('копія на Cloudflare збирається після npm test: корінь, своя адреса, noindex', () => {
  assert.ok(workflow.indexOf('- name: Build Cloudflare Pages copy') > workflow.indexOf('run: npm test'), 'копія — лише після npm test');
  const build = step('Build Cloudflare Pages copy');
  assert.match(build, /if: vars\.CLOUDFLARE_PROJECT != ''/);
  assert.match(build, /BASE_PATH: \/\n/);
  assert.match(build, /SITE_NOINDEX: 'true'/);
  assert.match(build, /SITE_URL: \$\{\{ vars\.CLOUDFLARE_SITE_URL \}\}/);
  assert.match(build, /run: npx astro build --outDir dist-cloudflare/);
});

test('деплой копії — окреме завдання: збій Cloudflare не блокує GitHub Pages', () => {
  const copy = job('deploy-cloudflare');
  assert.match(copy, /needs: build/);
  assert.match(copy, /if: vars\.CLOUDFLARE_PROJECT != ''/);
  assert.match(copy, /apiToken: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(copy, /pages deploy dist-cloudflare --project-name=\$\{\{ vars\.CLOUDFLARE_PROJECT \}\} --branch=main/);
  assert.doesNotMatch(job('deploy'), /deploy-cloudflare/);
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `node --test tests/deploy.test.js`
Expected: FAIL — «немає «- name: Build Cloudflare Pages copy»».

- [ ] **Step 3: `deploy.yml`**

У завданні `build`, після `- uses: actions/upload-pages-artifact@v3` (з його `with`), додати:

```yaml
      # Статична копія на Cloudflare Pages (рішення 19): той самий стягнутий
      # контент і код, що щойно пройшли npm test, — інша лише адреса (корінь,
      # а не підшлях GitHub Pages). Копія дублює основний сайт, тому noindex.
      # Вимикач — змінна репозиторію CLOUDFLARE_PROJECT: без неї кроки
      # пропускаються.
      - name: Build Cloudflare Pages copy
        if: vars.CLOUDFLARE_PROJECT != ''
        env:
          SITE_URL: ${{ vars.CLOUDFLARE_SITE_URL }}
          BASE_PATH: /
          SITE_NOINDEX: 'true'
        run: npx astro build --outDir dist-cloudflare

      - name: Upload Cloudflare Pages copy
        if: vars.CLOUDFLARE_PROJECT != ''
        uses: actions/upload-artifact@v4
        with:
          name: dist-cloudflare
          path: dist-cloudflare
          retention-days: 1
```

У кінець файлу, після завдання `deploy`, додати:

```yaml
  # Окреме завдання: збій Cloudflare (токен, ліміт 25 МБ на файл) не
  # зупиняє деплой на GitHub Pages. Direct Upload: Cloudflare нічого не
  # збирає сам (ліміт збірок Pages стосується саме його збірок — звірити в
  # Задачі 11).
  deploy-cloudflare:
    needs: build
    if: vars.CLOUDFLARE_PROJECT != ''
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist-cloudflare
          path: dist-cloudflare

      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist-cloudflare --project-name=${{ vars.CLOUDFLARE_PROJECT }} --branch=main
```

Якщо `SITE_URL` порожній (змінна `CLOUDFLARE_SITE_URL` не задана), `astro build` падає на невалідній адресі сайту. Це правильно: копія без адреси мала б биті canonical і og:image.

- [ ] **Step 4: Тести зелені, коміт**

Run: `npm test` → Expected: 0 FAIL.

```bash
git add .github/workflows/deploy.yml tests/deploy.test.js
git commit -m "ci: статична копія сайту на Cloudflare Pages тим самим деплоєм

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 11: живі сервіси — токени, CI, Cloudflare, Visual Editor, вебхук

Ця задача змінює **зовнішні** сервіси: Storyblok, GitHub і Cloudflare. Кожна дія в них робиться разом із користувачем або після його явної згоди. Токени й секрети вводить користувач; вони не потрапляють у чат, логи чи коміти.

**Files:**
- Modify (лише якщо живий сервіс поводиться інакше, ніж задокументовано): `tests/helpers/fake-storyblok.js`, відповідний тест, `src/lib/storyblok/*.mjs`, `src/preview/*.mjs`, `scripts/cms/*.mjs`.

**Interfaces:**
- Consumes: усе з Задач 1–9.

Процедура для кожної розбіжності з документованою поведінкою (як у Етапі 4): записати запит і відповідь → змінити фейк і переконатися, що відповідний тест червоний → виправити код → `npm test` → повторити крок.

- [ ] **Step 1: Токени доступу Storyblok**

Разом з користувачем: Storyblok → простір «Dim Hliba» → Settings → Access Tokens. Створити два токени:
- рівень **Public**, назва «build»;
- рівень **Preview**, назва «preview-stand».

Користувач записує їх у свій `.env` як `STORYBLOK_PUBLIC_TOKEN` і `STORYBLOK_PREVIEW_TOKEN`.

- [ ] **Step 2: Живий `cms:pull` і рівність збірок — критерій приймання**

```bash
npm run cms:pull -- --out "$TEMP/hob-live-content" --public "$TEMP/hob-live-public"
npx astro build
HOB_CONTENT_DIR="$TEMP/hob-live-content" npx astro build --outDir "$TEMP/hob-live-dist"
node scripts/lib/diff-dirs.mjs dist "$TEMP/hob-live-dist"
```

(Git Bash: з `MSYS_NO_PATHCONV=1`; PowerShell: `$env:HOB_CONTENT_DIR=…`.)
Expected: `Записано історій: N. Картинки медіатеки: 4 збіглися з public/, 0 завантажено…` і `Збірки однакові.` Відмінність означає, що живий CDN API віддає дані інакше, ніж фейк (число числом, `null` замість `''`, інша форма asset). Діяти за процедурою вище.

Якщо простір уже редагували після Етапу 4, збірки мають право відрізнятися саме цими правками. Тоді спершу `npm run cms:verify`: розбіжності перелічать ці правки. Порівняння вважається прийнятим, якщо `diff-dirs` не показує нічого поза сторінками, яких вони стосуються.

- [ ] **Step 3: Секрет GitHub**

Користувач виконує `gh secret set STORYBLOK_PUBLIC_TOKEN` (значення вводить сам) або задає секрет у Settings → Secrets and variables → Actions. Перевірка: `gh secret list` показує `STORYBLOK_PUBLIC_TOKEN`.

- [ ] **Step 4: Злиття гілки й деплой зі Storyblok**

Лише після явної згоди користувача: злити `stage-5-storyblok` у `main` (як Етап 4 — merge-коміт) і запушити.
Run: `gh run watch` (останній запуск `Build and deploy`)
Expected: крок `Pull published content from Storyblok` зелений, `npm test` зелений, деплой завершено. Зафіксувати тривалість запуску (рішення 15).

- [ ] **Step 5: Проєкт Cloudflare Pages**

Разом з користувачем: Cloudflare → Workers & Pages → Create → Pages → Connect to Git → цей репозиторій, гілка `main`. Налаштування:
- Build command: `npm run build`. Output: `dist`.
- Змінні збірки й середовища: `NODE_VERSION=22`, `HOB_PREVIEW=true`, `BASE_PATH=/`, `SITE_URL=https://<проєкт>.pages.dev`, `STORYBLOK_SPACE_ID=<id>`, `STORYBLOK_REGION=eu`.
- Секрети: `STORYBLOK_PREVIEW_TOKEN`.
- Settings → Runtime → Compatibility flags: `nodejs_compat`.

Перевірка:

```bash
curl -sI https://<проєкт>.pages.dev/
```

Expected: `HTTP/2 403`, `x-robots-tag: noindex`, адреса на https. Якщо 500 через `node:crypto`, прапорець `nodejs_compat` не застосувався — перезапустити деплой після його встановлення.

- [ ] **Step 6: Visual Editor**

Storyblok → Settings → Visual Editor:
- Location (default environment): `https://<проєкт>.pages.dev/`;
- другий Preview URL «English»: `https://<проєкт>.pages.dev/en/`.

Разом з користувачем перевірити:
- історія служіння відкривається у Visual Editor і показує свою сторінку;
- клік по заголовку детальної сторінки відкриває форму служіння;
- у `settings/homepage` клік по героєві відкриває блок «hero»;
- змінити «Назва (укр.)» → Save → за 1–2 с сторінка показує новий текст (рішення 10);
- перемикач «English» показує англійську сторінку;
- `pages/about` відкривається на `/about/` (або дає 404, якщо сторінку вимкнено, — так і має бути).

Правку не публікувати: повернути значення, Save.

- [ ] **Step 7: Вебхук**

1. Користувач створює fine-grained PAT у GitHub: лише цей репозиторій, дозвіл **Actions: Read and write**, строк — рік (дату записати в чекліст, крок Задачі 12).
2. Cloudflare → секрети: `GITHUB_DISPATCH_TOKEN`, `STORYBLOK_WEBHOOK_SECRET` (довільний рядок ≥ 32 символи); змінна `GITHUB_REPOSITORY=<owner>/--House-of-Bread-Church-Website`. Передеплоїти стенд.
3. Storyblok → Settings → Webhooks → New:
   - URL: `https://<проєкт>.pages.dev/api/storyblok-publish`;
   - тригери: Story published, unpublished, deleted, moved;
   - Secret: той самий `STORYBLOK_WEBHOOK_SECRET`.
4. Кнопкою «Test» (якщо є) або публікацією дрібної правки перевірити: `gh run list --workflow deploy.yml --limit 1` показує запуск з подією `workflow_dispatch`.

Якщо стенд відповідає 401, заголовок чи алгоритм підпису в живого Storyblok інший, ніж задокументовано (рішення 18). Записати фактичний заголовок з логів (Cloudflare → Functions → Real-time logs) і діяти за процедурою.

- [ ] **Step 8: Наскрізна публікація — критерій приймання**

Разом з користувачем:
1. Змінити текст в одній історії й опублікувати. Засікти час.
2. Дочекатися завершення `Build and deploy` і перевірити зміну на сайті GitHub Pages.
3. Записати фактичний час «Опублікувати → видно на сайті».
4. Повернути текст і опублікувати ще раз.

Expected: зміна на сайті. Час порівняти з рішенням 15 і повідомити користувачу. Якщо він неприйнятний, це окреме рішення про швидкий гейт, не в цій задачі.

- [ ] **Step 9: Невалідний контент не доходить до сайту — критерій приймання**

У пробній історії очистити «Назва (англ.)» і зберегти.
Expected на прев'ю: сторінка «Чернетка не пройде публікацію» з рядком `… → name.en`.

Опублікувати.
Expected: запуск `Build and deploy` падає на кроці `Pull published content from Storyblok` з тим самим рядком, а сайт лишається попередньою версією.

Повернути назву й опублікувати: наступний запуск зелений.

- [ ] **Step 10: Простір чистий після перевірок**

Run: `npm run cms:verify`
Expected: `Розбіжностей немає…` (усі пробні правки повернуто). Якщо редактор уже вносив справжні правки, розбіжності мають збігатися з ними, а не з пробами.

- [ ] **Step 11: Статична копія на Cloudflare Pages (Задача 10)**

Разом з користувачем:
1. Cloudflare → Workers & Pages → Create → Pages → **Upload assets** (Direct Upload, не Git). Назва проєкту — наприклад `dim-hliba`; перший завантажений архів може бути порожньою текою. Адреса копії: `https://dim-hliba.pages.dev`.
2. Cloudflare → My Profile → API Tokens → Create Token → шаблон «Edit Cloudflare Workers» звузити до дозволу **Account → Cloudflare Pages → Edit** для свого акаунта. Id акаунта — праворуч на сторінці Workers & Pages.
3. GitHub (користувач сам вводить значення):
   - `gh secret set CLOUDFLARE_API_TOKEN`;
   - `gh secret set CLOUDFLARE_ACCOUNT_ID`;
   - `gh variable set CLOUDFLARE_PROJECT --body dim-hliba`;
   - `gh variable set CLOUDFLARE_SITE_URL --body https://dim-hliba.pages.dev`.
4. `gh workflow run deploy.yml` → `gh run watch`.

Expected: завдання `deploy` (GitHub Pages) і `deploy-cloudflare` зелені. Перевірка:

```bash
curl -s https://dim-hliba.pages.dev/ | grep -o '<link rel="canonical"[^>]*>\|<meta name="robots"[^>]*>'
```

Має бути canonical на `https://dim-hliba.pages.dev/` і `noindex`. Після наступної публікації в Storyblok (крок 8 можна повторити) зміна зʼявляється і на копії. У Cloudflare → проєкт → Deployments видно, що це Direct Upload. Лічильник збірок Pages при цьому не росте — якщо росте, записати це в рішення 20.

- [ ] **Step 12: Ліміти воркера прев'ю (рішення 20)**

Cloudflare → проєкт прев'ю → Functions / Metrics. Відкрити у Visual Editor 5–10 різних сторінок (головна, список, детальна) і подивитися CPU time на запит.
Expected: медіана й максимум нижче 10 мс. Якщо ні — зупинитися й вирішити з користувачем: Workers Paid ($5/міс) або прев'ю читає лише історії поточної сторінки (окреме завдання зі своїм тестом). Записати фактичні цифри в рішення 20.

- [ ] **Step 13: Commit (лише якщо були виправлення)**

```bash
git add -A tests/ src/lib/storyblok/ src/preview/ scripts/cms/
git commit -m "fix: Етап 5 під фактичну поведінку живих сервісів

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 12: документація

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-09-22-03-storyblok-cms-design.md`, `docs/superpowers/notes/2026-09-23-seo-launch-checklist.md`

- [ ] **Step 1: `CLAUDE.md`**

- **Commands:**
  - `npm run cms:pull` — published Storyblok content → `src/content` + library images → `public/uploads/cms/` (gitignored); `-- --out <dir> --public <dir>` for other targets; needs `STORYBLOK_PUBLIC_TOKEN`.
  - `node scripts/lib/diff-dirs.mjs <a> <b>` — byte comparison of two builds.
  - Preview build: `HOB_PREVIEW=true` (server output, Cloudflare adapter).
- **Content:** після першого речення абзацу додати: «Since Stage 5 the source of truth is Storyblok: every `main` build runs `cms:pull` first, so `src/content` is a seed snapshot for offline dev and tests (refresh with `npm run cms:pull` + commit when wanted).»
- **Pages and routing:** «Templates read data only via `siteData(Astro.locals)` (`src/lib/site-data.ts`) — `list` / `one` / `page` / `edit`; only `site-data.ts` and `content.config.ts` import `astro:content` (enforced by a test). Routes look records up by `Astro.params` and return `notFound()` for unknown ones, because in preview server mode `getStaticPaths` isn't called.»
- **CMS:** новий підрозділ «Preview & publishing (Stage 5)»:
  - Cloudflare Pages Git integration, build `npm run build` with `HOB_PREVIEW=true`, vars/secrets and `nodejs_compat` set in the dashboard (no `wrangler.toml`);
  - middleware `src/preview/` gates access (`_storyblok_tk` / `hob_editor` cookie), reads the draft per request, shows a problems page for invalid drafts, adds `X-Robots-Tag: noindex`;
  - Visual Editor attributes via `store.edit()` (only on preview; static HTML has none — test);
  - webhook `POST /api/storyblok-publish` (HMAC-SHA1 signature) → `workflow_dispatch` of `deploy.yml`;
  - token roles: Management — local `.env` only; Public — GitHub secret; Preview, webhook secret, GitHub PAT — Cloudflare only.
- **Deploy:** «`cms:pull` (secret `STORYBLOK_PUBLIC_TOKEN`) → `npm test` … Storyblok publish webhook triggers the same workflow.» Додати: «Static copy on Cloudflare Pages: same run, after `npm test` the build job rebuilds into `dist-cloudflare` (`BASE_PATH=/`, `SITE_URL=vars.CLOUDFLARE_SITE_URL`, `SITE_NOINDEX=true`); job `deploy-cloudflare` uploads it with `wrangler pages deploy` (Direct Upload). Enabled by repo variable `CLOUDFLARE_PROJECT`; secrets `CLOUDFLARE_API_TOKEN` (Pages: Edit only), `CLOUDFLARE_ACCOUNT_ID`. To make it production: domain in `CLOUDFLARE_SITE_URL`, drop `SITE_NOINDEX`, then the SEO launch checklist.»
- **Next:** «Stage 6 (Spec 3): handover to the editor, Ukrainian guide.» Лишити речення про production deploy і чекліст.

- [ ] **Step 2: Спека 3**

У «Критерії готовності» позначити `[x]` лише ті пункти, які Задача 11 справді підтвердила, з приміткою `(Етап 5, <дата>: план [2026-09-25-storyblok-stage-5.md](../plans/2026-09-25-storyblok-stage-5.md))`:
- 3 — Astro збирає зі Storyblok, сторінки не відрізняються (крок 2);
- 4 — зображення на білді (крок 2);
- 5 — Visual Editor (крок 6);
- 6 — прев'ю на HTTPS і `noindex` (крок 5);
- 7 — вебхук (крок 8), з фактичним часом;
- 8 — невалідний контент (крок 9).

Якщо час публікації перевищує 1–2 хв, біля пункту 7 записати фактичне значення й рішення 15.

У розділі «Прев'ю-стенд і Visual Editor» додати абзац «Уточнено на Етапі 5»: реакція на збереження, а не на кожну клавішу (рішення 10); доступ за `_storyblok_tk` і cookie (рішення 9).

- [ ] **Step 3: Чекліст запуску**

У розділ «Storyblok» `2026-09-23-seo-launch-checklist.md` додати:

```markdown
- [ ] Продакшн-деплой на домен (Етап 0, Задача 5): у workflow з rsync крок `npm run cms:pull`
      стоїть перед `npm test`, секрет `STORYBLOK_PUBLIC_TOKEN` заданий — інакше пуш коду
      відкотить сайт до `src/content` (Етап 5, рішення 2).
- [ ] GitHub PAT вебхука (секрет Cloudflare `GITHUB_DISPATCH_TOKEN`) спливає <дата з Задачі 11>:
      за тиждень до того — новий токен, інакше публікації перестануть оновлювати сайт.
- [ ] Прев'ю-стенд `https://<проєкт>.pages.dev/` відповідає 403 без Visual Editor і має
      `X-Robots-Tag: noindex`.
- [ ] Статична копія на Cloudflare Pages (`vars.CLOUDFLARE_SITE_URL`) має `noindex`, поки вона
      не продакшн. Щоб зробити її основним сайтом: домен у `CLOUDFLARE_SITE_URL`, прибрати
      `SITE_NOINDEX` у кроці `Build Cloudflare Pages copy`, пройти цей чекліст для домену.
```

- [ ] **Step 4: Коміт**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-22-03-storyblok-cms-design.md docs/superpowers/notes/2026-09-23-seo-launch-checklist.md
git commit -m "docs: Етап 5 — збірка зі Storyblok, прев'ю, вебхук у CLAUDE.md і спеці

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
