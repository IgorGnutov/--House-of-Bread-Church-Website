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
      // Файли — посиланням на хмару, не в медіатеці (рішення 11).
      url: text('Посилання на файл (Google Диск тощо)', { nullable: true }),
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
