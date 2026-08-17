import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Общие константы лейаута таб-бара/мини-плеера — отдельно от navigation/main-tabs.tsx
// и components/mini-player.tsx, иначе цикл: main-tabs -> home-stack -> home-screen ->
// mini-player -> main-tabs (require cycle, RN разрешает, но с риском undefined на старте).
export const MINI_PLAYER_HEIGHT = 60;
export const TAB_BAR_CONTENT_HEIGHT = 54;

export function useTabBarHeight(): number {
  return TAB_BAR_CONTENT_HEIGHT + useSafeAreaInsets().bottom;
}
