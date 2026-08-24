import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Общие константы лейаута таб-бара/мини-плеера — отдельно от navigation/main-tabs.tsx
// и components/mini-player.tsx, иначе цикл: main-tabs -> home-stack -> home-screen ->
// mini-player -> main-tabs (require cycle, RN разрешает, но с риском undefined на старте).
export const MINI_PLAYER_HEIGHT = 60;
export const TAB_BAR_CONTENT_HEIGHT = 54;
// Мини-плеер сидит на 10px над таб-баром (components/mini-player.tsx), плюс запас на
// читаемость под ним.
const MINI_PLAYER_GAP = 10;
const CONTENT_BREATHING_ROOM = 16;

export function useTabBarHeight(): number {
  return TAB_BAR_CONTENT_HEIGHT + useSafeAreaInsets().bottom;
}

// Инкремент 19 сделал таб-бар `position:'absolute'` — навигатор больше не резервирует
// под него место сам, экраны обязаны сами оставлять нижний отступ (тот же класс бага, что
// чинили в инкременте 18 для мини-плеера, но теперь распространяется на таб-бар). Раньше
// это был магический `paddingBottom:96` в каждом экране (верно только когда
// insets.bottom≈0 — на устройствах с жестовой навигацией снизу считал бы неверно). Один
// хук вместо копипасты формулы по всем экранам.
export function useContentBottomPadding(): number {
  return useTabBarHeight() + MINI_PLAYER_HEIGHT + MINI_PLAYER_GAP + CONTENT_BREATHING_ROOM;
}
