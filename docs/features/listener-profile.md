# Профиль слушателя (`/profile`)

Полноширинный личный хаб слушателя в визуальном языке страницы артиста: идентичность,
музыкальный вкус, лента активности, превью медиатеки и настройки аккаунта. Дополняет
`/library` (там полные коллекции), не дублируя его.

## Что делает
- **Hero** — full-bleed ambient-баннер, крупный аватар с glow, инлайн-редакт имени,
  загрузка/удаление своего аватара, email, «с {месяц} {год}», стат-чипы (лайки/артисты/
  плейлисты) и приблизительный рантайм любимого («≈ N ч любимой музыки»).
- **Музыкальный вкус** — топ-жанры и топ-артисты, выведенные из лайкнутых треков.
- **Недавняя активность** — единая хронология лайков, подписок и созданных плейлистов.
- **Подписки** — превью подписок с оптимистичной отпиской, ссылка «Все → /library».
- **Превью медиатеки** — первые плейлисты и любимые треки, ссылки в `/library`.
- **Оформление** — тумблер «приглушить движение» (глушит анимации по всему сайту).
- **Аккаунт** — способы входа, выход.

## Где код
- **Страница/роут:** `apps/web/app/(listener)/profile/page.tsx`
- **Компоненты:** `apps/web/components/listener/profile/*` (banner, hero, taste-section,
  activity-feed, library-previews, appearance-settings, sign-out-button, account-section);
  переиспользуют `components/listener/*` (playlist-card, liked-track-row, followed-artists).
- **Логика:** `apps/web/lib/activity.ts` (чистая `mergeActivity` + `activityKey`, покрыта
  тестом `lib/__tests__/activity.test.ts`); `apps/web/lib/listener-data.ts`
  (`getListenerTasteCached`).
- **Данные:** `packages/db/src/queries/listener-taste.ts` (`getListenerTaste` — GROUP BY
  по `likes → track_genres` и `likes → tracks → releases → artist_profiles`);
  `getUserPlaylists` теперь отдаёт `createdAt` (для ленты активности).
- **Приглушение движения:** `packages/ui/src/motion/reduce-motion*.ts` (общий стор +
  сеттер + инлайн-скрипт), `MotionProvider` держит класс `vire-reduce-motion` на `<html>`
  глобально; CSS-близнец `prefers-reduced-motion` в `apps/web/app/globals.css`; пре-пейнт
  скрипт в `apps/web/app/layout.tsx` (без FOUC).

## Env
- Не требуется.

## Ограничения / на будущее
- `likedMinutes` и счётчик лайков считаются по последним 100 лайкам (`getLikedTracks`
  лимит 100) — для очень активных слушателей это приблизительно (префикс «≈»).
- Тема (светлая/тёмная) не переключается — платформа тёмная; «оформление» — только
  приглушение движения.
- Вкус строится из лайков; истории прослушиваний (play_events) на профиле пока нет.
