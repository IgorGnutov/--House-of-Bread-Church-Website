# Етап 4: модель Storyblok і заливка даних — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Весь контент сайту (70 історій) лежить у просторі Storyblok «Dim Hliba» у парних полях uk/en, завантажений ідемпотентним імпортом із сухим прогоном, а `npm run cms:verify` на живому просторі показує нуль розбіжностей із файлами.

**Architecture:** Zod-схема виноситься з `content.config.ts` у `src/lib/schema.mjs`, щоб її бачили і Astro, і скрипти, і тести. Поруч — декларативна модель Storyblok (`src/lib/storyblok/model.mjs`), яку `checkModel()` звіряє зі схемою; чисті перетворення `toStory` / `fromStory` (`convert.mjs`) і генератор JSON компонентів (`components.mjs`). Скрипти `scripts/cms/` (клієнт Management API з лімітом 3 запити/с, читання й валідація контенту, план/застосування імпорту, звірка) тестуються на фейковому Management API в памʼяті. Живий простір залучається лише в останній задачі.

**Tech Stack:** Node 22 (вбудовані `fetch`, `FormData`, `Blob`, `node:crypto`, `node:http`, `--env-file`), zod 3 з `astro/zod`, `node:test`. Нових залежностей немає.

**Spec:** [2026-09-22-03-storyblok-cms-design.md](../specs/2026-09-22-03-storyblok-cms-design.md): розділи «Відображення схеми на Storyblok» і «Міграція даних (Етап 4)». Етапи 5–6 (підключення до Astro, прев'ю, Visual Editor, передача редактору) сюди **не** входять.
Попередні етапи: [Етап 3](2026-09-23-astro-stage-3.md). Дірки контенту: [2026-09-23-content-gaps.md](../notes/2026-09-23-content-gaps.md) (рядок 18 закривається тут).

## Global Constraints

- **Node ≥ 22**, Astro `^5.18.2`, zod `3.25` (через `import { z } from 'astro/zod'`). **Нових залежностей немає**: HTTP через вбудований `fetch`, multipart через `FormData`/`Blob`, фейковий API на `node:http`.
- **Правила схеми не змінюються.** Винесення в `schema.mjs` переносить їх дослівно. Єдина зміна даних і схеми — прибрати `homepage.pastors.role` / `role2` (Задача 2).
- **Мовний механізм Storyblok не використовується:** пара `{uk, en}` — це поля `<ключ>_uk` / `<ключ>_en` з підписами «… (укр.)» / «… (англ.)».
- **Модель у межах тарифу Starter:** жодної платної функції. Регіон **EU** (`https://mapi.storyblok.com`), ліміт **3 запити/с**.
- **Токен** читається лише з `.env` (`STORYBLOK_MANAGEMENT_TOKEN`, `STORYBLOK_SPACE_ID`, `STORYBLOK_REGION`) через `node --env-file=.env`. Він не потрапляє в код, тести, логи чи повідомлення про помилки. `.env` уже в `.gitignore`.
- **`npm test` не ходить у мережу й не потребує токена.** Живий простір у CI не залучається.
- **Контракт з адмінкою** (CLAUDE.md): тести виводять очікування з контенту, який читають, і не пришпилюють поточних значень чи кількостей. `src/content` тести не змінюють ніколи. Копії для проб створює `ContentFixture` з `tests/helpers/build.js`.
- Коментарі й назви тестів **українською**; коментар пояснює *чому*, а не *що*. Стиль коду: ESM `.mjs`, 2 пробіли, одинарні лапки, крапка з комою.
- Файли контенту в робочому дереві з CRLF (`core.autocrlf=true`), в індексі з LF. Правити їх точково (Edit), а не перезаписом усього JSON.
- Кожна задача закінчується `npm test` без жодного FAIL і окремим комітом. Кінцівка кожного коміту:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

## Зафіксовані рішення цього плану

У цих місцях спека допускає кілька прочитань. Якщо ревʼю не згодне, правити **до** старту.

| # | Питання | Рішення | Підстава |
|---|---|---|---|
| 1 | Назва компонента сторінок | `site_page`, а не `page` | `page` — демо-компонент нового простору, який перший `--apply` видаляє. Тест (Задача 5) гарантує, що наші назви не перетинаються з демо-набором `page`, `teaser`, `grid`, `feature` |
| 2 | Що саме хешує відбиток | SHA-256 стабільного JSON (ключі відсортовано) результату `fromStory(story)`. Картинки медіатеки входять як їхні URL. Поле `import_hash`, вкладка «Службове» | Одна функція для обох боків: при записі відбиток рахується з історії, яку пишемо, а при перевірці — з того, що зараз лежить у Storyblok. Порівняння йде за даними, тож Storyblok може додавати свої ключі (`alt: null`, `meta_data`), а перейменування історії не вважається правкою |
| 3 | Історію змінено в Storyblok (відбиток не збігається) | Імпорт не перезаписує **цю** історію, решту застосовує, код виходу 1. `--force` перезаписує | Відмова стосується конкретної історії (спека: «відмовляється *її* перезаписувати»). Правка редактора в одній історії не блокує оновлення моделі |
| 4 | Зайві компоненти (є в Storyblok, немає в моделі) | попередження; `--prune` видаляє їх разом із зайвими історіями | Інакше перейменований у моделі компонент висів би в адмінці назавжди. Демо-компоненти прибираються першим `--apply` без прапорця |
| 5 | Демо-вміст | фіксований список: компоненти `page`, `teaser`, `grid`, `feature` і історія `home` у корені (лише якщо в неї `component: page`) | спека: «окремий рядок плану, прибирається першим `--apply`». Жодна інша історія поза нашими папками не чіпається |
| 6 | Назва історії (`name`) | `title.uk` / `name.uk` запису (у пасторів і свідчень — рядок `name`), для сторінок — `title.uk`, для одиночок — фіксовані «Головна сторінка», «Налаштування сайту», «Контакти», «Пожертви»; фолбек — slug | Назва потрібна лише для списку в адмінці. Вона не входить у дані й у відбиток |
| 7 | Де поле «Порядок» | вкладка «Службове» разом із відбитком | це технічне поле; основну вкладку «Контент» займає текст |
| 8 | Обмеження папки типами | `content: { content_types: [...], lock_subfolders_content_types: false }` і `default_root` на історії-папці; план порівнює й оновлює | спосіб із документації MAPI («Create and Manage Folders»). Що це поле працює й при створенні, документація не підтверджує. Перевіряється в Задачі 10 |
| 9 | Порядок перевірок імпорту | схема, унікальність slug, id сторінок і наявність файлів `uploads/…` у `public/` перевіряються **до першого запиту**, навіть до читання | спека: «невалідні дані не доходять до Storyblok узагалі». Тест вимагає нуль запитів, а не лише нуль записів |
| 10 | Той самий файл удруге | збіг «параметризованого» імені (Storyblok міняє всі крапки, крім останньої, на `_`) **і** SHA-256 вмісту. Кандидатів з тим самим іменем завантажує й хешує | спека: «за іменем і SHA-256». Самого хешу API не віддає |
| 11 | Документи лідерів у медіатеці | поле `file` (asset без обмеження типів, зовнішня адреса дозволена). Зараз усі `url` — `null`, тож файлів-документів немає | за документацією простір без платіжних даних приймає лише `image/*`. Коли зʼявляться PDF, це може впертися в тариф. Записано в Задачі 11 як ризик Етапу 6 |
| 12 | `format` у документа, `icon` у посилання | у схемі `nullable` (так і в моделі), але в формі свого варіанта позначені `required` | обовʼязковість задає `refine` схеми і сам варіант. Форма редактора має показати її одразу, а не лише падінням збірки |
| 13 | Дискримінатори (`type`, `kind`, чуже для варіанта поле) | це не поля, а `fixed`-значення компонента: `testimony_text` → `type: 'text'`, `resource_link` → `kind: 'link', format: null`, `gallery_video` → `type: 'video'` | тип контенту й визначає варіант (спека: «два типи контенту»). Окреме поле могло б суперечити компоненту |
| 14 | Звірка, крім полів | `cms:verify` також повідомляє про історію, якої немає; про зайву історію в наших папках; про неопубліковані зміни (`published: false` чи `unpublished_changes: true`) | Етап 5 читатиме опубліковану версію. Неопублікована правка або зайва історія розвели б сайт і файли так само, як неправильне поле |
| 15 | Деталі API, яких документація не підтверджує (ключ вкладки `tab-<uuid>`, форма зовнішнього asset, `content_types` при створенні, чи зберігає API `required`/`minimum`) | фейковий API відтворює документовану поведінку. Задача 10 проганяє живий простір, і кожна розбіжність спершу стає зміною фейку й тестом, а потім виправленням | інакше тести зеленіли б на вигаданому API |

## Структура файлів

| Файл | Відповідальність |
|---|---|
| `src/lib/schema.mjs` (новий) | zod-схеми всіх колекцій (`schemas`), `PAGE_IDS`, `localized`, `localizedHtml`, `RESOURCE_FORMATS`, `PASTOR_GROUPS`. Правила дослівно з `content.config.ts` |
| `src/content.config.ts` | лише завантажувачі (`collectionLoader`, `singletonLoader`) і підключення `schemas.*` |
| `src/lib/storyblok/model.mjs` (новий) | `COMPONENTS`, `COLLECTIONS`, `FOLDERS`, `FINGERPRINT_FIELD`: підписи, вкладки, вид полів |
| `src/lib/storyblok/check.mjs` (новий) | `checkModel(schemas)`: обхід zod-схеми проти моделі, список помилок |
| `src/lib/storyblok/convert.mjs` (новий) | `toStory`, `fromStory`, `canonical`, `fingerprint`, `storyPath`, `stableUuid`. Чисті функції, на Етапі 5 стануть завантажувачем |
| `src/lib/storyblok/components.mjs` (новий) | `buildComponents()`, `buildFolders()`: JSON для Management API з моделі |
| `scripts/cms/client.mjs` (новий) | `createClient`, `clientFromEnv`, `REGIONS`: черга ≤ rps, повтор 429, пагінація, завантаження в медіатеку |
| `scripts/cms/content.mjs` (новий) | `readContent(dir)`, `validateContent(entries)`, `assetRefs(entries)`, `missingAssets(entries, publicDir)` |
| `scripts/cms/sync.mjs` (новий) | `readSpace`, `makePlan`, `applyPlan`, `runImport`, `runVerify`, `diffValues`, `sameComponent`, `publicUrl`, `storyblokName`, `DEMO` |
| `scripts/cms/import.mjs`, `scripts/cms/verify.mjs` (нові) | CLI: розбір прапорців, `.env`, код виходу |
| `tests/helpers/fake-storyblok.js` (новий) | Management API в памʼяті: ті самі шляхи й форми, ліміт і 429, журнал запитів |
| `tests/helpers/cms.js` (новий) | `withFake`, `fakeClient`, `withContentCopy`, `quietLog` |
| `tests/schema.test.js`, `tests/cms-model.test.js`, `tests/cms-convert.test.js`, `tests/cms-components.test.js`, `tests/cms-client.test.js`, `tests/cms-content.test.js`, `tests/cms-import.test.js`, `tests/cms-verify.test.js` (нові) | тести відповідних модулів |
| `package.json` | скрипти `cms:import`, `cms:verify` |
| `CLAUDE.md`, спека 3, `notes/…content-gaps.md`, `notes/…seo-launch-checklist.md` | документація (Задачі 2, 11) |

## Review Focus

Це ситуації, які спека передбачає, але які найлегше пропустити. Кожна прикріплена тестом до своєї задачі.

1. **Справжній API додає й нормалізує ключі.** До полів компонента дописуються `id`, `created_at`, а до asset — `alt: null`, `meta_data: {}`, `copyright`. Повторний імпорт усе одно мусить казати «0 змін». Фейк відтворює такі доповнення, тест у Задачі 8.
2. **`--apply` обірвався посередині** (мережа чи 500 на N-му записі). Повторний запуск мусить дозаписати решту, не впасти на конфліктах відбитків, і `verify` після нього зелений. Тест у Задачі 8.
3. **Число приходить JSON-числом, а не рядком** (`38`, а не `"38"`). Дані мають бути ті самі, без помилки схеми. Тест у Задачі 4.
4. **Редактор заповнив лише українське поле або прибрав обовʼязковий блок.** `fromStory` не підставляє українське замість англійського й не вигадує блоку: схема падає з назвою поля. Тест у Задачі 4.
5. **Порожній чи неправильний `.env`.** Має бути зрозуміле повідомлення з назвою змінної, нуль запитів і жодного токена у виводі. Тест у Задачі 6.

---

## Задача 1: схема в `src/lib/schema.mjs`

**Files:**
- Create: `src/lib/schema.mjs`
- Modify: `src/content.config.ts` (повністю переписується, див. крок 3)
- Test: `tests/schema.test.js`

**Interfaces:**
- Produces: `schemas` — обʼєкт `{ ministries, churches, projects, testimonies, pastors, 'leader-resources', 'site-settings', 'contact-info', 'donate-settings', homepage, pages }` зі схемою **одного запису** кожної колекції (для одиночок — схема запису `main`, для `pages` — схема однієї сторінки). Також `PAGE_IDS: string[]`, `localized`, `localizedHtml`, `mediaItem`, `seo`, `geoPoint`, `decorativeImage`, `MINISTRY_ICONS`, `RESOURCE_FORMATS = ['pdf','doc','xls','ppt']`, `PASTOR_GROUPS = ['pastor','elder']`.

- [ ] **Step 1: Написати тест, що падає**

`tests/schema.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGE_IDS, schemas } from '../src/lib/schema.mjs';
import { readCollection, readPages, readSingleton } from './helpers/content.js';
import { ministry } from './helpers/probes.js';

// Схема одна на трьох: збірка Astro, скрипти Storyblok (scripts/cms) і
// тести. Якщо правило живе лише в content.config.ts, імпорт у Storyblok
// пропустив би дані, які потім валять збірку.
const COLLECTIONS = ['ministries', 'churches', 'projects', 'testimonies', 'pastors', 'leader-resources'];
const SINGLETONS = ['site-settings', 'contact-info', 'donate-settings', 'homepage'];

const assertValid = (schema, data, where) => {
  const result = schema.safeParse(data);
  assert.ok(result.success, `${where}: ${JSON.stringify(result.error?.issues)}`);
};

test('кожен справжній запис проходить схему і поза Astro', () => {
  for (const collection of COLLECTIONS) {
    for (const { file, data } of readCollection(collection)) assertValid(schemas[collection], data, `${collection}/${file}`);
  }
  for (const name of SINGLETONS) assertValid(schemas[name], readSingleton(name), name);
  for (const [id, data] of Object.entries(readPages())) assertValid(schemas.pages, data, `pages.${id}`);
});

test('PAGE_IDS — рівно ті сторінки, що є в pages.json', () => {
  assert.deepEqual([...PAGE_IDS].sort(), Object.keys(readPages()).sort());
});

test('схема з plain Node ловить ті самі помилки, що й збірка', () => {
  assert.equal(schemas.ministries.safeParse(ministry('probe', { icon: 'rocket' })).success, false);
  assert.equal(schemas.ministries.safeParse(ministry('probe')).success, true);
});

test('content.config.ts не тримає власних правил — лише завантажувачі', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/content.config.ts', import.meta.url)), 'utf8');
  assert.doesNotMatch(source, /\bz\./, 'правило схеми в content.config.ts: перенести в src/lib/schema.mjs');
});
```

- [ ] **Step 2: Запустити тест, переконатися, що падає**

Run: `node --test tests/schema.test.js`
Expected: FAIL: `Cannot find module …/src/lib/schema.mjs`.

- [ ] **Step 3: Винести схему**

Створити `src/lib/schema.mjs`. Шапка файлу:

```js
import { z } from 'astro/zod';
import { MINISTRY_ICON_NAMES, RESOURCE_ICON_NAMES } from './icons.mjs';
import { ytId } from './youtube.mjs';

// Контракт з адмінкою: усе, що пропускає ця схема, мусить збиратися й
// проходити npm test (деплой стоїть за ним). Тому тут лише правила
// цілісності — формат і унікальність slug, відомі іконки, формати адрес,
// обидві мови, YouTube для відео. Кількості записів, точні значення й
// звʼязки між записами редактор має право міняти — їх тут немає свідомо.
//
// Схема живе тут, а не в content.config.ts, бо її читають троє: збірка
// Astro, імпорт і звірка Storyblok (scripts/cms) і тести. Модель Storyblok
// (src/lib/storyblok/model.mjs) їй підпорядкована — звіряє checkModel().
```

Далі **дослівно** перенести з `src/content.config.ts` рядки 62–449 (від `// slug — частина URL…` до кінця схеми `pages`) з такими й лише такими змінами:

1. Прибрати TypeScript:
   - `MINISTRY_ICON_NAMES as [string, ...string[]]` → `MINISTRY_ICON_NAMES`;
   - `RESOURCE_ICON_NAMES as [string, ...string[]]` → `RESOURCE_ICON_NAMES`;
   - generic-помічник `labels` стає таким:

   ```js
   const labels = (required, optional = []) =>
     z.object({
       ...Object.fromEntries(required.map((key) => [key, localized])),
       ...Object.fromEntries(optional.map((key) => [key, localized.optional()])),
     }).strict();
   ```

2. Кожне `const X = defineCollection({ loader: …, schema: <S> });` стає `const X = <S>;`. Імена: `ministries`, `churches`, `projects`, `testimonies`, `pastors`, `leaderResources`, `siteSettings`, `contactInfo`, `donateSettings`, `homepage`, `pages`. Коментарі над ними лишаються. Коментар у `testimonies` та інших про завантажувач прибирати не треба: він пояснює поля.
3. Винести два списки, щоб модель Storyblok не писала їх удруге (спека: «значення беруться зі схеми»):

   ```js
   export const RESOURCE_FORMATS = ['pdf', 'doc', 'xls', 'ppt'];
   export const PASTOR_GROUPS = ['pastor', 'elder'];
   ```

   і використати їх: `format: z.enum(RESOURCE_FORMATS).nullable()`, `group: z.enum(PASTOR_GROUPS)`.
4. `const PAGE_IDS = [...]` → `export const PAGE_IDS = [...]`. `localized`, `localizedHtml`, `mediaItem`, `seo`, `geoPoint`, `decorativeImage`, `MINISTRY_ICONS` лишаються `export`.
5. У кінці файлу:

   ```js
   // Схема одного запису кожної колекції. Для одиночок — запису «main»,
   // для pages — однієї сторінки.
   export const schemas = {
     ministries, churches, projects, testimonies, pastors,
     'leader-resources': leaderResources,
     'site-settings': siteSettings,
     'contact-info': contactInfo,
     'donate-settings': donateSettings,
     homepage,
     pages,
   };
   ```

`src/content.config.ts` повністю:

```ts
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { glob, file, type Loader } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { assertUniqueSlugs } from './lib/collections.mjs';
import { PAGE_IDS, schemas } from './lib/schema.mjs';

// Правила даних — у src/lib/schema.mjs: їх читають і збірка, і скрипти
// Storyblok (scripts/cms), і тести. Тут лише завантажувачі.

// Тести збирають сайт із тимчасової копії контенту (порожні колекції, дірки
// в order тощо), не чіпаючи src/content. У звичайній збірці змінної немає.
const CONTENT_DIR = process.env.HOB_CONTENT_DIR
  ? `${pathToFileURL(resolve(process.env.HOB_CONTENT_DIR)).href}/`
  : './src/content/';
```

Далі без змін перенести поточні рядки 21–60 (коментар і функцію `collectionLoader`, коментар і функцію `singletonLoader`). Після них:

```ts
export const collections = {
  ministries: defineCollection({ loader: collectionLoader('ministries'), schema: schemas.ministries }),
  churches: defineCollection({ loader: collectionLoader('churches'), schema: schemas.churches }),
  projects: defineCollection({ loader: collectionLoader('projects'), schema: schemas.projects }),
  testimonies: defineCollection({ loader: collectionLoader('testimonies'), schema: schemas.testimonies }),
  pastors: defineCollection({ loader: collectionLoader('pastors'), schema: schemas.pastors }),
  'leader-resources': defineCollection({ loader: collectionLoader('leader-resources'), schema: schemas['leader-resources'] }),
  // Одиночка = один запис із id "main". file() робить ключі верхнього рівня
  // ідентифікаторами, тож обгортка {"main": …} — це ціна того, щоб одиночка
  // теж валідувалася схемою на збірці, а не читалася як сирий JSON.
  'site-settings': defineCollection({ loader: singletonLoader('site-settings.json', ['main']), schema: schemas['site-settings'] }),
  'contact-info': defineCollection({ loader: singletonLoader('contact-info.json', ['main']), schema: schemas['contact-info'] }),
  'donate-settings': defineCollection({ loader: singletonLoader('donate-settings.json', ['main']), schema: schemas['donate-settings'] }),
  homepage: defineCollection({ loader: singletonLoader('homepage.json', ['main']), schema: schemas.homepage }),
  // Сторінки — маршрути в коді, тож набір id фіксований: без запису сторінка
  // не має навіть заголовка.
  pages: defineCollection({ loader: singletonLoader('pages.json', PAGE_IDS), schema: schemas.pages }),
};
```

У `schema.mjs` коментар «Одиночка = один запис із id "main"…» (стоїть над `siteSettings`) і коментар над `PAGE_IDS` про маршрути можна залишити. Вони правдиві й там.

- [ ] **Step 4: Запустити тест, переконатися, що проходить**

Run: `node --test tests/schema.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Повний прогін**

Run: `npm test`
Expected: збірка зелена, усі тести PASS. Це доводить, що правила не змінилися: пробні збірки `content-schema.test.js` і `content-crud.test.js` ловлять ті самі помилки з тими самими повідомленнями.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.mjs src/content.config.ts tests/schema.test.js
git commit -m "refactor: zod-схема в src/lib/schema.mjs — спільна для збірки, скриптів і тестів

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 2: прибрати `homepage.pastors.role` / `role2` (дірка 18)

**Files:**
- Modify: `src/content/singletons/homepage.json` (ключі `main.pastors.role`, `main.pastors.role2`, біля рядків 377–384)
- Modify: `src/lib/schema.mjs` (помічник `labels` і `pastors` у схемі `homepage`)
- Modify: `docs/superpowers/notes/2026-09-23-content-gaps.md` (рядок 18)
- Test: `tests/schema.test.js`

**Interfaces:**
- Consumes: `schemas.homepage` із Задачі 1.
- Produces: `schemas.homepage.shape.pastors` — strict-обʼєкт рівно з ключами `eyebrow`, `title`, `lead`, `all`. На це спирається модель у Задачі 3: у ній немає полів, яких не читають шаблони.

- [ ] **Step 1: Написати тест, що падає**

Дописати в `tests/schema.test.js`:

```js
test('homepage.pastors без role/role2: шаблон їх не читає, у Storyblok вони не переносяться', () => {
  // Дірка 18: ролі пасторів на головній беруться з колекції pastors.
  // Поле, яке ніхто не показує, редактор правив би в адмінці даремно.
  const home = readSingleton('homepage');
  assert.equal('role' in home.pastors || 'role2' in home.pastors, false, 'role/role2 ще лежать у homepage.json');
  const result = schemas.homepage.safeParse({ ...home, pastors: { ...home.pastors, role: { uk: 'Пастор', en: 'Pastor' } } });
  assert.equal(result.success, false, 'схема все ще приймає homepage.pastors.role');
  assert.match(JSON.stringify(result.error.issues), /role/);
});
```

- [ ] **Step 2: Запустити тест, переконатися, що падає**

Run: `node --test tests/schema.test.js`
Expected: FAIL: `role/role2 ще лежать у homepage.json`.

- [ ] **Step 3: Прибрати поля з даних і схеми**

У `src/content/singletons/homepage.json` Edit-ом видалити з `main.pastors` два ключі разом з їхніми обʼєктами (`"role": { "uk": …, "en": … },` і `"role2": { … },`). Кома після попереднього ключа має лишитися валідною. Перевірити: `node -e "JSON.parse(require('fs').readFileSync('src/content/singletons/homepage.json','utf8'))"`.

У `src/lib/schema.mjs` помічник `labels` (коментар над ним не змінюється) стає таким:

```js
const labels = (keys) =>
  z.object(Object.fromEntries(keys.map((key) => [key, localized]))).strict();
```

Необовʼязкових підписів більше немає: `role`/`role2` були єдиними. У схемі `homepage` рядки

```js
    // role/role2 шаблон більше не читає (ролі — з колекції pastors, дірка 18):
    // необовʼязкові, щоб редактор міг їх прибрати.
    pastors: labels(['eyebrow', 'title', 'lead', 'all'], ['role', 'role2']),
```

замінити на

```js
    pastors: labels(['eyebrow', 'title', 'lead', 'all']),
```

`hero: labels([...]).extend({ title: localizedHtml })` і решта викликів `labels([...])` не змінюються.

У `docs/superpowers/notes/2026-09-23-content-gaps.md` в кінець третьої клітинки рядка 18 дописати: ` **Закрито на Етапі 4 (Задача 2):** поля прибрано з даних і зі схеми до імпорту в Storyblok.`

- [ ] **Step 4: Запустити тести**

Run: `node --test tests/schema.test.js` → PASS (5 tests).
Run: `npm test` → PASS. Головна рендериться без змін, бо шаблон цих ключів не читав.

- [ ] **Step 5: Commit**

```bash
git add src/content/singletons/homepage.json src/lib/schema.mjs tests/schema.test.js docs/superpowers/notes/2026-09-23-content-gaps.md
git commit -m "fix: прибрати homepage.pastors.role/role2 — шаблон їх не читає (дірка 18)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 3: декларативна модель Storyblok і звірка зі схемою

**Files:**
- Create: `src/lib/storyblok/model.mjs`
- Create: `src/lib/storyblok/check.mjs`
- Test: `tests/cms-model.test.js`

**Interfaces:**
- Consumes: `schemas`, `localized`, `localizedHtml`, `RESOURCE_FORMATS`, `PASTOR_GROUPS` з `src/lib/schema.mjs`. Також `MINISTRY_ICON_NAMES`, `RESOURCE_ICON_NAMES` з `src/lib/icons.mjs`.
- Produces:
  - `COMPONENTS: Record<name, { label: string, fixed?: object, fields: Record<key, Field> }>`, де `Field = { kind, label, optional?, nullable?, required?, allowEmpty?, tab?, description?, item?, markup?, values?, names?, component?, components?, unwrap? }`. `kind` ∈ `pair | text | number | boolean | option | image | file | group | list`. Для `pair` поле `item` ∈ `text | textarea | image`.
  - `COLLECTIONS: Record<collection, { kind: 'collection' | 'pages' | 'singleton', folder: string, variants: string[], slug?: string, name?: string }>`.
  - `FOLDERS: Record<folderSlug, folderName>`.
  - `FINGERPRINT_FIELD = 'import_hash'`.
  - `checkModel(schemas = SCHEMAS): string[]`. Порожній масив означає, що модель покриває схему рівно.

- [ ] **Step 1: Написати тест, що падає**

`tests/cms-model.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'astro/zod';
import { localized, schemas } from '../src/lib/schema.mjs';
import { checkModel } from '../src/lib/storyblok/check.mjs';

// Модель Storyblok підпорядкована zod-схемі (Спека 3): нове поле в схемі
// без поля в моделі — червоний тест, а не поле, яке редактор не бачить.
const errorsFor = (collection, schema) => checkModel({ ...schemas, [collection]: schema });
const assertError = (errors, fragment) =>
  assert.ok(errors.some((e) => e.includes(fragment)), `немає помилки про «${fragment}»:\n${errors.join('\n')}`);

test('модель покриває схему рівно — без винятків', () => {
  assert.deepEqual(checkModel(), []);
});

test('нове поле в схемі без поля в моделі — помилка з повним шляхом', () => {
  assertError(errorsFor('ministries', schemas.ministries.extend({ extra: localized })), 'ministries (ministry).extra');
});

test('поле, якого вже немає в схемі, — помилка', () => {
  assertError(errorsFor('ministries', schemas.ministries.omit({ phone: true })), 'ministries (ministry).phone');
});

test('розбіжність optional/nullable видно', () => {
  assertError(errorsFor('ministries', schemas.ministries.extend({ leader: z.string().min(1).optional() })), '.leader: optional');
  assertError(errorsFor('churches', schemas.churches.extend({ pastor: z.string().min(1).nullable() })), '.pastor: nullable');
});

test('несумісний тип видно', () => {
  assertError(errorsFor('ministries', schemas.ministries.extend({ phone: z.number() })), '.phone');
  assertError(errorsFor('ministries', schemas.ministries.extend({ icon: z.enum(['book', 'rocket']) })), '.icon');
});

test('схема дозволила порожній рядок, а модель ні — помилка', () => {
  // Від цього залежить required у формі редактора: поле, яке схема дозволяє
  // лишити порожнім, форма не сміє вимагати.
  assertError(errorsFor('ministries', schemas.ministries.extend({ leader: z.string() })), '.leader');
});

test('обовʼязковість списку (min(1)) звіряється', () => {
  assertError(errorsFor('projects', schemas.projects.extend({ stats: z.array(z.object({ n: z.string().min(1), label: localized }).strict()).min(1) })), '.stats');
});

test('колекція схеми без моделі й навпаки — помилка', () => {
  assertError(checkModel({ ...schemas, extra: z.object({}).strict() }), 'extra');
  const { pastors, ...withoutPastors } = schemas;
  assertError(checkModel(withoutPastors), 'pastors');
});
```

- [ ] **Step 2: Запустити тест, переконатися, що падає**

Run: `node --test tests/cms-model.test.js`
Expected: FAIL: `Cannot find module …/src/lib/storyblok/check.mjs`.

- [ ] **Step 3: Написати модель**

`src/lib/storyblok/model.mjs`:

```js
import { MINISTRY_ICON_NAMES, RESOURCE_ICON_NAMES } from '../icons.mjs';
import { PASTOR_GROUPS, RESOURCE_FORMATS } from '../schema.mjs';

// Модель Storyblok підпорядкована zod-схемі (src/lib/schema.mjs): ключі,
// типи й optional/nullable звіряє checkModel() (tests/cms-model.test.js).
// Тут лише те, чого схема не знає: підписи українською, вкладки, вигляд
// поля (рядок чи абзац, картинка чи текст). Порядок ключів — порядок полів
// у формі редактора.

// Пара {uk, en} — два поля поруч (name_uk / name_en), а не мовний механізм
// Storyblok: неперекладене поле той мовчки віддав би українським текстом,
// і англійська сторінка показала б українську.
const pair = (item) => (label, opts = {}) => ({ kind: 'pair', item, label, ...opts });
const loc = pair('text');
const long = pair('textarea');
// Лише homepage.hero.title: єдине поле з розміткою (localizedHtml).
const html = (label) => ({ kind: 'pair', item: 'textarea', markup: true, label });
const imagePair = pair('image');
const field = (kind) => (label, opts = {}) => ({ kind, label, ...opts });
const text = field('text');
const number = field('number');
const boolean = field('boolean');
const image = field('image');
const file = field('file');
const option = (label, values, opts = {}) => ({ kind: 'option', label, values, ...opts });
// Вкладена група — блок, максимум один: так «групи немає» (null) відрізняється
// від «група є».
const group = (label, component, opts = {}) => ({ kind: 'group', label, component, ...opts });
const list = (label, components, opts = {}) => ({ kind: 'list', label, components, ...opts });

const order = number('Порядок', { tab: 'service', description: 'Менше число — вище в списку. Однакові числа дозволені.' });
const media = list('Фото й відео', ['gallery_image', 'gallery_video'], { required: true, tab: 'gallery' });
const seo = group('SEO', 'seo', { tab: 'seo' });
const optionalSeo = group('SEO', 'seo', { tab: 'seo', optional: true });

export const FINGERPRINT_FIELD = 'import_hash';

export const COMPONENTS = {
  // Вкладені блоки.
  seo: {
    label: 'SEO',
    fields: {
      metaTitle: loc('Мета-заголовок', { nullable: true }),
      metaDescription: long('Мета-опис', { nullable: true }),
      ogImage: image('Картинка для соцмереж', { nullable: true }),
      noindex: boolean('Сховати від пошукових систем'),
    },
  },
  gallery_image: {
    label: 'Фото',
    fixed: { type: 'image' },
    fields: { src: image('Фото'), alt: text('Опис фото (alt)') },
  },
  gallery_video: {
    label: 'Відео YouTube',
    fixed: { type: 'video' },
    fields: { src: text('Посилання YouTube або ID відео'), alt: text('Опис відео') },
  },
  geo: { label: 'Координати', fields: { lat: number('Широта'), lng: number('Довгота') } },
  progress: {
    label: 'Прогрес збору',
    fields: { percent: number('Відсоток (0–100)'), raised: loc('Зібрано'), goal: loc('Ціль') },
  },
  stat: { label: 'Показник', fields: { n: text('Число'), label: loc('Підпис') } },

  // Колекції.
  ministry: {
    label: 'Служіння',
    fields: {
      name: loc('Назва'),
      summary: long('Коротко'),
      body: long('Текст'),
      icon: option('Іконка', MINISTRY_ICON_NAMES),
      leader: text('Керівник'),
      phone: text('Телефон'),
      media,
      seo,
      order,
    },
  },
  church: {
    label: 'Церква',
    fields: {
      name: loc('Назва'),
      city: loc('Місто'),
      role: loc('Роль (напр. «Церква обʼєднання»)'),
      address: loc('Адреса'),
      times: loc('Час богослужінь'),
      lead: long('Вступ'),
      body: long('Текст'),
      pastor: text('Пастор'),
      geo: group('Координати', 'geo', { nullable: true }),
      media,
      seo,
      order,
    },
  },
  project: {
    label: 'Проєкт',
    fields: {
      title: loc('Назва'),
      category: loc('Категорія'),
      status: loc('Статус'),
      period: loc('Період'),
      date: text('Дата (РРРР-ММ-ДД)'),
      lead: long('Вступ'),
      body: long('Текст'),
      progress: group('Прогрес збору', 'progress', { nullable: true }),
      stats: list('Показники', ['stat']),
      ctaLabel: loc('Текст кнопки'),
      ctaUrl: text('Посилання кнопки (https://… або /…)', { nullable: true }),
      media,
      seo,
      order,
    },
  },
  testimony_text: {
    label: 'Свідчення (текст)',
    fixed: { type: 'text' },
    fields: { name: text('Імʼя'), role: loc('Хто це (напр. «лідер групи»)'), text: long('Свідчення'), order },
  },
  testimony_video: {
    label: 'Свідчення (відео)',
    fixed: { type: 'video' },
    fields: {
      name: text('Імʼя'),
      role: loc('Хто це (напр. «лідер групи»)'),
      videoUrl: text('Посилання YouTube'),
      poster: image('Обкладинка відео'),
      order,
    },
  },
  pastor: {
    label: 'Пастор / пресвітер',
    fields: {
      name: text('Імʼя'),
      role: loc('Служіння'),
      subtitle: loc('Підзаголовок', { nullable: true }),
      bio: long('Опис'),
      photo: image('Фото'),
      group: option('Група', PASTOR_GROUPS, { names: { pastor: 'Пастор', elder: 'Пресвітер' } }),
      email: text('Ел. пошта', { nullable: true }),
      phone: text('Телефон', { nullable: true }),
      order,
    },
  },
  resource_document: {
    label: 'Документ',
    fixed: { kind: 'document', icon: null },
    fields: {
      title: loc('Назва'),
      description: long('Опис'),
      meta: loc('Підпис файлу (напр. «PDF · 2 сторінки»)', { nullable: true }),
      // nullable у схемі, але документ без формату схема відкидає (refine):
      // форма має вимагати його одразу.
      format: option('Формат', RESOURCE_FORMATS, { nullable: true, required: true }),
      url: file('Файл', { nullable: true }),
      order,
    },
  },
  resource_link: {
    label: 'Посилання',
    fixed: { kind: 'link', format: null },
    fields: {
      title: loc('Назва'),
      description: long('Опис'),
      meta: loc('Підпис (необовʼязково)', { nullable: true }),
      icon: option('Іконка', RESOURCE_ICON_NAMES, { nullable: true, required: true }),
      url: text('Адреса (https://…)', { nullable: true }),
      order,
    },
  },

  // Сторінки (pages.json): одна модель на всі дев'ять.
  site_page: {
    label: 'Сторінка',
    fields: {
      title: loc('Заголовок'),
      eyebrow: loc('Надзаголовок', { optional: true }),
      lead: long('Вступ', { optional: true }),
      heroTag: loc('Мітка над заголовком', { optional: true }),
      body: long('Текст сторінки (без нього сторінка не публікується)', { optional: true, nullable: true }),
      sections: group('Заголовки секцій', 'page_sections', { optional: true }),
      help: group('Блок «Потрібна допомога»', 'page_help', { optional: true }),
      seo: optionalSeo,
    },
  },
  page_sections: {
    label: 'Заголовки секцій',
    fields: {
      hero_locked: loc('Мітка закритого розділу', { optional: true }),
      docs_title: loc('Заголовок «Документи»', { optional: true }),
      res_title: loc('Заголовок «Ресурси»', { optional: true }),
      past_eyebrow: loc('Пастори — надзаголовок', { optional: true }),
      past_title: loc('Пастори — заголовок', { optional: true }),
      past_lead: long('Пастори — вступ', { optional: true }),
      elders_eyebrow: loc('Пресвітери — надзаголовок', { optional: true }),
      elders_title: loc('Пресвітери — заголовок', { optional: true }),
      elders_lead: long('Пресвітери — вступ', { optional: true }),
    },
  },
  page_help: {
    label: 'Потрібна допомога',
    fields: { title: loc('Заголовок'), desc: long('Опис'), btn: loc('Кнопка') },
  },

  // Головна.
  homepage: {
    label: 'Головна сторінка',
    fields: {
      nav: group('Меню', 'home_nav'),
      cta: group('Кнопка трансляції', 'home_cta'),
      hero: group('Перший екран', 'home_hero'),
      heroImage: group('Фото першого екрана', 'home_hero_image'),
      about: group('Про церкву', 'home_about'),
      beliefs: list('Твердження віри', ['home_belief'], { unwrap: 'text' }),
      news: group('Новини', 'home_news'),
      fb: group('Стрічка Facebook', 'home_fb'),
      wwb: group('У що ми віримо', 'home_wwb'),
      testimonies: group('Свідчення', 'home_testimonies'),
      ministries: group('Служіння', 'home_ministries'),
      pastors: group('Пастори', 'home_pastors'),
      contacts: group('Контакти', 'home_contacts'),
      donate: group('Пожертви', 'home_donate'),
      footer: group('Футер', 'home_footer'),
      seo: optionalSeo,
    },
  },
  home_nav: {
    label: 'Меню',
    fields: {
      home: loc('Головна'), about: loc('Про церкву'), ministries: loc('Служіння'), media: loc('Медіа'),
      union: loc('Обʼєднання'), donations: loc('Пожертви'), projects: loc('Проєкти'), contacts: loc('Контакти'),
      leaders: loc('Для лідерів'),
    },
  },
  home_cta: { label: 'Кнопка трансляції', fields: { live: loc('Текст кнопки'), liveTitle: loc('Підказка кнопки') } },
  home_hero: {
    label: 'Перший екран',
    fields: {
      tag: loc('Мітка'),
      title: html('Заголовок (дозволено <em> і <br>)'),
      vision: long('Бачення'),
      addr: loc('Адреса'),
      time: loc('Час богослужіння'),
      watch: loc('Кнопка «Дивитися»'),
      donate: loc('Кнопка «Пожертвувати»'),
      scroll: loc('Підказка «Гортати»'),
    },
  },
  home_hero_image: {
    label: 'Фото першого екрана',
    fields: { src: image('Фото'), mobileSrc: image('Фото для телефона'), alt: text('Опис фото (alt)') },
  },
  home_about: {
    label: 'Про церкву',
    fields: { eyebrow: loc('Надзаголовок'), title: loc('Заголовок'), lead: long('Вступ'), beliefsTitle: loc('Заголовок тверджень віри') },
  },
  home_belief: { label: 'Твердження віри', fields: { text: long('Текст') } },
  home_news: {
    label: 'Новини',
    fields: {
      eyebrow: loc('Надзаголовок'), title: loc('Заголовок'), lead: long('Вступ'), more: loc('Посилання «Більше»'),
      items: list('Новини', ['home_news_item']),
    },
  },
  home_news_item: {
    label: 'Новина',
    fields: { date: loc('Дата'), title: loc('Заголовок'), text: long('Текст'), image: group('Картинка', 'home_news_image') },
  },
  home_news_image: {
    label: 'Картинка новини',
    // alt="" свідомо: заголовок новини стоїть поруч (decorativeImage у схемі).
    fields: { src: image('Картинка'), alt: text('Опис (можна лишити порожнім)', { allowEmpty: true }) },
  },
  home_fb: { label: 'Стрічка Facebook', fields: { title: loc('Заголовок'), text: long('Текст') } },
  home_wwb: {
    label: 'У що ми віримо',
    fields: { eyebrow: loc('Надзаголовок'), title: loc('Заголовок'), items: list('Пункти', ['home_wwb_item']) },
  },
  home_wwb_item: { label: 'Пункт', fields: { title: loc('Заголовок'), text: long('Текст') } },
  home_testimonies: {
    label: 'Свідчення',
    fields: {
      eyebrow: loc('Надзаголовок'), title: loc('Заголовок'), all: loc('Посилання «Усі свідчення»'),
      items: list('Свідчення', ['home_testimony']),
    },
  },
  home_testimony: { label: 'Свідчення', fields: { text: long('Текст'), name: loc('Імʼя'), role: loc('Хто це') } },
  home_ministries: {
    label: 'Служіння',
    fields: { eyebrow: loc('Надзаголовок'), title: loc('Заголовок'), lead: long('Вступ'), all: loc('Посилання «Усі служіння»') },
  },
  home_pastors: {
    label: 'Пастори',
    fields: { eyebrow: loc('Надзаголовок'), title: loc('Заголовок'), lead: long('Вступ'), all: loc('Посилання «Усі пастори»') },
  },
  home_contacts: {
    label: 'Контакти',
    fields: {
      eyebrow: loc('Надзаголовок'), title: loc('Заголовок'), addrLbl: loc('Підпис «Адреса»'), addr: loc('Адреса'),
      phoneLbl: loc('Підпис «Телефон»'), emailLbl: loc('Підпис «Пошта»'), svcLbl: loc('Підпис «Богослужіння»'),
      svcDay: loc('День богослужіння'), socialLbl: loc('Підпис «Соцмережі»'),
    },
  },
  home_donate: {
    label: 'Пожертви',
    fields: {
      eyebrow: loc('Надзаголовок'), title: loc('Заголовок'), quote: long('Цитата'), ref: loc('Джерело цитати'),
      btn: loc('Кнопка'), thanks: long('Подяка'),
    },
  },
  home_footer: {
    label: 'Футер',
    fields: {
      about: long('Про церкву'), navTitle: loc('Заголовок «Навігація»'), contactsTitle: loc('Заголовок «Контакти»'),
      socialTitle: loc('Заголовок «Соцмережі»'), copy: loc('Копірайт'), built: loc('Підпис розробника'), addr: loc('Адреса'),
    },
  },

  // Налаштування.
  site_settings: {
    label: 'Налаштування сайту',
    fields: {
      name: loc('Назва сайту'),
      logo: imagePair('Логотип'),
      defaultOgImage: image('Картинка для соцмереж за замовчуванням', { nullable: true }),
      social: group('Соцмережі', 'site_social'),
    },
  },
  site_social: {
    label: 'Соцмережі',
    fields: { facebook: text('Facebook'), youtube: text('YouTube'), instagram: text('Instagram'), telegram: text('Telegram') },
  },
  contact_info: {
    label: 'Контакти',
    fields: {
      address: loc('Адреса'),
      city: loc('Місто'),
      phone: text('Телефон для дзвінка (цифри, +, пробіли)'),
      phoneDisplay: text('Телефон, як його показувати'),
      email: text('Ел. пошта'),
      serviceDay: loc('День богослужіння'),
      serviceTime: text('Час богослужіння'),
      mapUrl: text('Посилання на карту'),
      geo: group('Координати', 'geo', { nullable: true }),
    },
  },
  donate_settings: {
    label: 'Пожертви',
    fields: {
      liqpayUrl: text('Посилання LiqPay'),
      defaultAmount: number('Сума за замовчуванням, грн'),
      // Прирости, а не пресети: кнопка додає суму до поля (схема donateSettings).
      calcIncrements: list('Кнопки калькулятора «+ сума»', ['donate_increment'], { unwrap: 'amount' }),
    },
  },
  donate_increment: { label: 'Кнопка «+ сума»', fields: { amount: number('Сума, грн') } },
};

// Колекція → папка й типи контенту. slug історії — це slug запису (для
// сторінок — id, для одиночок — фіксований), тож окремого поля slug немає:
// унікальність у папці гарантує Storyblok.
export const COLLECTIONS = {
  ministries: { kind: 'collection', folder: 'ministries', variants: ['ministry'] },
  churches: { kind: 'collection', folder: 'churches', variants: ['church'] },
  projects: { kind: 'collection', folder: 'projects', variants: ['project'] },
  testimonies: { kind: 'collection', folder: 'testimonies', variants: ['testimony_text', 'testimony_video'] },
  pastors: { kind: 'collection', folder: 'pastors', variants: ['pastor'] },
  'leader-resources': { kind: 'collection', folder: 'leader-resources', variants: ['resource_document', 'resource_link'] },
  pages: { kind: 'pages', folder: 'pages', variants: ['site_page'] },
  homepage: { kind: 'singleton', folder: 'settings', slug: 'homepage', name: 'Головна сторінка', variants: ['homepage'] },
  'site-settings': { kind: 'singleton', folder: 'settings', slug: 'site-settings', name: 'Налаштування сайту', variants: ['site_settings'] },
  'contact-info': { kind: 'singleton', folder: 'settings', slug: 'contact-info', name: 'Контакти', variants: ['contact_info'] },
  'donate-settings': { kind: 'singleton', folder: 'settings', slug: 'donate-settings', name: 'Пожертви', variants: ['donate_settings'] },
};

export const FOLDERS = {
  ministries: 'Служіння',
  churches: 'Церкви',
  projects: 'Проєкти',
  testimonies: 'Свідчення',
  pastors: 'Пастори',
  'leader-resources': 'Для лідерів',
  pages: 'Сторінки',
  settings: 'Налаштування',
};
```

- [ ] **Step 4: Написати звірку**

`src/lib/storyblok/check.mjs`:

```js
import { localized, localizedHtml, schemas as SCHEMAS } from '../schema.mjs';
import { COLLECTIONS, COMPONENTS } from './model.mjs';

// Доводить, що модель Storyblok покриває схему рівно: ті самі ключі, ті
// самі optional/nullable, сумісні типи. Без винятків — нове поле в схемі
// без поля в моделі (чи навпаки) дає помилку з повним шляхом.

const SCALARS = {
  ZodString: ['text', 'textarea', 'image', 'file'],
  ZodNumber: ['number'],
  ZodBoolean: ['boolean'],
  ZodEnum: ['option'],
};

// Знімає optional/nullable/refine, але зупиняється на localized і
// localizedHtml — їх модель упізнає за тотожністю, а не за формою.
function unwrap(schema) {
  let s = schema;
  let optional = false;
  let nullable = false;
  for (;;) {
    if (s === localized || s === localizedHtml) break;
    const type = s._def.typeName;
    if (type === 'ZodOptional') { optional = true; s = s._def.innerType; }
    else if (type === 'ZodNullable') { nullable = true; s = s._def.innerType; }
    else if (type === 'ZodEffects') s = s._def.schema;
    else break;
  }
  return { s, optional, nullable };
}

export function checkModel(schemas = SCHEMAS) {
  const errors = [];
  const used = new Set();
  for (const [collection, schema] of Object.entries(schemas)) {
    const entry = COLLECTIONS[collection];
    if (!entry) {
      errors.push(`${collection}: колекції немає в моделі (COLLECTIONS)`);
      continue;
    }
    // Запис колекції має slug — у Storyblok це slug історії, а не поле.
    compareVariants(schema, entry.variants, collection, entry.kind === 'collection' ? ['slug'] : [], errors, used);
  }
  for (const collection of Object.keys(COLLECTIONS)) {
    if (!(collection in schemas)) errors.push(`${collection}: є в моделі, але немає в схемі`);
  }
  for (const name of Object.keys(COMPONENTS)) {
    if (!used.has(name)) errors.push(`${name}: компонент моделі ніде не використано`);
  }
  return errors;
}

// Варіанти (testimony_text/_video, resource_document/_link, gallery_image/
// _video) відрізняються fixed-значеннями: варіант схеми, що їх приймає, і є
// його парою.
function compareVariants(schema, variants, path, implicit, errors, used) {
  const { s } = unwrap(schema);
  const options = s._def.typeName === 'ZodDiscriminatedUnion' ? [...s._def.options] : [s];
  const matched = new Set();
  for (const name of variants) {
    used.add(name);
    const def = COMPONENTS[name];
    if (!def) {
      errors.push(`${path}: компонента «${name}» немає в моделі`);
      continue;
    }
    const option = options.find((o) => o._def.typeName === 'ZodObject'
      && Object.entries(def.fixed ?? {}).every(([key, value]) => o.shape[key]?.safeParse(value).success));
    if (!option) {
      errors.push(`${path} (${name}): у схемі немає варіанта, що приймає fixed ${JSON.stringify(def.fixed ?? {})}`);
      continue;
    }
    matched.add(option);
    compareObject(option, def, `${path} (${name})`, implicit, errors, used);
  }
  for (const option of options) {
    if (!matched.has(option)) errors.push(`${path}: варіант схеми без компонента в моделі`);
  }
}

function compareObject(object, def, path, implicit, errors, used) {
  const shape = object.shape;
  const fixed = Object.keys(def.fixed ?? {});
  const modelKeys = [...Object.keys(def.fields), ...fixed, ...implicit];
  for (const key of Object.keys(shape)) {
    if (!modelKeys.includes(key)) errors.push(`${path}.${key}: поле є в схемі, але немає в моделі`);
  }
  for (const key of modelKeys) {
    if (!(key in shape)) errors.push(`${path}.${key}: поле є в моделі, але немає в схемі`);
  }
  for (const key of fixed) {
    if (key in def.fields) errors.push(`${path}.${key}: і поле, і fixed-значення`);
  }
  for (const [key, field] of Object.entries(def.fields)) {
    if (key in shape) compareField(shape[key], field, `${path}.${key}`, errors, used);
  }
}

function compareField(schema, field, path, errors, used) {
  const { s, optional, nullable } = unwrap(schema);
  if (Boolean(field.optional) !== optional) errors.push(`${path}: optional у схемі ${optional}, у моделі ${Boolean(field.optional)}`);
  if (Boolean(field.nullable) !== nullable) errors.push(`${path}: nullable у схемі ${nullable}, у моделі ${Boolean(field.nullable)}`);
  const type = s._def.typeName;
  const isText = s === localized || s === localizedHtml;

  if (field.kind === 'pair') {
    if (isText) {
      if ((s === localizedHtml) !== Boolean(field.markup)) errors.push(`${path}: розмітка (localizedHtml) у схемі й моделі не збігається`);
      if (!['text', 'textarea'].includes(field.item)) errors.push(`${path}: текстова пара в моделі має тип ${field.item}`);
      return;
    }
    if (type !== 'ZodObject' || Object.keys(s.shape).sort().join() !== 'en,uk') {
      errors.push(`${path}: у моделі пара uk/en, у схемі ${type}`);
      return;
    }
    if (field.markup) errors.push(`${path}: markup дозволений лише для localizedHtml`);
    for (const side of ['uk', 'en']) compareField(s.shape[side], { kind: field.item }, `${path}.${side}`, errors, used);
    return;
  }
  if (isText) {
    errors.push(`${path}: у схемі пара uk/en, у моделі ${field.kind}`);
    return;
  }
  if (field.kind === 'group') {
    if (type !== 'ZodObject') {
      errors.push(`${path}: у моделі група, у схемі ${type}`);
      return;
    }
    compareVariants(s, [field.component], path, [], errors, used);
    return;
  }
  if (field.kind === 'list') {
    if (type !== 'ZodArray') {
      errors.push(`${path}: у моделі список, у схемі ${type}`);
      return;
    }
    const required = (s._def.minLength?.value ?? 0) > 0;
    if (Boolean(field.required) !== required) errors.push(`${path}: список обовʼязковий у схемі ${required}, у моделі ${Boolean(field.required)}`);
    if (field.unwrap) {
      const [name] = field.components;
      used.add(name);
      const def = COMPONENTS[name];
      if (field.components.length !== 1 || !def || Object.keys(def.fields).join() !== field.unwrap) {
        errors.push(`${path}: unwrap потребує рівно одного компонента з єдиним полем «${field.unwrap}»`);
        return;
      }
      compareField(s._def.type, def.fields[field.unwrap], `${path}[]`, errors, used);
      return;
    }
    compareVariants(s._def.type, field.components, `${path}[]`, [], errors, used);
    return;
  }
  if (!SCALARS[type]?.includes(field.kind)) {
    errors.push(`${path}: у схемі ${type}, у моделі ${field.kind}`);
    return;
  }
  if (type === 'ZodEnum' && [...s._def.values].sort().join() !== [...field.values].sort().join()) {
    errors.push(`${path}: значення списку не збігаються зі схемою`);
  }
  // Від цього залежить required у формі: поле, яке схема дозволяє лишити
  // порожнім, форма не сміє вимагати (і навпаки).
  if (type === 'ZodString' && !optional && !nullable) {
    const acceptsEmpty = schema.safeParse('').success;
    if (acceptsEmpty !== Boolean(field.allowEmpty)) {
      errors.push(`${path}: схема ${acceptsEmpty ? 'приймає' : 'не приймає'} порожній рядок, у моделі allowEmpty=${Boolean(field.allowEmpty)}`);
    }
  }
}
```

- [ ] **Step 5: Запустити тест**

Run: `node --test tests/cms-model.test.js`
Expected: PASS (8 tests). Якщо перший тест падає, помилка називає шлях. Виправити **модель** (підпис, `nullable`, `allowEmpty`), а не схему і не звірку.

- [ ] **Step 6: Повний прогін і commit**

Run: `npm test` → PASS.

```bash
git add src/lib/storyblok/model.mjs src/lib/storyblok/check.mjs tests/cms-model.test.js
git commit -m "feat: декларативна модель Storyblok і її звірка з zod-схемою

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 4: перетворення `toStory` / `fromStory`

**Files:**
- Create: `src/lib/storyblok/convert.mjs`
- Test: `tests/cms-convert.test.js`

**Interfaces:**
- Consumes: `COMPONENTS`, `COLLECTIONS`, `FINGERPRINT_FIELD` із Задачі 3; `schemas` із Задачі 1.
- Produces:
  - `toStory(collection, slug, data, { asset? }) → { name, slug, content }`. `asset(src) → { id, filename } | undefined` — резолвер для відносних шляхів (`uploads/…`). Без резолвера такий шлях дає `throw`. `content[FINGERPRINT_FIELD]` уже заповнений.
  - `fromStory(collection, story, { assetPath? }) → data`. Для записів колекцій `data.slug = story.slug`. `assetPath(assetObject) → string`, типово `asset.filename`. Невідомий тип контенту дає `throw`.
  - `canonical(collection, data) → data`: відсутній optional+nullable ключ стає `null` (зараз лише `pages.body`).
  - `fingerprint(value) → hex` — SHA-256 стабільного JSON.
  - `storyPath(collection, slug) → 'ministries/youth'`.
  - `stableUuid(seed) → 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'` (детермінований).

- [ ] **Step 1: Написати тест, що падає**

`tests/cms-convert.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemas } from '../src/lib/schema.mjs';
import { canonical, fingerprint, fromStory, storyPath, toStory } from '../src/lib/storyblok/convert.mjs';
import { COLLECTIONS, FINGERPRINT_FIELD } from '../src/lib/storyblok/model.mjs';
import { readCollection, readPages, readSingleton } from './helpers/content.js';
import {
  church, documentResource, image, linkResource, ministry, person, project, textTestimony, video, videoTestimony,
} from './helpers/probes.js';

// Медіатека в тестах — підміна: відносний шлях отримує «адресу Storyblok»,
// а assetPath повертає його назад. Так туди-й-назад перевіряється без мережі.
const LIBRARY = 'https://a.storyblok.com/f/1/';
const asset = (src) => ({ id: 1, filename: `${LIBRARY}${src}` });
const assetPath = (a) => (a.filename.startsWith(LIBRARY) ? a.filename.slice(LIBRARY.length) : a.filename);
const roundTrip = (collection, slug, data) =>
  fromStory(collection, toStory(collection, slug, data, { asset }), { assetPath });

const pair = (uk, en = `${uk} (en)`) => ({ uk, en });
const seoFull = { metaTitle: pair('Мета'), metaDescription: pair('Опис'), ogImage: 'uploads/og.jpg', noindex: true };

// Усі справжні записи: [collection, slug, data].
function realEntries() {
  const out = [];
  for (const [collection, entry] of Object.entries(COLLECTIONS)) {
    if (entry.kind === 'collection') for (const { data } of readCollection(collection)) out.push([collection, data.slug, data]);
    if (entry.kind === 'singleton') out.push([collection, entry.slug, readSingleton(collection)]);
  }
  for (const [id, data] of Object.entries(readPages())) out.push(['pages', id, data]);
  return out;
}

// Проби з усіма необовʼязковими полями, null і порожніми списками — кожна
// спершу проходить схему, інакше тест перевіряв би неможливі дані.
function probes() {
  const home = readSingleton('homepage');
  const settings = readSingleton('site-settings');
  return [
    ['ministries', 'full', ministry('full', { seo: seoFull, media: [image('a'), video()] })],
    ['churches', 'geo', church('geo', { geo: { lat: 47.910483, lng: 33.391783 } })],
    ['projects', 'full', project('full', {
      progress: { percent: 38.5, raised: pair('1 140 000 грн'), goal: pair('3 000 000 грн') },
      ctaUrl: '/#contacts', stats: [{ n: '120', label: pair('дітей') }],
    })],
    ['pastors', 'full', person('full', 'pastor', { email: 'pastor@example.test', phone: '+380 99 000 00 00', subtitle: pair('Старший пастор') })],
    ['leader-resources', 'doc', documentResource('doc', { url: 'uploads/doc.pdf', meta: pair('PDF · 2 сторінки') })],
    ['leader-resources', 'link', linkResource('link', { url: 'https://example.test/res', meta: pair('Сайт') })],
    ['testimonies', 'text', textTestimony('text')],
    ['testimonies', 'video', videoTestimony('video')],
    ['pages', 'full', {
      title: pair('Заголовок'), eyebrow: pair('Над'), lead: pair('Вступ\nз переносом'), heroTag: pair('Мітка'),
      sections: Object.fromEntries(['hero_locked', 'docs_title', 'res_title', 'past_eyebrow', 'past_title', 'past_lead',
        'elders_eyebrow', 'elders_title', 'elders_lead'].map((k) => [k, pair(k)])),
      help: { title: pair('Допомога'), desc: pair('Опис'), btn: pair('Кнопка') },
      body: pair('Текст сторінки'), seo: seoFull,
    }],
    ['pages', 'minimal', { title: pair('Лише заголовок') }],
    ['pages', 'null-body', { title: pair('Без тексту'), body: null }],
    ['homepage', 'homepage', {
      ...home, beliefs: [], news: { ...home.news, items: [] }, wwb: { ...home.wwb, items: [] },
      testimonies: { ...home.testimonies, items: [] }, seo: seoFull,
    }],
    ['site-settings', 'site-settings', { ...settings, defaultOgImage: 'uploads/og.jpg' }],
    ['donate-settings', 'donate-settings', { ...readSingleton('donate-settings'), calcIncrements: [] }],
    ['contact-info', 'contact-info', { ...readSingleton('contact-info'), geo: { lat: 47.9, lng: 33.4 } }],
  ];
}

test('проби проходять схему', () => {
  for (const [collection, slug, data] of probes()) {
    const result = schemas[collection].safeParse(data);
    assert.ok(result.success, `${collection}/${slug}: ${JSON.stringify(result.error?.issues)}`);
  }
});

test('туди-й-назад: кожен справжній запис повертається тим самим', () => {
  for (const [collection, slug, data] of realEntries()) {
    assert.deepEqual(roundTrip(collection, slug, data), canonical(collection, data), `${collection}/${slug}`);
  }
});

test('туди-й-назад: необовʼязкові поля, null і порожні списки', () => {
  for (const [collection, slug, data] of probes()) {
    assert.deepEqual(roundTrip(collection, slug, data), canonical(collection, data), `${collection}/${slug}`);
  }
});

test('пара uk/en — два поля поруч, числа — рядками, fixed і slug — не поля', () => {
  const data = project('p', { progress: { percent: 38, raised: pair('1'), goal: pair('3') } });
  const { content, slug } = toStory('projects', 'p', data, { asset });
  assert.equal(slug, 'p');
  assert.equal(content.component, 'project');
  assert.equal(content.title_uk, data.title.uk);
  assert.equal(content.title_en, data.title.en);
  assert.equal('title' in content, false);
  assert.equal('slug' in content, false);
  assert.equal(content.order, '0');
  assert.equal(content.progress.length, 1);
  assert.equal(content.progress[0].percent, '38');
  assert.equal(content.media[0].component, 'gallery_image');
  assert.equal('type' in content.media[0], false, 'дискримінатор type — це тип блоку, а не поле');
  assert.ok(content.media[0]._uid, 'кожен блок має _uid');
});

test('nullable-група null — нуль блоків; обовʼязкова — рівно один', () => {
  const { content } = toStory('churches', 'c', church('c'), { asset });
  assert.deepEqual(content.geo, []);
  assert.equal(content.seo.length, 1);
});

test('картинка медіатеки — asset з id, зовнішня — is_external_url', () => {
  const { content } = toStory('site-settings', 'site-settings', readSingleton('site-settings'), { asset });
  const logo = content.logo_uk;
  assert.equal(logo.fieldtype, 'asset');
  if (logo.filename.startsWith(LIBRARY)) assert.equal(logo.is_external_url, false);
  const ext = toStory('pastors', 'p', person('p', 'elder'), { asset }).content.photo;
  assert.equal(ext.is_external_url, true);
  assert.equal(ext.id, null);
  assert.throws(() => toStory('site-settings', 's', readSingleton('site-settings')), /медіатек/, 'відносний шлях без резолвера мусить падати');
});

test('відбиток записаний у службове поле й дорівнює відбитку прочитаних даних', () => {
  const story = toStory('ministries', 'm', ministry('m'), { asset });
  assert.match(story.content[FINGERPRINT_FIELD], /^[0-9a-f]{64}$/);
  assert.equal(story.content[FINGERPRINT_FIELD], fingerprint(fromStory('ministries', story)));
  assert.equal('import_hash' in fromStory('ministries', story), false, 'відбиток — поза даними');
});

test('toStory детермінований — інакше повторний імпорт бачив би зміни', () => {
  const data = ministry('m', { media: [image('a'), video()] });
  assert.deepEqual(toStory('ministries', 'm', data, { asset }), toStory('ministries', 'm', data, { asset }));
});

test('відбиток не залежить від порядку ключів', () => {
  assert.equal(fingerprint({ a: 1, b: { c: 2, d: 3 } }), fingerprint({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notEqual(fingerprint({ a: 1 }), fingerprint({ a: 2 }));
});

test('число, що прийшло JSON-числом, — те саме число', () => {
  // Review Focus 3: Storyblok зберігає number рядком, але віддати може й числом.
  const story = toStory('projects', 'p', project('p', { order: 7 }), { asset });
  story.content.order = 7;
  assert.equal(fromStory('projects', story).order, 7);
});

test('неперекладене поле не підміняється українським — схема падає', () => {
  // Review Focus 4: головна причина парних полів замість мовного механізму.
  const story = toStory('ministries', 'm', ministry('m'), { asset });
  story.content.summary_en = '';
  const data = fromStory('ministries', story);
  assert.equal(data.summary.en, '');
  const result = schemas.ministries.safeParse(data);
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path.join('.') === 'summary.en'));
});

test('прибраний обовʼязковий блок не вигадується — схема падає з назвою поля', () => {
  const story = toStory('ministries', 'm', ministry('m'), { asset });
  story.content.seo = [];
  const result = schemas.ministries.safeParse(fromStory('ministries', story));
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((i) => i.path[0] === 'seo'));
});

test('два блоки в полі «максимум один» не губляться мовчки', () => {
  const story = toStory('churches', 'c', church('c', { geo: { lat: 1, lng: 2 } }), { asset });
  story.content.geo = [story.content.geo[0], story.content.geo[0]];
  assert.equal(schemas.churches.safeParse(fromStory('churches', story)).success, false);
});

test('pages.body: «немає» ≡ null (Storyblok їх не розрізняє)', () => {
  assert.equal(canonical('pages', { title: pair('Т') }).body, null);
  assert.equal(roundTrip('pages', 'x', { title: pair('Т') }).body, null);
});

test('чужий тип контенту — помилка, а не мовчазні дані', () => {
  const story = toStory('ministries', 'm', ministry('m'), { asset });
  assert.throws(() => fromStory('churches', story), /ministry/);
});

test('storyPath — папка колекції і slug', () => {
  assert.equal(storyPath('ministries', 'youth'), 'ministries/youth');
  assert.equal(storyPath('homepage', 'homepage'), 'settings/homepage');
  assert.equal(storyPath('pages', 'about'), 'pages/about');
});
```

- [ ] **Step 2: Запустити тест, переконатися, що падає**

Run: `node --test tests/cms-convert.test.js`
Expected: FAIL: `Cannot find module …/convert.mjs`.

- [ ] **Step 3: Реалізація**

`src/lib/storyblok/convert.mjs`:

```js
import { createHash } from 'node:crypto';
import { COLLECTIONS, COMPONENTS, FINGERPRINT_FIELD } from './model.mjs';

// Чисті перетворення між записом схеми (src/lib/schema.mjs) і історією
// Storyblok. На Етапі 5 fromStory без змін стає завантажувачем Astro,
// тож тут немає ні мережі, ні файлової системи.

const EMPTY = (value) => value === undefined || value === null || value === '';

export const storyPath = (collection, slug) => `${COLLECTIONS[collection].folder}/${slug}`;

// Детермінований uuid: той самий запис дає ті самі _uid блоків, і
// повторний імпорт не бачить змін там, де їх немає.
export function stableUuid(seed) {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

// Відбиток даних (а не сирого JSON історії): ключі, які Storyblok дописує
// сам (alt: null у asset, meta_data), і назва історії правкою не є.
export const fingerprint = (value) => createHash('sha256').update(stable(value)).digest('hex');

function variantFor(variants, data, where) {
  const name = variants.find((v) =>
    Object.entries(COMPONENTS[v].fixed ?? {}).every(([key, value]) => data?.[key] === value));
  if (!name) throw new Error(`${where}: жоден тип (${variants.join(', ')}) не підходить до запису`);
  return name;
}

function storyName(collection, slug, data) {
  const entry = COLLECTIONS[collection];
  if (entry.name) return entry.name;
  const label = data.title?.uk ?? data.name?.uk ?? (typeof data.name === 'string' ? data.name : '');
  return label.trim() || slug;
}

// ---- файли → Storyblok

function assetValue(src, resolve) {
  if (EMPTY(src)) return { id: null, filename: '', fieldtype: 'asset' };
  if (/^https?:\/\//.test(src)) return { id: null, filename: src, fieldtype: 'asset', is_external_url: true };
  const found = resolve(src);
  if (!found) throw new Error(`toStory: «${src}» ще не завантажено в медіатеку`);
  return { id: found.id, filename: found.filename, fieldtype: 'asset', is_external_url: false };
}

function writeScalar(kind, value, ctx) {
  switch (kind) {
    case 'text': case 'textarea': case 'option': return value ?? '';
    case 'number': return EMPTY(value) ? '' : String(value);
    case 'boolean': return value === true;
    case 'image': case 'file': return assetValue(value, ctx.asset);
    default: throw new Error(`невідомий тип поля: ${kind}`);
  }
}

function writeBlok(name, data, ctx, path) {
  const blok = { component: name, _uid: stableUuid(`${ctx.seed}#${path}`) };
  for (const [key, field] of Object.entries(COMPONENTS[name].fields)) {
    const value = data[key];
    const at = path ? `${path}.${key}` : key;
    if (field.kind === 'pair') {
      blok[`${key}_uk`] = writeScalar(field.item, value?.uk, ctx);
      blok[`${key}_en`] = writeScalar(field.item, value?.en, ctx);
    } else if (field.kind === 'group') {
      blok[key] = value == null ? [] : [writeBlok(field.component, value, ctx, at)];
    } else if (field.kind === 'list') {
      blok[key] = (value ?? []).map((item, i) => (field.unwrap
        ? writeBlok(field.components[0], { [field.unwrap]: item }, ctx, `${at}.${i}`)
        : writeBlok(variantFor(field.components, item, at), item, ctx, `${at}.${i}`)));
    } else {
      blok[key] = writeScalar(field.kind, value, ctx);
    }
  }
  return blok;
}

