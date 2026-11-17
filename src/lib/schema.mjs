import { z } from 'astro/zod';
import { MINISTRY_ICON_NAMES, RESOURCE_ICON_NAMES } from './icons.mjs';
import { ytId } from './youtube.mjs';
import { isDoc, richPlain } from './richtext.mjs';

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

// Форматований текст (richtext Storyblok). Тут межа безпеки: бібліотека рендеру
// (@storyblok/richtext) пропускає href на кшталт `javascript:` і виводить дітей невідомих
// вузлів, тож усе, що ця схема приймає, має бути безпечним для показу, а решта — валити
// збірку з повідомленням, яке називає поле. Один обхід `richIssues` перевіряє і структуру,
// і марки, і адреси, щоб правила не розійшлися між собою.
// Рівні: rich — основний текст (усі блоки); inline — лише абзаци (підписи, заголовки з
// посиланнями); card — як inline, але без посилань і якорів, бо на сайті поле стоїть
// усередині картки-посилання (<a> в <a> недійсний).
const RICH_BLOCKS = new Set([
  'heading', 'bullet_list', 'ordered_list', 'blockquote', 'horizontal_rule', 'code_block', 'image', 'table',
]);
const SIMPLE_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', 'code']);
const COLOR_MARKS = new Set(['textStyle', 'highlight', 'styled']);
const LIST_BLOCKS = [
  'paragraph', 'bullet_list', 'ordered_list', 'blockquote', 'horizontal_rule', 'code_block', 'image', 'table',
];
// Дозволені атрибути й діти кожного вузла: усе, чого тут немає, — помилка.
const NODE_RULES = {
  doc: { attrs: [], children: ['paragraph', ...RICH_BLOCKS] },
  paragraph: { attrs: ['textAlign'], children: ['text', 'hard_break', 'emoji', 'image'] },
  heading: { attrs: ['level', 'textAlign'], children: ['text', 'hard_break', 'emoji'] },
  bullet_list: { attrs: [], children: ['list_item'] },
  ordered_list: { attrs: ['order'], children: ['list_item'] },
  list_item: { attrs: [], children: LIST_BLOCKS },
  blockquote: { attrs: [], children: ['paragraph', 'bullet_list', 'ordered_list'] },
  horizontal_rule: { attrs: [], children: [] },
  hard_break: { attrs: [], children: [] },
  emoji: { attrs: ['emoji'], children: [] },
  image: { attrs: ['src', 'alt', 'title'], children: [] },
  code_block: { attrs: ['class'], children: ['text'] },
  table: { attrs: [], children: ['tableRow'] },
  tableRow: { attrs: [], children: ['tableHeader', 'tableCell'] },
  tableHeader: { attrs: ['colspan', 'rowspan', 'backgroundColor'], children: ['paragraph'] },
  tableCell: { attrs: ['colspan', 'rowspan', 'backgroundColor'], children: ['paragraph'] },
  text: { attrs: [], children: [] },
};
const TABLE_TYPES = new Set(['table', 'tableRow', 'tableHeader', 'tableCell']);
const IMAGE_SRC = /^(?:https:\/\/\S+|uploads\/\S+)$/;
const ANCHOR_ID = /^[a-z0-9-]+$/;
const TEXT_MESSAGE = 'текст не може бути порожнім або з самих пробілів';
const COLOR_MESSAGE = 'колір і виділення кольором не підтримуються: дизайн використовує лише свої кольори';
const TABLE_MESSAGE = 'таблиця: рядки → клітинки → абзаци';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const blankVal = (v) => v === null || v === undefined || v === '';

