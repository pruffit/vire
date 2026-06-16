'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'motion/react';
import { FadeUp, Reveal, Stagger, StaggerItem } from '@vire/ui/motion';
import { Icon, type IconName } from '@/components/icon';
import { BrandIcon, type BrandName } from '@/components/brand-icon';
import { ExplicitBadge } from '@/components/explicit-badge';

interface Feature {
  icon: IconName;
  title: string;
  text: string;
}

const FOR_LISTENERS: Feature[] = [
  { icon: 'play-circle', title: 'Плеер и поток', text: 'Глобальный плеер на всех страницах: очередь, перемотка по форме волны, горячие клавиши (пробел, стрелки, M). Звук — потоком, без скачивания файлов.' },
  { icon: 'shuffle', title: 'Волна', text: 'Бесконечный поток по вкусу: подбор по тегам настроения, темпу и тональности. Закончилась очередь — Волна продолжает сама. Можно стартовать от любого трека.' },
  { icon: 'heart', title: 'Лайки', text: 'Отмечай треки из плеера, трек-листа или страницы трека — состояние синхронно везде, всё собирается в профиле.' },
  { icon: 'list', title: 'Плейлисты', text: 'Свои подборки в один клик: добавляй, переименовывай, удаляй. Приватно или по ссылке.' },
  { icon: 'users', title: 'Подписки и лента', text: 'Подписывайся на артистов — новые релизы и анонсы собираются в личной ленте.' },
  { icon: 'hash', title: 'Теги настроения', text: 'У треков есть теги настроения — по ним работает Волна и проще искать музыку под состояние.' },
  { icon: 'star', title: 'Любимые моменты', text: 'Отмечай лучшие секунды прямо на волне трека. Метки анонимны и складываются в общий «тепловой» след.' },
  { icon: 'share-2', title: 'Шеринг с таймкодом', text: 'Делись обычной ссылкой или «с момента M:SS» — собеседник откроет ровно с нужной секунды.' },
  { icon: 'volume-2', title: 'Слушают сейчас', text: 'На странице трека и в дашборде артиста виден живой счётчик: сколько человек слушают прямо сейчас.' },
  { icon: 'search', title: 'Поиск', text: 'Отдельная страница, быстрый инлайн-дропдаун и командная палитра по ⌘K / Ctrl+K.' },
];

const FOR_ARTISTS: Feature[] = [
  { icon: 'image', title: 'Страница и темизация', text: 'Full-bleed обложка, био, ссылки и видео. Цвета, зерно и шрифты страницы артист настраивает под себя — без правок кода.' },
  { icon: 'upload', title: 'Загрузка релизов', text: 'Заливаешь исходник — платформа сама режет его в поток и считает форму волны. Статусы от черновика до публикации (можно по расписанию).' },
  { icon: 'music', title: 'Карточка трека', text: 'BPM, тональность, метка explicit (18+), liner notes и кредиты. Соавторы и доли — на уровне трека.' },
  { icon: 'pie-chart', title: 'Аналитика', text: 'Прослушивания за 24ч / 7 / 30 дней, уникальные слушатели, динамика по дням и переслушивания — в дашборде.' },
  { icon: 'bell', title: 'Анонсы', text: 'Посты на странице артиста с инлайн-редактированием. Подписчики видят их в ленте.' },
  { icon: 'link-2', title: 'Смартлинки', text: 'Лендинги релиза со ссылками на все площадки — работают даже без публикации музыки на Vire.' },
];

const SMARTLINK_DEMO: BrandName[] = ['spotify', 'apple-music', 'vk-music', 'youtube-music', 'soundcloud'];
const MOODS = ['меланхолия', 'драйв', 'ночь', 'фокус', 'тепло'];

