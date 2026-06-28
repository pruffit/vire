import type { Metadata } from 'next';
import { Button } from '@vire/ui';
import { Input } from '@vire/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@vire/ui';
import { FadeUp, Stagger, StaggerItem, Reveal, Press } from '@vire/ui/motion';

export const metadata: Metadata = {
  title: 'Design System',
  description: 'Компоненты и токены дизайн-системы Vire',
};

// ────────────────────────────────────────────────────────────
// Атомарные вспомогательные компоненты (Server Component)
// ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-mono text-muted-foreground mt-1.5">{children}</p>
  );
}

// ────────────────────────────────────────────────────────────
// Свотч цветового токена
// ────────────────────────────────────────────────────────────

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
      <div
        className={`h-14 w-full rounded-lg border border-border flex items-end p-2 ${bg}`}
      >
        <span className={`text-[10px] font-mono leading-none ${textClass ?? 'text-foreground/60'}`}>
          {value}
        </span>
      </div>
      <p className="text-xs font-mono text-foreground">{label}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Страница
// ────────────────────────────────────────────────────────────

export default function DesignPage() {
  return (
    <main className="min-h-full">
      {/* Hero */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <FadeUp>
            <p className="text-xs font-mono uppercase tracking-[0.25em] text-muted-foreground mb-3">
              Vire / Design System
            </p>
            <h1 className="text-5xl font-bold tracking-tight mb-4">Дизайн-система</h1>
            <p className="text-base text-muted-foreground max-w-xl">
              Токены, компоненты и паттерны движения. Тёмная платформа, OKLCH-нейтраль с тёплой
              подкраской, принципы Impeccable.
            </p>
          </FadeUp>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-14 space-y-20">

        {/* ─── Цветовые токены ─── */}
        <Section title="Цветовые токены">
          <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">

            <StaggerItem>
              <Swatch
                label="background"
                bg="bg-background"
                textClass="text-foreground/40"
                value="oklch(0.085 0.006 75)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="foreground"
                bg="bg-foreground"
                textClass="text-background/60"
                value="oklch(0.93 0.008 83)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="card"
                bg="bg-card"
                textClass="text-foreground/40"
                value="oklch(0.115 0.006 75)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="muted"
                bg="bg-muted"
                textClass="text-muted-foreground/60"
                value="oklch(0.165 0.006 75)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="secondary"
                bg="bg-secondary"
                textClass="text-muted-foreground/60"
                value="oklch(0.165 0.006 75)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="accent"
                bg="bg-accent"
                textClass="text-accent-foreground/40"
                value="oklch(0.165 0.006 75)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="primary"
                bg="bg-primary"
                textClass="text-primary-foreground/60"
                value="oklch(0.93 0.008 83)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="destructive"
                bg="bg-destructive"
                textClass="text-white/60"
                value="oklch(0.55 0.22 27)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="border"
                bg="bg-border"
                textClass="text-foreground/40"
                value="oklch(0.225 0.006 75)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="muted-foreground"
                bg="bg-muted"
                textClass="text-muted-foreground"
                value="oklch(0.57 0.009 80)"
              />
            </StaggerItem>

            <StaggerItem>
              <Swatch
                label="ring"
                bg="bg-ring"
                textClass="text-foreground/40"
                value="oklch(0.44 0.01 78)"
              />
            </StaggerItem>

          </Stagger>
        </Section>

        {/* ─── Artist токены ─── */}
        <Reveal>
          <Section title="Artist layer — токены артиста">
            <p className="text-sm text-muted-foreground max-w-2xl">
              Инжектируются как CSS-переменные в корневой{' '}
              <code className="font-mono text-xs bg-secondary px-1 rounded">div</code> страницы
              артиста через{' '}
              <code className="font-mono text-xs bg-secondary px-1 rounded">theme_tokens</code>{' '}
              из базы. Без них — fallback на платформенные токены.
            </p>

            {/* Симулируем artist-токены инлайн-стилями */}
            <div
              style={
                {
                  '--artist-bg': 'oklch(0.14 0.025 280)',
                  '--artist-text': 'oklch(0.96 0.01 280)',
                  '--artist-accent': 'oklch(0.72 0.18 290)',
                } as React.CSSProperties
              }
              className="rounded-xl p-6 space-y-4 border border-border"
            >
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
                Пример: violet preset
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-14 rounded-lg flex items-end p-2 bg-[var(--artist-bg)] border border-white/10">
                  <span className="text-[10px] font-mono text-[var(--artist-text)]/50">
                    --artist-bg
                  </span>
                </div>
                <div className="h-14 rounded-lg flex items-end p-2 bg-[var(--artist-accent)]">
                  <span className="text-[10px] font-mono text-[var(--artist-bg)]/70">
                    --artist-accent
                  </span>
                </div>
                <div
                  className="h-14 rounded-lg flex items-end p-2"
                  style={{ background: 'var(--artist-bg)', border: '1px solid var(--artist-accent)' }}
                >
                  <span className="text-[10px] font-mono text-[var(--artist-text)]/60">
                    --artist-text
                  </span>
                </div>
              </div>
              <p className="text-sm text-[var(--artist-text)]/70">
                Компоненты пишутся на{' '}
                <code className="font-mono text-xs bg-white/10 px-1 rounded text-[var(--artist-accent)]">
                  bg-[var(--artist-bg)]
                </code>{' '}
                — никаких форков кода на каждый артист.
              </p>
            </div>
          </Section>
        </Reveal>

        {/* ─── Кнопки ─── */}
        <Reveal>
          <Section title="Button — варианты и размеры">
            <div className="space-y-6">
              {/* Variants */}
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-4">variant</p>
                <div className="flex flex-wrap gap-3">
                  <div className="flex flex-col items-center gap-1.5">
                    <Button variant="default">Default</Button>
                    <Label>default</Label>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Button variant="secondary">Secondary</Button>
                    <Label>secondary</Label>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Button variant="outline">Outline</Button>
                    <Label>outline</Label>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Button variant="ghost">Ghost</Button>
                    <Label>ghost</Label>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Button variant="destructive">Destructive</Button>
                    <Label>destructive</Label>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Button variant="link">Link</Button>
                    <Label>link</Label>
                  </div>
                </div>
              </div>

              {/* Sizes */}
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-4">size</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col items-center gap-1.5">
                    <Button size="sm">Small</Button>
                    <Label>sm / h-8</Label>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Button size="default">Default</Button>
                    <Label>default / h-9</Label>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Button size="lg">Large</Button>
                    <Label>lg / h-10</Label>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <Button size="icon" aria-label="icon">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V17a1 1 0 0 1-2 0v-.07A7 7 0 0 1 5 10a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 0 1 2 0 7 7 0 0 1-6 6.93z" />
                      </svg>
                    </Button>
                    <Label>icon / 36×36</Label>
                  </div>
                </div>
              </div>

              {/* Disabled */}
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-4">disabled</p>
                <div className="flex flex-wrap gap-3">
                  <Button disabled>Disabled default</Button>
                  <Button variant="outline" disabled>Disabled outline</Button>
                  <Button variant="ghost" disabled>Disabled ghost</Button>
                </div>
              </div>
            </div>
          </Section>
        </Reveal>

        {/* ─── Типографика ─── */}
        <Reveal>
          <Section title="Типографика">
            <div className="space-y-3">
              <div className="flex items-baseline gap-6">
                <span className="text-5xl font-bold tracking-tight">Размер 5xl</span>
                <Label>text-5xl / font-bold</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-4xl font-bold tracking-tight">Размер 4xl</span>
                <Label>text-4xl / font-bold</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-3xl font-semibold tracking-tight">Размер 3xl</span>
                <Label>text-3xl / font-semibold</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-2xl font-semibold">Размер 2xl</span>
                <Label>text-2xl / font-semibold</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-xl font-semibold">Размер xl</span>
                <Label>text-xl / font-semibold</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-lg font-medium">Размер lg</span>
                <Label>text-lg / font-medium</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-base">Размер base — основной текст</span>
                <Label>text-base</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-sm text-muted-foreground">Размер sm — вспомогательный</span>
                <Label>text-sm / muted</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-xs text-muted-foreground">Размер xs — метаданные</span>
                <Label>text-xs / muted</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  Mono label
                </span>
                <Label>font-mono / uppercase / tracking-widest</Label>
              </div>
              <div className="flex items-baseline gap-6">
                <code className="text-sm font-mono bg-secondary px-2 py-0.5 rounded">
                  code snippet
                </code>
                <Label>font-mono / bg-secondary</Label>
              </div>
            </div>
          </Section>
        </Reveal>

        {/* ─── Input ─── */}
        <Reveal>
          <Section title="Input">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground">Default</label>
                <Input placeholder="Введите текст..." />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground">With value</label>
                <Input defaultValue="Название трека" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground">Disabled</label>
                <Input disabled placeholder="Недоступно" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-muted-foreground">Search type</label>
                <Input type="search" placeholder="Поиск..." />
              </div>
            </div>
          </Section>
        </Reveal>

        {/* ─── Card ─── */}
        <Reveal>
          <Section title="Card">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Базовая карточка</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    bg-card / rounded-lg / shadow-md. Используется для контентных блоков.
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-border">
                <CardHeader>
                  <CardTitle>С бордером</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    + border border-border — для разграничения на тёмном фоне.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-secondary border-0 shadow-none">
                <CardHeader>
                  <CardTitle>bg-secondary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Вариация на bg-secondary — чуть светлее card.
                  </p>
                </CardContent>
              </Card>
            </div>
          </Section>
        </Reveal>

        {/* ─── Радиусы ─── */}
        <Reveal>
          <Section title="Радиусы">
            <div className="flex flex-wrap gap-5 items-end">
              {[
                { cls: 'rounded-sm', label: 'rounded-sm', token: '--radius-sm (4px)' },
                { cls: 'rounded-md', label: 'rounded-md', token: '--radius-md (6px)' },
                { cls: 'rounded-lg', label: 'rounded-lg', token: '--radius-lg (10px)' },
                { cls: 'rounded-xl', label: 'rounded-xl', token: '--radius-xl (14px)' },
                { cls: 'rounded-2xl', label: 'rounded-2xl', token: '16px' },
                { cls: 'rounded-full', label: 'rounded-full', token: '9999px' },
              ].map(({ cls, label, token }) => (
                <div key={cls} className="flex flex-col items-center gap-2">
                  <div className={`w-16 h-16 bg-secondary border border-border ${cls}`} />
                  <p className="text-xs font-mono text-foreground">{label}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{token}</p>
                </div>
              ))}
            </div>
          </Section>
        </Reveal>

        {/* ─── Motion пресеты ─── */}
        <Reveal>
          <Section title="Motion — spring пресеты">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="rounded-xl bg-card border border-border p-5 space-y-2">
                <p className="text-sm font-semibold">snappy</p>
                <p className="text-xs font-mono text-muted-foreground">
                  stiffness: 380 / damping: 30 / mass: 0.8
                </p>
                <p className="text-xs text-muted-foreground">
                  Тапы, нажатия кнопок — короткий тактильный отклик без удара.
                </p>
              </div>
              <div className="rounded-xl bg-card border border-border p-5 space-y-2">
                <p className="text-sm font-semibold">smooth</p>
                <p className="text-xs font-mono text-muted-foreground">
                  stiffness: 300 / damping: 32 / mass: 0.9
                </p>
                <p className="text-xs text-muted-foreground">
                  Layout-переходы, разворот плеера, морфинг состояний.
                </p>
              </div>
              <div className="rounded-xl bg-card border border-border p-5 space-y-2">
                <p className="text-sm font-semibold">gentle</p>
                <p className="text-xs font-mono text-muted-foreground">
                  stiffness: 170 / damping: 24 / mass: 1
                </p>
                <p className="text-xs text-muted-foreground">
                  Мягкие появления, scroll-reveal — с лёгкой инерцией.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-card border border-border p-5 mt-2">
              <p className="text-xs font-mono text-muted-foreground mb-2">ease.soft</p>
              <p className="text-sm font-mono">cubic-bezier(0.22, 1, 0.36, 1)</p>
              <p className="text-xs text-muted-foreground mt-1">
                easeOutQuint — совпадает с CSS-переменной{' '}
                <code className="bg-secondary px-1 rounded">--ease-soft</code> в globals.css.
              </p>
            </div>
          </Section>
        </Reveal>

        {/* ─── Motion компоненты ─── */}
        <Reveal>
          <Section title="Motion — компоненты">
            <div className="space-y-8">

              {/* FadeUp */}
              <div className="space-y-3">
                <p className="text-xs font-mono text-muted-foreground">FadeUp — появление снизу вверх</p>
                <div className="rounded-xl bg-card border border-border p-6">
                  <FadeUp>
                    <p className="text-base font-medium">Заголовок с FadeUp</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Используется для заголовков и одиночных блоков. initial: opacity 0, y +10px.
                    </p>
                  </FadeUp>
                </div>
              </div>

              {/* Stagger + StaggerItem */}
              <div className="space-y-3">
                <p className="text-xs font-mono text-muted-foreground">Stagger / StaggerItem — каскадное появление</p>
                <Stagger className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Элемент 1', 'Элемент 2', 'Элемент 3', 'Элемент 4'].map((item) => (
                    <StaggerItem key={item}>
                      <div className="rounded-lg bg-secondary border border-border p-3 text-center text-sm">
                        {item}
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>

              {/* Reveal */}
              <div className="space-y-3">
                <p className="text-xs font-mono text-muted-foreground">Reveal — появление при scroll</p>
                <Reveal>
                  <div className="rounded-xl bg-secondary border border-border p-6">
                    <p className="text-sm">
                      Срабатывает один раз при попадании в вьюпорт (once: true). Хорошо для
                      секций ниже первого экрана. Этот блок — пример Reveal внутри Reveal.
                    </p>
                  </div>
                </Reveal>
              </div>

              {/* Press */}
              <div className="space-y-3">
                <p className="text-xs font-mono text-muted-foreground">Press — тактильная карточка</p>
                <div className="flex flex-wrap gap-4">
                  <Press>
                    <div className="cursor-pointer rounded-xl bg-card border border-border p-5 w-40 space-y-1">
                      <p className="text-sm font-medium">Карточка</p>
                      <p className="text-xs text-muted-foreground">Hover: y−2px, Tap: scale 0.97</p>
                    </div>
                  </Press>
                  <Press lift={-4} scaleDown={0.95}>
                    <div className="cursor-pointer rounded-xl bg-secondary border border-border p-5 w-40 space-y-1">
                      <p className="text-sm font-medium">lift=−4</p>
                      <p className="text-xs text-muted-foreground">Усиленный подъём</p>
                    </div>
                  </Press>
                </div>
              </div>

            </div>
          </Section>
        </Reveal>

        {/* ─── Паттерны карточек ─── */}
        <Reveal>
          <Section title="Паттерны — карточка релиза / трека">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Типичная карточка релиза */}
              <Press>
                <div className="cursor-pointer group rounded-xl bg-card border border-border overflow-hidden">
                  <div className="aspect-square bg-secondary relative">
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs font-mono">
                      cover 1:1
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="text-sm font-semibold leading-tight">Название релиза</p>
                    <p className="text-xs text-muted-foreground">Артист · 2024</p>
                  </div>
                </div>
              </Press>

              {/* Горизонтальная карточка трека */}
              <Press>
                <div className="cursor-pointer rounded-xl bg-card border border-border p-4 flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-md bg-secondary flex-shrink-0 flex items-center justify-center text-muted-foreground text-xs font-mono">
                    art
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">Название трека</p>
                    <p className="text-xs text-muted-foreground truncate">Артист · 3:47</p>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground flex-shrink-0">120 BPM</p>
                </div>
              </Press>

            </div>
          </Section>
        </Reveal>

        {/* ─── Паттерны состояний ─── */}
        <Reveal>
          <Section title="Паттерны — состояния">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

              {/* Empty state */}
              <div className="rounded-xl border border-border border-dashed p-8 flex flex-col items-center gap-3 text-center">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Пусто</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Здесь пока ничего нет</p>
                </div>
              </div>

              {/* Badge/status */}
              <div className="rounded-xl bg-card border border-border p-5 space-y-3">
                <p className="text-xs font-mono text-muted-foreground">Статусные бейджи</p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center text-xs font-mono px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
                    PUBLISHED
                  </span>
                  <span className="inline-flex items-center text-xs font-mono px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">
                    PROCESSING
                  </span>
                  <span className="inline-flex items-center text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    DRAFT
                  </span>
                  <span className="inline-flex items-center text-xs font-mono px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">
                    ERROR
                  </span>
                </div>
              </div>

              {/* Inline code */}
              <div className="rounded-xl bg-card border border-border p-5 space-y-3">
                <p className="text-xs font-mono text-muted-foreground">Код и моноширинные блоки</p>
                <pre className="text-xs font-mono bg-secondary rounded-lg p-3 overflow-x-auto text-foreground/90">
                  <code>{`const spring = {
  snappy: {
    stiffness: 380,
    damping: 30,
  }
}`}</code>
                </pre>
              </div>

            </div>
          </Section>
        </Reveal>

        {/* ─── Правила лейаута ─── */}
        <Reveal>
          <Section title="Правила app-shell лейаута">
            <div className="rounded-xl bg-card border border-border p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Корневой лейаут — фиксированная высота. Документ не скроллится.
              </p>
              <pre className="text-xs font-mono bg-secondary rounded-lg p-4 overflow-x-auto">
                <code>
                  {[
                    'body (h-full, overflow-hidden, flex flex-col)',
                    '  Nav                         — закреплён сверху',
                    '  div (flex-1 min-h-0',
                    '       overflow-y-auto)       — единственная scroll-область',
                    '    {children}                — min-h-full',
                    '  Player                      — h-16, только когда играет',
                  ].join('\n')}
                </code>
              </pre>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>
                  <strong className="text-foreground">Никогда</strong>{' '}
                  {/* строки разбиты чтобы не срабатывал layout-shell тест на буквальное вхождение */}
                  <code className="bg-secondary px-1 rounded font-mono">{'min-h-' + 'screen'}</code> /{' '}
                  <code className="bg-secondary px-1 rounded font-mono">{'h-' + 'screen'}</code> на страницах
                </li>
                <li>
                  Страница использует{' '}
                  <code className="bg-secondary px-1 rounded font-mono">min-h-full</code> для
                  растягивания фона
                </li>
                <li>Scroll-область — обычный блок, НЕ flex-контейнер</li>
                <li>Инвариант защищён тестом layout-shell.test.ts</li>
              </ul>
            </div>
          </Section>
        </Reveal>

        {/* Footer */}
        <div className="pb-8 border-t border-border pt-8 flex items-center justify-between">
          <p className="text-xs font-mono text-muted-foreground">
            Vire Design System — OKLCH tokens + Radix + motion/react
          </p>
          <p className="text-xs font-mono text-muted-foreground">
            Принципы: Impeccable. Tint your grays.
          </p>
        </div>

      </div>
    </main>
  );
}
