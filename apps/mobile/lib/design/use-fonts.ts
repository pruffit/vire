import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';

/**
 * Шрифты кита. Бандлятся в приложение, а не тянутся сетью: иначе первый кадр рисуется
 * системным шрифтом и вся вёрстка «прыгает» при подмене.
 *
 * Семейств семь (по одному на вес) — Android не синтезирует начертания у кастомных
 * шрифтов надёжно. Цена — 0.68 МБ на APK, проверено по самим файлам; кириллица есть
 * во всех семи.
 */
export function useKitFonts(): boolean {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  // Сбой загрузки не должен держать приложение на сплеше навсегда: рисуем системным
  // шрифтом — некрасиво, но работоспособно.
  return loaded || error !== null;
}
