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
    ['leader-resources', 'doc', documentResource('doc', { url: 'https://drive.google.com/file/d/probe/view', meta: pair('PDF · 2 сторінки') })],
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
  // Проба з відносним шляхом, а не справжні дані сайту: редактор може
  // будь-коли замінити logo на https://…, і гілка медіатеки перестала б
  // перевірятися — тест мовчки пропускав би свою половину (CLAUDE.md:
  // тест не сміє залежати від поточних даних).
  const settings = { ...readSingleton('site-settings'), logo: { uk: 'uploads/probe.png', en: 'uploads/probe-en.png' } };
  assert.throws(() => toStory('site-settings', 's', settings), /медіатек/, 'відносний шлях без резолвера мусить падати');
  const story = toStory('site-settings', 'site-settings', settings, { asset });
  const logo = story.content.logo_uk;
  assert.equal(logo.fieldtype, 'asset');
  assert.equal(logo.id, 1);
  assert.equal(logo.is_external_url, false);
  assert.equal(fromStory('site-settings', story, { assetPath }).logo.uk, 'uploads/probe.png');
  const ext = toStory('pastors', 'p', person('p', 'elder'), { asset }).content.photo;
  assert.equal(ext.is_external_url, true);
  assert.equal(ext.id, null);
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
