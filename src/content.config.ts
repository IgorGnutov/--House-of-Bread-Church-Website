import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { glob, file, type Loader } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';
import { MINISTRY_ICON_NAMES, RESOURCE_ICON_NAMES } from './lib/icons.mjs';
import { assertUniqueSlugs } from './lib/collections.mjs';
import { ytId } from './lib/youtube.mjs';

// Контракт з адмінкою: усе, що пропускає ця схема, мусить збиратися й
// проходити npm test (деплой стоїть за ним). Тому тут лише правила
// цілісності — формат і унікальність slug, відомі іконки, формати адрес,
// обидві мови, YouTube для відео. Кількості записів, точні значення й
// звʼязки між записами редактор має право міняти — їх тут немає свідомо.

// Тести збирають сайт із тимчасової копії контенту (порожні колекції, дірки
// в order тощо), не чіпаючи src/content. У звичайній збірці змінної немає.
const CONTENT_DIR = process.env.HOB_CONTENT_DIR
  ? `${pathToFileURL(resolve(process.env.HOB_CONTENT_DIR)).href}/`
  : './src/content/';

// Обгортка над glob():
// - id — імʼя файлу, а не slug. Типовий generateId бере data.slug, і два
//   файли з однаковим slug мовчки зливалися в один запис — служіння просто
//   зникало з сайту. Тепер обидва доходять до перевірки й збірка падає з
//   поясненням.
// - store.clear(): коли в колекції не лишилося жодного файлу, glob()
//   виходить раніше, ніж прибирає старі записи, і локальна повторна збірка
//   (кеш node_modules/.astro) показувала б уже видалене.
function collectionLoader(name: string): Loader {
  const inner = glob({
    pattern: '**/*.json',
    base: `${CONTENT_DIR}${name}`,
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  });
  return {
    name: 'hob-collection',
    load: async (context) => {
      context.store.clear();
      await inner.load(context);
      assertUniqueSlugs(name, context.store.entries().map(([id, entry]) => ({ id, slug: entry.data.slug as string })));
    },
  };
}

// Обгортка над file(): шаблони читають записи-одиночки за id (main,
// pages.ministries, …). Без перевірки видалений запис проходив схему і
// валив шаблон на «Cannot read properties of undefined».
function singletonLoader(fileName: string, ids: string[]): Loader {
  const inner = file(`${CONTENT_DIR}singletons/${fileName}`);
  return {
    name: 'hob-singleton',
    load: async (context) => {
      await inner.load(context);
      const missing = ids.filter((id) => !context.store.has(id));
      if (missing.length > 0) {
        throw new Error(`${fileName}: бракує записів ${missing.map((id) => `«${id}»`).join(', ')} — їх читають шаблони сторінок`);
      }
    },
  };
}

// slug — частина URL детальної сторінки й ключ унікальності в колекції.
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug: лише малі латинські літери, цифри й дефіси між ними (напр. «youth-camp»)');

const isYouTube = (value: string) => ytId(value) !== null;
const YOUTUBE_MESSAGE = 'відео має бути посиланням YouTube або 11-символьним ID';

// Усі обʼєкти — .strict(): за замовчуванням zod мовчки викидає невідомі
// ключі, і поле з одруківкою (напр. "sumary") зникло б без жодної помилки.
// Strict перетворює одруківку на впалу збірку.

// Обидві мови обовʼязкові й непорожні. Якщо дозволити лише uk, англійська
// сторінка мовчки покаже українську — а це гірше за впалу збірку.
export const localized = z
  .object({
    uk: z.string().min(1),
    en: z.string().min(1),
  })
  .strict();

// alt обовʼязкове: воно потрібне і для доступності, і для SEO (Спека 1).
// src приймає і повний YouTube-URL, і голий 11-символьний ID — Спека 1
// дозволяє обидва, тому звужувати до URL не можна.
// Відео не з YouTube галерея показати не вміє — ловимо тут, а не падінням
// у Gallery.astro.
export const mediaItem = z
  .object({
    type: z.enum(['image', 'video']),
    src: z.string().min(1),
    alt: z.string().min(1),
  })
  .strict()
  .refine((item) => item.type !== 'video' || isYouTube(item.src), { message: YOUTUBE_MESSAGE, path: ['src'] });

