// Закритий набір: схема колекцій бере назви саме звідси, тож іконка поза
// списком валить збірку, а не малює порожню картку.
export const MINISTRY_ICON_PATHS = {
  book: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"/><path d="M8 3v18"/>',
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/>',
  media: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
  worship: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
  child: '<circle cx="12" cy="6" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/>',
  youth: '<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/>',
  teen: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>',
  order: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  care: '<path d="M12 21s-7-4.5-9-9A5 5 0 0 1 12 6a5 5 0 0 1 9 6c-2 4.5-9 9-9 9Z"/>',
  chapel: '<path d="M12 2v6M9 5h6M6 22V11l6-4 6 4v11"/>',
  prophetic: '<path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
  hospital: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 8v6M9 11h6"/>',
  biz: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  pray: '<path d="M12 2v9M8 7c0 3 2 4 4 4s4-1 4-4M6 22c0-4 3-7 6-7s6 3 6 7"/>',
  mercy: '<path d="M20 8.5a4.5 4.5 0 0 0-8-2.8A4.5 4.5 0 0 0 4 8.5c0 4 8 9.5 8 9.5s8-5.5 8-9.5Z"/>',
  prison: '<path d="M4 3v18M9 3v18M14 3v18M19 3v18"/>',
  family: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><path d="M2 20v-1a5 5 0 0 1 10 0v1M12 20v-1a5 5 0 0 1 10 0v1"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
};
export const MINISTRY_ICON_NAMES = Object.keys(MINISTRY_ICON_PATHS);

// Шість різних SVG карток «Посилання та ресурси» — у легасі вони жили лише
// в розмітці, тож новий ресурс лишився б без іконки.
export const RESOURCE_ICON_PATHS = {
  book: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"/><path d="M8 3v18"/>',
  music: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
  video: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m10 9 5 3-5 3V9Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  shield: '<path d="M12 3l7.5 4v5c0 4.6-3.2 7.4-7.5 9-4.3-1.6-7.5-4.4-7.5-9V7L12 3Z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
};
export const RESOURCE_ICON_NAMES = Object.keys(RESOURCE_ICON_PATHS);
