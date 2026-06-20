/**
 * Возвращает URL аватара для отображения артиста: если у него нет аватара —
 * подставляет обложку первого релиза. Не модифицирует БД, только для рендера.
 */
export function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
  firstReleaseCoverUrl?: string | null,
): string | null {
  return avatarUrl ?? firstReleaseCoverUrl ?? null;
}
