/** Форма — зеркало DiscoveryRelease (packages/db/src/queries/discovery.ts): порт отдаёт те же поля. */
export interface ReleaseCard {
  id: string;
  title: string;
  type: string;
  coverUrl: string | null;
  releaseDate: Date | null;
  artistName: string;
  artistSlug: string;
  artistAvatarUrl: string | null;
  hasExplicit: boolean;
  accentColor: string | null;
}
