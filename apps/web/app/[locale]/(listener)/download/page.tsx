import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContentHero, StatusPill } from '@/components/content-kit';
import { Icon, type IconName } from '@/components/icon';
import { InstallAppButton } from '@/components/install-app-button';
import { WindowsDownloadCta } from '@/components/windows-download-cta';
import { pageMetadata } from '@/lib/metadata';
import { resolveLocale } from '@/lib/locale';
import { getWindowsDownloadUrl } from '@/lib/desktop-download';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations('download.meta'), resolveLocale()]);
  return pageMetadata({ url: '/download', title: t('title'), description: t('description'), locale });
}

const COMING_SOON: { key: 'macos' | 'linux' | 'ios' | 'android'; icon: IconName }[] = [
  { key: 'macos', icon: 'square' },
  { key: 'linux', icon: 'terminal' },
  { key: 'ios', icon: 'phone' },
  { key: 'android', icon: 'phone' },
];

export default async function DownloadPage() {
  const t = await getTranslations('download');
  const windowsUrl = getWindowsDownloadUrl();

  return (
    <main className="mx-auto min-h-full max-w-3xl px-6 py-16 sm:py-20 space-y-14">
      <ContentHero
        glow
        size="lg"
        badge={<StatusPill>{t('hero.badge')}</StatusPill>}
        title={t('hero.title')}
        subtitle={t('hero.subtitle')}
      />

      <section id="windows" className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10">
            <Icon name="layout" size={22} className="text-primary" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t('platforms.windows.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('platforms.windows.text')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <WindowsDownloadCta windowsUrl={windowsUrl} />
          <span className="label-mono text-xs text-muted-foreground">{t('platforms.windows.meta')}</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COMING_SOON.map(({ key, icon }) => (
          <div key={key} className="space-y-3 rounded-xl border border-dashed border-border bg-card/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background">
                <Icon name={icon} size={17} className="text-muted-foreground" />
              </span>
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t(`platforms.${key}.badge`)}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-medium">{t(`platforms.${key}.title`)}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t(`platforms.${key}.text`)}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-7 space-y-4">
        <div className="flex items-center gap-2.5">
          <Icon name="globe" size={18} className="text-primary" />
          <h2 className="text-base font-semibold">{t('pwa.title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">{t('pwa.text')}</p>
        {/* InstallAppButton может вернуть null (уже установлено / браузер не даёт beforeinstallprompt) */}
        <div className="empty:hidden max-w-sm">
          <InstallAppButton />
        </div>
      </section>
    </main>
  );
}
