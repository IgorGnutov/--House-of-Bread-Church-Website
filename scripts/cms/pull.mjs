import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deliveryUrl, fetchStories } from '../../src/lib/storyblok/delivery.mjs';
import { downloadAsset, isStoryblokAsset } from './assets.mjs';
import { runPull } from './snapshot.mjs';

// npm run cms:pull                                  — опублікована версія → src/content, картинки → public/uploads/cms
// npm run cms:pull -- --out <тека> --public <тека>  — інші теки (порівняння збірок, тести)
// Токен — Public (лише опублікована версія): у CI секрет STORYBLOK_PUBLIC_TOKEN,
// локально — .env.
const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const OPTIONS = ['--out', '--public'];
const bad = args.filter((a, i) => a.startsWith('--') && (!OPTIONS.includes(a) || !args[i + 1] || args[i + 1].startsWith('--')));
if (bad.length > 0) {
  console.error(`невідомі або неповні параметри: ${bad.join(' ')} (можливі: --out <тека>, --public <тека>)`);
  process.exit(2);
}
const option = (name, fallback) => (args.includes(name) ? resolve(args[args.indexOf(name) + 1]) : fallback);

try {
  const token = process.env.STORYBLOK_PUBLIC_TOKEN;
  if (!token) throw new Error('немає STORYBLOK_PUBLIC_TOKEN (Storyblok → Settings → Access Tokens, рівень Public; у CI — секрет репозиторію)');
  const baseUrl = deliveryUrl(process.env);
  // Фейк у тестах віддає файли медіатеки зі своєї адреси, а не з a.storyblok.com.
  const fakeFiles = process.env.STORYBLOK_DELIVERY_URL ? `${new URL(baseUrl).origin}/f/` : null;
  const { exitCode } = await runPull({
    stories: await fetchStories({ token, baseUrl, version: 'published' }),
    contentDir: option('--out', join(root, 'src/content')),
    publicDir: option('--public', join(root, 'public')),
    download: (url) => downloadAsset(url),
    isAsset: (s) => isStoryblokAsset(s) || (fakeFiles !== null && typeof s === 'string' && s.startsWith(fakeFiles)),
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}
