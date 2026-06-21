# Документация Vire

Карта всей документации проекта, разложенной по папкам. Каждый раздел — отдельная
папка; этот индекс группирует файлы по смыслу. На некоторые файлы ссылаются
`CLAUDE.md` и рабочая память — при переносе пути обновляются вместе.

```
docs/
  PRODUCT.md   — стратегический контекст для скилла Impeccable (лежит плоско намеренно)
  vision/      — концепция, питч, UI-принципы
  roadmap/     — этапы 1–4 + трекинг до 1.0 + бэклог (TODO)
  foundation/  — архитектура, модель данных, техдолг
  features/    — по файлу на каждую реализованную фичу
  ops/         — деплой, бета-тестирование
  security/    — OWASP-проход
```

> **PRODUCT.md** лежит прямо в `docs/` (не в подпапке) намеренно: загрузчик Impeccable
> (`.claude/skills/impeccable/scripts/context.mjs`) ищет его только в корне репо,
> `.agents/context/` и `docs/` — без рекурсии. Внутри подпапки скилл его не найдёт.

## Видение и дизайн (`vision/`)

- [**concept.md**](vision/concept.md) — концепция и продуктовое видение: что решаем, индекс
  этапов, темизация, взаимодействие слушателя, волна. Спек-детали вынесены в `features/`.
- [**pitch.md**](vision/pitch.md) — презентация площадки для артистов и слушателей.
- [**ui-principles.md**](vision/ui-principles.md) — UI/UX-принципы: движение, цвет/токены,
  layout, типографика, доступность. Живой документ.

## Дорожная карта (`roadmap/`)

- [**stage-1.md**](roadmap/stage-1.md) — Этап 1, Friends & Family — **закрыт ✓**.
- [**stage-2.md**](roadmap/stage-2.md) — Этап 2, второй виток (рефакторинг, дизайн, продажи, мерч, афиша, джем) — *текущий*.
- [**stage-3.md**](roadmap/stage-3.md) — Этап 3, полноценная площадка.
- [**stage-4.md**](roadmap/stage-4.md) — Этап 4, стриминг и подписки.
- [**roadmap-1.0.md**](roadmap/roadmap-1.0.md) — повестка до 1.0 («оставшиеся 10%»), актуальный.
- [**TODO.md**](roadmap/TODO.md) — рабочий бэклог задач (Performance/SEO, надёжность, фичи, фидбек).
- [**interactivity-roadmap.md**](roadmap/interactivity-roadmap.md) — ✅ завершён; исторический
  журнал решений по интерактиву/UX.

## Технический фундамент (`foundation/`)

- [**architecture.md**](foundation/architecture.md) — стек, структура монорепо, слои,
  потоки данных, деплой, отказоустойчивость.
- [**data-schema.md**](foundation/data-schema.md) — модель данных (Drizzle/PostgreSQL):
  сущности, связи, решения «на вырост».
- [**TECHNICAL_DEBT.md**](foundation/TECHNICAL_DEBT.md) — известный техдолг и компромиссы.

## Фичи (как сделано) (`features/`)

- [**features/**](features/README.md) — по файлу на каждую фичу: что делает, где код,
  env, ограничения. Правило: новая фича не готова без файла здесь.

## Эксплуатация (`ops/`)

- [**deployment.md**](ops/deployment.md) — деплой на один VPS (Timeweb): подготовка
  сервера, env, CI/CD по тегу `vX.Y.Z`, бэкапы, обновление.
- [**beta-testing.md**](ops/beta-testing.md) — руководство для бета-тестеров: сценарии
  проверки и формат баг-репорта.
- [**load-testing.md**](ops/load-testing.md) — нагрузочный тест (k6): потолок онлайна,
  узкие места; смотреть вместе с `/admin/system`.

## Безопасность (`security/`)

- [**security/owasp-top-10.md**](security/owasp-top-10.md) — проход по чек-листу
  OWASP Top 10 с фиксами.
