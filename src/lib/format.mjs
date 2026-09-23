const LOCALE_TAG = { uk: 'uk-UA', en: 'en-US' };

// Легасі форматував у браузері відвідувача: new Date('2026-01-10') — це
// опівніч UTC, і в Україні дата та сама. На збірці пояс довільний, тому
// явний UTC — інакше збірка в США показала б попередній день.
export function formatDate(iso, lang) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(LOCALE_TAG[lang], {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export const initial = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

export const telHref = (phone) => `tel:${phone.replace(/[^+\d]/g, '')}`;

// Проза нових сторінок — простий текст; абзаци розділені порожнім рядком.
// HTML у дані не пускаємо (Storyblok отримає richtext окремо).
export const paragraphs = (text) =>
  text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
