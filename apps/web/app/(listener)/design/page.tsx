import * as React from 'react';
import type { Metadata } from 'next';
import {
  ContentHero,
  Eyebrow,
  StatusPill,
  NumberedSection,
  FeatureCard,
  PillLink,
} from '@/components/content-kit';
import {
  Badge,
  RoleBadge,
  TrackStatusBadge,
  ReleaseStatusBadge,
  StatCard,
  MetricGrid,
  Field,
  Section,
  Panel,
  PageHeader,
  EmptyState,
  Table,
  Thead,
  Th,
  Tr,
  Td,
  FilterTabs,
  btnPrimary,
  btnGhost,
} from '@/components/ui-kit';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@vire/ui';
import { FadeUp, Stagger, StaggerItem, Reveal, Press } from '@vire/ui/motion';
import { ExplicitBadge } from '@/components/explicit-badge';
import { VerifiedBadge } from '@/components/verified-badge';
import { Icon } from '@/components/icon';
import { InteractiveDemos } from './interactive-demos';

export const metadata: Metadata = {
  title: 'Design System',
  description: 'Компоненты и токены дизайн-системы Vire',
  robots: { index: false },
};

// ── Локальные хелперы витрины ─────────────────────────────────────────────────

function Swatch({
  label,
  bg,
  textClass,
  value,
}: {
  label: string;
  bg: string;
  textClass?: string;
  value: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className={`h-14 w-full rounded-lg border border-border flex items-end p-2 ${bg}`}>
        <span className={`text-[10px] font-mono leading-none ${textClass ?? 'text-foreground/60'}`}>
          {value}
        </span>
      </div>
      <p className="text-xs font-mono text-foreground">{label}</p>
    </div>
  );
}

function DemoLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] text-foreground/55 mt-1.5">{children}</p>;
}

// ── Страница ──────────────────────────────────────────────────────────────────

const TYPOGRAPHY_SCALE = [
  { cls: 'text-5xl font-bold tracking-tight', display: 'Размер 5xl', label: 'text-5xl · font-bold' },
  { cls: 'text-3xl font-semibold tracking-tight', display: 'Размер 3xl', label: 'text-3xl · font-semibold' },
  { cls: 'text-xl font-semibold', display: 'Размер xl', label: 'text-xl · font-semibold' },
  { cls: 'text-base', display: 'Основной текст', label: 'text-base' },
  { cls: 'text-sm text-muted-foreground', display: 'Вспомогательный', label: 'text-sm · muted' },
  {
    cls: 'text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground',
    display: 'MONO LABEL',
    label: 'font-mono · uppercase',
  },
] as const;

const RADII = [
  { cls: 'rounded-sm', label: 'rounded-sm', token: '4px' },
  { cls: 'rounded-md', label: 'rounded-md', token: '6px' },
  { cls: 'rounded-lg', label: 'rounded-lg', token: '10px' },
  { cls: 'rounded-xl', label: 'rounded-xl', token: '14px' },
  { cls: 'rounded-2xl', label: 'rounded-2xl', token: '16px' },
  { cls: 'rounded-full', label: 'rounded-full', token: '9999px' },
] as const;

const SPRINGS = [
  {
    name: 'snappy',
    spec: 'stiffness 380 · damping 30 · mass 0.8',
    use: 'Тапы, нажатия кнопок — короткий тактильный отклик.',
  },
  {
    name: 'smooth',
    spec: 'stiffness 300 · damping 32 · mass 0.9',
    use: 'Layout-переходы, разворот плеера, морфинг состояний.',
  },
  {
    name: 'gentle',
    spec: 'stiffness 170 · damping 24 · mass 1',
    use: 'Мягкие появления, scroll-reveal — с лёгкой инерцией.',
  },
] as const;

