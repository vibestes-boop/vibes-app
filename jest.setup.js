// -----------------------------------------------------------------------------
// Native-Root Jest-Setup (Expo SDK 54).
//
// Läuft via setupFilesAfterEnv nach jest-expo-Preset-Boot.
// Hier kommen nur Native-Mocks rein die jedes Test-File brauchen würde:
// Reanimated-Mock und Native-Module-No-ops. Konkrete Supabase/LiveKit-
// Mocks kommen per-test oder als __mocks__/-File in PR 2.
// -----------------------------------------------------------------------------

// Reanimated-Mock (offiziell supported von jest-expo-Preset, aber muss
// explizit geladen werden).
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('react-native-reanimated/mock');

// jest-native Matcher (toBeDisabled, toHaveTextContent, etc.).
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('@testing-library/jest-native/extend-expect');

// Silence console.warn von der Reanimated-Mock-Initialisierung —
// Expo-Preset zeigt ansonsten verrauschte Test-Output.
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('NativeAnimatedHelper')) return;
  originalWarn(...args);
};
