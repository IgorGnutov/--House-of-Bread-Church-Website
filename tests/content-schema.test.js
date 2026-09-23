import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withBuild } from './helpers/build.js';
import {
  documentResource, image, linkResource, ministry, project, video, videoTestimony,
} from './helpers/probes.js';

// Схема — контракт з адмінкою: зламаний запис мусить валити збірку в
// схемі, з назвою поля в повідомленні, а не падінням посеред шаблону.
// Кожна проба — окрема збірка з тимчасової копії контенту (helpers/build.js),
// справжній src/content не чіпається.
const T = { timeout: 180_000 };
const buildWithEntry = (collection, name, data) =>
  withBuild((content) => content.write(collection, name, data), (result) => result);

const expectFailure = (collection, data, pattern, why) => {
  const { failed, output } = buildWithEntry(collection, 'probe', data);
  assert.equal(failed, true, why);
  assert.match(output, pattern, `у помилці не пояснено причину:\n${output.slice(-2000)}`);
};

test('коректний запис збірку не ламає — і голий YouTube-ID у галереї теж', T, () => {
  // Спека 1: video src приймає URL або 11-символьний ID. Схема не сміє
  // звужувати до URL.
  const { failed, output } = buildWithEntry('ministries', 'probe', ministry('probe', { media: [image('a'), video('ScMzIvxBSi4')] }));
  assert.equal(failed, false, `валідний запис завалив збірку:\n${output}`);
});

test('невідома іконка валить збірку', T, () => {
  expectFailure('ministries', ministry('probe', { icon: 'rocket' }), /icon/i, 'збірка пройшла з іконкою поза списком');
});

test('відсутній slug валить збірку', T, () => {
  const { slug, ...withoutSlug } = ministry('probe');
  expectFailure('ministries', withoutSlug, /slug/i, 'збірка пройшла без slug');
});

test('slug не у форматі URL (великі літери, пробіл) валить збірку', T, () => {
  // slug стає адресою сторінки: «Youth Camp» дав би /ministries/Youth Camp/.
  expectFailure('ministries', ministry('Youth Camp'), /малі латинські/, 'збірка пройшла з slug «Youth Camp»');
});

test('два записи з однаковим slug валять збірку з назвами обох', T, () => {
  // Раніше glob-завантажувач мовчки зливав їх в один запис — одне служіння
  // просто зникало з сайту.
  const { failed, output } = withBuild((content) => {
    content.write('ministries', 'probe-a', ministry('probe-twin'));
    content.write('ministries', 'probe-b', ministry('probe-twin'));
  }, (result) => result);
  assert.equal(failed, true, 'збірка пройшла з дублікатом slug');
  assert.match(output, /probe-twin/);
  assert.match(output, /probe-a/);
  assert.match(output, /probe-b/);
});

test('порожній alt у галереї валить збірку', T, () => {
  expectFailure('ministries', ministry('probe', { media: [{ ...image('a'), alt: '' }] }), /alt/i, 'збірка пройшла з картинкою без опису');
});

test('порожня галерея валить збірку з поясненням', T, () => {
  // Свідоме правило схеми: дизайн картки й деталки без жодного фото не має.
  expectFailure('ministries', ministry('probe', { media: [] }), /хоча б одне фото/, 'збірка пройшла без жодного медіа');
});

test('відео не з YouTube у галереї валить збірку в схемі', T, () => {
  expectFailure('ministries', ministry('probe', { media: [image('a'), { ...video(), src: 'https://vimeo.com/123' }] }), /YouTube/, 'збірка пройшла з відео Vimeo');
});

test('відеосвідчення не з YouTube валить збірку в схемі', T, () => {
  expectFailure('testimonies', videoTestimony('probe', { videoUrl: 'https://vimeo.com/123' }), /videoUrl/, 'збірка пройшла з відеосвідченням Vimeo');
});

test('невідомий ключ (одруківка в назві поля) валить збірку', T, () => {
  // Без .strict() zod мовчки викинув би "sumary", і збірка пройшла б
  // зі справжнім summary — одруківку ніхто б не помітив.
  const probe = ministry('probe');
  expectFailure('ministries', { ...probe, sumary: probe.summary }, /sumary/, 'збірка пройшла з невідомим ключем');
});

