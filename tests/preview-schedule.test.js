import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEED_SLOTS, handleScheduled, shouldDispatch } from '../src/preview/schedule.mjs';
import { projectRoot } from './helpers/build.js';

// Спека 5: стрічка Facebook оновлюється о 9:10, 15:10 і 20:10 за Києвом.
// Cron Cloudflare живе в UTC, а Київ — то UTC+3, то UTC+2, тож cron стріляє
// в обидва можливі часи, а shouldDispatch лишає рівно слоти.
const wrangler = JSON.parse(readFileSync(join(projectRoot, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const crons = wrangler.triggers?.crons ?? [];
const kyivHour = (ms) => Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Kyiv' }).format(ms));

// Моменти спрацювань cron «хвилина години * * *» за одну добу UTC.
function firings(day) {
  const [minute, hours] = crons[0].split(' ');
  return hours.split(',').map((h) => Date.parse(`${day}T${h.padStart(2, '0')}:${minute.padStart(2, '0')}:00Z`));
}

test('cron — одна позиція з пʼяти безкоштовних, щодня о :10 за UTC', () => {
  assert.equal(crons.length, 1);
  assert.match(crons[0], /^10 [\d,]+ \* \* \*$/);
});

test('кожен слот рівно раз на добу — улітку, взимку й у дні переходу годинника', () => {
  for (const day of ['2026-07-15', '2027-01-15', '2026-10-25', '2027-03-28']) {
    const hit = firings(day).filter((ms) => shouldDispatch(ms)).map(kyivHour);
    assert.deepEqual(hit, FEED_SLOTS, day);
  }
});

const env = { GITHUB_DISPATCH_TOKEN: 'ghp_secret', GITHUB_REPOSITORY: 'owner/repo' };
function github(status = 204) {
  const calls = [];
  return { calls, fetch: async (url, init) => { calls.push({ url, init }); return new Response(status === 204 ? null : 'Bad credentials', { status }); } };
}
const quiet = () => {
  const lines = [];
  return { lines, error: (line) => lines.push(String(line)) };
};

test('cron-обробник запускає деплой лише в слот', async () => {
  const slot = Date.parse('2026-07-15T06:10:00Z'); // 9:10 за Києвом
  const extra = Date.parse('2026-07-15T07:10:00Z'); // 10:10 — зайве спрацювання
  const gh = github();
  assert.deepEqual(await handleScheduled({ scheduledTime: extra, env, fetch: gh.fetch, log: quiet() }), { dispatched: false });
  assert.equal(gh.calls.length, 0);
  assert.deepEqual(await handleScheduled({ scheduledTime: slot, env, fetch: gh.fetch, log: quiet() }), { dispatched: true });
  assert.equal(gh.calls.length, 1);
  assert.equal(gh.calls[0].url, 'https://api.github.com/repos/owner/repo/actions/workflows/deploy.yml/dispatches');
});

test('відмова GitHub — рядок у лозі воркера без токена, без винятку й повтору', async () => {
  const gh = github(401);
  const log = quiet();
  const result = await handleScheduled({ scheduledTime: Date.parse('2027-01-15T13:10:00Z'), env, fetch: gh.fetch, log });
  assert.deepEqual(result, { dispatched: false });
  assert.equal(gh.calls.length, 1);
  assert.equal(log.lines.length, 1);
  assert.match(log.lines[0], /GitHub 401/);
  assert.ok(!log.lines[0].includes('ghp_secret'));
});
