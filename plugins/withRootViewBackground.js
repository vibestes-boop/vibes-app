/**
 * withRootViewBackground.js — Expo Config Plugin
 *
 * Problem: RCTRootView.backgroundColor ist standardmäßig [UIColor systemBackgroundColor].
 * Auf iOS 13+ mit Dark Mode ist systemBackgroundColor SCHWARZ.
 * Wenn Fabric/JS den ersten Frame nicht rechtzeitig committet (buildReactNativeFromSource
 * + iOS 26 Kompatibilitätsprobleme), bleibt der schwarze Hintergrund dauerhaft sichtbar.
 *
 * Fix: Setzt RCTRootView.backgroundColor in AppDelegate auf eine explizite Farbe
 * (Primärfarbe der App: #1a0a24 dunkelviolett).
 * So ist zumindest die App-eigene Hintergrundfarbe sichtbar statt systemBackground-Schwarz.
 */

const { withAppDelegate } = require('@expo/config-plugins');

module.exports = function withRootViewBackground(config) {
  return withAppDelegate(config, (mod) => {
    const contents = mod.modResults.contents;

    // Bereits gepatcht?
    if (contents.includes('withRootViewBackground')) {
      return mod;
    }

    // RCTRootView.backgroundColor nach der rootView-Erstellung setzen.
    // Sucht nach "self.rootView = rootView;" oder ähnlichem und fügt dahinter ein.
    // Fallback: fügt am Ende von application:didFinishLaunchingWithOptions: ein.
    const backgroundPatch = `
  // withRootViewBackground: Setzt explizite Hintergrundfarbe damit Dark Mode nicht schwarz zeigt
  // bevor JS den ersten Frame committet (Diagnose-Fix für iOS 26 + buildReactNativeFromSource).
  if ([self.window.rootViewController.view isKindOfClass:[RCTRootView class]]) {
    self.window.rootViewController.view.backgroundColor = [UIColor colorWithRed:0.1 green:0.04 blue:0.14 alpha:1.0];
  }
  self.window.backgroundColor = [UIColor colorWithRed:0.1 green:0.04 blue:0.14 alpha:1.0];
`;

    // Füge nach "return YES;" in didFinishLaunchingWithOptions ein
    const modifiedContents = contents.replace(
      /(\s*return YES;\s*\})/,
      `${backgroundPatch}$1`
    );

    mod.modResults.contents = modifiedContents;
    return mod;
  });
};
