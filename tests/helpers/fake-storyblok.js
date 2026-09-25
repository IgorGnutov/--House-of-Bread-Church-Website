import { createServer } from 'node:http';

// Management API у памʼяті: ті самі шляхи, форми відповідей, ліміт і 429,
// що й у Storyblok (документація MAPI v1; де вона мовчить — див. план
// Етапу 4, рішення 15). Живий простір тести не чіпають ніколи.
//
// Як і справжній API, фейк дописує до збереженого свої ключі (id полів,
// created_at, alt: null у asset): повторний імпорт мусить лишатися «0 змін»
// попри це (Review Focus 1).
//
// Два незалежні способи отримати 429: часове вікно (limit/windowMs) — для
// власного дроселя клієнта (rps, реальний годинник, тест сам його міряє), і
// лічильник запитів (rejectEvery) — для всього, де 429 сам є перевіреною
// поведінкою. Часове вікно під повним прогоном тестів (інше навантаження
// на той самий процес) ненадійне, тож жодне асертоване значення (rejected >
// 0, стільки ж повторів, скільки відмов) не мусить спиратися на нього —
// лише на rejectEvery.

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const ASSET_DEFAULTS = { alt: null, name: '', focus: null, title: null, source: null, copyright: null, meta_data: {} };

function decorateAssets(value) {
  if (Array.isArray(value)) return value.map(decorateAssets);
  if (value && typeof value === 'object') {
    const out = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decorateAssets(v)]));
    return out.fieldtype === 'asset' ? { ...ASSET_DEFAULTS, ...out } : out;
  }
  return value;
}

const listItem = ({ content, published_content, ...rest }) => rest;
// Storyblok «параметризує» імʼя файлу: крапки, крім останньої, стають «_».
const parameterize = (name) => name.replace(/\.(?=.*\.)/g, '_');

