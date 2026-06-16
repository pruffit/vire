'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ArtistLink } from '@vire/core';
import { detectPlatform, linkLabel } from '@/lib/platforms';
import { normalizeSlug, MAX_SMART_LINKS } from '@/lib/smart-link';
import { PlatformIcon } from '@/components/platform-icon';
import { BrandIcon, PLATFORM_BRAND, isBrandWordmark } from '@/components/brand-icon';
import { toast } from '@/components/toast';

export interface SmartLinkInitial {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  releaseDate: string | null; // ISO
  links: ArtistLink[];
  isPublished: boolean;
}

export function SmartLinkForm({ artistSlug, initial }: { artistSlug: string; initial?: SmartLinkInitial }) {
  const router = useRouter();
  const editing = !!initial;
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(!!initial);
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? '');
  const [releaseDate, setReleaseDate] = useState(initial?.releaseDate ? initial.releaseDate.slice(0, 10) : '');
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

  function updateLink(i: number, patch: Partial<ArtistLink>) {
    setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

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
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* Обложка + основное */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          className="relative shrink-0 w-28 h-28 rounded-lg overflow-hidden border border-white/10 bg-white/5 grid place-items-center hover:border-white/25 transition-colors"
        >
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-white/40 text-center px-2">Обложка<br />1:1</span>
          )}
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
        />

        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <Field label="Название">
            <input value={title} onChange={(e) => onTitle(e.target.value)} disabled={busy} required
              placeholder="Название релиза" className={inputCls} />
          </Field>
          {coverPreview && (
            <button type="button" onClick={clearCover} className="self-start text-xs text-white/40 hover:text-red-400 transition-colors">
              Убрать обложку
            </button>
          )}
        </div>
      </div>

      {/* Адрес */}
      <Field label="Адрес страницы" hint="латиница, цифры, дефис">
        <div className="flex items-center gap-1 text-sm min-w-0">
          <span className="text-white/40 shrink-0 font-mono text-xs max-w-[45%] truncate">/smartlink/{artistSlug}/</span>
          <input
            value={slug}
            onChange={(e) => { setSlug(normalizeSlug(e.target.value)); setSlugEdited(true); }}
            disabled={busy}
            placeholder={normalizeSlug(title) || 'moy-reliz'}
            className={`${inputCls} font-mono min-w-0`}
          />
        </div>
      </Field>

      <Field label="Подзаголовок" hint="необязательно">
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} disabled={busy}
          placeholder="Сингл · 2026 / любой текст" className={inputCls} />
      </Field>

      <Field label="Дата релиза" hint="необязательно">
        <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} disabled={busy} className={inputCls} />
      </Field>

      {/* Ссылки на площадки */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Ссылки на площадки</span>
          <span className="text-xs text-white/30">{links.length}/{MAX_SMART_LINKS}</span>
        </div>
        <p className="text-xs text-white/40 -mt-1">Вставь ссылку — иконка и название подхватятся сами.</p>

        {links.map((link, i) => {
          const { key } = detectPlatform(link.url);
          const brand = link.url ? PLATFORM_BRAND[key] : null;
          return (
            <div key={i} className="flex items-center gap-2">
              {brand ? (
                <span className="shrink-0 inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-white px-2">
                  <BrandIcon name={brand} size={isBrandWordmark(brand) ? 14 : 18} />
                </span>
              ) : (
                <span className="shrink-0 w-9 h-9 grid place-items-center rounded-md bg-white/5 border border-white/10 text-white/70">
                  <PlatformIcon platform={link.url ? key : 'website'} size={18} />
                </span>
              )}
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <input
                  type="url" value={link.url} disabled={busy}
                  onChange={(e) => updateLink(i, { url: e.target.value })}
                  placeholder="https://open.spotify.com/…"
                  className={inputCls}
                />
                <input
                  type="text" value={link.label ?? ''} disabled={busy}
                  onChange={(e) => updateLink(i, { label: e.target.value })}
                  placeholder={link.url ? `Подпись (по умолчанию «${linkLabel(link.url)}»)` : 'Подпись (необязательно)'}
                  className={`${inputCls} text-xs`}
                />
              </div>
              <button type="button" onClick={() => setLinks((p) => p.filter((_, j) => j !== i))}
                className="shrink-0 text-white/30 hover:text-red-400 transition-colors text-lg leading-none" aria-label="Удалить ссылку">
                ×
              </button>
            </div>
          );
        })}

        {links.length < MAX_SMART_LINKS && (
          <button type="button" onClick={() => setLinks((p) => [...p, { url: '' }])}
            className="self-start text-xs text-white/50 hover:text-white/80 transition-colors mt-1">
            + добавить ссылку
          </button>
        )}
      </div>

      {/* Публикация + submit */}
      <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
        <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} disabled={busy}
          className="w-4 h-4 accent-foreground" />
        Опубликовать (страница доступна по ссылке)
      </label>

      <button type="submit" disabled={busy}
        className="self-start rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
        {busy ? 'Сохранение…' : editing ? 'Сохранить' : 'Создать лендинг'}
      </button>
    </form>
  );
}

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30 transition-colors disabled:opacity-50 placeholder:text-white/30';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label} {hint && <span className="text-white/30 font-normal text-xs">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}