function richIssues(value, level) {
  const out = [];
  const add = (path, message) => out.push({ path, message });

  const extraKeys = (obj, allowed, path) => {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) add([...path, key], `зайве поле «${key}»`);
    }
  };

  const checkMarks = (marks, path) => {
    if (!Array.isArray(marks)) return add(path, 'зайве поле «marks»');
    marks.forEach((mark, i) => {
      const p = [...path, i];
      if (!isObj(mark)) return add(p, 'елемент «?» тут не підтримується');
      const attrs = isObj(mark.attrs) ? mark.attrs : {};
      if (COLOR_MARKS.has(mark.type)) return add(p, COLOR_MESSAGE);
      if (SIMPLE_MARKS.has(mark.type)) return extraKeys(mark, ['type'], p);
      if (mark.type === 'link' || mark.type === 'anchor') {
        if (level === 'card') {
          return add(p, 'посилання в цьому полі неможливі: на сайті воно стоїть усередині картки-посилання');
        }
        extraKeys(mark, ['type', 'attrs'], p);
        const ap = [...p, 'attrs'];
        if (mark.type === 'anchor') {
          extraKeys(attrs, ['id'], ap);
          if (typeof attrs.id !== 'string' || !ANCHOR_ID.test(attrs.id)) {
            add([...ap, 'id'], 'якір: лише малі латинські літери, цифри й дефіси');
          }
          return;
        }
        extraKeys(attrs, ['href', 'linktype'], ap);
        if (!['url', 'email', 'asset'].includes(attrs.linktype)) {
          add([...ap, 'linktype'], `невідомий тип посилання «${attrs.linktype ?? ''}»`);
        }
        if (typeof attrs.href !== 'string' || !LINK_URL.test(attrs.href)) {
          add([...ap, 'href'], `${LINK_MESSAGE} (зараз «${attrs.href ?? ''}»)`);
        }
        return;
      }
      add(p, `елемент «${mark.type}» тут не підтримується`);
    });
  };

  const checkAttrs = (node, allowed, path) => {
    if (node.attrs === undefined) return;
    if (!isObj(node.attrs)) return add([...path, 'attrs'], 'зайве поле «attrs»');
    for (const [key, v] of Object.entries(node.attrs)) {
      const p = [...path, 'attrs', key];
      if (key === 'textAlign' && !blankVal(v)) add(p, 'вирівнювання не підтримується: текст вирівнює дизайн сторінки');
      else if (key === 'backgroundColor' && !blankVal(v)) add(p, COLOR_MESSAGE);
      // Порожні textAlign/backgroundColor прибирає нормалізація; якщо дійшли сюди — документ
      // не нормалізовано, і це помилка виклику, а не вибір редактора.
      else if (!allowed.includes(key) || key === 'textAlign' || key === 'backgroundColor') {
        add(p, `зайве поле «${key}»`);
      }
    }
  };

  const checkSpecific = (node, path) => {
    const a = isObj(node.attrs) ? node.attrs : {};
    if (node.type === 'heading' && !(Number.isInteger(a.level) && a.level >= 2 && a.level <= 6)) {
      add([...path, 'attrs', 'level'], 'заголовок: рівні 2–6 (рівень 1 — заголовок сторінки)');
    }
    if (node.type === 'image') {
      if (typeof a.alt !== 'string' || !/\S/.test(a.alt)) {
        add([...path, 'attrs', 'alt'], 'картинка без опису (alt): заповніть опис картинки в медіатеці Storyblok');
      }
      if (typeof a.src !== 'string' || !IMAGE_SRC.test(a.src)) {
        add([...path, 'attrs', 'src'], 'картинка: адреса https://… або файл медіатеки');
      }
    }
    // Типи атрибутів потрапляють у HTML, тож перевіряємо не лише назви, а й значення.
    const bad = (key, message) => add([...path, 'attrs', key], message);
    const posInt = (v) => Number.isInteger(v) && v >= 1;
    if (node.type === 'ordered_list' && a.order !== undefined && !posInt(a.order)) {
      bad('order', 'номер початку списку: ціле число від 1');
    }
    if ((node.type === 'tableCell' || node.type === 'tableHeader')) {
      for (const key of ['colspan', 'rowspan']) {
        if (a[key] !== undefined && !posInt(a[key])) bad(key, `${key}: ціле число від 1`);
      }
    }
    if (node.type === 'emoji' && (typeof a.emoji !== 'string' || a.emoji === '')) {
      bad('emoji', 'емодзі: потрібен непорожній текст');
    }
    if (node.type === 'image' && a.title !== undefined && typeof a.title !== 'string') {
      bad('title', 'картинка: підпис (title) має бути текстом');
    }
    if (node.type === 'code_block' && a.class !== undefined
      && !(typeof a.class === 'string' && /^language-[\w-]+$/.test(a.class))) {
      bad('class', 'блок коду: клас має вигляд language-…');
    }
    if (node.type === 'code_block') {
      const plain = (Array.isArray(node.content) ? node.content : []).every((c) => (
        isObj(c) && c.type === 'text' && c.marks === undefined && Object.keys(c).every((k) => k === 'type' || k === 'text')
      ));
      if (!plain) add(path, 'блок коду: лише простий текст');
    }
  };

  const walk = (node, path, parent) => {
    if (!isObj(node)) return add(path, 'елемент «?» тут не підтримується');
    const type = node.type;
    if (type === 'blok') return add(path, 'вставні блоки в тексті не підтримуються');
    const rules = NODE_RULES[type];
    if (!rules) return add(path, `елемент «${type}» тут не підтримується`);
    if (level !== 'rich' && (RICH_BLOCKS.has(type) || type === 'list_item')) {
      return add(path, 'списки, заголовки, цитати, таблиці, картинки й код дозволені лише в основному тексті');
    }
    if (!NODE_RULES[parent].children.includes(type)) {
      if (TABLE_TYPES.has(parent) || TABLE_TYPES.has(type)) return add(path, TABLE_MESSAGE);
      return add(path, `елемент «${type}» тут не підтримується`);
    }
    extraKeys(node, type === 'text' ? ['type', 'text', 'marks'] : ['type', 'attrs', 'content'], path);
    checkAttrs(node, rules.attrs, path);
    checkSpecific(node, path);
    if (type === 'text') {
      if (typeof node.text !== 'string' || node.text === '') add([...path, 'text'], TEXT_MESSAGE);
      if (node.marks !== undefined) checkMarks(node.marks, [...path, 'marks']);
      return;
    }
    if (node.content === undefined) {
      if (type === 'table' || type === 'tableRow') add(path, TABLE_MESSAGE);
      return;
    }
    if (!Array.isArray(node.content)) return add([...path, 'content'], 'зайве поле «content»');
    if (type === 'code_block') return;
    if (TABLE_TYPES.has(type) && node.content.length === 0) return add(path, TABLE_MESSAGE);
    node.content.forEach((child, i) => walk(child, [...path, 'content', i], type));
  };

  // richPlain не бачить картинок і коду, але документ лише з ними не порожній.
  const hasImage = (n) => isObj(n) && (
    n.type === 'image'
    || (n.type === 'code_block' && Array.isArray(n.content) && n.content.some((c) => /\S/.test(c?.text ?? '')))
    || (Array.isArray(n.content) && n.content.some(hasImage))
  );

  if (value === undefined) return [{ path: [], message: 'поле обовʼязкове' }];
  if (typeof value === 'string' && !/\S/.test(value)) return [{ path: [], message: TEXT_MESSAGE }];
  if (!isDoc(value)) {
    return [{ path: [], message: 'очікується форматований текст (документ редактора Storyblok)' }];
  }
  extraKeys(value, ['type', 'content'], []);
  if (value.content !== undefined && !Array.isArray(value.content)) {
    add(['content'], 'зайве поле «content»');
  } else {
    (value.content ?? []).forEach((child, i) => walk(child, ['content', i], 'doc'));
  }
  if (out.length === 0 && richPlain(value).trim() === '' && !hasImage(value)) add([], TEXT_MESSAGE);
  return out;
}

