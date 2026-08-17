import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { request } from '@vire/api-client';
import { releaseCatalogResponseSchema, type ReleaseCardDTO } from '@vire/api-contracts';
import type { HomeStackParamList } from '../navigation/home-stack';
import { API_BASE_URL } from '../lib/env';
import { colors, radius } from '../lib/theme';

type LoadState = 'loading' | 'error' | 'ready';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, 'HomeList'>>();
  const [items, setItems] = useState<ReleaseCardDTO[]>([]);
  const [state, setState] = useState<LoadState>('loading');

  const load = useCallback(async () => {
    setState('loading');
    const result = await request(`${API_BASE_URL}/api/v1/releases?sort=fresh&limit=24`, {
      schema: releaseCatalogResponseSchema,
    });
    if (!result.ok) {
      setState('error');
      return;
    }
    setItems(result.data.items);
    setState('ready');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.foreground} size="large" />
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.messageText}>Не удалось загрузить релизы</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.messageText}>Пока нет релизов</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ReleaseCard
          release={item}
          onPress={() =>
            navigation.navigate('ReleaseDetail', {
              releaseId: item.id,
              title: item.title,
              artistName: item.artistName,
              coverUrl: item.coverUrl,
            })
          }
        />
      )}
    />
  );
}

function ReleaseCard({ release, onPress }: { release: ReleaseCardDTO; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[styles.card, pressed && styles.cardPressed]}
    >
      {release.coverUrl ? (
        <Image source={{ uri: release.coverUrl }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]} />
      )}
      {release.hasExplicit && (
        <View style={styles.explicitBadge}>
          <Text style={styles.explicitText}>E</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {release.title}
        </Text>
        <Text style={styles.cardArtist} numberOfLines={1}>
          {release.artistName}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: 16, gap: 16 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 12,
    padding: 24,
  },
  messageText: { color: colors.mutedForeground, fontSize: 15, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: { color: colors.foreground, fontWeight: '700' },
  card: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.card },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  cover: { width: '100%', aspectRatio: 1 },
  coverPlaceholder: { backgroundColor: colors.secondary },
  cardInfo: { padding: 14, gap: 4 },
  cardTitle: { color: colors.cardForeground, fontSize: 17, fontWeight: '700' },
  cardArtist: { color: colors.mutedForeground, fontSize: 14, fontWeight: '500' },
  explicitBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explicitText: { color: colors.foreground, fontSize: 11, fontWeight: '800' },
});
