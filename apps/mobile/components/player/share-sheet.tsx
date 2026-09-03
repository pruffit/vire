import { Share, StyleSheet, Text, View } from 'react-native';
import { BottomSheet, SheetRow } from '../ui/bottom-sheet';
import { Cover } from '../ui/cover';
import { type } from '../../lib/design/typography';
import { space, radii } from '../../lib/design/scales';
import { WEB_BASE_URL } from '../../lib/env';

const THUMB = 56;

/**
 * Свой лист «поделиться» вместо системного диалога.
 *
 * Системный отдаёт голый текст в список приложений и ничего не знает про то, чем делятся:
 * ни обложки, ни ссылки на артиста, ни перехода к релизу. Здесь эти переходы — часть листа,
 * а системный диалог остаётся одним из пунктов, а не единственным экраном.
 *
 * Копирования ссылки нет намеренно: буфер обмена в Expo — нативный модуль, а его добавление
 * требует пересборки dev-клиента. Ставить его нужно вместе со следующей нативной правкой.
 */
export function ShareSheet({
  open,
  trackId,
  title,
  artistName,
  coverUrl,
  artistSlug,
  onClose,
  onOpenArtist,
}: {
  open: boolean;
  trackId: string;
  title: string;
  artistName: string;
  coverUrl: string | null | undefined;
  artistSlug: string | null;
  onClose: () => void;
  onOpenArtist: (slug: string) => void;
}) {
  const url = `${WEB_BASE_URL}/track/${trackId}`;

  const system = (message: string) => {
    onClose();
    Share.share({ message, url }).catch(() => {});
  };

  return (
    <BottomSheet open={open} title="Поделиться" onClose={onClose}>
      <View style={styles.track}>
        <Cover uri={coverUrl} size={THUMB} radius={radii.coverSm} />
        <View style={styles.trackText}>
          <Text style={type.row} numberOfLines={1}>
            {title}
          </Text>
          <Text style={type.caption} numberOfLines={1}>
            {artistName}
          </Text>
        </View>
      </View>

      <SheetRow icon="share" label="Отправить ссылку" hint={url} onPress={() => system(url)} />
      <SheetRow
        icon="music"
        label="Отправить с названием"
        hint={`${title} — ${artistName}`}
        onPress={() => system(`${title} — ${artistName}`)}
      />
      {artistSlug && (
        <SheetRow
          icon="user"
          label="Открыть артиста"
          hint={artistName}
          onPress={() => {
            onClose();
            onOpenArtist(artistSlug);
          }}
        />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  trackText: { flex: 1, gap: 2, minWidth: 0 },
});
