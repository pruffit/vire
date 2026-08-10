'use client';

import { useTranslations } from 'next-intl';
import { useReduceMotionPref, setReduceMotionPref } from '@vire/ui/motion';
import { LOCALES, LOCALE_LABELS } from '@vire/i18n/config';
import { useLocaleSwitch } from '@/lib/use-locale-switch';
import { cn } from '@/lib/utils';

export function AppearanceSettings() {
  const t = useTranslations('profile.appearanceSettings');
  const reduce = useReduceMotionPref();
  const { locale, switchLocale, pending } = useLocaleSwitch();

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card/60 px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('languageTitle')}</p>
            <p className="text-xs text-muted-foreground">{LOCALE_LABELS[locale]}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={l === locale}
                disabled={pending}
                onClick={() => switchLocale(l)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer disabled:opacity-50',
                  l === locale ? 'bg-primary text-primary-foreground' : 'bg-foreground/5 text-foreground/60 hover:bg-foreground/10',
                )}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('reduceMotionTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('reduceMotionDescription')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reduce}
            aria-label={t('reduceMotionTitle')}
            onClick={() => setReduceMotionPref(!reduce)}
            className="shrink-0 grid place-items-center min-h-11 min-w-11 cursor-pointer"
          >
            <span
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full ring-1 ring-inset transition-colors',
                reduce ? 'bg-primary ring-primary' : 'bg-foreground/15 ring-border',
              )}
            >
              <span
                className={cn(
                  'absolute left-0.5 inline-block h-5 w-5 rounded-full shadow-sm transition-[transform,background-color]',
                  reduce ? 'translate-x-5 bg-background' : 'bg-foreground',
                )}
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
