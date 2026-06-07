'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ArtistLink, ArtistVideo, ThemeTokens } from '@vire/core';

// Font name → CSS variable (the fonts are loaded globally in app/layout via lib/fonts).
const SANS_VAR: Record<string, string> = {
  Inter: 'var(--font-inter)',
  Montserrat: 'var(--font-montserrat)',
  Unbounded: 'var(--font-unbounded)',
  Manrope: 'var(--font-manrope)',
  Geologica: 'var(--font-geologica)',
};
const MONO_VAR: Record<string, string> = {
  'JetBrains Mono': 'var(--font-jetbrains-mono)',
  'Fira Code': 'var(--font-fira-code)',
  'IBM Plex Mono': 'var(--font-ibm-plex-mono)',
};
const FONT_SANS = Object.keys(SANS_VAR);
const FONT_MONO = Object.keys(MONO_VAR);

// Готовые палитры темы: клик применяет фон/текст/акцент разом. Ручной ввод остаётся.
const THEME_PRESETS: { name: string; bg: string; text: string; accent: string }[] = [
  { name: 'Тёмный тёплый', bg: '#100f0d', text: '#e9e2d0', accent: '#6f9d92' },
  { name: 'Уголь', bg: '#121212', text: '#ededed', accent: '#ff5c39' },
  { name: 'Ночь', bg: '#0a0a12', text: '#d8d8e8', accent: '#7c6cff' },
  { name: 'Сепия', bg: '#1a1410', text: '#e7d6bd', accent: '#c98a3a' },
  { name: 'Мята', bg: '#0e1513', text: '#dceee7', accent: '#57c2a3' },
  { name: 'Неон', bg: '#0b0b0b', text: '#f0f0f0', accent: '#c8ff3d' },
  { name: 'Кремовый', bg: '#f4f1ea', text: '#1c1a17', accent: '#b5532f' },
  { name: 'Бумага', bg: '#efe9dd', text: '#23201b', accent: '#3a6b5f' },
];

// Date-free subset of ArtistProfile — RSC can't serialize Date props to a client component
export interface EditableProfile {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  themeTokens: ThemeTokens;
  links: ArtistLink[];
  videos: ArtistVideo[];
}

