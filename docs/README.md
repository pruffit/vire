# Документация VireMusic

Карта всей документации. Здесь ~110 живых документов и ещё ~190 записей журнала —
без карты найти нужное невозможно, поэтому индекс полный, а не выборочный.

**Первое, что нужно знать: документы делятся на три сорта, и верить им можно по-разному.**

| Сорт | Что это | Как читать |
|---|---|---|
| **Живое** | описывает текущее состояние, поддерживается | источник правды после кода |
| **Срез** | аудит или спека с датой | верно на свою дату, не сейчас |
| **Журнал** | `superpowers/` — планы и спеки задач | фиксирует момент, задним числом не правится |

Где документ расходится с кодом — **прав код**. Ссылки на файлы держит гейт
`pnpm check:doc-paths` (619 путей к коду и 361 ссылка между документами).

---

## С чего начать

| Документ | Зачем |
|---|---|
| [vision/concept.md](vision/concept.md) | что за продукт и почему именно такой |
| [status.md](status.md) | что уже построено, по областям |
| [architecture/current-state.md](architecture/current-state.md) | **фактический** срез системы по коду: масштаб, слои, тесты (28.08.2026) |
| [foundation/architecture.md](foundation/architecture.md) | стек, монорепо, слои, потоки данных, деплой |
| [features/README.md](features/README.md) | индекс фичедоков — по файлу на фичу |
| `../CLAUDE.md` | рабочие правила и грабли, на которые уже наступали |

## Видение и продукт

- [vision/concept.md](vision/concept.md) — концепция: что решаем, этапы, темизация, волна.
- [vision/pitch.md](vision/pitch.md) — презентация площадки.
- [vision/ui-principles.md](vision/ui-principles.md) — принципы UI/UX: движение, цвет, типографика, доступность. Живой.
- [PRODUCT.md](PRODUCT.md) — стратегический контекст для скилла Impeccable.

> `PRODUCT.md` лежит плоско в `docs/` намеренно: загрузчик Impeccable
> (`.claude/skills/impeccable/scripts/context.mjs`) ищет его только в корне репо,
> `.agents/context/` и `docs/`, без рекурсии. В подпапке скилл его не найдёт.

## Фичи

[features/README.md](features/README.md) — индекс с шаблоном фичедока. Правило проекта:
**новая фича не готова без файла в `features/`.** Там же — плеер, волна, чат, соцслой,
плейлисты, смартлинки, пресейвы, PWA, RBAC, i18n, SEO, дизайн-система и клиенты.

Крупные документы, которые стоит знать по именам:
[mobile-app.md](features/mobile-app.md) (история 28 инкрементов Android-клиента),
[desktop-app.md](features/desktop-app.md) (Tauri), [player.md](features/player.md),
[web-responsive.md](features/web-responsive.md) (адаптив **веба**, не мобилки —
файл раньше назывался `mobile-patterns.md` и путался с RN-документами).

## Архитектура и платформа

**Фундамент — живое:**
- [foundation/architecture.md](foundation/architecture.md) — стек, слои, потоки, отказоустойчивость.
- [foundation/data-schema.md](foundation/data-schema.md) — модель данных Drizzle/PostgreSQL.
- [foundation/TECHNICAL_DEBT.md](foundation/TECHNICAL_DEBT.md) — известный долг и компромиссы.
- [architecture/dependency-map.md](architecture/dependency-map.md) — кто на кого опирается в монорепо.
- [api-contracts.md](api-contracts.md) — конвенции zod-контрактов (реализовано, гейт `check:contracts`).

**Платформенный трек — проектные документы 10.08.2026.** Написаны как предложение;
часть с тех пор реализована (раскладка `packages/core` на `platform/**`/`music/**` с
гейтом `check:layers`, SDUI главной, контракты). Статус в шапке каждого — на дату
написания, сверяться с `architecture/current-state.md`:
- [architecture.md](architecture.md) — целевая архитектура платформы.
- [platform-core.md](platform-core.md) — что попадает в Core, что остаётся в домене.
- [migration-plan.md](migration-plan.md) — порядок перехода малыми обратимыми шагами.
- [multiplatform.md](multiplatform.md) — стратегия клиентов.
- [sdui.md](sdui.md) — протокол Server-Driven UI (главная мобилки уже на нём, [features/sdui-home.md](features/sdui-home.md)).
- [roadmap/platform-core-brief.md](roadmap/platform-core-brief.md) — краткая версия трека.

## VireGlass

Материал стекла для мобилки: нативный Expo-модуль (Kotlin + AGSL) и Skia-поверхность.
Самая проработанная техническая ветка проекта и главный кандидат на вынос в SDK.