export function toStory(collection, slug, data, { asset = () => undefined } = {}) {
  const entry = COLLECTIONS[collection];
  const component = variantFor(entry.variants, data, `${collection}/${slug}`);
  const content = writeBlok(component, data, { asset, seed: `${collection}/${slug}` }, '');
  const story = { name: storyName(collection, slug, data), slug, content };
  // Відбиток рахується тією ж функцією, що перевіряє історію перед
  // оновленням (scripts/cms/sync.mjs): з даних, які ця історія дасть.
  content[FINGERPRINT_FIELD] = fingerprint(fromStory(collection, story));
  return story;
}

// ---- Storyblok → дані

function readScalar(kind, value, ctx) {
  switch (kind) {
    case 'text': case 'textarea': case 'option': return typeof value === 'string' ? value : '';
    case 'number':
      if (typeof value === 'number') return value;
      if (EMPTY(value)) return '';
      // Нечислове значення лишається як є: схема назве поле, а не мовчки 0.
      return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value;
    case 'boolean': return value === true;
    case 'image': case 'file': return value?.filename ? ctx.assetPath(value) : '';
    default: throw new Error(`невідомий тип поля: ${kind}`);
  }
}

function readBlok(blok, ctx) {
  const def = COMPONENTS[blok?.component];
  if (!def) throw new Error(`невідомий компонент «${blok?.component}»`);
  const data = { ...(def.fixed ?? {}) };
  for (const [key, field] of Object.entries(def.fields)) {
    if (field.kind === 'pair') {
      const uk = readScalar(field.item, blok[`${key}_uk`], ctx);
      const en = readScalar(field.item, blok[`${key}_en`], ctx);
      // Обидва порожні — «поля немає». Одне порожнє — лишається порожнім:
      // схема завалить збірку, а не покаже українське на англійській.
      if (EMPTY(uk) && EMPTY(en) && (field.nullable || field.optional)) {
        if (field.nullable) data[key] = null;
      } else {
        data[key] = { uk, en };
      }
    } else if (field.kind === 'group') {
      const bloks = Array.isArray(blok[key]) ? blok[key] : [];
      if (bloks.length === 0) {
        if (field.nullable) data[key] = null;
        // optional — ключа немає; обовʼязковий — теж немає, і схема скаже «Required».
      } else {
        // Два блоки там, де дозволено один, — масив: схема відкине, а не
        // мовчки візьме перший.
        data[key] = bloks.length === 1 ? readBlok(bloks[0], ctx) : bloks.map((b) => readBlok(b, ctx));
      }
    } else if (field.kind === 'list') {
      const bloks = Array.isArray(blok[key]) ? blok[key] : [];
      data[key] = bloks.map((b) => (field.unwrap ? readBlok(b, ctx)[field.unwrap] : readBlok(b, ctx)));
    } else {
      const value = readScalar(field.kind, blok[key], ctx);
      if (EMPTY(value) && field.nullable) data[key] = null;
      else if (!(EMPTY(value) && field.optional)) data[key] = value;
    }
  }
  return data;
}

