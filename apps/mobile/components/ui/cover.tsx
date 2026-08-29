import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../../lib/theme';
import { radii } from '../../lib/design/scales';
import { type } from '../../lib/design/typography';

/**
 * Обложка со стабильным плейсхолдером. До кита плейсхолдер был скопирован в 7 файлов,
 * и в каждом отличался — из-за чего списки «дышали» при загрузке.
 *
 * Контент первичен: обложка — самый крупный носитель смысла в музыкальном продукте,
 * поэтому у неё нет рамок и теней, только форма.
 */
export function Cover({
  uri,
  size,
  radius = radii.coverSm,
  explicit = false,
  style,
}: {
  uri: string | null | undefined;
  /** Сторона квадрата; для растягиваемых мест передавать не нужно — задаётся через style. */
  size?: number;
  radius?: number;
  explicit?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const box = size === undefined ? undefined : { width: size, height: size };

  return (
    <View style={[styles.wrap, box, { borderRadius: radius }, style]}>
      {uri ? (
        // `recyclingKey` — иначе при переиспользовании строки списка на миг видна чужая
        // обложка: expo-image держит прежний битмап до загрузки нового.
        <Image source={{ uri }} recyclingKey={uri} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}
      {explicit && (
        <View style={styles.explicit}>
          <Text style={styles.explicitText}>E</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: colors.secondary, aspectRatio: 1 },
  placeholder: { backgroundColor: colors.secondary },
  explicit: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  explicitText: { ...type.mono, fontSize: 10, lineHeight: 12, letterSpacing: 0, color: colors.foreground },
});
