import { scrollEdgeStrength, type ScrollEdgeStyle } from '../vireglass/scroll-edge';

/**
 * Краевой эффект прокрутки у нижней мебели (эталон `docs/vireglass/reference.md` §10) —
 * величины и правила. Канал, по которому они доезжают до экрана, — `lib/scroll-edge.tsx`.
 */

export const SCRIM_STOPS = [0, 0.55, 1] as const;

/** Растворение в фон: контент не темнеет, а уходит в подложку экрана (`colors.background`
 *  и есть `3,2,1`). Так край живёт под светлым стеклом. */
export const SCRIM_DISSOLVE = ['rgba(3,2,1,0)', 'rgba(3,2,1,0.65)', 'rgba(3,2,1,0.9)'] as const;
/** Лёгкое затемнение: стекло ушло в тёмный стиль и гасит контент само, экрану остаётся
 *  меньше. Пик тот же, что у веба (`apps/web/rnd-src/scroll-edge.ts`); у растворения он
 *  достался от прежнего скрима (0.9 против 0.85 у веба), как и трёхстопная кривая вместо
 *  линейной — на устройстве их не пересматривали. */
export const SCRIM_DIM = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.23)', 'rgba(0,0,0,0.35)'] as const;
/** Жёсткий стиль — ровная полоса без градиента; закреплённых видов под мебелью в приложении
 *  нет, и эта ветка пока не выбирается ни разу. */
export const SCRIM_HARD = ['rgba(3,2,1,0.9)', 'rgba(3,2,1,0.9)', 'rgba(3,2,1,0.9)'] as const;

export function scrimColors(style: ScrollEdgeStyle): readonly [string, string, string] {
  if (style === 'hard') return SCRIM_HARD;
  return style === 'dim' ? SCRIM_DIM : SCRIM_DISSOLVE;
}

/**
 * Сила края из замера списка. Правило общее с вебом (`scrollEdgeStrength` в ядре): пока списку
 * есть куда ехать, контент лежит под мебелью и его приглушают; на последних `SCROLL_EDGE_ENGAGE_DP`
 * эффект сходит на нет, потому что под мебелью уже пусто.
 *
 * Пока габаритов нет — полная: мигнуть чистым фоном на первом кадре хуже, чем приглушить лишний
 * раз. Поэтому «ещё не мерили» приходит как `null`, а не нулём: порядок нативных `onLayout` и
 * `onContentSizeChange` не задан, и по нулю эти два случая не различить.
 */
export function edgeStrength(scroll: number, content: number | null, layout: number): number {
  if (layout <= 0 || content === null) return 1;
  if (content <= 0) return 0;
  return scrollEdgeStrength('bottom', scroll, Math.max(content - layout, 0));
}

/**
 * Силу края держит ОДИН владелец — список сфокусированного экрана. Проверка нужна на каждой
 * записи, а не только на входе и выходе: экран при потере фокуса не размонтируется и свои
 * нативные события получать не перестаёт (догрузка данных монтирует список уже ушедшего
 * экрана), а сила на всё приложение одна.
 */
export function createEdgeOwner(write: (value: number) => void) {
  let owner: object | null = null;
  return {
    claim(token: object): void {
      owner = token;
    },
    release(token: object): void {
      if (owner !== token) return;
      owner = null;
      write(1);
    },
    apply(token: object, value: number): void {
      if (owner !== token) return;
      write(value);
    },
  };
}