export function fromStory(collection, story, { assetPath = (asset) => asset.filename } = {}) {
  const entry = COLLECTIONS[collection];
  const component = story.content?.component;
  if (!entry.variants.includes(component)) {
    throw new Error(`${story.full_slug ?? story.slug}: тип «${component}» не належить колекції ${collection} (${entry.variants.join(', ')})`);
  }
  const data = readBlok(story.content, { assetPath });
  return entry.kind === 'collection' ? { slug: story.slug, ...data } : data;
}

// Схема дозволяє в pages.*.body і відсутність ключа, і null, а Storyblok їх
// не розрізняє. Для порівняння «немає» ≡ null (Спека 3).
export function canonical(collection, data) {
  return fillNulls(variantFor(COLLECTIONS[collection].variants, data, collection), data);
}

function fillNulls(name, data) {
  const out = { ...data };
  for (const [key, field] of Object.entries(COMPONENTS[name].fields)) {
    const value = out[key];
    if (value === undefined) {
      if (field.optional && field.nullable) out[key] = null;
    } else if (field.kind === 'group' && value !== null) {
      out[key] = fillNulls(field.component, value);
    } else if (field.kind === 'list' && !field.unwrap) {
      out[key] = value.map((item) => fillNulls(variantFor(field.components, item, key), item));
    }
  }
  return out;
}
```

- [ ] **Step 4: Запустити тест**

Run: `node --test tests/cms-convert.test.js`
Expected: PASS (16 tests).

- [ ] **Step 5: Повний прогін і commit**

Run: `npm test` → PASS.

```bash
git add src/lib/storyblok/convert.mjs tests/cms-convert.test.js
git commit -m "feat: toStory/fromStory — парні поля uk/en, групи, списки, відбиток

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 5: JSON компонентів і папок для Storyblok

