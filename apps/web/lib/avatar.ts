/** URL аватара артиста для рендера: без аватара — обложка первого релиза. */
export function resolveAvatarUrl(
  avatarUrl: string | null | undefined,
  firstReleaseCoverUrl?: string | null,
): string | null {
  return avatarUrl ?? firstReleaseCoverUrl ?? null;
}
