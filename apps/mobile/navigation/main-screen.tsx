import { StyleSheet, View } from 'react-native';
import { MainTabs } from './main-tabs';
import { MiniPlayer } from '../components/mini-player';

export function MainScreen() {
  return (
    <View style={styles.container}>
      <MainTabs />
      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
