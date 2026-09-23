# Етап 2: перенесення 10 сторінок на Astro — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Усі 10 легасі-сторінок (`index.html` + 9 `*.dc.html`) перебудовуються з Content Collections на Astro за реальними адресами обох локалей, виглядають піксель-у-піксель як легасі на десктопі й мобільному, а `support.js`, `*-data.js` і легасі-HTML видаляються з репозиторію.

**Architecture:** Один файл маршруту під `src/pages/[...lang]/` дає обидві локалі (`lang: undefined` → корінь, `'en'` → `/en/`), деталки — через `getStaticPaths()` замість `?id=`. CSS кожної легасі-сторінки переноситься **дослівно** у глобальний `src/styles/pages/<сторінка>.css` (скриптом, не руками), спільні лише шрифти, токени і справді спільний ресет; жодних scoped-стилів, бо вони змінюють специфічність і ламають каскад, від якого залежить 1:1. Поведінка з `componentDidMount` переїжджає у `<script>` компонентів мінус пошук даних і мінус перемикач мов. Вірність вигляду доводить не око, а **піксельне порівняння** з легасі (Playwright + pixelmatch) — інструмент живе рівно до кутовера й видаляється разом із легасі.

**Tech Stack:** Astro 5 (`[...lang]` rest-параметр, `getCollection`/`getEntry`), `node:test`, `node-html-parser` (dev, тести виводу), Playwright + `pixelmatch` + `pngjs` (dev, візуальне порівняння і e2e).

**Spec:** [2026-09-22-01-astro-migration-design.md](../specs/2026-09-22-01-astro-migration-design.md) — розділи «Цільова структура», «CSS», «Інтерактив: інвентар і доля», «Рецепт перенесення однієї сторінки», «Перевірка», «Критерії готовності». Вхідні дані URL — [2026-09-22-02-seo-design.md](../specs/2026-09-22-02-seo-design.md), розділи «Структура URL», «Перемикач мов», «Три нові сторінки».
Попередні етапи: [Етап 0](2026-09-22-astro-stage-0.md), [Етап 1](2026-09-23-astro-stage-1.md). Список дірок контенту: [2026-09-23-content-gaps.md](../notes/2026-09-23-content-gaps.md) (рядки 11 і 17 — завдання цього етапу).

## Global Constraints

- **Node ≥ 22**, Astro `^5.18.2`. Нових **runtime**-залежностей немає. Нові dev-залежності — рівно `playwright`, `pixelmatch`, `pngjs`; `node-html-parser` лишається (тепер для тестів виводу).
- **Дизайн переноситься 1:1** (Спека 1). Критерій — `npm run visual` без жодного FAIL на обох локалях і обох вʼюпортах. Маска в інструменті порівняння допускається **лише** для відмінності з таблиці «Зафіксовані рішення» і з коментарем-причиною.
- **Жодного `<style>` у `.astro`.** Стилі сторінки — `import '…/styles/pages/<name>.css'` у фронтматері, стилі компонента (лише галерея) — `import` у компоненті. Scoped-стилі додають `[data-astro-cid-…]` до селекторів, специфічність росте, і медіа-правила сторінки (`.lang-toggle{display:none}`) програють — тест у Задачі 4 це забороняє.
- **Жодного тексту інтерфейсу літералом у `.astro`**, крім бренд-констант легасі: `House of Bread Church` (aria-label логотипу), `House of Bread` (шторка), `UA`/`EN`, `UAH`, `Мова / Language`, `Facebook`, `YouTube`, `Instagram`, `Telegram`, `“`. Решта — з колекцій або `t(lang, key)`.
- **Усі внутрішні адреси** — через `localePath(base, lang, path)` / `assetUrl(base, src)` з `src/lib/paths.mjs`, де `base = import.meta.env.BASE_URL`. Рядок `"/…"` у `href` руками — баг під підшляхом GitHub Pages, якого локально не видно.
- **URL:** з кінцевим слешем; слаги англійські, спільні для обох локалей; uk у корені, en під `/en/` (Спека 2).
- **Перемикач мов — звичайні `<a href>`**; `localStorage`, `hob-lang` і будь-яке автоперенаправлення за мовою заборонені (Спека 2, блокер індексації en).
- **Легасі-файли (`index.html`, `*.dc.html`, `*-data.js`, `support.js`, корінні `fonts/` і `uploads/`) не змінюються до Задачі 15** — з ними порівнюється вигляд.
- Коментарі й назви тестів — **українською**; коментар пояснює *чому*, а не *що*.
- Windows/Git Bash: команда зі змінною `BASE_PATH` потребує `MSYS_NO_PATHCONV=1` або PowerShell.
- Кожна задача закінчується `npm test` (= `astro build` + `node --test --test-concurrency=1 tests/*.test.js`) і окремим комітом. Задачі зі сторінками додатково — `npm run visual -- --only <name>` без FAIL.
- Кінцівка кожного коміту:

  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  ```

## Зафіксовані рішення цього плану

Місця, де спека допускає кілька прочитань або де легасі має баг. Якщо ревʼю не згодне — правити **до** старту.

| # | Питання | Рішення | Підстава |
|---|---|---|---|
| 1 | Коли прибирати скрипт витягування | **Задача 2**, а не в кутовері | цей етап мусить правити дані (рядки 11 і 17 дірок, іконки ресурсів); поки живий `npm run extract`, ручна правка тихо зникне при наступному запуску. Легасі-HTML лишається до кутовера — з ним порівнюється вигляд |
| 2 | Як переносити CSS | дослівно, скриптом `scripts/port-legacy-css.mjs`, у глобальний файл на сторінку | спека: «стилі конкретної сторінки лишаються в її `.astro`». Читаємо як «належать сторінці»; глобальний імпорт зберігає специфічність легасі, scoped — ні (див. Global Constraints) |
| 3 | `base.css` зі спільними утилітами | ужимається до правил, що є **на всіх 10** сторінках; `ul`, `.section-title`, `.lead`, `.btn*`, `.reveal*` їдуть у `home.css` | Етап 0 скопіював `base.css` з `index.html`. На підсторінках цих правил немає, а `.btn{font-size:1rem}` змінив би кнопки деталок (`.info .btn` там кегль не задає) |
| 4 | `--maxw` відрізняється по сторінках | `tokens.css` лишається з `1360px`; `church`, `churches`, `leaders`, `ministries`, `pastors` мають `:root{--maxw:1200px}` у власному CSS | так у легасі. Тест Задачі 4 гарантує, що CSS сторінки підключається **після** токенів |
| 5 | Галерея в один компонент | `Gallery.astro` з класами `.gallery`, `.gallery-stage`, `.gallery-arrow` (було `.slider*` на церкві/проєкті і `.gal-arrow` на служінні); правила — в `src/styles/gallery.css` | правила трьох копій ідентичні, відрізнялися лише імена. Відео: ID витягується `ytId()` на збірці для всіх трьох (церква раніше клала `src` в iframe як є) |
| 6 | Мініатюра відео в галереї | `https://i.ytimg.com/vi/<id>/hqdefault.jpg` | легасі підставляв випадкову `picsum`-заглушку з трьома різними seed-схемами; у `mediaItem` немає `poster`. Справжня мініатюра відео — правильна поведінка після заміни заглушок. Маскується у порівнянні |
| 7 | Картинка картки служіння | перше фото з `media[]` (`coverImage`) | легасі будував окремий URL `picsum…/600/400` поза даними. Після Storyblok цього URL не буде. Маскується у порівнянні |
| 8 | Перемикач мов | `<a>` з тими самими класами; CSS відтворює поведінку кнопки (`display:inline-flex`, `line-height:normal`, без зміни кольору при наведенні) | Спека 2. Без `line-height:normal` посилання стає вищим на ~0.6px — вже видно в піксельному порівнянні |
| 9 | «Повернення до секції, з якої пішов» (`sessionStorage`) | прибирається; кнопки «назад» ведуть на якір секції: `/#ministries`, `/#pastors`, `/#testimonies` (секції свідчень додано `id="testimonies"`) | з реальними URL кнопка «Назад» браузера відновлює прокрутку сама; явні посилання «назад» тепер несуть секцію в адресі — працює і без JS, і для робота. Інвентар Спеки 1 вимагає «перевірити, що нічого не загублено» — перевіряє e2e Задачі 12 |
| 10 | Три нові сторінки (`/about/`, `/contacts/`, `/donate/`) | будуються, лише коли `pages.<id>.body` не `null`; тоді у футері головної **той самий** пункт («Про церкву», «Пожертви», адреса) міняє `href` з якоря на сторінку | Спека 2: «вмикаються по одній, у міру готовності тексту» і «лише футер». Зміна `href` без нового пункту не змінює вигляд головної ні до, ні після |
| 11 | HTML у контенті (дірка 17) | `hero.title` лишається `set:html`; стрілка «Читати далі» і `<cite>` вірша переїжджають у шаблон, з даних розмітка прибирається | легасі губив і стрілку, і посилання на вірш на англійській (перезапис `innerHTML`). Тепер обидві мови однакові. Англійська секція пожертв стає вищою на рядок — позначено як відома відмінність |
| 12 | `ctaUrl` проєкту (дірка 11) | або абсолютний `https://…`, або шлях сайту з `/`, що локалізується; `social-canteen` → `/#contacts` | `index.html#contacts` після Етапу 2 не існує; `/contacts/` поки вимкнена (рішення 10) |
| 13 | Іконки ресурсів лідерів | нове поле `icon` у `leader-resources` (6 значень: `book music video calendar shield users`), обовʼязкове для `link`, `null` для `document` | у легасі шість різних SVG жили лише в розмітці; без поля в даних новий ресурс лишиться без іконки |
| 14 | Відеосвідчення і пастори на головній | з колекцій `testimonies` (`type: video`) і `pastors` (`group: pastor`), а не з розмітки | одне джерело правди. Побічно англійська головна отримує англійську роль у відеосвідченнях (легасі показував українську) — маска у порівнянні. Ключі `homepage.pastors.role`/`role2` стають невикористаними; не видаляються до Спеки 3, записано в дірки |
| 15 | Англійські підписи доступності (дірка 14) | додаються в `uk.json`/`en.json` під `a11y.*` з перекладом від розробника | без них англійська сторінка озвучує українською. Переклади очевидні («Previous slide»), але позначені в нотатці як ті, що потребують підтвердження замовника |
| 16 | Соцмережі у футері | реальні адреси з `site-settings` | у легасі `href="#"`. Вигляд не змінюється |
| 17 | Невідомий `slug` на деталці | 404 | легасі мовчки показував перший запис; для пошуку це дубль |
| 18 | `<title>` | як `document.title` легасі там, де він був (`«<служіння> — House of Bread Church»`, назва церкви, назва проєкту), інакше заголовок сторінки / назва сайту | повний набір мета-тегів — Етап 3; `<title>` потрібен уже зараз, бо Base його вимагає |
| 19 | Деплой | воркфлоу GitHub Pages із Задачі 4 Етапу 0 додається в кутовері | в репозиторії `.github/` немає — задачу Етапу 0 не закомічено. Поки легасі живе з кореня гілки, воркфлоу не можна вмикати, а після видалення легасі без нього сайт зникне |
| 20 | Лічильник і картки `/ministries/` на англійській у легасі | інструмент порівняння клікає `.lang-toggle button[data-lang="en"]` на легасі-сторінці перед знімком — клік ще раз викликає `applyLang('en')` останнім, і контент лишається англійським, як у новій збірці; порівнюються по пікселях без масок | легасі `ministries.dc.html` на en викликає `applyLang('en')`, а одразу після mount — безумовний `render('uk')`, що повертає картки й лічильник назад на українську. Реальний клік користувача в браузері цей стан виправляє (`applyLang` — останній виклик), тож маскувати нема чого: `scripts/visual/run.mjs`, `load()` |
| 21 | Назва, опис і картки «Інші служіння» на `/ministries/<slug>/` англійською у легасі | той самий клік у `load()` (рішення 20) — `ministry.dc.html` має ту саму кнопку перемикача, тож `renderMinistry('en')` теж лишається останнім викликом; порівнюються по пікселях без масок і без `known` | той самий баг, що й рішення 20, — `ministry.dc.html` викликає `applyLang('en')`, а одразу після нього безумовний `renderMinistry('uk')` скидає назву, опис і картки «Інші служіння» назад на українську (мітки з `data-i18n` лишаються англійськими) |

## Структура файлів

```
src/
  lib/                          # чисті функції, тестуються node:test напряму
    paths.mjs                   # localePath, assetUrl, linkHref, localeParams, otherLang
    i18n.mjs                    # pick, createT
    youtube.mjs                 # ytId, ytEmbed, ytThumb
    collections.mjs             # byOrder, sortedData, nextCyclic, othersFirst, coverImage
    format.mjs                  # formatDate, initial, telHref, paragraphs
    icons.mjs                   # 18 іконок служінь, 6 іконок ресурсів
    svg.mjs                     # інлайн-SVG, що повторюються між сторінками
    pages.mjs                   # isPageEnabled
  i18n/index.ts                 # t() і pick() поверх uk.json/en.json
  layouts/
    Base.astro                  # (є) <html lang>, <head>, canonical
    SubPage.astro               # Base + шапка/футер підсторінки
  components/
    SubHeader.astro  SubFooter.astro  LangSwitch.astro  Crumbs.astro
    Icon.astro  Gallery.astro  SiteHeader.astro  SiteFooter.astro
  scripts/video-testimonies.mjs # клік по відеосвідченню → iframe (головна + /testimonies/)
  styles/
    fonts.css  tokens.css  base.css   # (є) base.css ужимається
    gallery.css
    pages/  home.css ministries.css ministry.css churches.css church.css projects.css
            project.css testimonies.css pastors.css leaders.css info.css
  pages/[...lang]/
    index.astro  testimonies.astro  pastors.astro  leaders.astro
    about.astro  contacts.astro  donate.astro
    ministries/index.astro  ministries/[slug].astro
    churches/index.astro    churches/[slug].astro
    projects/index.astro    projects/[slug].astro
public/uploads/                 # logo.png, hero-cross.jpg, hero-cross-mobile.jpg
scripts/
  lib/static-server.mjs         # статичний сервер для порівняння й e2e (лишається)
  port-legacy-css.mjs           # перенос <style> легасі (видаляється в кутовері)
  visual/routes.mjs  visual/run.mjs   # піксельне порівняння (видаляється в кутовері)
tests/
  helpers/content.js  helpers/dist.js  helpers/links.js
  lib.test.js  static-server.test.js  port-css.test.js  site.test.js  pages-toggle.test.js
  page-ministries.test.js  page-churches.test.js  page-projects.test.js
  page-testimonies.test.js  page-pastors.test.js  page-leaders.test.js  page-home.test.js
  e2e/helpers.js  e2e/*.e2e.js  # npm run e2e (Playwright, поза npm test)
.github/workflows/deploy.yml    # Задача 15
```

## Інвентар поведінки → де перевіряється

| Поведінка (Спека 1) | Доля | Задача | Перевірка |
|---|---|---|---|
| Сітка служінь з `window.HOB_MINISTRIES` | на збірці | 4, 12 | `page-ministries.test.js`, `page-home.test.js` |
| Пошук за `?id=` | `getStaticPaths()` | 5–7 | `page-*.test.js`: сторінка на кожен slug × 2 мови |
| Перемикач мов, `localStorage` | посилання | 4 | `site.test.js`, `e2e/lang.e2e.js` |
| Калькулятор пожертв | переноситься | 11 | `e2e/home.e2e.js` |
| Липкий хедер | переноситься | 11 | `e2e/home.e2e.js` |
| Мобільна шторка | переноситься | 11 | `e2e/home.e2e.js` |
| Карусель свідчень | переноситься | 12 | `e2e/home.e2e.js` |
| YouTube по кліку у свідченнях | переноситься | 8, 12 | `e2e/testimonies.e2e.js`, `e2e/home.e2e.js` |
| Активний пункт меню | переноситься | 11 | `e2e/home.e2e.js` |
| Поява блоків, анімація героя | переноситься | 11 | `e2e/home.e2e.js` |
| Повернення до секції | якорі в «назад» | 4, 8, 9, 12 | `page-*.test.js` (href), `e2e/home.e2e.js` (прокрутка до якоря) |
| Галерея на деталках | один компонент | 5 | `e2e/gallery.e2e.js` |

## Review Focus

Класи входу, які спека передбачає, але жодна «щаслива» задача не перевіряє. Тест для кожного рядка доданий у задачу, що володіє кодом.

1. **CSS сторінки підключився раніше за `tokens.css`** — `:root{--maxw:1200px}` на пʼяти сторінках програє `1360px`, контейнер ширшає на 160px, а локально на вузькому моніторі цього не видно. *Тест: Задача 4, `site.test.js`.*
2. **Збірка під підшляхом (`BASE_PATH=/--House-of-Bread-Church-Website/`)** — внутрішнє посилання, записане як `/ministries/`, працює локально і дає 404 на GitHub Pages. *Тест: Задача 14, перевірка посилань на збірці з довільним `BASE_PATH`.*
3. **Англійська сторінка веде на українську** — картка на `/en/ministries/`, що вказує на `/ministries/youth/`, мовчки перемикає мову; перемикач на деталці, що веде на головну, а не на той самий slug. *Тест: Задача 4, `site.test.js` (усі сторінки, що зʼявляться далі, покриваються автоматично).*
4. **Запис без необовʼязкових частин** — проєкт без `progress` чи з `ctaUrl: null`, галерея, де перше медіа — відео (картка без фото), служінь менше за п'ять («інші» не мають показувати сам запис). *Тести: Задача 1 (`coverImage`, `nextCyclic`), Задача 7 (проєкт без прогресу, внутрішній `ctaUrl`).*
5. **Нова сторінка без тексту** — `/about/` з `body: null` потрапила в збірку чи в футер як порожня сторінка в індексі; або навпаки, вмикання тексту не дає обох локалей. *Тест: Задача 13, `pages-toggle.test.js`.*

---

## Задача 1: бібліотеки — шляхи, переклади, YouTube, колекції, формат, іконки

**Files:**
- Create: `src/lib/paths.mjs`, `src/lib/i18n.mjs`, `src/lib/youtube.mjs`, `src/lib/collections.mjs`, `src/lib/format.mjs`, `src/lib/icons.mjs`, `src/lib/svg.mjs`, `src/lib/pages.mjs`, `src/i18n/index.ts`
- Test: `tests/lib.test.js`

**Interfaces:**
- Produces: `localePath(base: string, lang: 'uk'|'en', path: string): string` — `path` починається з `/`, результат `base + ('en/' якщо en) + path без першого слеша`.
- Produces: `assetUrl(base, src): string` — зовнішнє (`https?://`) як є, інакше під `base`.
- Produces: `linkHref(base, lang, url): string` — зовнішнє як є, `/…` через `localePath`, інше — помилка.
- Produces: `localeParams(): {params:{lang}, props:{lang}}[]`, `otherLang(lang)`, `LOCALES`.
- Produces: `pick(pair: {uk,en}, lang): string` (падає на відсутньому/порожньому), `createT(dicts) → t(lang, 'a.b')`.
- Produces: `ytId(src): string|null`, `ytEmbed(id, {autoplay?}): string`, `ytThumb(id): string`.
- Produces: `byOrder`, `sortedData(entries) → data[]`, `nextCyclic(list, index, count)`, `othersFirst(list, slug, count)`, `coverImage(media) → {src, alt}`.
- Produces: `formatDate(iso, lang)`, `initial(name)`, `telHref(phone)`, `paragraphs(text): string[]`.
- Produces: `MINISTRY_ICON_PATHS`, `MINISTRY_ICON_NAMES`, `RESOURCE_ICON_PATHS`, `RESOURCE_ICON_NAMES`; SVG-рядки `ARROW ARROW_BUTTON ARROW_NEWS BACK CHEVRON CHEVRON_LEFT PLAY PIN PHONE MAIL PERSON USERS FACEBOOK YOUTUBE INSTAGRAM TELEGRAM`; `isPageEnabled(page)`.
- Produces (Astro-бік): `import { t, pick } from '<…>/i18n'`.

- [ ] **Step 1: Написати падаючий тест**

`tests/lib.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localePath, assetUrl, linkHref, otherLang, localeParams } from '../src/lib/paths.mjs';
import { pick, createT } from '../src/lib/i18n.mjs';
import { ytId, ytEmbed, ytThumb } from '../src/lib/youtube.mjs';
import { sortedData, nextCyclic, othersFirst, coverImage } from '../src/lib/collections.mjs';
import { formatDate, initial, telHref, paragraphs } from '../src/lib/format.mjs';
import {
  MINISTRY_ICON_NAMES, MINISTRY_ICON_PATHS, RESOURCE_ICON_NAMES, RESOURCE_ICON_PATHS,
} from '../src/lib/icons.mjs';
import * as svg from '../src/lib/svg.mjs';
import { isPageEnabled } from '../src/lib/pages.mjs';

test('localePath: uk у корені, en під /en/, base зберігається', () => {
  assert.equal(localePath('/', 'uk', '/'), '/');
  assert.equal(localePath('/', 'en', '/'), '/en/');
  assert.equal(localePath('/', 'uk', '/ministries/youth/'), '/ministries/youth/');
  assert.equal(localePath('/sub/', 'en', '/ministries/youth/'), '/sub/en/ministries/youth/');
  // Якір секції головної мусить лишатися в тій самій мові.
  assert.equal(localePath('/sub/', 'en', '/#contacts'), '/sub/en/#contacts');
});

test('localePath відкидає відносний шлях і невідому локаль', () => {
  // Відносний шлях — це легасі-звичка ("ministry.dc.html?id=…"); під
  // підшляхом він дає інший URL на кожній глибині вкладеності.
  assert.throws(() => localePath('/', 'uk', 'ministries/'), /«\/»/);
  assert.throws(() => localePath('/', 'de', '/'), /локаль/);
});

test('assetUrl: зовнішні адреси як є, локальні — під base', () => {
  assert.equal(assetUrl('/sub/', 'uploads/logo.png'), '/sub/uploads/logo.png');
  assert.equal(assetUrl('/sub/', '/uploads/logo.png'), '/sub/uploads/logo.png');
  assert.equal(assetUrl('/sub/', 'https://picsum.photos/x'), 'https://picsum.photos/x');
});

test('linkHref: зовнішнє як є, внутрішнє — з локаллю, інше — помилка', () => {
  assert.equal(linkHref('/', 'uk', 'https://www.liqpay.ua/x'), 'https://www.liqpay.ua/x');
  assert.equal(linkHref('/', 'en', '/#contacts'), '/en/#contacts');
  assert.throws(() => linkHref('/', 'uk', 'index.html#contacts'), /index\.html#contacts/);
});

test('otherLang і localeParams дають рівно дві локалі з uk у корені', () => {
  assert.equal(otherLang('uk'), 'en');
  assert.equal(otherLang('en'), 'uk');
  assert.deepEqual(localeParams(), [
    { params: { lang: undefined }, props: { lang: 'uk' } },
    { params: { lang: 'en' }, props: { lang: 'en' } },
  ]);
});

test('pick повертає переклад і падає на відсутньому', () => {
  assert.equal(pick({ uk: 'Молодь', en: 'Youth' }, 'en'), 'Youth');
  // Фолбек на українську тихо показав би її на англійській сторінці —
  // гірше за впалу збірку (та сама логіка, що в схемі Етапу 1).
  assert.throws(() => pick({ uk: 'Молодь', en: '' }, 'en'), /en/);
  assert.throws(() => pick(undefined, 'uk'), /uk/);
});

test('t шукає ключ за крапкою і падає на відсутньому', () => {
  const t = createT({ uk: { a: { b: 'в' } }, en: { a: { b: 'c' } } });
  assert.equal(t('en', 'a.b'), 'c');
  assert.throws(() => t('uk', 'a.x'), /a\.x/);
  assert.throws(() => t('uk', 'a'), /a/, 'гілка словника — не рядок');
});

test('ytId розпізнає всі форми посилань і голий ID', () => {
  for (const src of [
    'https://www.youtube.com/watch?v=ScMzIvxBSi4',
    'https://youtu.be/ScMzIvxBSi4',
    'https://www.youtube.com/embed/ScMzIvxBSi4',
    'https://www.youtube.com/shorts/ScMzIvxBSi4',
    'ScMzIvxBSi4',
  ]) {
    assert.equal(ytId(src), 'ScMzIvxBSi4', src);
  }
  assert.equal(ytId('https://vimeo.com/123'), null);
  assert.equal(ytId(''), null);
  assert.equal(ytId(null), null);
});

test('ytEmbed і ytThumb дають ті самі адреси, що й легасі', () => {
  assert.equal(ytEmbed('ScMzIvxBSi4'), 'https://www.youtube.com/embed/ScMzIvxBSi4?rel=0');
  assert.equal(
    ytEmbed('ScMzIvxBSi4', { autoplay: true }),
    'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1&rel=0',
  );
  assert.equal(ytThumb('ScMzIvxBSi4'), 'https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg');
});

test('sortedData сортує за order, а не за порядком файлів', () => {
  const entries = [{ data: { slug: 'b', order: 1 } }, { data: { slug: 'a', order: 0 } }];
  assert.deepEqual(sortedData(entries).map((x) => x.slug), ['a', 'b']);
});

test('nextCyclic бере наступні по колу і ніколи не повертає сам запис', () => {
  const list = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(nextCyclic(list, 3, 4), ['e', 'a', 'b', 'c']);
  // Легасі на коротшому списку показав би сам запис серед «інших».
  assert.deepEqual(nextCyclic(['a', 'b', 'c'], 0, 4), ['b', 'c']);
});

test('othersFirst бере перші N без поточного', () => {
  const list = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }, { slug: 'd' }];
  assert.deepEqual(othersFirst(list, 'b', 3).map((x) => x.slug), ['a', 'c', 'd']);
});

test('coverImage: перше фото, а для галереї з одних відео — мініатюра YouTube', () => {
  assert.deepEqual(
    coverImage([
      { type: 'video', src: 'https://youtu.be/ScMzIvxBSi4', alt: 'Відео' },
      { type: 'image', src: 'https://x/1.jpg', alt: 'Фото' },
    ]),
    { src: 'https://x/1.jpg', alt: 'Фото' },
  );
  // Легасі клав у <img> саме посилання YouTube — битий значок замість картки.
  assert.deepEqual(
    coverImage([{ type: 'video', src: 'ScMzIvxBSi4', alt: 'Відео' }]),
    { src: 'https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg', alt: 'Відео' },
  );
});

test('formatDate дає ту саму дату, що й легасі в браузері, незалежно від поясу збірки', () => {
  assert.equal(formatDate('2026-01-10', 'uk'), '10 січня 2026 р.');
  assert.equal(formatDate('2026-01-10', 'en'), 'January 10, 2026');
});

test('initial, telHref і paragraphs', () => {
  assert.equal(initial(' олена'), 'О');
  assert.equal(initial(''), '?');
  assert.equal(telHref('+380 99 133-99-69'), 'tel:+380991339969');
  assert.deepEqual(paragraphs('Перший.\n\nДругий\nрядок.\n\n\n'), ['Перший.', 'Другий\nрядок.']);
});

test('іконки служінь — рівно 18 легасі-значень, кожна з непорожнім SVG', () => {
  assert.deepEqual(MINISTRY_ICON_NAMES, [
    'book', 'home', 'media', 'worship', 'child', 'youth', 'teen', 'order', 'care',
    'chapel', 'prophetic', 'hospital', 'biz', 'pray', 'mercy', 'prison', 'family', 'globe',
  ]);
  for (const name of MINISTRY_ICON_NAMES) assert.match(MINISTRY_ICON_PATHS[name], /^<(path|circle|rect)/);
});

test('іконки ресурсів — шість значень із розмітки leaders.dc.html', () => {
  assert.deepEqual(RESOURCE_ICON_NAMES, ['book', 'music', 'video', 'calendar', 'shield', 'users']);
  for (const name of RESOURCE_ICON_NAMES) assert.match(RESOURCE_ICON_PATHS[name], /^<(path|circle|rect)/);
});

test('кожен спільний SVG — один цілий елемент <svg>', () => {
  for (const [name, markup] of Object.entries(svg)) {
    assert.match(markup, /^<svg [^>]*>.*<\/svg>$/s, name);
  }
});

test('isPageEnabled: сторінка вмикається лише з текстом', () => {
  assert.equal(isPageEnabled({ title: { uk: 'а', en: 'b' }, body: null }), false);
  assert.equal(isPageEnabled({ title: { uk: 'а', en: 'b' } }), false);
  assert.equal(isPageEnabled({ title: { uk: 'а', en: 'b' }, body: { uk: 'т', en: 't' } }), true);
});
```

