import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { devicesResponseSchema, okResponseSchema, type DeviceDTO } from '@vire/api-contracts';
import type { ProfileStackParamList } from '../navigation/profile-stack';
import { apiRequest } from '../lib/api-client';
import { clearAuthTokens, getDeviceId } from '../lib/secure-store';
import { Screen } from '../components/screen';
import { useContentBottomPadding } from '../lib/layout';
import { Icon } from '../lib/icon';
import { colors, radius } from '../lib/theme';

type LoadState = 'loading' | 'error' | 'ready';

const PLATFORM_LABEL: Record<DeviceDTO['platform'], string> = {
  ios: 'iOS',
  android: 'Android',
  desktop: 'Десктоп',
  other: 'Другое',
};

function formatLastUsed(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>>();
  const bottomPadding = useContentBottomPadding();
  const [devices, setDevices] = useState<DeviceDTO[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    const result = await apiRequest('/api/v1/auth/devices', { schema: devicesResponseSchema });
    if (!result.ok) {
      setState('error');
      return;
    }
    setDevices(result.data.devices);
    setState('ready');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (deviceId: string) => {
    setRevokingId(deviceId);
    const result = await apiRequest(`/api/v1/auth/devices/${deviceId}`, { method: 'DELETE', schema: okResponseSchema });
    setRevokingId(null);
    if (result.ok) setDevices((prev) => prev.filter((d) => d.id !== deviceId));
  };

  const signOut = async () => {
    setSigningOut(true);
    // Берём deviceId из secure store, а не из ещё не загруженного списка `devices` —
    // список зависит от сети (GET .../devices), а deviceId уже лежит локально с логина.
    // Иначе быстрый тап "Выйти" до ответа GET пропускает отзыв на сервере, и отозванный
    // локально телефон продолжает быть активным устройством (и получать пуши) на сервере.
    const deviceId = await getDeviceId();
    if (deviceId) {
      // Лучшая попытка — отзыв текущего устройства на сервере; выходим локально в любом случае.
      await apiRequest(`/api/v1/auth/devices/${deviceId}`, { method: 'DELETE', schema: okResponseSchema });
    }
    await clearAuthTokens();
    // Инкремент 9 вложил ProfileScreen в ProfileStackNavigator — до RootStack теперь два
    // уровня navigator'ов (ProfileStack -> MainTabs -> RootStack), не один.
    navigation.getParent()?.getParent()?.reset({ index: 0, routes: [{ name: 'SignIn' }] });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: bottomPadding }]}>
      <Text style={styles.title}>Профиль</Text>

      <Pressable style={styles.navRow} onPress={() => navigation.navigate('Settings')}>
        <Icon name="sliders" size={18} color={colors.foreground} />
        <Text style={styles.navRowText}>Настройки</Text>
      </Pressable>

      <Pressable style={styles.navRow} onPress={() => navigation.navigate('Friends')}>
        <Icon name="user-check" size={18} color={colors.foreground} />
        <Text style={styles.navRowText}>Друзья</Text>
      </Pressable>

      <Pressable style={styles.navRow} onPress={() => navigation.navigate('Conversations')}>
        <Icon name="message-square" size={18} color={colors.foreground} />
        <Text style={styles.navRowText}>Сообщения</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Устройства</Text>

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.foreground} size="large" />
        </View>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={styles.messageText}>Не удалось загрузить устройства</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Повторить</Text>
          </Pressable>
        </View>
      )}

      {state === 'ready' &&
        devices.map((device) => (
          <View key={device.id} style={styles.deviceRow}>
            <View style={styles.deviceInfo}>
              <View style={styles.deviceNameRow}>
                <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
                {device.current && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Это устройство</Text>
                  </View>
                )}
              </View>
              <Text style={styles.deviceMeta}>
                {PLATFORM_LABEL[device.platform]} · {formatLastUsed(device.lastUsedAt)}
              </Text>
            </View>
            {!device.current && (
              <Pressable
                style={styles.revokeButton}
                onPress={() => revoke(device.id)}
                disabled={revokingId === device.id}
              >
                {revokingId === device.id ? (
                  <ActivityIndicator color={colors.destructive} size="small" />
                ) : (
                  <Text style={styles.revokeText}>Отозвать</Text>
                )}
              </Pressable>
            )}
          </View>
        ))}

      <Pressable style={styles.signOutButton} onPress={signOut} disabled={signingOut}>
        {signingOut ? (
          <ActivityIndicator color={colors.destructive} />
        ) : (
          <Text style={styles.signOutText}>Выйти</Text>
        )}
      </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Раньше был обычный (не скроллящийся) View с marginTop:'auto' на кнопке «Выйти» — при
  // нескольких устройствах контент упирался в таб-бар/мини-плеер без возможности докрутить
  // (та же причина, что чинили в home-screen.tsx). paddingBottom задаётся динамически —
  // useContentBottomPadding().
  container: { padding: 16, gap: 12 },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  navRowText: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  sectionTitle: { color: colors.mutedForeground, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 8 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 32 },
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
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
  },
  deviceInfo: { flex: 1, gap: 4 },
  deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceName: { color: colors.cardForeground, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  deviceMeta: { color: colors.mutedForeground, fontSize: 13 },
  currentBadge: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeText: { color: colors.primaryForeground, fontSize: 11, fontWeight: '700' },
  revokeButton: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  revokeText: { color: colors.destructive, fontWeight: '700' },
  signOutButton: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  signOutText: { color: colors.destructive, fontSize: 16, fontWeight: '700' },
});