**Files:**
- Create: `src/lib/storyblok/components.mjs`
- Test: `tests/cms-components.test.js`

**Interfaces:**
- Consumes: `COMPONENTS`, `COLLECTIONS`, `FOLDERS`, `FINGERPRINT_FIELD` (Задача 3); `stableUuid` (Задача 4).
- Produces:
  - `buildComponents() → Array<{ name, display_name, is_root, is_nestable, schema }>` — тіло `component` для `POST/PUT /components`.
  - `buildFolders() → Array<{ slug, name, content_types: string[], default_root: string }>`.
  - `ROOT_COMPONENTS: Set<string>`.

- [ ] **Step 1: Написати тест, що падає**

`tests/cms-components.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MINISTRY_ICON_NAMES } from '../src/lib/icons.mjs';
import { buildComponents, buildFolders, ROOT_COMPONENTS } from '../src/lib/storyblok/components.mjs';
import { COLLECTIONS, COMPONENTS, FINGERPRINT_FIELD, FOLDERS } from '../src/lib/storyblok/model.mjs';

const components = buildComponents();
const byName = new Map(components.map((c) => [c.name, c]));
const fieldsOf = (c) => Object.entries(c.schema).filter(([, f]) => f.type !== 'tab');
const tabsOf = (c) => Object.entries(c.schema).filter(([, f]) => f.type === 'tab');

test('компонент на кожен компонент моделі, корені — типи контенту, решта — вкладені', () => {
  assert.deepEqual([...byName.keys()].sort(), Object.keys(COMPONENTS).sort());
  for (const c of components) {
    assert.equal(c.is_root, ROOT_COMPONENTS.has(c.name), c.name);
    assert.equal(c.is_nestable, !c.is_root, c.name);
    assert.ok(c.display_name, `${c.name}: без підпису`);
  }
});

test('наші назви не перетинаються з демо-вмістом, який прибирає перший імпорт', () => {
  for (const demo of ['page', 'teaser', 'grid', 'feature']) assert.equal(byName.has(demo), false, demo);
  for (const reserved of ['content']) assert.equal(byName.has(reserved), false, reserved);
});

test('пара uk/en — два поля з підписами (укр.) / (англ.)', () => {
  const ministry = byName.get('ministry').schema;
  assert.equal(ministry.name_uk.display_name, `${COMPONENTS.ministry.fields.name.label} (укр.)`);
  assert.equal(ministry.name_en.display_name, `${COMPONENTS.ministry.fields.name.label} (англ.)`);
  assert.equal(ministry.summary_uk.type, 'textarea');
  assert.equal(ministry.name_uk.type, 'text');
});

test('блоки посилаються лише на наявні компоненти', () => {
  for (const c of components) {
    for (const [key, f] of fieldsOf(c)) {
      if (f.type !== 'bloks') continue;
      assert.equal(f.restrict_components, true, `${c.name}.${key}`);
      for (const name of f.component_whitelist) assert.ok(byName.has(name), `${c.name}.${key} → ${name}`);
    }
  }
});

test('обовʼязкова група — рівно один блок, nullable/optional — максимум один', () => {
  const church = byName.get('church').schema;
  assert.equal(church.seo.maximum, 1);
  assert.equal(church.seo.minimum, 1);
  assert.equal(church.seo.required, true);
  assert.equal(church.geo.maximum, 1);
  assert.equal('required' in church.geo, false);
  assert.equal(byName.get('site_page').schema.seo.required, undefined);
});

test('required у формі — там, де схема не дозволяє порожнечі', () => {
  const ministry = byName.get('ministry').schema;
  assert.equal(ministry.leader.required, true);
  assert.equal(ministry.media.required, true, 'порожня галерея — помилка схеми');
  assert.equal(byName.get('pastor').schema.email.required, undefined, 'nullable');
  assert.equal(byName.get('home_news_image').schema.alt.required, undefined, 'alt новини може бути порожнім');
  assert.equal(byName.get('resource_document').schema.format.required, true, 'формат документа — обовʼязковий');
  assert.equal(byName.get('seo').schema.noindex.required, undefined, 'галочка не буває обовʼязковою');
});

test('списки значень беруться з коду, а не пишуться вдруге', () => {
  const icon = byName.get('ministry').schema.icon;
  assert.equal(icon.type, 'option');
  assert.deepEqual(icon.options.map((o) => o.value), MINISTRY_ICON_NAMES);
  assert.equal('source' in icon, false, 'source «self» — це відсутній ключ');
  assert.deepEqual(byName.get('pastor').schema.group.options, [{ name: 'Пастор', value: 'pastor' }, { name: 'Пресвітер', value: 'elder' }]);
});

test('картинки — asset з дозволеною зовнішньою адресою', () => {
  const photo = byName.get('pastor').schema.photo;
  assert.equal(photo.type, 'asset');
  assert.deepEqual(photo.filetypes, ['images']);
  assert.equal(photo.allow_external_url, true);
});

test('у кореня вкладки покривають кожне поле рівно раз, відбиток — у «Службове»', () => {
  for (const name of ROOT_COMPONENTS) {
    const c = byName.get(name);
    const keys = fieldsOf(c).map(([k]) => k).sort();
    const inTabs = tabsOf(c).flatMap(([, t]) => t.keys).sort();
    assert.deepEqual(inTabs, keys, name);
    for (const [key] of tabsOf(c)) assert.match(key, /^tab-[0-9a-f-]{36}$/, `${name}: ключ вкладки`);
    const service = tabsOf(c).find(([, t]) => t.display_name === 'Службове');
    assert.ok(service?.[1].keys.includes(FINGERPRINT_FIELD), `${name}: відбиток не у «Службове»`);
  }
  assert.equal(tabsOf(byName.get('seo')).length, 0, 'вкладені блоки — без вкладок');
});

test('ключі полів не збігаються зі службовими ключами Storyblok', () => {
  for (const c of components) for (const [key] of fieldsOf(c)) assert.ok(!['component', '_uid', '_editable'].includes(key), `${c.name}.${key}`);
});

test('генерація детермінована — інакше повторний імпорт оновлював би компоненти', () => {
  assert.deepEqual(buildComponents(), components);
});

test('папка на кожну папку моделі, обмежена рівно типами своїх колекцій', () => {
  const folders = buildFolders();
  assert.deepEqual(folders.map((f) => f.slug).sort(), Object.keys(FOLDERS).sort());
  for (const folder of folders) {
    const expected = Object.values(COLLECTIONS).filter((c) => c.folder === folder.slug).flatMap((c) => c.variants);
    assert.deepEqual(folder.content_types, expected, folder.slug);
    assert.equal(folder.default_root, expected[0]);
    assert.equal(folder.name, FOLDERS[folder.slug]);
  }
});
```

