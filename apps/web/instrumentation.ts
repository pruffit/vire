// Валидация env только в nodejs-рантайме (не на edge, не при сборке — иначе
// dummy DATABASE_URL из Docker-билда уронил бы `next build`).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { parseEnv } = await import('@vire/core');
  const result = parseEnv(process.env, 'web');
  if (!result.ok) {
    const missing = result.error.issues.map((i) => i.variable).join(', ');
    throw new Error(`Некорректная конфигурация окружения (web): не заданы ${missing}`);
  }
  if (result.value.degraded.length > 0) {
    const features = result.value.degraded.map((d) => `${d.feature} (нет ${d.missing.join(', ')})`).join('; ');
    console.warn(`[env] фичи выключены из-за отсутствующих переменных: ${features}`);
  }
}

// Необработанные серверные ошибки роутов → captureError (лог + опциональный алерт).
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routerKind?: string; routeType?: string; renderSource?: string },
): Promise<void> {
  const { captureError } = await import('@/lib/observability');
  // routeType различает server action, рендер страницы, route handler и proxy. Без него
  // ошибка с пустым message (use-intl вырезает текст в проде) не локализуется по алерту.
  await captureError(error, {
    where: `${request.method} ${request.path}`,
    routePath: context.routePath,
    routerKind: context.routerKind,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
}