- [ ] **Step 2: Запустити й переконатися, що падає**

Run: `node --test tests/lib.test.js`
Expected: FAIL — `Cannot find module '…/src/lib/paths.mjs'`

- [ ] **Step 3: Реалізувати бібліотеки**

`src/lib/paths.mjs`:

```js
// Усі внутрішні адреси будуються тут. base — import.meta.env.BASE_URL, його
// astro.config.mjs нормалізує до «/…/». Жодна сторінка не пише «/» руками:
// під підшляхом GitHub Pages це дає 404, якого локально не видно.
export const LOCALES = ['uk', 'en'];

export const otherLang = (lang) => (lang === 'uk' ? 'en' : 'uk');

export const isExternal = (url) => /^https?:\/\//.test(url);

export function localePath(base, lang, path = '/') {
  if (!LOCALES.includes(lang)) throw new Error(`невідома локаль: ${lang}`);
  if (!path.startsWith('/')) throw new Error(`шлях має починатися з «/»: ${path}`);
  return `${base}${lang === 'en' ? 'en/' : ''}${path.slice(1)}`;
}

export function assetUrl(base, src) {
  return isExternal(src) ? src : `${base}${src.replace(/^\/+/, '')}`;
}

// Посилання з даних (напр. ctaUrl проєкту): або чужий сайт, або шлях сайту,
// що має лишитися в мові поточної сторінки.
export function linkHref(base, lang, url) {
  if (isExternal(url)) return url;
  if (url.startsWith('/')) return localePath(base, lang, url);
  throw new Error(`посилання має бути https://… або /…: ${url}`);
}

// Rest-параметр [...lang]: undefined дає корінь (uk), 'en' — префікс /en/.
// Один файл маршруту — обидві локалі (Спека 1).
export const localeParams = () => [
  { params: { lang: undefined }, props: { lang: 'uk' } },
  { params: { lang: 'en' }, props: { lang: 'en' } },
];
```

`src/lib/i18n.mjs`:

```js
// Фолбеку на іншу мову немає свідомо: порожній переклад має валити збірку,
// а не показувати українську на англійській сторінці.
export function pick(pair, lang) {
  const value = pair?.[lang];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`немає перекладу «${lang}» у ${JSON.stringify(pair)}`);
  }
  return value;
}

export function createT(dicts) {
  return (lang, key) => {
    const value = key.split('.').reduce((node, part) => node?.[part], dicts[lang]);
    if (typeof value !== 'string') throw new Error(`немає ключа «${key}» для «${lang}»`);
    return value;
  };
}
```

`src/lib/youtube.mjs`:

```js
// Той самий розбір, що в усіх копіях легасі: URL будь-якої форми або голий
// 11-символьний ID (Спека 1 дозволяє обидва).
const YT = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/;

export function ytId(src) {
  if (!src) return null;
  const match = String(src).match(YT);
  if (match) return match[1];
  return /^[\w-]{11}$/.test(src) ? src : null;
}

export const ytEmbed = (id, { autoplay = false } = {}) =>
  `https://www.youtube.com/embed/${id}?${autoplay ? 'autoplay=1&' : ''}rel=0`;

export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
```

`src/lib/collections.mjs`:

```js
import { ytId, ytThumb } from './youtube.mjs';

export const byOrder = (a, b) => a.order - b.order;

// Glob-завантажувач порядку не гарантує; вигляд залежить від order
// (значок «Головна церква», перші три служіння на головній).
export const sortedData = (entries) => entries.map((entry) => entry.data).sort(byOrder);

export function nextCyclic(list, index, count) {
  const n = Math.min(count, list.length - 1);
  return Array.from({ length: n }, (_, i) => list[(index + 1 + i) % list.length]);
}

export const othersFirst = (list, slug, count) =>
  list.filter((item) => item.slug !== slug).slice(0, count);

export function coverImage(media) {
  const image = media.find((item) => item.type === 'image');
  if (image) return { src: image.src, alt: image.alt };
  const id = ytId(media[0]?.src);
  if (!id) throw new Error(`галерея без фото і без відео YouTube: ${JSON.stringify(media)}`);
  return { src: ytThumb(id), alt: media[0].alt };
}
```

`src/lib/format.mjs`:

```js
const LOCALE_TAG = { uk: 'uk-UA', en: 'en-US' };

// Легасі форматував у браузері відвідувача: new Date('2026-01-10') — це
// опівніч UTC, і в Україні дата та сама. На збірці пояс довільний, тому
// явний UTC — інакше збірка в США показала б попередній день.
export function formatDate(iso, lang) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(LOCALE_TAG[lang], {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export const initial = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

export const telHref = (phone) => `tel:${phone.replace(/[^+\d]/g, '')}`;

// Проза нових сторінок — простий текст; абзаци розділені порожнім рядком.
// HTML у дані не пускаємо (Storyblok отримає richtext окремо).
export const paragraphs = (text) =>
  text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
```

`src/lib/icons.mjs` (шляхи — побайтово з блоку `const icons` в `index.html` і з розмітки `.res-card` у `leaders.dc.html`):

```js
// Закритий набір: схема колекцій бере назви саме звідси, тож іконка поза
// списком валить збірку, а не малює порожню картку.
export const MINISTRY_ICON_PATHS = {
  book: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"/><path d="M8 3v18"/>',
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/>',
  media: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
  worship: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
  child: '<circle cx="12" cy="6" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/>',
  youth: '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/>',
  teen: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>',
  order: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  care: '<path d="M12 21s-7-4.5-9-9A5 5 0 0 1 12 6a5 5 0 0 1 9 6c-2 4.5-9 9-9 9Z"/>',
  chapel: '<path d="M12 2v6M9 5h6M6 22V11l6-4 6 4v11"/>',
  prophetic: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  hospital: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 8v6M9 11h6"/>',
  biz: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  pray: '<path d="M12 2v9M8 7c0 3 2 4 4 4s4-1 4-4M6 22c0-4 3-7 6-7s6 3 6 7"/>',
  mercy: '<path d="M20 8.5a4.5 4.5 0 0 0-8-2.8A4.5 4.5 0 0 0 4 8.5c0 4 8 9.5 8 9.5s8-5.5 8-9.5Z"/>',
  prison: '<path d="M4 3v18M9 3v18M14 3v18M19 3v18"/>',
  family: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><path d="M2 20v-1a5 5 0 0 1 10 0v1M12 20v-1a5 5 0 0 1 10 0v1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
};
export const MINISTRY_ICON_NAMES = Object.keys(MINISTRY_ICON_PATHS);

// Шість різних SVG карток «Посилання та ресурси» — у легасі вони жили лише
// в розмітці, тож новий ресурс лишився б без іконки.
export const RESOURCE_ICON_PATHS = {
  book: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"/><path d="M8 3v18"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
  video: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  shield: '<path d="M12 3l7.5 4v5c0 4.6-3.2 7.4-7.5 9-4.3-1.6-7.5-4.4-7.5-9V7L12 3Z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
};
export const RESOURCE_ICON_NAMES = Object.keys(RESOURCE_ICON_PATHS);
```

`src/lib/svg.mjs`:

```js
// Інлайн-іконки, що повторюються на кількох сторінках. Розмітка — побайтово
// з легасі, разом із дрібними відмінностями між варіантами (width/height,
// stroke-linejoin): інакше пливуть пікселі в порівнянні з легасі.
const S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';
const SJ = `${S} stroke-linejoin="round"`;

export const ARROW = `<svg ${SJ}><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
export const ARROW_BUTTON = `<svg width="18" height="18" ${S}><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;
export const ARROW_NEWS = `<svg ${S}><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;
export const BACK = `<svg ${SJ}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`;
export const CHEVRON = `<svg ${S}><path d="M9 6l6 6-6 6"/></svg>`;
export const CHEVRON_LEFT = `<svg ${S}><path d="M15 6l-6 6 6 6"/></svg>`;
export const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
export const PIN = `<svg ${SJ}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
export const PHONE = `<svg ${SJ}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>`;
export const MAIL = `<svg ${SJ}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`;
export const PERSON = `<svg ${SJ}><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>`;
export const USERS = `<svg ${SJ}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>`;
export const FACEBOOK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3l.5-3H14V4.2c0-.9.3-1.5 1.6-1.5H17V.1C16.6.1 15.6 0 14.5 0 12 0 10.3 1.5 10.3 4v2H7.5v3h2.8v9H14V9Z"></path></svg>';
export const YOUTUBE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.5-.4-5.2a2.7 2.7 0 0 0-1.9-1.9C18.9 4.5 12 4.5 12 4.5s-6.9 0-8.7.4a2.7 2.7 0 0 0-1.9 1.9C1 8.5 1 12 1 12s0 3.5.4 5.2a2.7 2.7 0 0 0 1.9 1.9c1.8.4 8.7.4 8.7.4s6.9 0 8.7-.4a2.7 2.7 0 0 0 1.9-1.9C23 15.5 23 12 23 12ZM9.7 15.4V8.6l5.8 3.4-5.8 3.4Z"></path></svg>';
export const INSTAGRAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"></circle></svg>';
export const TELEGRAM = `<svg ${SJ}><path d="m21.5 3-19 7.6c-.9.4-.9 1.6.1 1.9l4.6 1.5 1.8 5.6c.3.9 1.4 1.1 2 .4l2.5-2.7 4.8 3.5c.8.6 2 .2 2.2-.8l3-15.6c.2-1.1-.9-2-2-1.4Z"></path><path d="M8.3 14 18 7"></path></svg>`;
```

`src/lib/pages.mjs`:

```js
// Спека 2: «Краще дві сторінки з нормальним текстом, ніж три заглушки в
// індексі». Сторінка існує (і має посилання у футері), лише коли є проза.
export const isPageEnabled = (page) => page.body != null;
```

`src/i18n/index.ts`:

```ts
import uk from './uk.json';
import en from './en.json';
import { createT } from '../lib/i18n.mjs';

export type Lang = 'uk' | 'en';
export const t = createT({ uk, en });
export { pick } from '../lib/i18n.mjs';
```

- [ ] **Step 4: Запустити тест і переконатися, що проходить**

Run: `node --test tests/lib.test.js`
Expected: PASS, 19 тестів

- [ ] **Step 5: Повний прогін і коміт**

Run: `npm test`
Expected: PASS

```bash
git add src/lib src/i18n/index.ts tests/lib.test.js
git commit -m "feat: бібліотеки шляхів, перекладів, YouTube і колекцій для сторінок

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 2: заморозка контенту і правки даних

Після цієї задачі `src/content/**` — джерело правди, а не згенерований файл: скрипт витягування, карта ключів і тести звірки з легасі видаляються. Легасі-HTML лишається (порівняння вигляду), але більше нічим не читається.

**Files:**
- Create: `tests/helpers/content.js`
- Delete: `scripts/extract-legacy-content.mjs`, `scripts/key-map.json`, `scripts/lib/legacy-source.mjs`, `tests/content-fidelity.test.js`, `tests/legacy-source.test.js`, `tests/fixtures/eol-fixture.html`
- Modify: `package.json` (прибрати `extract`), `tests/content.test.js`, `tests/content-schema.test.js`, `src/content.config.ts`, `src/content/singletons/homepage.json`, `src/content/projects/social-canteen.json`, `src/content/leader-resources/*.json`, `CLAUDE.md`, `docs/superpowers/notes/2026-09-23-content-gaps.md`

**Interfaces:**
- Consumes: `MINISTRY_ICON_NAMES`, `RESOURCE_ICON_NAMES` із Задачі 1.
- Produces: `tests/helpers/content.js` → `readCollection(name) → {file, data}[]`, `readSingleton(name) → data`, `readPages() → Record<id, data>`, `localizedPairs(value)`.
- Produces: поле `leader-resources.icon: RESOURCE_ICON_NAMES | null`; `projects.ctaUrl` — `https://…` або `/…`; `homepage.news.more` і `homepage.donate.quote` — чистий текст.
- Produces: `buildWith(collection, fileName, data)` у `tests/content-schema.test.js`.

- [ ] **Step 1: Винести помічники тестів контенту**

`tests/helpers/content.js`:

```js
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const contentDir = (name) =>
  fileURLToPath(new URL(`../../src/content/${name}`, import.meta.url));

// __probe* — тимчасові записи тесту схем; до «справжнього» контенту не входять.
export const readCollection = (name) =>
  readdirSync(contentDir(name))
    .filter((f) => f.endsWith('.json') && !f.startsWith('__probe'))
    .map((f) => ({ file: f, data: JSON.parse(readFileSync(`${contentDir(name)}/${f}`, 'utf8')) }));

export const readSingleton = (name) =>
  JSON.parse(readFileSync(contentDir(`singletons/${name}.json`), 'utf8')).main;

export const readPages = () =>
  JSON.parse(readFileSync(contentDir('singletons/pages.json'), 'utf8'));

// Рекурсивно знаходить кожну пару {uk, en} — щоб перевіряти повноту
// перекладу, не перелічуючи поля кожної колекції окремо.
export function* localizedPairs(value, path = '') {
  if (value === null || typeof value !== 'object') return;
  if (typeof value.uk === 'string' && 'en' in value) {
    yield [path, value];
    return;
  }
  for (const [k, v] of Object.entries(value)) yield* localizedPairs(v, `${path}.${k}`);
}
```

У `tests/content.test.js`: видалити локальні `contentDir`, `readCollection`, `localizedPairs`, `readSingleton` і імпорт `readHobGlobals`; додати зверху

```js
import { contentDir, readCollection, readSingleton, localizedPairs } from './helpers/content.js';
```

- [ ] **Step 2: Прибрати інфраструктуру витягування**

```bash
git rm scripts/extract-legacy-content.mjs scripts/key-map.json scripts/lib/legacy-source.mjs \
  tests/content-fidelity.test.js tests/legacy-source.test.js tests/fixtures/eol-fixture.html
```

У `package.json` видалити рядок `"extract": "node scripts/extract-legacy-content.mjs",`. `node-html-parser` **лишається** в `devDependencies` — на ньому тести виводу з Задачі 4.

- [ ] **Step 3: Замінити тест порядку, що читав легасі**

У `tests/content.test.js` тест `'порядок колекцій відтворює порядок легасі-масивів'` замінити на:

```js
test('order у кожній групі — унікальні 0…n-1, головна церква — перша', () => {
  // Після видалення легасі порядок існує лише як поле order. Дублікат чи
  // дірка означали б, що дві картки борються за одне місце, а значок
  // «Головна церква» дістається не тій. У пасторів і ресурсів order
  // рахується всередині групи (pastor/elder, document/link).
  const groups = [
    ['ministries', () => 'all'],
    ['churches', () => 'all'],
    ['projects', () => 'all'],
    ['testimonies', () => 'all'],
    ['pastors', (d) => d.group],
    ['leader-resources', (d) => d.kind],
  ];
  for (const [name, groupOf] of groups) {
    const byGroup = {};
    for (const { data } of readCollection(name)) (byGroup[groupOf(data)] ??= []).push(data.order);
    for (const [group, orders] of Object.entries(byGroup)) {
      assert.deepEqual(
        orders.sort((a, b) => a - b),
        orders.map((_, i) => i),
        `${name}/${group}: order не утворює 0…${orders.length - 1}`,
      );
    }
  }
  const main = readCollection('churches').find(({ data }) => data.order === 0);
  assert.equal(main.data.slug, 'kryvyi-rih');
});
```

- [ ] **Step 4: Написати падаючі тести на правки даних**

Додати в кінець `tests/content.test.js`:

```js
test('розмітка в контенті лише там, де її рендерить шаблон (hero.title)', () => {
  // Дірка 17: uk-варіанти news.more і donate.quote несли <svg> і <cite>,
  // en — ні, бо легасі перезаписував innerHTML. Іконка й цитата тепер у
  // шаблоні, тож розмітка в даних означала б подвійну стрілку.
  for (const [path, pair] of localizedPairs(readSingleton('homepage'))) {
    for (const lang of ['uk', 'en']) {
      if (path === '.hero.title') continue;
      assert.doesNotMatch(pair[lang], /<[a-z/]/i, `homepage${path}.${lang}: розмітка в тексті`);
    }
  }
  const home = readSingleton('homepage');
  assert.equal(home.news.more.uk, 'Читати далі');
  assert.ok(home.donate.quote.uk.endsWith('доброхітного давця любить Бог.»'));
});

test('ctaUrl проєкту — зовнішня адреса або шлях сайту', () => {
  for (const { file, data } of readCollection('projects')) {
    if (data.ctaUrl === null) continue;
    assert.match(data.ctaUrl, /^(https:\/\/|\/)/, `${file}: ${data.ctaUrl}`);
  }
  // Дірка 11: index.html#contacts після Етапу 2 не існує.
  const canteen = readCollection('projects').find(({ data }) => data.slug === 'social-canteen');
  assert.equal(canteen.data.ctaUrl, '/#contacts');
});

test('кожне посилання для лідерів має свою іконку, документ — жодної', () => {
  const icons = Object.fromEntries(
    readCollection('leader-resources').map(({ data }) => [data.slug, data.icon]),
  );
  assert.deepEqual(icons, {
    'document-1': null, 'document-2': null, 'document-3': null,
    'document-4': null, 'document-5': null, 'document-6': null,
    'link-1': 'book', 'link-2': 'music', 'link-3': 'video',
    'link-4': 'calendar', 'link-5': 'shield', 'link-6': 'users',
  });
});
```

У тесті `'текст головної перенесений побайтово, разом із розміткою всередині'` перейменувати назву на `'заголовок героя зберігає свою розмітку'` — вміст не міняється.

- [ ] **Step 5: Переконатися, що падають**

Run: `node --test tests/content.test.js`
Expected: FAIL — три нові тести (`розмітка в тексті`, `index.html#contacts`, `icon` = `undefined`)

- [ ] **Step 6: Внести правки в дані**

```bash
node -e "
const fs = require('fs');
const write = (f, j) => fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');

const home = 'src/content/singletons/homepage.json';
const h = JSON.parse(fs.readFileSync(home, 'utf8'));
h.main.news.more.uk = h.main.news.more.uk.replace(/<svg[\s\S]*<\/svg>/, '').trim();
h.main.donate.quote.uk = h.main.donate.quote.uk.replace(/<cite[\s\S]*<\/cite>/, '').trim();
write(home, h);

const canteen = 'src/content/projects/social-canteen.json';
const c = JSON.parse(fs.readFileSync(canteen, 'utf8'));
c.ctaUrl = '/#contacts';
write(canteen, c);

const icons = { 'link-1': 'book', 'link-2': 'music', 'link-3': 'video', 'link-4': 'calendar', 'link-5': 'shield', 'link-6': 'users' };
for (const f of fs.readdirSync('src/content/leader-resources')) {
  const path = 'src/content/leader-resources/' + f;
  const r = JSON.parse(fs.readFileSync(path, 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(r)) { out[k] = v; if (k === 'format') out.icon = icons[r.slug] ?? null; }
  write(path, out);
}
"
git diff --stat
```

Expected: `homepage.json` — 2 рядки змінено, `social-canteen.json` — 1, кожен з 12 файлів `leader-resources` — 1 рядок додано. Якщо `git diff` показує переформатування всього файлу — формат збереження розійшовся з екстрактором; відкотити і зберегти з тим самим відступом, що в `git show HEAD:<файл>`.

- [ ] **Step 7: Оновити схему**

У `src/content.config.ts`:

1. Додати імпорт зверху: `import { MINISTRY_ICON_NAMES, RESOURCE_ICON_NAMES } from './lib/icons.mjs';`
2. Замінити літерал `MINISTRY_ICONS` на одне джерело:

```ts
// Іконки — inline SVG із src/lib/icons.mjs. Назви беруться звідти ж, тож
// список у схемі й набір, який уміє малювати шаблон, розійтися не можуть.
export const MINISTRY_ICONS = MINISTRY_ICON_NAMES as [string, ...string[]];
```

3. У `projects` замінити `ctaUrl: z.string().min(1).nullable(),` на:

```ts
    // Або чужий сайт (LiqPay), або шлях сайту з «/» — його шаблон
    // локалізує (/#contacts → /en/#contacts). Відносний шлях у стилі
    // легасі (index.html#contacts) під новими URL веде в нікуди.
    ctaUrl: z.string().regex(/^(https:\/\/|\/)/).nullable(),
```

4. У `leaderResources` після `format: …` додати `icon: z.enum(RESOURCE_ICON_NAMES as [string, ...string[]]).nullable(),` і замінити `}).strict(),` цієї схеми на:

```ts
  }).strict().refine((r) => (r.kind === 'link') === (r.icon !== null), {
    // Картка посилання без іконки має порожній квадрат, а документ з
    // іконкою — дві: у документа значок — це формат файлу.
    message: 'icon обовʼязковий для link і заборонений для document',
    path: ['icon'],
  }),
```

5. Коментар над `homepage` («Поля, значення яких містять HTML-розмітку…») замінити на:

```ts
// Єдине поле з HTML-розміткою — homepage.hero.title (<em>, <br> в обох
// мовах), рендериться через set:html. Стрілка «Читати далі» і <cite> вірша
// живуть у шаблоні головної: у легасі вони були частиною uk-тексту й
// губилися на англійській (Етап 2, дірка 17).
```

- [ ] **Step 8: Узагальнити тест схем і додати два випадки**

У `tests/content-schema.test.js`:

1. `before` чистить обидві теки:

```js
before(() => {
  for (const collection of ['ministries', 'leader-resources', 'projects']) {
    const dir = join(projectRoot, 'src/content', collection);
    for (const name of readdirSync(dir).filter((f) => /^__probe.*\.json$/.test(f))) {
      rmSync(join(dir, name), { force: true });
    }
  }
});
```

2. Сигнатура `function buildWith(collection, entryFileName, entryData)`, шлях запису — `join(projectRoot, 'src/content', collection, entryFileName)`. Усі наявні виклики `buildWith('__probe.json', …)` стають `buildWith('ministries', '__probe.json', …)`.

3. Додати в кінець:

```js
const validLink = {
  slug: '__probe',
  kind: 'link',
  order: 99,
  url: null,
  format: null,
  icon: 'book',
  title: { uk: 'Тест', en: 'Test' },
  description: { uk: 'Тест', en: 'Test' },
  meta: null,
};

test('посилання для лідерів без іконки валить збірку', { timeout: 120_000 }, () => {
  const { failed, output } = buildWith('leader-resources', '__probe.json', { ...validLink, icon: null });
  assert.equal(failed, true, 'збірка пройшла з посиланням без іконки');
  assert.match(output, /icon/, 'у помилці не названо поле icon');
});

test('відносний ctaUrl у стилі легасі валить збірку', { timeout: 120_000 }, () => {
  const probe = JSON.parse(readFileSync(join(projectRoot, 'src/content/projects/social-canteen.json'), 'utf8'));
  const { failed, output } = buildWith('projects', '__probe.json', {
    ...probe, slug: '__probe', order: 99, ctaUrl: 'index.html#contacts',
  });
  assert.equal(failed, true, 'збірка пройшла з index.html#contacts');
  assert.match(output, /ctaUrl/);
});
```

(додати `readFileSync` в імпорт `node:fs`.)

- [ ] **Step 9: Оновити CLAUDE.md і нотатку дірок**

У `CLAUDE.md` банер (блок, що починається з `> **Етап 1 завершено`) замінити на:

```markdown
> **Етап 2 у роботі (перенесення сторінок на Astro).** Контент — `src/content/**` під схемою
> `src/content.config.ts`, словники інтерфейсу — `src/i18n/{uk,en}.json`. Це **джерело правди**:
> скрипт витягування з легасі видалено, файли правляться руками. `npm test` = `astro build`
> (валідує схему) + `node --test --test-concurrency=1 tests/*.test.js`. Легасі `.html`,
> `*-data.js`, `support.js` лишаються в репозиторії **лише як еталон вигляду** для
> `npm run visual` — не правте їх і не читайте з них дані. На Windows/Git Bash команда зі
> змінною `BASE_PATH` потребує `MSYS_NO_PATHCONV=1` або PowerShell. Решта файлу описує
> легасі-сайт і переписується в кінці Етапу 2.
```

У `docs/superpowers/notes/2026-09-23-content-gaps.md` у рядках 11 і 17 таблиці додати в кінець колонки «Наслідок» ` **Закрито на Етапі 2 (Задача 2):** …` з відповідно `ctaUrl = "/#contacts"` і `розмітку прибрано з даних, стрілка й <cite> у шаблоні`.

- [ ] **Step 10: Прогнати тести**

Run: `npm test`
Expected: PASS (тести схем виконуються кілька хвилин — кожен робить окрему збірку)

- [ ] **Step 11: Коміт**

```bash
git add -A package.json package-lock.json scripts tests src/content.config.ts src/content CLAUDE.md docs/superpowers/notes
git commit -m "refactor: контент стає джерелом правди, правки даних для Етапу 2

Скрипт витягування і звірка з легасі видалені: етап правит дані, і
npm run extract тихо стер би правки. ctaUrl їдальні, розмітка в
news.more/donate.quote (дірки 11, 17), іконки ресурсів лідерів у даних.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 3: інструменти — статичний сервер, перенос CSS, піксельне порівняння, e2e

**Files:**
- Create: `scripts/lib/static-server.mjs`, `scripts/port-legacy-css.mjs`, `scripts/visual/routes.mjs`, `scripts/visual/run.mjs`, `tests/e2e/helpers.js`
- Test: `tests/static-server.test.js`, `tests/port-css.test.js`
- Modify: `package.json` (dev-залежності, скрипти `visual`, `e2e`), `.gitignore`

**Interfaces:**
- Produces: `startStaticServer(root, port = 0) → Promise<{origin, close()}>`, `resolveFile(root, urlPath) → string|null`.
- Produces: `portCss(source, {from, to, origin, maxw?, keepUl?, stripGallery?}) → {css, removed}` і CLI `node scripts/port-legacy-css.mjs <legacy.html> <from> <to> <out.css> [--maxw 1200px] [--keep-ul] [--strip-gallery]`.
- Produces: `npm run visual [-- --only <name-prefix>]` — пише `.visual/<id>/{legacy,next,diff}.png` і `.visual/report.json`, код виходу 1 при будь-якому FAIL.
- Produces: `tests/e2e/helpers.js` → `useSite()` → `{ open(path, {viewport?}) → Page }`; `npm run e2e`.

- [ ] **Step 1: Поставити залежності**

```bash
npm install --save-dev playwright@^1.55.0 pixelmatch@^7.1.0 pngjs@^7.0.0
npx playwright install chromium
```

У `package.json` → `scripts` додати:

```json
    "visual": "astro build && node scripts/visual/run.mjs",
    "e2e": "astro build && node --test --test-concurrency=1 tests/e2e/*.e2e.js",
```

У `.gitignore` додати рядок `.visual/`.

- [ ] **Step 2: Написати падаючі тести сервера й переносу CSS**

`tests/static-server.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFile, startStaticServer } from '../scripts/lib/static-server.mjs';

const root = mkdtempSync(join(tmpdir(), 'hob-serve-'));
mkdirSync(join(root, 'ministries'));
writeFileSync(join(root, 'index.html'), 'home');
writeFileSync(join(root, 'ministries/index.html'), 'list');
writeFileSync(join(root, 'ministry.dc.html'), 'legacy');
process.on('exit', () => rmSync(root, { recursive: true, force: true }));

test('каталог віддає index.html, query і hash відкидаються', () => {
  assert.equal(resolveFile(root, '/'), join(root, 'index.html'));
  assert.equal(resolveFile(root, '/ministries/'), join(root, 'ministries/index.html'));
  // Легасі-деталі живуть на ?id= — той самий файл для будь-якого id.
  assert.equal(resolveFile(root, '/ministry.dc.html?id=youth'), join(root, 'ministry.dc.html'));
  assert.equal(resolveFile(root, '/%D0%B0.html'), null);
});

test('вихід за корінь і неіснуючий файл — null', () => {
  assert.equal(resolveFile(root, '/../../etc/passwd'), null);
  assert.equal(resolveFile(root, '/nope/'), null);
});

test('сервер віддає файл із типом і 404 на відсутній', async () => {
  const site = await startStaticServer(root);
  try {
    const ok = await fetch(`${site.origin}/ministries/`);
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type'), /text\/html/);
    assert.equal(await ok.text(), 'list');
    assert.equal((await fetch(`${site.origin}/nope.css`)).status, 404);
  } finally {
    await site.close();
  }
});
```

`tests/port-css.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portCss } from '../scripts/port-legacy-css.mjs';

const legacy = [
  '<style>',                                                              // 1
  '.eyebrow{margin:0}',                                                   // 2
  '.lang-toggle{display:inline-flex}',                                    // 3
  '.lang-toggle button{border:none;font-size:.8rem;',                     // 4
  '  min-height:34px}',                                                   // 5
  '.lang-toggle button.is-active{background:#fff}',                       // 6
  '.slider{overflow:hidden}',                                             // 7
  '.slider-stage{aspect-ratio:16/10}',                                    // 8
  '.slide.is-active{opacity:1}',                                          // 9
  '.gal-arrow:hover{background:#fff}',                                    // 10
  '.info{display:block}',                                                 // 11
  '</style>',                                                             // 12
].join('\n');

test('бере рівно вказані рядки і пише походження', () => {
  const { css } = portCss(legacy, { from: 11, to: 11, origin: 'x.dc.html' });
  assert.equal(css, '/* Перенесено з x.dc.html, рядки 11–11. @font-face, :root і базові правила — у fonts/tokens/base.css. */\n.info{display:block}\n');
});

