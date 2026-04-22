// -----------------------------------------------------------------------------
// Jest-Config Native-Root (Expo SDK 54 / React Native 0.81).
//
// jest-expo-Preset liefert React-Native-Transform + Expo-Module-Stubs.
// testPathIgnorePatterns schließt den apps/web-Ordner aus — der hat
// seinen eigenen Next.js-basierten Jest-Setup mit jsdom.
//
// Scope (PR 1): Skelett-Config, konkrete Tests für lib/* kommen in PR 2
// (liveModerationWords parametric + useGifts pure helpers).
// -----------------------------------------------------------------------------

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: [
    '<rootDir>/lib/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/components/**/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/app/**/__tests__/**/*.test.{ts,tsx}',
  ],
  // apps/web hat eigenes Jest-Setup — nicht vom Root-Config einsaugen.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.expo/',
    '<rootDir>/apps/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?react-native|@react-native(?:-community)?|@react-navigation|expo(?:nent)?|@expo(?:nent)?/.*|@expo-google-fonts/.*|@sentry/react-native|@livekit/react-native|react-native-reanimated|react-native-svg|@shopify/react-native-skia|@shopify/flash-list|sentry-expo|native-base|react-clone-referenced-element|@react-native-async-storage/async-storage|@react-native-masked-view/masked-view)',
  ],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    '!lib/**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Coverage-Thresholds (PR 4):
  //
  // Native-lib/ hat 75+ untested React-Native-Hook-Files (useLiveSession,
  // useGifts, useCoHost, etc.) — globaler Coverage-Floor wäre hier statistisch
  // sinnlos: ein echter Floor läge bei <2 % und würde nichts gegen Regressionen
  // bringen, und ein höherer Floor würde ab Tag 1 brechen. Deshalb bewusst KEIN
  // global-Block — nur per-file-Gates für die 2 heute hart getesteten Helper-
  // Module. Neue Hooks werden als PR-5+-Scope erschlossen; sobald ein halbes
  // Dutzend Hook-Test-Files existiert, kann hier ein global-Floor dazukommen.
  coverageThreshold: {
    'lib/liveModerationWords.ts': {
      statements: 85,
      branches: 80,
      functions: 90,
      lines: 85,
    },
    'lib/gifts.ts': {
      statements: 80,
      branches: 65,
      functions: 80,
      lines: 80,
    },
  },
};