- [ ] **Step 2: Запустити тест, переконатися, що падає**

Run: `node --test tests/cms-components.test.js`
Expected: FAIL: `Cannot find module …/components.mjs`.

- [ ] **Step 3: Реалізація**

`src/lib/storyblok/components.mjs`:

```js
import { stableUuid } from './convert.mjs';
import { COLLECTIONS, COMPONENTS, FINGERPRINT_FIELD, FOLDERS } from './model.mjs';

// JSON компонентів і папок для Management API — з моделі, без ручних
// правок в адмінці: повторний імпорт порівнює їх і каже «0 змін».

const TABS = { content: 'Контент', gallery: 'Галерея', seo: 'SEO', service: 'Службове' };

export const ROOT_COMPONENTS = new Set(Object.values(COLLECTIONS).flatMap((c) => c.variants));

// Хибні прапорці не пишемо зовсім: API може їх не повертати, і порівняння
// «наше ⊆ їхнє» бачило б зміну там, де її немає.
function scalar(kind, field, displayName, required) {
  const base = {
    display_name: displayName,
    ...(required && { required: true }),
    ...(field.description && { description: field.description }),
  };
  switch (kind) {
    case 'text': case 'textarea': case 'number': case 'boolean':
      return { type: kind, ...base };
    case 'option':
      return { type: 'option', ...base, options: field.values.map((value) => ({ name: field.names?.[value] ?? value, value })) };
    case 'image':
      return { type: 'asset', ...base, filetypes: ['images'], allow_external_url: true };
    case 'file':
      return { type: 'asset', ...base, allow_external_url: true };
    default:
      throw new Error(`невідомий тип поля: ${kind}`);
  }
}

// required Storyblok перевіряє лише у формі редактора, не в API — справжня
// сітка безпеки лишається на збірці (Спека 3).
function storyblokFields(key, field) {
  if (field.kind === 'list') {
    return [[key, {
      type: 'bloks', display_name: field.label, restrict_components: true, component_whitelist: field.components,
      ...(field.required && { required: true, minimum: 1 }),
    }]];
  }
  const required = field.required ?? !(field.optional || field.nullable || field.allowEmpty || field.kind === 'boolean');
  if (field.kind === 'pair') {
    return [
      [`${key}_uk`, scalar(field.item, field, `${field.label} (укр.)`, required)],
      [`${key}_en`, scalar(field.item, field, `${field.label} (англ.)`, required)],
    ];
  }
  if (field.kind === 'group') {
    return [[key, {
      type: 'bloks', display_name: field.label, restrict_components: true, component_whitelist: [field.component],
      maximum: 1, ...(required && { required: true, minimum: 1 }),
    }]];
  }
  return [[key, scalar(field.kind, field, field.label, required)]];
}

export function buildComponents() {
  return Object.entries(COMPONENTS).map(([name, def]) => {
    const root = ROOT_COMPONENTS.has(name);
    const fields = Object.entries(def.fields).flatMap(([key, field]) =>
      storyblokFields(key, field).map(([k, f]) => ({ key: k, field: f, tab: field.tab ?? 'content' })));
    if (root) {
      fields.push({
        key: FINGERPRINT_FIELD,
        tab: 'service',
        field: {
          type: 'text',
          display_name: 'Відбиток імпорту — не змінювати',
          description: 'Службове поле: за ним імпорт із файлів помічає правки в Storyblok і не перезаписує їх.',
        },
      });
    }
    const schema = {};
    let pos = 0;
    // Вкладки — лише в типів контенту: вкладений блок і так короткий.
    // Ключ «tab-<uuid>» — формат Storyblok; uuid детермінований.
    if (root) {
      for (const [tab, displayName] of Object.entries(TABS)) {
        const keys = fields.filter((f) => f.tab === tab).map((f) => f.key);
        if (keys.length > 0) schema[`tab-${stableUuid(`${name}:${tab}`)}`] = { type: 'tab', display_name: displayName, keys, pos: pos++ };
      }
    }
    for (const { key, field } of fields) schema[key] = { ...field, pos: pos++ };
    return { name, display_name: def.label, is_root: root, is_nestable: !root, schema };
  });
}

export function buildFolders() {
  return Object.entries(FOLDERS).map(([slug, name]) => {
    const contentTypes = Object.values(COLLECTIONS).filter((c) => c.folder === slug).flatMap((c) => c.variants);
    return { slug, name, content_types: contentTypes, default_root: contentTypes[0] };
  });
}
```

- [ ] **Step 4: Запустити тест**

Run: `node --test tests/cms-components.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Повний прогін і commit**

Run: `npm test` → PASS.

```bash
git add src/lib/storyblok/components.mjs tests/cms-components.test.js
git commit -m "feat: JSON компонентів і папок Storyblok з моделі — вкладки, required, підписи

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 6: фейковий Management API і клієнт

**Files:**
- Create: `tests/helpers/fake-storyblok.js`
- Create: `tests/helpers/cms.js`
- Create: `scripts/cms/client.mjs`
- Test: `tests/cms-client.test.js`

**Interfaces:**
- Produces (клієнт):
  - `createClient({ token, spaceId, baseUrl, rps = 3, retries = 6, backoffMs = 1000, fetch }) → client`, де `client` має методи `get(path, query?)`, `post(path, body)`, `put(path, body)`, `delete(path)` (повертають розібраний JSON) і `all(path, key, query?) → items[]` (усі сторінки). Також `upload(filename, bytes, contentType) → asset {id, filename}`, `download(url) → Buffer` і лічильники `stats: { requests, retries }`. `path` пишеться відносно `/v1/spaces/:spaceId`, наприклад `'/stories'`.
  - `clientFromEnv(env = process.env) → client`: бракує змінної → `throw` з її назвою.
  - `REGIONS: { eu, us, ca, ap, cn }` → базові URL.
- Produces (тести):
  - `startFakeStoryblok({ token?, spaceId?, limit?, windowMs?, seedDemo?, failOnWrite? }) → Promise<fake>`, де `fake` = `{ baseUrl, token, spaceId, state, requests(), writes(), story(fullSlug), editStory(fullSlug, mutate, { publish = true }), addStory({ parentSlug, slug, name, content }), close() }`. `state = { components, stories, assets, files: Map, uploads, rejected }`.
  - `fakeClient(fake, opts?)`: клієнт на фейк із `rps: 1000, backoffMs: 5`.
  - `withFake(opts, fn)`: запускає фейк, викликає `fn(fake)` і завжди закриває.
  - `withContentCopy(prepare, fn)`: тимчасова копія `src/content`, `prepare(fixture)`, потім `fn(dir)`.
  - `quietLog()`: `{ log(line), lines: string[], text() }`.

- [ ] **Step 1: Фейковий API** (допоміжний код тестів, пишеться першим)

`tests/helpers/fake-storyblok.js`:

