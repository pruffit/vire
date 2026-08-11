# План: контракты `/api/v1` (волна 3)

**Спека:** `docs/superpowers/specs/2026-08-12-api-contracts-wave3.md`.
Срезы выполняются **последовательно** — все трогают `packages/api-contracts/src/index.ts`.
После каждого среза: гейты + коммит.

## Общие правила для всех срезов

- Эталон — роуты волны 2: схема в `packages/api-contracts/src/<resource>.ts`
  (`xxxSchema` + `type XxxDTO = z.infer<...>`, ответы — `xxxResponseSchema`/`XxxResponse`),
  реэкспорт через `src/index.ts`, `import type` в роуте, `satisfies XxxResponse` на
  возвращаемом объекте, Date→ISO — функцией `toResponse()` в самом файле роута.
- Форма ответа на проводе **не меняется**. Если схема не сходится с фактическим ответом —
  правится схема, не роут (исключение: `joinedAt` в срезе 2).
- Query/body-валидация переезжает в контракт только там, где схема уже локальная;
  новых правил валидации не вводим.
- Contract-тест на каждый переведённый роут — в существующий `route.test.ts`:
  `expect(xxxResponseSchema.safeParse(await res.json()).success).toBe(true)`.
- Комментарии — только неочевидное «почему», 1–2 строки.

## Срез 1 — готовые контракты и одиночные ресурсы

**Новое в пакете:**

- `src/common.ts` — `errorResponseSchema` (`{ error: string, code?: string }`),
  `okResponseSchema` (`{ ok: boolean }`), `uuidSchema`. Только эти три: у каждой
  20+ доказательств в роутах.
- `src/artist.ts` — `artistDetailResponseSchema` для `GET /v1/artists/{slug}`
  (переиспользовать `artistProfileSchema` из `catalog.ts`).
- `src/release.ts` — `releaseDetailResponseSchema` для `GET /v1/releases/{releaseId}`
  (переиспользовать `releaseSchema` из `catalog.ts`; трек-схему взять из `release-page.ts`,
  экспортировать её оттуда, если она сейчас не экспортируется).

**Роуты:**

| Файл | Что делаем |
|---|---|
| `artists/[slug]/follow/route.ts` | `satisfies FollowResponse` (POST/DELETE) |
| `tracks/[id]/like/route.ts` | `satisfies LikeResponse` (GET/POST/DELETE) |
| `playlists/[id]/like/route.ts` | `satisfies LikeResponse` (GET/POST/DELETE) |
| `releases/[releaseId]/presave/route.ts` | `satisfies PresaveResponse` (GET/POST/DELETE) |
| `wave/route.ts` | `satisfies WaveResponse` |
| `artists/[slug]/route.ts` | `toResponse()` с Date→ISO + `satisfies ArtistDetailResponse` |
| `releases/[releaseId]/route.ts` | то же; **живой потребитель** — `lib/player/lazy-queue-fetchers.ts`, форма ответа обязана остаться прежней |

## Срез 2 — `playlists/**`

Новый `src/playlist.ts`; из `src/playlist-page.ts` экспортировать `playlistTrackSchema`,
`playlistCollaboratorSchema`, `playlistWithTracksSchema` и переиспользовать, а не копировать.

| Файл | Что делаем |
|---|---|
| `playlists/route.ts` | GET (`Playlist.createdAt` → ISO) + POST `createSchema` в контракт |
| `playlists/[id]/route.ts` | GET (Date→ISO), PATCH `patchSchema` в контракт, DELETE |
| `playlists/[id]/tracks/route.ts` | `addSchema`/`reorderSchema` в контракт, ответ `{tracks, version}` |
| `playlists/[id]/tracks/[trackId]/route.ts` | `okResponseSchema` |
| `playlists/[id]/collaborators/route.ts` | **фикс:** `joinedAt.toISOString()` (сейчас сырой `Date`); `joinSchema` в контракт |
| `playlists/[id]/collaborators/[userId]/route.ts` | `okResponseSchema` |
| `playlists/[id]/collaboration/route.ts` | `patchSchema` + ответы в контракт |
| `playlists/[id]/add-search/route.ts` | query-схема (`q`, лимит длины) + ответ `{tracks}` |
| `playlists/[id]/cover/route.ts` | ответ `{ok, coverUrl}`; multipart-вход не трогаем |
| `playlists/[id]/suggestions/route.ts` | ответ вместо passthrough |

`playlists/[id]/stream/route.ts` — SSE, в allowlist.

## Срез 3 — `chat/**` и `notifications/**`

Новые `src/chat.ts` (`chatMessageSchema`, `chatConversationSchema` + ответы) и
`src/notifications.ts` (`notificationSchema` + ответ).

| Файл | Что делаем |
|---|---|
| `chat/conversations/route.ts` | `lastMessageAt` → ISO |
| `chat/[conversationId]/messages/route.ts` | `createdAt` → ISO; `before`/`beforeId` — в query-схему (сейчас руками) |
| `chat/messages/route.ts` | `schema{toUserId,ciphertext,nonce}` в контракт; ответ с `createdAt` → ISO |
| `chat/open/route.ts` | `schema{userId}` → `uuidSchema`; ответ с `lastMessageAt` → ISO |
| `chat/[conversationId]/read`, `.../typing`, `chat/unread-count` | `okResponseSchema` / `{count}` |
| `notifications/route.ts` | `createdAt` → ISO |
| `notifications/read/route.ts` | `okResponseSchema` |
| `notifications/unsubscribe/route.ts` | `schema{uid,token}` в контракт; GET отдаёт redirect — ответ не описываем |

## Срез 4 — барьер `check:contracts` + доки

- `apps/web/scripts/check-contracts.mjs` по образцу `check-route-slugs.mjs`:
  каждый `app/api/v1/**/route.ts` обязан импортировать хотя бы один символ из
  `@vire/api-contracts`, кроме путей в allowlist. Дополнительно красный, если
  (а) файл из allowlist уже импортирует контракты — значит строку надо убрать;
  (б) в allowlist есть несуществующий путь.
- Allowlist с причинами: `admin/**`, `dashboard/**`, `jam/**`, `keys/**`, `webhooks/**`,
  `**/stream/route.ts`, `health`, плюс точечные оставшиеся (`search`, `friends/**`,
  `tracks/**` кроме like, `user/**`, `users/**`, `feedback`, `reports`, `session`,
  `presence`, `push/**`, `presave/**`, `party/**`, `listening-now`, `realtime/**`).
- Регистрация: script `check:contracts` в `apps/web/package.json`, добавить в `prebuild`
  рядом с `check:routes`/`check:i18n`, таск в `turbo.json`, шаг в job `gates`
  (`.github/workflows/deploy.yml`) рядом с остальными барьерами.
- Доки: `docs/api-contracts.md` — §3.1 привести к фактической форме ответа/ошибки, §4 —
  плоская раскладка, §5 — статусы ресурсов, §6 — барьер введён с allowlist;
  `docs/migration-plan.md` — волна 3 ✅ с перечнем срезов и остатком (dashboard/jam/admin);
  `docs/roadmap/platform-core-brief.md` — журнал фаз (фаза 4);
  `CLAUDE.md` — `check:contracts` в списке проверок качества.

## Гейты после каждого среза

```bash
pnpm --filter @vire/web typecheck && pnpm --filter @vire/core typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes && pnpm --filter @vire/web check:i18n
pnpm --filter @vire/web test
```

Полный прогон (`build`, `check:contracts`, `pnpm audit`) — после среза 4.