export function EditProfileForm({ artist }: { artist: EditableProfile }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(artist.avatarUrl);
  const [links, setLinks] = useState<ArtistLink[]>(artist.links);
  const [videos, setVideos] = useState<ArtistVideo[]>(artist.videos);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  // Theme live preview
  const t = artist.themeTokens;
  const [bg, setBg] = useState(t.bg);
  const [textColor, setTextColor] = useState(t.text);
  const [accent, setAccent] = useState(t.accent);
  const [grain, setGrain] = useState(t.grain);
  const [fontSans, setFontSans] = useState(t.fontSans);
  const [fontMono, setFontMono] = useState(t.fontMono);

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
      fd.set('videos', JSON.stringify(videos));
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
          className={`${inp} w-full`} />
      </Field>

      {/* Bio */}
      <Field label="Биография" hint="необязательно">
        <textarea name="bio" rows={4} disabled={busy}
          defaultValue={artist.bio ?? ''}
          placeholder="Расскажи о себе…"
          className={`${inp} w-full resize-none`} />
      </Field>

      {/* Links */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Ссылки</span>
          <span className="text-xs text-white/30">до 10 ссылок</span>
        </div>
        <p className="text-xs text-white/40 -mt-1">
          Соцсети и площадки. Название — это подпись кнопки, ссылка — куда она ведёт.
          Появятся блоком на твоей странице артиста.
        </p>

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
              className={`${inp} flex-1 min-w-0`}
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

      {/* Videos */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Видео</span>
          <span className="text-xs text-white/30">YouTube или VK · до 20</span>
        </div>
        <p className="text-xs text-white/40 -mt-1">
          Клипы и влоги. Вставь ссылку на ролик YouTube или VK — он встроится плеером
          на твоей странице артиста.
        </p>

        {videos.map((video, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Название"
              value={video.title}
              disabled={busy}
              onChange={(e) =>
                setVideos((prev) =>
                  prev.map((v, j) => j === i ? { ...v, title: e.target.value } : v),
                )
              }
              className={`${inp} w-36 shrink-0`}
            />
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=…"
              value={video.url}
              disabled={busy}
              onChange={(e) =>
                setVideos((prev) =>
                  prev.map((v, j) => j === i ? { ...v, url: e.target.value } : v),
                )
              }
              className={`${inp} flex-1 min-w-0`}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => setVideos((prev) => prev.filter((_, j) => j !== i))}
              className="shrink-0 text-white/30 hover:text-red-400 transition-colors text-lg leading-none"
              aria-label="Удалить видео"
            >
              ×
            </button>
          </div>
        ))}

        {videos.length < 20 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setVideos((prev) => [...prev, { title: '', url: '' }])}
            className="self-start text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            + добавить видео
          </button>
        )}
      </div>

      {/* Avatar */}
      <Field label="Аватар" hint="JPEG, PNG или WebP · необязательно">
        <div className="flex items-center gap-4">
          {avatarPreview && !removeAvatar ? (
            // Локальное превью выбранного файла (blob:) — next/image его не оптимизирует
            // eslint-disable-next-line @next/next/no-img-element
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
          style={{ background: bg, color: textColor, fontFamily: SANS_VAR[fontSans] }}
        >
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: accent }} />
          <span className="font-medium">{artist.name}</span>
          <span className="opacity-40 ml-auto" style={{ fontFamily: MONO_VAR[fontMono] }}>123 · предпросмотр</span>
        </div>

        {/* Пресеты палитр — клик применяет фон/текст/акцент разом */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-white/40">Пресеты палитры</span>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((p) => {
              const active = bg === p.bg && textColor === p.text && accent === p.accent;
              return (
                <button
                  key={p.name}
                  type="button"
                  disabled={busy}
                  onClick={() => { setBg(p.bg); setTextColor(p.text); setAccent(p.accent); }}
                  title={p.name}
                  aria-label={`Палитра ${p.name}`}
                  aria-pressed={active}
                  className={`relative h-9 w-14 rounded-md overflow-hidden border transition-all disabled:opacity-50 ${active ? 'border-white/70 ring-1 ring-white/40' : 'border-white/10 hover:border-white/30'}`}
                  style={{ background: p.bg }}
                >
                  <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full" style={{ background: p.accent }} />
                  <span className="absolute bottom-1.5 left-1.5 right-1.5 h-1 rounded-full" style={{ background: p.text }} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Фон" name="bg" value={bg} onChange={setBg} disabled={busy} />
          <ColorField label="Текст" name="text" value={textColor} onChange={setTextColor} disabled={busy} />
          <ColorField label="Акцент" name="accent" value={accent} onChange={setAccent} disabled={busy} />

          <Field label="Зерно">
            <button
              type="button"
              role="switch"
              aria-checked={grain}
              onClick={() => setGrain((g) => !g)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${grain ? 'bg-white/60' : 'bg-white/15'}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${grain ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
              />
            </button>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Шрифт текста">
            <select name="fontSans" value={fontSans} onChange={(e) => setFontSans(e.target.value)} disabled={busy} className={`${inp} w-full`}>
              {FONT_SANS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Шрифт моно">
            <select name="fontMono" value={fontMono} onChange={(e) => setFontMono(e.target.value)} disabled={busy} className={`${inp} w-full`}>
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
        <input
          type="text"
          value={value}
          disabled={disabled}
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith('#')) v = `#${v}`;
            onChange(v);
          }}
          placeholder="#000000"
          className="w-24 rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50" />
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

// Базовые стили инпута БЕЗ ширины — ширину задаёт каждое поле явно, иначе
// `w-full` конфликтует с `w-32`/`flex-1` в строках ссылок и видео.
const inp = 'rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50';
