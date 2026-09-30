import { dispatchDeploy } from './dispatch.mjs';

// Стрічка Facebook (Спека 5) оновлюється перезбіркою сайту о 9:10, 15:10 і
// 20:10 за Києвом. Розклад GitHub Actions запускається із запізненням і
// вимикається після 60 днів без комітів, тому годинник — Cron Trigger
// прев'ю-воркера. Cron живе в UTC: wrangler.jsonc стріляє в обидва можливі
// часи (UTC+3 і UTC+2), а тут лишаються рівно слоти.
export const FEED_SLOTS = [9, 15, 20];

const kyivHour = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Kyiv' });

export const shouldDispatch = (scheduledTime) => FEED_SLOTS.includes(Number(kyivHour.format(scheduledTime)));

// Повтору немає: наступний слот за кілька годин, а помилку видно в логах
// воркера (observability у wrangler.jsonc).
export async function handleScheduled({ scheduledTime, env, fetch = globalThis.fetch, log = console }) {
  if (!shouldDispatch(scheduledTime)) return { dispatched: false };
  const result = await dispatchDeploy(env, fetch);
  if (!result.ok) log.error(`стрічка Facebook: деплой не запущено — ${result.error}`);
  return { dispatched: result.ok };
}
