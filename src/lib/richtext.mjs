// Дані richtext: документ Storyblok (ProseMirror JSON) — нормалізація, простий текст,
// обхід картинок. Без жодних імпортів: модуль читають і zod-схема, і прев'ю-воркер.

export const isDoc = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && value.type === 'doc';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// Порожнє значення атрибута: редактор пише null/'' замість «немає».
const isBlank = (v) => v === null || v === undefined || v === '';

const hasKeys = (o) => Object.keys(o).length > 0;
const withAttrs = (node, attrs) => {
  const { attrs: _drop, ...rest } = node;
  return hasKeys(attrs) ? { ...rest, attrs } : rest;
};

// Текст -> документ: абзац від порожнього рядка, одиночний \n — м'який перенос.
export function docFromText(text) {
  const content = String(text ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map((lines) => ({
      type: 'paragraph',
      content: lines.flatMap((line, i) => (
        i === 0 ? [{ type: 'text', text: line }] : [{ type: 'hard_break' }, { type: 'text', text: line }]
      )),
    }));
  return { type: 'doc', content };
}

// Які атрибути вузла варто зберігати. Решту (id, copyright, colwidth, ...) редактор Storyblok
// дописує сам при кожному збереженні, тож без відсіву `cms:verify` бачив би «зміну» щоразу.
// Вузол, якого тут немає (blok, невідомий), лишається як є — його називає схема.
const NODE_ATTRS = {
  doc: {},
  paragraph: { textAlign: 'blank' },
  heading: { level: 'keep', textAlign: 'blank' },
  blockquote: {},
  bullet_list: {},
  list_item: {},
  hard_break: {},
  horizontal_rule: {},
  tableRow: {},
  table: {},
  text: {},
  // order 1 — типове значення, його редактор дописує сам
  ordered_list: { order: 'not1' },
  code_block: { class: 'blank' },
  // colspan/rowspan 1 — типові; колір лишаємо непорожнім, щоб схема його відкинула з поясненням
  tableCell: { colspan: 'not1', rowspan: 'not1', backgroundColor: 'blank' },
  tableHeader: { colspan: 'not1', rowspan: 'not1', backgroundColor: 'blank' },
  image: { src: 'blank', alt: 'blank', title: 'blank' },
  emoji: { emoji: 'blank' },
};

function pickAttrs(rules, attrs) {
  const out = {};
  if (!isObj(attrs)) return out;
  for (const [key, rule] of Object.entries(rules)) {
    const v = attrs[key];
    if (v === undefined) continue;
    if (rule === 'keep') out[key] = v;
    else if (rule === 'blank') { if (!isBlank(v)) out[key] = v; }
    else if (rule === 'not1') { if (!isBlank(v) && v !== 1) out[key] = v; }
  }
  return out;
}

// Марки з атрибутами-стилями: порожні атрибути прибираємо (Word/Google Docs вставляють
// textStyle {color: null}); непорожні (колір, фон) лишаємо — схема їх відкине.
function styleMark(mark) {
  const attrs = {};
  for (const [k, v] of Object.entries(isObj(mark.attrs) ? mark.attrs : {})) {
    if (!isBlank(v)) attrs[k] = v;
  }
  return hasKeys(attrs) ? { type: mark.type, attrs } : null;
}

const PLAIN_MARKS = new Set(['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript', 'code']);

function nodeText(node) {
  if (!isObj(node)) return '';
  if (typeof node.text === 'string') return node.text;
  return Array.isArray(node.content) ? node.content.map(nodeText).join('') : '';
}

// Повертає марку, `null` (прибрати) або сама марка без змін, якщо вона невідома.
function normalizeMark(mark, node, opts) {
  if (!isObj(mark)) return mark;
  const a = isObj(mark.attrs) ? mark.attrs : {};
  if (PLAIN_MARKS.has(mark.type)) return { type: mark.type };
  if (mark.type === 'anchor') return isBlank(a.id) ? { type: 'anchor' } : { type: 'anchor', attrs: { id: a.id } };
  if (mark.type === 'textStyle' || mark.type === 'highlight' || mark.type === 'styled') return styleMark(mark);
  if (mark.type !== 'link') return mark;

  if (a.linktype === 'email') {
    const href = String(a.href ?? '');
    return { type: 'link', attrs: { href: href.startsWith('mailto:') ? href : 'mailto:' + href, linktype: 'email' } };
  }
  if (a.linktype === 'url' || a.linktype === 'asset') {
    return { type: 'link', attrs: { href: a.href, linktype: a.linktype } };
  }
  if (a.linktype === 'story') {
    const path = opts.resolveStory?.(a.uuid) ?? null;
    if (path) {
      return { type: 'link', attrs: { href: path + (isBlank(a.anchor) ? '' : '#' + a.anchor), linktype: 'url' } };
    }
    opts.warn?.(
      `посилання «${nodeText(node)}» веде на історію, якої немає серед опублікованих (uuid ${a.uuid})`,
    );
    return null;
  }
  return mark;
}

function normalizeNode(node, opts) {
  if (!isObj(node)) return node;
  const out = { ...node };
  if (Array.isArray(node.content)) out.content = node.content.map((n) => normalizeNode(n, opts));
  if (Array.isArray(node.marks)) {
    const marks = node.marks.map((m) => normalizeMark(m, node, opts)).filter((m) => m !== null);
    if (marks.length > 0) out.marks = marks;
    else delete out.marks;
  }
  const rules = NODE_ATTRS[node.type];
  if (rules) return withAttrs(out, pickAttrs(rules, node.attrs));
  return out;
}

// Абзац без тексту, емодзі й картинок (лише порожній або з переносами).
function isEmptyParagraph(node) {
  if (!isObj(node) || node.type !== 'paragraph') return false;
  const visible = (n) => {
    if (!isObj(n)) return false;
    if (n.type === 'emoji' || n.type === 'image') return true;
    if (n.type === 'text') return n.text !== '';
    return Array.isArray(n.content) && n.content.some(visible);
  };
  return !visible(node);
}

// Приводить документ Storyblok до вигляду, який зберігають файли. Не-документ повертає як є.
export function normalizeDoc(value, { resolveStory, warn } = {}) {
  if (!isDoc(value)) return value;
  const opts = { resolveStory, warn };
  let content = (Array.isArray(value.content) ? value.content : []).map((n) => normalizeNode(n, opts));
  // Редактор лишає порожні абзаци на краях; посередині вони — свідомий проміжок.
  while (content.length > 0 && isEmptyParagraph(content[0])) content.shift();
  while (content.length > 0 && isEmptyParagraph(content[content.length - 1])) content.pop();
  return withAttrs({ ...value, content }, pickAttrs(NODE_ATTRS.doc, value.attrs));
}

export function isEmptyDoc(value) {
  if (!isDoc(value)) return true;
  const blocks = Array.isArray(value.content) ? value.content : [];
  return blocks.every(isEmptyParagraph);
}

// Простий текст для SEO-описів: блоки через порожній рядок. Картинки, лінії, код і blok
// не мають тексту для опису.
export function richPlain(doc) {
  const blocks = [];
  const inline = (n) => {
    if (!isObj(n)) return '';
    if (n.type === 'hard_break') return ' ';
    if (n.type === 'emoji') return n.attrs?.emoji ?? '';
    if (typeof n.text === 'string') return n.text;
    return Array.isArray(n.content) ? n.content.map(inline).join('') : '';
  };
  const walk = (n) => {
    if (!isObj(n)) return;
    if (n.type === 'paragraph' || n.type === 'heading') {
      const t = inline(n).replace(/\s+/g, ' ').trim();
      if (t) blocks.push(t);
      return;
    }
    if (n.type === 'code_block' || n.type === 'image' || n.type === 'horizontal_rule') return;
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return blocks.join('\n\n');
}

// Нова копія документа, де `fn` перетворює attrs кожної картинки (будь-яка глибина).
export function mapImages(doc, fn) {
  const walk = (n) => {
    if (!isObj(n)) return n;
    const out = { ...n };
    if (Array.isArray(n.content)) out.content = n.content.map(walk);
    if (n.type === 'image') out.attrs = fn({ ...(n.attrs ?? {}) });
    return out;
  };
  return walk(doc);
}
