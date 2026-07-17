'use client';

import { Field, Switch } from '@/components/ui-kit';
import { ColorField } from '@/components/color-field';
import { VerifiedBadge } from '@/components/verified-badge';
import { cn } from '@/lib/utils';
import { SANS_FONT_VARS as SANS_VAR, MONO_FONT_VARS as MONO_VAR } from '@/lib/font-catalog';

export interface ThemeValue {
  bg: string;
  text: string;
  accent: string;
  grain: boolean;
  fontSans: string;
  fontMono: string;
}

// light-темы дают переход тёмный nav → светлый фон — помечены флагом
const THEME_PRESETS: { name: string; bg: string; text: string; accent: string; light?: true }[] = [
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
  { name: 'Кремовый',     bg: '#f4f1ea', text: '#1c1a17', accent: '#b5532f', light: true },
  { name: 'Бумага',       bg: '#eeead9', text: '#23201b', accent: '#3a6b5f', light: true },
];

// не <select>: браузеры не позволяют свой font-family на каждом <option>
function FontGrid({
  name,
  value,
  onChange,
  fonts,
  disabled,
  ariaLabel,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  fonts: Record<string, string>;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div role="listbox" aria-label={ariaLabel} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <input type="hidden" name={name} value={value} />
      {Object.entries(fonts).map(([label, cssVar]) => {
        const active = value === label;
        return (
          <button
            key={label}
            type="button"
            role="option"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(label)}
            className={cn(
              'truncate rounded-lg border px-3 py-2.5 text-sm transition-colors disabled:opacity-50',
              active
                ? 'border-foreground/30 bg-foreground/10 text-foreground'
                : 'border-foreground/10 bg-foreground/[0.03] text-foreground/65 hover:border-foreground/20 hover:bg-foreground/[0.06] hover:text-foreground',
            )}
            style={{ fontFamily: cssVar }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeEditor({
  value,
  onChange,
  artistName,
  avatarUrl,
  disabled,
}: {
  value: ThemeValue;
  onChange: (v: ThemeValue) => void;
  artistName: string;
  avatarUrl: string | null;
  disabled?: boolean;
}) {
  const { bg, text: textColor, accent, grain, fontSans, fontMono } = value;

  // кегль имени под длину самого длинного слова — чтобы не рвалось в узком превью
  const longestWord = Math.max(1, ...artistName.split(/\s+/).map((w) => w.length));
  const previewNameRem = Math.max(0.95, Math.min(1.6, 12 / longestWord));

  function patch(partial: Partial<ThemeValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="order-2 flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <span className="text-xs text-foreground/40">Пресеты палитры</span>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {THEME_PRESETS.map((p) => {
              const active = bg === p.bg && textColor === p.text && accent === p.accent;
              return (
                <button
                  key={p.name}
                  type="button"
                  disabled={disabled}
                  onClick={() => patch({ bg: p.bg, text: p.text, accent: p.accent })}
                  aria-label={`Палитра ${p.name}`}
                  aria-pressed={active}
                  className="group relative flex flex-col items-center gap-1.5 disabled:opacity-50"
                >
                  <div
                    className={cn(
                      'relative w-full overflow-hidden rounded-lg transition-all',
                      active ? 'ring-2 ring-white/60' : 'ring-1 ring-white/10 hover:ring-white/30',
                    )}
                    style={{ background: p.bg, paddingTop: '70%' }}
                  >
                    <span className="absolute left-1.5 top-1.5 h-2.5 w-2.5 rounded-full" style={{ background: p.accent }} />
                    <span className="absolute bottom-2 left-1.5 right-1.5 h-0.5 rounded-full" style={{ background: p.text, opacity: 0.5 }} />
                    <span className="absolute bottom-3.5 left-1.5 h-0.5 rounded-full" style={{ background: p.text, opacity: 0.25, width: '55%' }} />
                    {p.light && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-yellow-400/70" title="Световая тема" />}
                  </div>
                  <span className="w-full truncate text-center text-[10px] leading-none text-foreground/40 transition-colors group-hover:text-foreground/70">
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] leading-snug text-foreground/25">
            Жёлтая точка — световая тема. Создаёт контраст при переходе с тёмного навбара.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ColorField label="Фон" name="bg" value={bg} onChange={(v) => patch({ bg: v })} disabled={disabled} />
          <ColorField label="Текст" name="text" value={textColor} onChange={(v) => patch({ text: v })} disabled={disabled} />
          <ColorField label="Акцент" name="accent" value={accent} onChange={(v) => patch({ accent: v })} disabled={disabled} />
          <Field label="Зерно">
            <Switch checked={grain} onChange={(v) => patch({ grain: v })} disabled={disabled} aria-label="Зерно" />
          </Field>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Основной">
            <FontGrid name="fontSans" value={fontSans} onChange={(v) => patch({ fontSans: v })} fonts={SANS_VAR} disabled={disabled} ariaLabel="Шрифт текста" />
          </Field>
          <Field label="Моно">
            <FontGrid name="fontMono" value={fontMono} onChange={(v) => patch({ fontMono: v })} fonts={MONO_VAR} disabled={disabled} ariaLabel="Шрифт моно" />
          </Field>
        </div>
      </div>

      <aside className="order-1 w-full self-start">
        <span className="mb-2 block text-xs text-foreground/40">Превью страницы</span>
        <div
          className="overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-colors"
          style={{ background: bg, fontFamily: SANS_VAR[fontSans], color: textColor }}
        >
          <div className="flex h-7 items-center gap-2 px-4" style={{ background: '#0e0d0b' }}>
            <div className="h-2 w-12 rounded-full" style={{ background: '#ffffff18' }} />
            <div className="ml-auto flex gap-2">
              <div className="h-2 w-6 rounded-full" style={{ background: '#ffffff18' }} />
              <div className="h-2 w-6 rounded-full" style={{ background: '#ffffff18' }} />
            </div>
          </div>

          <div
            className="relative px-5 pb-5 pt-6"
            style={{
              background:
                'radial-gradient(ellipse 60% 90% at 88% 45%, color-mix(in oklch, ' + accent + ' 22%, ' + bg + '), ' + bg + ')',
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
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="break-words font-bold leading-[0.95] tracking-tight" style={{ fontSize: `${previewNameRem}rem` }}>
                  {artistName}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <VerifiedBadge color={accent} fontFamily={MONO_VAR[fontMono]} />
                  <span className="rounded-full px-3 py-1 text-[10px] font-medium" style={{ background: accent, color: bg }}>
                    Подписаться
                  </span>
                </div>
              </div>
              <div className="relative shrink-0">
                <div aria-hidden="true" className="absolute inset-0 scale-150 rounded-full opacity-40 blur-xl" style={{ background: accent }} />
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="relative h-16 w-16 rounded-full object-cover" style={{ boxShadow: `0 0 0 1.5px color-mix(in oklch, ${accent} 55%, transparent)` }} />
                ) : (
                  <div
                    className="relative grid h-16 w-16 place-items-center rounded-full text-xl font-bold"
                    style={{
                      background: `color-mix(in oklch, ${accent} 18%, ${bg})`,
                      color: accent,
                      boxShadow: `0 0 0 1.5px color-mix(in oklch, ${accent} 55%, transparent)`,
                    }}
                  >
                    {artistName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 px-5 pb-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="w-full rounded-md" style={{ paddingTop: '100%', background: i === 0 ? accent : textColor, opacity: i === 0 ? 0.18 : 0.06 }} />
                <div className="h-1.5 rounded-full" style={{ background: textColor, opacity: 0.2, width: `${70 - i * 12}%` }} />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
