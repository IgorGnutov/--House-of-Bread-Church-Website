import { readFileSync } from 'node:fs';
import { createPlural, createT } from '../../src/lib/i18n.mjs';

// Ті самі словники й ті самі функції, що в src/i18n/index.ts, — тести
// рахують очікуваний текст так само, як шаблон, а не пишуть його літералом.
const dict = (lang) => JSON.parse(readFileSync(new URL(`../../src/i18n/${lang}.json`, import.meta.url), 'utf8'));
const dicts = { uk: dict('uk'), en: dict('en') };

export const t = createT(dicts);
export const plural = createPlural(dicts);
