// Необработанные серверные ошибки роутов → captureError (лог + опциональный алерт).
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