test('кнопки перемикача мов стають посиланнями з поведінкою кнопки', () => {
  const { css } = portCss(legacy, { from: 3, to: 6, origin: 'x' });
  assert.match(css, /\.lang-toggle a\{border:none;font-size:\.8rem;\n {2}min-height:34px;display:inline-flex;align-items:center;justify-content:center;line-height:normal\}/);
  assert.match(css, /\.lang-toggle a:hover\{color:rgba\(255,255,255,\.7\)\}/);
  assert.match(css, /\.lang-toggle a\.is-active,\.lang-toggle a\.is-active:hover\{background:#fff\}/);
  assert.doesNotMatch(css, /button/);
});

test('правила галереї вирізаються, решта лишається', () => {
  const { css, removed } = portCss(legacy, { from: 7, to: 11, origin: 'x', stripGallery: true });
  assert.equal(removed, 4);
  assert.doesNotMatch(css, /slide|gal-arrow/);
  assert.match(css, /\.info\{display:block\}/);
});

test('перевизначення --maxw і ресет ul додаються на початок', () => {
  const { css } = portCss(legacy, { from: 11, to: 11, origin: 'x', maxw: '1200px', keepUl: true });
  assert.match(css, /\*\/\n:root\{--maxw:1200px\}\nul\{margin:0;padding:0;list-style:none\}\n\.info/);
});
```

- [ ] **Step 3: Переконатися, що падають**

Run: `node --test tests/static-server.test.js tests/port-css.test.js`
Expected: FAIL — модулі не знайдено

- [ ] **Step 4: Реалізувати сервер і перенос CSS**

`scripts/lib/static-server.mjs`:

```js
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

// Query і hash відкидаються: легасі-деталі — один файл на всі ?id=.
// «/каталог/» → index.html, як на GitHub Pages і Apache.
export function resolveFile(root, urlPath) {
  const base = resolve(root);
  const pathname = decodeURIComponent(urlPath.split(/[?#]/)[0]);
  const abs = join(base, normalize(pathname).replace(/^[/\\]+/, ''));
  if (abs !== base && !abs.startsWith(base + sep)) return null;
  try {
    if (statSync(abs).isDirectory()) {
      const index = join(abs, 'index.html');
      statSync(index);
      return index;
    }
    return abs;
  } catch {
    return null;
  }
}

export function startStaticServer(root, port = 0) {
  const server = createServer((req, res) => {
    const file = resolveFile(root, req.url);
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => done({
      origin: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((closed) => server.close(closed)),
    }));
  });
}
```

`scripts/port-legacy-css.mjs`:

```js
// Переносить <style> легасі-сторінки в src/styles/pages/*.css дослівно.
// Скрипт, а не руки: 10 файлів по сотні рядків — гарантовані одруки, а
// піксельне порівняння ловить їх лише post factum. Видаляється разом із
// легасі в кутовері (Задача 15).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Правила галереї, що переїжджають у src/styles/gallery.css. У легасі кожне
// — один рядок, тож вирізаємо порядково.
const GALLERY_RULE =
  /^\.(gallery|gallery-stage|gal-arrow|slider|slider-stage|slider-arrow|slide|dots|thumbs)[ .:{].*$\n?/gm;

export function portCss(source, { from, to, origin, maxw = null, keepUl = false, stripGallery = false }) {
  let css = source.split('\n').slice(from - 1, to).join('\n');

  // Перемикач мов тепер посилання (Спека 2). Три додані властивості
  // відтворюють те, що кнопці дає браузер: центрування вмісту,
  // line-height:normal (інакше +0.6px висоти) і відсутність кольору
  // при наведенні (глобальне a:hover інакше перефарбувало б текст).
  css = css.replace(/\.lang-toggle button\{([^}]*)\}/g, (_, body) =>
    `.lang-toggle a{${body.trimEnd()};display:inline-flex;align-items:center;justify-content:center;line-height:normal}\n`
    + '.lang-toggle a:hover{color:rgba(255,255,255,.7)}');
  css = css.replace(/\.lang-toggle button\.is-active\{/g, '.lang-toggle a.is-active,.lang-toggle a.is-active:hover{');

  let removed = 0;
  if (stripGallery) {
    css = css.replace(GALLERY_RULE, () => {
      removed += 1;
      return '';
    });
  }

  const head = [
    `/* Перенесено з ${origin}, рядки ${from}–${to}. @font-face, :root і базові правила — у fonts/tokens/base.css. */`,
    maxw && `:root{--maxw:${maxw}}`,
    keepUl && 'ul{margin:0;padding:0;list-style:none}',
  ].filter(Boolean);
  return { css: `${head.join('\n')}\n${css.replace(/\s+$/, '')}\n`, removed };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, from, to, out, ...flags] = process.argv.slice(2);
  const flag = (name) => flags.includes(name);
  const maxwAt = flags.indexOf('--maxw');
  const { css, removed } = portCss(readFileSync(file, 'utf8').replace(/\r\n?/g, '\n'), {
    from: Number(from),
    to: Number(to),
    origin: file,
    maxw: maxwAt === -1 ? null : flags[maxwAt + 1],
    keepUl: flag('--keep-ul'),
    stripGallery: flag('--strip-gallery'),
  });
  writeFileSync(out, css);
  console.log(`${out}: ${css.split('\n').length} рядків${flag('--strip-gallery') ? `, правил галереї вирізано: ${removed}` : ''}`);
}
```

- [ ] **Step 5: Переконатися, що тести проходять**

Run: `node --test tests/static-server.test.js tests/port-css.test.js`
Expected: PASS, 7 тестів

- [ ] **Step 6: Піксельне порівняння**

`scripts/visual/routes.mjs`:

```js
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const slugs = (collection) =>
  readdirSync(fileURLToPath(new URL(`../../src/content/${collection}`, import.meta.url)))
    .filter((f) => f.endsWith('.json') && !f.startsWith('__'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();

export const LANGS = ['uk', 'en'];
export const VIEWPORTS = [
  { name: 'desktop', size: { width: 1440, height: 900 } },
  { name: 'mobile', size: { width: 390, height: 844 } },
];

// Маска — лише для навмисної відмінності з таблиці рішень плану Етапу 2.
// Маска «щоб пройшло» — прихована регресія: кожен рядок несе причину.
export const GLOBAL_MASK = [
  'iframe', // карта Google, відео YouTube — сторонній вміст, що змінюється сам
  '.fb-page', // стрічка Facebook — те саме
];
const CARD_IMAGE = '.min-thumb img'; // рішення 7: фото картки з media[], а не окремий URL picsum
const MORE_IMAGE = '.more-card img'; // те саме для «Інші служіння»
const VIDEO_THUMB = '.thumbs button:has(.play) img'; // рішення 6: мініатюра відео з YouTube

// Головна порівнюється по секціях: навмисна зміна висоти однієї секції
// (рішення 11, <cite> на англійській) інакше «зсунула» б усе нижче.
const HOME_SECTIONS = [
  ['header', '.site-header'], ['hero', '#home'], ['about', '#about'], ['media', '#media'],
  ['union', '#union'], ['testimonies', 'section.testimonies'], ['ministries', '#ministries'],
  ['pastors', '#pastors'], ['contacts', '#contacts'], ['donate', '#donate'], ['footer', '.site-footer'],
];

export function routes() {
  return [
    {
      name: 'home', legacy: 'index.html', next: '', sections: HOME_SECTIONS, mask: [CARD_IMAGE],
      maskEn: [
        '.news-more', // рішення 11: стрілка тепер і на англійській
        '.tst-avatar', // англійська літера імені (Olena → O), легасі лишав кириличну
        '.tst-card:has(.tst-video) .tst-person', // рішення 14: англійська роль відеосвідчення
        '.tst-video .vlabel', // англійський підпис «Video Testimony» (у легасі — лише в testimonies.dc.html)
      ],
      known: { 'donate:en': 'рішення 11: англійська секція отримала <cite> вірша, якого легасі не показував' },
    },
    { name: 'ministries', legacy: 'ministries.dc.html', next: 'ministries/', mask: [CARD_IMAGE] },
    { name: 'churches', legacy: 'churches.dc.html', next: 'churches/' },
    { name: 'projects', legacy: 'projects.dc.html', next: 'projects/' },
    { name: 'testimonies', legacy: 'testimonies.dc.html', next: 'testimonies/' },
    { name: 'pastors', legacy: 'pastors.dc.html', next: 'pastors/' },
    { name: 'leaders', legacy: 'leaders.dc.html', next: 'leaders/' },
    ...slugs('ministries').map((s) => ({
      name: `ministry-${s}`, legacy: `ministry.dc.html?id=${s}`, next: `ministries/${s}/`, mask: [MORE_IMAGE, VIDEO_THUMB],
    })),
    ...slugs('churches').map((s) => ({
      name: `church-${s}`, legacy: `church.dc.html?id=${s}`, next: `churches/${s}/`, mask: [VIDEO_THUMB],
    })),
    ...slugs('projects').map((s) => ({
      name: `project-${s}`, legacy: `project.dc.html?id=${s}`, next: `projects/${s}/`, mask: [VIDEO_THUMB],
    })),
  ];
}
```

`scripts/visual/run.mjs`:

```js
// Піксельне порівняння легасі з новою збіркою: головний контроль «дизайн
// переноситься 1:1» (Спека 1, «Перевірка»). Видаляється разом із легасі.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';
import { startStaticServer } from '../lib/static-server.mjs';
import { GLOBAL_MASK, LANGS, VIEWPORTS, routes } from './routes.mjs';

const { PNG } = pngjs;
const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = join(root, '.visual');
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt === -1 ? null : process.argv[onlyAt + 1];
// 0.1% пікселів: вистачає на субпіксельне згладжування, але не на зсув
// рядка тексту чи інший колір кнопки.
const MAX_RATIO = 0.001;

async function load(context, url) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  // Сторінки може ще не бути (404 без <main>) — тоді порівняння дасть FAIL
  // за розміром, а не впаде весь прогін на таймауті.
  await page.locator('main').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  // Ліниві картинки нижче першого екрана інакше не завантажуються ніколи:
  // знімок повної сторінки не прокручує її.
  await page.evaluate(() => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager';
  });
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}

async function capture(page, route, mask) {
  const options = { animations: 'disabled', maskColor: '#ff00ff', mask: mask.map((s) => page.locator(s)) };
  if (!route.sections) return { page: PNG.sync.read(await page.screenshot({ ...options, fullPage: true })) };
  const shots = {};
  for (const [name, selector] of route.sections) {
    const el = page.locator(selector).first();
    shots[name] = (await el.count()) ? PNG.sync.read(await el.screenshot(options)) : null;
  }
  return shots;
}

function compare(id, a, b, dir) {
  if (!a || !b) return { id, ok: false, reason: `секції немає на ${a ? 'новій' : 'легасі'} сторінці` };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'legacy.png'), PNG.sync.write(a));
  writeFileSync(join(dir, 'next.png'), PNG.sync.write(b));
  if (a.width !== b.width || a.height !== b.height) {
    return { id, ok: false, reason: `розмір ${a.width}×${a.height} проти ${b.width}×${b.height}` };
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  writeFileSync(join(dir, 'diff.png'), PNG.sync.write(diff));
  const ratio = pixels / (a.width * a.height);
  return { id, ok: ratio <= MAX_RATIO, reason: `${(ratio * 100).toFixed(3)}% пікселів` };
}

rmSync(outDir, { recursive: true, force: true });
const legacy = await startStaticServer(root);
const next = await startStaticServer(join(root, 'dist'));
const browser = await chromium.launch();
const report = [];

for (const route of routes().filter((r) => !only || r.name.startsWith(only))) {
  for (const lang of LANGS) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: vp.size, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      // Легасі вмикає англійську з localStorage; нова збірка його не читає.
      if (lang === 'en') {
        await context.addInitScript(() => {
          try { localStorage.setItem('hob-lang', 'en'); } catch { /* about:blank без сховища */ }
        });
      }
      const mask = [...GLOBAL_MASK, ...(route.mask ?? []), ...(lang === 'en' ? route.maskEn ?? [] : [])];
      const a = await capture(await load(context, `${legacy.origin}/${route.legacy}`), route, mask);
      const b = await capture(await load(context, `${next.origin}/${lang === 'en' ? 'en/' : ''}${route.next}`), route, mask);
      await context.close();

      for (const part of Object.keys(a)) {
        const id = route.sections ? `${route.name}-${part}-${lang}-${vp.name}` : `${route.name}-${lang}-${vp.name}`;
        const result = compare(id, a[part], b[part], join(outDir, id));
        const known = route.known?.[`${part}:${lang}`];
        if (!result.ok && known) Object.assign(result, { ok: true, known });
        report.push(result);
        console.log(`${result.known ? 'KNOWN' : result.ok ? 'OK   ' : 'FAIL '} ${id} — ${result.known ?? result.reason}`);
      }
    }
  }
}

await browser.close();
await legacy.close();
await next.close();
writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
const failed = report.filter((r) => !r.ok);
console.log(`\n${report.length - failed.length}/${report.length} OK. Знімки й різниця: .visual/<id>/`);
process.exit(failed.length ? 1 : 0);
```

`tests/e2e/helpers.js`:

```js
import { before, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startStaticServer } from '../../scripts/lib/static-server.mjs';

// Одна збірка (npm run e2e робить astro build з base «/»), один браузер
// на файл тестів; кожен тест відкриває свою сторінку.
export function useSite() {
  const site = {};
  before(async () => {
    site.server = await startStaticServer(fileURLToPath(new URL('../../dist', import.meta.url)));
    site.browser = await chromium.launch();
  });
  after(async () => {
    await site.browser?.close();
    await site.server?.close();
  });
  site.open = async (path, { viewport = { width: 1440, height: 900 } } = {}) => {
    const page = await site.browser.newPage({ viewport });
    await page.goto(`${site.server.origin}/${path}`, { waitUntil: 'load' });
    return page;
  };
  return site;
}
```

- [ ] **Step 7: Димовий прогін порівняння**

Run: `npm run visual -- --only ministries`
Expected: скрипт завершується з кодом 1, у виводі 4 рядки `FAIL ministries-…` (сторінки `/ministries/` ще немає — друга сторона знімає 404), існує `.visual/report.json`. Це доводить, що інструмент працює й падає на різниці.

- [ ] **Step 8: Повний прогін і коміт**

Run: `npm test`
Expected: PASS

```bash
git add package.json package-lock.json .gitignore scripts tests
git commit -m "chore: статичний сервер, перенос CSS і піксельне порівняння з легасі

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 4: каркас підсторінок і `/ministries/`

Перша справжня сторінка тягне за собою весь спільний каркас: ужатий `base.css`, шапку й футер підсторінки, перемикач мов, іконки і наскрізні тести сайту, які далі автоматично покривають кожну нову сторінку.

**Files:**
- Modify: `src/styles/base.css`, `src/i18n/uk.json`, `src/i18n/en.json`
- Create: `public/uploads/logo.png`, `public/uploads/hero-cross.jpg`, `public/uploads/hero-cross-mobile.jpg` (копії)
- Create: `src/layouts/SubPage.astro`, `src/components/SubHeader.astro`, `src/components/SubFooter.astro`, `src/components/LangSwitch.astro`, `src/components/Icon.astro`
- Create: `src/styles/pages/ministries.css`, `src/pages/[...lang]/ministries/index.astro`
- Create: `tests/helpers/dist.js`, `tests/helpers/links.js`
- Test: `tests/site.test.js`, `tests/page-ministries.test.js`

**Interfaces:**
- Consumes: усе з Задачі 1; `portCss` CLI із Задачі 3.
- Produces: `<SubPage lang title path back={{href,label}} footBack={{href,label}}>` — Base + шапка + `<main>` + футер підсторінки.
- Produces: `<LangSwitch lang path style?>` — `.lang-toggle` з двома `<a hreflang>`; `path` — шлях сторінки без локалі (`/ministries/youth/`).
- Produces: `<Icon set="ministry"|"resource" name>`.
- Produces: ключі `a11y.*` в обох словниках (перелік у Step 4).
- Produces: `tests/helpers/dist.js` → `distDir`, `distPath(rel)`, `loadPage(rel)`, `href(pathWithoutBase)`; `tests/helpers/links.js` → `htmlFiles(dir)`, `pageUrl(dir, file, base)`, `findBrokenLinks(dir, base)`.

- [ ] **Step 1: Написати падаючі тести сайту і сторінки**

`tests/helpers/dist.js`:

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { BASE_PATH } from '../../astro.config.mjs';

export const distDir = fileURLToPath(new URL('../../dist/', import.meta.url));
export const distPath = (rel) => fileURLToPath(new URL(`../../dist/${rel}`, import.meta.url));
export const loadPage = (rel) => parse(readFileSync(distPath(rel), 'utf8'));
// Очікуваний href — з того самого BASE_PATH, що пішов у збірку.
export const href = (path) => `${BASE_PATH}${path.replace(/^\//, '')}`;
```

`tests/helpers/links.js`:

```js
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { parse } from 'node-html-parser';

export function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(abs);
    return entry.name.endsWith('.html') ? [abs] : [];
  });
}

// dist/en/ministries/youth/index.html → <base>en/ministries/youth/
export const pageUrl = (dir, file, base) =>
  base + relative(dir, file).split(sep).join('/').replace(/index\.html$/, '');

const EXTERNAL = /^(?:[a-z][a-z+.-]*:|\/\/)/i; // https:, mailto:, tel:, //cdn

export function internalRefs(root) {
  return [
    ...root.querySelectorAll('a[href], link[href]').map((el) => el.getAttribute('href')),
    ...root.querySelectorAll('img[src], script[src], iframe[src]').map((el) => el.getAttribute('src')),
    ...root.querySelectorAll('source[srcset]').map((el) => el.getAttribute('srcset')),
  ].filter((ref) => ref && !ref.startsWith('#') && !EXTERNAL.test(ref));
}

// Кожне внутрішнє посилання й ресурс мусять вести на файл, що є у збірці,
// і лежати під base. Шлях без base локально працює, а на GitHub Pages — 404.
export function findBrokenLinks(dir, base) {
  const problems = [];
  for (const file of htmlFiles(dir)) {
    const from = pageUrl(dir, file, base);
    for (const ref of internalRefs(parse(readFileSync(file, 'utf8')))) {
      const { pathname } = new URL(ref, `http://site.test${from}`);
      if (!pathname.startsWith(base)) {
        problems.push(`${from}: ${ref} — поза base ${base}`);
        continue;
      }
      const rel = decodeURIComponent(pathname.slice(base.length));
      const target = join(dir, rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel);
      if (!existsSync(target)) problems.push(`${from}: ${ref} → немає ${relative(dir, target)}`);
    }
  }
  return problems;
}
```

`tests/site.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { BASE_PATH } from '../astro.config.mjs';
import { distDir, distPath, loadPage } from './helpers/dist.js';
import { findBrokenLinks, htmlFiles, pageUrl } from './helpers/links.js';

const pages = htmlFiles(distDir).map((file) => {
  const url = pageUrl(distDir, file, BASE_PATH);
  const rel = url.slice(BASE_PATH.length);
  return { file, url, rel, lang: rel.startsWith('en/') || rel === 'en/' ? 'en' : 'uk', root: parse(readFileSync(file, 'utf8')) };
});

// Головна переноситься в Задачі 11; до того це каркас Етапу 0 без перемикача.
// Задача 11 видаляє цей набір.
const PENDING = new Set(['', 'en/']);

test('кожне внутрішнє посилання й ресурс ведуть на наявний файл', () => {
  assert.deepEqual(findBrokenLinks(distDir, BASE_PATH), []);
});

test('жодного посилання на легасі-адреси', () => {
  for (const { url, root } of pages) {
    for (const a of root.querySelectorAll('a[href]')) {
      assert.doesNotMatch(a.getAttribute('href'), /\.dc\.html|(^|\/)index\.html/, `${url}: ${a.getAttribute('href')}`);
    }
  }
});

test('lang у <html> відповідає префіксу адреси', () => {
  for (const { url, lang, root } of pages) {
    assert.equal(root.querySelector('html').getAttribute('lang'), lang, url);
  }
});

test('перемикач мов веде на ту саму сторінку іншою мовою', () => {
  for (const { url, rel, lang, root } of pages) {
    if (PENDING.has(rel)) continue;
    const neutral = lang === 'en' ? rel.slice('en/'.length) : rel;
    const toggles = root.querySelectorAll('.lang-toggle');
    assert.ok(toggles.length > 0, `${url}: немає перемикача мов`);
    for (const toggle of toggles) {
      assert.equal(toggle.querySelector('a[hreflang="uk"]').getAttribute('href'), `${BASE_PATH}${neutral}`, url);
      assert.equal(toggle.querySelector('a[hreflang="en"]').getAttribute('href'), `${BASE_PATH}en/${neutral}`, url);
      assert.equal(toggle.querySelector('a.is-active').getAttribute('hreflang'), lang, `${url}: активна не та мова`);
    }
  }
});

test('англійські сторінки не ведуть на українські', () => {
  for (const { url, lang, root } of pages) {
    if (lang !== 'en') continue;
    for (const a of root.querySelectorAll('a[href]')) {
      if (a.getAttribute('hreflang') === 'uk') continue; // перемикач мов — єдиний дозволений вихід
      const ref = a.getAttribute('href');
      if (ref.startsWith('#') || /^[a-z]+:/i.test(ref)) continue;
      const { pathname } = new URL(ref, `http://site.test${url}`);
      assert.ok(pathname.startsWith(`${BASE_PATH}en/`), `${url}: ${ref} мовчки перемикає на українську`);
    }
  }
});

test('немає localStorage і автоперенаправлення за мовою', () => {
  // Спека 2: автоперехід за збереженою мовою — блокер індексації en.
  const assets = readdirSync(join(distDir, '_astro')).filter((f) => f.endsWith('.js'));
  for (const text of [...pages.map((p) => readFileSync(p.file, 'utf8')), ...assets.map((f) => readFileSync(join(distDir, '_astro', f), 'utf8'))]) {
    assert.doesNotMatch(text, /localStorage|hob-lang/);
  }
});

test('стилі сторінки підключаються після спільних — перевизначення :root виграє', () => {
  // Рішення 4: на пʼяти сторінках --maxw:1200px. Якщо CSS сторінки прийде
  // раніше за tokens.css, переможе 1360px, і контейнер тихо розшириться.
  const css = loadPage('ministries/index.html')
    .querySelectorAll('link[rel="stylesheet"]')
    .map((link) => readFileSync(distPath(link.getAttribute('href').slice(BASE_PATH.length)), 'utf8'))
    .join('\n');
  const shared = css.indexOf('--maxw:1360px');
  const own = css.lastIndexOf('--maxw:1200px');
  assert.ok(shared !== -1 && own !== -1, 'не знайдено одного з --maxw');
  assert.ok(shared < own, 'токени підключені після стилів сторінки');
});

