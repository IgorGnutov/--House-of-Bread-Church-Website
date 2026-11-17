import { readContent } from '../../scripts/cms/content.mjs';
import { mapRichPairs } from '../../src/lib/storyblok/walk.mjs';

// Документи «з усім дозволеним» для кожного рівня richtext-поля. Ключ `key` робить якір і
// посилання на нього унікальними в межах сторінки: той самий ключ — посилання веде на якір
// у цьому ж документі, різні ключі в різних полях не дають дубльованих id.
const text = (t, marks) => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const para = (...content) => ({ type: 'paragraph', content });
const link = (href, linktype = 'url') => ({ type: 'link', attrs: { href, linktype } });

const MARKS = ['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', 'code'];

const marked = (lang) => MARKS.map((m) => text(`${m} ${lang}`, [{ type: m }]));

const inlineDoc = (lang, key) => ({
  type: 'doc',
  content: [
    para(
      text(`Абзац ${lang}, апостроф: м'яч`),
      { type: 'hard_break' },
      text('після переносу'),
      { type: 'emoji', attrs: { emoji: '🙂' } },
    ),
    para(...marked(lang)),
    para(
      text('до служіння', [link('/ministries/')]),
      text('сайт', [link('https://example.test/')]),
      text('пошта', [link('mailto:probe@example.test', 'email')]),
      text('файл', [link('uploads/logo.png', 'asset')]),
      text('донизу', [link(`#probe-${key}`)]),
      text('ціль', [{ type: 'anchor', attrs: { id: `probe-${key}` } }]),
    ),
  ],
});

const cardDoc = (lang) => ({
  type: 'doc',
  content: [
    para(text(`Картка ${lang}, апостроф: м'яч`), { type: 'hard_break' }, text('після переносу')),
    para(...marked(lang)),
  ],
});

const item = (...content) => ({ type: 'list_item', content });

const richDoc = (lang, key) => ({
  type: 'doc',
  content: [
    ...inlineDoc(lang, key).content,
    { type: 'heading', attrs: { level: 2 }, content: [text(`Заголовок 2 ${lang}`)] },
    { type: 'heading', attrs: { level: 6 }, content: [text(`Заголовок 6 ${lang}`)] },
    { type: 'bullet_list', content: [item(para(text('пункт')))] },
    {
      type: 'ordered_list',
      attrs: { order: 3 },
      content: [item(para(text('номер')), { type: 'bullet_list', content: [item(para(text('вкладений')))] })],
    },
    {
      type: 'blockquote',
      content: [para(text('цитата')), { type: 'bullet_list', content: [item(para(text('в цитаті')))] }],
    },
    { type: 'horizontal_rule' },
    { type: 'code_block', content: [text('const a = 1;')] },
    { type: 'image', attrs: { src: 'https://example.test/probe.jpg', alt: 'Проба' } },
    para({ type: 'image', attrs: { src: 'uploads/logo.png', alt: 'Логотип' } }),
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [para(text('шапка'))] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [para(text('клітинка'))] }] },
      ],
    },
  ],
});

export const FULL_DOC = {
  rich: (lang, key = 'x') => richDoc(lang, key),
  inline: (lang, key = 'x') => inlineDoc(lang, key),
  card: (lang) => cardDoc(lang),
};

// Кожну форматовану пару кожного запису копії контенту замінює документом «з усім
// дозволеним» свого рівня. Ключ унікальний для кожного поля (наскрізний лічильник) і
// спільний для обох мов пари: якір не дублюється на сторінці, а #probe-<key> веде у своє поле.
export function fillAll(fixture) {
  let n = 0;
  for (const entry of readContent(fixture.dir)) {
    const data = mapRichPairs(entry.collection, entry.data, (_pair, field) => {
      const key = `f${++n}`;
      return { uk: FULL_DOC[field.level]('uk', key), en: FULL_DOC[field.level]('en', key) };
    });
    fixture.replace(entry, data);
  }
}
