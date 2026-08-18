import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';

import App from './App';
import { playbackService } from './lib/playback-service';

// registerPlaybackService — обязателен для RNTP на Android (foreground-service/lock-screen),
// регистрируется один раз до рендера, не внутри компонента.
TrackPlayer.registerPlaybackService(() => playbackService);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