- [vireglass/README.md](vireglass/README.md) — модель материала: причины (ior, толщина, фаска, шероховатость) → следствия.
- [vireglass/architecture.md](vireglass/architecture.md) — карта реализации: слои, параметры, ограничения.
- [vireglass/ADR-001-rendering-architecture.md](vireglass/ADR-001-rendering-architecture.md) — решение по рендерингу и доказательства.
- [vireglass/material-lab.md](vireglass/material-lab.md) — журнал экспериментов над оптикой: гипотеза → наблюдение → решение.
- [vireglass/acceptance.md](vireglass/acceptance.md) — критерии приёмки.
- [vireglass/benchmarks/README.md](vireglass/benchmarks/README.md) — протокол и результаты замеров. Действительны последние ([31.08, после починки захвата](vireglass/benchmarks/2026-08-31-device-after-capture-fix.md)) — до неё линза семплировала пустоту, и прежние цифры недействительны.
- [vireglass/spec-2026-08-28.md](vireglass/spec-2026-08-28.md) — *срез*: исходная спецификация до замеров.

## Эксплуатация

- [ops/deployment.md](ops/deployment.md) — деплой на один VPS, env, CI/CD по тегу `vX.Y.Z`, бэкапы.
- [ops/beta-testing.md](ops/beta-testing.md) — сценарии для бета-тестеров и формат баг-репорта.
- [ops/load-testing.md](ops/load-testing.md) — нагрузочный тест k6. Замер сделан **до** апгрейда железа — нижняя граница.
- [features/monitoring.md](features/monitoring.md) — что есть вместо APM: health, Telegram-алерты, структурный лог.

## Безопасность

- [security/owasp-top-10.md](security/owasp-top-10.md) — проход по чек-листу с фиксами.
- [features/rbac.md](features/rbac.md) — матрица «роль → право», единственный вход `can()`.
- [features/device-auth.md](features/device-auth.md) — Bearer-токены нативных клиентов.
- `../SECURITY.md` — куда сообщать об уязвимости.

## Дорожная карта

- [roadmap/stage-1.md](roadmap/stage-1.md) — Этап 1, Friends & Family — **закрыт**.
- [roadmap/stage-2.md](roadmap/stage-2.md) — Этап 2, прямые продажи — закрыт по пунктам, открыта боевая настройка YooKassa.
- [roadmap/stage-3.md](roadmap/stage-3.md) · [roadmap/stage-4.md](roadmap/stage-4.md) — полноценная площадка, стриминг и подписки.
- [roadmap/roadmap-1.0.md](roadmap/roadmap-1.0.md) — повестка до 1.0.
- [roadmap/TODO.md](roadmap/TODO.md) — рабочий бэклог (в т.ч. очередь мажорных апгрейдов зависимостей).
- [roadmap/interactivity-roadmap.md](roadmap/interactivity-roadmap.md) — *срез*: завершённый трек интерактива.
- [roadmap/release-2026-08-16.md](roadmap/release-2026-08-16.md) — *срез*: план релиза.

## Мобильная реконструкция

Аудит мобильного клиента против веба и план догона (`product/`):

- [product/MOBILE_PARITY_MATRIX.md](product/MOBILE_PARITY_MATRIX.md) — матрица паритета веб → мобилка.
- [product/MOBILE_PRODUCT_READINESS_AUDIT.md](product/MOBILE_PRODUCT_READINESS_AUDIT.md) — готовность как продукта.
- [product/MOBILE_PRODUCT_ARCHITECTURE.md](product/MOBILE_PRODUCT_ARCHITECTURE.md) — целевая архитектура клиента.
- [product/MOBILE_RECONSTRUCTION_ROADMAP.md](product/MOBILE_RECONSTRUCTION_ROADMAP.md) — дорожная карта P0–P6.

## Исторические срезы

Верны на свою дату. Полезны тем, что показывают, как принимались решения:

- [architecture/current-state.md](architecture/current-state.md) — 28.08.2026, состояние по коду. Самый свежий и самый полезный.
- [architecture/audit-2026-08.md](architecture/audit-2026-08.md) — 28.08.2026, широкий аудит системы.
- [architecture/documentation-audit.md](architecture/documentation-audit.md) — 28.08.2026, расхождения документации с кодом.
- [architecture-audit.md](architecture-audit.md) — 10.08.2026, Phase 0. Четыре из пяти блокеров с тех пор закрыты.
- [audits/2026-08-29-product-readiness.md](audits/2026-08-29-product-readiness.md) — готовность продукта.
- [audits/2026-06-frontend-ui-audit.md](audits/2026-06-frontend-ui-audit.md) — UI фронтенда.

## Журнал процесса

[superpowers/README.md](superpowers/README.md) — индекс ~190 планов и спек скилла
`vire-loop`, сгруппированных по темам. **Не читать как описание текущего состояния:**
записи фиксируют решение на дату и задним числом не правятся.
