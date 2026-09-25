import { validateContent } from '../../src/lib/content-rules.mjs';
import { storiesToEntries } from '../../src/lib/storyblok/entries.mjs';
import { CMS_UPLOADS, isStoryblokAsset, localizeAssets } from './assets.mjs';
import { writeContent } from './content.mjs';

// cms:pull: опублікований Storyblok → файли того самого вигляду, що
// src/content. Далі astro build і npm test ідуть звичайним шляхом, з тими ж
// перевірками, що стерегли файли (CLAUDE.md, контракт з адмінкою).
// Перевірки — до будь-якого запису: невалідний контент не лишає по собі
// напівзаписаних файлів.
export async function runPull({ stories, contentDir, publicDir, download, isAsset = isStoryblokAsset, log = console.log }) {
  const { entries, errors, warnings } = storiesToEntries(stories);
  for (const w of warnings) log(`! ${w}`);
  const problems = [...errors, ...validateContent(entries)];
  if (problems.length > 0) {
    for (const p of problems) log(`✗ ${p}`);
    log(`Контент у Storyblok не проходить перевірки (${problems.length}) — файли не змінено.`);
    return { exitCode: 1, problems };
  }
  const result = await localizeAssets(entries, { publicDir, download, isAsset });
  writeContent(contentDir, result.entries);
  log(`Записано історій: ${entries.length}. Картинки медіатеки: ${result.reused} збіглися з public/, ${result.downloaded} завантажено в ${CMS_UPLOADS}/.`);
  return { exitCode: 0, problems: [] };
}
