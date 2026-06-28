'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { motion } from 'motion/react';
import { FadeUp, Reveal, Stagger, StaggerItem } from '@vire/ui/motion';
import { Icon, type IconName } from '@/components/icon';
import { BrandIcon, type BrandName } from '@/components/brand-icon';
import { ExplicitBadge } from '@/components/explicit-badge';
import { SITE_FAQ } from '@/lib/faq';

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
  { icon: 'align-left', title: 'Синхронный текст', text: 'Текст песни прямо в плеере: строки подсвечиваются по ходу трека, тап по строке перематывает на это место.' },
  { icon: 'share-2', title: 'Шеринг с таймкодом', text: 'Делись обычной ссылкой или «с момента M:SS» — собеседник откроет ровно с нужной секунды.' },
  { icon: 'volume-2', title: 'Слушают сейчас', text: 'На странице трека и в дашборде артиста виден живой счётчик: сколько человек слушают прямо сейчас.' },
  { icon: 'search', title: 'Поиск', text: 'Отдельная страница, быстрый инлайн-дропдаун и командная палитра по ⌘K / Ctrl+K.' },
];

const FOR_ARTISTS: Feature[] = [
  { icon: 'image', title: 'Страница и темизация', text: 'Full-bleed обложка, био, ссылки и видео. Цвета, зерно и шрифты страницы артист настраивает под себя — без правок кода.' },
  { icon: 'upload', title: 'Загрузка релизов', text: 'Заливаешь исходник — платформа сама режет его в поток и считает форму волны. Статусы от черновика до публикации (можно по расписанию).' },
  { icon: 'music', title: 'Карточка трека', text: 'BPM, тональность, метка explicit (18+), liner notes и кредиты. Соавторы и доли — на уровне трека.' },
  { icon: 'align-left', title: 'Текст трека', text: 'Добавь синхронизированный (LRC) или обычный текст — слушатели увидят его в плеере, подсвеченным по таймкодам.' },
  { icon: 'pie-chart', title: 'Аналитика', text: 'Прослушивания за 24ч / 7 / 30 дней, уникальные слушатели, динамика по дням и переслушивания — в дашборде.' },
  { icon: 'bell', title: 'Анонсы', text: 'Посты на странице артиста с инлайн-редактированием. Подписчики видят их в ленте.' },
  { icon: 'link-2', title: 'Смартлинки', text: 'Лендинги релиза со ссылками на все площадки — работают даже без публикации музыки на Vire.' },
];

const SMARTLINK_DEMO: BrandName[] = ['spotify', 'apple-music', 'vk-music', 'youtube-music', 'soundcloud'];
const MOODS = ['меланхолия', 'драйв', 'ночь', 'фокус', 'тепло'];

