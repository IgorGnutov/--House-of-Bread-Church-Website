// Прев'ю бачить лише редактор (Спека 3). Visual Editor відкриває сторінку з
// _storyblok_tk[space_id|timestamp|token], де token = sha1(space:previewToken:timestamp)
// (документація Storyblok, перевірка preview-токена). Посилання всередині
// iframe цих параметрів не несуть, тож далі доступ тримає підписана cookie.
// Лише Web Crypto — працює і в Node, і у воркері Cloudflare.
export const SESSION_COOKIE = 'hob_editor';
const SESSION_SECONDS = 3600;
const TOKEN_MAX_AGE_SECONDS = 3600;
const enc = new TextEncoder();
const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const sha1Hex = async (text) => hex(await crypto.subtle.digest('SHA-1', enc.encode(text)));

export async function hmacHex(algorithm, key, text) {
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: algorithm }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(text)));
}

// Без раннього виходу: час відповіді не підказує, скільки символів збіглося.
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function validEditorToken(params, { spaceId, previewToken, now }) {
  const space = params.get('_storyblok_tk[space_id]');
  const timestamp = params.get('_storyblok_tk[timestamp]');
  const token = params.get('_storyblok_tk[token]');
  if (!space || !timestamp || !token || space !== String(spaceId)) return false;
  const age = now / 1000 - Number(timestamp);
  // П'ять хвилин «з майбутнього» — запас на розбіжність годинників.
  if (!Number.isFinite(age) || age > TOKEN_MAX_AGE_SECONDS || age < -300) return false;
  return safeEqual(token, await sha1Hex(`${space}:${previewToken}:${timestamp}`));
}

const sessionMac = (previewToken, expires) => hmacHex('SHA-256', previewToken, `hob-editor:${expires}`);

async function sessionCookie(previewToken, now) {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  // SameSite=None + Partitioned: cookie ставиться всередині iframe
  // app.storyblok.com, тобто в сторонньому контексті.
  return `${SESSION_COOKIE}=${expires}.${await sessionMac(previewToken, expires)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=None; Partitioned`;
}

async function validSession(cookieHeader, { previewToken, now }) {
  const value = (cookieHeader ?? '').split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const [expires, mac] = (value ?? '').split('.');
  if (!expires || !mac || !(Number(expires) * 1000 > now)) return false;
  return safeEqual(mac, await sessionMac(previewToken, expires));
}

// Новий токен редактора — нова сесія; чинна cookie — доступ; інакше —
// відмова (і middleware не робить жодного запиту за чернеткою).
export async function editorAccess({ url, cookieHeader, spaceId, previewToken, now }) {
  if (!previewToken || !spaceId) return { ok: false };
  if (await validEditorToken(url.searchParams, { spaceId, previewToken, now })) {
    return { ok: true, setCookie: await sessionCookie(previewToken, now) };
  }
  return { ok: await validSession(cookieHeader, { previewToken, now }) };
}
