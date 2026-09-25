// Змінні прев'ю-стенду: у воркері Cloudflare — locals.runtime.env (змінні й
// секрети проєкту Pages), в astro dev і тестах — process.env.
export function previewEnv(locals) {
  let runtime = {};
  try {
    runtime = locals?.runtime?.env ?? {};
  } catch {
    // Поза воркером адаптер може кидати на доступі до runtime.
  }
  return { ...(globalThis.process?.env ?? {}), ...runtime };
}
