import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { PROJECT_ROOT, readHobGlobals, readLegacy, readPageStrings, slugifyName } from './lib/legacy-source.mjs';

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
  for (const m of window.HOB_MINISTRIES) {
    writeJson(`src/content/ministries/${m.id}.json`, {
      slug: m.id,
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
  }
}

function extractChurches(window) {
  for (const c of window.HOB_CHURCHES) {
    writeJson(`src/content/churches/${c.id}.json`, {
      slug: c.id,
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
  }
}

function extractProjects(window) {
  for (const p of window.HOB_PROJECTS) {
    writeJson(`src/content/projects/${p.id}.json`, {
      slug: p.id,
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
  }
}

function extractTestimonies(window) {
  for (const t of window.HOB_TESTIMONIES) {
    const base = {
      slug: t.id,
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
  }
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
