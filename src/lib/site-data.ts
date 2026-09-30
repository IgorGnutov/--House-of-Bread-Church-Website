import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';
import { sortPosts } from './facebook.mjs';
import { makeSite } from './site.mjs';
import { COLLECTIONS } from './storyblok/model.mjs';

type Data<C extends CollectionKey> = CollectionEntry<C>['data'];
type ListName = 'ministries' | 'churches' | 'projects' | 'testimonies' | 'pastors' | 'leader-resources';
type SingletonName = 'site-settings' | 'contact-info' | 'donate-settings' | 'homepage';
export type PageId = 'about' | 'contacts' | 'donate' | 'churches' | 'ministries' | 'projects' | 'testimonies' | 'pastors' | 'leaders';
export type FacebookPost = Data<'facebook'>;

export interface Site {
  list<C extends ListName>(name: C): Data<C>[];
  one<C extends SingletonName>(name: C): Data<C>;
  page(id: PageId): Data<'pages'>;
  edit(collection: CollectionKey, slug?: string | null, field?: string): Record<string, string>;
  // Пости Facebook, новіші першими (Спека 5).
  posts(): FacebookPost[];
}

// Те, що дає makeSite: і статична збірка, і прев'ю (src/preview/middleware.mjs).
export type ContentSite = Omit<Site, 'posts'>;

// Статична збірка: колекції Astro (content.config.ts — ті самі схеми й
// перевірки). Без кешу на рівні модуля: в astro dev правка файлу контенту
// видна одразу, а getCollection і так читає зі сховища в памʼяті.
async function fromCollections(): Promise<ContentSite> {
  const entries = [];
  for (const [collection, entry] of Object.entries(COLLECTIONS)) {
    for (const { id, data } of await getCollection(collection as CollectionKey)) {
      const slug = entry.kind === 'collection' ? (data as { slug: string }).slug : entry.kind === 'pages' ? id : entry.slug;
      entries.push({ collection, slug, data });
    }
  }
  return makeSite(entries) as ContentSite;
}

// Прев'ю-стенд кладе в locals дані чернетки (src/preview/middleware.mjs).
// Стрічку Facebook у Storyblok не редагують (Спека 5): і статична збірка, і
// прев'ю беруть її з колекції цієї збірки (fb:pull перед astro build).
export async function siteData(locals?: App.Locals): Promise<Site> {
  const site = locals?.site ?? (await fromCollections());
  const posts = sortPosts((await getCollection('facebook')).map((entry) => entry.data));
  return { ...site, posts: () => posts };
}