test('локалізоване поле без англійської валить збірку', T, () => {
  const { failed } = buildWithEntry('ministries', 'probe', ministry('probe', { name: { uk: 'Тест', en: '' } }));
  assert.equal(failed, true, 'збірка пройшла з порожнім перекладом');
});

test('посилання для лідерів без іконки валить збірку', T, () => {
  expectFailure('leader-resources', linkResource('probe', { icon: null }), /icon/, 'збірка пройшла з посиланням без іконки');
});

test('документ для лідерів без формату валить збірку', T, () => {
  // Формат — і є значок документа; раніше це падало на d.format!.toUpperCase().
  expectFailure('leader-resources', documentResource('probe', { format: null }), /format/, 'збірка пройшла з документом без формату');
});

test('відносний ctaUrl у стилі легасі валить збірку', T, () => {
  expectFailure('projects', project('probe', { ctaUrl: 'index.html#contacts' }), /ctaUrl/, 'збірка пройшла з index.html#contacts');
});

test('неіснуюча календарна дата проєкту валить збірку', T, () => {
  expectFailure('projects', project('probe', { date: '2026-02-30' }), /дати не існує/, 'збірка пройшла з 30 лютого');
});

test('видалений запис сторінки валить збірку з назвою сторінки', T, () => {
  // Маршрути сторінок — у коді; без запису в pages.json шаблон раніше падав
  // на «Cannot read properties of undefined».
  const { failed, output } = withBuild(
    (content) => content.editSingleton('pages', (pages) => { delete pages.ministries; }),
    (result) => result,
  );
  assert.equal(failed, true, 'збірка пройшла без pages.ministries');
  assert.match(output, /pages\.json: бракує записів «ministries»/);
});

test('видалений підпис головної валить збірку в схемі, а не в шаблоні', T, () => {
  const { failed, output } = withBuild(
    (content) => content.editSingleton('homepage', (file) => { delete file.main.nav.home; }),
    (result) => result,
  );
  assert.equal(failed, true, 'збірка пройшла без nav.home');
  assert.match(output, /nav/);
  assert.doesNotMatch(output, /немає перекладу/, 'помилка з шаблону (pick), а не зі схеми');
});

test('розмітка в текстовому полі валить збірку в схемі', T, () => {
  // Шаблон виводить поле як простий текст — <b> зʼявився б на сторінці
  // буквально. HTML дозволений лише в homepage.hero.title (його в справжньому
  // контенті вже перевіряє кожна збірка).
  expectFailure('ministries', ministry('probe', { summary: { uk: 'Дуже <b>важливо</b>', en: 'Important' } }), /розмітка/, 'збірка пройшла з <b> у summary');
});

test('текст із самих пробілів валить збірку — і в перекладі, і в alt', T, () => {
  expectFailure('ministries', ministry('probe', { name: { uk: '   ', en: 'Test' } }), /пробілів/, 'збірка пройшла з назвою з пробілів');
  expectFailure('ministries', ministry('probe', { media: [{ ...image('a'), alt: '  ' }] }), /пробілів/, 'збірка пройшла з alt з пробілів');
});

test('заглушка «#» замість адреси ресурсу валить збірку', T, () => {
  // «#» не відрізнити від справжньої адреси — картка тихо вела б у нікуди; «ще немає» — це null.
  expectFailure('leader-resources', documentResource('probe', { url: '#' }), /заглушка/, 'збірка пройшла з url «#»');
});

test('телефон не з цифр валить збірку', T, () => {
  // tel: будується з цифр поля: з «abc» вийшло б порожнє посилання.
  expectFailure('ministries', ministry('probe', { phone: 'дзвоніть' }), /телефон/, 'збірка пройшла з телефоном «дзвоніть»');
  expectFailure('ministries', ministry('probe', { phone: '12-34' }), /7 цифр/, 'збірка пройшла з 4 цифрами');
});

test('одруківка в ключі підписів секцій сторінки валить збірку', T, () => {
  // З record заголовок «past_tilte» мовчки зник би зі сторінки пасторів.
  const { failed, output } = withBuild(
    (content) => content.editSingleton('pages', (pages) => { pages.pastors.sections.past_tilte = pages.pastors.sections.past_title; }),
    (result) => result,
  );
  assert.equal(failed, true, 'збірка пройшла з sections.past_tilte');
  assert.match(output, /past_tilte/);
});
