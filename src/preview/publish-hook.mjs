import { previewEnv } from './env.mjs';
import { handlePublishHook } from './hook.mjs';

export const prerender = false;

// Сире тіло — саме його підписує Storyblok.
export const POST = async ({ request, locals }) => handlePublishHook({
  body: await request.text(),
  signature: request.headers.get('webhook-signature'),
  env: previewEnv(locals),
});
