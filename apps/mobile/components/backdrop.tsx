import { type ReactNode, type RefObject } from 'react';
import {
  type StyleProp,
  type View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { GlassBackdrop } from 'vireglass/native';

/**
 * Область, чей кадр стекло кладёт под преломление, — одна точка вместо `BlurTargetView`
 * по экранам. Захват делает expo-blur; его уменьшение вчетверо и подмешанная текстура шума
 * сняты патчем библиотеки, а само размытие линзе не нужно — `docs/vireglass/material-lab.md` §E-25.
 */
export function Backdrop({
  targetRef,
  style,
  onLayout,
  children,
}: {
  targetRef: RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
  onLayout?: ViewProps['onLayout'];
  children?: ReactNode;
}) {
  return (
    <BlurTargetView style={style} onLayout={onLayout} ref={targetRef}>
      {GlassBackdrop ? <GlassBackdrop style={fill}>{children}</GlassBackdrop> : children}
    </BlurTargetView>
  );
}


// Свой захват заполняет цель целиком: линза берёт его снимок, а внешняя цель expo-blur
// остаётся только ради фолбэка ниже Android 13.
const fill = { flex: 1 } as const;
