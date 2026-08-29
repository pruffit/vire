// Полифилл crypto.getRandomValues (Hermes не даёт его нативно) — первый импорт, до любого
// кода, который трогает крипту (tweetnacl/blakejs, см. lib/e2ee/sodium-compat.ts).
import 'react-native-get-random-values';

import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';

import App from './App';
import { playbackService } from './lib/playback-service';
import { initCrashReporting } from './lib/crash-reporting';

// Первым делом после полифилла: падение на старте — самое ценное и самое трудноуловимое,
// ловить его надо до регистрации сервисов и рендера.
initCrashReporting();

// registerPlaybackService — обязателен для RNTP на Android (foreground-service/lock-screen),
// регистрируется один раз до рендера, не внутри компонента.
TrackPlayer.registerPlaybackService(() => playbackService);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