const richDoc = (level) => z.any().superRefine((value, ctx) => {
  for (const { path, message } of richIssues(value, level)) ctx.addIssue({ code: 'custom', path, message });
});

// Основний текст; текст із посиланнями без блоків; текст усередині картки-посилання.
export const localizedRich = z.object({ uk: richDoc('rich'), en: richDoc('rich') }).strict();
export const localizedRichInline = z.object({ uk: richDoc('inline'), en: richDoc('inline') }).strict();
export const localizedRichCard = z.object({ uk: richDoc('card'), en: richDoc('card') }).strict();

// tel:-посилання будуються з цього поля (telHref лишає цифри й «+»): «abc»
// дав би порожній tel:, тому — лише символи номера і хоча б 7 цифр.
const phone = z
  .string()
  .regex(/^[+\d\s()-]+$/, 'телефон: лише цифри, пробіли й символи + - ( )')
  .refine((value) => (value.match(/\d/g) ?? []).length >= 7, 'телефон: щонайменше 7 цифр');

// Єдиний формат адреси для кнопок і посилань у тексті. «uploads/…» — файл,
// завантажений у бібліотеку CMS (адреса без початкового «/», бо під підшляхом
// його треба дописати до base). «//host» відкинуто: це чужий сайт без схеми, що
// обійшов би перевірку https. Голий «#» відкинуто: це заглушка, а не якір.
export const LINK_URL = /^(?:https?:\/\/\S+|mailto:\S+@\S+|tel:\+?[\d\s()-]{7,}|\/(?!\/)\S*|uploads\/\S+|#[\w-]+)$/;
const LINK_MESSAGE = 'посилання: https://…, mailto:…, tel:…, /сторінка/, uploads/файл або #якір';
export const linkUrl = z.string().regex(LINK_URL, LINK_MESSAGE);

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
  summary: localizedRichCard,
  body: localizedRich,
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
  lead: localizedRichCard,
  body: localizedRich,
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
  ctaUrl: linkUrl.nullable(),
  title: localized,
  category: localized,
  status: localized,
  period: localized,
  lead: localizedRichCard,
  body: localizedRich,
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
  z.object({ ...testimonyBase, type: z.literal('text'), text: localizedRich }).strict(),
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
  bio: localizedRich,
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
  description: localizedRichCard,
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

// hero.title — єдине поле з HTML (<em>, <br> в обох мовах), рендериться через
// set:html; тексти з описом — форматовані (Спека 4, localizedRichInline).
// Стрілка «Читати далі» і <cite> вірша живуть у шаблоні головної: у легасі
// вони були частиною uk-тексту й губилися на англійській (Етап 2, дірка 17).
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
  hero: labels(['tag', 'addr', 'time', 'watch', 'donate', 'scroll']).extend({ title: localizedHtml, vision: localizedRichInline }),
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
  about: labels(['eyebrow', 'title', 'beliefsTitle']).extend({ lead: localizedRichInline }),
  beliefs: z.array(localizedRichInline),
  news: z.object({
    eyebrow: localized, title: localized, lead: localizedRichInline, more: localized,
    items: z.array(z.object({ date: localized, title: localized, text: localizedRichInline, image: decorativeImage }).strict()),
  }).strict(),
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
  contacts: labels(['eyebrow', 'title', 'addrLbl', 'addr', 'phoneLbl', 'emailLbl', 'svcLbl', 'svcDay', 'socialLbl']),
  donate: labels(['eyebrow', 'title', 'ref', 'btn']).extend({ quote: localizedRichInline, thanks: localizedRichInline }),
  footer: labels(['navTitle', 'contactsTitle', 'socialTitle', 'copy', 'built', 'addr']).extend({ about: localizedRichInline }),
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
  lead: localizedRichInline.optional(),
  heroTag: localized.optional(),
  // Додаткові заголовки секцій є лише в pastors і leaders. Усе
  // необовʼязкове шаблони вміють не показувати — відсутній підпис прибирає
  // свій елемент, а не валить збірку.
  // Явні ключі, а не record: з одруківкою («past_tilte») заголовок секції
  // мовчки зник би зі сторінки.
  sections: z
    .object({
      ...Object.fromEntries([
        'hero_locked', 'docs_title', 'res_title',
        'past_eyebrow', 'past_title', 'elders_eyebrow', 'elders_title',
      ].map((key) => [key, localized.optional()])),
      past_lead: localizedRichInline.optional(),
      elders_lead: localizedRichInline.optional(),
    })
    .strict()
    .optional(),
  help: z.object({ title: localized, desc: localizedRichInline, btn: localized }).strict().optional(),
  body: localizedRich.nullable().optional(),
  seo: seo.optional(),
}).strict();

// Стрічка Facebook (Спека 5): знімок, який пише npm run fb:pull, а не
// редактор. Два свідомі винятки із загальних правил: text — не {uk, en}
// (пост існує однією мовою), і в ньому немає заборони розмітки: «<3» чи
// «<b>» у чужому пості — лише текст (шаблон екранує), і такий пост не має
// зупиняти деплой. Порядок — за date, тож поля order немає.
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
  facebook: facebookPosts,
};
