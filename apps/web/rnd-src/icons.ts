// Значки навигации берутся из системного спрайта приложения (`public/icons/system-sprite.svg`),
// а не рисуются здесь путями: набор в проекте уже есть, и второй, нарисованный от руки, разошёлся
// бы с ним по толщине линии, скруглениям и пропорциям.
//
// Спрайт — это `<symbol>` со ссылками `currentColor`. В маску значков его нельзя положить через
// `<use>`: картинка с внешней ссылкой в canvas не рисуется. Поэтому нужный символ вынимается из
// спрайта и собирается в отдельный SVG, который уже можно отрисовать в 2D-контекст.

export type IconName = string;

/** Идентификаторы в спрайте. Четыре раздела: пятый пункт в нижней навигации размывает выбор. */
export const NAV_ICONS: readonly IconName[] = ['vire-home', 'vire-search', 'vire-list', 'vire-user'];

const SPRITE_URL = '/icons/system-sprite.svg';
const images = new Map<IconName, HTMLImageElement>();

/** Значки грузятся один раз; пока не пришли, маска рисуется без них. */
export async function loadIcons(names: readonly IconName[]): Promise<void> {
  const source = await fetch(SPRITE_URL).then((r) => r.text());
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  await Promise.all(
    names.map(async (name) => {
      const symbol = doc.getElementById(name);
      if (!symbol) return;
      const viewBox = symbol.getAttribute('viewBox') ?? '0 0 36 36';
      // `color` задаётся на корне: внутри путей стоит `currentColor`, и белым значок делает
      // именно он. Заливка выключена — набор линейный.
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" color="#fff">` +
        `${symbol.innerHTML}</svg>`;
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      images.set(name, img);
    }),
  );
}

export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, size: number): void {
  const img = images.get(name);
  if (!img) return;
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
}
