/**
 * lib/theme.ts — Re-Export aus shared/theme/colors.ts
 *
 * Die einzige Source of Truth ist `shared/theme/colors.ts`.
 * Diese Datei leitet alle Exporte weiter — Native-App-Code
 * muss nichts ändern, Imports bleiben identisch.
 *
 * WICHTIG: Farben NUR in shared/theme/colors.ts ändern!
 */
export {
  darkColors,
  lightColors,
  type ThemeColors,
  type ThemeMode,
} from '../shared/theme/colors';
