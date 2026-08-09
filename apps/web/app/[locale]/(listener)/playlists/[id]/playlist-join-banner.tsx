'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

interface Props {
  playlistId: string;
  token: string;
  inviterName: string;
  isAuthenticated: boolean;
}

export function PlaylistJoinBanner({ playlistId, token, inviterName, isAuthenticated }: Props) {
  const t = useTranslations();
  const [joining, setJoining] = useState(false);
  const router = useRouter();

  async function join() {
    setJoining(true);
    try {
      const res = await fetch(`/api/v1/playlists/${playlistId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => null);
      if (!res?.ok) {
        const data = res ? await res.json().catch(() => null) : null;
        toast.error(res?.status === 409 ? (data?.error ?? t('playlist.join.full')) : t('playlist.join.failed'));
        setJoining(false);
        return;
      }
      toast(t('playlist.join.success'));
      router.replace(`/playlists/${playlistId}`);
      router.refresh();
    } catch {
      setJoining(false);
      toast.error(t('playlist.join.failed'));
    }
  }

  const callbackUrl = `/playlists/${playlistId}?join=${token}`;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
        <Icon name="users" size={16} />
      </span>
      <p className="flex-1 min-w-48 text-sm text-foreground/85">
        <strong className="font-medium">{inviterName}</strong> {t('playlist.join.invitedText')}
      </p>
      {isAuthenticated ? (
        <button
          type="button"
          onClick={() => void join()}
          disabled={joining}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {joining ? t('playlist.join.joining') : t('playlist.join.cta')}
        </button>
      ) : (
        <Link
          href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t('nav.signIn')}
        </Link>
      )}
    </div>
  );
}
