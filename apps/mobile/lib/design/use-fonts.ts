import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { Unbounded_700Bold, Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';

/**
 * Шрифты кита. Бандлятся в приложение, а не тянутся сетью: иначе первый кадр рисуется
 * системным шрифтом и вся вёрстка «прыгает» при подмене.
 *
 * По одному семейству на вес — Android не синтезирует начертания у кастомных шрифтов
 * надёжно. Кириллица есть у всех: Unbounded рисовался под неё, у Manrope и JetBrains Mono
 * она в основном наборе.
 *
 * Три роли, а не три шрифта «для разнообразия»: Unbounded — витрина (заголовок трека,
 * названия блоков), Manrope — интерфейс, JetBrains Mono — мета. Unbounded широкий и
 * характерный, набирать им строку списка нельзя: он съест ширину и перестанет читаться.
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
    Unbounded_700Bold,
    Unbounded_800ExtraBold,
  });

  // Сбой загрузки не должен держать приложение на сплеше навсегда: рисуем системным
  // шрифтом — некрасиво, но работоспособно.
  return loaded || error !== null;
}
