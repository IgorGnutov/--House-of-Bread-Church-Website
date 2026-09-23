import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { LEGACY_PAGES, PROJECT_ROOT, readDuplicateVariants, readHobGlobals, readLegacy, readPageStrings, slugifyName } from './lib/legacy-source.mjs';

// Карта «звідки → куди» для кожного ключа data-i18n. Заповнюється тими самими
// функціями, що пишуть дані, — тоді вона не може розійтися з тим, що записано.
// Задача 11 звіряє за нею перенесене з легасі побайтово.
export const keyMap = [];
export const mapKey = (page, key, destination) => keyMap.push({ page, key, destination });

// Стабільна серіалізація: два пробіли й перенос у кінці. Інакше повторний
// запуск скрипта дає diff із самих лапок і ховає справжні зміни контенту.
export const writeJson = (relPath, value) => {
  const target = fileURLToPath(new URL(relPath, PROJECT_ROOT));
  mkdirSync(fileURLToPath(new URL(relPath.replace(/\/[^/]+$/, '/'), PROJECT_ROOT)), {
    recursive: true,
  });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

// SEO-поля ще ніде не заповнені: на легасі-сторінках немає жодного <title>.
// Кладемо явні null, щоб Етап 3 бачив порожнечу як дані, а не як відсутнє поле.
const emptySeo = () => ({
  metaTitle: null,
  metaDescription: null,
  ogImage: null,
  noindex: false,
});

function extractMinistries(window) {
  window.HOB_MINISTRIES.forEach((m, order) => {
    writeJson(`src/content/ministries/${m.id}.json`, {
      slug: m.id,
      order,
      icon: m.ic,
      leader: m.leader,
      phone: m.phone,
      name: { uk: m.uk[0], en: m.en[0] },
      summary: { uk: m.uk[1], en: m.en[1] },
      body: { uk: m.body, en: m.bodyEn },
      // Галерея служінь у легасі генерується функцією на льоту. У Storyblok
      // функції не буде, тому «заморожуємо» результат у дані як є.
      media: window.HOB_ministryMedia(m),
      seo: emptySeo(),
    });
  });
}

function extractChurches(window) {
  window.HOB_CHURCHES.forEach((c, order) => {
    writeJson(`src/content/churches/${c.id}.json`, {
      slug: c.id,
      order,
      pastor: c.pastor,
      geo: null,
      name: { uk: c.name, en: c.en.name },
      city: { uk: c.city, en: c.en.city },
      role: { uk: c.role, en: c.en.role },
      address: { uk: c.address, en: c.en.address },
      times: { uk: c.times, en: c.en.times },
      lead: { uk: c.lead, en: c.en.lead },
      body: { uk: c.body, en: c.en.body },
      media: c.media,
      seo: emptySeo(),
    });
  });
}

function extractProjects(window) {
  window.HOB_PROJECTS.forEach((p, order) => {
    writeJson(`src/content/projects/${p.id}.json`, {
      slug: p.id,
      order,
      date: p.date,
      progress: p.progress
        ? {
            percent: p.progress.percent,
            raised: { uk: p.progress.raised, en: p.en.progress.raised },
            goal: { uk: p.progress.goal, en: p.en.progress.goal },
          }
        : null,
      ctaUrl: p.cta?.url ?? null,
      title: { uk: p.title, en: p.en.title },
      category: { uk: p.category, en: p.en.category },
      status: { uk: p.status, en: p.en.status },
      period: { uk: p.period, en: p.en.period },
      lead: { uk: p.lead, en: p.en.lead },
      body: { uk: p.body, en: p.en.body },
      stats: p.stats.map((s, i) => ({
        n: s.n,
        label: { uk: s.l, en: p.en.stats[i].l },
      })),
      ctaLabel: { uk: p.cta.label, en: p.en.cta.label },
      media: p.media,
      seo: emptySeo(),
    });
  });
}

function extractTestimonies(window) {
  window.HOB_TESTIMONIES.forEach((t, order) => {
    const base = {
      slug: t.id,
      order,
      type: t.type,
      name: t.name,
      role: { uk: t.role, en: t.en.role },
    };

    writeJson(
      `src/content/testimonies/${t.id}.json`,
      t.type === 'video'
        ? { ...base, videoUrl: t.yt, poster: t.img }
        : { ...base, text: { uk: t.text, en: t.en.text } },
    );
  });
}

function extractPastors() {
  const strings = readPageStrings('pastors.dc.html');
  const root = parse(readLegacy('pastors.dc.html'));
  const pair = (key) => strings.get(key);

  const cards = [
    ...root.querySelectorAll('.pastor-card').map((el, i) => ({ el, group: 'pastor', i })),
    ...root.querySelectorAll('.elder-card').map((el, i) => ({ el, group: 'elder', i })),
  ];

  for (const { el, group, i } of cards) {
    const prefix = group === 'pastor' ? `pastor${i + 1}` : `elder${i + 1}`;
    const name = el.querySelector('h3').textContent.trim();
    const slug = slugifyName(name);

    writeJson(`src/content/pastors/${slug}.json`, {
      slug,
      name,
      photo: el.querySelector('img').getAttribute('src'),
      order: i,
      group,
      role: pair(`${prefix}.role`),
      subtitle: group === 'pastor' ? pair(`${prefix}.sub`) : null,
      bio: group === 'pastor' ? pair(`${prefix}.bio`) : pair(`${prefix}.desc`),
    });

    mapKey('pastors.dc.html', `${prefix}.role`, `pastors:${slug}.role`);
    mapKey('pastors.dc.html', `${prefix}.${group === 'pastor' ? 'bio' : 'desc'}`, `pastors:${slug}.bio`);
    if (group === 'pastor') mapKey('pastors.dc.html', `${prefix}.sub`, `pastors:${slug}.subtitle`);
  }

  console.log(`pastors: ${cards.length}`);
}

function extractLeaderResources() {
  const strings = readPageStrings('leaders.dc.html');
  const root = parse(readLegacy('leaders.dc.html'));
  const href = (el) => {
    const value = el.getAttribute('href');
    return value && value !== '#' ? value : null;
  };

  root.querySelectorAll('.doc-card').forEach((el, i) => {
    const n = i + 1;
    writeJson(`src/content/leader-resources/document-${n}.json`, {
      slug: `document-${n}`,
      kind: 'document',
      order: i,
      url: href(el),
      // Формат читається з класу значка: <span class="doc-ic pdf">.
      format: el.querySelector('.doc-ic').classNames.split(/\s+/).find((c) => c !== 'doc-ic'),
      title: strings.get(`doc${n}.title`),
      description: strings.get(`doc${n}.desc`),
      meta: strings.get(`doc${n}.meta`),
    });

    for (const [legacy, moved] of [['title', 'title'], ['desc', 'description'], ['meta', 'meta']]) {
      mapKey('leaders.dc.html', `doc${n}.${legacy}`, `leader-resources:document-${n}.${moved}`);
    }
  });

  root.querySelectorAll('.res-card').forEach((el, i) => {
    const n = i + 1;
    writeJson(`src/content/leader-resources/link-${n}.json`, {
      slug: `link-${n}`,
      kind: 'link',
      order: i,
      url: href(el),
      format: null,
      title: strings.get(`res${n}.title`),
      description: strings.get(`res${n}.desc`),
      meta: null,
    });

    mapKey('leaders.dc.html', `res${n}.title`, `leader-resources:link-${n}.title`);
    mapKey('leaders.dc.html', `res${n}.desc`, `leader-resources:link-${n}.description`);
  });

  console.log('leader-resources: 12');
}

function extractGlobals() {
  const home = readPageStrings('index.html');

  writeJson('src/content/singletons/site-settings.json', {
    main: {
      name: { uk: 'Дім Хліба', en: 'House of Bread Church' },
      logo: 'uploads/logo_white.png',
      defaultOgImage: null,
      social: {
        facebook: 'https://www.facebook.com/dom.hleba.org',
        youtube: 'https://www.youtube.com/@Dim-Hliba',
        instagram: 'https://www.instagram.com/dim_hliba_kr/',
        telegram: 'https://t.me/domhleba_kr',
      },
    },
  });

  writeJson('src/content/singletons/contact-info.json', {
    main: {
      // Адреса й день служіння беруться з ключів головної, а не набиваються
      // вручну: так вони гарантовано збігаються з тим, що зараз в ефірі.
      address: home.get('hero.addr'),
      city: { uk: 'Кривий Ріг', en: 'Kryvyi Rih' },
      geo: null,
      phone: '+380991339969',
      phoneDisplay: '099 133 99 69',
      email: 'info@houseofbread.church',
      serviceDay: home.get('con.svcDay'),
      serviceTime: '12:00–14:00',
      mapUrl: 'https://www.google.com/maps?cid=14553890085252701377',
    },
  });

  writeJson('src/content/singletons/donate-settings.json', {
    main: {
      liqpayUrl: 'https://www.liqpay.ua/uk/checkout/card/donatedh',
      defaultAmount: 500,
      quickAmounts: [200, 500, 1000],
    },
  });

  console.log('singletons: site-settings, contact-info, donate-settings');
}

function extractHomepage() {
  const s = readPageStrings('index.html');
  const get = (key) => {
    const pair = s.get(key);
    if (!pair) throw new Error(`index.html: немає ключа ${key}`);
    return pair;
  };
  // Відбирає всі ключі з префіксом і скидає префікс: nav.home → home.
  // Секції з нумерованими блоками (news, wwb, tst) так брати не можна —
  // group('news') захопив би і news.1.date, — тому вони зібрані явно.
  const group = (prefix) =>
    Object.fromEntries(
      [...s.keys()]
        .filter((k) => k.startsWith(`${prefix}.`))
        .map((k) => [k.slice(prefix.length + 1), s.get(k)]),
    );

  const footer = group('foot');
  // con.addr трапляється на index.html двічі з різним українським текстом:
  // контакти (перше входження, вже в contacts.addr через readPageStrings) і
  // підвал (друге). readDuplicateVariants повертає їх у порядку документа,
  // тож [1] — це підвальний варіант; en той самий у легасі-перемикачі мови.
  footer.addr = { uk: readDuplicateVariants('index.html').get('con.addr')[1], en: get('con.addr').en };

  writeJson('src/content/singletons/homepage.json', {
    main: {
      nav: group('nav'),
      cta: group('cta'),
      hero: group('hero'),
      about: group('about'),
      beliefs: [1, 2, 3, 4, 5, 6, 7].map((n) => get(`belief.${n}`)),
      news: {
        eyebrow: get('news.eyebrow'), title: get('news.title'),
        lead: get('news.lead'), more: get('news.more'),
        items: [1, 2, 3].map((n) => ({
          date: get(`news.${n}.date`), title: get(`news.${n}.title`), text: get(`news.${n}.text`),
        })),
      },
      fb: { title: get('fb.title'), text: get('fb.text') },
      wwb: {
        eyebrow: get('wwb.eyebrow'), title: get('wwb.title'),
        items: [1, 2, 3, 4].map((n) => ({ title: get(`wwb.${n}.t`), text: get(`wwb.${n}.d`) })),
      },
      testimonies: {
        eyebrow: get('tst.eyebrow'), title: get('tst.title'), all: get('tst.all'),
        items: [1, 2, 3, 4].map((n) => ({
          text: get(`tst.${n}.text`), name: get(`tst.${n}.name`), role: get(`tst.${n}.role`),
        })),
      },
      ministries: group('min'),
      pastors: group('past'),
      contacts: group('con'),
      donate: group('don'),
      footer,
    },
  });

  // Реєструємо, куди поїхав кожен ключ головної. Відображення префіксів на
  // імена груп задане тут один раз — саме за цією картою Задача 11 доводить,
  // що жоден із 240 ключів не загубився і не продублювався.
  const GROUP_OF_PREFIX = {
    nav: 'nav', cta: 'cta', hero: 'hero', about: 'about',
    min: 'ministries', past: 'pastors', con: 'contacts', don: 'donate', foot: 'footer',
  };

  for (const key of s.keys()) {
    const [prefix, ...rest] = key.split('.');

    if (prefix === 'belief') { mapKey('index.html', key, `homepage:beliefs.${Number(rest[0]) - 1}`); continue; }
    if (prefix === 'news' && rest.length === 2) {
      mapKey('index.html', key, `homepage:news.items.${Number(rest[0]) - 1}.${rest[1]}`); continue;
    }
    if (prefix === 'news') { mapKey('index.html', key, `homepage:news.${rest[0]}`); continue; }
    if (prefix === 'fb') { mapKey('index.html', key, `homepage:fb.${rest[0]}`); continue; }
    if (prefix === 'wwb' && rest.length === 2) {
      const field = rest[1] === 't' ? 'title' : 'text';
      mapKey('index.html', key, `homepage:wwb.items.${Number(rest[0]) - 1}.${field}`); continue;
    }
    if (prefix === 'wwb') { mapKey('index.html', key, `homepage:wwb.${rest[0]}`); continue; }
    if (prefix === 'tst' && rest.length === 2) {
      mapKey('index.html', key, `homepage:testimonies.items.${Number(rest[0]) - 1}.${rest[1]}`); continue;
    }
    if (prefix === 'tst') { mapKey('index.html', key, `homepage:testimonies.${rest[0]}`); continue; }

    const groupName = GROUP_OF_PREFIX[prefix];
    if (!groupName) throw new Error(`index.html: префікс ${prefix} не має групи`);
    mapKey('index.html', key, `homepage:${groupName}.${rest.join('.')}`);
  }
  // footer.addr — друге відображення вже мапленого ключа con.addr, а не
  // окремий легасі-ключ, тож у keyMap воно свідомо не реєструється.

  // Ключів на головній 101 (включно з cta.liveTitle), а не 100 — рахуємо
  // з readPageStrings, а не хардкодимо число, яке легко розійдеться з фактом.
  console.log(`homepage: ${s.size} ключів`);
}

// Ключі, що на кожній сторінці означають те саме, — переїжджають як є.
const SHARED_UI_KEYS = [
  'back.home', 'back.churches', 'back.ministries', 'back.projects',
  'crumb.home', 'crumb.churches', 'crumb.ministries', 'crumb.projects',
  'cta.directions', 'cta.join',
  'fact.address', 'fact.leader', 'fact.pastor', 'fact.phone', 'fact.times',
  'foot.rights', 'info.eyebrow', 'res.go', 'docs.count', 'res.count',
];

// Ключі, що на різних сторінках означають різне, — перейменовуються.
const RENAMED_UI_KEYS = {
  'churches.dc.html|foot.back': 'footBack.home',
  'leaders.dc.html|foot.back': 'footBack.home',
  'ministries.dc.html|foot.back': 'footBack.home',
  'pastors.dc.html|foot.back': 'footBack.home',
  'projects.dc.html|foot.back': 'footBack.home',
  'testimonies.dc.html|foot.back': 'footBack.home',
  'church.dc.html|foot.back': 'footBack.churches',
  'ministry.dc.html|foot.back': 'footBack.ministries',
  'project.dc.html|foot.back': 'footBack.projects',
  'church.dc.html|info.title': 'info.aboutChurch',
  'project.dc.html|info.title': 'info.aboutProject',
  'church.dc.html|more.title': 'more.churches',
  'ministry.dc.html|more.title': 'more.ministries',
  'project.dc.html|more.title': 'more.projects',
};

function extractPagesAndUi() {
  const uk = {};
  const en = {};
  const pagesOut = {};
  // Плаский ключ «a.b» розкладаємо у вкладений обʼєкт: тест покриття
  // резолвить призначення саме по крапках.
  const put = (target, dotted, value) => {
    const steps = dotted.split('.');
    const last = steps.pop();
    steps.reduce((o, k) => (o[k] ??= {}), target)[last] = value;
  };

  const PAGE_SLUGS = {
    'churches.dc.html': 'churches',
    'ministries.dc.html': 'ministries',
    'projects.dc.html': 'projects',
    'testimonies.dc.html': 'testimonies',
    'pastors.dc.html': 'pastors',
    'leaders.dc.html': 'leaders',
  };

  for (const page of LEGACY_PAGES.filter((p) => p !== 'index.html')) {
    const strings = readPageStrings(page);
    const slug = PAGE_SLUGS[page];

    for (const [key, pair] of strings) {
      // Ключі служителів і ресурсів лідерів уже зареєстровані в Задачах 7–8 —
      // тут їх пропускаємо, інакше в карті зʼявився б дублікат.
      if (/^(pastor[1-3]|elder[1-8])\.(role|sub|bio|desc)$/.test(key)) continue;
      if (/^(doc|res)[1-6]\.(title|desc|meta)$/.test(key)) continue;

      if (slug && ['page.eyebrow', 'page.title', 'page.lead'].includes(key)) {
        put(pagesOut, `${slug}.${key.split('.')[1]}`, pair);
        mapKey(page, key, `pages:${slug}.${key.split('.')[1]}`);
        continue;
      }
      if (slug && key === 'hero.tag') {
        put(pagesOut, `${slug}.heroTag`, pair);
        mapKey(page, key, `pages:${slug}.heroTag`);
        continue;
      }
      if (slug && ['hero.locked', 'docs.title', 'res.title', 'past.eyebrow', 'past.title',
                   'past.lead', 'elders.eyebrow', 'elders.title', 'elders.lead'].includes(key)) {
        const name = key.replace('.', '_');
        put(pagesOut, `${slug}.sections.${name}`, pair);
        mapKey(page, key, `pages:${slug}.sections.${name}`);
        continue;
      }
      if (slug && key.startsWith('help.')) {
        const name = key.split('.')[1];
        put(pagesOut, `${slug}.help.${name}`, pair);
        mapKey(page, key, `pages:${slug}.help.${name}`);
        continue;
      }

      const renamed = RENAMED_UI_KEYS[`${page}|${key}`];
      const uiKey = renamed ?? (SHARED_UI_KEYS.includes(key) ? key : null);
      if (!uiKey) throw new Error(`${page}: ключ ${key} нікуди не призначений`);

      put(uk, uiKey, pair.uk);
      put(en, uiKey, pair.en);
      mapKey(page, key, `i18n:${uiKey}`);
    }
  }

  // Три нові сторінки (Спека 1: page-about, page-contacts, page-donate) у легасі
  // не існують. Заводимо їх із заголовком із пункту меню й порожньою прозою:
  // Етапу 2 потрібен запис, щоб було що рендерити, а текст напише замовник.
  const home = readPageStrings('index.html');
  for (const [pageSlug, navKey] of [
    ['about', 'nav.about'], ['contacts', 'nav.contacts'], ['donate', 'nav.donations'],
  ]) {
    pagesOut[pageSlug] = { title: home.get(navKey), body: null };
  }

  writeJson('src/content/singletons/pages.json', pagesOut);
  writeJson('src/i18n/uk.json', uk);
  writeJson('src/i18n/en.json', en);
  console.log(`pages: ${Object.keys(pagesOut).length}, i18n: ${keyMap.filter((k) => k.destination.startsWith('i18n:')).length} призначень`);
}

// --- виклики ---

const window = readHobGlobals([
  'ministries-data.js',
  'churches-data.js',
  'projects-data.js',
  'testimonies-data.js',
]);

extractMinistries(window);
console.log('ministries: 18');
extractChurches(window);
console.log('churches: 6');
extractProjects(window);
console.log('projects: 4');
extractTestimonies(window);
console.log('testimonies: 6');
extractPastors();
extractLeaderResources();
extractGlobals();
extractHomepage();
extractPagesAndUi();
writeJson('scripts/key-map.json', keyMap);
console.log(`key-map: ${keyMap.length} пар`);
