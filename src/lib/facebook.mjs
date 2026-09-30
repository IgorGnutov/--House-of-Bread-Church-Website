// Логіка картки поста Facebook (Спека 5). Чисті функції: їх рахує шаблон
// головної і на збірці, і на прев'ю, а тести — без збірки.

const LOCALE_TAG = { uk: 'uk-UA', en: 'en-GB' };

// Пост — не стаття: заголовка в нього немає. Перший непорожній рядок —
// найближче до заголовка, решта — опис одним абзацом (картка обрізає його
// line-clamp, переноси там лише заважали б).
export function splitPost(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { title: null, body: null };
  return { title: lines[0], body: lines.length > 1 ? lines.slice(1).join(' ') : null };
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

// Лише http(s): інші схеми (javascript:, data:) лишаються текстом. Адреса
// закінчується на пробілі, лапці чи куті, а кінцеві розділові знаки
// речення («…див. https://x.org.») до неї не входять.
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'«»]+/gi;
const TRAILING = /[.,;:!?)»]+$/;

// Пост — чужий текст, і <b> чи <3 у ньому — просто символи. Тому весь
// текст екранується, а розмітка лише наша: <a> навколо посилань.
export function linkify(text) {
  let html = '';
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING, '');
    html += escapeHtml(text.slice(last, match.index));
    const href = escapeHtml(url);
    html += `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`;
    last = match.index + url.length;
  }
  return html + escapeHtml(text.slice(last));
}

// Дата — київська: пост о 01:00 за Києвом в UTC ще «вчора». Частини
// збираються вручну: uk-UA додає «р.», en-US ставить місяць першим.
export function formatPostDate(iso, lang) {
  const parts = new Intl.DateTimeFormat(LOCALE_TAG[lang], {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv',
  }).formatToParts(new Date(iso));
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('day')} ${part('month')} ${part('year')}`;
}

// Facebook віддає «+0000», а <time datetime> хоче «+00:00» чи «Z».
export const postDateTime = (iso) => new Date(iso).toISOString();

// Широке медіа заповнює рамку 16:9; вужче (4:3, 1:1, reels 9:16) стоїть
// цілком — обрізання зʼїло б половину кадру.
export const isWide = ({ width, height }) => width / height >= 1.5;

export const sortPosts = (posts) => [...posts].sort(
  (a, b) => Date.parse(b.date) - Date.parse(a.date) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
);
