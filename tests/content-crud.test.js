import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_PATH } from '../astro.config.mjs';
import { withBuild } from './helpers/build.js';
import { findBrokenLinks } from './helpers/links.js';
import {
  church, documentResource, ministry, person, project, video, videoTestimony,
} from './helpers/probes.js';
import { ytThumb } from '../src/lib/youtube.mjs';

// Контракт з адмінкою: будь-який набір даних, який пропускає схема, мусить
// збиратися без битих посилань і без «порожніх» блоків. Дві збірки
// покривають крайні випадки пачкою (кожна збірка коштує секунди):
// усе спорожнене — і по одному запису з дірками й дублікатами в order.
const T = { timeout: 180_000 };
const COLLECTIONS = ['ministries', 'churches', 'projects', 'testimonies', 'pastors', 'leader-resources'];
const OPTIONAL_PAGE_FIELDS = ['eyebrow', 'lead', 'heroTag', 'sections', 'help'];
const LOCALES = [['uk', ''], ['en', 'en/']];

const assertBuilt = ({ failed, output }) => assert.equal(failed, false, `збірка впала на валідних даних:\n${output.slice(-3000)}`);
const detailPages = (outDir, prefix, section) => {
  const dir = join(outDir, prefix, section);
  return existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
};

test('усі колекції й повторювані блоки порожні, необовʼязкові поля сторінок прибрані — сайт збирається без порожніх блоків', T, () => {
  withBuild((content) => {
    for (const name of COLLECTIONS) content.clear(name);
    content.editSingleton('homepage', ({ main }) => {
      main.beliefs = [];
      main.news.items = [];
      main.wwb.items = [];
      main.testimonies.items = [];
    });
    content.editSingleton('donate-settings', ({ main }) => { main.calcIncrements = []; });
    content.editSingleton('pages', (pages) => {
      for (const page of Object.values(pages)) for (const field of OPTIONAL_PAGE_FIELDS) delete page[field];
    });
  }, (result) => {
    assertBuilt(result);
    const { outDir, page } = result;
    assert.deepEqual(findBrokenLinks(outDir, BASE_PATH), []);

    for (const [lang, prefix] of LOCALES) {
      for (const section of ['ministries', 'churches', 'projects']) {
        assert.deepEqual(detailPages(outDir, prefix, section), [], `${lang}: детальні сторінки ${section} без записів`);
      }
      // Списки існують (на них ведуть меню й кнопки), але без порожньої сітки.
      const ministries = page(`${prefix}ministries/index.html`);
      assert.equal(ministries.querySelector('.min-grid'), null, `${lang}: порожня сітка служінь`);
      assert.equal(ministries.querySelector('.page-hero .eyebrow'), null, `${lang}: надзаголовок без даних`);
      assert.equal(ministries.querySelector('.page-hero h1').text.length > 0, true);
      assert.equal(page(`${prefix}churches/index.html`).querySelector('.church-grid'), null, `${lang}: порожня сітка церков`);
      assert.equal(page(`${prefix}projects/index.html`).querySelector('.project-grid'), null, `${lang}: порожня сітка проєктів`);
      assert.equal(page(`${prefix}projects/index.html`).querySelector('.hero-tag'), null, `${lang}: тег героя без даних`);
      assert.equal(page(`${prefix}testimonies/index.html`).querySelector('.tst-grid'), null, `${lang}: порожня сітка свідчень`);

      const pastors = page(`${prefix}pastors/index.html`);
      assert.equal(pastors.querySelector('.pastor-grid'), null, `${lang}: порожня сітка пасторів`);
      assert.equal(pastors.querySelector('.elder-grid'), null, `${lang}: порожня сітка пресвітерів`);
      assert.equal(pastors.querySelector('.help'), null, `${lang}: блок допомоги без даних`);

      const leaders = page(`${prefix}leaders/index.html`);
      assert.equal(leaders.querySelector('.doc-list'), null, `${lang}: порожній список документів`);
      assert.equal(leaders.querySelector('.res-grid'), null, `${lang}: порожня сітка посилань`);
      assert.equal(leaders.querySelector('.locked'), null, `${lang}: підпис секції без даних`);

      const home = page(`${prefix}index.html`);
      for (const selector of ['.beliefs-list', '.news-grid', '.believe-grid', '[data-tst-track]', '.tst-ctrls', '#ministries .min-grid', '#pastors .pastor-grid', '.hero-donate-quick']) {
        assert.equal(home.querySelector(selector), null, `${lang}: головна показує порожній блок ${selector}`);
      }
      // Секції з якорями лишаються: на них ведуть меню й «назад» з підсторінок.
      for (const id of ['about', 'media', 'testimonies', 'ministries', 'pastors']) {
        assert.ok(home.querySelector(`#${id}`), `${lang}: зник якір #${id}`);
      }
    }
    // Лічильник рахується з даних, з правильною формою множини.
    assert.equal(page('ministries/index.html').querySelector('.hero-count span').text, '0 напрямків служіння');
    assert.equal(page('en/churches/index.html').querySelector('.hero-count span').text, '0 churches in the union');
  });
});

