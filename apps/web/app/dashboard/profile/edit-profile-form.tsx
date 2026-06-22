'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ArtistLink, ArtistVideo, ThemeTokens } from '@vire/core';
import { btnPrimary } from '@/components/ui-kit';
import { Select } from '@/components/select';
import { ColorField } from '@/components/color-field';
import { LinksEditor } from '@/components/links-editor';

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
// Тёмные темы переходят в платформенный шелл (nav + player) без резкого контраста.
// Световые работают, но создают переход тёмный nav → светлый фон — отмечены флагом.
const THEME_PRESETS: { name: string; bg: string; text: string; accent: string; light?: true }[] = [
  // — Тёмные —
  { name: 'Платформа',    bg: '#121210', text: '#edebe5', accent: '#9b8e7e' },
  { name: 'Тёплый',       bg: '#100f0d', text: '#e9e2d0', accent: '#6f9d92' },
  { name: 'Уголь',        bg: '#111111', text: '#ededed', accent: '#ff5c39' },
  { name: 'Ночь',         bg: '#0a0a12', text: '#d8d8e8', accent: '#7c6cff' },
  { name: 'Сепия',        bg: '#1a1410', text: '#e7d6bd', accent: '#c98a3a' },
  { name: 'Мята',         bg: '#0e1513', text: '#dceee7', accent: '#57c2a3' },
  { name: 'Неон',         bg: '#0b0b0b', text: '#f0f0f0', accent: '#c8ff3d' },
  { name: 'Аметист',      bg: '#0d0b14', text: '#dcd4f2', accent: '#a87fff' },
  { name: 'Ржавчина',     bg: '#130a08', text: '#ead3c6', accent: '#d45628' },
  { name: 'Лёд',          bg: '#080e16', text: '#cce4f6', accent: '#4bbde8' },
  // — Световые —
  { name: 'Кремовый',     bg: '#f4f1ea', text: '#1c1a17', accent: '#b5532f', light: true },
  { name: 'Бумага',       bg: '#eeead9', text: '#23201b', accent: '#3a6b5f', light: true },
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

  // Кегль имени в превью подгоняем под длину самого длинного слова — крупно для
  // коротких имён, мельче для длинных, чтобы оно не рвалось в узком hero превью.
  const longestWord = Math.max(1, ...artist.name.split(/\s+/).map((w) => w.length));
  const previewNameRem = Math.max(0.95, Math.min(1.6, 12 / longestWord));

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
      <LinksEditor
        title="Ссылки"
        hint="Соцсети и площадки — иконка и название подхватятся сами; для нераспознанных задай подпись. Появятся блоком на твоей странице артиста."
        links={links}
        onChange={setLinks}
        max={10}
        disabled={busy}
      />

      {/* Videos */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Видео</span>
          <span className="text-xs text-foreground/30">YouTube или VK · до 20</span>
        </div>
        <p className="text-xs text-foreground/40 -mt-1">
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
              className="shrink-0 text-foreground/30 hover:text-red-400 transition-colors text-lg leading-none"
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
            className="self-start text-sm text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            + добавить видео
          </button>
        )}
      </div>

      {/* Avatar */}
      <Field label="Аватар" hint="Около-квадрат, от 400×400 · JPEG/PNG/WebP · необязательно">
        <div className="flex items-center gap-4">
          {avatarPreview && !removeAvatar ? (
            // Локальное превью выбранного файла (blob:) — next/image его не оптимизирует
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarPreview} alt="avatar" className="w-16 h-16 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-foreground/10 flex items-center justify-center text-xl font-medium shrink-0">
              {artist.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"
              disabled={busy} onChange={handleAvatarChange}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm file:cursor-pointer hover:file:bg-foreground/20 disabled:opacity-50" />
            {artist.avatarUrl && !removeAvatar && (
              <button type="button" onClick={() => { setRemoveAvatar(true); setAvatarPreview(null); }}
                className="text-xs text-foreground/40 hover:text-red-400 transition-colors text-left">
                Удалить аватар
              </button>
            )}
          </div>
        </div>
      </Field>

      {/* Theme tokens */}
      <div className="flex flex-col gap-4 pt-1">
        <p className="text-sm font-medium">Тема страницы</p>

        {/* Live preview — уменьшённая копия реальной страницы артиста: тот же
            full-bleed hero с accent-свечением, крупным именем в выбранном шрифте,
            аватаром в accent-кольце, verified-чипом и follow-пиллом. Так превью
            предсказывает факт, а не показывает «другой экран». */}
        <div
          className="rounded-xl overflow-hidden transition-colors"
          style={{ background: bg, fontFamily: SANS_VAR[fontSans], color: textColor }}
        >
          {/* Тонкая полоса навбара платформы — сохраняет историю «стыковки»
              тёмной оболочки с фоном артиста (важно для светлых тем). */}
          <div className="h-7 px-4 flex items-center gap-2" style={{ background: '#0e0d0b' }}>
            <div className="w-12 h-2 rounded-full" style={{ background: '#ffffff18' }} />
            <div className="ml-auto flex gap-2">
              <div className="w-6 h-2 rounded-full" style={{ background: '#ffffff18' }} />
              <div className="w-6 h-2 rounded-full" style={{ background: '#ffffff18' }} />
            </div>
          </div>

          {/* Hero: тот же радиальный accent-глоу, что и на реальной странице */}
          <div
            className="relative px-5 pt-6 pb-5"
            style={{
              background:
                'radial-gradient(ellipse 60% 90% at 88% 45%, color-mix(in oklch, ' +
                accent + ' 22%, ' + bg + '), ' + bg + ')',
            }}
          >
            {grain && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  opacity: 0.05,
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                  backgroundRepeat: 'repeat',
                  backgroundSize: '180px 180px',
                }}
              />
            )}
            <div className="relative flex items-end gap-4">
              {/* Имя + verified + follow */}
              <div className="flex-1 min-w-0 space-y-2.5">
                <div
                  className="font-bold tracking-tight leading-[0.95] break-words"
                  style={{ fontSize: `${previewNameRem}rem` }}
                >
                  {artist.name}
                </div>
                <span
                  className="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-sm border"
                  style={{
                    fontFamily: MONO_VAR[fontMono],
                    borderColor: `color-mix(in oklch, ${accent} 45%, transparent)`,
                    color: accent,
                  }}
                >
                  ★ verified
                </span>
                <div
                  className="inline-block text-[10px] font-medium px-3 py-1 rounded-full"
                  style={{ background: accent, color: bg }}
                >
                  Подписаться
                </div>
              </div>
              {/* Аватар в accent-кольце с глоу */}
              <div className="relative shrink-0">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full blur-xl opacity-40 scale-150"
                  style={{ background: accent }}
                />
                {avatarPreview && !removeAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt=""
                    className="relative w-16 h-16 rounded-full object-cover"
                    style={{ boxShadow: `0 0 0 1.5px color-mix(in oklch, ${accent} 55%, transparent)` }}
                  />
                ) : (
                  <div
                    className="relative w-16 h-16 rounded-full grid place-items-center text-xl font-bold"
                    style={{
                      background: `color-mix(in oklch, ${accent} 18%, ${bg})`,
                      color: accent,
                      boxShadow: `0 0 0 1.5px color-mix(in oklch, ${accent} 55%, transparent)`,
                    }}
                  >
                    {artist.name[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Релизы — ровная сетка, как на реальной странице */}
          <div className="px-5 pb-5 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div
                  className="w-full rounded-md"
                  style={{ paddingTop: '100%', background: i === 0 ? accent : textColor, opacity: i === 0 ? 0.18 : 0.06 }}
                />
                <div className="h-1.5 rounded-full" style={{ background: textColor, opacity: 0.2, width: `${70 - i * 12}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Пресеты палитр — клик применяет фон/текст/акцент разом */}
        <div className="flex flex-col gap-3">
          <span className="text-xs text-foreground/40">Пресеты палитры</span>
          <div className="grid grid-cols-6 gap-2">
            {THEME_PRESETS.map((p) => {
              const active = bg === p.bg && textColor === p.text && accent === p.accent;
              return (
                <button
                  key={p.name}
                  type="button"
                  disabled={busy}
                  onClick={() => { setBg(p.bg); setTextColor(p.text); setAccent(p.accent); }}
                  aria-label={`Палитра ${p.name}`}
                  aria-pressed={active}
                  className={`group relative flex flex-col items-center gap-1.5 disabled:opacity-50`}
                >
                  <div
                    className={`relative w-full rounded-lg overflow-hidden transition-all ${active ? 'ring-2 ring-white/60' : 'ring-1 ring-white/10 hover:ring-white/30'}`}
                    style={{ background: p.bg, paddingTop: '70%' }}
                  >
                    {/* Акцент-точка */}
                    <span
                      className="absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full"
                      style={{ background: p.accent }}
                    />
                    {/* Имитация текста */}
                    <span
                      className="absolute bottom-2 left-1.5 right-1.5 h-0.5 rounded-full"
                      style={{ background: p.text, opacity: 0.5 }}
                    />
                    <span
                      className="absolute bottom-3.5 left-1.5 h-0.5 rounded-full"
                      style={{ background: p.text, opacity: 0.25, width: '55%' }}
                    />
                    {/* Световая метка */}
                    {p.light && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-400/70" title="Световая тема" />
                    )}
                  </div>
                  <span className="text-[10px] text-foreground/40 leading-none text-center w-full truncate group-hover:text-foreground/70 transition-colors">
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-foreground/25 leading-snug">
            Жёлтая точка — световая тема. Создаёт контраст при переходе с тёмного навбара.
          </p>
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
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${grain ? 'bg-foreground/60' : 'bg-foreground/15'}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${grain ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
              />
            </button>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Шрифт текста">
            <Select
              name="fontSans"
              value={fontSans}
              onValueChange={setFontSans}
              disabled={busy}
              aria-label="Шрифт текста"
              options={FONT_SANS.map((f) => ({ value: f, label: f }))}
            />
          </Field>
          <Field label="Шрифт моно">
            <Select
              name="fontMono"
              value={fontMono}
              onValueChange={setFontMono}
              disabled={busy}
              aria-label="Шрифт моно"
              options={FONT_MONO.map((f) => ({ value: f, label: f }))}
            />
          </Field>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Сохранено</p>}

      <div className="flex items-center gap-4 pt-1">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? 'Сохраняю…' : 'Сохранить'}
        </button>
        <a href="/dashboard" className="text-sm text-foreground/40 hover:text-foreground/70 transition-colors">
          Отмена
        </a>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-foreground/30">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// Базовые стили инпута БЕЗ ширины — ширину задаёт каждое поле явно, иначе
// `w-full` конфликтует с `w-32`/`flex-1` в строках ссылок и видео.
const inp = 'rounded-md bg-foreground/5 border border-foreground/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50';