export default function DesignPage() {
  return (
    <main className="min-h-full">
      {/* Hero */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <ContentHero
            size="lg"
            glow
            eyebrow="Vire / Design System"
            title="Дизайн-система"
            subtitle="Живые компоненты, токены и паттерны движения. Тёмная платформа, OKLCH-нейтраль с тёплой подкраской, принципы Impeccable."
          />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-14 space-y-20">

        {/* ─── 01 Foundations ─── */}
        <NumberedSection
          index="01"
          title="Foundations"
          subtitle="Цветовые токены, типографика, радиусы — база всего интерфейса."
        >
          <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <StaggerItem>
              <Swatch label="background" bg="bg-background" textClass="text-foreground/40" value="oklch(0.085 0.006 75)" />
            </StaggerItem>
            <StaggerItem>
              <Swatch label="foreground" bg="bg-foreground" textClass="text-background/60" value="oklch(0.93 0.008 83)" />
            </StaggerItem>
            <StaggerItem>
              <Swatch label="card" bg="bg-card" textClass="text-foreground/40" value="oklch(0.115 0.006 75)" />
            </StaggerItem>
            <StaggerItem>
              <Swatch label="muted" bg="bg-muted" textClass="text-muted-foreground/60" value="oklch(0.165 0.006 75)" />
            </StaggerItem>
            <StaggerItem>
              <Swatch label="secondary" bg="bg-secondary" textClass="text-muted-foreground/60" value="oklch(0.165 0.006 75)" />
            </StaggerItem>
            <StaggerItem>
              <Swatch label="primary" bg="bg-primary" textClass="text-primary-foreground/60" value="oklch(0.93 0.008 83)" />
            </StaggerItem>
            <StaggerItem>
              <Swatch label="destructive" bg="bg-destructive" textClass="text-white/60" value="oklch(0.55 0.22 27)" />
            </StaggerItem>
            <StaggerItem>
              <Swatch label="border" bg="bg-border" textClass="text-foreground/40" value="oklch(0.225 0.006 75)" />
            </StaggerItem>
          </Stagger>

          {/* Artist layer */}
          <div
            style={
              {
                '--artist-bg': 'oklch(0.14 0.025 280)',
                '--artist-text': 'oklch(0.96 0.01 280)',
                '--artist-accent': 'oklch(0.72 0.18 290)',
              } as React.CSSProperties
            }
            className="mt-6 rounded-xl border border-border p-5 space-y-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Artist layer · violet preset
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="h-12 rounded-lg flex items-end p-2 bg-[var(--artist-bg)] border border-white/10">
                <span className="text-[10px] font-mono text-[var(--artist-text)]/50">--artist-bg</span>
              </div>
              <div className="h-12 rounded-lg flex items-end p-2 bg-[var(--artist-accent)]">
                <span className="text-[10px] font-mono text-[var(--artist-bg)]/70">--artist-accent</span>
              </div>
              <div
                className="h-12 rounded-lg flex items-end p-2"
                style={{ background: 'var(--artist-bg)', border: '1px solid var(--artist-accent)' }}
              >
                <span className="text-[10px] font-mono text-[var(--artist-text)]/60">--artist-text</span>
              </div>
            </div>
            <p className="text-sm text-[var(--artist-text)]/70">
              Инжектируются как CSS-переменные из{' '}
              <code className="font-mono text-xs bg-white/10 px-1 rounded text-[var(--artist-accent)]">
                theme_tokens
              </code>{' '}
              в корневой div страницы артиста.
            </p>
          </div>

          {/* Typography */}
          <Section label="Типографика" className="mt-8">
            <div className="space-y-3">
              {TYPOGRAPHY_SCALE.map(({ cls, display, label }) => (
                <div key={label} className="flex items-baseline gap-4 flex-wrap">
                  <span className={cls}>{display}</span>
                  <span className="font-mono text-[11px] text-foreground/35">{label}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Radii */}
          <Section label="Радиусы" className="mt-8">
            <div className="flex flex-wrap gap-5 items-end">
              {RADII.map(({ cls, label, token }) => (
                <div key={cls} className="flex flex-col items-center gap-1.5">
                  <div className={`w-14 h-14 bg-secondary border border-border ${cls}`} />
                  <p className="text-xs font-mono text-foreground">{label}</p>
                  <p className="text-[10px] font-mono text-foreground/35">{token}</p>
                </div>
              ))}
            </div>
          </Section>
        </NumberedSection>

        {/* ─── 02 Motion ─── */}
        <NumberedSection
          index="02"
          title="Motion"
          subtitle="Spring-пресеты и живые примеры всех motion-примитивов."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SPRINGS.map(({ name, spec, use }) => (
              <div key={name} className="rounded-xl bg-card border border-border p-4 space-y-1.5">
                <p className="text-sm font-semibold">{name}</p>
                <p className="font-mono text-[11px] text-foreground/45">{spec}</p>
                <p className="text-xs text-muted-foreground">{use}</p>
              </div>
            ))}
          </div>

          <Section label="FadeUp — появление снизу вверх" className="mt-6">
            <div className="rounded-xl bg-card border border-border p-5">
              <FadeUp>
                <p className="text-base font-medium">Заголовок с FadeUp</p>
                <p className="text-sm text-muted-foreground mt-1">
                  initial: opacity 0, y +10px → animate: opacity 1, y 0. Используется для заголовков и одиночных блоков.
                </p>
              </FadeUp>
            </div>
          </Section>

          <Section label="Stagger / StaggerItem — каскадное появление" className="mt-6">
            <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Элемент 1', 'Элемент 2', 'Элемент 3', 'Элемент 4'].map((item) => (
                <StaggerItem key={item}>
                  <div className="rounded-lg bg-secondary border border-border p-3 text-center text-sm">
                    {item}
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </Section>

          <Section label="Reveal — появление при scroll" className="mt-6">
            <Reveal>
              <div className="rounded-xl bg-secondary border border-border p-5 text-sm text-muted-foreground">
                Срабатывает один раз при попадании в вьюпорт (
                <code className="font-mono text-xs bg-background px-1 rounded">once: true</code>
                ). Хорошо для секций ниже первого экрана.
              </div>
            </Reveal>
          </Section>

          <Section label="Press — тактильная обёртка" className="mt-6">
            <div className="flex flex-wrap gap-4">
              <Press>
                <div className="cursor-pointer rounded-xl bg-card border border-border p-4 w-40 space-y-1">
                  <p className="text-sm font-medium">Карточка</p>
                  <p className="text-xs text-muted-foreground">hover: y−2px · tap: scale 0.97</p>
                </div>
              </Press>
              <Press lift={-4} scaleDown={0.95}>
                <div className="cursor-pointer rounded-xl bg-secondary border border-border p-4 w-40 space-y-1">
                  <p className="text-sm font-medium">lift=−4</p>
                  <p className="text-xs text-muted-foreground">Усиленный подъём</p>
                </div>
              </Press>
            </div>
          </Section>
        </NumberedSection>

        {/* ─── 03 Core UI ─── */}
        <NumberedSection
          index="03"
          title="Core UI · @vire/ui"
          subtitle="Button, Input, Card — базовые блоки пакета @vire/ui."
        >
          <Section label="Button · variant">
            <div className="flex flex-wrap gap-4 items-end">
              {(['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const).map(
                (v) => (
                  <div key={v} className="flex flex-col items-center gap-1.5">
                    <Button variant={v}>{v}</Button>
                    <DemoLabel>{v}</DemoLabel>
                  </div>
                ),
              )}
            </div>
          </Section>

          <Section label="Button · size" className="mt-6">
            <div className="flex flex-wrap items-end gap-5">
              <div className="flex flex-col items-center gap-1.5">
                <Button size="sm">Small</Button>
                <DemoLabel>sm · h-8</DemoLabel>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Button size="default">Default</Button>
                <DemoLabel>default · h-9</DemoLabel>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Button size="lg">Large</Button>
                <DemoLabel>lg · h-10</DemoLabel>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Button size="icon" aria-label="Иконка">
                  <Icon name="play" size={16} />
                </Button>
                <DemoLabel>icon · 36×36</DemoLabel>
              </div>
            </div>
          </Section>

          <Section label="Button · disabled" className="mt-6">
            <div className="flex flex-wrap gap-3">
              <Button disabled>Disabled default</Button>
              <Button variant="outline" disabled>Disabled outline</Button>
              <Button variant="ghost" disabled>Disabled ghost</Button>
            </div>
          </Section>

          <Section label="Input" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div className="space-y-1.5">
                <p className="font-mono text-[11px] text-foreground/40">default</p>
                <Input placeholder="Введите текст..." />
              </div>
              <div className="space-y-1.5">
                <p className="font-mono text-[11px] text-foreground/40">with value</p>
                <Input defaultValue="Название трека" />
              </div>
              <div className="space-y-1.5">
                <p className="font-mono text-[11px] text-foreground/40">disabled</p>
                <Input disabled placeholder="Недоступно" />
              </div>
              <div className="space-y-1.5">
                <p className="font-mono text-[11px] text-foreground/40">search</p>
                <Input type="search" placeholder="Поиск..." />
              </div>
            </div>
          </Section>

          <Section label="Card" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Базовая карточка</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">bg-card · rounded-lg · shadow-md</p>
                </CardContent>
              </Card>
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle>С бордером</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">+ border border-border</p>
                </CardContent>
              </Card>
              <Card className="bg-secondary border-0 shadow-none">
                <CardHeader>
                  <CardTitle>bg-secondary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Вариация bg-secondary</p>
                </CardContent>
              </Card>
            </div>
          </Section>
        </NumberedSection>

        {/* ─── 04 Content Kit ─── */}
        <NumberedSection
          index="04"
          title="Content Kit"
          subtitle="Компоненты публичных и маркетинговых поверхностей."
        >
          <Section label="Eyebrow / StatusPill">
            <div className="flex flex-wrap items-start gap-6">
              <div className="space-y-1.5">
                <Eyebrow>Vire · Независимая площадка</Eyebrow>
                <DemoLabel>Eyebrow</DemoLabel>
              </div>
              <div className="space-y-1.5">
                <StatusPill>Этап 1 · Friends & Family</StatusPill>
                <DemoLabel>StatusPill · dot=true</DemoLabel>
              </div>
              <div className="space-y-1.5">
                <StatusPill dot={false}>Архив</StatusPill>
                <DemoLabel>StatusPill · dot=false</DemoLabel>
              </div>
            </div>
          </Section>

          <Section label="FeatureCard" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FeatureCard icon="music" title="Музыка в HLS">
                FLAC → ffmpeg → HLS-чанки. Только signed URL — никаких прямых mp3/flac.
              </FeatureCard>
              <FeatureCard icon="heart" title="Лайки и плейлисты">
                Optimistic UI — состояние меняется мгновенно, синхронизируется с сервером.
              </FeatureCard>
              <FeatureCard icon="users" title="Артисты и слушатели">
                Два регистра: публичный контент-хаб и дашборд артиста.
              </FeatureCard>
            </div>
          </Section>

          <Section label="PillLink" className="mt-6">
            <div className="flex flex-wrap gap-3">
              <PillLink href="/design" tone="primary" icon="play">
                Primary pill
              </PillLink>
              <PillLink href="/design" tone="outline" icon="heart">
                Outline pill
              </PillLink>
              <PillLink href="/design" tone="outline">
                Без иконки
              </PillLink>
            </div>
          </Section>
        </NumberedSection>

        {/* ─── 05 Product Kit ─── */}
        <NumberedSection
          index="05"
          title="Product Kit · ui-kit"
          subtitle="Компоненты продуктовых поверхностей: Admin, Dashboard."
        >
          <Section label="PageHeader · btnPrimary / btnGhost">
            <Panel className="p-4">
              <PageHeader title="Треки" count={1_284}>
                <button className={btnPrimary}>Загрузить</button>
                <button className={btnGhost}>Экспорт</button>
              </PageHeader>
            </Panel>
          </Section>

          <Section label="Badge · tone" className="mt-6">
            <div className="flex flex-wrap gap-2">
              {(['neutral', 'success', 'warn', 'error', 'info', 'accent'] as const).map((tone) => (
                <Badge key={tone} tone={tone}>{tone}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(['neutral', 'success', 'warn', 'error', 'info', 'accent'] as const).map((tone) => (
                <Badge key={tone} tone={tone} dot>{tone} · dot</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge tone="warn" dot pulse>processing · pulse</Badge>
              <Badge tone="success" dot>live · dot</Badge>
            </div>
          </Section>

          <Section label="Статусные бейджи" className="mt-6">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] text-foreground/55">RoleBadge</p>
                <div className="flex flex-wrap gap-2">
                  {['SUPERADMIN', 'ADMIN', 'MODERATOR', 'ARTIST', 'LISTENER'].map((r) => (
                    <RoleBadge key={r} role={r} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] text-foreground/55">TrackStatusBadge</p>
                <div className="flex flex-wrap gap-2">
                  {['READY', 'PROCESSING', 'BLOCKED', 'FAILED'].map((s) => (
                    <TrackStatusBadge key={s} status={s} />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="font-mono text-[10px] text-foreground/55">ReleaseStatusBadge</p>
                <div className="flex flex-wrap gap-2">
                  {['PUBLISHED', 'SCHEDULED', 'DRAFT', 'ARCHIVED'].map((s) => (
                    <ReleaseStatusBadge key={s} status={s} />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section label="StatCard · MetricGrid" className="mt-6">
            <MetricGrid>
              <StatCard label="Прослушивания" value={48_291} sub="за 30 дней" dot="ok" />
              <StatCard label="Артисты" value={342} />
              <StatCard label="Треки" value={1_284} sub="24 в обработке" dot="warn" />
              <StatCard label="Redis" value="онлайн" dot="ok" href="/design" />
            </MetricGrid>
          </Section>

          <Section label="FilterTabs" className="mt-6">
            <FilterTabs
              tabs={[
                { href: '/design', label: 'Все', active: true },
                { href: '/design?tab=active', label: 'Активные', active: false },
                { href: '/design?tab=draft', label: 'Черновики', active: false },
                { href: '/design?tab=archived', label: 'Архив', active: false },
              ]}
            />
          </Section>

          <Section label="Table" className="mt-6">
            <Table minWidth="md:min-w-[560px]">
              <Thead>
                <Th>Трек</Th>
                <Th>Артист</Th>
                <Th align="center">Статус</Th>
                <Th align="right">Слушаний</Th>
              </Thead>
              <tbody>
                <Tr>
                  <Td>Северный ветер</Td>
                  <Td label="Артист" tone="soft">Морозко</Td>
                  <Td label="Статус" align="center"><TrackStatusBadge status="READY" /></Td>
                  <Td label="Слушаний" align="right" mono nums>12 483</Td>
                </Tr>
                <Tr>
                  <Td>В темноте</Td>
                  <Td label="Артист" tone="soft">Полночь</Td>
                  <Td label="Статус" align="center"><TrackStatusBadge status="PROCESSING" /></Td>
                  <Td label="Слушаний" align="right" mono nums>—</Td>
                </Tr>
                <Tr>
                  <Td>Город спит</Td>
                  <Td label="Артист" tone="soft">Нева</Td>
                  <Td label="Статус" align="center"><TrackStatusBadge status="READY" /></Td>
                  <Td label="Слушаний" align="right" mono nums>4 102</Td>
                </Tr>
              </tbody>
            </Table>
          </Section>

          <Section label="EmptyState" className="mt-6">
            <Panel>
              <EmptyState
                title="Ничего не найдено"
                hint="Попробуйте изменить фильтры или сбросить поиск"
              />
            </Panel>
          </Section>

          <Section label="Field" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <Field label="Название трека" htmlFor="demo-title">
                <Input id="demo-title" placeholder="Введите название..." />
              </Field>
              <Field label="BPM" hint="целое число" htmlFor="demo-bpm">
                <Input id="demo-bpm" type="number" placeholder="120" />
              </Field>
            </div>
          </Section>

          <Section label="Switch / Check — интерактив" className="mt-6">
            <InteractiveDemos />
          </Section>
        </NumberedSection>

        {/* ─── 06 Доменные бейджи ─── */}
        <NumberedSection
          index="06"
          title="Доменные бейджи"
          subtitle="ExplicitBadge и VerifiedBadge — единые чипы домена."
        >
          <div className="flex flex-wrap items-start gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base font-medium">Название трека</span>
                <ExplicitBadge />
              </div>
              <DemoLabel>ExplicitBadge — 18+, ненормативная лексика</DemoLabel>
            </div>

            <div className="space-y-2">
              <VerifiedBadge color="oklch(0.72 0.18 290)" />
              <DemoLabel>VerifiedBadge · violet (--artist-accent)</DemoLabel>
            </div>

            <div className="space-y-2">
              <VerifiedBadge color="var(--primary)" />
              <DemoLabel>VerifiedBadge · platform primary</DemoLabel>
            </div>

            <div className="space-y-2">
              <VerifiedBadge color="oklch(0.72 0.22 150)" />
              <DemoLabel>VerifiedBadge · green preset</DemoLabel>
            </div>
          </div>
        </NumberedSection>

        {/* Footer */}
        <div className="pb-8 border-t border-border pt-8 flex items-center justify-between flex-wrap gap-4">
          <p className="font-mono text-xs text-foreground/40">
            Vire Design System — OKLCH tokens · Radix · motion/react
          </p>
          <p className="font-mono text-xs text-foreground/40">Impeccable · Tint your grays.</p>
        </div>

      </div>
    </main>
  );
}
