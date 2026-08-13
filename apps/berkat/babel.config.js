module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    // Kein reanimated-Plugin: Berkat benutzt Reanimated nicht. Die Animationen
    // (Gebots-Knopf, Kategorie-Leiste, Zahlen-Rollup) laufen über das in React
    // Native eingebaute Animated. Ein Plugin für eine Bibliothek, die gar nicht
    // da ist, lässt nur `expo doctor` scheitern.
  };
};
