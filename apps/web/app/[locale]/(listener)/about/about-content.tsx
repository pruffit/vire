'use client';

import { Link } from '@/i18n/navigation';
import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { Reveal, Stagger, StaggerItem } from '@vire/ui/motion';
import { Icon, type IconName } from '@/components/icon';
import { BrandIcon, type BrandName } from '@/components/brand-icon';
import { ExplicitBadge } from '@/components/explicit-badge';
import { ContentHero, NumberedSection, FeatureCard, StatusPill } from '@/components/content-kit';
import { getSiteFaq } from '@/lib/faq';

interface Feature {
  icon: IconName;
  title: string;
  text: string;
}

const FOR_LISTENERS_ICONS: { key: string; icon: IconName }[] = [
  { key: 'player', icon: 'play-circle' },
  { key: 'wave', icon: 'shuffle' },
  { key: 'likes', icon: 'heart' },
  { key: 'playlists', icon: 'list' },
  { key: 'follows', icon: 'users' },
  { key: 'moodTags', icon: 'hash' },
  { key: 'favoriteMoments', icon: 'star' },
  { key: 'syncedLyrics', icon: 'align-left' },
  { key: 'sharing', icon: 'share-2' },
  { key: 'listeningNow', icon: 'volume-2' },
  { key: 'search', icon: 'search' },
];

const FOR_ARTISTS_ICONS: { key: string; icon: IconName }[] = [
  { key: 'page', icon: 'image' },
  { key: 'upload', icon: 'upload' },
  { key: 'trackCard', icon: 'music' },
  { key: 'lyrics', icon: 'align-left' },
  { key: 'analytics', icon: 'pie-chart' },
  { key: 'posts', icon: 'bell' },
  { key: 'smartlinks', icon: 'link-2' },
];

const SMARTLINK_DEMO: BrandName[] = ['spotify', 'apple-music', 'vk-music', 'youtube-music', 'soundcloud'];

const SHORTCUT_KEYS: string[][] = [
  ['/'],
  ['Ctrl', 'K'],
  ['Ctrl', 'F'],
  ['Space'],
  ['←'],
  ['→'],
  ['Shift', '←'],
  ['Shift', '→'],
  ['M'],
  ['R'],
];

