import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Unbounded_600SemiBold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';

/**
 * Шрифты кита. Бандлятся в приложение, а не тянутся сетью: иначе первый кадр рисуется
 * системным шрифтом и вся вёрстка «прыгает» при подмене.
 *
 * По одному семейству на вес — Android не синтезирует начертания у кастомных шрифтов
 * надёжно. Кириллица проверена по cmap самих TTF у всех трёх семейств.
 *
 * Три роли, а не три шрифта «для разнообразия»: витрина (заголовок трека, строка песни,
 * «ПОТОК»), Manrope — интерфейс, JetBrains Mono — мета.
 *
 * КАКОЕ ИМЕННО начертание витринное — решает не этот файл, а токен `font.display`
 * (`@vire/design-tokens`): выбор один на веб и Android, иначе одна и та же кнопка выглядит
 * по-разному. Здесь остаётся только загрузить то семейство, которое он называет.
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
    Unbounded_600SemiBold,
    Unbounded_800ExtraBold,
  });

  // Сбой загрузки не должен держать приложение на сплеше навсегда: рисуем системным
  // шрифтом — некрасиво, но работоспособно.
  return loaded || error !== null;
}