// Галерея — центр детальної сторінки й джерело обкладинки картки у списку.
// Порожньої галереї дизайн не має, тож це правило схеми, а не фолбек.
const gallery = z.array(mediaItem).min(1, 'media: потрібне хоча б одне фото або відео YouTube');

export const seo = z
  .object({
    metaTitle: localized.nullable(),
    metaDescription: localized.nullable(),
    // Порожній рядок — не картинка; «ще немає» — це null.
    ogImage: z.string().min(1).nullable(),
    noindex: z.boolean(),
  })
  .strict();

// Іконки — inline SVG із src/lib/icons.mjs. Назви беруться звідти ж, тож
// список у схемі й набір, який уміє малювати шаблон, розійтися не можуть.
export const MINISTRY_ICONS = MINISTRY_ICON_NAMES as [string, ...string[]];

const ministries = defineCollection({
  loader: collectionLoader('ministries'),
  schema: z.object({
    slug,
    // Позиція в списку. Glob-завантажувач порядку файлів не гарантує, а від
    // порядку залежить вигляд (перші три служіння на головній, значок
    // «Головна церква» у першої церкви, блоки «ще …»). Дірки й дублікати
    // дозволені: шаблони сортують стабільно (order, потім slug). Те саме в
    // churches, projects, testimonies, pastors і leader-resources.
    order: z.number().int().nonnegative(),
    icon: z.enum(MINISTRY_ICONS),
    leader: z.string().min(1),
    phone: z.string().min(1),
    name: localized,
    summary: localized,
    body: localized,
    media: gallery,
    seo,
  }).strict(),
});

// Координати нового поля geo немає в жодному легасі-джерелі. Nullable, щоб
// збірка проходила зараз, а Етап 3 (JSON-LD Church) бачив явну порожнечу.
export const geoPoint = z.object({ lat: z.number(), lng: z.number() }).strict().nullable();

const churches = defineCollection({
  loader: collectionLoader('churches'),
  schema: z.object({
    slug,
    order: z.number().int().nonnegative(),
    pastor: z.string().min(1),
    geo: geoPoint,
    name: localized,
    city: localized,
    role: localized,
    address: localized,
    times: localized,
    lead: localized,
    body: localized,
    media: gallery,
    seo,
  }).strict(),
});

const projects = defineCollection({
  loader: collectionLoader('projects'),
  schema: z.object({
    slug,
    order: z.number().int().nonnegative(),
    // Regex сам по собі пропускає 2026-13-45 — formatDate показав би
    // «переповнену» дату з наступного року.
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date: формат РРРР-ММ-ДД')
      .refine((iso) => {
        const [y, m, d] = iso.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
      }, 'date: такої календарної дати не існує'),
    // percent і url у джерелі не локалізовані — тримаємо їх поза парами
    // {uk,en}, інакше англійська версія лишилася б без них.
    progress: z
      .object({ percent: z.number().min(0).max(100), raised: localized, goal: localized })
      .strict()
      .nullable(),
    // Або чужий сайт (LiqPay), або шлях сайту з «/» — його шаблон
    // локалізує (/#contacts → /en/#contacts). Відносний шлях у стилі
    // легасі (index.html#contacts) під новими URL веде в нікуди.
    ctaUrl: z.string().regex(/^(https:\/\/|\/)/).nullable(),
    title: localized,
    category: localized,
    status: localized,
    period: localized,
    lead: localized,
    body: localized,
    // Без показників блок .stats просто не рендериться.
    stats: z.array(z.object({ n: z.string().min(1), label: localized }).strict()),
    ctaLabel: localized,
    media: gallery,
    seo,
  }).strict(),
});

// Текстове й відеосвідчення мають різні обовʼязкові поля. Союз за type
// не дає покласти відео без посилання й текст без тексту.
const testimonyBase = {
  slug,
  order: z.number().int().nonnegative(),
  name: z.string().min(1),
  role: localized,
};

const testimonies = defineCollection({
  loader: collectionLoader('testimonies'),
  schema: z.discriminatedUnion('type', [
    z.object({ ...testimonyBase, type: z.literal('text'), text: localized }).strict(),
    z
      .object({
        ...testimonyBase,
        type: z.literal('video'),
        // Плеєр — YouTube-embed; інша адреса раніше падала вже в шаблоні.
        // Перевірка на полі, бо discriminatedUnion не приймає .refine() обʼєкта.
        videoUrl: z.string().min(1).refine(isYouTube, `videoUrl: ${YOUTUBE_MESSAGE}`),
        poster: z.string().min(1),
      })
      .strict(),
  ]),
});

