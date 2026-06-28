/**
 * Активная контентная скролл-область app-shell.
 *
 * Скролл живёт в РАЗНЫХ элементах в зависимости от раскладки:
 *  - в оболочках (слушатель/админка) на десктопе — во внутренней панели
 *    `[data-scroll-area]` (сайдбар закреплён, скроллит только контент);
 *  - на мобиле и на простых страницах — в общем `#main-content`.
 *
 * Компоненты, которым нужен «тот самый» скроллер (восстановление позиции,
 * IntersectionObserver-сентинелы, scroll-to-top), должны спрашивать его здесь,
 * а не хардкодить `#main-content` — иначе на десктопе оболочек они смотрят на
 * неподвижный элемент.
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
