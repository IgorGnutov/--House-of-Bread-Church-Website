// Content Delivery API v2: опублікована версія (cms:pull на кожній збірці)
// і чернетка (прев'ю-стенд). Лише fetch і URL — модуль працює і в Node, і у
// воркері Cloudflare. Management API (scripts/cms/client.mjs) тут не
// потрібен: токени доставки дають лише читання.

export const DELIVERY_REGIONS = {
  eu: 'https://api.storyblok.com',
  us: 'https://api-us.storyblok.com',
  ca: 'https://api-ca.storyblok.com',
  ap: 'https://api-ap.storyblok.com',
  cn: 'https://app.storyblokchina.cn',
};

const PER_PAGE = 100;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// STORYBLOK_DELIVERY_URL — лише для тестів (фейк на localhost); справжні
// середовища задають регіон.
export function deliveryUrl(env) {
  if (env.STORYBLOK_DELIVERY_URL) return env.STORYBLOK_DELIVERY_URL;
  const region = String(env.STORYBLOK_REGION || 'eu').trim().toLowerCase();
  const url = DELIVERY_REGIONS[region];
  if (!url) throw new Error(`STORYBLOK_REGION «${region}» невідомий; можливі: ${Object.keys(DELIVERY_REGIONS).join(', ')}`);
  return url;
}

export async function fetchStories({ token, baseUrl, version = 'published', fetch = globalThis.fetch, retries = 5, backoffMs = 500 }) {
  if (!token) throw new Error('fetchStories: немає token');
  if (version !== 'published' && version !== 'draft') throw new Error(`fetchStories: невідома версія «${version}»`);

  async function get(path, query) {
    const url = new URL(`/v2/cdn/${path}`, baseUrl);
    for (const [key, value] of Object.entries({ ...query, token })) url.searchParams.set(key, String(value));
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url);
      if (res.status === 429 && attempt < retries) {
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      // Токен їде в query, тож повна адреса в повідомлення не йде — лише шлях.
      if (!res.ok) throw new Error(`Storyblok CDN ${path}: ${res.status} ${text.slice(0, 300)}`);
      return { data: JSON.parse(text), headers: res.headers };
    }
  }

  // cv — версія кешу простору, росте з кожною публікацією. Без неї CDN може
  // віддати знімок до останньої публікації, і збірка з вебхука зібрала б
  // сайт без щойно опублікованої правки.
  const { data: me } = await get('spaces/me', {});
  const cv = me.space?.version;
  const stories = [];
  for (let page = 1; ; page++) {
    const { data, headers } = await get('stories', { version, per_page: PER_PAGE, page, ...(cv != null && { cv }) });
    const batch = data.stories ?? [];
    stories.push(...batch);
    const total = Number(headers.get('total'));
    if (batch.length < PER_PAGE || (total > 0 && stories.length >= total)) return stories;
  }
}
