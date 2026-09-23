import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { contentDir, readCollection, readSingleton, localizedPairs } from './helpers/content.js';

test('усі 18 служінь на місці, ім’я файлу збігається зі slug', () => {
  const entries = readCollection('ministries');
  assert.equal(entries.length, 18);

  for (const { file, data } of entries) {
    // Дублікат slug означав би дві сторінки на одному URL: одна тихо
    // перетерла б іншу. Ім'я файлу — єдине джерело унікальності, тож
    // розбіжність «файл ≠ поле» ловимо тут.
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
  }
});

test('icon кожного служіння — зі списку 18 дозволених', () => {
  const allowed = new Set([
    'book', 'home', 'media', 'worship', 'child', 'youth', 'teen', 'order', 'care',
    'chapel', 'prophetic', 'hospital', 'biz', 'pray', 'mercy', 'prison', 'family', 'globe',
  ]);

  for (const { file, data } of readCollection('ministries')) {
    assert.ok(allowed.has(data.icon), `${file}: невідома іконка ${data.icon}`);
  }
});

test('кожне локалізоване поле служінь має непорожні uk і en', () => {
  for (const { file, data } of readCollection('ministries')) {
    for (const [path, pair] of localizedPairs(data)) {
      assert.ok(pair.uk.trim().length > 0, `${file}${path}: порожня uk`);
      // Порожня en тихо показала б українську на англійській сторінці.
      assert.ok(String(pair.en).trim().length > 0, `${file}${path}: порожня en`);
    }
  }
});

test('кожен слайд галереї має непорожній alt і допустимий src', () => {
  for (const { file, data } of readCollection('ministries')) {
    assert.ok(data.media.length > 0, `${file}: порожня галерея`);

    for (const item of data.media) {
      assert.ok(['image', 'video'].includes(item.type), `${file}: тип ${item.type}`);
      assert.ok(item.src.trim().length > 0, `${file}: порожній src`);
      // Порожній alt проходить z.string() і дає картинку без опису —
      // це одразу і доступність, і SEO (Спека 1).
      assert.ok(item.alt.trim().length > 0, `${file}: порожній alt`);
    }
  }
});

test('усі 6 церков на місці, з двомовними полями і галереєю', () => {
  const entries = readCollection('churches');
  assert.equal(entries.length, 6);

  for (const { file, data } of entries) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.ok(data.media.length > 0, `${file}: порожня галерея`);

    for (const [path, pair] of localizedPairs(data)) {
      assert.ok(pair.uk.trim().length > 0, `${file}${path}: порожня uk`);
      assert.ok(String(pair.en).trim().length > 0, `${file}${path}: порожня en`);
    }
    for (const item of data.media) {
      assert.ok(item.alt.trim().length > 0, `${file}: порожній alt`);
    }
  }
});

test('координати церков присутні як поле, поки що порожні', () => {
  // Спека: geo — нове поле, джерела немає ніде. Явний null означає
  // «знаємо, що бракує»; відсутнє поле означало б «забули про нього».
  for (const { file, data } of readCollection('churches')) {
    assert.ok('geo' in data, `${file}: немає поля geo`);
    assert.equal(data.geo, null, `${file}: координати вигадані, а джерела немає`);
  }
});

test('усі 4 проєкти на місці, з локалізованими підписами показників', () => {
  const entries = readCollection('projects');
  assert.equal(entries.length, 4);

  for (const { file, data } of entries) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.match(data.date, /^\d{4}-\d{2}-\d{2}$/, `${file}: дата не ISO`);
    assert.ok(data.stats.length > 0, `${file}: немає показників`);

    for (const stat of data.stats) {
      assert.ok(stat.n.trim().length > 0, `${file}: показник без числа`);
      assert.ok(stat.label.uk.trim().length > 0, `${file}: показник без uk-підпису`);
      assert.ok(stat.label.en.trim().length > 0, `${file}: показник без en-підпису`);
    }
    for (const [path, pair] of localizedPairs(data)) {
      assert.ok(pair.uk.trim().length > 0, `${file}${path}: порожня uk`);
      assert.ok(String(pair.en).trim().length > 0, `${file}${path}: порожня en`);
    }
  }
});

