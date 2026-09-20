// Реальный `react-native` — Flow-синтаксис в entry-файле, vitest (node-окружение) не
// парсит. Глобальный алиас в vitest.config.ts подменяет модуль этим стабом для тестов,
// которые транзитивно тянут `lib/env.ts` (NativeModules.SourceCode.scriptURL — запасной
// источник LAN-хоста в dev-client, см. `lib/lan-host.ts` для самой логики без RN-зависимости).
export const NativeModules = { SourceCode: { scriptURL: null as string | null } };

// Стор плеера подписывается на уход в фон, чтобы отчитаться о прослушивании.
export const AppState = { addEventListener: () => ({ remove: () => {} }) };

// Адаптеры VireGlass переводят dp в пиксели устройства ещё в JS (`toLensProps`) — в тестах
// плотность фиксируем единицей, чтобы проверять сами величины, а не масштаб экрана.
export const PixelRatio = { get: () => 1 };

// Стекло слушает системные настройки доступности (lib/design/accessibility.ts). В тестах
// система молчит: включённые настройки проверяются своим моком в самом тесте.
export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  isReduceTransparencyEnabled: async () => false,
  isHighTextContrastEnabled: async () => false,
  isDarkerSystemColorsEnabled: async () => false,
  addEventListener: () => ({ remove: () => {} }),
};

export const Platform = { OS: "android" as const };
