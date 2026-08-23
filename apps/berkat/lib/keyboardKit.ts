// Die Tastatur auf dem UI-Thread — wenn das Binary sie kann.
//
// ── WARUM ES DAS GIBT ────────────────────────────────────────────────────────
//
// `KeyboardAvoidingView` aus React Native animiert AUSSCHLIESSLICH über
// `LayoutAnimation.configureNext`. Und dazu steht im Quelltext von React Native
// selbst (`LayoutAnimation.js`, Zeile 92):
//
//   „In Fabric, LayoutAnimations are unconditionally enabled for Android, and
//    conditionally enabled on iOS (pending fully shipping; this is a temporary
//    state)."
//
// Berkat läuft mit `newArchEnabled: true`. Auf iOS wird die Polsterung damit
// nicht verlässlich animiert — sie SPRINGT, während die Tastatur gleitet. Das
// ist der Fehler, den Zaur am 23.08.2026 gemeldet hat („die kommen nicht
// zusammen hoch"), und **keine JS-Änderung an dieser Komponente kann ihn
// beheben.** Ein erster Versuch am selben Tag hat nur eine von zwei Uhren
// entfernt; die verbliebene war diese.
//
// `react-native-keyboard-controller` hängt sich stattdessen an die nativen
// Tastatur-Rückrufe und bewegt die Fläche per Worklet auf dem UI-Thread. Keine
// Brücke, kein `LayoutAnimation`, nichts, was zu spät kommen kann.
//
// ── ⚠️ WARUM BEDINGT UND NICHT EINFACH IMPORTIERT ────────────────────────────
//
// Es ist ein NATIVES Modul. Es steckt erst im Binary, wenn ein neuer Build
// gelaufen ist — und bis dahin laufen der TestFlight-Build 1.0.0 (1) und Zaurs
// Dev-Build weiter. Ein harter Import würde beide beim nächsten Neuladen
// mitreissen, also ausgerechnet den Stand, auf dem gerade geprüft wird.
//
// Dieselbe Form wie bei LiveKit (`lib/livekit.ts`) und `expo-updates`
// (`lib/buildInfo.ts`): laden, wenn es da ist; sonst der bisherige Weg.
//
// ⚠️ `require` allein reicht als Probe NICHT. Der JavaScript-Teil liegt nach
// `npm install` in jedem Fall in `node_modules` — der Aufruf gelingt also auch
// dann, wenn im Binary gar nichts davon ist. Erst beim Benutzen fiele es auf,
// und zwar als Absturz. Gefragt werden muss die NATIVE Seite, und die
// Bibliothek macht es selbst genauso:
//
//     TurboModuleRegistry.get<Spec>("KeyboardController")
//
// `get` liefert `null`, wenn das Modul fehlt (im Gegensatz zu `getEnforcing`,
// das wirft). Der Name stammt nicht aus der Dokumentation, sondern aus
// `node_modules/react-native-keyboard-controller/lib/commonjs/specs/
// NativeKeyboardController.js` — abgeschrieben, nicht geraten.

import { TurboModuleRegistry } from 'react-native';

/** Steckt das native Modul in diesem Binary? */
export const hasKeyboardController: boolean =
  TurboModuleRegistry.get('KeyboardController') != null;

type Kit = typeof import('react-native-keyboard-controller') | null;

let kit: Kit = null;
if (hasKeyboardController) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    kit = require('react-native-keyboard-controller');
  } catch {
    // Sollte nach der Probe oben nicht vorkommen. Falls doch, ist der Rückfall
    // richtig — eine kaputte Tastatur-Animation ist besser als kein Chat.
    kit = null;
  }
}

/** `null`, solange kein Build mit dem nativen Modul gelaufen ist. */
export const keyboardKit: Kit = kit;
