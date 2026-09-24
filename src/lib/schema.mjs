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

// slug — частина URL детальної сторінки й ключ унікальності в колекції.
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug: лише малі латинські літери, цифри й дефіси між ними (напр. «youth-camp»)');

const isYouTube = (value) => ytId(value) !== null;
const YOUTUBE_MESSAGE = 'відео має бути посиланням YouTube або 11-символьним ID';

// Усі обʼєкти — .strict(): за замовчуванням zod мовчки викидає невідомі
// ключі, і поле з одруківкою (напр. "sumary") зникло б без жодної помилки.
// Strict перетворює одруківку на впалу збірку.

// Обидві мови обовʼязкові й непорожні. Якщо дозволити лише uk, англійська
// сторінка мовчки покаже українську — а це гірше за впалу збірку.
// «   » — теж порожньо: pick() пропустив би пробіли, і сторінка показала б
// порожній заголовок.
const text = z.string().regex(/\S/, 'текст не може бути порожнім або з самих пробілів');

// Шаблони виводять тексти як простий текст (Astro екранує), тож <b>…</b> з
// адмінки зʼявився б на сторінці буквально. Ловимо тут, а не тестом після
// збірки. Єдиний виняток — homepage.hero.title (localizedHtml нижче).
const MARKUP = /<[a-z/!]/i;
const plainText = text.refine(
  (value) => !MARKUP.test(value),
  'розмітка (<…>) у тексті не допускається: поле виводиться як простий текст; HTML дозволений лише в homepage.hero.title',
);

export const localized = z
  .object({
    uk: plainText,
    en: plainText,
  })
  .strict();

// Лише для homepage.hero.title: рендериться через set:html (<em>, <br>).
export const localizedHtml = z.object({ uk: text, en: text }).strict();

// tel:-посилання будуються з цього поля (telHref лишає цифри й «+»): «abc»
// дав би порожній tel:, тому — лише символи номера і хоча б 7 цифр.
const phone = z
  .string()
  .regex(/^[+\d\s()-]+$/, 'телефон: лише цифри, пробіли й символи + - ( )')
  .refine((value) => (value.match(/\d/g) ?? []).length >= 7, 'телефон: щонайменше 7 цифр');

