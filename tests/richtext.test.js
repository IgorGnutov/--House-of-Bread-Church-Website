import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDoc,
  docFromText,
  normalizeDoc,
  isEmptyDoc,
  richPlain,
  mapImages,
} from '../src/lib/richtext.mjs';

const text = (t, marks) => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const para = (...content) => ({ type: 'paragraph', content });
const doc = (...content) => ({ type: 'doc', content });

test('docFromText: абзаци — через порожній рядок, перенос — hard_break', () => {
  assert.deepEqual(docFromText('Перший.\n\nДругий\nрядок.'), doc(
    para(text('Перший.')),
    para(text('Другий'), { type: 'hard_break' }, text('рядок.')),
  ));
  assert.deepEqual(docFromText('  \n\n '), { type: 'doc', content: [] });
});

test('isDoc розрізняє документ і все інше', () => {
  assert.equal(isDoc({ type: 'doc', content: [] }), true);
  for (const v of ['', 'doc', null, undefined, [], { type: 'paragraph' }]) {
    assert.equal(isDoc(v), false);
  }
});

test('normalizeDoc прибирає атрибути редактора Storyblok', () => {
  const input = doc(
    { type: 'heading', attrs: { level: 3, textAlign: null }, content: [text('Заголовок')] },
    {
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [
        text('сайт', [{
          type: 'link',
          attrs: { href: 'https://example.test', uuid: null, anchor: null, target: '_blank', linktype: 'url', custom: {} },
        }]),
        text('пошта', [{ type: 'link', attrs: { href: 'a@b.test', linktype: 'email', target: '_self' } }]),
        text('жирний', [{ type: 'bold', attrs: {} }]),
      ],
    },
    { type: 'ordered_list', attrs: { order: 1 }, content: [] },
    {
      type: 'image',
      attrs: {
        id: 5, src: 'https://a.storyblok.com/f/1/x.jpg', alt: 'Опис', title: '', copyright: '', source: '', meta_data: {},
      },
    },
    {
      type: 'table',
      content: [{
        type: 'tableRow',
        content: [{
          type: 'tableCell',
          attrs: { colspan: 1, rowspan: 1, colwidth: null, backgroundColor: null },
          content: [para(text('x'))],
        }],
      }],
    },
  );
  assert.deepEqual(normalizeDoc(input), doc(
    { type: 'heading', attrs: { level: 3 }, content: [text('Заголовок')] },
    para(
      text('сайт', [{ type: 'link', attrs: { href: 'https://example.test', linktype: 'url' } }]),
      text('пошта', [{ type: 'link', attrs: { href: 'mailto:a@b.test', linktype: 'email' } }]),
      text('жирний', [{ type: 'bold' }]),
    ),
    { type: 'ordered_list', content: [] },
    { type: 'image', attrs: { src: 'https://a.storyblok.com/f/1/x.jpg', alt: 'Опис' } },
    {
      type: 'table',
      content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [para(text('x'))] }] }],
    },
  ));
});

test('normalizeDoc: вставка з Word — порожній textStyle зникає, колір і центр лишаються для схеми', () => {
  const out = normalizeDoc(doc(
    { type: 'paragraph', attrs: { textAlign: 'center' }, content: [
      text('а', [{ type: 'textStyle', attrs: { color: null } }]),
      text('б', [{ type: 'textStyle', attrs: { color: '#ff0000' } }]),
    ] },
  ));
  const [a, b] = out.content[0].content;
  assert.equal(a.marks, undefined);
  assert.deepEqual(b.marks, [{ type: 'textStyle', attrs: { color: '#ff0000' } }]);
  assert.deepEqual(out.content[0].attrs, { textAlign: 'center' });
});

test('normalizeDoc: посилання на історію — шлях за uuid, з якорем', () => {
  const resolveStory = (u) => ({ a1: '/ministries/youth/' })[u] ?? null;
  const out = normalizeDoc(doc(para(text('молодь', [{
    type: 'link',
    attrs: { linktype: 'story', uuid: 'a1', anchor: 'team', href: 'ministries/old-slug' },
  }]))), { resolveStory });
  assert.deepEqual(out.content[0].content[0].marks, [
    { type: 'link', attrs: { href: '/ministries/youth/#team', linktype: 'url' } },
  ]);
});

test('normalizeDoc: невідома історія — текст без посилання й попередження', () => {
  const warnings = [];
  const out = normalizeDoc(doc(para(text('Зниклий', [
    { type: 'bold' },
    { type: 'link', attrs: { linktype: 'story', uuid: 'zz', href: '' } },
  ]))), { resolveStory: () => null, warn: (m) => warnings.push(m) });
  assert.deepEqual(out.content[0].content[0].marks, [{ type: 'bold' }]);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('Зниклий') && warnings[0].includes('zz'), warnings[0]);
});