test('по одному запису, дірки й дублікати в order, без необовʼязкових полів — сайт збирається коректно', T, () => {
  withBuild((content) => {
    for (const name of COLLECTIONS) content.clear(name);
    // Одне служіння з одним фото: без «інших служінь» і без навігації галереї.
    content.write('ministries', 'solo', ministry('solo-ministry', { order: 42 }));
    // Дві церкви з однаковим order, файли в «неправильному» порядку:
    // порядок — за slug, «Головна» — перша після сортування, а не order 0.
    content.write('churches', 'first-file', church('zeta-church', { order: 5 }));
    content.write('churches', 'second-file', church('alpha-church', { order: 5 }));
    // Проєкт лише з відео: без прогресу, CTA і показників.
    content.write('projects', 'solo', project('video-only', { order: 7, media: [video()] }));
    content.write('testimonies', 'solo', videoTestimony('solo-video', { order: 3 }));
    // Лише пресвітери, order з дірками — секція пасторів зникає.
    content.write('pastors', 'late', person('late-elder', 'elder', { order: 10 }));
    content.write('pastors', 'early', person('early-elder', 'elder', { order: 3 }));
    content.write('leader-resources', 'doc', documentResource('only-doc', { url: 'https://example.test/doc.pdf' }));
    content.editSingleton('homepage', ({ main }) => {
      main.beliefs = main.beliefs.slice(0, 1);
      main.news.items = main.news.items.slice(0, 1);
      main.wwb.items = main.wwb.items.slice(0, 1);
      main.testimonies.items = [];
    });
    // Адреса карти без «?» — параметр embed має додатися через «?».
    content.editSingleton('contact-info', ({ main }) => { main.mapUrl = 'https://maps.example.test/place'; });
  }, (result) => {
    assertBuilt(result);
    const { outDir, page } = result;
    assert.deepEqual(findBrokenLinks(outDir, BASE_PATH), []);

    for (const [lang, prefix] of LOCALES) {
      const ministryPage = page(`${prefix}ministries/solo-ministry/index.html`);
      assert.equal(ministryPage.querySelectorAll('[data-slide]').length, 1);
      for (const selector of ['[data-prev]', '[data-next]', '.dots', '.thumbs', 'section.more']) {
        assert.equal(ministryPage.querySelector(selector), null, `${lang}: ${selector} при одному служінні / одному фото`);
      }

      const churches = page(`${prefix}churches/index.html`).querySelectorAll('.church-card');
      assert.deepEqual(churches.map((c) => c.getAttribute('href')), [
        `${BASE_PATH}${prefix}churches/alpha-church/`, `${BASE_PATH}${prefix}churches/zeta-church/`,
      ]);
      assert.deepEqual(churches.map((c) => c.querySelector('.badge').classList.contains('main')), [true, false]);
      const others = page(`${prefix}churches/zeta-church/index.html`).querySelectorAll('.more-card');
      assert.deepEqual(others.map((a) => a.getAttribute('href')), [`${BASE_PATH}${prefix}churches/alpha-church/`]);

      const projectPage = page(`${prefix}projects/video-only/index.html`);
      for (const selector of ['.stats', '.info-progress', '.info .btn', 'section.more', '[data-prev]']) {
        assert.equal(projectPage.querySelector(selector), null, `${lang}: ${selector} у проєкті без даних для нього`);
      }
      const card = page(`${prefix}projects/index.html`).querySelector('.project-card');
      // Обкладинка галереї з одних відео — мініатюра YouTube.
      assert.equal(card.querySelector('.project-thumb img').getAttribute('src'), ytThumb('ScMzIvxBSi4'));
      assert.ok(card.querySelector('.vflag'));

      const home = page(`${prefix}index.html`);
      assert.equal(home.querySelectorAll('[data-tst-track] .tst-card').length, 1);
      assert.equal(home.querySelector('.tst-ctrls'), null, `${lang}: кнопки гортання для однієї картки`);
      assert.equal(home.querySelectorAll('#ministries .min-card').length, 1);
      assert.equal(home.querySelector('#pastors .pastor-grid'), null);
      assert.deepEqual(home.querySelectorAll('.believe-item .n').map((n) => n.text), ['01']);
      assert.equal(home.querySelector('.map-wrap iframe').getAttribute('src'), 'https://maps.example.test/place?output=embed');

      const pastors = page(`${prefix}pastors/index.html`);
      assert.equal(pastors.querySelector('.pastor-grid'), null);
      assert.deepEqual(pastors.querySelectorAll('.elder-card h3').map((h) => h.text), ['Проба early-elder', 'Проба late-elder']);

      const leaders = page(`${prefix}leaders/index.html`);
      assert.equal(leaders.querySelectorAll('.doc-card').length, 1);
      assert.equal(leaders.querySelector('.doc-meta'), null, `${lang}: підпис документа без даних`);
      assert.equal(leaders.querySelector('.res-grid'), null);
    }
    assert.equal(page('ministries/index.html').querySelector('.hero-count span').text, '1 напрям служіння');
    assert.equal(page('en/ministries/index.html').querySelector('.hero-count span').text, '1 ministry area');
    assert.equal(page('churches/index.html').querySelector('.hero-count span').text, '2 церкви в об’єднанні');
    assert.equal(page('leaders/index.html').querySelector('.count').text, '1 файл');
    assert.equal(page('en/leaders/index.html').querySelector('.count').text, '1 file');
  });
});
