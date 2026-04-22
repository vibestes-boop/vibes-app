// -----------------------------------------------------------------------------
// Jest-Config für apps/web (Next.js 15 App Router).
//
// next/jest liefert SWC-Transform + automatisches Setup von
// `moduleNameMapper` für CSS-Module und Assets. Darüber drüber legen wir
// unsere eigenen Aliases (@/*), jsdom-Environment und Testing-Library
// Matcher.
//
// Bewusst als .js (CJS) statt .ts — Jest's TS-Config-Parser braucht ts-node,
// das wollen wir uns sparen. next/jest ist selbst CJS, also kein Impedance-
// Mismatch.
//
// Scope (PR 1): unit tests für hooks/* und components/feed/*.
// Nicht für: E2E, Visual-Regression, LiveKit-Room-Integration.
// -----------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextJest = require('next/jest.js');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  setupFiles: ['<rootDir>/jest.polyfills.ts'],
  moduleNameMapper: {
    // Aliases aus tsconfig spiegeln
    '^@/(.*)$': '<rootDir>/$1',
    '^@shared/(.*)$': '<rootDir>/../../shared/$1',
  },
  testMatch: ['<rootDir>/**/__tests__/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  collectCoverageFrom: [
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],
  // Coverage-Thresholds (PR 4):
  //
  // apps/web hat ~110 Source-Files, davon sind heute 3 test-abgedeckt
  // (use-engagement, feed.ts, feed-list.tsx). Globaler Floor wäre statistisch
  // unter 5 % und damit als Gate wertlos. Strategie identisch zur native-Seite:
  // kein global-Block, nur per-file-Gates für die heute getesteten Module.
  //
  // Die Zahlen sind bewusst konservativ (~5-10 Punkte unter dem erwarteten
  // tatsächlichen Wert). Hintergrund: dieser PR wurde ohne lokales
  // jest-Ausführen verifiziert (Sandbox kann next/jest nicht laufen lassen —
  // SWC-Linux-arm64-Binary kommt nicht durch die Egress-Policy), der erste
  // echte Coverage-Run findet auf CI statt. Bricht ein per-file-Gate, ist
  // das eher ein Hint auf einen Code-Pfad den die Tests nicht erfassen als
  // ein Threshold-Problem — in dem Fall entweder Test ergänzen oder Wert
  // vorsichtig senken.
  coverageThreshold: {
    'hooks/use-engagement.ts': {
      statements: 60,
      branches: 45,
      functions: 55,
      lines: 60,
    },
    'lib/data/feed.ts': {
      statements: 60,
      branches: 45,
      functions: 65,
      lines: 60,
    },
    'components/feed/feed-list.tsx': {
      statements: 40,
      branches: 20,
      functions: 30,
      lines: 40,
    },
  },
};

// next/jest exportiert einen Async-Factory der am Ende die finale Config liefert.
module.exports = createJestConfig(customConfig);
