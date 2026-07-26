# Срез 3 — контентные экраны — план реализации

Спека: `docs/superpowers/specs/2026-07-26-mobile-slice-3-content-screens-design.md`.
Все правки — className-only, логика/разметка не меняются. Десктоп-плотность неизменна
(тач через `pointer-coarse:`).

## Правки (точные old → new)

### 1. `apps/web/components/listener/profile/profile-hero.tsx` (карандаш ~стр. 230–236)
Кнопка `startEdit`:
- old class: `opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity`
- new class: `opacity-0 group-hover:opacity-40 hover:!opacity-100 pointer-coarse:opacity-100 pointer-coarse:w-11 pointer-coarse:h-11 pointer-coarse:-m-1.5 inline-flex items-center justify-center transition-opacity`

### 2. `apps/web/app/(listener)/artists/[slug]/releases/[releaseId]/tracks/[trackId]/page.tsx`
**Крошки (стр. 155):** `nav` class
- old: `flex items-center gap-2 text-xs font-mono …`
- new: `flex flex-wrap items-center gap-2 min-w-0 text-xs font-mono …` (остальное сохранить)
На обоих `<Link>` внутри крошек добавить в класс `truncate max-w-[16rem]`.

**MetaRow (стр. 346):** внешний `<div>`
- old: `flex items-center gap-2.5 …`
- new: `flex flex-wrap items-center gap-2.5 …` (остальное сохранить)

### 3. `apps/web/app/(listener)/artists/[slug]/releases/[releaseId]/tracks/[trackId]/like-button.tsx` (стр. 36)
`motion.button` class добавить `pointer-coarse:min-h-11`:
- old: `flex items-center gap-1.5 text-sm transition-[color,opacity] duration-200 disabled:opacity-40`
- new: `flex items-center gap-1.5 text-sm pointer-coarse:min-h-11 transition-[color,opacity] duration-200 disabled:opacity-40`

### 4. `apps/web/app/(listener)/artists/[slug]/releases/[releaseId]/tracks/[trackId]/waveform-player.tsx` (момент, стр. 134)
- old: `w-8 h-8 rounded-full flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity`
- new: `w-8 h-8 pointer-coarse:w-11 pointer-coarse:h-11 rounded-full flex items-center justify-center opacity-40 hover:opacity-80 transition-opacity`

### 5. `apps/web/app/(listener)/artists/[slug]/page.tsx`
**Соц-ссылка (стр. 406):**
- old: `inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 transition-opacity hover:opacity-80 sm:h-9 sm:min-w-9 sm:px-2.5`
- new: `inline-flex h-7 min-w-7 pointer-coarse:h-11 pointer-coarse:min-w-11 items-center justify-center rounded-lg px-2 transition-opacity hover:opacity-80 sm:h-9 sm:min-w-9 sm:px-2.5`

**Корень (стр. 174):**
- old: `min-h-full text-[var(--artist-text)] font-sans`
- new: `min-h-full text-[var(--artist-text)] font-sans overflow-x-clip`

### 6. `apps/web/app/(listener)/profile/page.tsx` (стр. 44)
- old: `<main className="min-h-full">`
- new: `<main className="min-h-full overflow-x-clip">`

### 7. `apps/web/components/listener/followed-artists.tsx` (отписка, стр. 84)
- old: `shrink-0 grid place-items-center w-7 h-7 rounded-full …`
- new: `shrink-0 grid place-items-center w-7 h-7 pointer-coarse:w-11 pointer-coarse:h-11 rounded-full …` (остальное сохранить)

### 8. `apps/web/components/listener/profile/linked-accounts-client.tsx` (стр. 59 и 102)
Обе текст-кнопки («Задать»/«Отмена» toggle и «Привязать»):
- добавить в class `pointer-coarse:min-h-11 inline-flex items-center` (к существующему
  `text-xs text-primary underline-offset-2 hover:underline cursor-pointer`).

## Проверка примитивов / переиспользование

Готовых обёрток не создаём — все механизмы (`pointer-coarse:`, хит-зона) уже в
`mobile-patterns.md`. `touchTargetClass` не подходит (безусловный, менял бы десктоп) —
используем coarse-gated литералы, как в Срезе 2 (player-like).

## Doc / ledger

- `docs/features/mobile-patterns.md` — добавить в «Где код» пункт про контентные экраны
  (крошки wrap, MetaRow wrap, тач-таргеты соц-ссылок/момента/отписки/like/linked-accounts,
  overflow-x-clip корней артиста/профиля) и правило «редактирующие иконки — `pointer-coarse:opacity-100`».
- `.superpowers/sdd/progress.md` — блок Среза 3.

## Гейты (Iron Law)

typecheck · lint · check:routes · test · audit:design · build — свежий прогон перед «готово».