```js
import { createServer } from 'node:http';

// Management API у памʼяті: ті самі шляхи, форми відповідей, ліміт і 429,
// що й у Storyblok (документація MAPI v1; де вона мовчить — див. план
// Етапу 4, рішення 15). Живий простір тести не чіпають ніколи.
//
// Як і справжній API, фейк дописує до збереженого свої ключі (id полів,
// created_at, alt: null у asset): повторний імпорт мусить лишатися «0 змін»
// попри це (Review Focus 1).

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const ASSET_DEFAULTS = { alt: null, name: '', focus: null, title: null, source: null, copyright: null, meta_data: {} };

function decorateAssets(value) {
  if (Array.isArray(value)) return value.map(decorateAssets);
  if (value && typeof value === 'object') {
    const out = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decorateAssets(v)]));
    return out.fieldtype === 'asset' ? { ...ASSET_DEFAULTS, ...out } : out;
  }
  return value;
}

const listItem = ({ content, ...rest }) => rest;
// Storyblok «параметризує» імʼя файлу: крапки, крім останньої, стають «_».
const parameterize = (name) => name.replace(/\.(?=.*\.)/g, '_');

export async function startFakeStoryblok({
  token = 'test-token', spaceId = '1', limit = Infinity, windowMs = 1000, seedDemo = false, failOnWrite = null,
} = {}) {
  const state = { components: [], stories: [], assets: [], files: new Map(), uploads: 0, rejected: 0, log: [] };
  let nextId = 1;
  let hits = [];
  let writeCount = 0;
  let baseUrl = '';

  const fullSlugOf = (story) => {
    const parent = state.stories.find((s) => s.id === story.parent_id);
    return parent ? `${parent.full_slug}/${story.slug}` : story.slug;
  };
  const decorateComponent = (component, id) => ({
    ...component,
    id,
    created_at: '2026-09-24T00:00:00.000Z',
    component_group_uuid: null,
    schema: Object.fromEntries(Object.entries(component.schema ?? {}).map(([k, f], i) => [k, { id: `f${i}`, ...f }])),
  });
  const addStory = ({ name, slug, parent_id = 0, is_folder = false, default_root, content, published = false }) => {
    const story = {
      id: nextId++, uuid: `uuid-${nextId}`, name, slug, parent_id, is_folder, default_root,
      content: decorateAssets(content), published, unpublished_changes: false,
    };
    story.full_slug = fullSlugOf(story);
    state.stories.push(story);
    return story;
  };

  if (seedDemo) {
    for (const name of ['page', 'teaser', 'grid', 'feature']) state.components.push(decorateComponent({ name, schema: {}, is_root: name === 'page', is_nestable: name !== 'page' }, nextId++));
    addStory({ name: 'Home', slug: 'home', content: { component: 'page', _uid: 'demo', body: [] }, published: true });
  }

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  async function handle(req, res) {
    const url = new URL(req.url, baseUrl);
    const method = req.method;

    // Сховище файлів (S3 і CDN): не MAPI, без токена й ліміту.
    if (method === 'POST' && url.pathname === '/s3') {
      const form = await new Request('http://fake/s3', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: await readBody(req) }).formData();
      const file = form.get('file');
      state.files.set(`/${form.get('key')}`, Buffer.from(await file.arrayBuffer()));
      state.uploads++;
      return send(res, 204);
    }
    if (method === 'GET' && url.pathname.startsWith('/f/')) {
      const bytes = state.files.get(url.pathname);
      if (!bytes) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      return res.end(bytes);
    }

    const m = url.pathname.match(/^\/v1\/spaces\/([^/]+)(\/.*?)\/?$/);
    if (!m) return send(res, 404, { error: 'not found' });
    if (req.headers.authorization !== token) return send(res, 401, { error: 'Unauthorized' });
    if (m[1] !== spaceId) return send(res, 404, { error: 'space not found' });

    const now = Date.now();
    hits = hits.filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      state.rejected++;
      return send(res, 429, { error: 'Too Many Requests' });
    }
    hits.push(now);

    const route = m[2];
    const isWrite = method !== 'GET' || /\/publish$/.test(route) || /\/finish_upload$/.test(route);
    state.log.push({ method, route, write: isWrite });
    if (isWrite && failOnWrite !== null && ++writeCount === failOnWrite) return send(res, 500, { error: 'Internal Server Error' });

    const body = method === 'POST' || method === 'PUT' ? JSON.parse((await readBody(req)).toString() || '{}') : {};
    let r;

    if (route === '/components' && method === 'GET') return send(res, 200, { components: state.components, component_groups: [] });
    if (route === '/components' && method === 'POST') {
      if (state.components.some((c) => c.name === body.component.name)) return send(res, 422, { name: ['has already been taken'] });
      const component = decorateComponent(body.component, nextId++);
      state.components.push(component);
      return send(res, 201, { component });
    }
    if ((r = route.match(/^\/components\/(\d+)$/))) {
      const index = state.components.findIndex((c) => c.id === Number(r[1]));
      if (index < 0) return send(res, 404, { error: 'not found' });
      if (method === 'PUT') {
        state.components[index] = decorateComponent(body.component, state.components[index].id);
        return send(res, 200, { component: state.components[index] });
      }
      if (method === 'DELETE') return send(res, 200, { component: state.components.splice(index, 1)[0] });
    }

    if (route === '/stories' && method === 'GET') {
      const perPage = Number(url.searchParams.get('per_page') ?? 25);
      const page = Number(url.searchParams.get('page') ?? 1);
      const items = state.stories.slice((page - 1) * perPage, page * perPage).map(listItem);
      return send(res, 200, { stories: items }, { total: String(state.stories.length), 'per-page': String(perPage) });
    }
    if (route === '/stories' && method === 'POST') {
      const s = body.story ?? {};
      if (!s.name || !s.slug) return send(res, 422, { error: 'name and slug are required' });
      const parentId = s.parent_id ?? 0;
      if (state.stories.some((x) => x.parent_id === parentId && x.slug === s.slug)) return send(res, 422, { slug: ['has already been taken'] });
      const story = addStory({ ...s, parent_id: parentId, published: Boolean(body.publish) });
      return send(res, 201, { story });
    }
    if ((r = route.match(/^\/stories\/(\d+)(\/publish)?$/))) {
      const story = state.stories.find((s) => s.id === Number(r[1]));
      if (!story) return send(res, 404, { error: 'not found' });
      if (r[2] && method === 'GET') {
        story.published = true;
        story.unpublished_changes = false;
        return send(res, 200, { story });
      }
      if (method === 'GET') return send(res, 200, { story });
      if (method === 'PUT') {
        const s = body.story ?? {};
        for (const key of ['name', 'slug', 'parent_id', 'is_folder', 'default_root']) if (key in s) story[key] = s[key];
        if ('content' in s) story.content = decorateAssets(s.content);
        story.full_slug = fullSlugOf(story);
        if (body.publish) { story.published = true; story.unpublished_changes = false; }
        else if (story.published) story.unpublished_changes = true;
        return send(res, 200, { story });
      }
      if (method === 'DELETE') {
        state.stories = state.stories.filter((s) => s.id !== story.id);
        return send(res, 200, { story });
      }
    }

    if (route === '/assets' && method === 'GET') {
      const perPage = Number(url.searchParams.get('per_page') ?? 25);
      const page = Number(url.searchParams.get('page') ?? 1);
      return send(res, 200, { assets: state.assets.slice((page - 1) * perPage, page * perPage) }, { total: String(state.assets.length) });
    }
    if (route === '/assets' && method === 'POST') {
      const id = nextId++;
      const name = parameterize(body.filename);
      const key = `f/${spaceId}/${id}/${name}`;
      state.assets.push({ id, filename: `${baseUrl}/${key}`, short_filename: name, content_type: null, pending: true });
      return send(res, 200, { id, post_url: `${baseUrl}/s3`, public_url: `${baseUrl}/${key}`, pretty_url: `//fake/${key}`, fields: { key, acl: 'public-read' } });
    }
    if ((r = route.match(/^\/assets\/(\d+)\/finish_upload$/))) {
      const asset = state.assets.find((a) => a.id === Number(r[1]));
      if (!asset) return send(res, 404, { error: 'not found' });
      delete asset.pending;
      return send(res, 200, { asset });
    }
    return send(res, 404, { error: `no route ${method} ${route}` });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => send(res, 500, { error: String(error) }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const story = (fullSlug) => state.stories.find((s) => s.full_slug === fullSlug && !s.is_folder);
  return {
    baseUrl, token, spaceId, state,
    requests: () => state.log.length,
    writes: () => state.log.filter((e) => e.write).length,
    story,
    // Правка «редактором»: з publish — як натиснуте «Опублікувати».
    editStory(fullSlug, mutate, { publish = true } = {}) {
      const s = story(fullSlug);
      mutate(s.content, s);
      if (publish) { s.published = true; s.unpublished_changes = false; } else s.unpublished_changes = true;
    },
    addStory({ parentSlug, slug, name = slug, content }) {
      const parent = state.stories.find((s) => s.is_folder && s.full_slug === parentSlug);
      return addStory({ name, slug, parent_id: parent?.id ?? 0, content, published: true });
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
```

`tests/helpers/cms.js`:

```js
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '../../scripts/cms/client.mjs';
import { ContentFixture, projectRoot } from './build.js';
import { startFakeStoryblok } from './fake-storyblok.js';

export const contentDir = join(projectRoot, 'src/content');
export const publicDir = join(projectRoot, 'public');

// Клієнт на фейк: ліміт фейку, а не 3 запити/с, — інакше повний імпорт у
// тестах ішов би хвилину.
export const fakeClient = (fake, opts = {}) =>
  createClient({ token: fake.token, spaceId: fake.spaceId, baseUrl: fake.baseUrl, rps: 1000, backoffMs: 5, ...opts });

export async function withFake(opts, fn) {
  const fake = await startFakeStoryblok(opts);
  try {
    return await fn(fake);
  } finally {
    await fake.close();
  }
}

// Тимчасова копія src/content, яку тест вільно псує (як withBuild, але без
// збірки): справжній src/content не чіпається ніколи.
export async function withContentCopy(prepare, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'hob-cms-'));
  try {
    cpSync(contentDir, dir, { recursive: true });
    prepare(new ContentFixture(dir));
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function quietLog() {
  const lines = [];
  return { lines, log: (line = '') => lines.push(String(line)), text: () => lines.join('\n') };
}
```

- [ ] **Step 2: Написати тест клієнта, що падає**

`tests/cms-client.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientFromEnv, createClient, REGIONS } from '../scripts/cms/client.mjs';
import { fakeClient, withFake } from './helpers/cms.js';

test('токен іде в Authorization як є, без Bearer', async () => {
  await withFake({}, async (fake) => {
    const { components } = await fakeClient(fake).get('/components');
    assert.deepEqual(components, []);
    await assert.rejects(fakeClient(fake, { token: `Bearer ${fake.token}` }).get('/components'), /401/);
  });
});

test('черга тримає ліміт: не частіше rps запитів на секунду', async () => {
  await withFake({}, async (fake) => {
    const client = fakeClient(fake, { rps: 10 });
    const started = Date.now();
    for (let i = 0; i < 6; i++) await client.get('/components');
    assert.ok(Date.now() - started >= 450, `6 запитів при 10/с за ${Date.now() - started} мс`);
  });
});

test('429 повторюється з паузою, і запит зрештою проходить', async () => {
  await withFake({ limit: 2, windowMs: 150 }, async (fake) => {
    const client = fakeClient(fake, { backoffMs: 40 });
    for (let i = 0; i < 6; i++) await client.get('/components');
    assert.ok(fake.state.rejected > 0, 'фейк жодного разу не відповів 429 — тест нічого не перевірив');
    assert.equal(client.stats.retries, fake.state.rejected);
  });
});

test('вичерпані повтори — помилка з кодом, без токена в тексті', async () => {
  await withFake({ limit: 0 }, async (fake) => {
    const client = fakeClient(fake, { retries: 2, backoffMs: 1 });
    const error = await client.get('/components').catch((e) => e);
    assert.match(error.message, /429/);
    assert.doesNotMatch(error.message, new RegExp(fake.token));
  });
});

test('all() збирає всі сторінки', async () => {
  await withFake({}, async (fake) => {
    for (let i = 0; i < 150; i++) fake.addStory({ slug: `s-${i}`, content: { component: 'x' } });
    const stories = await fakeClient(fake).all('/stories', 'stories');
    assert.equal(stories.length, 150);
    assert.equal(new Set(stories.map((s) => s.id)).size, 150);
  });
});

test('завантаження в медіатеку: підписаний запит → сховище → finish_upload', async () => {
  await withFake({}, async (fake) => {
    const client = fakeClient(fake);
    const bytes = Buffer.from([1, 2, 3, 250]);
    const asset = await client.upload('logo.v2.png', bytes, 'image/png');
    assert.ok(asset.id);
    assert.match(asset.filename, /logo_v2\.png$/, 'імʼя параметризоване, як у Storyblok');
    assert.deepEqual(await client.download(asset.filename), bytes);
  });
});

test('clientFromEnv: бракує змінної — повідомлення з її назвою, без токена', () => {
  // Review Focus 5.
  assert.throws(() => clientFromEnv({}), /STORYBLOK_MANAGEMENT_TOKEN/);
  assert.throws(() => clientFromEnv({ STORYBLOK_MANAGEMENT_TOKEN: 'secret-x' }), (e) => /STORYBLOK_SPACE_ID/.test(e.message) && !/secret-x/.test(e.message));
  assert.throws(() => clientFromEnv({ STORYBLOK_MANAGEMENT_TOKEN: 't', STORYBLOK_SPACE_ID: '1', STORYBLOK_REGION: 'mars' }), /mars/);
  assert.equal(REGIONS.eu, 'https://mapi.storyblok.com');
  assert.ok(clientFromEnv({ STORYBLOK_MANAGEMENT_TOKEN: 't', STORYBLOK_SPACE_ID: '1', STORYBLOK_REGION: 'EU' }));
  assert.ok(clientFromEnv({ STORYBLOK_MANAGEMENT_TOKEN: 't', STORYBLOK_SPACE_ID: '1' }), 'регіон типово EU');
});

test('createClient без обовʼязкових параметрів — помилка одразу, а не на першому запиті', () => {
  assert.throws(() => createClient({ spaceId: '1', baseUrl: 'http://x' }), /token/);
});
```

- [ ] **Step 3: Запустити тест, переконатися, що падає**

Run: `node --test tests/cms-client.test.js`
Expected: FAIL: `Cannot find module …/scripts/cms/client.mjs`.

- [ ] **Step 4: Реалізація клієнта**

`scripts/cms/client.mjs`:

```js
// Клієнт Storyblok Management API без SDK. Тариф Starter дозволяє 3 запити/с:
// усі запити стають в одну чергу з паузою між стартами, а 429 повторюється
// з експоненційною паузою. Токен не потрапляє в жодне повідомлення.

export const REGIONS = {
  eu: 'https://mapi.storyblok.com',
  us: 'https://api-us.storyblok.com',
  ca: 'https://api-ca.storyblok.com',
  ap: 'https://api-ap.storyblok.com',
  cn: 'https://app.storyblokchina.cn',
};

const PER_PAGE = 100;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createClient({ token, spaceId, baseUrl, rps = 3, retries = 6, backoffMs = 1000, fetch = globalThis.fetch }) {
  if (!token) throw new Error('createClient: немає token');
  if (!spaceId) throw new Error('createClient: немає spaceId');
  if (!baseUrl) throw new Error('createClient: немає baseUrl');
  const interval = 1000 / rps;
  const stats = { requests: 0, retries: 0 };
  let queue = Promise.resolve();
  let lastStart = 0;

  // Черга стартів: навіть паралельні виклики не перевищать rps.
  const slot = () => {
    const turn = queue.then(async () => {
      const wait = lastStart + interval - Date.now();
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();
    });
    queue = turn;
    return turn;
  };

  async function request(method, path, { query, body } = {}) {
    const url = new URL(`/v1/spaces/${spaceId}${path}`, baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, String(value));
    for (let attempt = 0; ; attempt++) {
      await slot();
      stats.requests++;
      const res = await fetch(url, {
        method,
        headers: { Authorization: token, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 429 && attempt < retries) {
        stats.retries++;
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      if (!res.ok) throw new Error(`Storyblok ${method} ${path}: ${res.status} ${text.slice(0, 500)}`);
      return { data: text ? JSON.parse(text) : {}, headers: res.headers };
    }
  }

  const client = {
    stats,
    get: (path, query) => request('GET', path, { query }).then((r) => r.data),
    post: (path, body) => request('POST', path, { body }).then((r) => r.data),
    put: (path, body) => request('PUT', path, { body }).then((r) => r.data),
    delete: (path) => request('DELETE', path).then((r) => r.data),

    async all(path, key, query = {}) {
      const items = [];
      for (let page = 1; ; page++) {
        const { data, headers } = await request('GET', path, { query: { ...query, per_page: PER_PAGE, page } });
        const batch = data[key] ?? [];
        items.push(...batch);
        const total = Number(headers.get('total'));
        if (batch.length < PER_PAGE || (total > 0 && items.length >= total)) return items;
      }
    },

    // Медіатека — три кроки: підписаний запит у MAPI, multipart у сховище
    // (поля підпису, файл останнім під іменем «file»), finish_upload.
    async upload(filename, bytes, contentType) {
      const signed = await client.post('/assets/', { filename, validate_upload: 1 });
      const form = new FormData();
      for (const [key, value] of Object.entries(signed.fields ?? {})) form.append(key, value);
      form.append('file', new Blob([bytes], { type: contentType }), filename);
      const res = await fetch(signed.post_url, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`завантаження «${filename}» у сховище Storyblok: ${res.status} ${(await res.text()).slice(0, 300)}`);
      const done = await client.get(`/assets/${signed.id}/finish_upload`);
      return { id: done.asset?.id ?? signed.id, filename: done.asset?.filename ?? signed.public_url };
    },

    async download(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`не вдалося завантажити ${url}: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
  return client;
}

// Токен і id простору — лише в .env (у .gitignore), скрипти запускаються
// через node --env-file=.env.
export function clientFromEnv(env = process.env) {
  const token = env.STORYBLOK_MANAGEMENT_TOKEN;
  const spaceId = env.STORYBLOK_SPACE_ID;
  const missing = [!token && 'STORYBLOK_MANAGEMENT_TOKEN', !spaceId && 'STORYBLOK_SPACE_ID'].filter(Boolean);
  if (missing.length > 0) throw new Error(`у .env бракує ${missing.join(', ')} (див. CLAUDE.md, розділ «CMS»)`);
  const region = (env.STORYBLOK_REGION || 'eu').trim().toLowerCase();
  const baseUrl = REGIONS[region];
  if (!baseUrl) throw new Error(`STORYBLOK_REGION «${region}» невідомий; можливі: ${Object.keys(REGIONS).join(', ')}`);
  return createClient({ token, spaceId, baseUrl });
}
```

- [ ] **Step 5: Запустити тест**

Run: `node --test tests/cms-client.test.js`
Expected: PASS (8 tests).

- [ ] **Step 6: Повний прогін і commit**

Run: `npm test` → PASS.

```bash
git add scripts/cms/client.mjs tests/helpers/fake-storyblok.js tests/helpers/cms.js tests/cms-client.test.js
git commit -m "feat: клієнт Storyblok Management API (≤ 3 запити/с, повтор 429) і фейковий API для тестів

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 7: читання й валідація контенту для імпорту

**Files:**
- Create: `scripts/cms/content.mjs`
- Test: `tests/cms-content.test.js`

**Interfaces:**
- Consumes: `schemas`, `PAGE_IDS` (Задача 1); `COLLECTIONS` (Задача 3); `toStory`, `storyPath` (Задача 4); `assertUniqueSlugs` з `src/lib/collections.mjs`; `withContentCopy`, `contentDir`, `publicDir` з `tests/helpers/cms.js` (Задача 6).
- Produces:
  - `readContent(dir) → Entry[]`, де `Entry = { collection, slug, path, source, data }`: `path` = `storyPath(...)`, `source` — файл для повідомлень (`ministries/youth.json`, `singletons/pages.json#about`).
  - `validateContent(entries) → string[]` — помилки схеми, дублікати slug, бракує сторінок/`main`.
  - `assetRefs(entries) → string[]` — відсортовані унікальні відносні шляхи з полів-картинок/файлів.
  - `missingAssets(entries, publicDir) → string[]` — помилки для відсутніх файлів.

- [ ] **Step 1: Написати тест, що падає**

`tests/cms-content.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetRefs, missingAssets, readContent, validateContent } from '../scripts/cms/content.mjs';
import { COLLECTIONS } from '../src/lib/storyblok/model.mjs';
import { contentDir, publicDir, withContentCopy } from './helpers/cms.js';
import { readCollection, readPages } from './helpers/content.js';
import { ministry } from './helpers/probes.js';

test('читає всі записи: колекції, сторінки, одиночки — кожен зі своїм шляхом у Storyblok', () => {
  const entries = readContent(contentDir);
  const expected = Object.entries(COLLECTIONS).reduce((n, [c, e]) =>
    n + (e.kind === 'collection' ? readCollection(c).length : e.kind === 'pages' ? Object.keys(readPages()).length : 1), 0);
  assert.equal(entries.length, expected);
  assert.equal(new Set(entries.map((e) => e.path)).size, entries.length, 'два записи на одному шляху');
  for (const e of entries) assert.equal(e.path, `${COLLECTIONS[e.collection].folder}/${e.slug}`);
});

test('справжній контент валідний і всі його файли на місці', () => {
  const entries = readContent(contentDir);
  assert.deepEqual(validateContent(entries), []);
  assert.deepEqual(missingAssets(entries, publicDir), []);
  for (const ref of assetRefs(entries)) assert.doesNotMatch(ref, /^https?:/, ref);
});

test('невалідний запис — помилка з файлом і полем', async () => {
  await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { name: { uk: 'Проба', en: '' } })), (dir) => {
    const errors = validateContent(readContent(dir));
    assert.ok(errors.some((e) => e.includes('ministries/probe.json') && e.includes('name.en')), errors.join('\n'));
  });
});

test('дублікат slug — помилка з обома файлами', async () => {
  await withContentCopy((c) => {
    c.write('ministries', 'probe-a', ministry('probe-twin'));
    c.write('ministries', 'probe-b', ministry('probe-twin'));
  }, (dir) => {
    const errors = validateContent(readContent(dir)).join('\n');
    assert.match(errors, /probe-twin/);
    assert.match(errors, /probe-a/);
    assert.match(errors, /probe-b/);
  });
});

test('бракує сторінки з PAGE_IDS — помилка', async () => {
  await withContentCopy((c) => c.editSingleton('pages', (pages) => { delete pages.about; }), (dir) => {
    assert.match(validateContent(readContent(dir)).join('\n'), /about/);
  });
});

test('порожня колекція (теки немає) — валідна, просто без історій', async () => {
  await withContentCopy((c) => c.clear('testimonies'), (dir) => {
    const entries = readContent(dir);
    assert.deepEqual(validateContent(entries), []);
    assert.equal(entries.some((e) => e.collection === 'testimonies'), false);
  });
});

test('шлях uploads/… на файл, якого немає, — помилка до будь-якого запиту', async () => {
  await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { media: [{ type: 'image', src: 'uploads/nope.jpg', alt: 'Проба' }] })), (dir) => {
    const errors = missingAssets(readContent(dir), publicDir);
    assert.ok(errors.some((e) => e.includes('uploads/nope.jpg')), errors.join('\n'));
  });
});
```

- [ ] **Step 2: Запустити тест, переконатися, що падає**

Run: `node --test tests/cms-content.test.js`
Expected: FAIL: `Cannot find module …/scripts/cms/content.mjs`.

- [ ] **Step 3: Реалізація**

`scripts/cms/content.mjs`:

```js
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertUniqueSlugs } from '../../src/lib/collections.mjs';
import { PAGE_IDS, schemas } from '../../src/lib/schema.mjs';
import { storyPath, toStory } from '../../src/lib/storyblok/convert.mjs';
import { COLLECTIONS } from '../../src/lib/storyblok/model.mjs';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// Ті самі файли, що читає збірка (content.config.ts): запис колекції —
// файл у теці, сторінка — ключ pages.json, одиночка — ключ main.
export function readContent(dir) {
  const entries = [];
  for (const [collection, entry] of Object.entries(COLLECTIONS)) {
    if (entry.kind === 'collection') {
      const folder = join(dir, collection);
      // Git не зберігає порожніх тек: колекція без записів — це відсутня тека.
      if (!existsSync(folder)) continue;
      for (const file of readdirSync(folder).filter((f) => f.endsWith('.json')).sort()) {
        const data = readJson(join(folder, file));
        entries.push({ collection, slug: data.slug, source: `${collection}/${file}`, data });
      }
    } else if (entry.kind === 'pages') {
      for (const [id, data] of Object.entries(readJson(join(dir, 'singletons', 'pages.json')))) {
        entries.push({ collection, slug: id, source: `singletons/pages.json#${id}`, data });
      }
    } else {
      const data = readJson(join(dir, 'singletons', `${collection}.json`)).main;
      entries.push({ collection, slug: entry.slug, source: `singletons/${collection}.json`, data });
    }
  }
  return entries.map((e) => ({ ...e, path: storyPath(e.collection, e.slug) }));
}

// Ті самі перевірки, що й збірка: API Storyblok обовʼязковості полів не
// перевіряє, тож невалідні дані мусять зупинитися тут.
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
    if (entry.kind !== 'collection') continue;
    try {
      assertUniqueSlugs(collection, entries.filter((e) => e.collection === collection).map((e) => ({ id: e.source, slug: e.slug })));
    } catch (error) {
      errors.push(error.message);
    }
  }
  const pageIds = new Set(entries.filter((e) => e.collection === 'pages').map((e) => e.slug));
  const missing = PAGE_IDS.filter((id) => !pageIds.has(id));
  if (missing.length > 0) errors.push(`singletons/pages.json: бракує сторінок ${missing.map((id) => `«${id}»`).join(', ')} — їх читають шаблони`);
  return errors;
}

// Відносні шляхи з полів-картинок і файлів. Збираються тим самим toStory,
// яким імпорт їх записуватиме, — окремого обходу моделі немає.
export function assetRefs(entries) {
  const refs = new Set();
  const record = (src) => {
    refs.add(src);
    return { id: 0, filename: src };
  };
  for (const e of entries) {
    if (e.data !== undefined) toStory(e.collection, e.slug, e.data, { asset: record });
  }
  return [...refs].sort();
}

// Бите посилання на файл схема не бачить (виняток у CLAUDE.md), але
// завантажити в медіатеку неіснуючий файл не можна — зупиняємося до запитів.
export function missingAssets(entries, publicDir) {
  return assetRefs(entries)
    .filter((ref) => !existsSync(join(publicDir, ref)))
    .map((ref) => `${ref}: файлу немає в public/ — на нього посилається контент`);
}
```

- [ ] **Step 4: Запустити тест**

Run: `node --test tests/cms-content.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Повний прогін і commit**

Run: `npm test` → PASS.

```bash
git add scripts/cms/content.mjs tests/cms-content.test.js
git commit -m "feat: читання й валідація контенту для імпорту в Storyblok

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 8: імпорт — план, сухий прогін, `--apply`, `--prune`, `--force`

**Files:**
- Create: `scripts/cms/sync.mjs`
- Create: `scripts/cms/import.mjs`
- Modify: `package.json` (скрипт `cms:import`)
- Test: `tests/cms-import.test.js`

**Interfaces:**
- Consumes: `createClient` (Задача 6); `readContent`, `validateContent`, `assetRefs`, `missingAssets` (Задача 7); `buildComponents`, `buildFolders` (Задача 5); `toStory`, `fromStory`, `fingerprint`, `canonical`, `storyPath` (Задача 4); `COLLECTIONS`, `FOLDERS`, `FINGERPRINT_FIELD` (Задача 3).
- Produces:
  - `runImport({ client, contentDir, publicDir, apply?, prune?, force?, log? }) → { exitCode, plan?, errors? }`.
  - `makePlan({ client, entries, publicDir, prune?, force? }) → Plan`, де `Plan = { components[], folders[], assets[], stories[], demo[], conflicts[], warnings[], unchanged, folderIds: Map, byPath: Map }`.
  - `applyPlan(client, plan)`, `countChanges(plan) → number`.
  - `readSpace(client) → { components, folders, stories, assets }` (історії наших папок і демо-історія — з `content`).
  - `sameComponent(want, have) → boolean`, `publicUrl(url) → string`, `storyblokName(file) → string`, `sha256(bytes) → hex`, `DEMO`.
  - `diffValues`, `runVerify` додаються в Задачі 9 у цей самий файл.

- [ ] **Step 1: Написати тест, що падає**

`tests/cms-import.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readContent } from '../scripts/cms/content.mjs';
import { runImport } from '../scripts/cms/sync.mjs';
import { schemas } from '../src/lib/schema.mjs';
import { canonical, fromStory } from '../src/lib/storyblok/convert.mjs';
import { contentDir, fakeClient, publicDir, quietLog, withContentCopy, withFake } from './helpers/cms.js';
import { ministry } from './helpers/probes.js';

const T = { timeout: 60_000 };
const run = (fake, opts = {}) => {
  const out = quietLog();
  return runImport({ client: fakeClient(fake), contentDir, publicDir, log: out.log, ...opts })
    .then((result) => ({ ...result, out }));
};

// Історії у фейку збігаються з файлами. Картинки медіатеки звіряються за
// іменем (сам вміст — у cms-verify.test.js).
function assertSpaceMatches(fake, dir = contentDir) {
  const entries = readContent(dir);
  const assetPath = (a) => (a.is_external_url ? a.filename : `uploads/${a.filename.split('/').pop()}`);
  for (const entry of entries) {
    const story = fake.story(entry.path);
    assert.ok(story, `${entry.path}: історії немає`);
    assert.equal(story.published, true, `${entry.path}: не опубліковано`);
    assert.deepEqual(fromStory(entry.collection, story, { assetPath }), canonical(entry.collection, entry.data), entry.path);
  }
}

const firstMinistry = () => readContent(contentDir).find((e) => e.collection === 'ministries');

test('сухий прогін: план не порожній, у простір — жодного запису', T, async () => {
  await withFake({ seedDemo: true }, async (fake) => {
    const { exitCode, plan, out } = await run(fake);
    assert.equal(exitCode, 0);
    assert.ok(plan.stories.length > 0 && plan.components.length > 0);
    assert.equal(fake.writes(), 0, 'сухий прогін щось записав');
    assert.match(out.text(), /--apply/);
  });
});

test('--apply: компоненти, папки, файли, історії — усе опубліковано, демо-вміст прибрано', T, async () => {
  await withFake({ seedDemo: true }, async (fake) => {
    const { exitCode } = await run(fake, { apply: true });
    assert.equal(exitCode, 0);
    assertSpaceMatches(fake);
    const names = fake.state.components.map((c) => c.name);
    for (const demo of ['page', 'teaser', 'grid', 'feature']) assert.equal(names.includes(demo), false, demo);
    assert.equal(fake.story('home'), undefined, 'демо-історія home лишилась');
    const folder = fake.state.stories.find((s) => s.is_folder && s.slug === 'ministries');
    assert.deepEqual(folder.content.content_types, ['ministry']);
  });
});

test('повторний імпорт без змін у файлах — «0 змін», жодного запису й завантаження', T, async () => {
  // Review Focus 1: фейк, як і Storyblok, дописує свої ключі до компонентів
  // і asset — це не зміна.
  await withFake({ seedDemo: true }, async (fake) => {
    await run(fake, { apply: true });
    const writes = fake.writes();
    const uploads = fake.state.uploads;
    const { plan, out } = await run(fake, { apply: true });
    assert.equal(plan.conflicts.length, 0);
    assert.deepEqual({ ...plan, byPath: undefined, folderIds: undefined, unchanged: undefined },
      { components: [], folders: [], assets: [], stories: [], demo: [], conflicts: [], warnings: [], byPath: undefined, folderIds: undefined, unchanged: undefined });
    assert.equal(fake.writes(), writes);
    assert.equal(fake.state.uploads, uploads, 'той самий файл завантажено вдруге');
    assert.match(out.text(), /0 змін/);
  });
});

test('зміна у файлах — оновлюється лише змінена історія', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    const target = firstMinistry();
    await withContentCopy((c) => {
      const data = c.read('ministries', target.source.replace(/^ministries\/|\.json$/g, ''));
      c.write('ministries', target.source.replace(/^ministries\/|\.json$/g, ''), { ...data, summary: { ...data.summary, en: `${data.summary.en} (edited)` } });
    }, async (dir) => {
      const out = quietLog();
      const { exitCode, plan } = await runImport({ client: fakeClient(fake), contentDir: dir, publicDir, apply: true, log: out.log });
      assert.equal(exitCode, 0);
      assert.deepEqual(plan.stories.map((s) => `${s.action} ${s.entry.path}`), [`update ${target.path}`]);
      assertSpaceMatches(fake, dir);
    });
  });
});

