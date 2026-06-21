// Next.js instrumentation: ловим необработанные серверные ошибки роутов и шлём
// в captureError (лог + опциональный webhook-алерт). Без внешних зависимостей.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routerKind?: string },
): Promise<void> {
  const { captureError } = await import('@/lib/observability');
  await captureError(error, {
    where: `${request.method} ${request.path}`,
    routePath: context.routePath,
    routerKind: context.routerKind,
  });
}
