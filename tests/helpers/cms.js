import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '../../scripts/cms/client.mjs';
import { ContentFixture, projectRoot } from './build.js';
import { startFakeStoryblok } from './fake-storyblok.js';

export const contentDir = join(projectRoot, 'src/content');
export const publicDir = join(projectRoot, 'public');

// Клієнт на фейк: ліміт фейку, а не 3 запити/с, — інакше повний імпорт у
// тестах ішов би хвилину.
export const fakeClient = (fake, opts = {}) =>
  createClient({ token: fake.token, spaceId: fake.spaceId, baseUrl: fake.baseUrl, rps: 1000, backoffMs: 5, ...opts });

export async function withFake(opts, fn) {
  const fake = await startFakeStoryblok(opts);
  try {
    return await fn(fake);
  } finally {
    await fake.close();
  }
}

// Тимчасова копія src/content, яку тест вільно псує (як withBuild, але без
// збірки): справжній src/content не чіпається ніколи.
export async function withContentCopy(prepare, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'hob-cms-'));
  try {
    cpSync(contentDir, dir, { recursive: true });
    prepare(new ContentFixture(dir));
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Мінімальний валідний PNG (1×1, прозорий) — байти для проби, що посилається
// на файл медіатеки. Вміст не має значення, лише те, що це справжній файл.
const PROBE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

// Тимчасова копія public/ з доданим uploads/probe.png: справжній контент
// може обходитися взагалі без файлів медіатеки (усі картинки — зовнішні
// URL), тож проба, якій потрібен саме uploads/…, не покладається на це.
// Копія — бо публічні файли, на які посилається решта справжнього контенту
// (наприклад, головна), мусять лишатися на місці; справжній public/ тести
// не чіпають ніколи.
export async function withPublicProbe(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'hob-cms-public-'));
  try {
    cpSync(publicDir, dir, { recursive: true });
    mkdirSync(join(dir, 'uploads'), { recursive: true });
    writeFileSync(join(dir, 'uploads', 'probe.png'), PROBE_PNG);
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function quietLog() {
  const lines = [];
  return { lines, log: (line = '') => lines.push(String(line)), text: () => lines.join('\n') };
}