export function AboutContent() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 space-y-20">
      {/* Hero */}
      <FadeUp>
        <header className="relative space-y-4">
          <div
            aria-hidden="true"
            className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[120%] -z-10 opacity-60 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 0%, color-mix(in oklch, var(--primary) 30%, transparent), transparent)' }}
          />
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Этап 1 · Friends &amp; Family
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.02] text-balance">
            Независимая музыка
            <br />
            <span className="text-primary">на своих условиях</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-prose">
            Vire — площадка, где артисты публикуют музыку без посредников, а слушатели находят её
            без алгоритмической гонки и рекламы. Сейчас идёт первый, ламповый этап — запускаемся
            в кругу своих и допиливаем платформу вместе с вами.
          </p>
        </header>
      </FadeUp>

      {/* Roadmap progress */}
      <Reveal>
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-7">
          <h2 className="text-lg font-semibold tracking-tight">Дорожная карта</h2>
          <div className="space-y-5">
            <ProgressRow label="Этап 1 — Friends & Family" caption="запущен" value={100} done />
            <ProgressRow label="Этап 2 — Прямые продажи" caption="в разработке" value={20} />
            <ProgressRow label="Этап 3 — Сообщество и большой запуск" caption="скоро" value={5} />
          </div>
        </section>
      </Reveal>

      {/* Examples */}
      <Reveal>
        <section className="space-y-5">
          <h2 className="text-lg font-semibold tracking-tight">Как это выглядит</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DemoCard icon="shuffle" title="Волна">
              <Equalizer />
            </DemoCard>

            <DemoCard icon="hash" title="Теги настроения">
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <span key={m} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                    {m}
                  </span>
                ))}
              </div>
            </DemoCard>

            <DemoCard icon="link-2" title="Смартлинк — слушать везде">
              <div className="flex flex-wrap items-center gap-2">
                {SMARTLINK_DEMO.map((b) => (
                  <span key={b} className="inline-flex items-center rounded-lg bg-white px-2 py-1.5">
                    <BrandIcon name={b} size={16} />
                  </span>
                ))}
              </div>
            </DemoCard>

            <DemoCard icon="music" title="Маркировка треков">
              <div className="space-y-2">
                <TrackLine n={1} title="Полуночный экспресс" explicit />
                <TrackLine n={2} title="Тихий час" />
              </div>
            </DemoCard>
          </div>
        </section>
      </Reveal>

      {/* For listeners */}
      <section className="space-y-6">
        <Reveal>
          <h2 className="text-lg font-semibold tracking-tight">Для слушателей</h2>
        </Reveal>
        <FeatureGrid items={FOR_LISTENERS} />
      </section>

      {/* For artists */}
      <section className="space-y-6">
        <Reveal>
          <h2 className="text-lg font-semibold tracking-tight">Для артистов</h2>
        </Reveal>
        <FeatureGrid items={FOR_ARTISTS} />
      </section>

      {/* What's next */}
      <Reveal>
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Что дальше</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
            На следующем этапе появятся <strong className="text-foreground">прямые продажи</strong>:
            можно будет купить трек или релиз и поддержать артиста рублём напрямую. В Этапе 1 покупки
            ещё выключены — включим, когда всё будет готово.
          </p>
        </section>
      </Reveal>

      {/* CTA */}
      <Reveal>
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 sm:p-8">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 opacity-50"
            style={{ background: 'radial-gradient(ellipse 60% 120% at 85% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent)' }}
          />
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">Вы артист?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              Профили на Этапе 1 заводим вручную — расскажите о себе и оставьте ссылки на музыку,
              и мы откроем доступ к загрузке и оформлению страницы.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/feedback?type=artist" className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-opacity">
              Стать артистом
            </Link>
            <Link href="/artists" className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-foreground/5 transition-colors">
              Слушать артистов
            </Link>
          </div>
        </section>
      </Reveal>
    </main>
  );
}

// ─── building blocks ─────────────────────────────────────────────────────────

function ProgressRow({ label, caption, value, done = false }: { label: string; caption: string; value: number; done?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className={`text-xs font-mono uppercase tracking-wide ${done ? 'text-primary' : 'text-muted-foreground'}`}>
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

function DemoCard({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon name={icon} size={15} className="text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Equalizer() {
  const [bars] = useState(() => Array.from({ length: 28 }, () => 0.2 + Math.random() * 0.8));
  return (
    <div className="flex h-12 items-end gap-1">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="h-full flex-1 rounded-full bg-primary/70"
          style={{ originY: 1 }}
          initial={{ scaleY: h }}
          animate={{ scaleY: [h, Math.min(1, h + 0.35), Math.max(0.15, h - 0.25), h] }}
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

function FeatureGrid({ items }: { items: Feature[] }) {
  return (
    <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((f) => (
        <StaggerItem key={f.title}>
          <div className="group h-full rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background border border-border transition-colors group-hover:border-primary/40">
                <Icon name={f.icon} size={18} className="text-primary" />
              </span>
              <h3 className="text-sm font-medium leading-snug">{f.title}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
