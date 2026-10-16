# Документация VireMusic

Карта документации: как устроен код и почему. Текущее состояние проектов, планы и задачи —
не здесь: они живут в приватном HQ и на доске задач.

**Первое, что нужно знать: документы делятся на три сорта, и верить им можно по-разному.**

| Сорт | Что это | Как читать |
|---|---|---|
| **Живое** | описывает текущее состояние, поддерживается | источник правды после кода |
| **Срез** | аудит или спека с датой | верно на свою дату, не сейчас |
| **Журнал** | `superpowers/` — планы и спеки задач | фиксирует момент, задним числом не правится |

Где документ расходится с кодом — **прав код**. Ссылки на файлы держит гейт
`pnpm check:doc-paths`.

---

## С чего начать

| Документ | Зачем |
|---|---|
| [vision/concept.md](vision/concept.md) | что за продукт и почему именно такой |
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
[desktop-app.md](features/desktop-app.md) (Tauri), [player.md](features/player.md),
[web-responsive.md](features/web-responsive.md) (адаптив **веба**).

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
написания, сверять с кодом:
- [architecture.md](architecture.md) — целевая архитектура платформы.
- [platform-core.md](platform-core.md) — что попадает в Core, что остаётся в домене.
- [sdui.md](sdui.md) — протокол Server-Driven UI ([features/sdui-home.md](features/sdui-home.md)).

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

## Исторические срезы

Верны на свою дату. Полезны тем, что показывают, как принимались решения:

- [architecture/audit-2026-08.md](architecture/audit-2026-08.md) — 28.08.2026, широкий аудит системы.
- [architecture/documentation-audit.md](architecture/documentation-audit.md) — 28.08.2026, расхождения документации с кодом.
- [architecture-audit.md](architecture-audit.md) — 10.08.2026, Phase 0. Четыре из пяти блокеров с тех пор закрыты.
- [audits/2026-06-frontend-ui-audit.md](audits/2026-06-frontend-ui-audit.md) — UI фронтенда.

## Журнал процесса

[superpowers/README.md](superpowers/README.md) — индекс ~190 планов и спек скилла
`vire-loop`, сгруппированных по темам. **Не читать как описание текущего состояния:**
записи фиксируют решение на дату и задним числом не правятся.