test('історію змінено в Storyblok — імпорт її не перезаписує без --force', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    const target = firstMinistry();
    fake.editStory(target.path, (content) => { content.summary_en = 'Правка редактора'; });
    const refused = await run(fake, { apply: true });
    assert.equal(refused.exitCode, 1);
    assert.deepEqual(refused.plan.conflicts.map((c) => c.entry.path), [target.path]);
    assert.equal(fake.story(target.path).content.summary_en, 'Правка редактора', 'правку редактора стерто');
    assert.match(refused.out.text(), /--force/);

    const forced = await run(fake, { apply: true, force: true });
    assert.equal(forced.exitCode, 0);
    assertSpaceMatches(fake);
  });
});

test('зайва історія в нашій папці — попередження; видаляє лише --prune', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    fake.addStory({ parentSlug: 'ministries', slug: 'stray', content: { component: 'ministry' } });
    const warned = await run(fake, { apply: true });
    assert.equal(warned.exitCode, 0);
    assert.ok(fake.story('ministries/stray'), 'без --prune зайве видалено');
    assert.match(warned.out.text(), /ministries\/stray/);
    await run(fake, { apply: true, prune: true });
    assert.equal(fake.story('ministries/stray'), undefined);
  });
});

test('невалідні дані — жодного запиту в Storyblok узагалі', T, async () => {
  await withFake({}, async (fake) => {
    await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { icon: 'rocket' })), async (dir) => {
      const out = quietLog();
      const { exitCode, errors } = await runImport({ client: fakeClient(fake), contentDir: dir, publicDir, apply: true, log: out.log });
      assert.equal(exitCode, 1);
      assert.ok(errors.some((e) => e.includes('ministries/probe.json')));
      assert.equal(fake.requests(), 0, 'запит пішов попри невалідні дані');
    });
  });
});

test('файл uploads/…, якого немає, — жодного запиту', T, async () => {
  await withFake({}, async (fake) => {
    await withContentCopy((c) => c.write('ministries', 'probe', ministry('probe', { media: [{ type: 'image', src: 'uploads/nope.jpg', alt: 'Проба' }] })), async (dir) => {
      const { exitCode } = await runImport({ client: fakeClient(fake), contentDir: dir, publicDir, apply: true, log: quietLog().log });
      assert.equal(exitCode, 1);
      assert.equal(fake.requests(), 0);
    });
  });
});

test('ліміт і 429 — повний імпорт усе одно доходить до кінця', T, async () => {
  await withFake({ limit: 20, windowMs: 100 }, async (fake) => {
    const { exitCode } = await run(fake, { apply: true });
    assert.equal(exitCode, 0);
    assert.ok(fake.state.rejected > 0, 'жодного 429 — тест нічого не перевірив');
    assertSpaceMatches(fake);
  });
});

test('обірваний --apply: повторний запуск дописує решту без конфліктів', T, async () => {
  // Review Focus 2: мережа чи 500 посеред імпорту на 3 запити/с — реальність.
  await withFake({ failOnWrite: 60 }, async (fake) => {
    await assert.rejects(run(fake, { apply: true }), /500/);
    const { exitCode, plan } = await run(fake, { apply: true });
    assert.equal(exitCode, 0);
    assert.equal(plan.conflicts.length, 0);
    assertSpaceMatches(fake);
  });
});

test('компонент, змінений в адмінці, повертається до моделі', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    fake.state.components.find((c) => c.name === 'ministry').display_name = 'Хтось перейменував';
    const { plan } = await run(fake, { apply: true });
    assert.deepEqual(plan.components.map((c) => `${c.action} ${c.component.name}`), ['update ministry']);
    assert.equal(fake.state.components.find((c) => c.name === 'ministry').display_name, 'Служіння');
  });
});

test('дані з Storyblok проходять ту саму схему, що й файли', T, async () => {
  await withFake({}, async (fake) => {
    await run(fake, { apply: true });
    for (const entry of readContent(contentDir)) {
      const data = fromStory(entry.collection, fake.story(entry.path), { assetPath: (a) => a.filename });
      const result = schemas[entry.collection].safeParse(data);
      assert.ok(result.success, `${entry.path}: ${JSON.stringify(result.error?.issues)}`);
    }
  });
});
```

- [ ] **Step 2: Запустити тест, переконатися, що падає**

Run: `node --test tests/cms-import.test.js`
Expected: FAIL: `Cannot find module …/scripts/cms/sync.mjs`.

- [ ] **Step 3: Реалізація синхронізації**

`scripts/cms/sync.mjs`:

```js
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { buildComponents, buildFolders } from '../../src/lib/storyblok/components.mjs';
import { fingerprint, fromStory, toStory } from '../../src/lib/storyblok/convert.mjs';
import { COLLECTIONS, FINGERPRINT_FIELD, FOLDERS } from '../../src/lib/storyblok/model.mjs';
import { assetRefs, missingAssets, readContent, validateContent } from './content.mjs';

// Імпорт файлів у Storyblok (Спека 3, Етап 4): план «створити / оновити /
// видалити», сухий прогін за замовчуванням, відбиток проти перезапису правок
// редактора. Ідемпотентний: повторний прогін без змін у файлах — «0 змін».

// Демо-вміст нового простору. Прибирається першим --apply; наші назви з ним
// не збігаються (tests/cms-components.test.js).
export const DEMO = { components: ['page', 'teaser', 'grid', 'feature'], stories: ['home'] };

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Storyblok «параметризує» імʼя файлу: крапки, крім останньої, стають «_».
export const storyblokName = (file) => basename(file).replace(/\.(?=.*\.)/g, '_');
// MAPI віддає адресу файлу і як s3.amazonaws.com/a.storyblok.com/…, і як
// //a.storyblok.com/… — в історію пишемо публічну https-адресу CDN.
export const publicUrl = (url) => url
  .replace(/^https?:\/\/s3\.amazonaws\.com\/a\.storyblok\.com\//, 'https://a.storyblok.com/')
  .replace(/^\/\//, 'https://');

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
};

// «Наше ⊆ їхнє»: API дописує до компонента id, created_at, id полів — це не
// зміна. Хибні прапорці ми не пишемо (components.mjs), тож їхня відсутність
// у відповіді теж не зміна.
function subset(want, have) {
  if (want === have) return true;
  if (want === null || typeof want !== 'object' || have === null || typeof have !== 'object') return false;
  if (Array.isArray(want)) return Array.isArray(have) && want.length === have.length && want.every((w, i) => subset(w, have[i]));
  return Object.entries(want).every(([key, value]) => subset(value, have[key]));
}

export function sameComponent(want, have) {
  const wantKeys = Object.keys(want.schema).sort().join();
  const haveKeys = Object.keys(have.schema ?? {}).sort().join();
  return want.display_name === have.display_name
    && want.is_root === Boolean(have.is_root)
    && want.is_nestable === Boolean(have.is_nestable)
    && wantKeys === haveKeys
    && subset(want.schema, have.schema);
}

const sameFolder = (want, have) => want.name === have.name
  && want.default_root === have.default_root
  && [...(have.content?.content_types ?? [])].sort().join() === [...want.content_types].sort().join();

const folderStory = (folder) => ({
  name: folder.name, slug: folder.slug, parent_id: 0, is_folder: true, default_root: folder.default_root,
  content: { content_types: folder.content_types, lock_subfolders_content_types: false },
});

const isDemoStory = (story) => DEMO.stories.includes(story.full_slug) && story.content?.component === 'page';

// Список історій приходить без content — кожну нашу читаємо окремо
// (78 запитів ≈ 26 с на 3 запити/с).
export async function readSpace(client) {
  const { components } = await client.get('/components');
  const list = await client.all('/stories', 'stories');
  const ours = new Set(Object.keys(FOLDERS));
  const folders = [];
  const stories = [];
  for (const item of list) {
    const top = item.full_slug.split('/')[0];
    const rootFolder = item.is_folder && !item.full_slug.includes('/') && ours.has(top);
    const inOurFolder = !item.is_folder && ours.has(top) && item.full_slug.includes('/');
    const demo = !item.is_folder && DEMO.stories.includes(item.full_slug);
    if (!rootFolder && !inOurFolder && !demo) continue;
    const { story } = await client.get(`/stories/${item.id}`);
    (rootFolder ? folders : stories).push(story);
  }
  const assets = await client.all('/assets', 'assets');
  return { components, folders, stories, assets };
}

// Той самий файл удруге не завантажується: збіг імені й SHA-256 вмісту.
async function resolveAssets(client, refs, publicDir, remoteAssets) {
  const byPath = new Map();
  const uploads = [];
  const remoteHash = new Map();
  for (const ref of refs) {
    const bytes = readFileSync(join(publicDir, ref));
    const hash = sha256(bytes);
    const name = storyblokName(ref);
    let found;
    for (const asset of remoteAssets.filter((a) => basename(a.filename ?? '') === name)) {
      const url = publicUrl(asset.filename);
      if (!remoteHash.has(url)) remoteHash.set(url, sha256(await client.download(url)));
      if (remoteHash.get(url) === hash) {
        found = { id: asset.id, filename: url };
        break;
      }
    }
    if (found) byPath.set(ref, found);
    else uploads.push({ action: 'upload', ref, name, bytes, contentType: MIME[extname(ref).toLowerCase()] ?? 'application/octet-stream' });
  }
  return { byPath, uploads };
}

export async function makePlan({ client, entries, publicDir, prune = false, force = false }) {
  const space = await readSpace(client);
  const plan = {
    components: [], folders: [], assets: [], stories: [], demo: [], conflicts: [], warnings: [], unchanged: 0,
    folderIds: new Map(space.folders.map((f) => [f.slug, f.id])), byPath: new Map(),
  };

  const wanted = buildComponents();
  const remoteByName = new Map(space.components.map((c) => [c.name, c]));
  for (const component of wanted) {
    const remote = remoteByName.get(component.name);
    if (!remote) plan.components.push({ action: 'create', component });
    else if (!sameComponent(component, remote)) plan.components.push({ action: 'update', id: remote.id, component });
  }
  // Вкладені — першими: тип контенту посилається на них у component_whitelist.
  plan.components.sort((a, b) => Number(a.component.is_root) - Number(b.component.is_root));
  const wantedNames = new Set(wanted.map((c) => c.name));
  for (const remote of space.components) {
    if (wantedNames.has(remote.name)) continue;
    if (DEMO.components.includes(remote.name)) plan.demo.push({ action: 'delete-component', id: remote.id, name: remote.name });
    else if (prune) plan.components.push({ action: 'delete', id: remote.id, component: remote });
    else plan.warnings.push(`компонент «${remote.name}» є в Storyblok, але не в моделі (видалить --prune)`);
  }
  for (const story of space.stories.filter(isDemoStory)) plan.demo.push({ action: 'delete-story', id: story.id, name: story.full_slug });

  const remoteFolders = new Map(space.folders.map((f) => [f.slug, f]));
  for (const folder of buildFolders()) {
    const remote = remoteFolders.get(folder.slug);
    if (!remote) plan.folders.push({ action: 'create', folder });
    else if (!sameFolder(folder, remote)) plan.folders.push({ action: 'update', id: remote.id, folder });
  }

  const { byPath, uploads } = await resolveAssets(client, assetRefs(entries), publicDir, space.assets);
  plan.byPath = byPath;
  plan.assets = uploads;

  // Ще не завантажений файл отримує тимчасову адресу: відбиток від неї
  // інший, тож історія з новим файлом чесно потрапляє в «оновити».
  const planAsset = (src) => byPath.get(src) ?? { id: null, filename: `pending:${src}` };
  const remoteByPath = new Map(space.stories.filter((s) => !isDemoStory(s)).map((s) => [s.full_slug, s]));
  for (const entry of entries) {
    const want = toStory(entry.collection, entry.slug, entry.data, { asset: planAsset }).content[FINGERPRINT_FIELD];
    const remote = remoteByPath.get(entry.path);
    if (!remote) {
      plan.stories.push({ action: 'create', entry });
      continue;
    }
    remoteByPath.delete(entry.path);
    let actual;
    try {
      actual = fingerprint(fromStory(entry.collection, remote));
    } catch {
      actual = 'нечитабельна';
    }
    const stored = remote.content?.[FINGERPRINT_FIELD];
    if (actual === want) {
      // Дані ті самі; лишається хіба оновити відбиток чи опублікувати.
      if (stored !== want) plan.stories.push({ action: 'update', entry, remote });
      else if (!remote.published || remote.unpublished_changes) plan.stories.push({ action: 'publish', entry, remote });
      else plan.unchanged++;
      continue;
    }
    // Відбиток не збігається з даними — історію правили після імпорту.
    const edited = stored !== actual;
    if (edited && !force) plan.conflicts.push({ entry, remote });
    else plan.stories.push({ action: 'update', entry, remote, forced: edited });
  }
  for (const remote of remoteByPath.values()) {
    if (prune) plan.stories.push({ action: 'delete', remote });
    else plan.warnings.push(`історія «${remote.full_slug}» є в Storyblok, але не у файлах (видалить --prune)`);
  }
  return plan;
}

export const countChanges = (plan) =>
  plan.components.length + plan.folders.length + plan.assets.length + plan.stories.length + plan.demo.length;

function printPlan(plan, log) {
  const sign = { create: '+', update: '~', delete: '-', upload: '↑', publish: '✓', 'delete-story': '-', 'delete-component': '-' };
  for (const d of plan.demo) log(`${sign[d.action]} демо: ${d.action === 'delete-story' ? 'історія' : 'компонент'} ${d.name}`);
  for (const c of plan.components) log(`${sign[c.action]} компонент ${c.component.name}`);
  for (const f of plan.folders) log(`${sign[f.action]} папка ${f.folder.slug}`);
  for (const a of plan.assets) log(`${sign.upload} файл ${a.ref}`);
  for (const s of plan.stories) {
    const path = s.entry?.path ?? s.remote.full_slug;
    log(`${sign[s.action]} історія ${path}${s.forced ? ' (перезапис правок у Storyblok, --force)' : ''}`);
  }
  for (const c of plan.conflicts) log(`! ${c.entry.path}: змінено в Storyblok після імпорту — не перезаписую (перезаписати: --force)`);
  for (const w of plan.warnings) log(`! ${w}`);
  const n = countChanges(plan);
  log(n === 0
    ? `0 змін (${plan.unchanged} історій збігаються з файлами).`
    : `Разом змін: ${n} — компоненти ${plan.components.length}, папки ${plan.folders.length}, файли ${plan.assets.length}, історії ${plan.stories.length}, демо ${plan.demo.length}; без змін ${plan.unchanged}.`);
}

export async function applyPlan(client, plan) {
  for (const d of plan.demo.filter((x) => x.action === 'delete-story')) await client.delete(`/stories/${d.id}`);
  for (const c of plan.components) {
    if (c.action === 'create') await client.post('/components/', { component: c.component });
    if (c.action === 'update') await client.put(`/components/${c.id}`, { component: c.component });
    if (c.action === 'delete') await client.delete(`/components/${c.id}`);
  }
  // Демо-компоненти — після демо-історії, яка на них посилається.
  for (const d of plan.demo.filter((x) => x.action === 'delete-component')) await client.delete(`/components/${d.id}`);

  const folderIds = new Map(plan.folderIds);
  for (const f of plan.folders) {
    if (f.action === 'create') {
      const { story } = await client.post('/stories/', { story: folderStory(f.folder) });
      folderIds.set(f.folder.slug, story.id);
    } else {
      await client.put(`/stories/${f.id}`, { story: folderStory(f.folder) });
    }
  }

  const byPath = new Map(plan.byPath);
  for (const a of plan.assets) {
    const asset = await client.upload(a.name, a.bytes, a.contentType);
    byPath.set(a.ref, { id: asset.id, filename: publicUrl(asset.filename) });
  }

  for (const s of plan.stories) {
    if (s.action === 'delete') {
      await client.delete(`/stories/${s.remote.id}`);
      continue;
    }
    if (s.action === 'publish') {
      await client.get(`/stories/${s.remote.id}/publish`);
      continue;
    }
    const story = {
      ...toStory(s.entry.collection, s.entry.slug, s.entry.data, { asset: (src) => byPath.get(src) }),
      parent_id: folderIds.get(COLLECTIONS[s.entry.collection].folder),
    };
    // Кожна історія публікується: Етап 5 читатиме опубліковану версію.
    if (s.action === 'create') await client.post('/stories/', { story, publish: 1 });
    else await client.put(`/stories/${s.remote.id}`, { story, publish: 1, force_update: 1 });
  }
}

export async function runImport({ client, contentDir, publicDir, apply = false, prune = false, force = false, log = console.log }) {
  // Валідація спершу і без мережі: API Storyblok обовʼязковості полів не
  // перевіряє, тож невалідні дані не мусять дійти до нього взагалі.
  const entries = readContent(contentDir);
  const errors = [...validateContent(entries), ...missingAssets(entries, publicDir)];
  if (errors.length > 0) {
    log('Контент не проходить перевірку — у Storyblok нічого не надіслано:');
    for (const error of errors) log(`  ✗ ${error}`);
    return { exitCode: 1, errors };
  }
  const plan = await makePlan({ client, entries, publicDir, prune, force });
  printPlan(plan, log);
  const exitCode = plan.conflicts.length > 0 ? 1 : 0;
  if (!apply) {
    if (countChanges(plan) > 0) log('Сухий прогін: у Storyblok нічого не змінено. Застосувати: npm run cms:import -- --apply');
    return { exitCode, plan };
  }
  await applyPlan(client, plan);
  if (countChanges(plan) > 0) log('Застосовано.');
  return { exitCode, plan };
}
```

`scripts/cms/import.mjs`:

```js
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientFromEnv } from './client.mjs';
import { runImport } from './sync.mjs';

