# Видео-эмбеды (YouTube / VK)

Артист добавляет ссылку на видео (YouTube или VK) на свой профиль. Показывается
кастомным плеером-фасадом под стиль сайта, а не «голым» iframe платформы.

## Что делает
- Принимает ссылку YouTube (`watch`/`youtu.be`/`shorts`) и VK (`vk.com`,
  `vkvideo.ru`, формат `video{oid}_{id}` в пути или `?z=`).
- **Парсер** превращает ссылку в `{ platform, id, embedUrl, thumbnailUrl }`.
- **Фасад**: пока не нажали play — показываем постер + кнопку, iframe не грузится
  (быстрее, без трекеров платформы до клика).
- **Свои контролы** поверх скрытого нативного UI: play/pause, перемотка,
  громкость, скорость (YouTube), фуллскрин; жесты по клику (одиночный — pause,
  дабл слева/справа — ∓10с, дабл по центру — фуллскрин). «Вуаль» с постером
  прячет нативные оверлеи платформы на паузе/в конце.
  - YouTube — IFrame Player API (`lib/youtube-api.ts`).
  - VK — Video Player API (`lib/vk-player-api.ts`, `js_api=1`); если их скрипт не
    загрузился — деградирует до нативных контролов VK.

## Где код
- **Парсер:** `apps/web/lib/embed.ts` (`parseEmbed`, `getEmbedUrl`,
  `activeEmbedUrl`) — чистые функции, покрыты `lib/__tests__/embed.test.ts`
- **Плеер:** `apps/web/components/video-player.tsx` (`VideoPlayer` →
  `YouTubePlayer` / `VkPlayer`)
- **Platform API-лоадеры:** `apps/web/lib/youtube-api.ts`, `lib/vk-player-api.ts`
- **Где используется:** профиль артиста `apps/web/app/artists/[slug]/page.tsx`;
  ссылка вводится в `dashboard/profile/edit-profile-form.tsx`
- **Данные:** ссылка хранится в профиле артиста (`artist_profiles`)

## Env
Не требуется (скрипты плееров грузятся с CDN платформ на клиенте).

## Ограничения / на будущее
- Только YouTube и VK. Прочие платформы → `parseEmbed` вернёт `null`.
- У VK нет постера из ссылки (`thumbnailUrl: null`) — фасад без превью.
- Контролы VK зависят от внешнего скрипта; при его недоступности — нативный UI.
- Видеохосты должны быть разрешены CSP `frame-src` (см. `next.config.ts`).
