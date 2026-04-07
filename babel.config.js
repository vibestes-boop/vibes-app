module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // VisionCamera Frame Processors (AR-Filter)
      'react-native-worklets-core/plugin',
      // ⚠️ Reanimated MUSS als letztes Plugin stehen!
      // Erforderlich für: useSharedValue, useAnimatedStyle, Skia-Reanimated-Integration
      'react-native-reanimated/plugin',
    ],
  };
};
