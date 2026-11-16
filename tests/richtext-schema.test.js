import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizedRich, localizedRichInline, localizedRichCard } from '../src/lib/schema.mjs';
import { FULL_DOC } from './helpers/richtext-full.js';

const text = (t, marks) => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const para = (...content) => ({ type: 'paragraph', content });
const doc = (...content) => ({ type: 'doc', content });
const linkDoc = (href, linktype = 'url') => doc(para(text('x', [{ type: 'link', attrs: { href, linktype } }])));
const GOOD_EN = doc(para(text('ok')));

// Перша помилка поля uk: повідомлення й шлях (разом із ключем поля).
function issue(schema, value) {
  const r = schema.safeParse({ uk: value, en: GOOD_EN });
  assert.equal(r.success, false, 'очікувалась помилка');
  const first = r.error.issues[0];
  return { message: first.message, path: first.path.join('.') };
}
const ok = (schema, value) => schema.safeParse({ uk: value, en: GOOD_EN }).success;

test('основний текст приймає все дозволене', () => {
  const levels = [[localizedRich, 'rich'], [localizedRichInline, 'inline'], [localizedRichCard, 'card']];
  for (const [schema, level] of levels) {
    const r = schema.safeParse({ uk: FULL_DOC[level]('uk'), en: FULL_DOC[level]('en') });
    assert.ok(r.success, level + ': ' + JSON.stringify(r.error?.issues));
  }
});

test('inline відкидає блоки, card — ще й посилання та якорі', () => {
  assert.match(issue(localizedRichInline, FULL_DOC.rich('uk')).message, /лише в основному тексті/);
  assert.match(issue(localizedRichCard, FULL_DOC.inline('uk')).message, /картки-посилання/);
});

test('вставка з Word: колір, виділення, вирівнювання названо', () => {
  const colored = (type) => doc(para(text('x', [{ type, attrs: { color: '#f00' } }])));
  for (const type of ['textStyle', 'highlight', 'styled']) {
    assert.match(issue(localizedRich, colored(type)).message, /колір/);
  }
  const aligned = doc({ type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('x')] });
  assert.match(issue(localizedRich, aligned).message, /вирівнювання/);
  const cell = doc({
    type: 'table',
    content: [{
      type: 'tableRow',
      content: [{ type: 'tableCell', attrs: { backgroundColor: '#eee' }, content: [para(text('x'))] }],
    }],
  });
  assert.match(issue(localizedRich, cell).message, /колір/);
});

test('заголовок рівня 1, вставний блок, невідомий вузол — названо', () => {
  const h1 = doc({ type: 'heading', attrs: { level: 1 }, content: [text('x')] });
  assert.match(issue(localizedRich, h1).message, /рівні 2–6/);
  assert.match(issue(localizedRich, doc({ type: 'blok', attrs: { body: [] } })).message, /вставні блоки/);
  assert.match(issue(localizedRich, doc(para({ type: 'mention' }))).message, /елемент «mention» тут не підтримується/);
  assert.match(issue(localizedRich, doc(para(text('x', [{ type: 'strange' }])))).message, /елемент «strange»/);
});

test('посилання: лише linkUrl, шлях до href', () => {
  for (const href of ['javascript:alert(1)', '#', '//evil.test', 'index.html']) {
    const i = issue(localizedRich, linkDoc(href));
    assert.match(i.message, /посилання/);
    assert.equal(i.path, 'uk.content.0.content.0.marks.0.attrs.href');
  }
  assert.match(issue(localizedRich, linkDoc('https://a.test/', 'story')).message, /невідомий тип посилання «story»/);
  const anchor = (id) => doc(para(text('x', [{ type: 'anchor', attrs: { id } }])));
  assert.match(issue(localizedRich, anchor('Bad Id')).message, /якір/);
  assert.ok(ok(localizedRich, anchor('good-id-1')));
});

test('картинка: без alt і з чужою схемою адреси — помилка', () => {
  const img = (attrs) => doc({ type: 'image', attrs });
  assert.match(issue(localizedRich, img({ src: 'https://x.test/a.jpg', alt: '' })).message, /опису/);
  assert.match(issue(localizedRich, img({ src: 'ftp://x', alt: 'a' })).message, /картинка/);
});