test('жодного <style> у .astro — стилі лише глобальними файлами', () => {
  const src = fileURLToPath(new URL('../src', import.meta.url));
  const astroFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? astroFiles(join(dir, e.name)) : e.name.endsWith('.astro') ? [join(dir, e.name)] : []);
  for (const file of astroFiles(src)) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /<style[\s>]/, `${file}: scoped-стилі змінюють специфічність легасі`);
  }
});
```

`tests/page-ministries.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages } from './helpers/content.js';

const ministries = readCollection('ministries').map(({ data }) => data).sort((a, b) => a.order - b.order);
const page = readPages().ministries;
const LOCALES = [['uk', ''], ['en', 'en/']];

test('/ministries/ показує всі служіння в порядку order з посиланнями на деталі', () => {
  for (const [lang, prefix] of LOCALES) {
    const cards = loadPage(`${prefix}ministries/index.html`).querySelectorAll('.min-card');
    assert.equal(cards.length, ministries.length, lang);
    cards.forEach((card, i) => {
      assert.equal(card.getAttribute('href'), href(`${prefix}ministries/${ministries[i].slug}/`));
      assert.equal(card.querySelector('h3').text, ministries[i].name[lang]);
      assert.equal(card.querySelector('.min-body p').text, ministries[i].summary[lang]);
      assert.ok(card.querySelector('.icon svg path, .icon svg circle, .icon svg rect'), `${ministries[i].slug}: без іконки`);
    });
  }
});

test('герой сторінки й лічильник беруться з даних обома мовами', () => {
  const root = loadPage('ministries/index.html');
  assert.equal(root.querySelector('.page-hero h1').text, page.title.uk);
  assert.equal(root.querySelector('.page-hero .eyebrow').text, page.eyebrow.uk);
  assert.equal(root.querySelector('.hero-count span').text, `${ministries.length} напрямків служіння`);
  assert.equal(loadPage('en/ministries/index.html').querySelector('.hero-count span').text, `${ministries.length} ministry areas`);
});

test('«назад» у шапці веде на секцію служінь головної тієї ж мови', () => {
  // Рішення 9: якір замість sessionStorage-повернення легасі.
  assert.equal(loadPage('ministries/index.html').querySelector('.back-link').getAttribute('href'), href('#ministries'));
  assert.equal(loadPage('en/ministries/index.html').querySelector('.back-link').getAttribute('href'), href('en/#ministries'));
  assert.equal(loadPage('en/ministries/index.html').querySelector('.site-footer a').getAttribute('href'), href('en/'));
});
```

- [ ] **Step 2: Переконатися, що падають**

Run: `npm test`
Expected: FAIL — `ENOENT … dist/ministries/index.html`; у `site.test.js` падає тест порядку стилів (сторінки ще немає).

- [ ] **Step 3: Ужати `base.css` і скопіювати зображення**

`src/styles/base.css` — повністю замінити на правила, що присутні на **всіх** десяти легасі-сторінках:

```css
/* Лише правила, спільні для всіх 10 легасі-сторінок. Утиліти головної
   (ul, .section-title, .lead, .btn*, .reveal*) живуть у pages/home.css:
   на підсторінках їх немає, а .btn{font-size:1rem} змінив би кнопки деталок. */
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text-primary);font-family:var(--font-body);
  font-size:clamp(1rem,.97rem + .2vw,1.125rem);line-height:1.7;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;display:block}
a{color:var(--ink-blue);text-decoration:none;transition:color .2s var(--ease)}
a:hover{color:var(--text-primary)}
h1,h2,h3,h4{font-family:var(--font-display);font-weight:700;line-height:1.15;margin:0;color:var(--text-primary);text-wrap:balance}
button{font-family:inherit}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:4px}
.container{width:100%;max-width:var(--maxw);margin-inline:auto;padding-inline:clamp(1.25rem,4vw,2.5rem)}
.eyebrow{font-family:var(--font-body);font-weight:600;font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;
  color:var(--text-primary);margin:0 0 1rem}
```

Перевірити, що кожне правило справді є на всіх сторінках (порівняння без пробілів):

```bash
node -e "
const fs = require('fs');
const squash = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, '');
const rules = squash(fs.readFileSync('src/styles/base.css', 'utf8')).match(/[^{}]+\{[^{}]*\}/g);
for (const f of ['index.html', ...fs.readdirSync('.').filter((f) => f.endsWith('.dc.html'))]) {
  const css = squash(fs.readFileSync(f, 'utf8').split('<style>')[1].split('</style>')[0]);
  const missing = rules.filter((r) => !css.includes(r));
  console.log(f, missing.length ? 'БРАКУЄ: ' + missing.join(' ') : 'ok');
}"
```

Expected: 10 рядків `ok`.

```bash
mkdir -p public/uploads
cp uploads/logo.png uploads/hero-cross.jpg uploads/hero-cross-mobile.jpg public/uploads/
```

(Корінні `uploads/` потрібні легасі до Задачі 15, тому копія, а не переміщення.)

- [ ] **Step 4: Додати підписи доступності в словники**

У `src/i18n/uk.json` перед фінальною `}` додати (після `"testimony": {…}`, з комою):

```json
  "a11y": {
    "mainNav": "Головна навігація",
    "openMenu": "Відкрити меню",
    "mobileMenu": "Мобільне меню",
    "closeMenu": "Закрити меню",
    "mobileNav": "Мобільна навігація",
    "donationAmount": "Сума пожертви, грн",
    "scrollDown": "Прокрутити вниз",
    "prevTestimony": "Попереднє свідчення",
    "nextTestimony": "Наступне свідчення",
    "mapTitle": "Карта — House of Bread Church",
    "breadcrumbs": "Хлібні крихти",
    "galleryPrev": "Попередній слайд",
    "galleryNext": "Наступний слайд",
    "slide": "Слайд",
    "email": "Ел. пошта",
    "phone": "Телефон",
    "video": "відео",
    "churchVideo": "Відео церкви",
    "projectVideo": "Відео проєкту"
  }
```

У `src/i18n/en.json` — те саме місце:

```json
  "a11y": {
    "mainNav": "Main navigation",
    "openMenu": "Open menu",
    "mobileMenu": "Mobile menu",
    "closeMenu": "Close menu",
    "mobileNav": "Mobile navigation",
    "donationAmount": "Donation amount, UAH",
    "scrollDown": "Scroll down",
    "prevTestimony": "Previous testimony",
    "nextTestimony": "Next testimony",
    "mapTitle": "Map — House of Bread Church",
    "breadcrumbs": "Breadcrumbs",
    "galleryPrev": "Previous slide",
    "galleryNext": "Next slide",
    "slide": "Slide",
    "email": "Email",
    "phone": "Phone",
    "video": "video",
    "churchVideo": "Church video",
    "projectVideo": "Project video"
  }
```

- [ ] **Step 5: Компоненти каркаса**

`src/components/LangSwitch.astro`:

```astro
---
import { localePath } from '../lib/paths.mjs';

interface Props {
  lang: 'uk' | 'en';
  // Шлях сторінки без локалі: «/ministries/youth/». Перемикач веде на той
  // самий шлях іншою мовою — а не на головну (Спека 2).
  path: string;
  style?: string;
}

const { lang, path, style } = Astro.props;
const base = import.meta.env.BASE_URL;
const items = [
  { code: 'uk', label: 'UA' },
  { code: 'en', label: 'EN' },
] as const;
---
<div class="lang-toggle" role="group" aria-label="Мова / Language" style={style}>
  {items.map(({ code, label }) => (
    <a
      href={localePath(base, code, path)}
      hreflang={code}
      lang={code}
      class:list={[{ 'is-active': code === lang }]}
      aria-current={code === lang ? 'page' : undefined}
    >{label}</a>
  ))}
</div>
```

`src/components/SubHeader.astro`:

```astro
---
import { getEntry } from 'astro:content';
import LangSwitch from './LangSwitch.astro';
import { pick } from '../i18n';
import { assetUrl, localePath } from '../lib/paths.mjs';
import { BACK } from '../lib/svg.mjs';

interface Props {
  lang: 'uk' | 'en';
  path: string;
  back: { href: string; label: string };
}

const { lang, path, back } = Astro.props;
const base = import.meta.env.BASE_URL;
const settings = (await getEntry('site-settings', 'main'))!.data;
---
<header class="site-header">
  <div class="header-inner">
    <a href={localePath(base, lang, '/')} class="brand" aria-label="House of Bread Church">
      <img src={assetUrl(base, settings.logo)} alt={pick(settings.name, lang)} class="brand-logo">
    </a>
    <div class="header-actions">
      <a href={back.href} class="back-link">
        <Fragment set:html={BACK} />
        <span>{back.label}</span>
      </a>
      <LangSwitch lang={lang} path={path} />
    </div>
  </div>
</header>
```

`src/components/SubFooter.astro`:

```astro
---
import { t } from '../i18n';

interface Props {
  lang: 'uk' | 'en';
  back: { href: string; label: string };
}

const { lang, back } = Astro.props;
---
<footer class="site-footer">
  <div class="container">
    <span>{t(lang, 'foot.rights')}</span>
    <a href={back.href}>{back.label}</a>
  </div>
</footer>
```

`src/layouts/SubPage.astro`:

```astro
---
import Base from './Base.astro';
import SubHeader from '../components/SubHeader.astro';
import SubFooter from '../components/SubFooter.astro';

interface Props {
  lang: 'uk' | 'en';
  title: string;
  path: string;
  back: { href: string; label: string };
  footBack: { href: string; label: string };
}

const { lang, title, path, back, footBack } = Astro.props;
---
<Base lang={lang} title={title}>
  <SubHeader lang={lang} path={path} back={back} />
  <main>
    <slot />
  </main>
  <SubFooter lang={lang} back={footBack} />
</Base>
```

`src/components/Icon.astro`:

```astro
---
import { MINISTRY_ICON_PATHS, RESOURCE_ICON_PATHS } from '../lib/icons.mjs';

interface Props {
  set: 'ministry' | 'resource';
  name: string;
}

const { set, name } = Astro.props;
const paths = (set === 'ministry' ? MINISTRY_ICON_PATHS : RESOURCE_ICON_PATHS)[name];
// Схема вже відкидає невідомі назви; це друга лінія — на випадок, якщо
// хтось передасть іконку не з даних.
if (!paths) throw new Error(`невідома іконка ${set}: ${name}`);
---
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" set:html={paths}></svg>
```

- [ ] **Step 6: Перенести CSS і зібрати сторінку**

```bash
node scripts/port-legacy-css.mjs ministries.dc.html 40 88 src/styles/pages/ministries.css --maxw 1200px
```

Expected: `src/styles/pages/ministries.css: … рядків`; у файлі немає слова `button` у правилах `.lang-toggle`.

`src/pages/[...lang]/ministries/index.astro`:

```astro
---
import { getCollection, getEntry } from 'astro:content';
import SubPage from '../../../layouts/SubPage.astro';
import Icon from '../../../components/Icon.astro';
import { t, pick } from '../../../i18n';
import { localePath, localeParams } from '../../../lib/paths.mjs';
import { sortedData, coverImage } from '../../../lib/collections.mjs';
import { ARROW } from '../../../lib/svg.mjs';
import '../../../styles/pages/ministries.css';

export function getStaticPaths() {
  return localeParams();
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const page = (await getEntry('pages', 'ministries'))!.data;
const ministries = sortedData(await getCollection('ministries'));
const home = localePath(base, lang, '/');
---
<SubPage
  lang={lang}
  title={pick(page.title, lang)}
  path="/ministries/"
  back={{ href: localePath(base, lang, '/#ministries'), label: t(lang, 'back.home') }}
  footBack={{ href: home, label: t(lang, 'footBack.home') }}
>
<section class="page-hero">
  <div class="container">
    <span class="hero-count" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg><span>{ministries.length}{t(lang, 'listCount.ministries')}</span></span>
    <p class="eyebrow">{pick(page.eyebrow, lang)}</p>
    <h1>{pick(page.title, lang)}</h1>
    <p>{pick(page.lead, lang)}</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="min-grid">
      {ministries.map((m) => (
        <a class="min-card" href={localePath(base, lang, `/ministries/${m.slug}/`)}>
          <div class="min-thumb"><img loading="lazy" src={coverImage(m.media).src} alt={pick(m.name, lang)}>
            <span class="icon" aria-hidden="true"><Icon set="ministry" name={m.icon} /></span>
          </div>
          <div class="min-body">
            <h3>{pick(m.name, lang)}</h3>
            <p>{pick(m.summary, lang)}</p>
            <div class="min-foot"><span class="min-go">{t(lang, 'card.readMore')} <Fragment set:html={ARROW} /></span></div>
          </div>
        </a>
      ))}
    </div>
  </div>
</section>
</SubPage>
```

Якщо Astro відкидає rest-параметр не в кінці шляху (`[...lang]/ministries/…`): замінити на пару файлів `src/pages/ministries/index.astro` і `src/pages/en/ministries/index.astro`, які обидва рендерять `src/views/MinistriesList.astro` з `lang` у пропсах, і так само для кожного наступного маршруту. Зафіксувати це рішення в таблиці рішень плану до переходу до Задачі 5.

- [ ] **Step 7: Тести**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Піксельне порівняння**

Run: `npm run visual -- --only ministries`
Expected: 4 рядки `OK   ministries-{uk,en}-{desktop,mobile}`, код 0. Якщо FAIL — відкрити `.visual/<id>/diff.png`; типові причини: відступ у `hero-count` (пробіл між числом і текстом — з `listCount`, де пробіл уже на початку), висота перемикача мов (Задача 3, `line-height`).

- [ ] **Step 9: Коміт**

```bash
git add src public/uploads tests
git commit -m "feat: каркас підсторінок і /ministries/ обома мовами

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 5: галерея в один компонент і `/ministries/<slug>/`

**Files:**
- Create: `src/components/Gallery.astro`, `src/styles/gallery.css`, `src/components/Crumbs.astro`
- Create: `src/styles/pages/ministry.css`, `src/pages/[...lang]/ministries/[slug].astro`
- Test: `tests/page-ministries.test.js` (доповнити), `tests/e2e/gallery.e2e.js`

**Interfaces:**
- Consumes: `ytId`, `ytThumb`, `ytEmbed`, `nextCyclic`, `coverImage`, `telHref`, `SubPage`, `Icon`.
- Produces: `<Gallery lang media={mediaItem[]} videoTitle={string}>` — корінь `[data-gallery]` з `.gallery` і `.thumbs`; слайд 0 активний уже в HTML.
- Produces: `<Crumbs lang parent={{href,label}} current={string}>`.

- [ ] **Step 1: Дописати падаючі тести**

У кінець `tests/page-ministries.test.js`:

```js
test('кожне служіння має сторінку обома мовами з назвою, фактами й дзвінком', () => {
  for (const m of ministries) {
    for (const [lang, prefix] of LOCALES) {
      const root = loadPage(`${prefix}ministries/${m.slug}/index.html`);
      assert.equal(root.querySelector('h1').text, m.name[lang]);
      assert.equal(root.querySelector('.crumbs span').text, m.name[lang]);
      assert.equal(root.querySelector('.info h2').text, m.summary[lang]);
      assert.equal(root.querySelector('.info .desc').text, m.body[lang]);
      assert.equal(root.querySelector('.fact .val').text, m.leader);
      assert.equal(root.querySelector('.info .btn').getAttribute('href'), `tel:${m.phone.replace(/[^+\d]/g, '')}`);
      assert.equal(root.querySelector('title').text, `${m.name[lang]} — House of Bread Church`);
    }
  }
});

test('галерея: слайд на кожне медіа, перший активний, відео — лише ID без iframe', () => {
  const m = ministries.find((x) => x.slug === 'youth');
  const root = loadPage('ministries/youth/index.html');
  const slides = root.querySelectorAll('[data-slide]');
  assert.equal(slides.length, m.media.length);
  assert.ok(slides[0].classList.contains('is-active'));
  assert.equal(root.querySelectorAll('[data-dot]').length, m.media.length);
  assert.equal(root.querySelectorAll('[data-thumb]').length, m.media.length);
  // iframe YouTube важкий — вставляється скриптом лише для активного слайда.
  assert.equal(slides[2].getAttribute('data-video'), 'ScMzIvxBSi4');
  assert.equal(root.querySelectorAll('.slide iframe').length, 0);
});

test('«Інші служіння» — наступні чотири по колу, без поточного', () => {
  const last = ministries.at(-1);
  const cards = loadPage(`ministries/${last.slug}/index.html`).querySelectorAll('.more-card');
  assert.deepEqual(
    cards.map((c) => c.getAttribute('href')),
    ministries.slice(0, 4).map((x) => href(`ministries/${x.slug}/`)),
  );
});

test('шапка й футер деталки ведуть до списку тієї ж мови', () => {
  const root = loadPage('en/ministries/youth/index.html');
  assert.equal(root.querySelector('.back-link').getAttribute('href'), href('en/ministries/'));
  assert.equal(root.querySelector('.site-footer a').getAttribute('href'), href('en/ministries/'));
  assert.equal(root.querySelectorAll('.crumbs a')[1].getAttribute('href'), href('en/ministries/'));
});
```

`tests/e2e/gallery.e2e.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';

const site = useSite();
const activeIndex = (page) =>
  page.locator('[data-slide].is-active').evaluate((el) => [...el.parentElement.children].indexOf(el));

test('галерея: стрілки, крапки, мініатюри й клавіатура перемикають слайд', async () => {
  const page = await site.open('ministries/youth/');
  assert.equal(await activeIndex(page), 0);
  await page.click('[data-next]');
  assert.equal(await activeIndex(page), 1);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(page), 0);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await activeIndex(page), 3, 'з першого слайда «назад» веде на останній');
  await page.locator('[data-dot]').nth(1).click();
  assert.equal(await activeIndex(page), 1);
  assert.equal(await page.locator('[data-dot].is-active').count(), 1);
  assert.equal(await page.locator('[data-thumb].is-active').count(), 1);
  await page.close();
});

test('відео вставляється лише коли його слайд стає активним', async () => {
  const page = await site.open('ministries/youth/');
  assert.equal(await page.locator('.slide iframe').count(), 0);
  await page.locator('[data-thumb]').nth(2).click();
  const frame = page.locator('.slide.is-active iframe');
  assert.equal(await frame.getAttribute('src'), 'https://www.youtube.com/embed/ScMzIvxBSi4?rel=0');
  assert.equal(await frame.getAttribute('title'), 'Молодь — відео');
  await page.close();
});
```

- [ ] **Step 2: Переконатися, що падають**

Run: `npm test`
Expected: FAIL — `ENOENT … dist/ministries/youth/index.html`

- [ ] **Step 3: Стилі галереї і сторінки**

`src/styles/gallery.css` (рядки 65–86 `ministry.dc.html`; `.gal-arrow` → `.gallery-arrow`, правила `.slider*` церкви й проєкту ідентичні з точністю до імен):

```css
/* Одна галерея замість трьох копій (Спека 1). Правила — з ministry.dc.html;
   на church/project вони були ідентичні під іменами .slider*. */
.gallery{border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-lg);background:#000;position:relative}
.gallery-stage{position:relative;aspect-ratio:16/10;background:#0d0d16}
.slide{position:absolute;inset:0;opacity:0;visibility:hidden;transition:opacity .5s var(--ease)}
.slide.is-active{opacity:1;visibility:visible}
.slide img{width:100%;height:100%;object-fit:cover}
.slide iframe{width:100%;height:100%;border:0;display:block}
.slide .vbadge{position:absolute;top:1rem;left:1rem;z-index:2;background:rgba(0,0,0,.7);color:#fff;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:.35rem .7rem;border-radius:8px;display:flex;align-items:center;gap:.4rem;pointer-events:none}
.slide .vbadge svg{width:14px;height:14px;color:var(--accent)}
.gallery-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:5;width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,.92);color:var(--text-primary);cursor:pointer;display:grid;place-items:center;box-shadow:var(--shadow-card);transition:background .2s var(--ease),transform .2s var(--ease)}
.gallery-arrow:hover{background:#fff;transform:translateY(-50%) scale(1.06)}
.gallery-arrow.prev{left:1rem}
.gallery-arrow.next{right:1rem}
.gallery-arrow svg{width:22px;height:22px}
.dots{display:flex;justify-content:center;gap:.5rem;padding:1rem;background:#12121c}
.dots button{width:10px;height:10px;border-radius:50%;border:none;background:rgba(255,255,255,.3);cursor:pointer;padding:0;transition:background .2s var(--ease),transform .2s var(--ease)}
.dots button.is-active{background:var(--accent);transform:scale(1.25)}
.thumbs{display:flex;gap:.6rem;margin-top:1rem;overflow-x:auto;padding-bottom:.35rem}
.thumbs button{flex:0 0 84px;height:56px;border-radius:8px;overflow:hidden;border:2px solid transparent;cursor:pointer;padding:0;background:#000;position:relative;transition:border-color .2s var(--ease)}
.thumbs button.is-active{border-color:var(--accent)}
.thumbs img{width:100%;height:100%;object-fit:cover}
.thumbs .play{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.4)}
.thumbs .play svg{width:18px;height:18px;color:#fff}
```

Перед збереженням звірити з легасі: `sed -n '65,86p' ministry.dc.html | sed 's/\.gal-arrow/.gallery-arrow/g' | diff - <(grep -v '^/\*\|^   на' src/styles/gallery.css)` — Expected: порожній вивід.

```bash
node scripts/port-legacy-css.mjs ministry.dc.html 40 116 src/styles/pages/ministry.css --strip-gallery
```

Expected: `правил галереї вирізано: 22`.

- [ ] **Step 4: Компоненти**

`src/components/Crumbs.astro`:

```astro
---
import { t } from '../i18n';
import { localePath } from '../lib/paths.mjs';
import { CHEVRON } from '../lib/svg.mjs';

interface Props {
  lang: 'uk' | 'en';
  parent: { href: string; label: string };
  current: string;
}

const { lang, parent, current } = Astro.props;
const base = import.meta.env.BASE_URL;
---
<nav class="crumbs" aria-label={t(lang, 'a11y.breadcrumbs')}>
  <a href={localePath(base, lang, '/')}>{t(lang, 'crumb.home')}</a>
  <Fragment set:html={CHEVRON} />
  <a href={parent.href}>{parent.label}</a>
  <Fragment set:html={CHEVRON} />
  <span>{current}</span>
</nav>
```

`src/components/Gallery.astro`:

```astro
---
import '../styles/gallery.css';
import { t } from '../i18n';
import { ytId, ytThumb } from '../lib/youtube.mjs';
import { CHEVRON, CHEVRON_LEFT, PLAY } from '../lib/svg.mjs';

interface Props {
  lang: 'uk' | 'en';
  media: { type: 'image' | 'video'; src: string; alt: string }[];
  // Заголовок iframe для скрінрідера: у легасі він різнився по сторінках
  // («Молодь — відео», «Відео церкви», «Відео проєкту»).
  videoTitle: string;
}

const { lang, media, videoTitle } = Astro.props;
const slides = media.map((item) => {
  if (item.type === 'image') return { ...item, thumb: item.src };
  const id = ytId(item.src);
  if (!id) throw new Error(`відео не з YouTube: ${item.src}`);
  return { ...item, id, thumb: ytThumb(id) };
});
---
<div data-gallery data-video-title={videoTitle}>
  <div class="gallery">
    <div class="gallery-stage">
      {slides.map((s, i) => s.type === 'video'
        ? <div class:list={['slide', { 'is-active': i === 0 }]} data-slide data-video={s.id}><span class="vbadge"><Fragment set:html={PLAY} />{t(lang, 'badge.video')}</span></div>
        : <div class:list={['slide', { 'is-active': i === 0 }]} data-slide><img src={s.src} alt={s.alt}></div>)}
    </div>
    <button class="gallery-arrow prev" type="button" data-prev aria-label={t(lang, 'a11y.galleryPrev')}><Fragment set:html={CHEVRON_LEFT} /></button>
    <button class="gallery-arrow next" type="button" data-next aria-label={t(lang, 'a11y.galleryNext')}><Fragment set:html={CHEVRON} /></button>
    <div class="dots">
      {slides.map((_, i) => <button type="button" data-dot class:list={[{ 'is-active': i === 0 }]} aria-label={`${t(lang, 'a11y.slide')} ${i + 1}`}></button>)}
    </div>
  </div>
  <div class="thumbs">
    {slides.map((s, i) => (
      <button type="button" data-thumb class:list={[{ 'is-active': i === 0 }]} aria-label={`${t(lang, 'a11y.slide')} ${i + 1}`}><img src={s.thumb} alt="">{s.type === 'video' && <span class="play"><Fragment set:html={PLAY} /></span>}</button>
    ))}
  </div>
</div>

<script>
  import { ytEmbed } from '../lib/youtube.mjs';

  for (const root of document.querySelectorAll<HTMLElement>('[data-gallery]')) {
    const slides = [...root.querySelectorAll<HTMLElement>('[data-slide]')];
    const dots = [...root.querySelectorAll<HTMLElement>('[data-dot]')];
    const thumbs = [...root.querySelectorAll<HTMLElement>('[data-thumb]')];
    const title = root.dataset.videoTitle ?? '';
    let cur = 0;

    // iframe YouTube важкий: вставляється лише коли його слайд стає
    // активним і лише раз — повернення на слайд не перезавантажує відео.
    const loadVideo = (slide: HTMLElement) => {
      const id = slide.dataset.video;
      if (!id || slide.querySelector('iframe')) return;
      const frame = document.createElement('iframe');
      frame.src = ytEmbed(id);
      frame.title = title;
      frame.allow = 'accelerometer; encrypted-media; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      slide.appendChild(frame);
    };

    const go = (n: number) => {
      cur = (n + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle('is-active', i === cur));
      dots.forEach((d, i) => d.classList.toggle('is-active', i === cur));
      thumbs.forEach((t, i) => t.classList.toggle('is-active', i === cur));
      loadVideo(slides[cur]);
    };

    root.querySelector('[data-prev]')!.addEventListener('click', () => go(cur - 1));
    root.querySelector('[data-next]')!.addEventListener('click', () => go(cur + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    thumbs.forEach((t, i) => t.addEventListener('click', () => go(i)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(cur - 1);
      if (e.key === 'ArrowRight') go(cur + 1);
    });
    go(0);
  }
</script>
```

- [ ] **Step 5: Сторінка служіння**

`src/pages/[...lang]/ministries/[slug].astro`:

```astro
---
import { getCollection } from 'astro:content';
import SubPage from '../../../layouts/SubPage.astro';
import Crumbs from '../../../components/Crumbs.astro';
import Gallery from '../../../components/Gallery.astro';
import Icon from '../../../components/Icon.astro';
import { t, pick } from '../../../i18n';
import { localePath, localeParams } from '../../../lib/paths.mjs';
import { sortedData, nextCyclic, coverImage } from '../../../lib/collections.mjs';
import { telHref } from '../../../lib/format.mjs';
import { PERSON, PHONE } from '../../../lib/svg.mjs';
import '../../../styles/pages/ministry.css';

export async function getStaticPaths() {
  const ministries = sortedData(await getCollection('ministries'));
  return localeParams().flatMap(({ params, props }) =>
    ministries.map((ministry, index) => ({
      params: { ...params, slug: ministry.slug },
      // «Інші служіння» — наступні чотири по колу, як у легасі.
      props: { ...props, ministry, related: nextCyclic(ministries, index, 4) },
    })));
}

const { lang, ministry: m, related } = Astro.props;
const base = import.meta.env.BASE_URL;
const name = pick(m.name, lang);
const list = localePath(base, lang, '/ministries/');
const tel = telHref(m.phone);
---
<SubPage
  lang={lang}
  title={`${name} — House of Bread Church`}
  path={`/ministries/${m.slug}/`}
  back={{ href: list, label: t(lang, 'back.ministries') }}
  footBack={{ href: list, label: t(lang, 'footBack.ministries') }}
>
<section class="detail-top">
  <div class="container">
    <Crumbs lang={lang} parent={{ href: list, label: t(lang, 'crumb.ministries') }} current={name} />
    <div class="detail-head">
      <span class="detail-icon" aria-hidden="true"><Icon set="ministry" name={m.icon} /></span>
      <h1>{name}</h1>
    </div>
  </div>
</section>

<section>
  <div class="container">
    <div class="layout">
      <Gallery lang={lang} media={m.media} videoTitle={`${name} — ${t(lang, 'a11y.video')}`} />
      <div class="info">
        <p class="eyebrow">{t(lang, 'info.eyebrow')}</p>
        <h2>{pick(m.summary, lang)}</h2>
        <p class="desc">{pick(m.body, lang)}</p>
        <div class="facts">
          <div class="fact"><span class="ic"><Fragment set:html={PERSON} /></span><div><div class="lbl">{t(lang, 'fact.leader')}</div><div class="val">{m.leader}</div></div></div>
          <div class="fact"><span class="ic"><Fragment set:html={PHONE} /></span><div><div class="lbl">{t(lang, 'fact.phone')}</div><a class="val" href={tel}>{m.phone}</a></div></div>
        </div>
        <a class="btn" href={tel}>
          <Fragment set:html={PHONE} />
          <span>{t(lang, 'cta.join')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

<section class="more">
  <div class="container">
    <h2>{t(lang, 'more.ministries')}</h2>
    <div class="more-grid">
      {related.map((x) => (
        <a class="more-card" href={localePath(base, lang, `/ministries/${x.slug}/`)}><img loading="lazy" src={coverImage(x.media).src} alt=""><b>{pick(x.name, lang)}</b></a>
      ))}
    </div>
  </div>
</section>
</SubPage>
```

- [ ] **Step 6: Тести, e2e, порівняння**

Run: `npm test`
Expected: PASS

Run: `npm run e2e`
Expected: PASS, 2 тести `gallery.e2e.js`

Run: `npm run visual -- --only ministry-`
Expected: `72/72 OK` (18 служінь × 2 мови × 2 вʼюпорти)

- [ ] **Step 7: Коміт**

```bash
git add src tests
git commit -m "feat: галерея в один компонент і сторінки служінь

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 6: `/churches/` і `/churches/<slug>/`

**Files:**
- Create: `src/styles/pages/churches.css`, `src/styles/pages/church.css`, `src/pages/[...lang]/churches/index.astro`, `src/pages/[...lang]/churches/[slug].astro`
- Test: `tests/page-churches.test.js`

**Interfaces:**
- Consumes: `SubPage`, `Crumbs`, `Gallery`, `sortedData`, `othersFirst`, `coverImage`, `PIN`, `PERSON`, `ARROW`.

- [ ] **Step 1: Падаючий тест**

`tests/page-churches.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages } from './helpers/content.js';

