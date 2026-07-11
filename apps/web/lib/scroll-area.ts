/**
 * Активная скролл-область app-shell: на десктопе оболочек (слушатель/админка) это
 * `[data-scroll-area]` (сайдбар закреплён), иначе — `#main-content`. Компонентам, которым
 * нужен «тот самый» скроллер (восстановление позиции, IntersectionObserver, scroll-to-top),
 * спрашивать его здесь — не хардкодить `#main-content`.
 */
function isScrollable(el: HTMLElement): boolean {
  const oy = getComputedStyle(el).overflowY;
  return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1;
}

export function getContentScrollArea(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const pane = document.querySelector<HTMLElement>('[data-scroll-area]');
  if (pane && isScrollable(pane)) return pane;
  return document.getElementById('main-content');
}
