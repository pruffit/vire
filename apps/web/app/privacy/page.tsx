import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности',
  description: 'Как Vire обрабатывает персональные данные пользователей',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14 space-y-10">
      <header className="space-y-2">
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Vire</p>
        <h1 className="text-3xl font-bold tracking-tight">Политика конфиденциальности</h1>
        <p className="text-sm text-muted-foreground">Редакция от 19 июня 2026 г. (драфт — не юридическая консультация)</p>
      </header>

      <Prose>
        <Section title="1. Какие данные мы собираем">
          <p>При регистрации через Яндекс OAuth мы получаем:</p>
          <ul>
            <li>email-адрес;</li>
            <li>отображаемое имя;</li>
            <li>URL аватара (хранится ссылка, изображение не копируется).</li>
          </ul>
          <p>При регистрации по email (пароль или ссылка-magic link) мы получаем только email-адрес.</p>
          <p>В процессе использования Сервиса мы фиксируем:</p>
          <ul>
            <li>лайки треков (track_id + user_id);</li>
            <li>подписки на артистов (artist_id + user_id);</li>
            <li>созданные плейлисты и их содержимое;</li>
            <li>события прослушивания (play events): track_id, анонимный session_id, дата/время, длительность прослушивания. User_id привязывается только для зарегистрированных пользователей;</li>
            <li>любимые моменты на треке (таймкод + анонимный session_id);</li>
            <li>mood-теги, проставленные треку (только для артистов-владельцев).</li>
          </ul>
        </Section>

        <Section title="2. Для чего используются данные">
          <ul>
            <li>Аутентификация и идентификация пользователя в рамках Сервиса.</li>
            <li>Формирование персональной ленты подписок.</li>
            <li>Алгоритм подбора треков («Волна») — на основе агрегированных тегов настроения и поведения (дослушивания, лайки).</li>
            <li>Аналитика для артистов: количество прослушиваний, уникальные слушатели, динамика по дням.</li>
            <li>Обеспечение безопасности и предотвращение злоупотреблений.</li>
          </ul>
        </Section>

        <Section title="3. Передача данных третьим лицам">
          <p>Мы не продаём и не передаём персональные данные третьим лицам в рекламных или коммерческих целях.</p>
          <p>Данные могут передаваться только:</p>
          <ul>
            <li>провайдерам инфраструктуры (хостинг, хранилище файлов, email-рассылки) — в объёме, необходимом для работы Сервиса;</li>
            <li>по требованию уполномоченных государственных органов в установленных законом случаях.</li>
          </ul>
        </Section>

        <Section title="4. Cookie, хранилище браузера и аналитика">
          <p>Мы используем необходимые cookie — сессионный токен Auth.js для авторизации пользователя.</p>
          <p>Для сбора статистики о посещаемости на платформе подключена <strong className="text-foreground">Яндекс.Метрика</strong> (АО «Яндекс», Россия). Метрика собирает:</p>
          <ul>
            <li>данные о просмотренных страницах, источниках переходов, времени на сайте;</li>
            <li>клик-карты и карты скролла (clickmap);</li>
            <li>записи сессий пользователей — Вебвизор (движения мыши, клики, прокрутка). Вебвизор не фиксирует ввод в поля форм (пароли, email).</li>
          </ul>
          <p>Данные обрабатываются Яндексом в соответствии с <a href="https://yandex.ru/legal/confidential/" className="underline underline-offset-4 hover:opacity-70 transition-opacity" target="_blank" rel="noopener noreferrer">политикой конфиденциальности Яндекса</a>. Мы не передаём Яндексу персональные данные (email, имя) — только поведенческие данные браузерной сессии.</p>
          <p>localStorage используется для хранения предпочтений интерфейса (например, факт закрытия баннера).</p>
        </Section>

        <Section title="5. Хранение и удаление данных">
          <p>Данные хранятся на серверах в России (Timeweb Cloud VPS).</p>
          <p>Для удаления аккаунта и связанных с ним персональных данных воспользуйся <a href="/feedback" className="underline underline-offset-4 hover:opacity-70 transition-opacity">формой обратной связи</a>. Мы обработаем запрос в течение 14 дней.</p>
          <p>После удаления аккаунта анонимизированные play events (без user_id) могут сохраняться в агрегированной статистике.</p>
        </Section>

        <Section title="6. Безопасность">
          <p>Мы применяем стандартные технические меры защиты: HTTPS, httpOnly-cookie для сессии, хранение файлов в закрытом S3-бакете (доступ только по подписанным URL).</p>
        </Section>

        <Section title="7. Изменения политики">
          <p>О существенных изменениях в политике конфиденциальности мы уведомим пользователей по email или через уведомление в Сервисе.</p>
        </Section>

        <Section title="8. Контакт">
          <p>По вопросам обработки персональных данных: <a href="/feedback" className="underline underline-offset-4 hover:opacity-70 transition-opacity">форма обратной связи</a></p>
        </Section>
      </Prose>
    </main>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">{children}</div>
    </section>
  );
}
