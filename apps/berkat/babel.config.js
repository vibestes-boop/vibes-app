module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // ⚠️ SEIT 23.08.2026, und hier stand vorher das Gegenteil:
      // „Kein reanimated-Plugin: Berkat benutzt Reanimated nicht."
      //
      // Das stimmte, bis der Chat eine Tastatur brauchte, die mit dem Feld
      // zusammen hochkommt. Der Grund steht im Quelltext von React Native
      // selbst (`LayoutAnimation.js`, Zeile 92):
      //
      //   „In Fabric, LayoutAnimations are unconditionally enabled for
      //    Android, and conditionally enabled on iOS (pending fully
      //    shipping; this is a temporary state)."
      //
      // `KeyboardAvoidingView` animiert AUSSCHLIESSLICH über
      // `LayoutAnimation.configureNext`. Berkat läuft mit `newArchEnabled`,
      // also springt die Polsterung auf iOS, statt zu gleiten — und keine
      // JS-Änderung an dieser Komponente kann das beheben.
      // `react-native-keyboard-controller` liest die Tastatur stattdessen auf
      // dem UI-Thread; dafür braucht es Worklets, dafür dieses Plugin.
      //
      // ⚠️ IN REANIMATED 4 HEISST DAS PLUGIN ANDERS. Es liegt nicht mehr unter
      // `react-native-reanimated/plugin`, sondern in einem eigenen Paket:
      // `react-native-worklets/plugin`. `react-native-worklets` steht in
      // Reanimated 4 als harte Peer-Abhängigkeit (`0.5 - 0.8`) und muss
      // ausdrücklich installiert sein — `expo install react-native-reanimated`
      // bringt es NICHT mit. Wer den alten Pfad einträgt, bekommt einen
      // Babel-Fehler, der nach einem Tippfehler aussieht.
      //
      // ⚠️ UND ES MUSS DAS LETZTE PLUGIN IN DER LISTE SEIN (Vorgabe der
      // Bibliothek). Wer eines dahinter hängt, bekommt Worklets, die still
      // nicht auf dem UI-Thread laufen — also genau den Fehler zurück, den
      // dieses Plugin beheben soll, nur unsichtbar.
      'react-native-worklets/plugin',
    ],
  };
};