export function AboutContent() {
  const t = useTranslations('about');
  const tFaq = useTranslations('faq');

  const moods = t.raw('examples.moods') as string[];
  const lyrics = t.raw('examples.lyrics') as string[];

  const forListeners: Feature[] = FOR_LISTENERS_ICONS.map(({ key, icon }) => ({
    icon,
    title: t(`forListeners.features.${key}.title`),
    text: t(`forListeners.features.${key}.text`),
  }));
  const forArtists: Feature[] = FOR_ARTISTS_ICONS.map(({ key, icon }) => ({
    icon,
    title: t(`forArtists.features.${key}.title`),
    text: t(`forArtists.features.${key}.text`),
  }));

  const shortcutItems = (t.raw('shortcuts.items') as { group: string; desc: string }[]).map((item, i) => ({
    ...item,
    keys: SHORTCUT_KEYS[i],
  }));

  const faq = getSiteFaq(tFaq);

  return (
    <main className="mx-auto min-h-full max-w-3xl px-6 py-16 sm:py-20 space-y-24">
      {/* Hero */}
      <ContentHero
        glow
        size="lg"
        badge={<StatusPill>{t('badge')}</StatusPill>}
        title={
          <>
            {t('hero.titleLine1')}{' '}
            <br />
            <span className="text-primary">{t('hero.titleAccent')}</span>
          </>
        }
        subtitle={t('hero.subtitle')}
      />

      {/* 01 — Roadmap */}
      <NumberedSection index={t('roadmap.index')} title={t('roadmap.title')}>
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-7">
          <ProgressRow icon="check" label={t('roadmap.stage1.label')} caption={t('roadmap.stage1.caption')} value={100} done />
          <ProgressRow icon="settings" label={t('roadmap.stage2.label')} caption={t('roadmap.stage2.caption')} value={20} />
          <ProgressRow icon="users" label={t('roadmap.stage3.label')} caption={t('roadmap.stage3.caption')} value={5} />
        </div>
      </NumberedSection>

      {/* 02 — Examples */}
      <NumberedSection index={t('examples.index')} title={t('examples.title')} subtitle={t('examples.subtitle')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DemoCard icon="shuffle" title={t('examples.wave')}>
            <Equalizer />
          </DemoCard>

          <DemoCard icon="hash" title={t('examples.moodTags')}>
            <div className="flex flex-wrap gap-2">
              {moods.map((m) => (
                <span key={m} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                  {m}
                </span>
              ))}
            </div>
          </DemoCard>

          <DemoCard icon="link-2" title={t('examples.smartlink')}>
            <div className="flex flex-wrap items-center gap-2">
              {SMARTLINK_DEMO.map((b) => (
                <span key={b} className="inline-flex items-center rounded-lg bg-white px-2 py-1.5 transition-transform hover:-translate-y-0.5">
                  <BrandIcon name={b} size={16} />
                </span>
              ))}
            </div>
          </DemoCard>

          <DemoCard icon="music" title={t('examples.trackLabeling')}>
            <div className="space-y-2">
              <TrackLine n={1} title={t('examples.track1')} explicit />
              <TrackLine n={2} title={t('examples.track2')} />
            </div>
          </DemoCard>

          <DemoCard icon="align-left" title={t('examples.syncedLyrics')}>
            <div className="space-y-1.5 text-sm">
              <p className="text-muted-foreground/40">{lyrics[0]}</p>
              <p className="font-medium text-foreground">{lyrics[1]}</p>
              <p className="text-muted-foreground/40">{lyrics[2]}</p>
            </div>
          </DemoCard>
        </div>
      </NumberedSection>

      {/* 03 — For listeners */}
      <NumberedSection index={t('forListeners.index')} title={t('forListeners.title')}>
        <FeatureGrid items={forListeners} />
      </NumberedSection>

      {/* 04 — For artists */}
      <NumberedSection index={t('forArtists.index')} title={t('forArtists.title')}>
        <FeatureGrid items={forArtists} />
      </NumberedSection>

      {/* 05 — What's next */}
      <NumberedSection index={t('whatsNext.index')} title={t('whatsNext.title')}>
        <NextStageTeaser t={t} />
      </NumberedSection>

      {/* 06 — Shortcuts */}
      <NumberedSection index={t('shortcuts.index')} title={t('shortcuts.title')}>
        <ShortcutsTable items={shortcutItems} />
      </NumberedSection>

      {/* 07 — FAQ */}
      <NumberedSection index={t('faqSection.index')} title={t('faqSection.title')}>
        <FaqList items={faq} />
      </NumberedSection>

      {/* CTA */}
      <Reveal>
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 sm:p-9">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 opacity-60"
            style={{ background: 'radial-gradient(ellipse 60% 130% at 85% 0%, color-mix(in oklch, var(--primary) 20%, transparent), transparent)' }}
          />
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight">{t('cta.title')}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              {t('cta.text')}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/feedback?type=artist" className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-opacity">
              {t('cta.becomeArtist')}
            </Link>
            <Link href="/artists" className="rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-foreground/5 transition-colors">
              {t('cta.listenArtists')}
            </Link>
          </div>
        </section>
      </Reveal>
    </main>
  );
}

// ─── roadmap ───────────────────────────────────────────────────────────────

function ProgressRow({ icon, label, caption, value, done = false }: { icon: IconName; label: string; caption: string; value: number; done?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Icon name={icon} size={15} className={done ? 'text-primary' : 'text-muted-foreground'} />
          {label}
        </span>
        <span className={`shrink-0 label-mono text-xs ${done ? 'text-primary' : 'text-muted-foreground'}`}>
          {caption}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: done ? 'var(--primary)' : 'color-mix(in oklch, var(--primary) 55%, var(--muted-foreground))' }}
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

// ─── examples ──────────────────────────────────────────────────────────────

function DemoCard({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 transition-colors hover:border-primary/30">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon name={icon} size={15} className="text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Equalizer() {
  // motion сериализует transform по-разному на сервере и клиенте — рендерим бары только после маунта
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return <div className="h-12" />;

  const bars = Array.from({ length: 28 }, (_, i) => 0.25 + 0.7 * Math.abs(Math.sin((i + 1) * 1.27)));
  return (
    <div className="flex h-12 items-end gap-1">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="h-full flex-1 rounded-full bg-primary/70"
          style={{ originY: 1 }}
          initial={{ scaleY: h }}
          animate={{ scaleY: [h, Math.min(1, h + 0.3), Math.max(0.15, h - 0.25), h] }}
          transition={{ duration: 1.2 + (i % 5) * 0.18, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function TrackLine({ n, title, explicit = false }: { n: number; title: string; explicit?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-4 font-mono text-xs text-muted-foreground tabular-nums">{n}</span>
      <span className="truncate">{title}</span>
      {explicit && <ExplicitBadge />}
    </div>
  );
}

// ─── features ──────────────────────────────────────────────────────────────

function FeatureGrid({ items }: { items: Feature[] }) {
  return (
    <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((f) => (
        <StaggerItem key={f.title}>
          <FeatureCard icon={f.icon} title={f.title}>
            {f.text}
          </FeatureCard>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

// ─── shortcuts ───────────────────────────────────────────────────────────────

function ShortcutsTable({ items }: { items: { group: string; desc: string; keys: string[] }[] }) {
  const groups = [...new Set(items.map((s) => s.group))];
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
      {groups.map((group) => (
        <div key={group}>
          <div className="px-5 py-2.5 bg-muted/40">
            <span className="label-mono text-xs text-muted-foreground">{group}</span>
          </div>
          <div className="divide-y divide-border/50">
            {items.filter((s) => s.group === group).map((s) => (
              <div key={s.desc} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-sm text-muted-foreground">{s.desc}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex items-center justify-center rounded border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-foreground shadow-sm"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── faq ───────────────────────────────────────────────────────────────────

function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-medium list-none transition-colors hover:bg-foreground/[0.03]">
            {item.question}
            <Icon
              name="chevron-down"
              size={16}
              className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}

// ─── next-stage teaser ───────────────────────────────────────────────────────

function NextStageTeaser({ t }: { t: ReturnType<typeof useTranslations<'about'>> }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-card p-6 sm:p-7 space-y-5">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          <Icon name="lock" size={12} />
          {t('whatsNext.badge')}
        </span>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
          {t.rich('whatsNext.text', { strong: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
        </p>
      </div>

      {/* мок-превью покупки (выключено) */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3 opacity-90">
        <div className="grid size-12 shrink-0 place-items-center rounded-md bg-foreground/10 text-muted-foreground">
          <Icon name="music" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{t('whatsNext.mockRelease.title')}</p>
          <p className="truncate text-xs text-muted-foreground">{t('whatsNext.mockRelease.subtitle')}</p>
        </div>
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground/10 px-4 py-2 text-sm font-medium text-muted-foreground"
          title={t('whatsNext.mockRelease.tooltip')}
        >
          <Icon name="lock" size={13} />
          {t('whatsNext.mockRelease.price')}
        </span>
      </div>
    </div>
  );
}