const pastors = defineCollection({
  loader: collectionLoader('pastors'),
  schema: z.object({
    slug,
    name: z.string().min(1),
    photo: z.string().min(1),
    order: z.number().int().nonnegative(),
    group: z.enum(['pastor', 'elder']),
    // Кнопки звʼязку на картці пастора (mailto:/tel: без схеми). У легасі
    // пошта є в усіх трьох пасторів, телефон — лише в старшого, у
    // пресвітерів — нічого; null означає «кнопки немає».
    email: z.string().email().nullable(),
    phone: z.string().min(1).nullable(),
    role: localized,
    // У пресвітерів підзаголовка немає — у легасі це ключ лише в pastorN.
    subtitle: localized.nullable(),
    bio: localized,
  }).strict(),
});

const leaderResources = defineCollection({
  loader: collectionLoader('leader-resources'),
  schema: z.object({
    slug,
    kind: z.enum(['document', 'link']),
    order: z.number().int().nonnegative(),
    // У легасі всі href — "#". null чесніше за заглушку: заглушку
    // неможливо відрізнити від справжньої адреси при перевірці.
    url: z.string().min(1).nullable(),
    format: z.enum(['pdf', 'doc', 'xls', 'ppt']).nullable(),
    icon: z.enum(RESOURCE_ICON_NAMES as [string, ...string[]]).nullable(),
    title: localized,
    description: localized,
    // Підпис файлу («PDF · 2 сторінки»). Необовʼязковий: без нього картка
    // документа просто без підпису.
    meta: localized.nullable(),
  }).strict().refine((r) => (r.kind === 'link') === (r.icon !== null), {
    // Картка посилання без іконки має порожній квадрат, а документ з
    // іконкою — дві: у документа значок — це формат файлу.
    message: 'icon обовʼязковий для link і заборонений для document',
    path: ['icon'],
  }).refine((r) => (r.kind === 'document') === (r.format !== null), {
    // Формат — і є значок документа (PDF/DOC/…); у посилання його ніде
    // показати, тож там він означав би мовчки загублене значення.
    message: 'format обовʼязковий для document і заборонений для link',
    path: ['format'],
  }),
});

// Одиночка = один запис із id "main". file() робить ключі верхнього рівня
// ідентифікаторами, тож обгортка {"main": …} — це ціна того, щоб одиночка
// теж валідувалася схемою на збірці, а не читалася як сирий JSON.
const siteSettings = defineCollection({
  loader: singletonLoader('site-settings.json', ['main']),
  schema: z.object({
    name: localized,
    logo: z.string().min(1),
    defaultOgImage: z.string().min(1).nullable(),
    social: z
      .object({
        facebook: z.string().url(),
        youtube: z.string().url(),
        instagram: z.string().url(),
        telegram: z.string().url(),
      })
      .strict(),
  }).strict(),
});

const contactInfo = defineCollection({
  loader: singletonLoader('contact-info.json', ['main']),
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
  }).strict(),
});

const donateSettings = defineCollection({
  loader: singletonLoader('donate-settings.json', ['main']),
  schema: z.object({
    liqpayUrl: z.string().url(),
    defaultAmount: z.number().int().positive(),
    // Прирости, а не пресети: кнопка калькулятора (data-calc-add, «+200 UAH»)
    // додає суму до поля, а не підставляє її замість введеної. Порожній
    // список — калькулятор без кнопок, лише поле суми.
    calcIncrements: z.array(z.number().int().positive()),
  }).strict(),
});

// Декоративна картинка: alt="" у легасі свідомо (новинна картка має
// заголовок поруч, і скрінрідер інакше прочитав би його двічі). Тому тут
// порожній alt дозволений — на відміну від mediaItem, де він обовʼязковий.
export const decorativeImage = z
  .object({
    src: z.string().min(1),
    alt: z.string(),
  })
  .strict();

