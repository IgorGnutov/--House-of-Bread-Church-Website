import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientFromEnv } from './client.mjs';
import { runImport } from './sync.mjs';

// npm run cms:import                — сухий прогін: лише план
// npm run cms:import -- --apply     — застосувати
//                       --prune     — видалити зайве (історії й компоненти)
//                       --force     — перезаписати історії, змінені в Storyblok
const FLAGS = ['--apply', '--prune', '--force'];
const args = process.argv.slice(2);
const unknown = args.filter((a) => !FLAGS.includes(a));
if (unknown.length > 0) {
  console.error(`невідомі параметри: ${unknown.join(' ')} (можливі: ${FLAGS.join(' ')})`);
  process.exit(2);
}
const root = fileURLToPath(new URL('../..', import.meta.url));
try {
  const { exitCode } = await runImport({
    client: clientFromEnv(),
    contentDir: join(root, 'src/content'),
    publicDir: join(root, 'public'),
    apply: args.includes('--apply'),
    prune: args.includes('--prune'),
    force: args.includes('--force'),
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}
