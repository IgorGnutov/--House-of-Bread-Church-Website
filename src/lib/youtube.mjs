// Той самий розбір, що в усіх копіях легасі: URL будь-якої форми або голий
// 11-символьний ID (Спека 1 дозволяє обидва).
const YT = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/;

export function ytId(src) {
  if (!src) return null;
  const match = String(src).match(YT);
  if (match) return match[1];
  return /^[\w-]{11}$/.test(src) ? src : null;
}

export const ytEmbed = (id, { autoplay = false } = {}) =>
  `https://www.youtube.com/embed/${id}?${autoplay ? 'autoplay=1&' : ''}rel=0`;

export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
