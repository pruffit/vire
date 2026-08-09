'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Field, fieldClass, btnPrimary, Textarea } from '@/components/ui-kit';
import { GenreSelect } from '@/components/genre-select';
import { Select } from '@/components/select';
import { DateField } from '@/components/date-field';
import { titleRepeatsArtist } from '@/lib/title-hygiene';
import { cn } from '@/lib/utils';

type State = 'idle' | 'submitting' | 'error';

export function CreateReleaseForm({ artistName }: { artistName: string }) {
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
  const [title, setTitle] = useState('');
  const titleWarn = titleRepeatsArtist(title, artistName);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'submitting') return;

    setState('submitting');
    setError(null);

    try {
      const res = await fetch('/api/v1/dashboard/releases', {
        method: 'POST',
        body: new FormData(e.currentTarget),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const releaseId = (json as { releaseId?: string }).releaseId;
      router.push(releaseId ? `/dashboard/releases/${releaseId}` : '/dashboard');
      router.refresh();
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

  const busy = state === 'submitting';

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2"
    >
      <Field
        label={t('titleLabel')}
        hint={t('titleHint')}
        className="sm:col-span-2"
      >
        <input
          name="title"
          type="text"
          required
          disabled={busy}
          placeholder={t('titlePlaceholder')}
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
        <Select name="type" defaultValue="ALBUM" options={RELEASE_TYPE_OPTIONS} disabled={busy} aria-label={t('typeLabel')} />
      </Field>

      <Field label={t('genreLabel')} hint={tCommon('optionalHint')}>
        <GenreSelect name="genre" disabled={busy} />
      </Field>

      <Field label={t('releaseDateLabel')} hint={tCommon('optionalHint')}>
        <DateField name="releaseDate" disabled={busy} className="w-44" aria-label={t('releaseDateLabel')} />
      </Field>

      <Field label={t('coverLabel')} hint={t('coverHintNew')}>
        <div className="flex items-start gap-4 min-w-0">
          <input
            name="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={handleCoverChange}
            className="min-w-0 max-w-full flex-1 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-foreground/20 disabled:opacity-50"
          />
          {coverPreview && (
            // Локальное превью выбранного файла (blob:), next/image его не оптимизирует
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreview}
              alt={t('coverAlt')}
              className="w-16 h-16 rounded-md object-cover shrink-0"
            />
          )}
        </div>
      </Field>

      <Field label={t('descriptionLabel')} hint={tCommon('optionalHint')} className="sm:col-span-2">
        <Textarea
          name="description"
          rows={3}
          disabled={busy}
          placeholder={t('descriptionPlaceholder')}
          className={cn(fieldClass, 'w-full')}
        />
      </Field>

      {error && <p className="text-sm text-red-400 sm:col-span-2">{error}</p>}

      <div className="flex items-center gap-4 pt-1 sm:col-span-2">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? t('saving') : t('create')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={busy}
          className="text-sm text-foreground/40 hover:text-foreground/70 transition-colors disabled:opacity-30"
        >
          {tCommon('cancel')}
        </button>
      </div>
    </form>
  );
}
