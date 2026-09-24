import { cpSync, mkdtempSync, rmSync } from 'node:fs';
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

export function quietLog() {
  const lines = [];
  return { lines, log: (line = '') => lines.push(String(line)), text: () => lines.join('\n') };
}
