module.exports = {
  presets: [require.resolve('babel-preset-expo', { paths: [require.resolve('expo/package.json')] })],
  plugins: [
    ...(process.env.NODE_ENV === 'production' ? ['./plugins/stripReleaseConsole'] : []),
    'react-native-reanimated/plugin',
  ],
};
