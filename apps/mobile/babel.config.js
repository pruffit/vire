// Skia's <Canvas> обязательно тянет reanimated (несмотря на peerDependenciesMeta.optional —
// sksg/Container.native.js импортирует его напрямую), а reanimated 4 требует
// worklets-плагин: без него любой worklet падает в рантайме. Плагин обязан идти последним.
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
