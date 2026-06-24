'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ArtistLink } from '@vire/core';
import { normalizeSlug, MAX_SMART_LINKS } from '@/lib/smart-link';
import { toast } from '@/components/toast';
import { Field, fieldClass, Check, btnPrimary } from '@/components/ui-kit';
import { Select } from '@/components/select';
import { DateField } from '@/components/date-field';
import { LinksEditor } from '@/components/links-editor';
import { Icon } from '@/components/icon';
import { cn } from '@/lib/utils';

export interface SmartLinkInitial {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  releaseDate: string | null; // ISO
  releaseId: string | null;
  links: ArtistLink[];
  isPublished: boolean;
}

export interface ReleaseOption {
  id: string;
  title: string;
  status: string;
}

const RELEASE_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'черновик',
  SCHEDULED: 'запланирован',
  PUBLISHED: 'опубликован',
  ARCHIVED: 'архив',
};

export function SmartLinkForm({
  artistSlug,
  initial,
  releaseOptions = [],
}: {
  artistSlug: string;
  initial?: SmartLinkInitial;
  releaseOptions?: ReleaseOption[];
}) {
  const router = useRouter();
  const editing = !!initial;
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(!!initial);
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '');
  const [releaseDate, setReleaseDate] = useState(initial?.releaseDate ? initial.releaseDate.slice(0, 10) : '');
  const [releaseId, setReleaseId] = useState(initial?.releaseId ?? '');
  const [links, setLinks] = useState<ArtistLink[]>(initial?.links ?? []);
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initial?.coverUrl ?? null);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);

  // slug автоследует за названием, пока его не правили вручную
  const effectiveSlug = slug || normalizeSlug(title);

  function onTitle(v: string) {
    setTitle(v);
    if (!slugEdited) setSlug(normalizeSlug(v));
  }

  function pickCover(file: File | null) {
    setCoverFile(file);
    setRemoveCover(false);
    setCoverPreview(file ? URL.createObjectURL(file) : initial?.coverUrl ?? null);
  }

  function clearCover() {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
    if (coverInputRef.current) coverInputRef.current.value = '';
  }

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) return toast.error('Нужно название');
    if (!normalizeSlug(effectiveSlug)) return toast.error('Нужен адрес (slug)');
    setBusy(true);

    const fd = new FormData();
    fd.set('title', title.trim());
    fd.set('slug', effectiveSlug);
    fd.set('subtitle', subtitle.trim());
    fd.set('releaseDate', releaseDate);
    fd.set('releaseId', releaseId);
    fd.set('links', JSON.stringify(links.filter((l) => l.url.trim())));
    fd.set('isPublished', isPublished ? '1' : '0');
    if (coverFile) fd.set('cover', coverFile);
    if (removeCover) fd.set('removeCover', '1');

    const url = editing ? `/api/v1/dashboard/smart-links/${initial.id}` : '/api/v1/dashboard/smart-links';
    const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', body: fd }).catch(() => null);

    setBusy(false);
    if (!res?.ok) {
      let msg = 'Не удалось сохранить';
      try { msg = (await res!.json()).error ?? msg; } catch { /* keep */ }
      return toast.error(msg);
    }
    toast(editing ? 'Сохранено' : 'Лендинг создан');
    router.push('/dashboard/links');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="group relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-foreground/10 bg-foreground/5 transition-colors hover:border-foreground/25"
        >
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-foreground/35">
              <Icon name="image" size={20} />
              <span className="text-[11px]">Обложка 1:1</span>
            </span>
          )}
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Field label="Название">
            <input
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              disabled={busy}
              required
              placeholder="Название релиза"
              className={cn(fieldClass, 'w-full')}
            />
          </Field>
          {coverPreview && (
            <button
              type="button"
              onClick={clearCover}
              className="inline-flex items-center gap-1.5 self-start text-xs text-foreground/40 transition-colors hover:text-red-400"
            >
              <Icon name="trash" size={12} /> Убрать обложку
            </button>
          )}
        </div>
      </div>

      <Field label="Адрес страницы" hint="латиница, цифры, дефис">
        <div className="flex min-w-0 items-center gap-1 text-sm">
          <span className="shrink-0 max-w-[45%] truncate font-mono text-xs text-foreground/40">
            /smartlink/{artistSlug}/
          </span>
          <input
            value={slug}
            onChange={(e) => { setSlug(normalizeSlug(e.target.value)); setSlugEdited(true); }}
            disabled={busy}
            placeholder={normalizeSlug(title) || 'moy-reliz'}
            className={cn(fieldClass, 'min-w-0 flex-1 font-mono')}
          />
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Подзаголовок" hint="необязательно">
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            disabled={busy}
            placeholder="Сингл · 2026 / любой текст"
            className={cn(fieldClass, 'w-full')}
          />
        </Field>

        <Field label="Дата релиза" hint="необязательно">
          <DateField value={releaseDate} onValueChange={setReleaseDate} disabled={busy} aria-label="Дата релиза" />
        </Field>
      </div>

      {releaseOptions.length > 0 && (
        <Field label="Релиз на Vire" hint="первой кнопкой — «Слушать/Пресейв на Vire»">
          <Select
            value={releaseId}
            onValueChange={setReleaseId}
            disabled={busy}
            placeholder="— не привязан —"
            aria-label="Релиз на Vire"
            options={[
              { value: '', label: '— не привязан —' },
              ...releaseOptions.map((r) => ({
                value: r.id,
                label: `${r.title} · ${RELEASE_STATUS_LABEL[r.status] ?? r.status.toLowerCase()}`,
              })),
            ]}
          />
        </Field>
      )}
      </div>

      <div className="flex flex-col gap-6">
      <div>
        <LinksEditor
          title="Ссылки на площадки"
          hint="Вставь ссылку — иконка и название подхватятся сами."
          links={links}
          onChange={setLinks}
          max={MAX_SMART_LINKS}
          disabled={busy}
        />
      </div>

      <div className="mt-auto flex flex-col gap-4 border-t border-foreground/[0.06] pt-5">
        <Check
          label="Опубликовать"
          hint="Страница станет доступна по ссылке"
          checked={isPublished}
          disabled={busy}
          onChange={setIsPublished}
        />
        <button type="submit" disabled={busy} className={cn(btnPrimary, 'self-start')}>
          {busy ? 'Сохранение…' : editing ? 'Сохранить' : 'Создать лендинг'}
        </button>
      </div>
      </div>
    </form>
  );
}