test('normalizeDoc: порожні абзаци на краях зникають, посередині лишаються', () => {
  const out = normalizeDoc(doc(
    { type: 'paragraph' },
    para(text('а')),
    { type: 'paragraph' },
    para(text('б')),
    para({ type: 'hard_break' }),
  ));
  assert.deepEqual(out.content.map((b) => b.type), ['paragraph', 'paragraph', 'paragraph']);
  assert.equal(out.content[0].content[0].text, 'а');
  assert.equal(out.content[2].content[0].text, 'б');

  const onlyEmpty = normalizeDoc(doc({ type: 'paragraph' }, para()));
  assert.deepEqual(onlyEmpty, { type: 'doc', content: [] });
  assert.equal(isEmptyDoc(onlyEmpty), true);
  assert.equal(isEmptyDoc(doc(para(text('x')))), false);
  assert.equal(isEmptyDoc(doc(para({ type: 'image', attrs: { src: 'a.jpg', alt: 'x' } }))), false);
});

test('normalizeDoc: абзац лише з пробілів — порожній, на краях зникає, посередині лишається', () => {
  // випадковий пробіл на «порожньому» рядку не має подвоювати проміжок між абзацами
  const out = normalizeDoc(doc(para(text(' ')), para(text('а')), para(text('  ')), para(text('б')), para(text('   '))));
  assert.deepEqual(out.content.map((b) => b.content[0].text), ['а', '  ', 'б']);
  assert.equal(isEmptyDoc(doc(para(text(' ')))), true);
  assert.equal(isEmptyDoc(doc(para(text(' '), { type: 'image', attrs: { src: 'a.jpg', alt: 'x' } }))), false);
});

test('normalizeDoc не викидає невідоме', () => {
  const blok = { type: 'blok', attrs: { id: 'x', body: [{ component: 'foo' }] } };
  const out = normalizeDoc(doc(blok, para(text('а', [{ type: 'highlight', attrs: { color: '#ff0' } }]))));
  assert.deepEqual(out.content[0], blok);
  assert.deepEqual(out.content[1].content[0].marks, [{ type: 'highlight', attrs: { color: '#ff0' } }]);
});

test('normalizeDoc ідемпотентна, не-документ повертає як є', () => {
  const input = doc(
    { type: 'paragraph' },
    { type: 'heading', attrs: { level: 2, textAlign: null }, content: [text('З')] },
    para(text('а', [
      { type: 'link', attrs: { href: 'a@b.test', linktype: 'email', target: '_self' } },
      { type: 'textStyle', attrs: { color: null } },
    ])),
  );
  const once = normalizeDoc(input);
  assert.deepEqual(normalizeDoc(once), once);
  assert.equal(normalizeDoc(''), '');
  assert.equal(normalizeDoc(null), null);
});

test('richPlain: блоки через порожній рядок, картинки й код пропускаються', () => {
  const d = doc(
    { type: 'heading', attrs: { level: 2 }, content: [text('Заголовок')] },
    para(text('Жирний', [{ type: 'bold' }]), { type: 'hard_break' }, text(' і  далі')),
    { type: 'bullet_list', content: [{ type: 'list_item', content: [para(text('пункт'))] }] },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [para(text('клітинка'))] }] }] },
    { type: 'code_block', content: [text('const x = 1;')] },
    { type: 'image', attrs: { src: 'a.jpg', alt: 'x' } },
  );
  assert.equal(richPlain(d), 'Заголовок\n\nЖирний і далі\n\nпункт\n\nклітинка');
});

test('mapImages змінює attrs картинок на будь-якій глибині', () => {
  const input = doc({
    type: 'bullet_list',
    content: [{ type: 'list_item', content: [para({ type: 'image', attrs: { src: 'a.jpg', alt: 'x' } })] }],
  });
  const out = mapImages(input, (attrs) => ({ ...attrs, src: 'https://cdn.test/' + attrs.src }));
  assert.equal(out.content[0].content[0].content[0].content[0].attrs.src, 'https://cdn.test/a.jpg');
  assert.equal(input.content[0].content[0].content[0].content[0].attrs.src, 'a.jpg');
});

test('normalizeDoc: невідомий інлайн-вузол на краю документа не вважається порожнім', () => {
  const mention = { type: 'mention', attrs: { id: 'x' } };
  const out = normalizeDoc(doc(para(mention), para(text('а')), para(mention)));
  assert.equal(out.content.length, 3);
  assert.deepEqual(out.content[0].content, [mention]);
  assert.equal(isEmptyDoc(doc(para(mention))), false);
});