const churches = readCollection('churches').map(({ data }) => data).sort((a, b) => a.order - b.order);
const LOCALES = [['uk', ''], ['en', 'en/']];

test('/churches/ показує церкви за order; значок «Головна» — лише в order 0', () => {
  for (const [lang, prefix] of LOCALES) {
    const cards = loadPage(`${prefix}churches/index.html`).querySelectorAll('.church-card');
    assert.equal(cards.length, churches.length);
    cards.forEach((card, i) => {
      const c = churches[i];
      assert.equal(card.getAttribute('href'), href(`${prefix}churches/${c.slug}/`));
      assert.equal(card.querySelector('h3').text, c.name[lang]);
      assert.equal(card.querySelector('.church-city').text, c.city[lang]);
      assert.equal(card.querySelector('.church-meta').text, c.times[lang]);
      assert.equal(card.querySelector('.badge').classList.contains('main'), c.order === 0, c.slug);
    });
  }
  assert.equal(loadPage('churches/index.html').querySelector('.hero-count span').text, `${churches.length} церков в об’єднанні`);
  assert.equal(loadPage('churches/index.html').querySelector('.page-hero h1').text, readPages().churches.title.uk);
});

test('сторінка церкви: факти, маршрут за українською адресою, три інші церкви', () => {
  for (const c of churches) {
    for (const [lang, prefix] of LOCALES) {
      const root = loadPage(`${prefix}churches/${c.slug}/index.html`);
      assert.equal(root.querySelector('h1').text, c.name[lang]);
      assert.equal(root.querySelector('.crumbs span').text, c.city[lang]);
      assert.equal(root.querySelector('.info .eyebrow').text, c.role[lang]);
      const vals = root.querySelectorAll('.fact .val').map((v) => v.text);
      assert.deepEqual(vals, [c.address[lang], c.times[lang], c.pastor]);
      // Легасі будував запит до карт з українських полів на обох мовах.
      assert.equal(
        root.querySelector('.info .btn').getAttribute('href'),
        `https://www.google.com/maps?q=${encodeURIComponent(`${c.city.uk} ${c.address.uk}`)}`,
      );
      const others = root.querySelectorAll('.more-card').map((a) => a.getAttribute('href'));
      assert.deepEqual(others, churches.filter((x) => x.slug !== c.slug).slice(0, 3).map((x) => href(`${prefix}churches/${x.slug}/`)));
    }
  }
});
```

- [ ] **Step 2: Переконатися, що падає**

Run: `npm test`
Expected: FAIL — `ENOENT … dist/churches/index.html`

- [ ] **Step 3: CSS**

```bash
node scripts/port-legacy-css.mjs churches.dc.html 40 90 src/styles/pages/churches.css --maxw 1200px
node scripts/port-legacy-css.mjs church.dc.html 40 119 src/styles/pages/church.css --maxw 1200px --strip-gallery
```

Expected: для `church.css` — `правил галереї вирізано: 22`.

- [ ] **Step 4: Сторінки**

`src/pages/[...lang]/churches/index.astro`:

```astro
---
import { getCollection, getEntry } from 'astro:content';
import SubPage from '../../../layouts/SubPage.astro';
import { t, pick } from '../../../i18n';
import { localePath, localeParams } from '../../../lib/paths.mjs';
import { sortedData, coverImage } from '../../../lib/collections.mjs';
import { ARROW, PIN } from '../../../lib/svg.mjs';
import '../../../styles/pages/churches.css';

export function getStaticPaths() {
  return localeParams();
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const page = (await getEntry('pages', 'churches'))!.data;
const churches = sortedData(await getCollection('churches'));
const home = localePath(base, lang, '/');
---
<SubPage
  lang={lang}
  title={pick(page.title, lang)}
  path="/churches/"
  back={{ href: home, label: t(lang, 'back.home') }}
  footBack={{ href: home, label: t(lang, 'footBack.home') }}
>
<section class="page-hero">
  <div class="container">
    <span class="hero-count" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg><span>{churches.length}{t(lang, 'listCount.churches')}</span></span>
    <p class="eyebrow">{pick(page.eyebrow, lang)}</p>
    <h1>{pick(page.title, lang)}</h1>
    <p>{pick(page.lead, lang)}</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="church-grid">
      {churches.map((c) => {
        // Значок «Головна церква» — за даними (order 0), а не за позицією
        // файлу: glob-завантажувач порядку не гарантує.
        const isMain = c.order === 0;
        return (
          <a class="church-card" href={localePath(base, lang, `/churches/${c.slug}/`)}>
            <div class="church-thumb"><img loading="lazy" src={coverImage(c.media).src} alt={pick(c.name, lang)}>
              <span class:list={['badge', { main: isMain }]}>{t(lang, isMain ? 'badge.mainChurch' : 'badge.union')}</span></div>
            <div class="church-body">
              <span class="church-city"><Fragment set:html={PIN} />{pick(c.city, lang)}</span>
              <h3>{pick(c.name, lang)}</h3>
              <p>{pick(c.lead, lang)}</p>
              <div class="church-foot"><span class="church-meta">{pick(c.times, lang)}</span><span class="church-go">{t(lang, 'card.readMore')} <Fragment set:html={ARROW} /></span></div>
            </div>
          </a>
        );
      })}
    </div>
  </div>
</section>
</SubPage>
```

`src/pages/[...lang]/churches/[slug].astro`:

```astro
---
import { getCollection } from 'astro:content';
import SubPage from '../../../layouts/SubPage.astro';
import Crumbs from '../../../components/Crumbs.astro';
import Gallery from '../../../components/Gallery.astro';
import { t, pick } from '../../../i18n';
import { localePath, localeParams } from '../../../lib/paths.mjs';
import { sortedData, othersFirst, coverImage } from '../../../lib/collections.mjs';
import { PERSON, PIN } from '../../../lib/svg.mjs';
import '../../../styles/pages/church.css';

export async function getStaticPaths() {
  const churches = sortedData(await getCollection('churches'));
  return localeParams().flatMap(({ params, props }) =>
    churches.map((church) => ({
      params: { ...params, slug: church.slug },
      props: { ...props, church, others: othersFirst(churches, church.slug, 3) },
    })));
}

const { lang, church: c, others } = Astro.props;
const base = import.meta.env.BASE_URL;
const list = localePath(base, lang, '/churches/');
const city = pick(c.city, lang);
// Як у легасі: запит до карт з українських полів незалежно від мови сторінки.
const directions = `https://www.google.com/maps?q=${encodeURIComponent(`${c.city.uk} ${c.address.uk}`)}`;
---
<SubPage
  lang={lang}
  title={pick(c.name, lang)}
  path={`/churches/${c.slug}/`}
  back={{ href: list, label: t(lang, 'back.churches') }}
  footBack={{ href: list, label: t(lang, 'footBack.churches') }}
>
<section class="detail-top">
  <div class="container">
    <Crumbs lang={lang} parent={{ href: list, label: t(lang, 'crumb.churches') }} current={city} />
    <div class="detail-head">
      <span class="detail-city"><Fragment set:html={PIN} /><span>{city}</span></span>
      <h1>{pick(c.name, lang)}</h1>
    </div>
  </div>
</section>

<section>
  <div class="container">
    <div class="layout">
      <Gallery lang={lang} media={c.media} videoTitle={t(lang, 'a11y.churchVideo')} />
      <div class="info">
        <p class="eyebrow">{pick(c.role, lang)}</p>
        <h2>{t(lang, 'info.aboutChurch')}</h2>
        <p>{pick(c.body, lang)}</p>
        <div class="facts">
          <div class="fact"><span class="ic"><Fragment set:html={PIN} /></span><div><div class="lbl">{t(lang, 'fact.address')}</div><div class="val">{pick(c.address, lang)}</div></div></div>
          <div class="fact"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><div><div class="lbl">{t(lang, 'fact.times')}</div><div class="val">{pick(c.times, lang)}</div></div></div>
          <div class="fact"><span class="ic"><Fragment set:html={PERSON} /></span><div><div class="lbl">{t(lang, 'fact.pastor')}</div><div class="val">{c.pastor}</div></div></div>
        </div>
        <a class="btn" href={directions}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2Z"/></svg>
          <span>{t(lang, 'cta.directions')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

<section class="more">
  <div class="container">
    <h2>{t(lang, 'more.churches')}</h2>
    <div class="more-grid">
      {others.map((x) => (
        <a class="more-card" href={localePath(base, lang, `/churches/${x.slug}/`)}><img src={coverImage(x.media).src} alt=""><span><b>{pick(x.city, lang)}</b><span>{pick(x.times, lang)}</span></span></a>
      ))}
    </div>
  </div>
</section>
</SubPage>
```

- [ ] **Step 5: Тести і порівняння**

Run: `npm test`
Expected: PASS

Run: `npm run visual -- --only church`
Expected: `28/28 OK` (список 4 + 6 церков × 4)

- [ ] **Step 6: Коміт**

```bash
git add src tests
git commit -m "feat: сторінки церков обʼєднання

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 7: `/projects/` і `/projects/<slug>/`

**Files:**
- Create: `src/styles/pages/projects.css`, `src/styles/pages/project.css`, `src/pages/[...lang]/projects/index.astro`, `src/pages/[...lang]/projects/[slug].astro`
- Test: `tests/page-projects.test.js`

**Interfaces:**
- Consumes: `formatDate`, `linkHref`, `isExternal`, `othersFirst`, `coverImage`, `Gallery`, `Crumbs`, `PLAY`, `ARROW`.

- [ ] **Step 1: Падаючий тест**

`tests/page-projects.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection } from './helpers/content.js';

const projects = readCollection('projects').map(({ data }) => data).sort((a, b) => a.order - b.order);
const LOCALES = [['uk', ''], ['en', 'en/']];

test('/projects/: картки за order, дата українською, прогрес лише де він є', () => {
  const cards = loadPage('projects/index.html').querySelectorAll('.project-card');
  assert.equal(cards.length, projects.length);
  cards.forEach((card, i) => {
    const p = projects[i];
    assert.equal(card.getAttribute('href'), href(`projects/${p.slug}/`));
    assert.equal(card.querySelector('h3').text, p.title.uk);
    assert.equal(card.querySelector('.cat').text, p.category.uk);
    assert.equal(Boolean(card.querySelector('.project-progress')), p.progress !== null, p.slug);
    assert.equal(Boolean(card.querySelector('.vflag')), p.media.some((m) => m.type === 'video'), p.slug);
  });
  const canteen = cards[projects.findIndex((p) => p.slug === 'social-canteen')];
  assert.equal(canteen.querySelector('.project-meta').text, '10 січня 2026 р.');
  const en = loadPage('en/projects/index.html').querySelectorAll('.project-card');
  assert.equal(en[projects.findIndex((p) => p.slug === 'social-canteen')].querySelector('.project-meta').text, 'January 10, 2026');
});

test('сторінка проєкту: показники, прогрес за даними, CTA в мові сторінки', () => {
  for (const p of projects) {
    for (const [lang, prefix] of LOCALES) {
      const root = loadPage(`${prefix}projects/${p.slug}/index.html`);
      assert.equal(root.querySelector('h1').text, p.title[lang]);
      assert.deepEqual(root.querySelectorAll('.stat .l').map((s) => s.text), p.stats.map((s) => s.label[lang]));
      // Проєкт без прогресу не має порожнього (схованого) блока.
      assert.equal(Boolean(root.querySelector('.info-progress')), p.progress !== null, p.slug);
      if (p.progress) {
        assert.equal(root.querySelector('.info-progress .bar span').getAttribute('style'), `width:${p.progress.percent}%`);
      }
      const cta = root.querySelector('.info .btn');
      assert.equal(Boolean(cta), p.ctaUrl !== null, p.slug);
      if (p.ctaUrl?.startsWith('https://')) assert.equal(cta.getAttribute('target'), '_blank');
    }
  }
  // Внутрішній CTA лишається в мові сторінки (дірка 11).
  assert.equal(loadPage('en/projects/social-canteen/index.html').querySelector('.info .btn').getAttribute('href'), href('en/#contacts'));
  assert.equal(loadPage('projects/social-canteen/index.html').querySelector('.info .btn').hasAttribute('target'), false);
});
```

- [ ] **Step 2: Переконатися, що падає**

Run: `npm test`
Expected: FAIL — `ENOENT … dist/projects/index.html`

- [ ] **Step 3: CSS**

```bash
node scripts/port-legacy-css.mjs projects.dc.html 40 95 src/styles/pages/projects.css
node scripts/port-legacy-css.mjs project.dc.html 40 118 src/styles/pages/project.css --strip-gallery
```

Expected: для `project.css` — `правил галереї вирізано: 22`.

- [ ] **Step 4: Сторінки**

`src/pages/[...lang]/projects/index.astro`:

```astro
---
import { getCollection, getEntry } from 'astro:content';
import SubPage from '../../../layouts/SubPage.astro';
import { t, pick } from '../../../i18n';
import { localePath, localeParams } from '../../../lib/paths.mjs';
import { sortedData, coverImage } from '../../../lib/collections.mjs';
import { formatDate } from '../../../lib/format.mjs';
import { ARROW, PLAY } from '../../../lib/svg.mjs';
import '../../../styles/pages/projects.css';

export function getStaticPaths() {
  return localeParams();
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const page = (await getEntry('pages', 'projects'))!.data;
const projects = sortedData(await getCollection('projects'));
const home = localePath(base, lang, '/');
---
<SubPage
  lang={lang}
  title={pick(page.title, lang)}
  path="/projects/"
  back={{ href: home, label: t(lang, 'back.home') }}
  footBack={{ href: home, label: t(lang, 'footBack.home') }}
>
<section class="page-hero">
  <div class="container">
    <span class="hero-tag" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg><span>{pick(page.heroTag, lang)}</span></span>
    <p class="eyebrow">{pick(page.eyebrow, lang)}</p>
    <h1>{pick(page.title, lang)}</h1>
    <p>{pick(page.lead, lang)}</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="project-grid">
      {projects.map((p) => (
        <a class="project-card" href={localePath(base, lang, `/projects/${p.slug}/`)}>
          <div class="project-thumb"><img loading="lazy" src={coverImage(p.media).src} alt={pick(p.title, lang)}>
            <span class="cat">{pick(p.category, lang)}</span>
            {p.media.some((m) => m.type === 'video') && <span class="vflag"><Fragment set:html={PLAY} />{t(lang, 'badge.video')}</span>}</div>
          <div class="project-body">
            <span class="project-period">{pick(p.period, lang)} <span class="project-status">· {pick(p.status, lang)}</span></span>
            <h3>{pick(p.title, lang)}</h3>
            <p>{pick(p.lead, lang)}</p>
            {p.progress && <div class="project-progress"><div class="bar"><span style={`width:${p.progress.percent}%`}></span></div><div class="lbl"><span>{pick(p.progress.raised, lang)}</span><span>{t(lang, 'progress.of')}{pick(p.progress.goal, lang)}</span></div></div>}
            <div class="project-foot"><span class="project-meta">{formatDate(p.date, lang)}</span><span class="project-go">{t(lang, 'card.readMore')} <Fragment set:html={ARROW} /></span></div>
          </div>
        </a>
      ))}
    </div>
  </div>
</section>
</SubPage>
```

`src/pages/[...lang]/projects/[slug].astro`:

```astro
---
import { getCollection } from 'astro:content';
import SubPage from '../../../layouts/SubPage.astro';
import Crumbs from '../../../components/Crumbs.astro';
import Gallery from '../../../components/Gallery.astro';
import { t, pick } from '../../../i18n';
import { isExternal, linkHref, localePath, localeParams } from '../../../lib/paths.mjs';
import { sortedData, othersFirst, coverImage } from '../../../lib/collections.mjs';
import '../../../styles/pages/project.css';

export async function getStaticPaths() {
  const projects = sortedData(await getCollection('projects'));
  return localeParams().flatMap(({ params, props }) =>
    projects.map((project) => ({
      params: { ...params, slug: project.slug },
      props: { ...props, project, others: othersFirst(projects, project.slug, 3) },
    })));
}

const { lang, project: p, others } = Astro.props;
const base = import.meta.env.BASE_URL;
const list = localePath(base, lang, '/projects/');
const title = pick(p.title, lang);
// Зовнішній CTA (LiqPay) — у новій вкладці, як у легасі; внутрішній — ні.
const external = p.ctaUrl !== null && isExternal(p.ctaUrl);
---
<SubPage
  lang={lang}
  title={title}
  path={`/projects/${p.slug}/`}
  back={{ href: list, label: t(lang, 'back.projects') }}
  footBack={{ href: list, label: t(lang, 'footBack.projects') }}
>
<section class="detail-top">
  <div class="container">
    <Crumbs lang={lang} parent={{ href: list, label: t(lang, 'crumb.projects') }} current={title} />
    <div class="detail-head">
      <span class="detail-cat">{pick(p.category, lang)}</span>
      <h1>{title}</h1>
      <div class="detail-period"><span>{pick(p.period, lang)}</span> <span class="detail-status">· <span>{pick(p.status, lang)}</span></span></div>
    </div>
  </div>
</section>

<section>
  <div class="container">
    <div class="layout">
      <Gallery lang={lang} media={p.media} videoTitle={t(lang, 'a11y.projectVideo')} />
      <div class="info">
        <h2>{t(lang, 'info.aboutProject')}</h2>
        <p>{pick(p.body, lang)}</p>
        <div class="stats">
          {p.stats.map((s) => <div class="stat"><div class="n">{s.n}</div><div class="l">{pick(s.label, lang)}</div></div>)}
        </div>
        {p.progress && (
          <div class="info-progress">
            <div class="bar"><span style={`width:${p.progress.percent}%`}></span></div>
            <div class="lbl"><span>{pick(p.progress.raised, lang)}</span><span>{t(lang, 'progress.of')}{pick(p.progress.goal, lang)}</span></div>
          </div>
        )}
        {p.ctaUrl && (
          <a class="btn" href={linkHref(base, lang, p.ctaUrl)} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/></svg>
            <span>{pick(p.ctaLabel, lang)}</span>
          </a>
        )}
      </div>
    </div>
  </div>
</section>

<section class="more">
  <div class="container">
    <h2>{t(lang, 'more.projects')}</h2>
    <div class="more-grid">
      {others.map((x) => (
        <a class="more-card" href={localePath(base, lang, `/projects/${x.slug}/`)}><img src={coverImage(x.media).src} alt=""><span><b>{pick(x.title, lang)}</b><span>{pick(x.period, lang)}</span></span></a>
      ))}
    </div>
  </div>
</section>
</SubPage>
```

- [ ] **Step 5: Тести і порівняння**

Run: `npm test`
Expected: PASS

Run: `npm run visual -- --only project`
Expected: `20/20 OK` (список 4 + 4 проєкти × 4)

- [ ] **Step 6: Коміт**

```bash
git add src tests
git commit -m "feat: сторінки проєктів

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 8: `/testimonies/` і відеосвідчення по кліку

**Files:**
- Create: `src/scripts/video-testimonies.mjs`, `src/styles/pages/testimonies.css`, `src/pages/[...lang]/testimonies.astro`
- Test: `tests/page-testimonies.test.js`, `tests/e2e/testimonies.e2e.js`

**Interfaces:**
- Produces: `bindVideoTestimonies(root: ParentNode, title: string): void` — кожна `.tst-video` у `root` при кліку замінюється на iframe YouTube з автозапуском. Використовується і головною (Задача 12).

- [ ] **Step 1: Падаючі тести**

`tests/page-testimonies.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection } from './helpers/content.js';

const testimonies = readCollection('testimonies').map(({ data }) => data).sort((a, b) => a.order - b.order);

test('/testimonies/: текстові й відеокартки в порядку order обома мовами', () => {
  for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
    const cards = loadPage(`${prefix}testimonies/index.html`).querySelectorAll('.tst-card');
    assert.equal(cards.length, testimonies.length);
    cards.forEach((card, i) => {
      const x = testimonies[i];
      assert.equal(card.querySelector('.tst-person b').text, x.name);
      assert.equal(card.querySelector('.tst-person span span').text, x.role[lang]);
      assert.equal(card.querySelector('.tst-avatar').text, x.name.trim()[0].toUpperCase());
      if (x.type === 'video') {
        assert.equal(card.tagName, 'ARTICLE');
        assert.equal(card.querySelector('.tst-video').getAttribute('data-yt'), x.videoUrl);
        assert.equal(card.querySelector('.tst-video img').getAttribute('src'), x.poster);
      } else {
        assert.equal(card.tagName, 'FIGURE');
        assert.equal(card.querySelector('p').text, x.text[lang]);
      }
    });
  }
});

test('«назад» веде на секцію свідчень головної', () => {
  // Рішення 9: на головній секція отримує id="testimonies" (Задача 12).
  assert.equal(loadPage('testimonies/index.html').querySelector('.back-link').getAttribute('href'), href('#testimonies'));
  assert.equal(loadPage('en/testimonies/index.html').querySelector('.site-footer a').getAttribute('href'), href('en/#testimonies'));
});
```

`tests/e2e/testimonies.e2e.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';

const site = useSite();

test('клік по відеосвідченню вставляє плеєр з автозапуском замість кнопки', async () => {
  const page = await site.open('testimonies/');
  assert.equal(await page.locator('.tst-grid iframe').count(), 0);
  await page.locator('.tst-video').first().click();
  const frame = page.locator('.tst-grid iframe').first();
  assert.equal(await frame.getAttribute('src'), 'https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1&rel=0');
  assert.equal(await frame.getAttribute('title'), 'Відеосвідчення');
  assert.equal(await page.locator('.tst-video').count(), 1, 'друга відеокартка лишилася кнопкою');
  await page.close();
});
```

- [ ] **Step 2: Переконатися, що падає**

Run: `npm test`
Expected: FAIL — `ENOENT … dist/testimonies/index.html`

- [ ] **Step 3: Скрипт, CSS, сторінка**

`src/scripts/video-testimonies.mjs`:

```js
import { ytId, ytEmbed } from '../lib/youtube.mjs';

// Плеєр вставляється лише після кліку: iframe YouTube важкий, а відеокарток
// кілька. Кнопка замінюється цілком — як у легасі, щоб фокус не лишився на
// невидимому елементі.
export function bindVideoTestimonies(root, title) {
  for (const button of root.querySelectorAll('.tst-video')) {
    button.addEventListener('click', () => {
      const id = ytId(button.getAttribute('data-yt'));
      if (!id) return;
      const frame = document.createElement('iframe');
      frame.src = ytEmbed(id, { autoplay: true });
      frame.title = title;
      frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
      frame.setAttribute('allowfullscreen', '');
      button.replaceWith(frame);
    });
  }
}
```

```bash
node scripts/port-legacy-css.mjs testimonies.dc.html 40 92 src/styles/pages/testimonies.css
```

`src/pages/[...lang]/testimonies.astro`:

```astro
---
import { getCollection, getEntry } from 'astro:content';
import SubPage from '../../layouts/SubPage.astro';
import { t, pick } from '../../i18n';
import { localePath, localeParams } from '../../lib/paths.mjs';
import { sortedData } from '../../lib/collections.mjs';
import { initial } from '../../lib/format.mjs';
import { PLAY } from '../../lib/svg.mjs';
import '../../styles/pages/testimonies.css';

