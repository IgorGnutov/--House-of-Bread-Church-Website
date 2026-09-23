import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';
import { BASE_PATH } from '../../astro.config.mjs';

export const distDir = fileURLToPath(new URL('../../dist/', import.meta.url));
export const distPath = (rel) => fileURLToPath(new URL(`../../dist/${rel}`, import.meta.url));
export const loadPage = (rel) => parse(readFileSync(distPath(rel), 'utf8'));
// Очікуваний href — з того самого BASE_PATH, що пішов у збірку.
export const href = (path) => `${BASE_PATH}${path.replace(/^\//, '')}`;
