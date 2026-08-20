module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-detects react-native-reanimated/react-native-worklets
    // in node_modules and wires up their required transform — no need to add
    // it to `plugins` by hand (SDK 50+ behavior).
    presets: ["babel-preset-expo"],
  };
};
