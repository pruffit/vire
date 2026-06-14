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

/** Сердце (лайк/избранное). `filled` заливает текущим цветом, иначе контур.
 *  Толщину обводки можно поднять (`strokeWidth={2}`) для мелких контурных иконок. */
export function HeartIcon({
  filled = false,
  size = 18,
  strokeWidth = 1.5,
  className,
}: IconProps & { filled?: boolean; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/** Три узла, связанные линиями — «поделиться». */
export function ShareIcon({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

/** Галочка «готово/выбрано». */
export function CheckIcon({ size = 13, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