test('нелокалізовані поля проєкту не роздвоєні по мовах', () => {
  // percent і url у джерелі є тільки в українському обʼєкті. Якби ми
  // зробили їх локалізованими, англійська версія лишилась би без них.
  const withProgress = readCollection('projects').filter(({ data }) => data.progress !== null);
  assert.ok(withProgress.length >= 1, 'жоден проєкт не має прогресу — дані загублені');

  for (const { file, data } of withProgress) {
    assert.equal(typeof data.progress.percent, 'number', `${file}: percent не число`);
    assert.ok(data.progress.raised.uk.length > 0, `${file}: зібрано без uk`);
    assert.ok(data.progress.raised.en.length > 0, `${file}: зібрано без en`);
  }
});

test('усі 6 свідчень на місці: 4 текстових і 2 відео', () => {
  const entries = readCollection('testimonies');
  assert.equal(entries.length, 6);

  const byType = entries.reduce((acc, { data }) => {
    acc[data.type] = (acc[data.type] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byType, { text: 4, video: 2 });

  for (const { file, data } of entries) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.ok(data.name.trim().length > 0, `${file}: без імені`);
    assert.ok(data.role.uk.trim().length > 0, `${file}: роль без uk`);
    assert.ok(data.role.en.trim().length > 0, `${file}: роль без en`);
  }
});

test('відеосвідчення мають посилання і постер, текстові — двомовний текст', () => {
  for (const { file, data } of readCollection('testimonies')) {
    if (data.type === 'video') {
      assert.ok(data.videoUrl.trim().length > 0, `${file}: відео без посилання`);
      assert.ok(data.poster.trim().length > 0, `${file}: відео без постера`);
    } else {
      assert.ok(data.text.uk.trim().length > 0, `${file}: текст без uk`);
      assert.ok(data.text.en.trim().length > 0, `${file}: текст без en`);
    }
  }
});

test('усі 11 служителів витягнуті: 3 пастори і 8 пресвітерів', () => {
  const entries = readCollection('pastors');
  assert.equal(entries.length, 11);

  const byGroup = entries.reduce((acc, { data }) => {
    acc[data.group] = (acc[data.group] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byGroup, { pastor: 3, elder: 8 });
});

test('кожен служитель має імʼя, фото, порядок і двомовну роль', () => {
  const orders = new Set();

  for (const { file, data } of readCollection('pastors')) {
    assert.equal(`${data.slug}.json`, file, `slug не збігається з іменем файлу: ${file}`);
    assert.ok(data.name.trim().length > 0, `${file}: без імені`);
    assert.match(data.photo, /^https?:\/\//, `${file}: фото не є посиланням`);
    assert.ok(data.role.uk.trim().length > 0, `${file}: роль без uk`);
    assert.ok(data.role.en.trim().length > 0, `${file}: роль без en`);
    assert.ok(data.bio.uk.trim().length > 0, `${file}: опис без uk`);
    assert.ok(data.bio.en.trim().length > 0, `${file}: опис без en`);

    // Порядок задає розкладку сторінки. Дублікат означав би, що двоє
    // претендують на одне місце, і сортування стало б недетермінованим.
    const orderKey = `${data.group}:${data.order}`;
    assert.ok(!orders.has(orderKey), `${file}: дублікат порядку ${orderKey}`);
    orders.add(orderKey);
  }
});

test('старший пастор перенесений разом із підзаголовком', () => {
  const senior = readCollection('pastors').find(({ data }) => data.slug === 'valerii-hryhorash');
  assert.ok(senior, 'немає запису Валерія Григораша');
  assert.equal(senior.data.name, 'Валерій Григораш');
  assert.equal(senior.data.role.uk, 'Старший пастор');
  assert.equal(senior.data.subtitle.uk, 'Засновник і старший пастор');
});

test('контакти пасторів перенесені з посилань картки, у пресвітерів їх немає', () => {
  const bySlug = Object.fromEntries(readCollection('pastors').map(({ data }) => [data.slug, data]));

  // Значення переписані зі старої сторінки служителів (mailto:/tel: без
  // схеми). Без цих полів Етап 2 не зміг би відтворити кнопки звʼязку на картці.
  assert.equal(bySlug['valerii-hryhorash'].email, 'pastor@houseofbread.church');
  assert.equal(bySlug['valerii-hryhorash'].phone, '+380991339969');
  assert.equal(bySlug['dmytro-iehorov'].email, 'dmytro@houseofbread.church');
  assert.equal(bySlug['dmytro-iehorov'].phone, null);
  assert.equal(bySlug['oleksandr-shyshka'].email, 'oleksandr@houseofbread.church');
  assert.equal(bySlug['oleksandr-shyshka'].phone, null);

  for (const data of Object.values(bySlug).filter((d) => d.group === 'elder')) {
    assert.equal(data.email, null, `${data.slug}: у пресвітера зʼявилась пошта`);
    assert.equal(data.phone, null, `${data.slug}: у пресвітера зʼявився телефон`);
  }
});

test('усі 12 ресурсів лідерів витягнуті: 6 документів і 6 посилань', () => {
  const entries = readCollection('leader-resources');
  assert.equal(entries.length, 12);

  const byKind = entries.reduce((acc, { data }) => {
    acc[data.kind] = (acc[data.kind] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(byKind, { document: 6, link: 6 });
});

test('документи несуть формат і двомовне підписання, посилання — ні', () => {
  for (const { file, data } of readCollection('leader-resources')) {
    assert.ok(data.title.uk.trim().length > 0, `${file}: назва без uk`);
    assert.ok(data.title.en.trim().length > 0, `${file}: назва без en`);

    if (data.kind === 'document') {
      assert.ok(['pdf', 'doc', 'xls', 'ppt'].includes(data.format), `${file}: формат ${data.format}`);
      assert.ok(data.meta.uk.trim().length > 0, `${file}: документ без підпису`);
    } else {
      assert.equal(data.format, null, `${file}: у посилання зʼявився формат файлу`);
      assert.equal(data.meta, null, `${file}: у посилання зʼявився підпис файлу`);
    }
  }
});

test('відсутні адреси збережені як null, а не як заглушка «#»', () => {
  // У легасі всі href дорівнюють "#". Записати "#" у дані означало б
  // видати заглушку за адресу; null чесно каже «замовник ще не дав».
  for (const { file, data } of readCollection('leader-resources')) {
    assert.notEqual(data.url, '#', `${file}: заглушка # потрапила в дані`);
  }
});

test('контакти — єдине джерело правди і містять усі факти для JSON-LD', () => {
  const contact = readSingleton('contact-info');

  assert.equal(contact.phone, '+380991339969');
  assert.equal(contact.email, 'info@houseofbread.church');
  // Легасі-текст hero.addr містить друкарську помилку («Караманиць» без
  // кінцевого «я») — переносимо як є, а не виправляємо на льоту.
  assert.equal(contact.address.uk, 'вул. Федора Караманиць, 33');
  assert.equal(contact.address.en, '33 Fedora Karamanytsia St.');
  assert.equal(contact.city.uk, 'Кривий Ріг');
  assert.ok(contact.serviceDay.uk.trim().length > 0, 'немає дня служіння');
  assert.ok(contact.serviceTime.trim().length > 0, 'немає часу служіння');
  assert.match(contact.mapUrl, /^https:\/\//);

  // Координати потрібні розмітці Church на Етапі 3, джерела немає ніде.
  // Явний null означає «знаємо, що бракує», а не «забули поле».
  assert.equal(contact.geo, null);
});

test('усі чотири соцмережі перенесені як абсолютні адреси', () => {
  const social = readSingleton('site-settings').social;

  for (const key of ['facebook', 'youtube', 'instagram', 'telegram']) {
    assert.match(social[key], /^https:\/\//, `${key}: не абсолютна адреса`);
  }
});

test('пожертви: посилання LiqPay і прирости калькулятора', () => {
  const donate = readSingleton('donate-settings');

  assert.match(donate.liqpayUrl, /^https:\/\/www\.liqpay\.ua\//);
  assert.equal(donate.defaultAmount, 500);
  assert.deepEqual(donate.calcIncrements, [200, 500, 1000]);
});

test('головна перенесена посекційно, з правильною кількістю повторюваних блоків', () => {
  const home = readSingleton('homepage');

  assert.equal(home.beliefs.length, 7, 'сім тверджень віри');
  assert.equal(home.news.items.length, 3, 'три новинні картки');
  assert.equal(home.wwb.items.length, 4, 'чотири блоки «у що віримо»');
  assert.equal(home.testimonies.items.length, 4, 'чотири свідчення в каруселі');
  assert.equal(Object.keys(home.nav).length, 9, 'девʼять пунктів меню');
});

test('заголовок героя зберігає свою розмітку', () => {
  const home = readSingleton('homepage');

  // hero.title містить <em> і <br>. Якби ми зберігали текст, а не розмітку,
  // заголовок головної втратив би курсив і перенос — тобто змінив вигляд.
  assert.equal(home.hero.title.uk, 'Церква <em>«Дім Хліба»</em><br>Кривий Ріг');
  assert.equal(home.hero.title.en, 'House of Bread Church<br><em>Kryvyi Rih</em>');
  assert.equal(home.donate.ref.uk, '2 Коринтян 9:6–7');
});

test('адреса продубльована на головній: контакти й підвал показують різний текст', () => {
  const home = readSingleton('homepage');

  // con.addr трапляється на index.html двічі з РІЗНИМ українським текстом:
  // у секції контактів (з друкарською помилкою «Караманиць») і в підвалі
  // (без неї). readPageStrings бере перше входження (контакти) для
  // contacts.addr, тому підвальний варіант заведений окремим полем footer.addr.
  assert.equal(
    home.contacts.addr.uk,
    'Кривий Ріг, вул. Федора Караманиць, 33 (Ватутіна)',
  );
  assert.equal(home.footer.addr.uk, 'вул. Федора Караманиця, 33');
});

test('картинки головної мають місце в даних: фото героя і три новинні', () => {
  const home = readSingleton('homepage');

  // Живий фон героя — <picture> з окремим джерелом для мобільних. alt у
  // легасі лише український; англійського немає ніде, тому це рядок, як і
  // alt у media[] колекцій, а не вигадана пара {uk, en}.
  assert.deepEqual(home.heroImage, {
    src: 'uploads/hero-cross.jpg',
    mobileSrc: 'uploads/hero-cross-mobile.jpg',
    alt: 'Підсвічений синім хрест у храмі',
  });

  // Новинні картинки в легасі мають alt="" — вони декоративні, заголовок
  // картки поруч. Порожній alt тут — дані, а не забутий опис.
  assert.deepEqual(home.news.items.map((item) => item.image), [
    { src: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80', alt: '' },
    { src: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=800&q=80', alt: '' },
    { src: 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?auto=format&fit=crop&w=800&q=80', alt: '' },
  ]);
});

test('кожне поле головної двомовне й непорожнє', () => {
  for (const [path, pair] of localizedPairs(readSingleton('homepage'))) {
    assert.ok(pair.uk.trim().length > 0, `homepage${path}: порожня uk`);
    assert.ok(String(pair.en).trim().length > 0, `homepage${path}: порожня en`);
  }
});

test('дев’ять сторінок мають запис: шість перенесених і три нові порожні', () => {
  const pages = JSON.parse(readFileSync(contentDir('singletons/pages.json'), 'utf8'));

  assert.deepEqual(Object.keys(pages).sort(), [
    'about', 'churches', 'contacts', 'donate', 'leaders',
    'ministries', 'pastors', 'projects', 'testimonies',
  ]);

  for (const slug of ['churches', 'ministries', 'projects', 'testimonies', 'pastors', 'leaders']) {
    assert.ok(pages[slug].lead.uk.trim().length > 0, `${slug}: перенесена сторінка без ліду`);
  }
  for (const slug of ['about', 'contacts', 'donate']) {
    // Проза цих сторінок — робота замовника. Явний null означає «ще немає»,
    // а вигаданий текст мовчки поїхав би в ефір як справжній.
    assert.equal(pages[slug].body, null, `${slug}: у нової сторінки зʼявився вигаданий текст`);
    assert.ok(pages[slug].title.uk.trim().length > 0, `${slug}: без заголовка`);
  }
});

test('uk.json і en.json мають однаковий набір ключів', () => {
  const flatten = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === 'string' ? [`${prefix}${k}`] : flatten(v, `${prefix}${k}.`));

  const uk = flatten(JSON.parse(readFileSync(
    fileURLToPath(new URL('../src/i18n/uk.json', import.meta.url)), 'utf8')));
  const en = flatten(JSON.parse(readFileSync(
    fileURLToPath(new URL('../src/i18n/en.json', import.meta.url)), 'utf8')));

  // Розбіжність означає, що на англійській сторінці підпис кнопки
  // просто зникне — і помітить це вже відвідувач, а не збірка.
  assert.deepEqual(uk.sort(), en.sort());
});

test('кожне значення в uk.json і en.json — непорожній рядок', () => {
  // Словники не проходять через схему Astro, тож порожній рядок чи null
  // тут ніхто б не зловив — кнопка просто стала б безіменною.
  const leaves = (obj, prefix = '') =>
    Object.entries(obj).flatMap(([k, v]) =>
      v !== null && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]);

  for (const locale of ['uk', 'en']) {
    const dict = JSON.parse(readFileSync(
      fileURLToPath(new URL(`../src/i18n/${locale}.json`, import.meta.url)), 'utf8'));
    for (const [key, value] of leaves(dict)) {
      assert.equal(typeof value, 'string', `${locale}.json ${key}: не рядок`);
      assert.ok(value.trim().length > 0, `${locale}.json ${key}: порожній рядок`);
    }
  }
});

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
