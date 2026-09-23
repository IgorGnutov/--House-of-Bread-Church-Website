// Інлайн-іконки, що повторюються на кількох сторінках. Розмітка — побайтово
// з легасі, разом із дрібними відмінностями між варіантами (width/height,
// stroke-linejoin): інакше пливуть пікселі в порівнянні з легасі.
const S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';
const SJ = `${S} stroke-linejoin="round"`;

export const ARROW = `<svg ${SJ}><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
export const ARROW_BUTTON = `<svg width="18" height="18" ${S}><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;
export const ARROW_NEWS = `<svg ${S}><path d="M5 12h14M13 6l6 6-6 6"></path></svg>`;
export const BACK = `<svg ${SJ}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`;
export const CHEVRON = `<svg ${S}><path d="M9 6l6 6-6 6"/></svg>`;
export const CHEVRON_LEFT = `<svg ${S}><path d="M15 6l-6 6 6 6"/></svg>`;
export const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
export const PIN = `<svg ${SJ}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
export const PHONE = `<svg ${SJ}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>`;
export const MAIL = `<svg ${SJ}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`;
export const PERSON = `<svg ${SJ}><circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>`;
export const USERS = `<svg ${SJ}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>`;
export const FACEBOOK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 9h3l.5-3H14V4.2c0-.9.3-1.5 1.6-1.5H17V.1C16.6.1 15.6 0 14.5 0 12 0 10.3 1.5 10.3 4v2H7.5v3h2.8v9H14V9Z"></path></svg>';
export const YOUTUBE = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.5-.4-5.2a2.7 2.7 0 0 0-1.9-1.9C18.9 4.5 12 4.5 12 4.5s-6.9 0-8.7.4a2.7 2.7 0 0 0-1.9 1.9C1 8.5 1 12 1 12s0 3.5.4 5.2a2.7 2.7 0 0 0 1.9 1.9c1.8.4 8.7.4 8.7.4s6.9 0 8.7-.4a2.7 2.7 0 0 0 1.9-1.9C23 15.5 23 12 23 12ZM9.7 15.4V8.6l5.8 3.4-5.8 3.4Z"></path></svg>';
export const INSTAGRAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"></circle></svg>';
export const TELEGRAM = `<svg ${SJ}><path d="m21.5 3-19 7.6c-.9.4-.9 1.6.1 1.9l4.6 1.5 1.8 5.6c.3.9 1.4 1.1 2 .4l2.5-2.7 4.8 3.5c.8.6 2 .2 2.2-.8l3-15.6c.2-1.1-.9-2-2-1.4Z"></path><path d="M8.3 14 18 7"></path></svg>`;