// npm run cms:import                — сухий прогін: лише план
// npm run cms:import -- --apply     — застосувати
//                       --prune     — видалити зайве (історії й компоненти)
//                       --force     — перезаписати історії, змінені в Storyblok
const FLAGS = ['--apply', '--prune', '--force'];
const args = process.argv.slice(2);
const unknown = args.filter((a) => !FLAGS.includes(a));
if (unknown.length > 0) {
  console.error(`невідомі параметри: ${unknown.join(' ')} (можливі: ${FLAGS.join(' ')})`);
  process.exit(2);
}
const root = fileURLToPath(new URL('../..', import.meta.url));
try {
  const { exitCode } = await runImport({
    client: clientFromEnv(),
    contentDir: join(root, 'src/content'),
    publicDir: join(root, 'public'),
    apply: args.includes('--apply'),
    prune: args.includes('--prune'),
    force: args.includes('--force'),
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}
```

У `package.json` у `scripts` після `"e2e"`:

```json
    "cms:import": "node --env-file=.env scripts/cms/import.mjs"
```

- [ ] **Step 4: Запустити тест**

Run: `node --test tests/cms-import.test.js`
Expected: PASS (12 tests). `failOnWrite: 60` має влучити в запис історії. Записи до історій: 42 компоненти + 8 папок + 4 файли × 2 запити (підпис, `finish_upload`) = 58. Якщо модель змінила кількість компонентів, число треба перерахувати так, щоб воно було більше за записи до історій.

- [ ] **Step 5: Повний прогін і commit**

Run: `npm test` → PASS.

```bash
git add scripts/cms/sync.mjs scripts/cms/import.mjs package.json tests/cms-import.test.js
git commit -m "feat: npm run cms:import — сухий прогін, --apply, відбиток проти перезапису, --prune

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 9: звірка `npm run cms:verify`

**Files:**
- Modify: `scripts/cms/sync.mjs` (додати `diffValues`, `runVerify`)
- Create: `scripts/cms/verify.mjs`
- Modify: `package.json` (скрипт `cms:verify`)
- Test: `tests/cms-verify.test.js`

**Interfaces:**
- Consumes: `readSpace`, `publicUrl`, `sha256`, `DEMO` (Задача 8); `readContent`, `assetRefs` (Задача 7); `fromStory`, `canonical` (Задача 4).
- Produces:
  - `diffValues(expected, actual, path = '') → Array<{ path, expected, actual }>`. Шляхи у формі `summary.en`, `media[0].src`.
  - `runVerify({ client, contentDir, publicDir, log? }) → { exitCode, diffs: string[] }`.

- [ ] **Step 1: Написати тест, що падає**

`tests/cms-verify.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetRefs, readContent } from '../scripts/cms/content.mjs';
import { diffValues, runImport, runVerify } from '../scripts/cms/sync.mjs';
import { contentDir, fakeClient, publicDir, quietLog, withFake } from './helpers/cms.js';

const T = { timeout: 60_000 };
const verify = async (fake) => {
  const out = quietLog();
  const result = await runVerify({ client: fakeClient(fake), contentDir, publicDir, log: out.log });
  return { ...result, out };
};
const imported = async (fn) => withFake({}, async (fake) => {
  await runImport({ client: fakeClient(fake), contentDir, publicDir, apply: true, log: quietLog().log });
  await fn(fake);
});
const firstMinistry = () => readContent(contentDir).find((e) => e.collection === 'ministries');

test('після імпорту — нуль розбіжностей (критерій приймання Етапу 4)', T, async () => {
  await imported(async (fake) => {
    const { exitCode, diffs, out } = await verify(fake);
    assert.deepEqual(diffs, []);
    assert.equal(exitCode, 0);
    assert.match(out.text(), /Розбіжностей немає/);
  });
});

test('змінене поле — рядок із шляхом, обома значеннями й ненульовим кодом', T, async () => {
  await imported(async (fake) => {
    const target = firstMinistry();
    fake.editStory(target.path, (content) => { content.summary_en = 'Інший текст'; });
    const { exitCode, diffs } = await verify(fake);
    assert.equal(exitCode, 1);
    assert.equal(diffs.length, 1, diffs.join('\n'));
    assert.ok(diffs[0].startsWith(`${target.path} → summary.en:`), diffs[0]);
    // Довге значення у звіті обрізається — звіряємо його початок.
    assert.ok(diffs[0].includes(JSON.stringify(target.data.summary.en).slice(0, 40)), diffs[0]);
    assert.ok(diffs[0].includes('"Інший текст"'), diffs[0]);
  });
});

test('картинка медіатеки з іншим вмістом — розбіжність за SHA-256', T, async () => {
  await imported(async (fake) => {
    const refs = assetRefs(readContent(contentDir));
    assert.ok(refs.length > 0, 'у контенті немає жодного файлу медіатеки — тест нічого не перевіряє');
    const [key] = fake.state.files.keys();
    fake.state.files.set(key, Buffer.from('not the same image'));
    const { exitCode, diffs } = await verify(fake);
    assert.equal(exitCode, 1);
    assert.ok(diffs.some((d) => refs.some((ref) => d.includes(ref))), diffs.join('\n'));
  });
});

test('історії немає / зайва історія / неопубліковані зміни — теж розбіжності', T, async () => {
  await imported(async (fake) => {
    const target = firstMinistry();
    fake.state.stories = fake.state.stories.filter((s) => s.full_slug !== target.path);
    fake.addStory({ parentSlug: 'ministries', slug: 'stray', content: { component: 'ministry' } });
    const other = readContent(contentDir).find((e) => e.collection === 'churches');
    fake.editStory(other.path, () => {}, { publish: false });
    const { diffs } = await verify(fake);
    assert.ok(diffs.some((d) => d.startsWith(`${target.path}:`) && d.includes('немає')), diffs.join('\n'));
    assert.ok(diffs.some((d) => d.startsWith('ministries/stray:')), diffs.join('\n'));
    assert.ok(diffs.some((d) => d.startsWith(`${other.path}:`) && d.includes('неопубліков')), diffs.join('\n'));
  });
});

test('diffValues: шлях до кожної розбіжності, відсутній ключ ≠ null', () => {
  assert.deepEqual(diffValues({ a: { uk: 'x', en: 'y' } }, { a: { uk: 'x', en: 'z' } }), [{ path: 'a.en', expected: 'y', actual: 'z' }]);
  assert.deepEqual(diffValues({ m: [{ s: 1 }] }, { m: [{ s: 1 }, { s: 2 }] }), [{ path: 'm[1]', expected: undefined, actual: { s: 2 } }]);
  assert.deepEqual(diffValues({ b: null }, {}), [{ path: 'b', expected: null, actual: undefined }]);
  assert.deepEqual(diffValues({ x: 1, y: [1, 2] }, { y: [1, 2], x: 1 }), []);
});
```

- [ ] **Step 2: Запустити тест, переконатися, що падає**

Run: `node --test tests/cms-verify.test.js`
Expected: FAIL: `diffValues`/`runVerify` не експортовані (`SyntaxError: … does not provide an export named 'diffValues'`).

- [ ] **Step 3: Реалізація**

Дописати в кінець `scripts/cms/sync.mjs` (і додати `canonical` до імпорту з `convert.mjs`):

```js
// ---- звірка

export function diffValues(expected, actual, path = '') {
  if (Object.is(expected, actual)) return [];
  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const out = [];
    for (let i = 0; i < Math.max(expected.length, actual.length); i++) out.push(...diffValues(expected[i], actual[i], `${path}[${i}]`));
    return out;
  }
  if (isObject(expected) && isObject(actual)) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    return keys.flatMap((key) => diffValues(expected[key], actual[key], path ? `${path}.${key}` : key));
  }
  return [{ path, expected, actual }];
}

const show = (value) => {
  if (value === undefined) return '(немає)';
  const text = JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
};

function libraryUrls(value, out = new Set()) {
  if (Array.isArray(value)) for (const item of value) libraryUrls(item, out);
  else if (value && typeof value === 'object') {
    if (value.fieldtype === 'asset' && value.filename && !value.is_external_url) out.add(publicUrl(value.filename));
    else for (const item of Object.values(value)) libraryUrls(item, out);
  }
  return out;
}

// Критерій приймання Етапу 4: нуль розбіжностей на живому просторі.
// «Побайтово» — рівність даних, а не URL: картинка медіатеки дорівнює
// файлу з public/, якщо збігається SHA-256 вмісту.
export async function runVerify({ client, contentDir, publicDir, log = console.log }) {
  const entries = readContent(contentDir);
  const space = await readSpace(client);
  const diffs = [];

  const localByHash = new Map();
  for (const ref of assetRefs(entries)) {
    try {
      localByHash.set(sha256(readFileSync(join(publicDir, ref))), ref);
    } catch {
      diffs.push(`${ref}: файлу немає в public/`);
    }
  }
  const remote = new Map(space.stories.filter((s) => !isDemoStory(s)).map((s) => [s.full_slug, s]));
  const urlToLocal = new Map();
  for (const story of remote.values()) {
    for (const url of libraryUrls(story.content)) {
      if (!urlToLocal.has(url)) urlToLocal.set(url, localByHash.get(sha256(await client.download(url))) ?? url);
    }
  }
  const assetPath = (asset) => (asset.is_external_url ? asset.filename : urlToLocal.get(publicUrl(asset.filename)) ?? asset.filename);

  for (const entry of entries) {
    const story = remote.get(entry.path);
    if (!story) {
      diffs.push(`${entry.path}: історії немає в Storyblok`);
      continue;
    }
    remote.delete(entry.path);
    // Етап 5 читає опубліковану версію: неопублікована правка — розбіжність.
    if (!story.published || story.unpublished_changes) diffs.push(`${entry.path}: є неопубліковані зміни — сайт їх не побачить`);
    let actual;
    try {
      actual = fromStory(entry.collection, story, { assetPath });
    } catch (error) {
      diffs.push(`${entry.path}: ${error.message}`);
      continue;
    }
    for (const d of diffValues(canonical(entry.collection, entry.data), actual)) {
      diffs.push(`${entry.path} → ${d.path || '(запис)'}: очікувалось ${show(d.expected)}, у Storyblok ${show(d.actual)}`);
    }
  }
  for (const path of remote.keys()) diffs.push(`${path}: є в Storyblok, але немає у файлах`);

  for (const d of diffs) log(`✗ ${d}`);
  log(diffs.length > 0 ? `Розбіжностей: ${diffs.length}.` : `Розбіжностей немає: ${entries.length} історій збігаються з файлами.`);
  return { exitCode: diffs.length > 0 ? 1 : 0, diffs };
}
```

`scripts/cms/verify.mjs`:

```js
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientFromEnv } from './client.mjs';
import { runVerify } from './sync.mjs';

// npm run cms:verify — звірка Storyblok з файлами поле за полем; картинки
// медіатеки — за SHA-256 вмісту. Ненульовий код виходу при розбіжності.
const root = fileURLToPath(new URL('../..', import.meta.url));
try {
  const { exitCode } = await runVerify({
    client: clientFromEnv(),
    contentDir: join(root, 'src/content'),
    publicDir: join(root, 'public'),
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}
```

У `package.json`:

```json
    "cms:import": "node --env-file=.env scripts/cms/import.mjs",
    "cms:verify": "node --env-file=.env scripts/cms/verify.mjs"
```

- [ ] **Step 4: Запустити тест**

Run: `node --test tests/cms-verify.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Повний прогін і commit**

Run: `npm test` → PASS.

```bash
git add scripts/cms/sync.mjs scripts/cms/verify.mjs package.json tests/cms-verify.test.js
git commit -m "feat: npm run cms:verify — звірка Storyblok з файлами, картинки за SHA-256

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 10: живий простір — імпорт і звірка

Ця задача змінює **зовнішній** простір Storyblok. Кожен `--apply` робиться лише після того, як користувач побачив сухий прогін і явно погодився.

**Files:**
- Modify (лише якщо живий API поводиться інакше, ніж задокументовано): `tests/helpers/fake-storyblok.js`, відповідний тест, `scripts/cms/*.mjs` або `src/lib/storyblok/components.mjs`.

**Interfaces:**
- Consumes: `npm run cms:import`, `npm run cms:verify` (Задачі 8–9), `.env` з токеном (уже заповнений користувачем).

- [ ] **Step 1: Сухий прогін на живому просторі**

Run: `npm run cms:import`
Expected: план із демо-рядками (`- демо: історія home`, `- демо: компонент page`, …), `+ компонент …` на кожен компонент моделі, `+ папка …` ×8, `↑ файл uploads/…` ×4 і `+ історія …` на кожен запис, без `!`-конфліктів. Якщо `.env` неповний, має бути повідомлення з назвою змінної.

- [ ] **Step 2: Показати план користувачу й дочекатися явної згоди на `--apply`**

- [ ] **Step 3: Застосувати**

Run: `npm run cms:import -- --apply`
Expected: `Застосовано.`, код виходу 0. Займе ~1–2 хв через ліміт 3 запити/с.

Якщо API відповідає помилкою, діяти за такою процедурою:
1. Записати точний запит і відповідь.
2. Змінити фейк (`tests/helpers/fake-storyblok.js`), щоб він поводився так само, і переконатися, що відповідний тест тепер червоний.
3. Виправити код і прогнати `npm test`.
4. Повторити `--apply`: імпорт ідемпотентний, створене раніше не дублюється.

Імовірні місця — рішення 15: ключ вкладки, `content_types` при створенні папки, форма відповіді `finish_upload`, `publish: 1` проти `true`.

- [ ] **Step 4: Звірка — критерій приймання**

Run: `npm run cms:verify`
Expected: `Розбіжностей немає: N історій збігаються з файлами.`, код виходу 0.

Кожен рядок розбіжності означає, що живий API зберіг або віддав дані інакше, ніж фейк. Приклади: число числом, порожній asset як `null`, option як `null`. Діяти за тією ж процедурою: фейк → червоний тест → виправлення в `fromStory`/`sync.mjs` → `npm test`. Потім `npm run cms:import -- --apply` (оновить лише потрібне) і знову `cms:verify`.

- [ ] **Step 5: Ідемпотентність на живому просторі**

Run: `npm run cms:import`
Expected: `0 змін (N історій збігаються з файлами).`

Якщо план показує `~ компонент …`, API нормалізує схему компонента (відкидає чи змінює ключі). Треба порівняти `GET /components` з `buildComponents()` для цього компонента. Далі або прибрати ключ, якого API не зберігає, з генератора (якщо він не впливає на форму), або відтворити нормалізацію у фейку. Спершу тест, потім виправлення.

- [ ] **Step 6: Перевірити в адмінці вручну (разом із користувачем)**

У `app.storyblok.com` → простір «Dim Hliba» треба побачити:
- 8 папок із українськими назвами;
- в історії служіння вкладки «Контент» / «Галерея» / «SEO» / «Службове» і поля «Назва (укр.)» / «Назва (англ.)»;
- у «Налаштування → Головна сторінка» лого й фото героя з медіатеки;
- що нова історія в папці «Служіння» пропонує лише тип «Служіння».

Якщо обмеження папки типами не спрацювало (рішення 8), виправити процедурою з кроку 3.

- [ ] **Step 7: Commit (лише якщо були виправлення)**

```bash
git add -A tests/helpers/fake-storyblok.js tests/ scripts/cms/ src/lib/storyblok/
git commit -m "fix: імпорт Storyblok під фактичну поведінку живого API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Задача 11: документація

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-22-03-storyblok-cms-design.md` (критерії готовності)
- Modify: `docs/superpowers/notes/2026-09-23-seo-launch-checklist.md`

- [ ] **Step 1: CLAUDE.md**

У розділі «Commands» після рядка про Preview mode:

```markdown
- `npm run cms:import` — dry-run plan for the Storyblok space; `-- --apply` writes it, `--prune` also deletes
  stories/components that are not in the files/model, `--force` overwrites stories edited in Storyblok.
  `npm run cms:verify` — field-by-field comparison with the files (library images by SHA-256). Both read
  `.env` (`STORYBLOK_MANAGEMENT_TOKEN`, `STORYBLOK_SPACE_ID`, `STORYBLOK_REGION`; never committed).
```

У першому реченні розділу «Content» замінити «schemas in `src/content.config.ts`» на «schemas in `src/lib/schema.mjs` (`content.config.ts` only wires loaders)». У тексті контракту «uniqueness and ids via the loader wrappers in `content.config.ts`» лишити як є.

Новий розділ перед «Deploy»:

```markdown
## CMS (Storyblok, Stage 4)

Space «Dim Hliba», EU region, Starter limits (3 req/s, 2 locales unused). Pairs `{uk, en}` are two
fields `<key>_uk` / `<key>_en`, not Storyblok's language feature (an untranslated field would silently
fall back to Ukrainian). The model `src/lib/storyblok/model.mjs` is subordinate to the zod schema:
`checkModel()` (tests/cms-model.test.js) fails on any key/type/optional mismatch — a new schema field
needs a model field. `convert.mjs` (`toStory`/`fromStory`, pure; Stage 5 loader) and `components.mjs`
(component JSON) are derived from it. Import (`scripts/cms/`) validates before any request, is
idempotent, writes a fingerprint (`import_hash`, tab «Службове») and refuses to overwrite a story whose
data no longer matches it. Tests run against the in-memory fake API (`tests/helpers/fake-storyblok.js`);
the live space is never touched by `npm test`. Demo content names (`page`, `teaser`, `grid`, `feature`,
story `home`) are reserved — the first `--apply` deletes them.
```

У розділі «Next» замінити «Stage 4 (Spec 3): Storyblok model and data import.» на «Stage 5 (Spec 3): Astro reads Storyblok (`fromStory` as the loader), images downloaded at build, preview on Cloudflare Pages, Visual Editor, publish webhook.»

- [ ] **Step 2: Критерії готовності у спеці 3**

Позначити виконаними (`- [x]`) перші два пункти: «Простір створено, компоненти відповідають схемі…» і «Контент залито, `cms:verify` на живому просторі — розбіжностей немає». Під ними дописати `(Етап 4, 2026-09-24: план [2026-09-24-storyblok-stage-4.md](../plans/2026-09-24-storyblok-stage-4.md))`. Позначати лише якщо Задача 10, крок 4 справді дала нуль розбіжностей.

- [ ] **Step 3: Чекліст запуску**

У `docs/superpowers/notes/2026-09-23-seo-launch-checklist.md` перед розділом «Search Console» додати:

```markdown
## Storyblok

- [ ] До 2026-11-08 (кінець пробного періоду) простір «Dim Hliba» — на Starter; `npm run cms:import`
      після переходу показує «0 змін» (модель не використовує платних функцій — Спека 3, ризики).
- [ ] Перший документ для лідерів (PDF) завантажується в медіатеку: простір без платіжних даних за
      документацією приймає лише `image/*` (план Етапу 4, рішення 11). Якщо ні — документи лишаються
      зовнішніми посиланнями в полі «Файл».
```

- [ ] **Step 4: Перевірка й commit**

Run: `npm test` → PASS.

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-22-03-storyblok-cms-design.md docs/superpowers/notes/2026-09-23-seo-launch-checklist.md
git commit -m "docs: Етап 4 — CMS у CLAUDE.md, критерії спеки, чекліст Storyblok

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Критерії готовності Етапу 4

- [ ] `checkModel()` повертає `[]`: модель покриває zod-схему рівно, пари uk/en — парні поля.
- [ ] `fromStory(toStory(x)) = canonical(x)` для кожного реального запису й проб з необовʼязковими полями, `null` і порожніми списками.
- [ ] На фейковому API проходять усі сценарії: повний імпорт → `verify` зелений; повтор → «0 змін»; ручна правка → відмова без `--force`; `--prune`; невалідні дані → нуль запитів; 429 і обірваний імпорт не заважають.
- [ ] `npm test` не ходить у мережу й зелений у CI.
- [ ] Живий простір: `cms:verify` → нуль розбіжностей; повторний `cms:import` → «0 змін»; демо-вміст прибрано.
