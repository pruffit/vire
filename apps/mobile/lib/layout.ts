import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mockScale } from './design/mock';
import { usePlayerStore } from './player-store';

// Общие константы лейаута таб-бара/мини-плеера — отдельно от navigation/main-tabs.tsx
// и components/mini-player.tsx, иначе цикл: main-tabs -> home-stack -> home-screen ->
// mini-player -> main-tabs (require cycle, RN разрешает, но с риском undefined на старте).
//
// Это величины МАКЕТА. Продукт берёт их через `useFurniture()`, в масштабе экрана; сырыми
// их читает только стенд материала, где телефон нарисован в размер макета.
export const MINI_PLAYER_HEIGHT = 48;
export const TAB_BAR_CONTENT_HEIGHT = 68;
/** Габарит капсулы в стенде материала (`screens/material-lab-elements.tsx`). */
export const PLAYER_TRANSPORT_HEIGHT = 72;
const CONTENT_BREATHING_ROOM = 16;

/** Габариты нижней фурнитуры в макете (`apps/web/rnd-src/main.ts`). */
const MOCK_NAV = 52;
const MOCK_PLATE = MINI_PLAYER_HEIGHT;
const MOCK_PLATE_GAP = 14;
/** Середина ряда навигации от нижней кромки экрана. */
const MOCK_NAV_CENTER = 58;

export type Furniture = {
  nav: number;
  plate: number;
  gap: number;
  /** Отступ ряда навигации от нижней кромки. */
  navBottom: number;
  plateBottom: number;
};

/**
 * Фурнитура в масштабе экрана. Числа макета — пропорции: перенесённые сырыми, на широком
 * аппарате они дают ряд заметно мельче нарисованного (`lib/design/mock.ts`).
 */
export function useFurniture(): Furniture {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const k = mockScale(width);
  const nav = Math.round(MOCK_NAV * k);
  const plate = Math.round(MOCK_PLATE * k);
  const gap = Math.round(MOCK_PLATE_GAP * k);
  // Системная вставка макету неизвестна: под жестовой полосой ряд не может стоять ниже неё.
  const navBottom = Math.max(insets.bottom + 8, Math.round(MOCK_NAV_CENTER * k) - nav / 2);
  return { nav, plate, gap, navBottom, plateBottom: navBottom + nav + gap };
}

/**
 * Скрим под нижней фурнитурой.
 *
 * Рисуется ВНУТРИ цели блюра, поверх контента, — ровно как `drawFoot` в стенде идёт до
 * стеклянных деталей. Иначе линза целится в контент напрямую, градиента над ним не видит,
 * и деталь показывает неприглушённый текст там, где вокруг всё затемнено.
 */
export const SCRIM_RATIO = 0.3;
export const SCRIM_COLORS = ['rgba(3,2,1,0)', 'rgba(3,2,1,0.65)', 'rgba(3,2,1,0.9)'] as const;
export const SCRIM_STOPS = [0, 0.55, 1] as const;

export function useScrimHeight(): number {
  const { height } = useWindowDimensions();
  const { navBottom, nav } = useFurniture();
  return Math.max(navBottom + nav, height * SCRIM_RATIO);
}

// Инкремент 19 сделал таб-бар `position:'absolute'` — навигатор больше не резервирует
// под него место сам, экраны обязаны сами оставлять нижний отступ (тот же класс бага, что
// чинили в инкременте 18 для мини-плеера, но теперь распространяется на таб-бар). Раньше
// это был магический `paddingBottom:96` в каждом экране (верно только когда
// insets.bottom≈0 — на устройствах с жестовой навигацией снизу считал бы неверно). Один
// хук вместо копипасты формулы по всем экранам.
export function useContentBottomPadding(): number {
  // Место под мини-плеер резервируется, только когда он реально на экране (условие 1:1 с
  // components/mini-player.tsx). Безусловный отступ давал 70 dp пустоты внизу каждого
  // списка: список улистывается далеко за контент, а под кнопками навигации оказывается
  // голый фон — преломлять нечего, и стекло выглядит выключенным.
  const hasTrack = usePlayerStore((s) => s.queue[s.queueIndex] !== undefined);
  const { nav, plate, gap, navBottom } = useFurniture();
  return navBottom + nav + (hasTrack ? gap + plate : 0) + CONTENT_BREATHING_ROOM;
}
