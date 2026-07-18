module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 3 requires the babel plugin to be the LAST plugin
    // in the chain. The plugin transforms worklet functions; without
    // it, any `useAnimatedStyle` / `useSharedValue` runtime call
    // crashes with "Reanimated 2 failed to create a worklet".
    // `@gorhom/bottom-sheet` (the Filtros sheet) depends on it.
    plugins: ['react-native-reanimated/plugin'],
  };
};
