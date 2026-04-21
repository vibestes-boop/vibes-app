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
  // Coverage-Threshold bleibt in PR 1 bewusst aus — Baseline etablieren,
  // Threshold kommt in PR 4.
};

// next/jest exportiert einen Async-Factory der am Ende die finale Config liefert.
module.exports = createJestConfig(customConfig);
