'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ArtistProfile, ArtistLink } from '@vire/core';

const FONT_SANS = ['Inter', 'Montserrat', 'Unbounded', 'Manrope', 'Geologica'];
const FONT_MONO = ['JetBrains Mono', 'Fira Code', 'IBM Plex Mono'];

export function EditProfileForm({ artist }: { artist: ArtistProfile }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(artist.avatarUrl);
  const [links, setLinks] = useState<ArtistLink[]>(artist.links);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // Theme live preview
  const t = artist.themeTokens;
  const [bg, setBg] = useState(t.bg);
  const [textColor, setTextColor] = useState(t.text);
  const [accent, setAccent] = useState(t.accent);
  const [grain, setGrain] = useState(t.grain);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      const fd = new FormData(e.currentTarget);
      fd.set('grain', grain ? '1' : '0');
      fd.set('links', JSON.stringify(links));
      if (removeAvatar) fd.set('removeAvatar', '1');

      const res = await fetch('/api/v1/dashboard/profile', { method: 'POST', body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (avatarPreview && avatarPreview !== artist.avatarUrl) URL.revokeObjectURL(avatarPreview);
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
      setRemoveAvatar(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-7">

      {/* Name */}
      <Field label="Имя артиста">
        <input name="name" type="text" required disabled={busy}
          defaultValue={artist.name}
          className={inp} />
      </Field>

      {/* Bio */}
      <Field label="Биография" hint="необязательно">
        <textarea name="bio" rows={4} disabled={busy}
          defaultValue={artist.bio ?? ''}
          placeholder="Расскажи о себе…"
          className={`${inp} resize-none`} />
      </Field>

      {/* Links */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Ссылки</span>
          <span className="text-xs text-white/30">до 10 ссылок</span>
        </div>

        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Название"
              value={link.label}
              disabled={busy}
              onChange={(e) =>
                setLinks((prev) =>
                  prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l),
                )
              }
              className={`${inp} w-32 shrink-0`}
            />
            <input
              type="url"
              placeholder="https://…"
              value={link.url}
              disabled={busy}
              onChange={(e) =>
                setLinks((prev) =>
                  prev.map((l, j) => j === i ? { ...l, url: e.target.value } : l),
                )
              }
              className={inp}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
              className="shrink-0 text-white/30 hover:text-red-400 transition-colors text-lg leading-none"
              aria-label="Удалить ссылку"
            >
              ×
            </button>
          </div>
        ))}

        {links.length < 10 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setLinks((prev) => [...prev, { label: '', url: '' }])}
            className="self-start text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            + добавить ссылку
          </button>
        )}
      </div>

      {/* Avatar */}
      <Field label="Аватар" hint="JPEG, PNG или WebP · необязательно">
        <div className="flex items-center gap-4">
          {avatarPreview && !removeAvatar ? (
            <img src={avatarPreview} alt="avatar" className="w-16 h-16 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-xl font-medium shrink-0">
              {artist.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"
              disabled={busy} onChange={handleAvatarChange}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-white/20 disabled:opacity-50" />
            {artist.avatarUrl && !removeAvatar && (
              <button type="button" onClick={() => { setRemoveAvatar(true); setAvatarPreview(null); }}
                className="text-xs text-white/40 hover:text-red-400 transition-colors text-left">
                Удалить аватар
              </button>
            )}
          </div>
        </div>
      </Field>

      {/* Theme tokens */}
      <div className="flex flex-col gap-4 pt-1">
        <p className="text-sm font-medium">Тема страницы</p>

        {/* Live preview strip */}
        <div
          className="rounded-lg px-4 py-3 flex items-center gap-3 text-sm transition-colors"
          style={{ background: bg, color: textColor }}
        >
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: accent }} />
          <span className="font-medium">{artist.name}</span>
          <span className="opacity-40 text-xs ml-auto">предпросмотр</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Фон" name="bg" value={bg} onChange={setBg} disabled={busy} />
          <ColorField label="Текст" name="text" value={textColor} onChange={setTextColor} disabled={busy} />
          <ColorField label="Акцент" name="accent" value={accent} onChange={setAccent} disabled={busy} />

          <Field label="Зерно">
            <button type="button" onClick={() => setGrain((g) => !g)}
              className={`w-10 h-5 rounded-full transition-colors relative ${grain ? 'bg-white/60' : 'bg-white/15'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${grain ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Шрифт текста">
            <select name="fontSans" defaultValue={t.fontSans} disabled={busy} className={inp}>
              {FONT_SANS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Шрифт моно">
            <select name="fontMono" defaultValue={t.fontMono} disabled={busy} className={inp}>
              {FONT_MONO.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-green-400">Сохранено</p>}

      <div className="flex items-center gap-4 pt-1">
        <button type="submit" disabled={busy}
          className="rounded-md bg-white text-black px-5 py-2 text-sm font-medium hover:opacity-80 disabled:opacity-40 transition-opacity">
          {busy ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <a href="/dashboard" className="text-sm text-white/40 hover:text-white/70 transition-colors">
          Отмена
        </a>
      </div>
    </form>
  );
}

function ColorField({ label, name, value, onChange, disabled }: {
  label: string; name: string; value: string;
  onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" name={name} value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0 disabled:opacity-50" />
        <input type="text" value={value} readOnly
          className="w-24 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono focus:outline-none" />
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-white/30">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inp = 'rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50 w-full';
