// Общий набор иконок. Раньше каждый компонент рисовал свои <svg> (PlayIcon был
// продублирован 13 раз, PauseIcon — 8). Здесь — один канонический глиф на иконку.
// Цвет наследуется (`currentColor`) — задаётся классом родителя или `className`
// (напр. `text-white` на тёмных оверлеях). Размер — через `size`.

interface IconProps {
  /** Сторона квадрата в px (width=height). */
  size?: number;
  className?: string;
}

/** Заполненный треугольник «play». Оптическое центрирование (для круглых
 *  кнопок) добавляй классом `translate-x-[1px]` на месте вызова. */
export function PlayIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <polygon points="6,4 20,12 6,20" />
    </svg>
  );
}

/** Две полосы «pause». */
export function PauseIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="5" y="3" width="4" height="18" rx="1" />
      <rect x="15" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

/** Лупа. Обводка наследует цвет (`currentColor`). */
export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
