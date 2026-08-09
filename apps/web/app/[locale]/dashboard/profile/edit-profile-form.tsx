'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import type { ArtistLink, ArtistVideo, ThemeTokens } from '@vire/core';
import { btnPrimary, Textarea, Field, fieldClass, SectionLabel } from '@/components/ui-kit';
import { LinksEditor } from '@/components/links-editor';
import { VideosEditor } from '@/components/videos-editor';
import { Icon } from '@/components/icon';
import { cn } from '@/lib/utils';
import { ThemeEditor, type ThemeValue } from '@/components/theme-editor';

// Date-free subset of ArtistProfile — RSC can't serialize Date props to a client component
export interface EditableProfile {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
  themeTokens: ThemeTokens;
  links: ArtistLink[];
  videos: ArtistVideo[];
}

export function EditProfileForm({ artist }: { artist: EditableProfile }) {
  const router = useRouter();
  const t = useTranslations('dashboard.profile');
  const tCommon = useTranslations('dashboard.common');
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(artist.avatarUrl);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [headerPreview, setHeaderPreview] = useState<string | null>(artist.headerUrl);
  const [removeHeader, setRemoveHeader] = useState(false);
  const [links, setLinks] = useState<ArtistLink[]>(artist.links);
  const [videos, setVideos] = useState<ArtistVideo[]>(artist.videos);

  const [theme, setTheme] = useState<ThemeValue>(artist.themeTokens);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const fd = new FormData(e.currentTarget);
      fd.set('grain', theme.grain ? '1' : '0');
      fd.set('links', JSON.stringify(links));
      fd.set('videos', JSON.stringify(videos));
      if (removeAvatar) fd.set('removeAvatar', '1');
      if (removeHeader) fd.set('removeHeader', '1');

      const res = await fetch('/api/v1/dashboard/profile', { method: 'POST', body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('genericError'));
    } finally {
      setBusy(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
      setRemoveAvatar(false);
    }
  }

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview !== artist.avatarUrl) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview, artist.avatarUrl]);

  function handleHeaderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setHeaderPreview(URL.createObjectURL(file));
      setRemoveHeader(false);
    }
  }

  useEffect(() => {
    return () => {
      if (headerPreview && headerPreview !== artist.headerUrl) URL.revokeObjectURL(headerPreview);
    };
  }, [headerPreview, artist.headerUrl]);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-2">
      <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <SectionLabel>{t('section')}</SectionLabel>

        <Field label={t('nameLabel')}>
          <input name="name" type="text" required disabled={busy} defaultValue={artist.name} className={cn(fieldClass, 'w-full')} />
        </Field>

        <Field label={t('bioLabel')} hint={tCommon('optionalHint')}>
          <Textarea name="bio" rows={4} disabled={busy} defaultValue={artist.bio ?? ''} placeholder={t('bioPlaceholder')} className={cn(fieldClass, 'w-full')} />
        </Field>

        <Field label={t('avatarLabel')} hint={t('avatarHint')}>
          <div className="flex min-w-0 items-center gap-4">
            {avatarPreview && !removeAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="avatar" className="h-16 w-16 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xl font-medium">
                {artist.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-2">
              <input
                name="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={handleAvatarChange}
                className="w-full min-w-0 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm hover:file:bg-foreground/20 disabled:opacity-50"
              />
              {artist.avatarUrl && !removeAvatar && (
                <button
                  type="button"
                  onClick={() => { setRemoveAvatar(true); setAvatarPreview(null); }}
                  className="inline-flex items-center gap-1.5 self-start text-xs text-foreground/40 transition-colors hover:text-red-400"
                >
                  <Icon name="trash" size={12} /> {t('removeAvatar')}
                </button>
              )}
            </div>
          </div>
        </Field>
        <Field label={t('headerLabel')} hint={t('headerHint')}>
          <div className="flex flex-col gap-3">
            {headerPreview && !removeHeader ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headerPreview} alt="header" className="aspect-[3/1] w-full rounded-lg object-cover" />
            ) : (
              <div className="aspect-[3/1] w-full rounded-lg border border-foreground/10 bg-foreground/5" />
            )}
            <div className="flex flex-col gap-2">
              <input
                name="header"
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={handleHeaderChange}
                className="w-full min-w-0 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm hover:file:bg-foreground/20 disabled:opacity-50"
              />
              {artist.headerUrl && !removeHeader && (
                <button
                  type="button"
                  onClick={() => { setRemoveHeader(true); setHeaderPreview(null); }}
                  className="inline-flex items-center gap-1.5 self-start text-xs text-foreground/40 transition-colors hover:text-red-400"
                >
                  <Icon name="trash" size={12} /> {t('removeHeader')}
                </button>
              )}
            </div>
          </div>
        </Field>
      </section>

      <div className="border-t border-foreground/[0.06] pt-7">
        <LinksEditor
          title={t('linksTitle')}
          hint={t('linksHint')}
          links={links}
          onChange={setLinks}
          max={10}
          disabled={busy}
        />
      </div>

      <div className="border-t border-foreground/[0.06] pt-7">
        <VideosEditor videos={videos} onChange={setVideos} max={20} disabled={busy} />
      </div>
      </div>

      <section className="flex flex-col gap-4">
        <SectionLabel>{t('themeHeading')}</SectionLabel>
        <ThemeEditor
          value={theme}
          onChange={setTheme}
          artistName={artist.name}
          avatarUrl={avatarPreview && !removeAvatar ? avatarPreview : null}
          disabled={busy}
        />
      </section>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">{t('saved')}</p>}

      <div className="flex items-center gap-4 border-t border-foreground/[0.06] pt-5">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? t('saving') : t('save')}
        </button>
        <Link href="/dashboard" className="text-sm text-foreground/40 transition-colors hover:text-foreground/70">
          {tCommon('cancel')}
        </Link>
      </div>
    </form>
  );
}
