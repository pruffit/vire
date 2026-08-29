// Реальный `react-native` — Flow-синтаксис в entry-файле, vitest (node-окружение) не
// парсит. Глобальный алиас в vitest.config.ts подменяет модуль этим стабом для тестов,
// которые транзитивно тянут `lib/env.ts` (NativeModules.SourceCode.scriptURL — запасной
// источник LAN-хоста в dev-client, см. `lib/lan-host.ts` для самой логики без RN-зависимости).
export const NativeModules = { SourceCode: { scriptURL: null as string | null } };

// Стор плеера подписывается на уход в фон, чтобы отчитаться о прослушивании.
export const AppState = { addEventListener: () => ({ remove: () => {} }) };