export function AboutContent() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20 space-y-24">
      {/* Hero */}
      <FadeUp>
        <header className="relative space-y-5">
          <div
            aria-hidden="true"
            className="absolute -top-28 left-1/2 -translate-x-1/2 h-72 w-[130%] -z-10 opacity-60 blur-3xl pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 0%, color-mix(in oklch, var(--primary) 32%, transparent), transparent)' }}
          />
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Этап 1 · Friends &amp; Family
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.0] text-balance">
            Независимая музыка{' '}
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

      {/* 01 — Roadmap */}
      <Section index="01" title="Дорожная карта">
        <div className="space-y-5 rounded-2xl border border-border bg-card p-6 sm:p-7">
          <ProgressRow icon="check" label="Этап 1 — Friends & Family" caption="запущен" value={100} done />
          <ProgressRow icon="settings" label="Этап 2 — Прямые продажи" caption="в разработке" value={20} />
          <ProgressRow icon="users" label="Этап 3 — Сообщество и большой запуск" caption="скоро" value={5} />
        </div>
      </Section>

      {/* 02 — Examples */}
      <Section index="02" title="Как это выглядит" subtitle="Живые элементы интерфейса — не картинки.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DemoCard icon="shuffle" title="Волна">
            <Equalizer />
          </DemoCard>

          <DemoCard icon="hash" title="Теги настроения">
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <span key={m} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
                  {m}
                </span>
              ))}
            </div>
          </DemoCard>

          <DemoCard icon="link-2" title="Смартлинк — слушать везде">
            <div className="flex flex-wrap items-center gap-2">
              {SMARTLINK_DEMO.map((b) => (
                <span key={b} className="inline-flex items-center rounded-lg bg-white px-2 py-1.5 transition-transform hover:-translate-y-0.5">
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

          <DemoCard icon="align-left" title="Синхронный текст">
            <div className="space-y-1.5 text-sm">
              <p className="text-muted-foreground/40">в городе дождь, я иду без зонта</p>
              <p className="font-medium text-foreground">фонари как будто бы шепчут со мной</p>
              <p className="text-muted-foreground/40">и каждый шаг — это новая строка</p>
            </div>
          </DemoCard>
        </div>
      </Section>

      {/* 03 — For listeners */}
      <Section index="03" title="Для слушателей">
        <FeatureGrid items={FOR_LISTENERS} />
      </Section>

      {/* 04 — For artists */}
      <Section index="04" title="Для артистов">
        <FeatureGrid items={FOR_ARTISTS} />
      </Section>

      {/* 05 — What's next */}
      <Section index="05" title="Что дальше">
        <NextStageTeaser />
      </Section>

      {/* 06 — Shortcuts */}
      <Section index="06" title="Горячие клавиши">
        <ShortcutsTable />
      </Section>

      {/* 07 — FAQ */}
      <Section index="07" title="Частые вопросы">
        <FaqList />
      </Section>

      {/* CTA */}
      <Reveal>
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 sm:p-9">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 opacity-60"
            style={{ background: 'radial-gradient(ellipse 60% 130% at 85% 0%, color-mix(in oklch, var(--primary) 20%, transparent), transparent)' }}
          />
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight">Вы артист?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              Профили на Этапе 1 заводим вручную — расскажите о себе и оставьте ссылки на музыку,
              и мы откроем доступ к загрузке и оформлению страницы.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/feedback?type=artist" className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-opacity">
              Стать артистом
            </Link>
            <Link href="/artists" className="rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-foreground/5 transition-colors">
              Слушать артистов
            </Link>
          </div>
        </section>
      </Reveal>
    </main>
  );
}

// ─── layout ──────────────────────────────────────────────────────────────────

function Section({ index, title, subtitle, children }: { index: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <section className="space-y-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-medium tracking-widest text-primary">{index}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </section>
    </Reveal>
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
        <span className={`shrink-0 text-xs font-mono uppercase tracking-wide ${done ? 'text-primary' : 'text-muted-foreground'}`}>
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
  // Рендерим только после маунта: motion по-разному сериализует transform на
  // сервере и клиенте → иначе рассинхрон гидрации. SSR отдаёт плейсхолдер той же
  // высоты (useSyncExternalStore: сервер → false, клиент → true, без warning).
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return <div className="h-12" />;

  // Детерминированные высоты (формула от индекса), «живость» — зацикленная анимация.
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
          <motion.div
            whileHover={{ y: -3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="group relative h-full overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: 'radial-gradient(ellipse 70% 90% at 0% 0%, color-mix(in oklch, var(--primary) 12%, transparent), transparent)' }}
            />
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background transition-colors group-hover:border-primary/50 group-hover:bg-primary/10">
                <Icon name={f.icon} size={18} className="text-primary" />
              </span>
              <h3 className="text-sm font-medium leading-snug">{f.title}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
          </motion.div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

// ─── shortcuts ───────────────────────────────────────────────────────────────

const SHORTCUTS: { keys: string[]; desc: string; group: string }[] = [
  { group: 'Навигация', keys: ['/'], desc: 'Открыть поиск' },
  { group: 'Навигация', keys: ['Ctrl', 'K'], desc: 'Командная палитра' },
  { group: 'Навигация', keys: ['Ctrl', 'F'], desc: 'Командная палитра (альтернатива)' },
  { group: 'Плеер', keys: ['Space'], desc: 'Play / Pause' },
  { group: 'Плеер', keys: ['←'], desc: 'Перемотка −5 сек' },
  { group: 'Плеер', keys: ['→'], desc: 'Перемотка +5 сек' },
  { group: 'Плеер', keys: ['Shift', '←'], desc: 'Предыдущий трек' },
  { group: 'Плеер', keys: ['Shift', '→'], desc: 'Следующий трек' },
  { group: 'Плеер', keys: ['M'], desc: 'Mute / Unmute' },
];

function ShortcutsTable() {
  const groups = [...new Set(SHORTCUTS.map((s) => s.group))];
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
      {groups.map((group) => (
        <div key={group}>
          <div className="px-5 py-2.5 bg-muted/40">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{group}</span>
          </div>
          <div className="divide-y divide-border/50">
            {SHORTCUTS.filter((s) => s.group === group).map((s) => (
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

function FaqList() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
      {SITE_FAQ.map((item) => (
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

function NextStageTeaser() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-card p-6 sm:p-7 space-y-5">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          <Icon name="lock" size={12} />
          Скоро · Этап 2
        </span>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
          Появятся <strong className="text-foreground">прямые продажи</strong>: купить трек или
          релиз и поддержать артиста рублём напрямую, без посредников. В Этапе 1 покупки выключены —
          включим, когда всё будет готово. Так это будет выглядеть:
        </p>
      </div>

      {/* мок-превью покупки (выключено) */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3 opacity-90">
        <div className="grid size-12 shrink-0 place-items-center rounded-md bg-foreground/10 text-muted-foreground">
          <Icon name="music" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">Новый релиз</p>
          <p className="truncate text-xs text-muted-foreground">FLAC · поддержать артиста</p>
        </div>
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground/10 px-4 py-2 text-sm font-medium text-muted-foreground"
          title="Покупки появятся на Этапе 2"
        >
          <Icon name="lock" size={13} />
          299 ₽
        </span>
      </div>
    </div>
  );
}