test('структура: код і таблиця', () => {
  const code = doc({ type: 'code_block', content: [text('x', [{ type: 'bold' }])] });
  assert.match(issue(localizedRich, code).message, /блок коду/);
  assert.match(issue(localizedRich, doc({ type: 'table', content: [para(text('x'))] })).message, /таблиця/);
});

test('зайве поле — помилка з назвою поля', () => {
  const stale = doc({ type: 'paragraph', attrs: { textAlign: null }, content: [text('x')] });
  assert.match(issue(localizedRich, stale).message, /зайве поле «textAlign»|зайве поле «attrs»/);
  const mark = doc(para(text('x', [{ type: 'bold', attrs: { a: 1 } }])));
  assert.match(issue(localizedRich, mark).message, /зайве поле «attrs»/);
});

test('порожньо — як для простого тексту', () => {
  for (const v of [doc(), doc(para(text('   '))), '', undefined]) {
    assert.match(issue(localizedRich, v).message, v === undefined ? /обовʼязкове/ : /не може бути порожнім/);
  }
  const missing = localizedRich.safeParse({ uk: doc(para(text('a'))) });
  assert.equal(missing.error.issues[0].path.join('.'), 'en');
  assert.ok(ok(localizedRich, doc({ type: 'image', attrs: { src: 'uploads/logo.png', alt: 'Лого' } })));
});

test('рядок старої моделі — не документ', () => {
  assert.match(issue(localizedRich, 'Просто рядок').message, /форматований текст/);
});

test('пробіловий текстовий вузол між розміченими — дозволений', () => {
  const d = doc(para(text('a', [{ type: 'bold' }]), text(' '), text('b', [{ type: 'italic' }])));
  assert.ok(ok(localizedRich, d));
  assert.match(issue(localizedRich, doc(para(text('   ')))).message, /не може бути порожнім/);
  assert.match(issue(localizedRich, doc(para(text('')))).message, /не може бути порожнім/);
});

test('блок коду: клас лише language-…', () => {
  const code = (attrs) => doc({ type: 'code_block', attrs, content: [text('x')] });
  assert.ok(ok(localizedRich, code({ class: 'language-js' })));
  const i = issue(localizedRich, code({ class: 'x" onclick' }));
  assert.equal(i.path, 'uk.content.0.attrs.class');
});

test('типи атрибутів: order, colspan, rowspan, emoji, title', () => {
  const list = (order) => doc({ type: 'ordered_list', attrs: { order }, content: [{ type: 'list_item', content: [para(text('x'))] }] });
  assert.equal(issue(localizedRich, list('1" onclick="x')).path, 'uk.content.0.attrs.order');
  assert.equal(issue(localizedRich, list(0)).path, 'uk.content.0.attrs.order');
  assert.ok(ok(localizedRich, list(3)));
  const cell = (attrs) => doc({
    type: 'table',
    content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs, content: [para(text('x'))] }] }],
  });
  assert.equal(issue(localizedRich, cell({ colspan: '"><script>' })).path, 'uk.content.0.content.0.content.0.attrs.colspan');
  assert.equal(issue(localizedRich, cell({ rowspan: 1.5 })).path, 'uk.content.0.content.0.content.0.attrs.rowspan');
  assert.ok(ok(localizedRich, cell({ colspan: 2, rowspan: 2 })));
  const emoji = (attrs) => doc(para({ type: 'emoji', ...(attrs ? { attrs } : {}) }));
  assert.equal(issue(localizedRich, emoji({ emoji: { x: 1 } })).path, 'uk.content.0.content.0.attrs.emoji');
  assert.equal(issue(localizedRich, emoji(undefined)).path, 'uk.content.0.content.0.attrs.emoji');
  const img = (title) => doc({ type: 'image', attrs: { src: 'uploads/logo.png', alt: 'a', title } });
  assert.equal(issue(localizedRich, img({})).path, 'uk.content.0.attrs.title');
  assert.ok(ok(localizedRich, img('Підпис')));
});
