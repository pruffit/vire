'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import type { ReleaseType } from '@vire/core';
import { Field, fieldClass, btnPrimary, Textarea } from '@/components/ui-kit';
import { GenreSelect } from '@/components/genre-select';
import { Select } from '@/components/select';
import { DateField } from '@/components/date-field';
import { titleRepeatsArtist } from '@/lib/title-hygiene';
import { cn } from '@/lib/utils';

interface Initial {
  title: string;
  type: ReleaseType;
  genre: string | null;
  releaseDate: string;
  description: string;
  linerNotes: string;
  coverUrl: string | null;
}

interface Props {
  releaseId: string;
  artistName: string;
  initial: Initial;
}

type State = 'idle' | 'saving' | 'saved' | 'error';

export function EditReleaseForm({ releaseId, artistName, initial }: Props) {
  const router = useRouter();
  const t = useTranslations('dashboard.releases');
  const tCommon = useTranslations('dashboard.common');
  const tType = useTranslations('common');
  const RELEASE_TYPE_OPTIONS = [
    { value: 'ALBUM', label: tType('releaseType.ALBUM') },
    { value: 'EP', label: tType('releaseType.EP') },
    { value: 'SINGLE', label: tType('releaseType.SINGLE') },
  ];
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [title, setTitle] = useState(initial.title);
  const titleWarn = titleRepeatsArtist(title, artistName);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'saving') return;

    setState('saving');
    setError(null);

    try {
      const res = await fetch(`/api/v1/dashboard/releases/${releaseId}`, {
        method: 'PATCH',
        body: new FormData(e.currentTarget),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setState('saved');
      router.refresh();
      setTimeout(() => setState('idle'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('genericError'));
      setState('error');
    }
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const busy = state === 'saving';

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label={t('titleLabel')} hint={t('titleHint')}>
        <input
          name="title"
          type="text"
          required
          disabled={busy}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={cn(fieldClass, 'w-full')}
        />
        {titleWarn && (
          <span className="text-[11px] text-amber-400/90 leading-snug">
            {tCommon('titleRepeatsArtistWarning')}
          </span>
        )}
      </Field>

      <Field label={t('typeLabel')}>
        <Select name="type" defaultValue={initial.type} options={RELEASE_TYPE_OPTIONS} disabled={busy} aria-label={t('typeLabel')} />
      </Field>

      <Field label={t('genreLabel')} hint={tCommon('optionalHint')}>
        <GenreSelect name="genre" defaultValue={initial.genre ?? ''} disabled={busy} />
      </Field>

      <Field label={t('releaseDateLabel')} hint={tCommon('optionalHint')}>
        <DateField name="releaseDate" defaultValue={initial.releaseDate} disabled={busy} className="w-44" aria-label={t('releaseDateLabel')} />
      </Field>

      <Field label={t('coverLabel')} hint={t('coverHintEdit')}>
        <div className="flex items-start gap-4 min-w-0">
          <input
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={handleCoverChange}
            className="min-w-0 max-w-full flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-foreground/20 disabled:opacity-50"
          />
          {(coverPreview ?? initial.coverUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview ?? initial.coverUrl!}
              alt={t('coverAlt')}
              className="w-16 h-16 rounded-md object-cover shrink-0"
            />
          )}
        </div>
      </Field>

      <Field label={t('descriptionLabel')} hint={tCommon('optionalHint')}>
        <Textarea name="description" rows={3} disabled={busy} defaultValue={initial.description} className={cn(fieldClass, 'w-full')} />
      </Field>

      <Field label={t('linerNotesLabel')} hint={t('linerNotesHint')}>
        <Textarea name="linerNotes" rows={5} disabled={busy} defaultValue={initial.linerNotes} className={cn(fieldClass, 'w-full font-mono text-xs')} />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {state === 'saved' && <p className="text-sm text-emerald-400">{t('saved')}</p>}

      <div className="flex items-center gap-4 pt-1">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? t('saving') : t('save')}
        </button>
        <Link href="/dashboard" className="text-sm text-foreground/40 hover:text-foreground/70 transition-colors">
          {tCommon('cancel')}
        </Link>
      </div>
    </form>
  );
}
