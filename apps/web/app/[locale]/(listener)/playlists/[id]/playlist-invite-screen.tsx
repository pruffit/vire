import { getUserProfile } from '@vire/db';
import { PageContainer } from '@/components/page-container';
import { PlaylistJoinBanner } from './playlist-join-banner';

interface Props {
  playlistId: string;
  token: string;
  title: string;
  ownerUserId: string;
}

export async function PlaylistInviteScreen({ playlistId, token, title, ownerUserId }: Props) {
  const owner = await getUserProfile(ownerUserId);
  const inviterName = owner?.name ?? 'Автор плейлиста';

  return (
    <PageContainer spaceY="10">
      <div className="mx-auto w-full max-w-lg py-10 text-center sm:py-16">
        <p className="text-sm text-muted-foreground">Приглашение в плейлист</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-3 text-sm text-foreground/70">
          Чтобы посмотреть треки и добавлять свои, войдите в аккаунт.
        </p>
        <div className="mt-8 text-left">
          <PlaylistJoinBanner playlistId={playlistId} token={token} inviterName={inviterName} isAuthenticated={false} />
        </div>
      </div>
    </PageContainer>
  );
}
