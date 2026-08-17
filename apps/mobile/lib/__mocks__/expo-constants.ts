// `expo-constants` импортирует `react-native`, чей entry-файл использует Flow-синтаксис —
// vitest (node-окружение, без RN-трансформа) не может его распарсить. Глобальный алиас
// в vitest.config.ts подменяет модуль этим стабом для всех тестов, которые транзитивно
// тянут `lib/env.ts` (напрямую `env.ts` не тестируется — чистая логика вынесена в
// `lib/lan-host.ts` и тестируется там без обращения к `expo-constants` вообще).
const Constants = { expoConfig: null as { hostUri?: string } | null };
export default Constants;
