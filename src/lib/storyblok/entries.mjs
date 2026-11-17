import { fromStory, storyPath } from './convert.mjs';
import { COLLECTIONS } from './model.mjs';

// Історія Storyblok → запис того самого вигляду, що readContent дає з
// файлів ({ collection, slug, source, path, data }). Так cms:pull і прев'ю
// перевіряють і записують дані тим самим validateContent.

function collectionOf(story) {
  const [folder, slug, ...rest] = story.full_slug.split('/');
  if (!slug || rest.length > 0) return null;
  for (const [name, entry] of Object.entries(COLLECTIONS)) {
    if (entry.folder !== folder) continue;
    if (entry.kind !== 'singleton' || entry.slug === slug) return name;
  }
  return null;
}

// Атрибути, за якими Visual Editor знаходить блок, — той самий формат, що
// storyblokEditable() з @storyblok/js (SDK не підключаємо).
export function editableAttrs(editable) {
  const match = typeof editable === 'string' && editable.match(/^<!--#storyblok#(.*)-->$/s);
  if (!match) return null;
  try {
    const options = JSON.parse(match[1]);
    return { 'data-blok-c': JSON.stringify(options), 'data-blok-uid': `${options.id}-${options.uid}` };
  } catch {
    return null;
  }
}

// Шлях сторінки сайту (без мови й base) за uuid історії — для посилань «історія» у
// форматованому тексті. Посилання зберігає лише uuid, тому перейменований slug не
// ламає його. null — історія є, але власної сторінки на сайті не має.
export function storyRoutes(stories) {
  const routes = new Map();
  for (const story of stories) {
    if (story.is_folder || !story.uuid) continue;
    const collection = collectionOf(story);
    if (!collection) continue;
    routes.set(story.uuid, routeOf(collection, story.slug));
  }
  return routes;
}

function routeOf(collection, slug) {
  switch (collection) {
    case 'ministries': case 'churches': case 'projects': return `/${collection}/${slug}/`;
    case 'pages': return `/${slug}/`;
    case 'homepage': return '/';
    case 'testimonies': return '/testimonies/';
    case 'pastors': return '/pastors/';
    case 'leader-resources': return '/leaders/';
    default: return null;
  }
}

export function storiesToEntries(stories, { assetPath } = {}) {
  const routes = storyRoutes(stories);
  const resolveStory = (uuid) => routes.get(uuid) ?? null;
  const bySlug = new Map(stories.filter((s) => s.uuid).map((s) => [s.uuid, s.full_slug]));
  const entries = [];
  const errors = [];
  const warnings = [];
  const editables = new Map();
  for (const story of stories) {
    if (story.is_folder) continue;
    const collection = collectionOf(story);
    if (!collection) {
      warnings.push(`${story.full_slug}: поза папками сайту — пропущено`);
      continue;
    }
    const path = storyPath(collection, story.slug);
    const onBlok = (blok, at) => {
      const attrs = editableAttrs(blok._editable);
      if (attrs) editables.set(`${path}#${at}`, attrs);
    };
    // Є в карті, але без шляху — одиночка без сторінки: попередження називає ціль.
    const warn = (message, info) => {
      const text = routes.has(info?.uuid)
        ? `посилання «${info.text}» веде на «${bySlug.get(info.uuid)}», яка не має сторінки на сайті`
        : message;
      warnings.push(`${story.full_slug}: ${text}`);
    };
    try {
      const data = fromStory(collection, story, { ...(assetPath && { assetPath }), onBlok, resolveStory, warn });
      entries.push({ collection, slug: story.slug, source: story.full_slug, path, data });
    } catch (error) {
      errors.push(`${story.full_slug}: ${error.message}`);
    }
  }
  return { entries, errors, warnings, editables };
}
