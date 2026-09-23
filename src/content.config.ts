import { glob, file } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

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
export const mediaItem = z
  .object({
    type: z.enum(['image', 'video']),
    src: z.string().min(1),
    alt: z.string().min(1),
  })
  .strict();

export const seo = z
  .object({
    metaTitle: localized.nullable(),
    metaDescription: localized.nullable(),
    // Порожній рядок — не картинка; «ще немає» — це null.
    ogImage: z.string().min(1).nullable(),
    noindex: z.boolean(),
  })
  .strict();

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
    // Індекс у легасі-масиві. Glob-завантажувач порядку файлів не гарантує,
    // а від порядку залежить вигляд (перші три служіння на головній, значок
    // «Головна церква» в індексу 0, блоки «ще …»). Те саме в churches,
    // projects і testimonies.
    order: z.number().int().nonnegative(),
    icon: z.enum(MINISTRY_ICONS),
    leader: z.string().min(1),
    phone: z.string().min(1),
    name: localized,
    summary: localized,
    body: localized,
    media: z.array(mediaItem).min(1),
    seo,
  }).strict(),
});

// Координати нового поля geo немає в жодному легасі-джерелі. Nullable, щоб
// збірка проходила зараз, а Етап 3 (JSON-LD Church) бачив явну порожнечу.
export const geoPoint = z.object({ lat: z.number(), lng: z.number() }).strict().nullable();

const churches = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/churches' }),
  schema: z.object({
    slug: z.string().min(1),
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
    media: z.array(mediaItem).min(1),
    seo,
  }).strict(),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: z.object({
    slug: z.string().min(1),
    order: z.number().int().nonnegative(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    // percent і url у джерелі не локалізовані — тримаємо їх поза парами
    // {uk,en}, інакше англійська версія лишилася б без них.
    progress: z
      .object({ percent: z.number().min(0).max(100), raised: localized, goal: localized })
      .strict()
      .nullable(),
    ctaUrl: z.string().min(1).nullable(),
    title: localized,
    category: localized,
    status: localized,
    period: localized,
    lead: localized,
    body: localized,
    stats: z.array(z.object({ n: z.string().min(1), label: localized }).strict()).min(1),
    ctaLabel: localized,
    media: z.array(mediaItem).min(1),
    seo,
  }).strict(),
});

// Текстове й відеосвідчення мають різні обовʼязкові поля. Союз за type
// не дає покласти відео без посилання й текст без тексту.
const testimonyBase = {
  slug: z.string().min(1),
  order: z.number().int().nonnegative(),
  name: z.string().min(1),
  role: localized,
};

const testimonies = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/testimonies' }),
  schema: z.discriminatedUnion('type', [
    z.object({ ...testimonyBase, type: z.literal('text'), text: localized }).strict(),
    z
      .object({
        ...testimonyBase,
        type: z.literal('video'),
        videoUrl: z.string().min(1),
        poster: z.string().min(1),
      })
      .strict(),
  ]),
});

const pastors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/pastors' }),
  schema: z.object({
    slug: z.string().min(1),
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
  }).strict(),
});

// Одиночка = один запис із id "main". file() робить ключі верхнього рівня
// ідентифікаторами, тож обгортка {"main": …} — це ціна того, щоб одиночка
// теж валідувалася схемою на збірці, а не читалася як сирий JSON.
const siteSettings = defineCollection({
  loader: file('src/content/singletons/site-settings.json'),
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
  }).strict(),
});

const donateSettings = defineCollection({
  loader: file('src/content/singletons/donate-settings.json'),
  schema: z.object({
    liqpayUrl: z.string().url(),
    defaultAmount: z.number().int().positive(),
    // Прирости, а не пресети: кнопка калькулятора (data-calc-add, «+200 UAH»)
    // додає суму до поля, а не підставляє її замість введеної.
    calcIncrements: z.array(z.number().int().positive()).min(1),
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

// Поля, значення яких містять HTML-розмітку (Етапу 2 потрібен set:html,
// Storyblok — richtext саме для них; решта полів — чистий текст):
//   homepage.hero.title        — data-i18n-html в index.html; <em>, <br> в обох мовах
//   homepage.news.more.uk      — іконка-стрілка <svg><path> (en — чистий текст)
//   homepage.donate.quote.uk   — вкладений <cite data-i18n="don.ref"> (en — без нього)
// Список отримано обходом усіх JSON у src/content і src/i18n на /<[a-z/]/.
// uk-варіанти news.more і donate.quote несуть розмітку лише тому, що легасі
// читається через innerHTML; в англійському режимі легасі її затирає.
const homepage = defineCollection({
  loader: file('src/content/singletons/homepage.json'),
  schema: z.object({
    nav: z.record(z.string(), localized),
    cta: z.record(z.string(), localized),
    hero: z.record(z.string(), localized),
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
    about: z.record(z.string(), localized),
    // Рівно сім тверджень віри: у легасі це belief.1…belief.7. Масив довільної
    // довжини мовчки проковтнув би загублене твердження.
    beliefs: z.array(localized).length(7),
    news: z.object({
      eyebrow: localized, title: localized, lead: localized, more: localized,
      items: z
        .array(z.object({ date: localized, title: localized, text: localized, image: decorativeImage }).strict())
        .length(3),
    }).strict(),
    fb: z.object({ title: localized, text: localized }).strict(),
    wwb: z.object({
      eyebrow: localized, title: localized,
      items: z.array(z.object({ title: localized, text: localized }).strict()).length(4),
    }).strict(),
    testimonies: z.object({
      eyebrow: localized, title: localized, all: localized,
      items: z.array(z.object({ text: localized, name: localized, role: localized }).strict()).length(4),
    }).strict(),
    ministries: z.record(z.string(), localized),
    pastors: z.record(z.string(), localized),
    contacts: z.record(z.string(), localized),
    donate: z.record(z.string(), localized),
    footer: z.record(z.string(), localized),
  }).strict(),
});

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
