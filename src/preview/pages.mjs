// Службові сторінки прев'ю: рядок HTML, без шаблонів сайту — вони
// показуються саме тоді, коли дані для шаблонів узяти не можна.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const layout = (title, body) => `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head><body style="font:16px/1.5 system-ui,sans-serif;max-width:48rem;margin:3rem auto;padding:0 1rem">${body}</body></html>`;

export const deniedPage = () => layout(
  'Прев\'ю лише для редактора',
  '<h1>Прев\'ю лише для редактора</h1><p>Відкрийте сторінку з Storyblok: оберіть історію в списку — вона відкриється у Visual Editor. Доступ діє годину.</p>',
);

// Рішення 13: редактор бачить, чому чернетка не пройде публікацію, ще до «Опублікувати».
export const problemsPage = (problems) => layout(
  'Чернетка не пройде публікацію',
  `<h1>Чернетка не пройде публікацію</h1><p>З таким контентом сайт не збереться. Виправте поля й збережіть історію:</p><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`,
);
