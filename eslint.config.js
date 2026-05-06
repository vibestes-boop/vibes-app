// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      ".next/**",
      "dist/**",
      "web-build/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "ios/**",
      "android/**",
      "apps/web/.next/**",
      "apps/web/coverage/**",
      "apps/web/test-results/**",
      "apps/web/playwright-report/**",
      "vibes-web/**",
    ],
  }
]);
