import uk from './uk.json';
import en from './en.json';
import { createT } from '../lib/i18n.mjs';

export type Lang = 'uk' | 'en';
export const t = createT({ uk, en });
export { pick } from '../lib/i18n.mjs';
