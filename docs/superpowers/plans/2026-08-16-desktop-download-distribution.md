# План — скачивание десктоп-приложения (страница, баннер, дистрибуция)

Спека: `docs/superpowers/specs/2026-08-16-desktop-download-distribution-design.md`.

## Шаги

1. **`apps/web/lib/platform-detect.ts`** + тест — чистая `detectPlatform(userAgent)`.
2. **i18n**: `packages/i18n/messages/{ru,en}/download.json`, заполнить обе локали
   одновременно (строки для страницы + баннера).
3. **Страница** `app/[locale]/(listener)/download/page.tsx` + content-компонент — по
   образцу `about/page.tsx`. Server Component строит стабильный Windows-URL из
   `process.env.S3_PUBLIC_ENDPOINT` (паттерн `${endpoint}/vire-stream/downloads/desktop/windows/VireMusic-Setup-x64.exe`,
   свериться с `apps/web/lib/s3.ts`/`packages/storage` за примером того же паттерна).
   Секции Windows (рабочая кнопка) / macOS / Linux / iOS / Android («скоро») / PWA (ссылка
   на существующую установку веб-приложения).
4. **Баннер** — клиентский компонент, детекция на маунте, ссылка на `/download`,
   разовое закрытие через `localStorage` (поискать существующий паттерн разовых
   баннеров в проекте перед тем как писать свой с нуля — если есть, переиспользовать
   механизм). Подключить в общей точке (layout/Nav), не на каждой странице отдельно.
5. **CI**: новый job `build-desktop` в `.github/workflows/deploy.yml` — `windows-latest`,
   `needs: gates`, тот же триггер тегом. Rust-toolchain action + `tauri-apps/tauri-action`
   (предпочтительно) или `cargo tauri build` + `softprops/action-gh-release`. Плюс шаг
   загрузки в MinIO (`aws s3 cp ... --endpoint-url`) под новые secrets
   `S3_UPLOAD_ACCESS_KEY`/`S3_UPLOAD_SECRET_KEY`/`S3_UPLOAD_ENDPOINT` — секретов ещё нет,
   шаг будет падать до того, как пользователь заведёт их сам в GitHub Settings (это
   ожидаемо, не блокер для остального job'а; если технически проще — вынести именно этот
   шаг `continue-on-error: true` с явным комментарием почему).
6. **`docs/features/desktop-app.md`** — дополнить (не новый файл).

## Проверка

`pnpm --filter @vire/web typecheck && lint && check:i18n && test && audit:design` — все
зелёные. Открыть `/download` в dev, визуально проверить все секции. YAML нового job
синтаксически валиден (реальный прогон — только по факту тега, не сейчас).

## Делегирование

Один сабагент (Sonnet), фон. Веб-часть (1-4, 6) и CI-часть (5) — в одном заходе, не
разносить на параллельных агентов (не независимая полноценно работа, один логичный кусок
фичи). Самокритика отдельным прогоном не нужна — гейты + визуальная проверка `/download`
достаточны, YAML не запускается по-настоящему в этом заходе.