export async function startFakeStoryblok({
  token = 'test-token', spaceId = '1', limit = Infinity, windowMs = 1000, rejectEvery = null, seedDemo = false, failOnWrite = null,
  publicToken = 'public-token', previewToken = 'preview-token', cdnRejectEvery = null,
} = {}) {
  const state = {
    components: [], stories: [], assets: [], files: new Map(), uploads: 0, rejected: 0, log: [], defaultRoot: null,
    version: 1, cdnCache: new Map(), cdnRequests: 0,
  };
  let nextId = 1;
  let hits = [];
  let mapiRequests = 0;
  let writeCount = 0;
  let baseUrl = '';

  const fullSlugOf = (story) => {
    const parent = state.stories.find((s) => s.id === story.parent_id);
    return parent ? `${parent.full_slug}/${story.slug}` : story.slug;
  };
  // Опублікована версія — знімок на момент публікації: правка без
  // «Опублікувати» до неї не доходить (так Storyblok відділяє чернетку).
  // version — cv простору: росте з кожною публікацією, як у CDN API.
  const publishNow = (story) => {
    story.published = true;
    story.unpublished_changes = false;
    story.published_content = structuredClone(story.content);
    state.version++;
  };
  // MAPI не віддає знімка опублікованої версії — лише фейк тримає його поруч.
  const mapiView = ({ published_content, ...rest }) => rest;
  const decorateComponent = (component, id) => ({
    ...component,
    id,
    created_at: '2026-09-24T00:00:00.000Z',
    component_group_uuid: null,
    schema: Object.fromEntries(Object.entries(component.schema ?? {}).map(([k, f], i) => [k, { id: `f${i}`, ...f }])),
  });
  const addStory = ({ name, slug, parent_id = 0, is_folder = false, default_root, content, published = false }) => {
    const story = {
      id: nextId++, uuid: `uuid-${nextId}`, name, slug, parent_id, is_folder, default_root,
      content: decorateAssets(content), published: false, unpublished_changes: false,
    };
    story.full_slug = fullSlugOf(story);
    state.stories.push(story);
    if (published) publishNow(story);
    return story;
  };

  if (seedDemo) {
    for (const name of ['page', 'teaser', 'grid', 'feature']) state.components.push(decorateComponent({ name, schema: {}, is_root: name === 'page', is_nestable: name !== 'page' }, nextId++));
    addStory({ name: 'Home', slug: 'home', content: { component: 'page', _uid: 'demo', body: [] }, published: true });
    // Новий простір: демо-компонент «page» — тип контенту за замовчуванням
    // (живий простір, 2026-09-24), тому його не можна видалити, доки план
    // не перемкне default_root на наш «site_page».
    state.defaultRoot = 'page';
  }

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };

  // Visual Editor знаходить блок за _editable (формат CDN API для version=draft).
  const withEditable = (value, story) => {
    if (Array.isArray(value)) return value.map((v) => withEditable(v, story));
    if (!value || typeof value !== 'object') return value;
    const out = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withEditable(v, story)]));
    if (typeof out.component === 'string' && out._uid) {
      out._editable = `<!--#storyblok#${JSON.stringify({ name: out.component, space: spaceId, uid: out._uid, id: String(story.id) })}-->`;
    }
    return out;
  };

  // Content Delivery API v2: токен у query. Опублікована версія кешується за
  // cv, як на CDN Storyblok: запит без cv чи зі старою cv отримує той знімок,
  // що вже лежить у кеші (Review Focus 2). Чернетка — лише з preview-токеном.
  function cdn(url, res) {
    const token = url.searchParams.get('token');
    const access = token === previewToken ? 'preview' : token === publicToken ? 'public' : null;
    if (!access) return send(res, 401, { error: 'Unauthorized' });
    state.cdnRequests++;
    if (cdnRejectEvery && state.cdnRequests % cdnRejectEvery === 0) {
      state.rejected++;
      return send(res, 429, { error: 'Too Many Requests' });
    }
    if (url.pathname === '/v2/cdn/spaces/me') return send(res, 200, { space: { id: Number(spaceId), name: 'Fake', version: state.version } });
    if (url.pathname !== '/v2/cdn/stories') return send(res, 404, { error: 'not found' });
    const version = url.searchParams.get('version') ?? 'published';
    if (version === 'draft' && access !== 'preview') return send(res, 401, { error: 'draft needs a preview token' });
    const perPage = Math.min(Number(url.searchParams.get('per_page') ?? 25), 100);
    const page = Number(url.searchParams.get('page') ?? 1);
    const key = `${url.searchParams.get('cv') ?? '-'}|${perPage}|${page}`;
    if (version === 'published' && state.cdnCache.has(key)) return send(res, 200, ...state.cdnCache.get(key));
    const all = state.stories
      .filter((s) => !s.is_folder && (version === 'draft' || s.published_content))
      .map((s) => ({
        id: s.id, uuid: s.uuid, name: s.name, slug: s.slug, full_slug: s.full_slug,
        content: version === 'draft' ? withEditable(s.content, s) : structuredClone(s.published_content),
      }));
    const reply = [
      { stories: all.slice((page - 1) * perPage, page * perPage), cv: state.version },
      { total: String(all.length), 'per-page': String(perPage) },
    ];
    if (version === 'published') state.cdnCache.set(key, reply);
    return send(res, 200, ...reply);
  }

  async function handle(req, res) {
    const url = new URL(req.url, baseUrl);
    const method = req.method;

    // Сховище файлів (S3 і CDN): не MAPI, без токена й ліміту.
    if (method === 'POST' && url.pathname === '/s3') {
      const form = await new Request('http://fake/s3', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: await readBody(req) }).formData();
      const file = form.get('file');
      state.files.set(`/${form.get('key')}`, Buffer.from(await file.arrayBuffer()));
      state.uploads++;
      return send(res, 204);
    }
    if (method === 'GET' && url.pathname.startsWith('/f/')) {
      const bytes = state.files.get(url.pathname);
      if (!bytes) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      return res.end(bytes);
    }

    if (method === 'GET' && url.pathname.startsWith('/v2/cdn/')) return cdn(url, res);

    // Групу шляху зроблено необовʼязковою: сам простір (GET/PUT default_root)
    // живе на /v1/spaces/:id без хвоста.
    const m = url.pathname.match(/^\/v1\/spaces\/([^/]+)((?:\/.*?)?)\/?$/);
    if (!m) return send(res, 404, { error: 'not found' });
    if (req.headers.authorization !== token) return send(res, 401, { error: 'Unauthorized' });
    if (m[1] !== spaceId) return send(res, 404, { error: 'space not found' });

    const now = Date.now();
    hits = hits.filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      state.rejected++;
      return send(res, 429, { error: 'Too Many Requests' });
    }
    hits.push(now);
    mapiRequests++;
    // Детермінований 429: кожен rejectEvery-й запит до MAPI — незалежно від
    // годинника. Повтор клієнта — це вже не кратний rejectEvery запит, тож
    // завжди проходить.
    if (rejectEvery && mapiRequests % rejectEvery === 0) {
      state.rejected++;
      return send(res, 429, { error: 'Too Many Requests' });
    }

    const route = m[2];
    const isWrite = method !== 'GET' || /\/publish$/.test(route) || /\/finish_upload$/.test(route);
    state.log.push({ method, route, write: isWrite });
    if (isWrite && failOnWrite !== null && ++writeCount === failOnWrite) return send(res, 500, { error: 'Internal Server Error' });

    const body = method === 'POST' || method === 'PUT' ? JSON.parse((await readBody(req)).toString() || '{}') : {};
    let r;

    // Обʼєкт простору: GET/PUT /v1/spaces/:id (без хвоста), тіло — { space }.
    if (route === '' && method === 'GET') return send(res, 200, { space: { id: Number(spaceId), default_root: state.defaultRoot } });
    if (route === '' && method === 'PUT') {
      const s = body.space ?? {};
      if ('default_root' in s) {
        // Живий API валідує default_root проти наявних компонентів: не можна
        // призначити типом за замовчуванням компонент, якого ще нема.
        if (!state.components.some((c) => c.name === s.default_root)) return send(res, 422, { error: 'default_root: unknown component' });
        state.defaultRoot = s.default_root;
      }
      return send(res, 200, { space: { id: Number(spaceId), default_root: state.defaultRoot } });
    }

    if (route === '/components' && method === 'GET') return send(res, 200, { components: state.components, component_groups: [] });
    if (route === '/components' && method === 'POST') {
      if (state.components.some((c) => c.name === body.component.name)) return send(res, 422, { name: ['has already been taken'] });
      const component = decorateComponent(body.component, nextId++);
      state.components.push(component);
      return send(res, 201, { component });
    }
    if ((r = route.match(/^\/components\/(\d+)$/))) {
      const index = state.components.findIndex((c) => c.id === Number(r[1]));
      if (index < 0) return send(res, 404, { error: 'not found' });
      if (method === 'PUT') {
        state.components[index] = decorateComponent(body.component, state.components[index].id);
        return send(res, 200, { component: state.components[index] });
      }
      if (method === 'DELETE') {
        const component = state.components[index];
        // Живий простір, 2026-09-24: видалити компонент — тип контенту за
        // замовчуванням не можна, доки простір не перемкнуто на інший.
        if (component.name === state.defaultRoot) {
          return send(res, 422, { error: 'This component is part of this space default content type. Please change the default content type in your settings before deleting.' });
        }
        return send(res, 200, { component: state.components.splice(index, 1)[0] });
      }
    }

    if (route === '/stories' && method === 'GET') {
      const perPage = Number(url.searchParams.get('per_page') ?? 25);
      const page = Number(url.searchParams.get('page') ?? 1);
      const items = state.stories.slice((page - 1) * perPage, page * perPage).map(listItem);
      return send(res, 200, { stories: items }, { total: String(state.stories.length), 'per-page': String(perPage) });
    }
    if (route === '/stories' && method === 'POST') {
      const s = body.story ?? {};
      if (!s.name || !s.slug) return send(res, 422, { error: 'name and slug are required' });
      const parentId = s.parent_id ?? 0;
      if (state.stories.some((x) => x.parent_id === parentId && x.slug === s.slug)) return send(res, 422, { slug: ['has already been taken'] });
      const story = addStory({ ...s, parent_id: parentId, published: Boolean(body.publish) });
      return send(res, 201, { story: mapiView(story) });
    }
    if ((r = route.match(/^\/stories\/(\d+)(\/publish)?$/))) {
      const story = state.stories.find((s) => s.id === Number(r[1]));
      if (!story) return send(res, 404, { error: 'not found' });
      if (r[2] && method === 'GET') {
        publishNow(story);
        return send(res, 200, { story: mapiView(story) });
      }
      if (method === 'GET') return send(res, 200, { story: mapiView(story) });
      if (method === 'PUT') {
        const s = body.story ?? {};
        for (const key of ['name', 'slug', 'parent_id', 'is_folder', 'default_root']) if (key in s) story[key] = s[key];
        if ('content' in s) story.content = decorateAssets(s.content);
        story.full_slug = fullSlugOf(story);
        if (body.publish) publishNow(story);
        else if (story.published) story.unpublished_changes = true;
        return send(res, 200, { story: mapiView(story) });
      }
      if (method === 'DELETE') {
        state.stories = state.stories.filter((s) => s.id !== story.id);
        state.version++;
        return send(res, 200, { story: mapiView(story) });
      }
    }

    if (route === '/assets' && method === 'GET') {
      const perPage = Number(url.searchParams.get('per_page') ?? 25);
      const page = Number(url.searchParams.get('page') ?? 1);
      return send(res, 200, { assets: state.assets.slice((page - 1) * perPage, page * perPage) }, { total: String(state.assets.length) });
    }
    if (route === '/assets' && method === 'POST') {
      const id = nextId++;
      const name = parameterize(body.filename);
      const key = `f/${spaceId}/${id}/${name}`;
      state.assets.push({ id, filename: `${baseUrl}/${key}`, short_filename: name, content_type: null, pending: true });
      return send(res, 200, { id, post_url: `${baseUrl}/s3`, public_url: `${baseUrl}/${key}`, pretty_url: `//fake/${key}`, fields: { key, acl: 'public-read' } });
    }
    if ((r = route.match(/^\/assets\/(\d+)\/finish_upload$/))) {
      const asset = state.assets.find((a) => a.id === Number(r[1]));
      if (!asset) return send(res, 404, { error: 'not found' });
      delete asset.pending;
      return send(res, 200, { asset });
    }
    return send(res, 404, { error: `no route ${method} ${route}` });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error) => send(res, 500, { error: String(error) }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const story = (fullSlug) => state.stories.find((s) => s.full_slug === fullSlug && !s.is_folder);
  return {
    baseUrl, token, spaceId, state, publicToken, previewToken,
    requests: () => state.log.length,
    writes: () => state.log.filter((e) => e.write).length,
    story,
    // Правка «редактором»: з publish — як натиснуте «Опублікувати».
    editStory(fullSlug, mutate, { publish = true } = {}) {
      const s = story(fullSlug);
      mutate(s.content, s);
      if (publish) publishNow(s); else s.unpublished_changes = true;
    },
    addStory({ parentSlug, slug, name = slug, content }) {
      const parent = state.stories.find((s) => s.is_folder && s.full_slug === parentSlug);
      return addStory({ name, slug, parent_id: parent?.id ?? 0, content, published: true });
    },
    // Редактор зняв історію з публікації / видалив її.
    unpublish(fullSlug) {
      const s = story(fullSlug);
      s.published = false;
      delete s.published_content;
      state.version++;
    },
    remove(fullSlug) {
      const s = story(fullSlug);
      state.stories = state.stories.filter((x) => x.id !== s.id);
      state.version++;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
