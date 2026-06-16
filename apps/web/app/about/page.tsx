import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/icon';

export const metadata: Metadata = {
  title: 'О платформе',
  description:
    'Vire — независимая музыкальная площадка для артистов и слушателей СНГ. Этап 1: что уже работает и что будет дальше.',
  alternates: { canonical: '/about' },
};

const NOW: { icon: IconName; title: string; text: string }[] = [
  { icon: 'play-circle', title: 'Слушать', text: 'Плеер с потоковым звуком, очередью и горячими клавишами.' },
  { icon: 'shuffle', title: 'Волна', text: 'Бесконечный поток по вкусу — по тегам настроения, темпу и тональности.' },
  { icon: 'heart', title: 'Лайки и плейлисты', text: 'Сохраняй треки, собирай и делись подборками.' },
  { icon: 'users', title: 'Подписки и лента', text: 'Следи за артистами — новые релизы и анонсы в одной ленте.' },
  { icon: 'share-2', title: 'Шеринг с моментом', text: 'Делись треком со ссылкой на конкретную секунду.' },
  { icon: 'star', title: 'Любимые моменты', text: 'Отмечай лучшие места на волне — они видны всем.' },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 space-y-12">
      <header className="space-y-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Этап 1 · Friends &amp; Family
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
          Независимая музыка для СНГ
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-prose">
          Vire — площадка, где артисты публикуют музыку на своих условиях, а слушатели находят её
          без алгоритмической гонки и рекламы. Сейчас идёт первый, ламповый этап — мы
          запускаемся в кругу своих и допиливаем платформу вместе с вами.
        </p>
      </header>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight">Что уже работает</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {NOW.map((f) => (
            <div key={f.title} className="bg-card p-5 space-y-2">
              <div className="flex items-center gap-2.5">
                <Icon name={f.icon} size={18} className="text-primary" />
                <h3 className="text-sm font-medium">{f.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Что дальше</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
          На следующем этапе появятся <strong className="text-foreground">прямые продажи</strong>:
          можно будет купить трек или релиз и поддержать артиста рублём напрямую, без посредников.
          Покупки в Этапе 1 ещё выключены — мы включим их, когда всё будет готово.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Вы артист?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Профили на Этапе 1 заводим вручную — напишите нам, расскажите о себе, и мы откроем
            доступ к загрузке музыки и оформлению страницы.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/feedback"
            className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:bg-primary/90 transition-opacity"
          >
            Стать артистом
          </Link>
          <Link
            href="/artists"
            className="rounded-full border border-border px-5 py-2 text-sm font-medium hover:bg-foreground/5 transition-colors"
          >
            Слушать артистов
          </Link>
        </div>
      </section>
    </main>
  );
}
