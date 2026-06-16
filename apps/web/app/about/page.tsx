import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/icon';

export const metadata: Metadata = {
  title: 'О платформе',
  description:
    'Vire — независимая музыкальная площадка для артистов и слушателей СНГ. Этап 1: подробно о каждой возможности — что уже работает и что будет дальше.',
  alternates: { canonical: '/about' },
};

interface Feature {
  icon: IconName;
  title: string;
  text: string;
}

const FOR_LISTENERS: Feature[] = [
  {
    icon: 'play-circle',
    title: 'Плеер и потоковое прослушивание',
    text: 'Глобальный плеер живёт на всех страницах: очередь, перемотка по форме волны, регулировка громкости и горячие клавиши (пробел — пауза, стрелки — перемотка, Shift+стрелки — соседний трек, M — без звука). Звук отдаётся потоком, без скачивания файлов.',
  },
  {
    icon: 'shuffle',
    title: 'Волна — поток по вкусу',
    text: 'Бесконечный персональный поток: подбирает треки по тегам настроения, темпу и тональности, а когда очередь заканчивается — продолжает сам. Можно запустить «волну» от конкретного трека (seed) и просто слушать.',
  },
  {
    icon: 'heart',
    title: 'Лайки',
    text: 'Отмечай треки сердцем из плеера, трек-листа или страницы трека — состояние синхронизируется везде. Все лайкнутые собираются в профиле.',
  },
  {
    icon: 'list',
    title: 'Плейлисты',
    text: 'Собирай свои подборки, добавляй треки в один клик, переименовывай и удаляй. Плейлист можно сделать приватным или открыть по ссылке.',
  },
  {
    icon: 'users',
    title: 'Подписки и лента',
    text: 'Подписывайся на артистов — их новые релизы и анонсы собираются в личной ленте, чтобы ничего не пропустить.',
  },
  {
    icon: 'hash',
    title: 'Теги настроения',
    text: 'У треков есть теги настроения — по ним работает Волна и проще находить музыку под состояние.',
  },
  {
    icon: 'star',
    title: 'Любимые моменты',
    text: 'Отмечай лучшие секунды прямо на волне трека. Метки анонимны и складываются в общий «тепловой» след — видно, какие моменты цепляют сильнее всего.',
  },
  {
    icon: 'share-2',
    title: 'Шеринг с таймкодом',
    text: 'Делись треком обычной ссылкой или «с момента M:SS» — собеседник откроет ровно с той секунды, которую ты имел в виду.',
  },
  {
    icon: 'volume-2',
    title: 'Слушают сейчас',
    text: 'На странице трека и в дашборде артиста видно, сколько человек слушают прямо сейчас — живой счётчик присутствия.',
  },
  {
    icon: 'search',
    title: 'Поиск',
    text: 'Отдельная страница поиска, быстрый инлайн-дропдаун и командная палитра по ⌘K / Ctrl+K — артисты, релизы и треки под рукой.',
  },
  {
    icon: 'user',
    title: 'Профиль',
    text: 'Свой аватар, имя и способы входа (email + пароль, ссылка на email, Яндекс). Здесь же — лайки, подписки и плейлисты.',
  },
];

const FOR_ARTISTS: Feature[] = [
  {
    icon: 'image',
    title: 'Страница артиста и темизация',
    text: 'Full-bleed обложка, био, ссылки на площадки и видео. Тему страницы (цвета, зерно, шрифты) артист настраивает под себя — оформление хранится в данных, без правок кода.',
  },
  {
    icon: 'upload',
    title: 'Загрузка релизов и треков',
    text: 'Заливаешь исходник — платформа сама режет его в потоковый формат и считает форму волны. Релиз проходит статусы от черновика до публикации (можно и по расписанию).',
  },
  {
    icon: 'music',
    title: 'Карточка трека',
    text: 'BPM, тональность, метка explicit (18+), liner notes и кредиты. Указание соавторов и долей — на уровне трека, а не «одного артиста».',
  },
  {
    icon: 'pie-chart',
    title: 'Аналитика',
    text: 'Прослушивания за 24 часа / 7 / 30 дней, уникальные слушатели, динамика по дням и переслушивания (возвраты к треку в разные дни) — в дашборде.',
  },
  {
    icon: 'bell',
    title: 'Анонсы и новости',
    text: 'Посты на странице артиста: композер, инлайн-редактирование и мгновенное удаление. Подписчики видят их в ленте.',
  },
  {
    icon: 'link-2',
    title: 'Смартлинки',
    text: 'Лендинги релиза со ссылками на все площадки (как Linkfire) — работают даже без публикации музыки на Vire. Площадка распознаётся по ссылке и показывается своим бренд-лого.',
  },
];

function FeatureList({ items }: { items: Feature[] }) {
  return (
    <ul className="space-y-5">
      {items.map((f) => (
        <li key={f.title} className="flex gap-3.5">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-card border border-border">
            <Icon name={f.icon} size={18} className="text-primary" />
          </span>
          <div className="space-y-1">
            <h3 className="text-sm font-medium leading-snug">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 space-y-14">
      <header className="space-y-3">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Этап 1 · Friends &amp; Family
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">
          Независимая музыка для СНГ
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-prose">
          Vire — площадка, где артисты публикуют музыку на своих условиях, а слушатели находят её
          без алгоритмической гонки и рекламы. Сейчас идёт первый, ламповый этап — мы запускаемся
          в кругу своих и допиливаем платформу вместе с вами. Ниже — что уже работает.
        </p>
      </header>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight">Для слушателей</h2>
        <FeatureList items={FOR_LISTENERS} />
      </section>

      <section className="space-y-5">
        <h2 className="text-lg font-semibold tracking-tight">Для артистов</h2>
        <FeatureList items={FOR_ARTISTS} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Что дальше</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
          На следующем этапе появятся <strong className="text-foreground">прямые продажи</strong>:
          можно будет купить трек или релиз и поддержать артиста рублём напрямую, без посредников.
          В Этапе 1 покупки ещё выключены — включим, когда всё будет готово.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Вы артист?</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Профили на Этапе 1 заводим вручную — расскажите о себе и оставьте ссылки на музыку,
            и мы откроем доступ к загрузке и оформлению страницы.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/feedback?type=artist"
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