export function getStaticPaths() {
  return localeParams();
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const page = (await getEntry('pages', 'testimonies'))!.data;
const testimonies = sortedData(await getCollection('testimonies'));
// Рішення 9: «назад» веде на секцію свідчень головної, звідки сюди прийшли.
const section = localePath(base, lang, '/#testimonies');
const videoLabel = t(lang, 'testimony.videoLabel');
---
<SubPage
  lang={lang}
  title={pick(page.title, lang)}
  path="/testimonies/"
  back={{ href: section, label: t(lang, 'back.home') }}
  footBack={{ href: section, label: t(lang, 'footBack.home') }}
>
<section class="page-hero">
  <div class="container">
    <span class="hero-tag" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h10M7 12h6"/><path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/></svg><span>{pick(page.heroTag, lang)}</span></span>
    <p class="eyebrow">{pick(page.eyebrow, lang)}</p>
    <h1>{pick(page.title, lang)}</h1>
    <p>{pick(page.lead, lang)}</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="tst-grid" data-tst-grid data-video-title={videoLabel}>
      {testimonies.map((x) => x.type === 'video'
        ? (
          <article class="tst-card tst-video-card">
            <button type="button" class="tst-video" data-yt={x.videoUrl} aria-label={t(lang, 'testimony.watch')}>
              <img loading="lazy" src={x.poster} alt={videoLabel}>
              <span class="vlabel">{videoLabel}</span>
              <span class="play" aria-hidden="true"><Fragment set:html={PLAY} /></span>
            </button>
            <div class="tst-person"><span class="tst-avatar">{initial(x.name)}</span><span><b>{x.name}</b><span>{pick(x.role, lang)}</span></span></div>
          </article>
        )
        : (
          <figure class="tst-card">
            <div class="tst-quote" aria-hidden="true">“</div>
            <p>{pick(x.text, lang)}</p>
            <figcaption class="tst-person"><span class="tst-avatar">{initial(x.name)}</span><span><b>{x.name}</b><span>{pick(x.role, lang)}</span></span></figcaption>
          </figure>
        ))}
    </div>
  </div>
</section>
</SubPage>

<script>
  import { bindVideoTestimonies } from '../../scripts/video-testimonies.mjs';

  const grid = document.querySelector<HTMLElement>('[data-tst-grid]');
  if (grid) bindVideoTestimonies(grid, grid.dataset.videoTitle ?? '');
</script>
```

- [ ] **Step 4: Тести, e2e, порівняння**

Run: `npm test` → PASS
Run: `npm run e2e` → PASS (3 тести)
Run: `npm run visual -- --only testimonies` → `4/4 OK`

- [ ] **Step 5: Коміт**

```bash
git add src tests
git commit -m "feat: сторінка свідчень і відеосвідчення по кліку

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 9: `/pastors/`

**Files:**
- Create: `src/styles/pages/pastors.css`, `src/pages/[...lang]/pastors.astro`
- Test: `tests/page-pastors.test.js`

- [ ] **Step 1: Падаючий тест**

`tests/page-pastors.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readCollection, readPages } from './helpers/content.js';

const people = readCollection('pastors').map(({ data }) => data);
const group = (g) => people.filter((p) => p.group === g).sort((a, b) => a.order - b.order);
const page = readPages().pastors;

test('3 пастори і 8 пресвітерів у порядку order, з ролями обома мовами', () => {
  for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
    const root = loadPage(`${prefix}pastors/index.html`);
    const pastors = root.querySelectorAll('.pastor-card');
    assert.deepEqual(pastors.map((c) => c.querySelector('h3').text), group('pastor').map((p) => p.name));
    assert.deepEqual(pastors.map((c) => c.querySelector('.role').text), group('pastor').map((p) => p.role[lang]));
    const elders = root.querySelectorAll('.elder-card');
    assert.deepEqual(elders.map((c) => c.querySelector('h3').text), group('elder').map((p) => p.name));
    assert.deepEqual(elders.map((c) => c.querySelector('p').text), group('elder').map((p) => p.bio[lang]));
    assert.equal(root.querySelector('.help h3').text, page.help.title[lang]);
  }
});

test('кнопки звʼязку зʼявляються лише там, де є пошта чи телефон', () => {
  const cards = loadPage('pastors/index.html').querySelectorAll('.pastor-card');
  group('pastor').forEach((p, i) => {
    const links = cards[i].querySelectorAll('.pastor-contact a').map((a) => a.getAttribute('href'));
    assert.deepEqual(links, [p.email && `mailto:${p.email}`, p.phone && `tel:${p.phone}`].filter(Boolean), p.slug);
  });
  assert.equal(loadPage('pastors/index.html').querySelector('.back-link').getAttribute('href'), href('#pastors'));
});
```

- [ ] **Step 2: Переконатися, що падає**

Run: `npm test`
Expected: FAIL — `ENOENT … dist/pastors/index.html`

- [ ] **Step 3: CSS і сторінка**

```bash
node scripts/port-legacy-css.mjs pastors.dc.html 39 109 src/styles/pages/pastors.css --maxw 1200px
```

`src/pages/[...lang]/pastors.astro`:

```astro
---
import { getCollection, getEntry } from 'astro:content';
import SubPage from '../../layouts/SubPage.astro';
import { t, pick } from '../../i18n';
import { localePath, localeParams } from '../../lib/paths.mjs';
import { sortedData } from '../../lib/collections.mjs';
import { MAIL, PHONE, USERS } from '../../lib/svg.mjs';
import '../../styles/pages/pastors.css';

export function getStaticPaths() {
  return localeParams();
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const page = (await getEntry('pages', 'pastors'))!.data;
const people = sortedData(await getCollection('pastors'));
const pastors = people.filter((p) => p.group === 'pastor');
const elders = people.filter((p) => p.group === 'elder');
const s = page.sections!;
const help = page.help!;
const section = localePath(base, lang, '/#pastors');
// Адреса месенджера — не в даних: у схемі help лише тексти. Записано в
// нотатці дірок як кандидат у поле для Спеки 3.
const MESSENGER = 'https://m.me/dom.hleba.org';
---
<SubPage
  lang={lang}
  title={pick(page.title, lang)}
  path="/pastors/"
  back={{ href: section, label: t(lang, 'back.home') }}
  footBack={{ href: section, label: t(lang, 'footBack.home') }}
>
<section class="page-hero">
  <div class="container">
    <span class="hero-tag" aria-hidden="true"><Fragment set:html={USERS} /><span>{pick(page.heroTag, lang)}</span></span>
    <p class="eyebrow">{pick(page.eyebrow, lang)}</p>
    <h1>{pick(page.title, lang)}</h1>
    <p>{pick(page.lead, lang)}</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="sec-head">
      <p class="eyebrow">{pick(s.past_eyebrow, lang)}</p>
      <h2>{pick(s.past_title, lang)}</h2>
      <p>{pick(s.past_lead, lang)}</p>
    </div>
    <div class="pastor-grid">
      {pastors.map((p) => (
        <article class="pastor-card">
          <div class="pastor-photo"><img src={p.photo} alt={p.name}><span class="role">{pick(p.role, lang)}</span></div>
          <div class="pastor-body">
            <h3>{p.name}</h3>
            {p.subtitle && <div class="sub">{pick(p.subtitle, lang)}</div>}
            <p>{pick(p.bio, lang)}</p>
            {(p.email || p.phone) && (
              <div class="pastor-contact">{p.email && <a href={`mailto:${p.email}`} aria-label={t(lang, 'a11y.email')}><Fragment set:html={MAIL} /></a>}{p.phone && <a href={`tel:${p.phone}`} aria-label={t(lang, 'a11y.phone')}><Fragment set:html={PHONE} /></a>}</div>
            )}
          </div>
        </article>
      ))}
    </div>
  </div>
</section>

<section class="section elders">
  <div class="container">
    <div class="sec-head">
      <p class="eyebrow">{pick(s.elders_eyebrow, lang)}</p>
      <h2>{pick(s.elders_title, lang)}</h2>
      <p>{pick(s.elders_lead, lang)}</p>
    </div>
    <div class="elder-grid">
      {elders.map((p) => (
        <article class="elder-card"><img class="elder-avatar" src={p.photo} alt={p.name}><h3>{p.name}</h3><div class="role">{pick(p.role, lang)}</div><p>{pick(p.bio, lang)}</p></article>
      ))}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="help">
      <div>
        <h3>{pick(help.title, lang)}</h3>
        <p>{pick(help.desc, lang)}</p>
      </div>
      <a class="btn" href={MESSENGER} target="_blank" rel="noopener noreferrer">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></svg>
        <span>{pick(help.btn, lang)}</span>
      </a>
    </div>
  </div>
</section>
</SubPage>
```

- [ ] **Step 4: Тести і порівняння**

Run: `npm test` → PASS
Run: `npm run visual -- --only pastors` → `4/4 OK`

- [ ] **Step 5: Коміт**

```bash
git add src tests
git commit -m "feat: сторінка пасторів і пресвітерів з колекції

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 10: `/leaders/`

**Files:**
- Create: `src/styles/pages/leaders.css`, `src/pages/[...lang]/leaders.astro`
- Test: `tests/page-leaders.test.js`

- [ ] **Step 1: Падаючий тест**

`tests/page-leaders.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './helpers/dist.js';
import { readCollection, readPages } from './helpers/content.js';

const resources = readCollection('leader-resources').map(({ data }) => data);
const kind = (k) => resources.filter((r) => r.kind === k).sort((a, b) => a.order - b.order);
const page = readPages().leaders;

test('документи: формат-значок, підпис, завантаження; «#» поки адреси немає', () => {
  for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
    const cards = loadPage(`${prefix}leaders/index.html`).querySelectorAll('.doc-card');
    assert.equal(cards.length, 6);
    cards.forEach((card, i) => {
      const d = kind('document')[i];
      assert.equal(card.querySelector('h3').text, d.title[lang]);
      assert.equal(card.querySelector('.doc-meta').text, d.meta[lang]);
      assert.ok(card.querySelector('.doc-ic').classList.contains(d.format));
      assert.equal(card.querySelector('.doc-ic').text, d.format.toUpperCase());
      // Дірка 2: url: null. «#» — легасі-поведінка; справжні адреси дасть замовник.
      assert.equal(card.getAttribute('href'), d.url ?? '#');
      assert.equal(card.getAttribute('download'), '');
    });
  }
});

test('посилання: іконка з даних, назва й опис обома мовами', () => {
  for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
    const root = loadPage(`${prefix}leaders/index.html`);
    const cards = root.querySelectorAll('.res-card');
    assert.deepEqual(cards.map((c) => c.querySelector('h3').text), kind('link').map((r) => r.title[lang]));
    for (const card of cards) assert.ok(card.querySelector('.res-ic svg path, .res-ic svg rect'));
    assert.equal(root.querySelector('.locked span').text, page.sections.hero_locked[lang]);
    assert.equal(root.querySelector('.help h3').text, page.help.title[lang]);
  }
});
```

- [ ] **Step 2: Переконатися, що падає**

Run: `npm test`
Expected: FAIL — `ENOENT … dist/leaders/index.html`

- [ ] **Step 3: CSS і сторінка**

```bash
node scripts/port-legacy-css.mjs leaders.dc.html 41 133 src/styles/pages/leaders.css --maxw 1200px --keep-ul
```

(`--keep-ul`: ресет `ul` на цій сторінці є в легасі, а зі спільного `base.css` він пішов — рішення 3.)

`src/pages/[...lang]/leaders.astro`:

```astro
---
import { getCollection, getEntry } from 'astro:content';
import SubPage from '../../layouts/SubPage.astro';
import Icon from '../../components/Icon.astro';
import { t, pick } from '../../i18n';
import { localePath, localeParams } from '../../lib/paths.mjs';
import { sortedData } from '../../lib/collections.mjs';
import '../../styles/pages/leaders.css';

export function getStaticPaths() {
  return localeParams();
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const page = (await getEntry('pages', 'leaders'))!.data;
const resources = sortedData(await getCollection('leader-resources'));
const documents = resources.filter((r) => r.kind === 'document');
const links = resources.filter((r) => r.kind === 'link');
const s = page.sections!;
const help = page.help!;
const home = localePath(base, lang, '/');
// Адреса координатора — не в даних (у схемі help лише тексти); кандидат у
// поле для Спеки 3, записано в нотатці дірок.
const COORDINATOR = 'mailto:leaders@houseofbread.church';
---
<SubPage
  lang={lang}
  title={pick(page.title, lang)}
  path="/leaders/"
  back={{ href: home, label: t(lang, 'back.home') }}
  footBack={{ href: home, label: t(lang, 'footBack.home') }}
>
<section class="page-hero">
  <div class="container">
    <span class="locked" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><span>{pick(s.hero_locked, lang)}</span></span>
    <p class="eyebrow">{pick(page.eyebrow, lang)}</p>
    <h1>{pick(page.title, lang)}</h1>
    <p>{pick(page.lead, lang)}</p>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="sec-head">
      <h2>{pick(s.docs_title, lang)}</h2>
      <span class="count">{t(lang, 'docs.count')}</span>
    </div>
    <ul class="doc-list">
      {documents.map((d) => (
        <li><a class="doc-card" href={d.url ?? '#'} download>
          <span class:list={['doc-ic', d.format]} aria-hidden="true">{d.format!.toUpperCase()}</span>
          <span class="doc-main"><h3>{pick(d.title, lang)}</h3><p>{pick(d.description, lang)}</p></span>
          <span class="doc-meta">{pick(d.meta, lang)}</span>
          <span class="doc-dl" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg></span>
        </a></li>
      ))}
    </ul>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="sec-head">
      <h2>{pick(s.res_title, lang)}</h2>
      <span class="count">{t(lang, 'res.count')}</span>
    </div>
    <div class="res-grid">
      {links.map((r) => (
        <a class="res-card" href={r.url ?? '#'} target="_blank" rel="noopener">
          <span class="res-ic" aria-hidden="true"><Icon set="resource" name={r.icon!} /></span>
          <h3>{pick(r.title, lang)}</h3>
          <p>{pick(r.description, lang)}</p>
          <span class="res-go"><span>{t(lang, 'res.go')}</span> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
        </a>
      ))}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="help">
      <div>
        <h3>{pick(help.title, lang)}</h3>
        <p>{pick(help.desc, lang)}</p>
      </div>
      <a class="btn" href={COORDINATOR}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
        <span>{pick(help.btn, lang)}</span>
      </a>
    </div>
  </div>
</section>
</SubPage>
```

`findBrokenLinks` пропускає `href="#"` (починається з `#`), тож заглушки документів тест посилань не валять.

- [ ] **Step 4: Тести і порівняння**

Run: `npm test` → PASS
Run: `npm run visual -- --only leaders` → `4/4 OK`

- [ ] **Step 5: Коміт**

```bash
git add src tests
git commit -m "feat: сторінка ресурсів для лідерів

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 11: головна, частина 1 — шапка, шторка, футер, герой, «Про церкву», медіа, «У що віримо»

**Files:**
- Create: `src/styles/pages/home.css`, `src/components/SiteHeader.astro`, `src/components/SiteFooter.astro`
- Modify: `src/pages/[...lang]/index.astro` (замінити каркас Етапу 0 повністю), `tests/site.test.js` (прибрати `PENDING`)
- Test: `tests/page-home.test.js`, `tests/e2e/home.e2e.js`

**Interfaces:**
- Consumes: `LangSwitch`, `isPageEnabled`, `telHref`, `assetUrl`, SVG-рядки.
- Produces: `<SiteHeader lang>` (шапка + шторка), `<SiteFooter lang>`; на сторінці — секції `#home`, `#about`, `#media`, `#union` і клієнтські скрипти, які Задача 12 доповнює.

- [ ] **Step 1: Падаючі тести**

`tests/page-home.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { href, loadPage } from './helpers/dist.js';
import { readSingleton } from './helpers/content.js';

const home = readSingleton('homepage');
const contact = readSingleton('contact-info');
const donate = readSingleton('donate-settings');
const settings = readSingleton('site-settings');
const LOCALES = [['uk', ''], ['en', 'en/']];

test('меню: якорі секцій і реальні адреси обʼєднання та проєктів у мові сторінки', () => {
  for (const [lang, prefix] of LOCALES) {
    const links = loadPage(`${prefix}index.html`).querySelectorAll('.nav-desktop .nav-link');
    assert.deepEqual(links.map((a) => a.getAttribute('href')), [
      '#home', '#about', '#ministries', '#media', href(`${prefix}churches/`), '#donate', href(`${prefix}projects/`), '#contacts',
    ]);
    assert.equal(links[0].text, home.nav.home[lang]);
    assert.equal(loadPage(`${prefix}index.html`).querySelector('.cta-leaders').getAttribute('href'), href(`${prefix}leaders/`));
  }
});

test('герой: заголовок з розміткою, факти і калькулятор з даних', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    assert.equal(root.querySelector('.hero h1').innerHTML, home.hero.title[lang]);
    assert.equal(root.querySelector('[data-calc-amount]').getAttribute('value'), String(donate.defaultAmount));
    assert.deepEqual(
      root.querySelectorAll('[data-calc-add]').map((b) => b.getAttribute('data-calc-add')),
      donate.calcIncrements.map(String),
    );
    assert.equal(root.querySelector('.hero-donate-cta').getAttribute('href'), donate.liqpayUrl);
    assert.equal(root.querySelector('.hero-media-photo').getAttribute('src'), href('uploads/hero-cross.jpg'));
    assert.equal(root.querySelector('.hero-media source').getAttribute('srcset'), href('uploads/hero-cross-mobile.jpg'));
  }
});

test('сім тверджень віри, три новини зі стрілкою, чотири блоки «віримо»', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    assert.deepEqual(root.querySelectorAll('.belief p').map((p) => p.text), home.beliefs.map((b) => b[lang]));
    const news = root.querySelectorAll('.news-card');
    assert.equal(news.length, 3);
    // Рішення 11: стрілка — у шаблоні, тож є на обох мовах.
    for (const card of news) assert.ok(card.querySelector('.news-more svg'), `${lang}: без стрілки`);
    assert.equal(news[0].querySelector('.news-more').text.trim(), home.news.more[lang]);
    assert.deepEqual(root.querySelectorAll('.believe-item .n').map((n) => n.text), ['01', '02', '03', '04']);
    assert.equal(root.querySelector('.fb-page').getAttribute('data-href'), settings.social.facebook);
  }
});

test('футер: соцмережі — реальні адреси, нові сторінки поки ведуть на якорі', () => {
  const root = loadPage('index.html');
  assert.deepEqual(
    root.querySelectorAll('.footer-socials a').map((a) => a.getAttribute('href')),
    [settings.social.youtube, settings.social.facebook, settings.social.instagram],
  );
  const nav = root.querySelectorAll('.footer-col')[0].querySelectorAll('a').map((a) => a.getAttribute('href'));
  // Рішення 10: /about/ і /donate/ вимкнені (body: null) — посилань на них немає.
  assert.deepEqual(nav, ['#about', '#ministries', '#media', '#donate', href('projects/')]);
  assert.equal(root.querySelectorAll('.footer-col')[1].querySelectorAll('a')[2].getAttribute('href'), '#contacts');
  assert.equal(root.querySelectorAll('.footer-col')[1].querySelectorAll('a')[0].getAttribute('href'), `tel:${contact.phone}`);
});
```

`tests/e2e/home.e2e.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';

const site = useSite();
const MOBILE = { viewport: { width: 390, height: 844 } };

test('герой зʼявляється після завантаження, шапка темнішає після прокрутки', async () => {
  const page = await site.open('');
  await page.waitForFunction(() => document.body.classList.contains('is-loaded'));
  assert.equal(await page.locator('.site-header.is-scrolled').count(), 0);
  await page.mouse.wheel(0, 400);
  await page.waitForSelector('.site-header.is-scrolled');
  await page.close();
});

test('калькулятор: лише цифри, кнопки додають суму до введеної', async () => {
  const page = await site.open('');
  const amount = page.locator('[data-calc-amount]');
  await amount.fill('');
  await amount.pressSequentially('12');
  await page.locator('[data-calc-add="200"]').click();
  assert.equal(await amount.inputValue(), '212');
  await page.close();
});

test('шторка відкривається, закривається хрестиком, фоном і Escape', async () => {
  const page = await site.open('', MOBILE);
  const drawer = page.locator('[data-drawer]');
  for (const close of [
    () => page.click('[data-drawer-close]'),
    () => page.click('[data-drawer-scrim]', { position: { x: 20, y: 400 } }),
    () => page.keyboard.press('Escape'),
  ]) {
    await page.click('[data-drawer-open]');
    assert.equal(await drawer.getAttribute('aria-hidden'), 'false');
    assert.equal(await page.locator('[data-drawer-open]').getAttribute('aria-expanded'), 'true');
    await close();
    assert.equal(await drawer.getAttribute('aria-hidden'), 'true');
  }
  assert.equal(await page.evaluate(() => document.body.style.overflow), '');
  await page.close();
});

test('активний пункт меню стежить за секцією, блоки зʼявляються при прокрутці', async () => {
  const page = await site.open('');
  await page.locator('#union').scrollIntoViewIfNeeded();
  await page.waitForSelector('#union .reveal.is-in');
  await page.waitForSelector('.nav-link.is-active[data-nav="union"]');
  await page.close();
});
```

- [ ] **Step 2: Переконатися, що падають**

Run: `npm test`
Expected: FAIL — `page-home.test.js` (немає `.nav-desktop`)

- [ ] **Step 3: CSS головної**

```bash
node scripts/port-legacy-css.mjs index.html 63 400 src/styles/pages/home.css
```

Рядки 63–400 включають утиліти головної (`.section-title`, `.lead`, `.btn*`, `.reveal*`), що пішли з `base.css`, і дублікати `.container`/`.eyebrow` — ідентичні `base.css`, тож нешкідливі. Ресет `ul` у `index.html` стоїть на рядку 59, поза діапазоном — додати його першим рядком після коментаря-заголовка файлу:

```css
ul{margin:0;padding:0;list-style:none}
```

- [ ] **Step 4: Шапка і футер**

`src/components/SiteHeader.astro`:

```astro
---
import { getEntry } from 'astro:content';
import LangSwitch from './LangSwitch.astro';
import { t, pick } from '../i18n';
import { assetUrl, localePath } from '../lib/paths.mjs';

interface Props {
  lang: 'uk' | 'en';
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const settings = (await getEntry('site-settings', 'main'))!.data;
const { nav, cta } = (await getEntry('homepage', 'main'))!.data;
const streams = `${settings.social.youtube}/streams`;
const leaders = localePath(base, lang, '/leaders/');
// data-nav — ключ секції для підсвітки активного пункту (IntersectionObserver
// звіряє його з data-section). «Обʼєднання» і «Проєкти» — окремі сторінки.
const links = [
  { key: 'home', href: '#home', label: nav.home },
  { key: 'about', href: '#about', label: nav.about },
  { key: 'ministries', href: '#ministries', label: nav.ministries },
  { key: 'media', href: '#media', label: nav.media },
  { key: 'union', href: localePath(base, lang, '/churches/'), label: nav.union },
  { key: 'donate', href: '#donate', label: nav.donations },
  { key: 'projects', href: localePath(base, lang, '/projects/'), label: nav.projects },
  { key: 'contacts', href: '#contacts', label: nav.contacts },
];
---
<header class="site-header" data-header="">
  <div class="header-inner">
    <a href="#home" class="brand" aria-label="House of Bread Church">
      <img src={assetUrl(base, settings.logo)} alt={pick(settings.name, lang)} class="brand-logo">
    </a>

    <nav class="nav-desktop" aria-label={t(lang, 'a11y.mainNav')} data-navwrap="">
      {links.map((l) => <a class="nav-link" href={l.href} data-nav={l.key}>{pick(l.label, lang)}</a>)}
    </nav>

    <div class="header-actions">
      <a href={leaders} class="cta-leaders" title={pick(nav.leaders, lang)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7.5 4v5c0 4.6-3.2 7.4-7.5 9-4.3-1.6-7.5-4.4-7.5-9V7L12 3Z"></path><path d="M9 12l2 2 4-4"></path></svg>
        <span class="txt">{pick(nav.leaders, lang)}</span>
      </a>
      <LangSwitch lang={lang} path="/" /><a href={streams} target="_blank" rel="noopener noreferrer">
      <button type="button" class="cta-live" title={pick(cta.liveTitle, lang)}>
        <span class="live-dot" aria-hidden="true"></span>
        <span class="txt">{pick(cta.live, lang)}</span>
      </button>
      </a>
      <button type="button" class="hamburger" data-drawer-open="" aria-label={t(lang, 'a11y.openMenu')} aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>
      </button>
    </div>
  </div>
</header>

<div class="drawer-scrim" data-drawer-scrim=""></div>
<aside class="drawer" data-drawer="" aria-label={t(lang, 'a11y.mobileMenu')} aria-hidden="true">
  <div class="drawer-head">
    <span class="brand-name" style="color:#fff">House of Bread</span>
    <button type="button" class="drawer-close" data-drawer-close="" aria-label={t(lang, 'a11y.closeMenu')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>
    </button>
  </div>
  <nav class="drawer-nav" aria-label={t(lang, 'a11y.mobileNav')}>
    {links.map((l) => <a href={l.href} data-nav-m="">{pick(l.label, lang)}</a>)}
    <a href={leaders}>{pick(nav.leaders, lang)}</a>
  </nav>
  <div class="drawer-foot">
    <a href={streams} target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="width:100%;text-align:center"><span>{pick(cta.live, lang)}</span></a>
    <LangSwitch lang={lang} path="/" style="align-self:flex-start" />
  </div>
</aside>
```

`src/components/SiteFooter.astro`:

```astro
---
import { getEntry } from 'astro:content';
import { pick } from '../i18n';
import { assetUrl, localePath } from '../lib/paths.mjs';
import { telHref } from '../lib/format.mjs';
import { isPageEnabled } from '../lib/pages.mjs';
import { FACEBOOK, INSTAGRAM, YOUTUBE } from '../lib/svg.mjs';

interface Props {
  lang: 'uk' | 'en';
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const home = (await getEntry('homepage', 'main'))!.data;
const settings = (await getEntry('site-settings', 'main'))!.data;
const contact = (await getEntry('contact-info', 'main'))!.data;
const p = (pair: { uk: string; en: string }) => pick(pair, lang);

// Рішення 10: нові сторінки мають посилання лише тут. Поки тексту немає,
// пункт веде на секцію головної, як у легасі; коли текст зʼявиться — на
// сторінку. Пункт той самий, тож вигляд футера не змінюється ніколи.
const pageOr = async (id: 'about' | 'contacts' | 'donate', anchor: string) =>
  isPageEnabled((await getEntry('pages', id))!.data) ? localePath(base, lang, `/${id}/`) : anchor;
const aboutHref = await pageOr('about', '#about');
const donateHref = await pageOr('donate', '#donate');
const contactsHref = await pageOr('contacts', '#contacts');
---
<footer class="site-footer" id="projects">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="#home" class="brand">
          <img src={assetUrl(base, settings.logo)} alt={p(settings.name)} class="brand-logo">
        </a>
        <p>{p(home.footer.about)}</p>
      </div>
      <div class="footer-col">
        <h4>{p(home.footer.navTitle)}</h4>
        <a href={aboutHref}>{p(home.nav.about)}</a>
        <a href="#ministries">{p(home.nav.ministries)}</a>
        <a href="#media">{p(home.nav.media)}</a>
        <a href={donateHref}>{p(home.nav.donations)}</a>
        <a href={localePath(base, lang, '/projects/')}>{p(home.nav.projects)}</a>
      </div>
      <div class="footer-col">
        <h4>{p(home.footer.contactsTitle)}</h4>
        <a href={telHref(contact.phone)}>{contact.phoneDisplay}</a>
        <a href={`mailto:${contact.email}`}>{contact.email}</a>
        <a href={contactsHref}>{p(home.footer.addr)}</a>
      </div>
      <div class="footer-col">
        <h4>{p(home.footer.socialTitle)}</h4>
        <div class="footer-socials">
          <a href={settings.social.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Fragment set:html={YOUTUBE} /></a>
          <a href={settings.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Fragment set:html={FACEBOOK} /></a>
          <a href={settings.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Fragment set:html={INSTAGRAM} /></a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>{p(home.footer.copy)}</span>
      <span>{p(home.footer.built)}</span>
    </div>
  </div>
</footer>
```

- [ ] **Step 5: Головна — перші чотири секції і скрипти**

`src/pages/[...lang]/index.astro` — повністю замінити:

```astro
---
import { getCollection, getEntry } from 'astro:content';
import Base from '../../layouts/Base.astro';
import SiteHeader from '../../components/SiteHeader.astro';
import SiteFooter from '../../components/SiteFooter.astro';
import { t, pick } from '../../i18n';
import { assetUrl, localeParams } from '../../lib/paths.mjs';
import { ARROW_NEWS, FACEBOOK } from '../../lib/svg.mjs';
import '../../styles/pages/home.css';

export function getStaticPaths() {
  return localeParams();
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const h = (await getEntry('homepage', 'main'))!.data;
const settings = (await getEntry('site-settings', 'main'))!.data;
const donate = (await getEntry('donate-settings', 'main'))!.data;
const p = (pair: { uk: string; en: string }) => pick(pair, lang);
const streams = `${settings.social.youtube}/streams`;
const fbLocale = lang === 'en' ? 'en_US' : 'uk_UA';
const BELIEF_MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M6 9h12"></path></svg>';
---
<Base lang={lang} title={p(settings.name)}>
<div id="fb-root"></div>
<script is:inline async defer crossorigin="anonymous" src={`https://connect.facebook.net/${fbLocale}/sdk.js#xfbml=1&version=v19.0`}></script>

<SiteHeader lang={lang} />

<main>
<section class="hero" id="home" data-section="home" data-screen-label="Hero">
  <div class="hero-media">
    <picture>
      <source media="(max-width:680px)" srcset={assetUrl(base, h.heroImage.mobileSrc)}>
      <img src={assetUrl(base, h.heroImage.src)} alt={h.heroImage.alt} class="hero-media-photo">
    </picture>
  </div>
  <div class="hero-inner">
    <div class="hero-text">
      <span class="hero-tag" data-anim="1"><span>{p(h.hero.tag)}</span></span>
      <h1 data-anim="2" style="position: static" set:html={p(h.hero.title)}></h1>
      <p class="hero-meta" data-anim="3">
        <span style="font-weight: 700">{p(h.hero.vision)}</span><br><span style="font-weight: 700">{p(h.hero.addr)}</span>
        <span class="div" aria-hidden="true">·</span>
        <span style="font-weight: 700">{p(h.hero.time)}</span>
      </p>
      <div class="hero-actions" data-anim="4">
        <a class="btn btn-primary" href={streams}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
          <span>{p(h.hero.watch)}</span>
        </a>
        <a class="btn btn-ghost" href="#contacts"><span>{p(h.nav.contacts)}</span></a>
      </div>
    </div>
    <div class="hero-donate-card" data-anim="5">
      <div class="hero-donate-amount">
        <input type="number" inputmode="numeric" min="1" step="1" value={donate.defaultAmount} data-calc-amount aria-label={t(lang, 'a11y.donationAmount')}>
        <span class="hero-donate-currency">UAH</span>
      </div>
      <div class="hero-donate-quick">
        {donate.calcIncrements.map((n) => <button type="button" data-calc-add={n}>+{n} UAH</button>)}
      </div>
      <a class="btn btn-primary hero-donate-cta" href={donate.liqpayUrl} target="_blank" rel="noopener noreferrer"><span>{p(h.hero.donate)}</span></a>
    </div>
  </div>
  <a class="scroll-cue" href="#about" aria-label={t(lang, 'a11y.scrollDown')}>
    <span>{p(h.hero.scroll)}</span>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"></path></svg>
  </a>
</section>

<section class="section about" id="about" data-section="about" data-screen-label="About">
  <div class="container about-body reveal">
    <div class="section-head">
      <p class="eyebrow">{p(h.about.eyebrow)}</p>
      <h2 class="section-title">{p(h.about.title)}</h2>
      <p class="lead">{p(h.about.lead)}</p>
    </div>
    <p class="eyebrow" style="text-align:center">{p(h.about.beliefsTitle)}</p>
    <ul class="beliefs-list">
      {h.beliefs.map((b) => <li class="belief"><span class="belief-mark" aria-hidden="true"><Fragment set:html={BELIEF_MARK} /></span><p>{p(b)}</p></li>)}
    </ul>
  </div>
</section>

<section class="section news" id="media" data-section="media" data-screen-label="News">
  <div class="container reveal">
    <div class="section-head">
      <p class="eyebrow">{p(h.news.eyebrow)}</p>
      <h2 class="section-title">{p(h.news.title)}</h2>
      <p class="lead">{p(h.news.lead)}</p>
    </div>
    <div class="news-grid">
      {h.news.items.map((n) => (
        <article class="news-card">
          <div class="news-thumb"><img src={n.image.src} alt={n.image.alt}><span class="news-src"><Fragment set:html={FACEBOOK} />Facebook</span></div>
          <div class="news-body"><span class="news-date">{p(n.date)}</span><h3>{p(n.title)}</h3><p>{p(n.text)}</p><a class="news-more" href="#media">{p(h.news.more)} <Fragment set:html={ARROW_NEWS} /></a></div>
        </article>
      ))}
    </div>
    <div class="fb-embed" data-fb-feed="">
      <strong>{p(h.fb.title)}</strong>
      <span>{p(h.fb.text)}</span>
      <div class="fb-page"
        data-href={settings.social.facebook}
        data-tabs="timeline"
        data-width="760"
        data-height="360"
        data-small-header="true"
        data-hide-cover="true"
        data-show-facepile="false"
        data-adapt-container-width="true">
        <blockquote cite={settings.social.facebook} class="fb-xfbml-parse-ignore">
          <a href={settings.social.facebook}>Дім Хліба — House of Bread Church</a>
        </blockquote>
      </div>
      <noscript><a href={settings.social.facebook} target="_blank" rel="noopener">facebook.com/dom.hleba.org</a></noscript>
    </div>
  </div>
</section>

<section class="section believe-strip" id="union" data-section="union" data-screen-label="Believe">
  <div class="container reveal">
    <div class="section-head">
      <p class="eyebrow">{p(h.wwb.eyebrow)}</p>
      <h2 class="section-title">{p(h.wwb.title)}</h2>
    </div>
    <div class="believe-grid">
      {h.wwb.items.map((w, i) => <div class="believe-item"><div class="n">{String(i + 1).padStart(2, '0')}</div><h4>{p(w.title)}</h4><p>{p(w.text)}</p></div>)}
    </div>
  </div>
</section>

<!-- Задача 12: testimonies, ministries, pastors, contacts, donate -->
</main>

<SiteFooter lang={lang} />
</Base>

<script>
  const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string) => Array.from(document.querySelectorAll<T>(s));

  /* ---------- калькулятор пожертв у герої ---------- */
  const amount = $<HTMLInputElement>('[data-calc-amount]');
  if (amount) {
    amount.addEventListener('input', () => {
      amount.value = amount.value.replace(/[^0-9]/g, '');
    });
    // Прирости, а не пресети: кнопка додає до введеної суми (Етап 1, calcIncrements).
    for (const btn of $$('[data-calc-add]')) {
      btn.addEventListener('click', () => {
        amount.value = String((parseInt(amount.value, 10) || 0) + (parseInt(btn.dataset.calcAdd ?? '', 10) || 0));
      });
    }
  }

  /* ---------- липка шапка ---------- */
  const header = $('[data-header]');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 100);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- мобільна шторка ---------- */
  const drawer = $('[data-drawer]');
  const scrim = $('[data-drawer-scrim]');
  const openBtn = $('[data-drawer-open]');
  const setDrawer = (open: boolean) => {
    if (!drawer || !scrim) return;
    drawer.classList.toggle('is-open', open);
    scrim.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    openBtn?.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  openBtn?.addEventListener('click', () => setDrawer(true));
  $('[data-drawer-close]')?.addEventListener('click', () => setDrawer(false));
  scrim?.addEventListener('click', () => setDrawer(false));
  for (const a of $$('[data-nav-m]')) a.addEventListener('click', () => setDrawer(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setDrawer(false);
  });

  /* ---------- активний пункт меню ---------- */
  const navLinks = $$('.nav-link');
  const byKey = Object.fromEntries(navLinks.map((l) => [l.dataset.nav, l]));
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      navLinks.forEach((l) => l.classList.remove('is-active'));
      byKey[(e.target as HTMLElement).dataset.section ?? '']?.classList.add('is-active');
    }
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  for (const s of $$('section[data-section]')) spy.observe(s);

  /* ---------- поява блоків при прокрутці ---------- */
  const reveal = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      reveal.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  for (const el of $$('.reveal')) reveal.observe(el);

  /* ---------- анімація героя ---------- */
  requestAnimationFrame(() => document.body.classList.add('is-loaded'));