// alt обовʼязкове: воно потрібне і для доступності, і для SEO (Спека 1).
// src приймає і повний YouTube-URL, і голий 11-символьний ID — Спека 1
// дозволяє обидва, тому звужувати до URL не можна.
// Відео не з YouTube галерея показати не вміє — ловимо тут, а не падінням
// у Gallery.astro.
export const mediaItem = z
  .object({
    type: z.enum(['image', 'video']),
    src: z.string().min(1),
    alt: text,
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
export const MINISTRY_ICONS = MINISTRY_ICON_NAMES;

const ministries = z.object({
  slug,
  // Позиція в списку. Glob-завантажувач порядку файлів не гарантує, а від
  // порядку залежить вигляд (перші три служіння на головній, значок
  // «Головна церква» у першої церкви, блоки «ще …»). Дірки й дублікати
  // дозволені: шаблони сортують стабільно (order, потім slug). Те саме в
  // churches, projects, testimonies, pastors і leader-resources.
  order: z.number().int().nonnegative(),
  icon: z.enum(MINISTRY_ICONS),
  leader: z.string().min(1),
  phone,
  name: localized,
  summary: localized,
  body: localized,
  media: gallery,
  seo,
}).strict();

// Координати нового поля geo немає в жодному легасі-джерелі. Nullable, щоб
// збірка проходила зараз, а Етап 3 (JSON-LD Church) бачив явну порожнечу.
export const geoPoint = z.object({ lat: z.number(), lng: z.number() }).strict().nullable();

const churches = z.object({
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
}).strict();

const projects = z.object({
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
}).strict();

// Текстове й відеосвідчення мають різні обовʼязкові поля. Союз за type
// не дає покласти відео без посилання й текст без тексту.
const testimonyBase = {
  slug,
  order: z.number().int().nonnegative(),
  name: z.string().min(1),
  role: localized,
};

const testimonies = z.discriminatedUnion('type', [
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
]);

export const PASTOR_GROUPS = ['pastor', 'elder'];

const pastors = z.object({
  slug,
  name: z.string().min(1),
  photo: z.string().min(1),
  order: z.number().int().nonnegative(),
  group: z.enum(PASTOR_GROUPS),
  // Кнопки звʼязку на картці пастора (mailto:/tel: без схеми). У легасі
  // пошта є в усіх трьох пасторів, телефон — лише в старшого, у
  // пресвітерів — нічого; null означає «кнопки немає».
  email: z.string().email().nullable(),
  phone: phone.nullable(),
  role: localized,
  // У пресвітерів підзаголовка немає — у легасі це ключ лише в pastorN.
  subtitle: localized.nullable(),
  bio: localized,
}).strict();

export const RESOURCE_FORMATS = ['pdf', 'doc', 'xls', 'ppt'];

const leaderResources = z.object({
  slug,
  kind: z.enum(['document', 'link']),
  order: z.number().int().nonnegative(),
  // У легасі всі href — "#". null чесніше за заглушку: заглушку
  // неможливо відрізнити від справжньої адреси при перевірці.
  url: z
    .string()
    .min(1)
    .refine((value) => value.trim() !== '#', 'url: «#» — заглушка, а не адреса; поки адреси немає, лишіть null')
    .nullable(),
  format: z.enum(RESOURCE_FORMATS).nullable(),
  icon: z.enum(RESOURCE_ICON_NAMES).nullable(),
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
});

// Одиночка = один запис із id "main". file() робить ключі верхнього рівня
// ідентифікаторами, тож обгортка {"main": …} — це ціна того, щоб одиночка
// теж валідувалася схемою на збірці, а не читалася як сирий JSON.
const siteSettings = z.object({
  name: localized,
  // Лого з написом — своє для кожної мови.
  logo: z.object({ uk: z.string().min(1), en: z.string().min(1) }).strict(),
  defaultOgImage: z.string().min(1).nullable(),
  social: z
    .object({
      facebook: z.string().url(),
      youtube: z.string().url(),
      instagram: z.string().url(),
      telegram: z.string().url(),
    })
    .strict(),
}).strict();

const contactInfo = z.object({
  address: localized,
  city: localized,
  geo: geoPoint,
  phone,
  phoneDisplay: z.string().min(1),
  email: z.string().email(),
  serviceDay: localized,
  serviceTime: z.string().min(1),
  mapUrl: z.string().url(),
}).strict();

const donateSettings = z.object({
  liqpayUrl: z.string().url(),
  defaultAmount: z.number().int().positive(),
  // Прирости, а не пресети: кнопка калькулятора (data-calc-add, «+200 UAH»)
  // додає суму до поля, а не підставляє її замість введеної. Порожній
  // список — калькулятор без кнопок, лише поле суми.
  calcIncrements: z.array(z.number().int().positive()),
}).strict();

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
const labels = (keys) =>
  z.object(Object.fromEntries(keys.map((key) => [key, localized]))).strict();

const homepage = z.object({
  nav: labels(['home', 'about', 'ministries', 'media', 'union', 'donations', 'projects', 'contacts', 'leaders']),
  cta: labels(['live', 'liveTitle']),
  // title — єдине поле з розміткою (localizedHtml), решта — простий текст.
  hero: labels(['tag', 'vision', 'addr', 'time', 'watch', 'donate', 'scroll']).extend({ title: localizedHtml }),
  // Окремим ключем, а не всередині hero: hero — словник пар {uk, en}, і
  // нелокалізований обʼєкт там зламав би і схему, і обхід перекладів.
  // alt — рядок, як у mediaItem: в легасі він лише український.
  heroImage: z
    .object({
      src: z.string().min(1),
      mobileSrc: z.string().min(1),
      alt: text,
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
  pastors: labels(['eyebrow', 'title', 'lead', 'all']),
  contacts: labels(['eyebrow', 'title', 'addrLbl', 'addr', 'phoneLbl', 'emailLbl', 'svcLbl', 'svcDay', 'socialLbl']),
  donate: labels(['eyebrow', 'title', 'quote', 'ref', 'btn', 'thanks']),
  footer: labels(['about', 'navTitle', 'contactsTitle', 'socialTitle', 'copy', 'built', 'addr']),
  // Спека 2: SEO-група в кожної сторінки. Необовʼязкова — без неї діють
  // фолбеки (Seo.astro).
  seo: seo.optional(),
}).strict();

// Сторінки — маршрути в коді, тож набір id фіксований: без запису сторінка
// не має навіть заголовка.
export const PAGE_IDS = ['about', 'contacts', 'donate', 'churches', 'ministries', 'projects', 'testimonies', 'pastors', 'leaders'];

const pages = z.object({
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
  // Явні ключі, а не record: з одруківкою («past_tilte») заголовок секції
  // мовчки зник би зі сторінки.
  sections: z
    .object(Object.fromEntries([
      'hero_locked', 'docs_title', 'res_title',
      'past_eyebrow', 'past_title', 'past_lead', 'elders_eyebrow', 'elders_title', 'elders_lead',
    ].map((key) => [key, localized.optional()])))
    .strict()
    .optional(),
  help: z.object({ title: localized, desc: localized, btn: localized }).strict().optional(),
  body: localized.nullable().optional(),
  seo: seo.optional(),
}).strict();

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
