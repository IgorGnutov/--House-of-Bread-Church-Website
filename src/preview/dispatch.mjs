// Запуск deploy.yml через GitHub API (workflow_dispatch). Кличуть двоє:
// вебхук публікації Storyblok (hook.mjs) і cron стрічки Facebook
// (schedule.mjs, Спека 5). Токен — лише право на Actions цього репозиторію,
// живе в секретах Cloudflare.
export const DISPATCH_ENV = ['GITHUB_DISPATCH_TOKEN', 'GITHUB_REPOSITORY'];

export async function dispatchDeploy(env, fetch = globalThis.fetch) {
  const missing = DISPATCH_ENV.filter((key) => !env[key]);
  if (missing.length > 0) return { ok: false, error: `на стенді не задано ${missing.join(', ')}` };
  const workflow = env.GITHUB_WORKFLOW || 'deploy.yml';
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dim-hliba-preview',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: env.GITHUB_REF || 'main' }),
  });
  if (!res.ok) return { ok: false, error: `GitHub ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { ok: true };
}