</script>
```

Коментар `<!-- Задача 12: … -->` — робоча позначка, яку Задача 12 замінює секціями; вона не доживає до кінця етапу.

- [ ] **Step 6: Прибрати виняток для головної в тестах сайту**

У `tests/site.test.js` видалити константу `PENDING` з коментарем над нею і рядок `if (PENDING.has(rel)) continue;`.

- [ ] **Step 7: Тести, e2e, порівняння**

Run: `npm test` → PASS
Run: `npm run e2e` → PASS
Run: `npm run visual -- --only home`
Expected: `OK` для секцій `header`, `hero`, `about`, `media`, `union`, `footer` на 4 комбінаціях; `FAIL … секції немає на новій сторінці` для `testimonies`, `ministries`, `pastors`, `contacts`, `donate` — їх додає Задача 12.

- [ ] **Step 8: Коміт**

```bash
git add src tests
git commit -m "feat: головна — шапка, шторка, футер, герой і перші секції

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 12: головна, частина 2 — свідчення, служіння, пастори, контакти, пожертви

**Files:**
- Modify: `src/pages/[...lang]/index.astro`, `tests/page-home.test.js`, `tests/e2e/home.e2e.js`

**Interfaces:**
- Consumes: `bindVideoTestimonies` (Задача 8), `Icon`, `coverImage`, `sortedData`, `initial`, `telHref`, `localePath`.

- [ ] **Step 1: Дописати падаючі тести**

У `tests/page-home.test.js` рядок імпорту з `./helpers/content.js` замінити на `import { readCollection, readSingleton } from './helpers/content.js';` і дописати в кінець:

```js
const byOrder = (a, b) => a.order - b.order;
const ministries = readCollection('ministries').map(({ data }) => data).sort(byOrder);
const pastors = readCollection('pastors').map(({ data }) => data).filter((p) => p.group === 'pastor').sort(byOrder);
const videos = readCollection('testimonies').map(({ data }) => data).filter((x) => x.type === 'video').sort(byOrder);

test('карусель: чотири текстові свідчення головної і відео з колекції', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    const section = root.querySelector('section.testimonies');
    assert.equal(section.getAttribute('id'), 'testimonies', 'рішення 9: якір для «назад»');
    const cards = section.querySelectorAll('.tst-card');
    assert.equal(cards.length, home.testimonies.items.length + videos.length);
    assert.equal(cards[0].querySelector('p').text, home.testimonies.items[0].text[lang]);
    assert.equal(cards[4].querySelector('.tst-video').getAttribute('data-yt'), videos[0].videoUrl);
    assert.equal(cards[4].querySelector('.tst-person span span').text, videos[0].role[lang]);
    assert.equal(section.querySelector('.tst-foot a').getAttribute('href'), href(`${prefix}testimonies/`));
  }
});

test('перші три служіння за order і пастори з колекції', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    const cards = root.querySelectorAll('#ministries .min-card');
    assert.deepEqual(cards.map((c) => c.getAttribute('href')), ministries.slice(0, 3).map((m) => href(`${prefix}ministries/${m.slug}/`)));
    assert.equal(cards[0].querySelector('h3').text, ministries[0].name[lang]);
    assert.equal(root.querySelector('#ministries .min-foot a').getAttribute('href'), href(`${prefix}ministries/`));
    const people = root.querySelectorAll('#pastors .pastor-card');
    assert.deepEqual(people.map((c) => c.querySelector('h3').text), pastors.map((p) => p.name));
    assert.deepEqual(people.map((c) => c.querySelector('.role').text), pastors.map((p) => p.role[lang]));
    assert.equal(root.querySelector('#pastors .pastors-foot a').getAttribute('href'), href(`${prefix}pastors/`));
  }
});

test('контакти — з contact-info, пожертви — з donate-settings, вірш з <cite> обома мовами', () => {
  for (const [lang, prefix] of LOCALES) {
    const root = loadPage(`${prefix}index.html`);
    const items = root.querySelectorAll('#contacts .contact-item');
    assert.equal(items[0].querySelector('.val').text, home.contacts.addr[lang]);
    assert.equal(items[1].querySelector('a').getAttribute('href'), `tel:${contact.phone}`);
    assert.equal(items[1].querySelector('a').text, contact.phoneDisplay);
    assert.equal(items[2].querySelector('a').getAttribute('href'), `mailto:${contact.email}`);
    assert.equal(root.querySelector('.service-times .time').text, `${home.contacts.svcDay[lang]} · ${contact.serviceTime}`);
    assert.equal(root.querySelector('.map-wrap iframe').getAttribute('src'), `${contact.mapUrl}&output=embed`);
    assert.deepEqual(
      root.querySelectorAll('.socials-row a').map((a) => a.getAttribute('href')),
      [settings.social.telegram, settings.social.facebook, settings.social.youtube, settings.social.instagram],
    );
    // Рішення 11: посилання на вірш — у шаблоні, на обох мовах.
    assert.equal(root.querySelector('#donate cite').text, home.donate.ref[lang]);
    assert.equal(root.querySelector('.donate-btn').getAttribute('href'), donate.liqpayUrl);
  }
});
```

У кінець `tests/e2e/home.e2e.js`:

```js
test('карусель свідчень гортається кнопками', async () => {
  const page = await site.open('');
  const track = page.locator('[data-tst-track]');
  await track.scrollIntoViewIfNeeded();
  await page.click('[data-tst-next]');
  await page.waitForFunction(() => document.querySelector('[data-tst-track]').scrollLeft > 0);
  await page.click('[data-tst-prev]');
  await page.waitForFunction(() => document.querySelector('[data-tst-track]').scrollLeft === 0);
  await page.close();
});

test('відеосвідчення на головній вставляє плеєр по кліку', async () => {
  const page = await site.open('');
  const button = page.locator('[data-tst-track] .tst-video').first();
  await button.scrollIntoViewIfNeeded();
  await button.click();
  assert.match(await page.locator('[data-tst-track] iframe').first().getAttribute('src'), /autoplay=1&rel=0$/);
  await page.close();
});

test('«назад» з підсторінки повертає до її секції на головній', async () => {
  // Рішення 9: замість sessionStorage — якір у посиланні «назад».
  const page = await site.open('pastors/');
  await page.click('.back-link');
  await page.waitForURL(/\/#pastors$/);
  await page.waitForFunction(() => {
    const top = document.querySelector('#pastors').getBoundingClientRect().top;
    return Math.abs(top) < 5;
  });
  await page.close();
});
```

- [ ] **Step 2: Переконатися, що падають**

Run: `npm test`
Expected: FAIL — `section.testimonies` не знайдено

- [ ] **Step 3: Секції**

У `src/pages/[...lang]/index.astro`:

1. У фронтматері замінити рядки імпорту `paths.mjs` і `svg.mjs` та додати три нові — разом імпорти мають виглядати так:

```ts
import Icon from '../../components/Icon.astro';
import { assetUrl, localePath, localeParams } from '../../lib/paths.mjs';
import { sortedData, coverImage } from '../../lib/collections.mjs';
import { initial, telHref } from '../../lib/format.mjs';
import {
  ARROW_BUTTON, ARROW_NEWS, FACEBOOK, INSTAGRAM, MAIL, PHONE, PIN, PLAY, TELEGRAM, YOUTUBE,
} from '../../lib/svg.mjs';
```

(імпорти `getCollection`/`getEntry`, `Base`, `SiteHeader`, `SiteFooter`, `t`/`pick` і `home.css` з Задачі 11 лишаються.)

2. Після `const donate = …` додати:

```ts
const contact = (await getEntry('contact-info', 'main'))!.data;
const ministries = sortedData(await getCollection('ministries')).slice(0, 3);
const pastors = sortedData(await getCollection('pastors')).filter((x) => x.group === 'pastor');
// Рішення 14: відеосвідчення — з колекції, а не з розмітки головної.
const videoTestimonies = sortedData(await getCollection('testimonies')).filter((x) => x.type === 'video');
const videoLabel = t(lang, 'testimony.videoLabel');
```

3. Рядок `<!-- Задача 12: testimonies, ministries, pastors, contacts, donate -->` замінити на:

```astro
<section class="section testimonies" id="testimonies" data-section="media" data-screen-label="Testimonies">
  <div class="container reveal">
    <div class="section-head">
      <p class="eyebrow">{p(h.testimonies.eyebrow)}</p>
      <h2 class="section-title">{p(h.testimonies.title)}</h2>
    </div>
    <div class="tst-track" data-tst-track="" data-video-title={videoLabel}>
      {h.testimonies.items.map((x) => (
        <figure class="tst-card"><div class="tst-quote" aria-hidden="true">“</div><p>{p(x.text)}</p><figcaption class="tst-person"><span class="tst-avatar">{initial(p(x.name))}</span><span><b>{p(x.name)}</b><span>{p(x.role)}</span></span></figcaption></figure>
      ))}
      {videoTestimonies.map((v) => (
        <figure class="tst-card">
          <button type="button" class="tst-video" data-yt={v.videoUrl} aria-label={t(lang, 'testimony.watch')}>
            <img src={v.poster} alt={videoLabel}>
            <span class="vlabel">{videoLabel}</span>
            <span class="play" aria-hidden="true"><Fragment set:html={PLAY} /></span>
          </button>
          <figcaption class="tst-person"><span class="tst-avatar">{initial(v.name)}</span><span><b>{v.name}</b><span>{p(v.role)}</span></span></figcaption>
        </figure>
      ))}
    </div>
    <div class="tst-ctrls">
      <button type="button" data-tst-prev="" aria-label={t(lang, 'a11y.prevTestimony')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"></path></svg></button>
      <button type="button" data-tst-next="" aria-label={t(lang, 'a11y.nextTestimony')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"></path></svg></button>
    </div>
    <div class="tst-foot">
      <a class="btn btn-outline" href={localePath(base, lang, '/testimonies/')}><span>{p(h.testimonies.all)}</span>
        <Fragment set:html={ARROW_BUTTON} /></a>
    </div>
  </div>
</section>

<section class="section ministries" id="ministries" data-section="ministries" data-screen-label="Ministries">
  <div class="container reveal">
    <div class="section-head">
      <p class="eyebrow">{p(h.ministries.eyebrow)}</p>
      <h2 class="section-title">{p(h.ministries.title)}</h2>
      <p class="lead">{p(h.ministries.lead)}</p>
    </div>
    <div class="min-grid" data-min-grid="">
      {ministries.map((m) => (
        <a class="min-card" href={localePath(base, lang, `/ministries/${m.slug}/`)}>
          <div class="min-thumb"><img loading="lazy" src={coverImage(m.media).src} alt={p(m.name)}>
            <span class="icon" aria-hidden="true"><Icon set="ministry" name={m.icon} /></span>
          </div>
          <div class="min-body"><h3>{p(m.name)}</h3><p>{p(m.summary)}</p></div>
        </a>
      ))}
    </div>
    <div class="min-foot">
      <a class="btn btn-outline" href={localePath(base, lang, '/ministries/')}><span>{p(h.ministries.all)}</span>
        <Fragment set:html={ARROW_BUTTON} /></a>
    </div>
  </div>
</section>

<section class="section pastors" id="pastors" data-section="about" data-screen-label="Pastors">
  <div class="container reveal">
    <div class="section-head">
      <p class="eyebrow">{p(h.pastors.eyebrow)}</p>
      <h2 class="section-title">{p(h.pastors.title)}</h2>
      <p class="lead">{p(h.pastors.lead)}</p>
    </div>
    <div class="pastor-grid">
      {pastors.map((x) => (
        <article class="pastor-card"><img src={x.photo} alt={x.name}><div class="pastor-info"><div class="role">{p(x.role)}</div><h3>{x.name}</h3></div></article>
      ))}
    </div>
    <div class="pastors-foot">
      <a class="btn btn-ghost" href={localePath(base, lang, '/pastors/')}><span>{p(h.pastors.all)}</span>
        <Fragment set:html={ARROW_BUTTON} /></a>
    </div>
  </div>
</section>

<section class="section contacts" id="contacts" data-section="contacts" data-screen-label="Contacts">
  <div class="container reveal">
    <div class="section-head">
      <p class="eyebrow">{p(h.contacts.eyebrow)}</p>
      <h2 class="section-title">{p(h.contacts.title)}</h2>
    </div>
    <div class="contacts-grid">
      <div class="contact-list">
        <div class="contact-item"><span class="ic"><Fragment set:html={PIN} /></span><div><div class="lbl">{p(h.contacts.addrLbl)}</div><span class="val">{p(h.contacts.addr)}</span></div></div>
        <div class="contact-item"><span class="ic"><Fragment set:html={PHONE} /></span><div><div class="lbl">{p(h.contacts.phoneLbl)}</div><a href={telHref(contact.phone)}>{contact.phoneDisplay}</a></div></div>
        <div class="contact-item"><span class="ic"><Fragment set:html={MAIL} /></span><div><div class="lbl">{p(h.contacts.emailLbl)}</div><a href={`mailto:${contact.email}`}>{contact.email}</a></div></div>
        <div class="service-times"><div class="lbl">{p(h.contacts.svcLbl)}</div><div class="time"><span class="day">{p(h.contacts.svcDay)}</span> · {contact.serviceTime}</div></div>
        <div class="contact-socials">
          <div class="lbl">{p(h.contacts.socialLbl)}</div>
          <div class="socials-row">
            <a href={settings.social.telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram"><Fragment set:html={TELEGRAM} /></a>
            <a href={settings.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Fragment set:html={FACEBOOK} /></a>
            <a href={settings.social.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Fragment set:html={YOUTUBE} /></a>
            <a href={settings.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Fragment set:html={INSTAGRAM} /></a>
          </div>
        </div>
      </div>
      <div class="map-wrap">
        <iframe title={t(lang, 'a11y.mapTitle')} loading="lazy" referrerpolicy="no-referrer-when-downgrade" src={`${contact.mapUrl}&output=embed`}></iframe>
      </div>
    </div>
  </div>
</section>

<section class="section donate" id="donate" data-section="donate" data-screen-label="Donate">
  <div class="container reveal">
    <p class="eyebrow">{p(h.donate.eyebrow)}</p>
    <h2 class="section-title">{p(h.donate.title)}</h2>
    <blockquote>{p(h.donate.quote)}
      <cite>{p(h.donate.ref)}</cite>
    </blockquote>
    <a href={donate.liqpayUrl} class="donate-btn" target="_blank" rel="noopener noreferrer">{p(h.donate.btn)}</a>
    <p class="donate-thanks">{p(h.donate.thanks)}</p>
  </div>
</section>
```

Легасі-іконки контактів (`PIN`, `PHONE`, `MAIL`) відрізняються від `svg.mjs` лише закриттям тегів (`</path>` проти `/>`) — пікселів це не змінює; якщо `npm run visual` покаже різницю в `.contact-item .ic`, взяти розмітку дослівно з `index.html:690-692`.

4. Першим рядком усередині `<script>` (модульний скрипт: `import` лише нагорі) додати

```ts
  import { bindVideoTestimonies } from '../../scripts/video-testimonies.mjs';
```

а після блоку шторки:

```ts
  /* ---------- карусель свідчень і відео по кліку ---------- */
  const track = $('[data-tst-track]');
  if (track) {
    const cards = Array.from(track.querySelectorAll<HTMLElement>('.tst-card'));
    const cardLeft = (card: HTMLElement) =>
      card.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
    const currentIndex = () => {
      let idx = 0;
      let min = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(cardLeft(c) - track.scrollLeft);
        if (d < min) { min = d; idx = i; }
      });
      return idx;
    };
    const goTo = (i: number) => {
      const target = cards[Math.max(0, Math.min(cards.length - 1, i))];
      track.scrollTo({ left: cardLeft(target), behavior: 'smooth' });
    };
    $('[data-tst-next]')?.addEventListener('click', () => goTo(currentIndex() + 1));
    $('[data-tst-prev]')?.addEventListener('click', () => goTo(currentIndex() - 1));
    bindVideoTestimonies(track, track.dataset.videoTitle ?? '');
  }
```

- [ ] **Step 4: Тести, e2e, порівняння**

Run: `npm test` → PASS
Run: `npm run e2e` → PASS
Run: `npm run visual -- --only home`
Expected: `44/44` рядків `OK` або `KNOWN`; `KNOWN` — рівно `home-donate-en-desktop` і `home-donate-en-mobile` (рішення 11).

- [ ] **Step 5: Коміт**

```bash
git add src tests
git commit -m "feat: головна — свідчення, служіння, пастори, контакти, пожертви

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 13: нові сторінки `/about/`, `/contacts/`, `/donate/` за готовністю тексту

Зараз у всіх трьох `body: null` — після задачі збірка **не змінюється**. Задача готує шаблони й доводить тестом, що текст замовника вмикає сторінку в обох мовах разом із посиланням у футері.

**Files:**
- Create: `src/styles/pages/info.css`, `src/pages/[...lang]/about.astro`, `src/pages/[...lang]/contacts.astro`, `src/pages/[...lang]/donate.astro`
- Modify: `src/i18n/uk.json`, `src/i18n/en.json` (`fact.email`)
- Test: `tests/pages-toggle.test.js`

- [ ] **Step 1: Падаючий тест**

`tests/pages-toggle.test.js`:

```js
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { BASE_PATH } from '../astro.config.mjs';
import { distPath } from './helpers/dist.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const pagesFile = join(projectRoot, 'src/content/singletons/pages.json');
const MARKER = '__probe_body__';

