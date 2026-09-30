import type { SSRManifest } from 'astro';
import { App } from 'astro/app';
import { handle } from '@astrojs/cloudflare/handler';
import { handleScheduled } from './schedule.mjs';

// Точка входу прев'ю-воркера (astro.config.mjs, workerEntryPoint). fetch —
// звичайний обробник Astro, як у типовій точці входу адаптера. scheduled —
// Cron Trigger (wrangler.jsonc), що тричі на день перезбирає сайт зі свіжою
// стрічкою Facebook (Спека 5). Статична збірка цього файлу не бачить.
type Handle = typeof handle;
type Env = Parameters<Handle>[3];
type Context = Parameters<Handle>[4];

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      fetch: (request: Parameters<Handle>[2], env: Env, context: Context) => handle(manifest, app, request, env, context),
      scheduled: (controller: { scheduledTime: number }, env: Env, context: Context) => {
        context.waitUntil(handleScheduled({ scheduledTime: controller.scheduledTime, env }));
      },
    },
  };
}
