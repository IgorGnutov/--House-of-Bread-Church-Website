import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientFromEnv } from './client.mjs';
import { runVerify } from './sync.mjs';

// npm run cms:verify — звірка Storyblok з файлами поле за полем; картинки
// медіатеки — за SHA-256 вмісту. Ненульовий код виходу при розбіжності.
const root = fileURLToPath(new URL('../..', import.meta.url));
try {
  const { exitCode } = await runVerify({
    client: clientFromEnv(),
    contentDir: join(root, 'src/content'),
    publicDir: join(root, 'public'),
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exitCode = 1;
}
