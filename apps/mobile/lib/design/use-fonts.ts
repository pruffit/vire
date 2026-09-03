import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';

/**
 * Шрифты кита. Бандлятся в приложение, а не тянутся сетью: иначе первый кадр рисуется
 * системным шрифтом и вся вёрстка «прыгает» при подмене.
 *
 * По одному семейству на вес — Android не синтезирует начертания у кастомных шрифтов
 * надёжно. Кириллица проверена по cmap самих TTF у всех трёх семейств.
 *
 * Три роли, а не три шрифта «для разнообразия»: Oswald — витрина (заголовок трека, строка
 * песни, «ПОТОК»), Manrope — интерфейс, JetBrains Mono — мета. Oswald узкий и плакатный:
 * в крупном кегле он даёт характер, в строке списка — нечитаемую гребёнку.
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
    Oswald_600SemiBold,
    Oswald_700Bold,
  });

  // Сбой загрузки не должен держать приложение на сплеше навсегда: рисуем системным
  // шрифтом — некрасиво, но работоспособно.
  return loaded || error !== null;
}
