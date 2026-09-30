import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRAPH_URL, runFeedPull } from './feed.mjs';

// npm run fb:pull                                  — стрічка → src/content/facebook, картинки → public/uploads/facebook
// npm run fb:pull -- --out <тека> --public <тека>  — інші теки (тести)
// Коди виходу: 0 — знімок записано; 2 — записано, але частину постів
// відкинула схема; 1 — нічого не записано. У CI код керує кешем знімка
// (.github/workflows/deploy.yml).
const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const OPTIONS = ['--out', '--public'];
const bad = args.filter((a, i) => a.startsWith('--') && (!OPTIONS.includes(a) || !args[i + 1] || args[i + 1].startsWith('--')));
if (bad.length > 0) {
  console.error(`невідомі або неповні параметри: ${bad.join(' ')} (можливі: --out <тека>, --public <тека>)`);
  process.exit(1);
}
const option = (name, fallback) => (args.includes(name) ? resolve(args[args.indexOf(name) + 1]) : fallback);

const { exitCode } = await runFeedPull({
  pageId: process.env.FACEBOOK_PAGE_ID,
  token: process.env.FACEBOOK_PAGE_TOKEN,
  // Фейк Graph API у тестах (tests/helpers/fake-facebook.js).
  graphUrl: process.env.FACEBOOK_GRAPH_URL || GRAPH_URL,
  contentDir: option('--out', join(root, 'src/content')),
  publicDir: option('--public', join(root, 'public')),
});
process.exitCode = exitCode;