// Єдине поле з HTML-розміткою — homepage.hero.title (<em>, <br> в обох
// мовах), рендериться через set:html. Стрілка «Читати далі» і <cite> вірша
// живуть у шаблоні головної: у легасі вони були частиною uk-тексту й
// губилися на англійській (Етап 2, дірка 17).
//
// Групи підписів — явні обʼєкти, а не z.record: шаблон читає конкретні
// ключі (nav.home, hero.watch, …), і з record видалений ключ проходив схему,
// а падав уже в pick() посеред рендеру. Повторювані блоки (твердження віри,
// новини, «віримо», свідчення) — будь-якої довжини: порожній блок шаблон
// просто не показує.
const labels = <K extends string>(required: K[], optional: string[] = []) =>
  z.object({
    ...Object.fromEntries(required.map((key) => [key, localized])),
    ...Object.fromEntries(optional.map((key) => [key, localized.optional()])),
  } as Record<K, typeof localized>).strict();

const homepage = defineCollection({
  loader: singletonLoader('homepage.json', ['main']),
  schema: z.object({
    nav: labels(['home', 'about', 'ministries', 'media', 'union', 'donations', 'projects', 'contacts', 'leaders']),
    cta: labels(['live', 'liveTitle']),
    hero: labels(['tag', 'title', 'vision', 'addr', 'time', 'watch', 'donate', 'scroll']),
    // Окремим ключем, а не всередині hero: hero — словник пар {uk, en}, і
    // нелокалізований обʼєкт там зламав би і схему, і обхід перекладів.
    // alt — рядок, як у mediaItem: в легасі він лише український.
    heroImage: z
      .object({
        src: z.string().min(1),
        mobileSrc: z.string().min(1),
        alt: z.string().min(1),
      })
      .strict(),
    about: labels(['eyebrow', 'title', 'lead', 'beliefsTitle']),
    beliefs: z.array(localized),
    news: z.object({
      eyebrow: localized, title: localized, lead: localized, more: localized,
      items: z.array(z.object({ date: localized, title: localized, text: localized, image: decorativeImage }).strict()),
    }).strict(),
    fb: z.object({ title: localized, text: localized }).strict(),
    wwb: z.object({
      eyebrow: localized, title: localized,
      items: z.array(z.object({ title: localized, text: localized }).strict()),
    }).strict(),
    testimonies: z.object({
      eyebrow: localized, title: localized, all: localized,
      items: z.array(z.object({ text: localized, name: localized, role: localized }).strict()),
    }).strict(),
    ministries: labels(['eyebrow', 'title', 'lead', 'all']),
    // role/role2 шаблон більше не читає (ролі — з колекції pastors, дірка 18):
    // необовʼязкові, щоб редактор міг їх прибрати.
    pastors: labels(['eyebrow', 'title', 'lead', 'all'], ['role', 'role2']),
    contacts: labels(['eyebrow', 'title', 'addrLbl', 'addr', 'phoneLbl', 'emailLbl', 'svcLbl', 'svcDay', 'socialLbl']),
    donate: labels(['eyebrow', 'title', 'quote', 'ref', 'btn', 'thanks']),
    footer: labels(['about', 'navTitle', 'contactsTitle', 'socialTitle', 'copy', 'built', 'addr']),
  }).strict(),
});

// Сторінки — маршрути в коді, тож набір id фіксований: без запису сторінка
// не має навіть заголовка.
const PAGE_IDS = ['about', 'contacts', 'donate', 'churches', 'ministries', 'projects', 'testimonies', 'pastors', 'leaders'];

const pages = defineCollection({
  loader: singletonLoader('pages.json', PAGE_IDS),
  schema: z.object({
    // Обовʼязковий лише заголовок: три нові сторінки (about, contacts, donate)
    // ще не мають ані надзаголовка, ані прози. Порожні рядки замість
    // optional виглядали б як заповнений контент.
    title: localized,
    eyebrow: localized.optional(),
    lead: localized.optional(),
    heroTag: localized.optional(),
    // Додаткові заголовки секцій є лише в pastors і leaders. Усе
    // необовʼязкове шаблони вміють не показувати — відсутній підпис прибирає
    // свій елемент, а не валить збірку.
    sections: z.record(z.string(), localized).optional(),
    help: z.object({ title: localized, desc: localized, btn: localized }).strict().optional(),
    body: localized.nullable().optional(),
  }).strict(),
});

export const collections = {
  ministries, churches, projects, testimonies, pastors,
  'leader-resources': leaderResources,
  'site-settings': siteSettings,
  'contact-info': contactInfo,
  'donate-settings': donateSettings,
  homepage,
  pages,
};