// Тест тимчасово вписує текст у справжній pages.json (file()-завантажувач
// іншого джерела не бачить). Якщо попередній прогін убили посеред збірки,
// маркер лишився — повертаємо файл з git до старту.
before(() => {
  if (readFileSync(pagesFile, 'utf8').includes(MARKER)) {
    execFileSync('git', ['checkout', '--', pagesFile], { cwd: projectRoot });
  }
});

test('без тексту нових сторінок немає ні в збірці, ні у футері', () => {
  for (const id of ['about', 'contacts', 'donate']) {
    assert.equal(existsSync(distPath(`${id}/index.html`)), false, `/${id}/ зібрана без тексту`);
    assert.equal(existsSync(distPath(`en/${id}/index.html`)), false, `/en/${id}/ зібрана без тексту`);
  }
  const footer = readFileSync(distPath('index.html'), 'utf8');
  assert.doesNotMatch(footer, /href="[^"]*\/(about|contacts|donate)\/"/);
});

test('текст вмикає сторінку обома мовами і посилання у футері', { timeout: 180_000 }, () => {
  const original = readFileSync(pagesFile, 'utf8');
  const outDir = mkdtempSync(join(tmpdir(), 'hob-pages-'));
  try {
    const pages = JSON.parse(original);
    pages.about.body = { uk: `Перший абзац ${MARKER}.\n\nДругий абзац.`, en: `First paragraph ${MARKER}.\n\nSecond.` };
    writeFileSync(pagesFile, JSON.stringify(pages, null, 2));
    execFileSync(process.execPath, [join(projectRoot, 'node_modules/astro/astro.js'), 'build', '--outDir', outDir], {
      cwd: projectRoot, stdio: 'pipe', timeout: 150_000, killSignal: 'SIGKILL',
    });

    for (const [lang, prefix] of [['uk', ''], ['en', 'en/']]) {
      const page = parse(readFileSync(join(outDir, `${prefix}about/index.html`), 'utf8'));
      assert.equal(page.querySelector('h1').text, pages.about.title[lang]);
      assert.equal(page.querySelectorAll('.prose p').length, 2, `${lang}: абзаци не розділені`);
      const home = parse(readFileSync(join(outDir, `${prefix}index.html`), 'utf8'));
      const aboutLink = home.querySelectorAll('.footer-col')[0].querySelector('a');
      // Тимчасова збірка успадковує env, тож під BASE_PATH (Задача 14) теж.
      assert.equal(aboutLink.getAttribute('href'), `${BASE_PATH}${prefix}about/`);
    }
    // Решта дві лишилися вимкненими — сторінки вмикаються по одній.
    assert.equal(existsSync(join(outDir, 'contacts/index.html')), false);
  } finally {
    writeFileSync(pagesFile, original);
    rmSync(outDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Переконатися, що падає**

Run: `npm test`
Expected: FAIL — другий тест: `ENOENT … about/index.html` (шаблону ще немає); перший — PASS.

- [ ] **Step 3: Стилі і ключ словника**

У `src/i18n/uk.json` у групу `fact` додати `"email": "Ел. пошта"`, у `src/i18n/en.json` — `"email": "Email"`.

`src/styles/pages/info.css` — шапка й герой підсторінок дослівно з `ministries.dc.html` (рядки 41–62, 81–84 і медіа-правила без `.min-grid`) плюс нові правила прози й фактів з палітри наявних токенів:

```css
/* Нові сторінки (Спека 2). Шапка, герой і футер — дослівно з ministries.dc.html;
   проза й факти — нові правила з наявних токенів, без нових кольорів. */
:root{--maxw:1200px}
.site-header{position:sticky;top:0;height:var(--header-h);z-index:1000;display:flex;align-items:center;background:rgba(20,20,38,.92);backdrop-filter:blur(14px) saturate(140%);-webkit-backdrop-filter:blur(14px) saturate(140%);box-shadow:0 8px 30px rgba(0,0,0,.28);border-bottom:1px solid rgba(255,255,255,.06)}
.header-inner{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;width:100%;max-width:var(--maxw);margin-inline:auto;padding-inline:clamp(1.25rem,4vw,2.5rem)}
.brand{display:flex;align-items:center;gap:.7rem;color:#fff}
.brand:hover{color:#fff}
.brand-logo{height:46px;width:auto;display:block}
.back-link{display:inline-flex;align-items:center;gap:.5rem;min-height:44px;padding:.55rem 1.05rem;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.28);color:#fff;font-weight:600;font-size:.9rem;transition:background .2s var(--ease),transform .2s var(--ease)}
.back-link:hover{background:rgba(255,255,255,.16);color:#fff;transform:translateX(-2px)}
.back-link svg{width:17px;height:17px}
.header-actions{display:flex;align-items:center;gap:.6rem}
.lang-toggle{display:inline-flex;align-items:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px;min-height:40px}
.lang-toggle a{border:none;background:transparent;color:rgba(255,255,255,.7);font-weight:600;font-size:.8rem;padding:.4rem .7rem;min-height:34px;min-width:40px;border-radius:999px;cursor:pointer;transition:all .2s var(--ease);display:inline-flex;align-items:center;justify-content:center;line-height:normal}
.lang-toggle a:hover{color:rgba(255,255,255,.7)}
.lang-toggle a.is-active,.lang-toggle a.is-active:hover{background:#fff;color:var(--dark-section)}
.page-hero{background:radial-gradient(125% 125% at 50% 10%,#000 40%,#021784 100%);color:#fff;padding:clamp(3rem,7vw,5.5rem) 0;position:relative;overflow:hidden}
.page-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(80% 100% at 12% 0%,rgba(240,226,200,.22),transparent 60%)}
.page-hero .container{position:relative;z-index:1;max-width:760px}
.page-hero h1{color:#fff;font-size:clamp(2.2rem,4vw,3.4rem);font-weight:700;margin:0}
.section{padding:clamp(3rem,6vw,5rem) 0}
.site-footer{background:#101020;color:rgba(255,255,255,.6);padding:2.5rem 0;font-size:.85rem;margin-top:clamp(2rem,5vw,4rem)}
.site-footer .container{display:flex;justify-content:space-between;flex-wrap:wrap;gap:.75rem}
.site-footer a{color:rgba(255,255,255,.72)}
.site-footer a:hover{color:var(--accent)}

.info-layout{display:grid;grid-template-columns:1.5fr 1fr;gap:2.5rem;align-items:start}
.prose{max-width:760px}
.prose p{margin:0 0 1.2rem;color:var(--text-muted);line-height:1.75}
.facts{display:grid;gap:.75rem}
.fact{display:flex;gap:.85rem;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:var(--radius);padding:.9rem 1.1rem;box-shadow:var(--shadow-sm)}
.fact .ic{flex:none;width:44px;height:44px;border-radius:11px;background:var(--accent-soft);color:var(--text-primary);display:grid;place-items:center}
.fact .ic svg{width:22px;height:22px}
.fact .lbl{font-size:.72rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:.15rem}
.fact .val{font-weight:600;font-size:1.05rem;color:var(--text-primary)}
.page-cta{display:inline-flex;align-items:center;gap:.55rem;min-height:48px;padding:.85rem 1.6rem;border-radius:var(--radius);background:var(--accent);color:#231a06;font-weight:600;border:none;cursor:pointer;box-shadow:0 6px 18px rgba(240,226,200,.32);transition:transform .2s var(--ease),background .2s var(--ease);margin-top:.5rem}
.page-cta:hover{background:var(--accent-strong);transform:translateY(-2px);color:#231a06}

@media (max-width:900px){ .info-layout{grid-template-columns:1fr;gap:1.75rem} }
@media (max-width:600px){ .lang-toggle{order:-1} :root{--header-h:62px} .brand-logo{height:36px} }
@media (prefers-reduced-motion:reduce){ *{transition-duration:.001ms !important} }
```

- [ ] **Step 4: Три сторінки**

`src/pages/[...lang]/about.astro`:

```astro
---
import { getEntry } from 'astro:content';
import SubPage from '../../layouts/SubPage.astro';
import { t, pick } from '../../i18n';
import { localePath, localeParams } from '../../lib/paths.mjs';
import { paragraphs } from '../../lib/format.mjs';
import { isPageEnabled } from '../../lib/pages.mjs';
import '../../styles/pages/info.css';

// Спека 2: сторінка без власного тексту — дубль головної в індексі. Поки
// body: null, маршрут не генерує жодної сторінки.
export async function getStaticPaths() {
  const page = (await getEntry('pages', 'about'))!.data;
  return isPageEnabled(page) ? localeParams() : [];
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const page = (await getEntry('pages', 'about'))!.data;
const home = localePath(base, lang, '/');
---
<SubPage lang={lang} title={pick(page.title, lang)} path="/about/"
  back={{ href: home, label: t(lang, 'back.home') }}
  footBack={{ href: home, label: t(lang, 'footBack.home') }}>
<section class="page-hero">
  <div class="container"><h1>{pick(page.title, lang)}</h1></div>
</section>
<section class="section">
  <div class="container">
    <div class="prose">{paragraphs(pick(page.body!, lang)).map((text) => <p>{text}</p>)}</div>
  </div>
</section>
</SubPage>
```

`src/pages/[...lang]/contacts.astro`:

```astro
---
import { getEntry } from 'astro:content';
import SubPage from '../../layouts/SubPage.astro';
import { t, pick } from '../../i18n';
import { localePath, localeParams } from '../../lib/paths.mjs';
import { paragraphs, telHref } from '../../lib/format.mjs';
import { isPageEnabled } from '../../lib/pages.mjs';
import { MAIL, PHONE, PIN } from '../../lib/svg.mjs';
import '../../styles/pages/info.css';

export async function getStaticPaths() {
  const page = (await getEntry('pages', 'contacts'))!.data;
  return isPageEnabled(page) ? localeParams() : [];
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const page = (await getEntry('pages', 'contacts'))!.data;
// Факти — лише з contact-info (Спека 1: єдине джерело правди), проза — своя.
const contact = (await getEntry('contact-info', 'main'))!.data;
const home = localePath(base, lang, '/');
---
<SubPage lang={lang} title={pick(page.title, lang)} path="/contacts/"
  back={{ href: home, label: t(lang, 'back.home') }}
  footBack={{ href: home, label: t(lang, 'footBack.home') }}>
<section class="page-hero">
  <div class="container"><h1>{pick(page.title, lang)}</h1></div>
</section>
<section class="section">
  <div class="container info-layout">
    <div class="prose">{paragraphs(pick(page.body!, lang)).map((text) => <p>{text}</p>)}</div>
    <div class="facts">
      <div class="fact"><span class="ic"><Fragment set:html={PIN} /></span><div><div class="lbl">{t(lang, 'fact.address')}</div><div class="val">{pick(contact.city, lang)}, {pick(contact.address, lang)}</div></div></div>
      <div class="fact"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><div><div class="lbl">{t(lang, 'fact.times')}</div><div class="val">{pick(contact.serviceDay, lang)} · {contact.serviceTime}</div></div></div>
      <div class="fact"><span class="ic"><Fragment set:html={PHONE} /></span><div><div class="lbl">{t(lang, 'fact.phone')}</div><a class="val" href={telHref(contact.phone)}>{contact.phoneDisplay}</a></div></div>
      <div class="fact"><span class="ic"><Fragment set:html={MAIL} /></span><div><div class="lbl">{t(lang, 'fact.email')}</div><a class="val" href={`mailto:${contact.email}`}>{contact.email}</a></div></div>
      <a class="page-cta" href={contact.mapUrl} target="_blank" rel="noopener noreferrer"><span>{t(lang, 'cta.directions')}</span></a>
    </div>
  </div>
</section>
</SubPage>
```

`src/pages/[...lang]/donate.astro`:

```astro
---
import { getEntry } from 'astro:content';
import SubPage from '../../layouts/SubPage.astro';
import { t, pick } from '../../i18n';
import { localePath, localeParams } from '../../lib/paths.mjs';
import { paragraphs } from '../../lib/format.mjs';
import { isPageEnabled } from '../../lib/pages.mjs';
import '../../styles/pages/info.css';

export async function getStaticPaths() {
  const page = (await getEntry('pages', 'donate'))!.data;
  return isPageEnabled(page) ? localeParams() : [];
}

const { lang } = Astro.props;
const base = import.meta.env.BASE_URL;
const page = (await getEntry('pages', 'donate'))!.data;
// Реквізити — з donate-settings, а не текстом у прозі (Спека 1).
const donate = (await getEntry('donate-settings', 'main'))!.data;
const heroDonate = (await getEntry('homepage', 'main'))!.data.hero.donate;
const home = localePath(base, lang, '/');
---
<SubPage lang={lang} title={pick(page.title, lang)} path="/donate/"
  back={{ href: home, label: t(lang, 'back.home') }}
  footBack={{ href: home, label: t(lang, 'footBack.home') }}>
<section class="page-hero">
  <div class="container"><h1>{pick(page.title, lang)}</h1></div>
</section>
<section class="section">
  <div class="container">
    <div class="prose">{paragraphs(pick(page.body!, lang)).map((text) => <p>{text}</p>)}</div>
    <a class="page-cta" href={donate.liqpayUrl} target="_blank" rel="noopener noreferrer"><span>{pick(heroDonate, lang)}</span></a>
  </div>
</section>
</SubPage>
```

- [ ] **Step 5: Тести**

Run: `npm test`
Expected: PASS; `git diff --exit-code src/content/singletons/pages.json` — порожньо (тест повернув файл).

- [ ] **Step 6: Коміт**

```bash
git add src tests
git commit -m "feat: /about/, /contacts/, /donate/ вмикаються з текстом замовника

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 14: наскрізна перевірка перед кутовером

**Files:**
- Modify: `tests/build.test.js`
- Create: `tests/e2e/lang.e2e.js`

- [ ] **Step 1: Перевірка посилань під довільним підшляхом**

У `tests/build.test.js` імпортувати `import { findBrokenLinks } from './helpers/links.js';` і в тесті `'SITE_URL і BASE_PATH дійсно керують збіркою…'` перед `} finally {` додати:

```js
      // Review Focus 2: посилання, записане як «/ministries/», локально
      // працює, а під підшляхом GitHub Pages — 404. Лише збірка з іншим
      // base це показує.
      assert.deepEqual(findBrokenLinks(outDir, '/verify-base/'), []);
```

- [ ] **Step 2: e2e перемикача мов**

`tests/e2e/lang.e2e.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useSite } from './helpers.js';

const site = useSite();

test('перемикач веде на ту саму деталку іншою мовою', async () => {
  const page = await site.open('ministries/youth/');
  await page.click('.lang-toggle a[hreflang="en"]');
  await page.waitForURL(/\/en\/ministries\/youth\/$/);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('h1').textContent(), 'Youth');
  await page.close();
});

test('збережена в localStorage мова нікуди не перенаправляє', async () => {
  // Спека 2: автоперехід — блокер індексації en. Імітуємо відвідувача, у
  // якого від легасі лишилося hob-lang=uk.
  const context = await site.browser.newContext();
  await context.addInitScript(() => localStorage.setItem('hob-lang', 'uk'));
  const page = await context.newPage();
  await page.goto(`${site.server.origin}/en/ministries/`);
  await page.waitForTimeout(500);
  assert.match(page.url(), /\/en\/ministries\/$/);
  await context.close();
});
```

- [ ] **Step 3: Повні прогони**

Run: `npm test` → PASS
Run: `MSYS_NO_PATHCONV=1 SITE_URL=https://igorgnutov.github.io BASE_PATH=/--House-of-Bread-Church-Website/ npm test` → PASS (той самий набір під підшляхом, як у CI)
Run: `npm run e2e` → PASS
Run: `npm run visual`
Expected: жодного `FAIL`; `KNOWN` — рівно `home-donate-en-desktop`, `home-donate-en-mobile`. Підсумковий рядок `N/N OK`.

- [ ] **Step 4: Ручна перевірка того, що не автоматизовано**

Run: `npm run preview` і відкрити `http://localhost:4321/`:
- стрічка Facebook завантажується на `/` (українська) і `/en/` (англійська SDK);
- карта Google в контактах показує церкву;
- «Пряма трансляція» відкриває YouTube у новій вкладці;
- LiqPay з героя й секції пожертв відкривається.

Записати результат одним рядком у повідомлення коміту.

- [ ] **Step 5: Коміт**

```bash
git add tests
git commit -m "test: посилання під підшляхом і перемикач мов без автоперенаправлення

Візуальне порівняння: N/N OK (KNOWN: home-donate-en ×2). Вручну: FB, карта,
трансляція, LiqPay — працюють.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Задача 15: кутовер — видалення легасі, деплой, CLAUDE.md

**Що потрібно від людини до Step 5:** у налаштуваннях репозиторію GitHub Pages перевести джерело на **GitHub Actions** (Settings → Pages → Build and deployment → Source: GitHub Actions). Наслідок: до першого успішного запуску воркфлоу публічна адреса не показує нічого; після — нову збірку замість легасі. Це рішення власника репозиторію.

**Files:**
- Delete: `index.html`, `church.dc.html`, `churches.dc.html`, `leaders.dc.html`, `ministries.dc.html`, `ministry.dc.html`, `pastors.dc.html`, `project.dc.html`, `projects.dc.html`, `testimonies.dc.html`, `churches-data.js`, `ministries-data.js`, `projects-data.js`, `testimonies-data.js`, `support.js`, `fonts/`, `uploads/logo.png`, `uploads/hero-cross.jpg`, `uploads/hero-cross-mobile.jpg`, `scripts/port-legacy-css.mjs`, `scripts/visual/`, `tests/port-css.test.js`
- Move: `uploads/draw-*.png` → `public/uploads/`
- Create: `.github/workflows/deploy.yml`
- Modify: `package.json` (прибрати `pixelmatch`, `pngjs`, скрипт `visual`), `.gitignore`, `CLAUDE.md`, `docs/superpowers/specs/2026-09-22-01-astro-migration-design.md`, `docs/superpowers/notes/2026-09-23-content-gaps.md`

- [ ] **Step 1: Видалити легасі й інструменти порівняння**

```bash
git rm index.html church.dc.html churches.dc.html leaders.dc.html ministries.dc.html ministry.dc.html \
  pastors.dc.html project.dc.html projects.dc.html testimonies.dc.html \
  churches-data.js ministries-data.js projects-data.js testimonies-data.js support.js
git rm -r fonts scripts/visual scripts/port-legacy-css.mjs tests/port-css.test.js
git rm uploads/logo.png uploads/hero-cross.jpg uploads/hero-cross-mobile.jpg
git mv uploads/draw-95de623a-3c7b-42c3-9faa-317b43fc0ae7.png uploads/draw-a3628a96-b105-4cb8-b944-cfb73ae01779.png uploads/draw-c1eeab26-f3b5-4943-8d15-fb336d37f0f9.png public/uploads/
npm uninstall pixelmatch pngjs
```

У `package.json` прибрати скрипт `visual`. Playwright і `scripts/lib/static-server.mjs` **лишаються** — на них `npm run e2e`. З `.gitignore` прибрати `.visual/`.

`draw-*.png` ніде не використовуються, але це завантаження користувача — переносимо, а не видаляємо.

- [ ] **Step 2: Переконатися, що нічого не посилається на видалене**

```bash
git grep -nE '\.dc\.html|support\.js|-data\.js|port-legacy-css|scripts/visual|pixelmatch' -- ':!docs' ':!package-lock.json'
```

Expected: порожній вивід. Будь-який збіг у `src/` чи `tests/` — виправити перед комітом.

Run: `npm test` → PASS
Run: `npm run e2e` → PASS

- [ ] **Step 3: Воркфлоу деплою**

`.github/workflows/deploy.yml`:

```yaml
name: Build and deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

# Дозволи рівно під деплой на Pages, і нічого більше.
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

      # Сторінки проєкту живуть під підшляхом. Коли зʼявиться домен —
      # SITE_URL на нього, BASE_PATH на "/" (Етап 0).
      # npm test замість npm run build: зламана збірка чи бите посилання
      # під підшляхом не доїдуть до ефіру.
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

- [ ] **Step 4: Документація**

`CLAUDE.md` — повністю замінити:

````markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static website for "Дім Хліба" (House of Bread Church), Kryvyi Rih, built with **Astro 5**
(static output, no server). Ukrainian lives at the root, English under `/en/`; slugs are English
and shared by both locales. Roadmap and specs: `docs/superpowers/specs/`, implementation plans:
`docs/superpowers/plans/`.

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm test` — `astro build` (also validates the content schema) + `node --test` over `tests/*.test.js`
- `npm run e2e` — Playwright browser tests in `tests/e2e/` (needs `npx playwright install chromium` once)
- A build under a sub-path: `SITE_URL=… BASE_PATH=/sub/ npm test`. On Windows/Git Bash prefix
  with `MSYS_NO_PATHCONV=1` or use PowerShell.

## Content

All content is in typed Content Collections: data under `src/content/**`, schemas in
`src/content.config.ts`, UI strings in `src/i18n/{uk,en}.json`. Every localized field is
`{uk, en}` and **both are required** — a missing translation fails the build on purpose. Edit
the JSON directly; there is no generator. Collection records carry an explicit `order` (the glob
loader does not guarantee file order). `pages.{about,contacts,donate}` build only once their
`body` is non-null (Spec 2: no empty pages in the index); their only links are in the homepage
footer.

## Pages and routing

One route file per page under `src/pages/[...lang]/` produces both locales via `localeParams()`;
detail pages (`ministries/[slug]`, `churches/[slug]`, `projects/[slug]`) use `getStaticPaths()`.
Build every internal URL with `localePath(base, lang, path)` / `assetUrl(base, src)` from
`src/lib/paths.mjs` (`base = import.meta.env.BASE_URL`) — a hand-written `/…` breaks on the
GitHub Pages sub-path. The language switcher is plain links; never add `localStorage`-based
language detection or redirects (blocks indexing of `/en/`, enforced by `tests/site.test.js`).

## Styling

The design was ported 1:1 from the legacy static site and verified pixel-by-pixel. Shared CSS:
`src/styles/{fonts,tokens,base}.css` (imported by `Base.astro`). Each page imports its own global
stylesheet from `src/styles/pages/`; the gallery has `src/styles/gallery.css`. **No `<style>`
blocks in `.astro` files** — scoped styles raise specificity and break the page media queries
(enforced by a test). Keep the existing tokens (`--bg`, `--accent`, `--ink-blue`, …) instead of
adding new colours. Icons are inline SVG (`src/lib/icons.mjs`, `src/lib/svg.mjs`).

Fonts are self-hosted in `public/fonts/`: **Nyght Serif** (`--font-display`) ships only
Regular/Bold, so headings use `font-weight:700` — never `600` on display text; **Fixel Text**
(`--font-body`) has a real 600. See `public/fonts/nyght-serif/NOTICE.md` for licensing.

## Deploy

`.github/workflows/deploy.yml`: push to `main` → `npm test` with the Pages `SITE_URL`/`BASE_PATH`
→ GitHub Pages. Production hosting (ukraine.com.ua, rsync over SSH) is pending a domain — see
Stage 0 plan, Task 5.

## Next

Stage 3 (Spec 2): meta tags, `hreflang`, JSON-LD, `sitemap.xml`, `robots.txt`, `.htaccess`.
Open content gaps for the customer: `docs/superpowers/notes/2026-09-23-content-gaps.md`.
````

У `docs/superpowers/specs/2026-09-22-01-astro-migration-design.md`, розділ «Критерії готовності», відмітити `[x]` для: «Весь контент…», «190 ключів…», «11 пасторів…», «Усі 10 сторінок перенесені…», «Сайт візуально не відрізняється…», «`support.js` видалений…», «`CLAUDE.md` оновлений». Пункт про ukraine.com.ua лишити `[ ]`.

У `docs/superpowers/notes/2026-09-23-content-gaps.md` додати рядки таблиці:

| # | Що | Де | Наслідок, якщо лишити |
|---|---|---|---|
| 18 | Англійські підписи доступності (`a11y.*`) перекладені розробником | `src/i18n/en.json` | переклади очевидні, але не погоджені замовником |
| 19 | `homepage.pastors.role` / `role2` більше не використовуються — ролі пасторів на головній беруться з колекції `pastors` | `homepage.pastors` | зайві поля переїдуть у Storyblok, якщо не прибрати до Спеки 3 |
| 20 | Адреса месенджера (`https://m.me/dom.hleba.org`) і пошта координатора (`leaders@houseofbread.church`) — у шаблонах, не в даних | `pastors.astro`, `leaders.astro` | редактор не змінить їх без коду; кандидати в поля `help.url` для Спеки 3 |
| 21 | Лічильники «6 файлів» / «6 ресурсів» — статичні рядки словника | `docs.count`, `res.count` | при додаванні сьомого ресурсу лічильник збреше; потрібні форми множини для uk |
| 22 | `footer.built` — «Побудовано на Next.js + PayloadCMS» | `homepage.footer.built` | неправда про стек сайту на кожній сторінці |

- [ ] **Step 5: Коміт і, за рішенням власника, пуш**

```bash
git add -A
git commit -m "chore: кутовер — легасі видалено, деплой на GitHub Pages, новий CLAUDE.md

Сайт повністю на Astro: 10 сторінок, обидві локалі, вигляд звірено
піксельно з легасі перед видаленням (Задача 14).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Пуш у `main` запускає деплой. Робити його лише після того, як власник переключив джерело Pages (див. початок задачі). Після пушу:

```bash
gh run watch
SITE=https://igorgnutov.github.io/--House-of-Bread-Church-Website
curl -sI "$SITE/ministries/youth/" | head -1
curl -s "$SITE/en/" | grep -o '<html[^>]*lang="en"'
curl -sI "$SITE/uploads/logo.png" | head -1
```

Expected: `HTTP/2 200`, `lang="en"`, `HTTP/2 200`.

---

## Критерії готовності Етапу 2

- [ ] Усі 10 сторінок перебудовані з колекцій, обидві локалі за реальними адресами (`/…/` і `/en/…/`), деталки — на кожен slug
- [ ] `npm run visual` перед видаленням легасі: жодного FAIL, `KNOWN` лише `home-donate-en` ×2
- [ ] Уся поведінка з інвентаря Спеки 1 перевірена `npm run e2e`
- [ ] Перемикач мов — посилання на ту саму сторінку; `localStorage`/автоперенаправлення немає (тест)
- [ ] Кожне внутрішнє посилання веде на файл збірки і під довільним `BASE_PATH` (тест)
- [ ] Галерея — один компонент на трьох типах деталок
- [ ] `/about/`, `/contacts/`, `/donate/` вмикаються з текстом, без тексту — не існують (тест)
- [ ] `support.js`, `*-data.js`, легасі-HTML видалені; `CLAUDE.md` описує новий стан
- [ ] Воркфлоу деплою в репозиторії; після переключення Pages сайт відповідає 200 під підшляхом

**Поза обсягом Етапу 2:** мета-теги, `hreflang`, OG, JSON-LD, `sitemap.xml`, `robots.txt`, `.htaccess`, 301 зі старих `*.dc.html` — це Етап 3. Деплой на ukraine.com.ua — Задача 5 Етапу 0, чекає домену. Заміна заглушок `picsum`/`unsplash` і тексти нових сторінок — актуалізація контенту замовником.
