// Клієнт Storyblok Management API без SDK. Тариф Starter дозволяє 3 запити/с:
// усі запити стають в одну чергу з паузою між стартами, а 429 повторюється
// з експоненційною паузою. Токен не потрапляє в жодне повідомлення.

export const REGIONS = {
  eu: 'https://mapi.storyblok.com',
  us: 'https://api-us.storyblok.com',
  ca: 'https://api-ca.storyblok.com',
  ap: 'https://api-ap.storyblok.com',
  cn: 'https://app.storyblokchina.cn',
};

const PER_PAGE = 100;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createClient({ token, spaceId, baseUrl, rps = 3, retries = 6, backoffMs = 1000, fetch = globalThis.fetch }) {
  if (!token) throw new Error('createClient: немає token');
  if (!spaceId) throw new Error('createClient: немає spaceId');
  if (!baseUrl) throw new Error('createClient: немає baseUrl');
  const interval = 1000 / rps;
  const stats = { requests: 0, retries: 0 };
  let queue = Promise.resolve();
  let lastStart = 0;

  // Черга стартів: навіть паралельні виклики не перевищать rps.
  const slot = () => {
    const turn = queue.then(async () => {
      const wait = lastStart + interval - Date.now();
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();
    });
    queue = turn;
    return turn;
  };

  async function request(method, path, { query, body } = {}) {
    const url = new URL(`/v1/spaces/${spaceId}${path}`, baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, String(value));
    for (let attempt = 0; ; attempt++) {
      await slot();
      stats.requests++;
      const res = await fetch(url, {
        method,
        headers: { Authorization: token, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 429 && attempt < retries) {
        stats.retries++;
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      if (!res.ok) throw new Error(`Storyblok ${method} ${path}: ${res.status} ${text.slice(0, 500)}`);
      return { data: text ? JSON.parse(text) : {}, headers: res.headers };
    }
  }

  const client = {
    stats,
    get: (path, query) => request('GET', path, { query }).then((r) => r.data),
    post: (path, body) => request('POST', path, { body }).then((r) => r.data),
    put: (path, body) => request('PUT', path, { body }).then((r) => r.data),
    delete: (path) => request('DELETE', path).then((r) => r.data),

    async all(path, key, query = {}) {
      const items = [];
      for (let page = 1; ; page++) {
        const { data, headers } = await request('GET', path, { query: { ...query, per_page: PER_PAGE, page } });
        const batch = data[key] ?? [];
        items.push(...batch);
        const total = Number(headers.get('total'));
        if (batch.length < PER_PAGE || (total > 0 && items.length >= total)) return items;
      }
    },

    // Медіатека — три кроки: підписаний запит у MAPI, multipart у сховище
    // (поля підпису, файл останнім під іменем «file»), finish_upload.
    async upload(filename, bytes, contentType) {
      const signed = await client.post('/assets/', { filename, validate_upload: 1 });
      const form = new FormData();
      for (const [key, value] of Object.entries(signed.fields ?? {})) form.append(key, value);
      form.append('file', new Blob([bytes], { type: contentType }), filename);
      const res = await fetch(signed.post_url, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`завантаження «${filename}» у сховище Storyblok: ${res.status} ${(await res.text()).slice(0, 300)}`);
      const done = await client.get(`/assets/${signed.id}/finish_upload`);
      return { id: done.asset?.id ?? signed.id, filename: done.asset?.filename ?? signed.public_url };
    },

    async download(url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`не вдалося завантажити ${url}: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
  return client;
}

// Токен і id простору — лише в .env (у .gitignore), скрипти запускаються
// через node --env-file=.env.
export function clientFromEnv(env = process.env) {
  const token = env.STORYBLOK_MANAGEMENT_TOKEN;
  const spaceId = env.STORYBLOK_SPACE_ID;
  const missing = [!token && 'STORYBLOK_MANAGEMENT_TOKEN', !spaceId && 'STORYBLOK_SPACE_ID'].filter(Boolean);
  if (missing.length > 0) throw new Error(`у .env бракує ${missing.join(', ')} (див. CLAUDE.md, розділ «CMS»)`);
  const region = (env.STORYBLOK_REGION || 'eu').trim().toLowerCase();
  const baseUrl = REGIONS[region];
  if (!baseUrl) throw new Error(`STORYBLOK_REGION «${region}» невідомий; можливі: ${Object.keys(REGIONS).join(', ')}`);
  return createClient({ token, spaceId, baseUrl });
}
