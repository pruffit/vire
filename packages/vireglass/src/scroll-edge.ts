// Краевой эффект прокрутки (эталон 219 @8:52). Эффект — работа ЭКРАНА, а не материала: он
// ложится на контент под панелью, и стекло видит уже приглушённый фон. Здесь только правила,
// общие для веба и Android; рисует их каждая платформа своими средствами.

export type ScrollEdgeStyle = 'dissolve' | 'dim' | 'hard';

/**
 * Стиль края идёт за стилем ближайшего стекла: светлая надпись — тёмное стекло, и контент под
 * ним уходит в лёгкое затемнение; тёмная надпись — светлое стекло, и контент растворяется в фон.
 * Закреплённый вид под панелью (заголовки колонок) получает ровную полосу без градиента.
 */
export function scrollEdgeStyle(inkLight: boolean, pinned = false): ScrollEdgeStyle {
  if (pinned) return 'hard';
  return inkLight ? 'dim' : 'dissolve';
}

/** На сколько контент должен заехать под панель, чтобы эффект проявился целиком, dp. */
export const SCROLL_EDGE_ENGAGE_DP = 24;

/**
 * Сила края по прокрутке. Без прокрутки контент у верха под панель не заезжает — и эффекта
 * нет (кадр письма у верха: шапка лежит на чистом фоне). Снизу контент заезжает, пока ему
 * есть куда прокручиваться.
 */
export function scrollEdgeStrength(side: 'top' | 'bottom', scroll: number, maxScroll: number): number {
  const room = side === 'top' ? scroll : maxScroll - scroll;
  return Math.min(Math.max(room / SCROLL_EDGE_ENGAGE_DP, 0), 1);
}
