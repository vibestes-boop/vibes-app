/**
 * react-native-screens stub
 *
 * Purpose: Verhindert den Metro-Interop-Crash "_interopNamespace: Cannot assign
 * to property 'default' which has only a getter".
 *
 * Hintergrund: react-native-screens exportiert mit __esModule:true und einem
 * non-configurable getter für 'default'. Metros _interopNamespace() versucht
 * beim Aufbau des Expo-Router Route-Trees .default = ... zu setzen → TypeError.
 *
 * Da wir bereits enableScreens(false) in _layout.full.tsx aufrufen, ist der
 * native Screen-Stack sowieso deaktiviert. Dieser Stub liefert kompatible
 * No-Op-Implementierungen aller öffentlichen Exporte.
 *
 * WICHTIG: module.exports.default = module.exports  (letzter Ausdruck)
 * damit Metros _interopNamespace() 'default' beschreiben kann.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

// No-op passthrough Komponenten
var Screen           = RN.View;
var ScreenContainer  = RN.View;
var ScreenStack      = RN.View;
var ScreenStackHeaderConfig = RN.View;
var ScreenStackHeaderSubview = RN.View;
var NativeScreen     = RN.View;
var NativeScreenContainer = RN.View;
var NativeScreenNavigationContainer = RN.View;

function enableScreens(_enable) {
  // No-op: in diesem Stub ist native Screens nie aktiviert.
}

function screensEnabled() {
  return false;
}

function useTransitionProgress() {
  return { progress: { value: 1 } };
}

var GestureDetectorProvider = function(props) { return props.children; };
var ScreensRefsContext = React.createContext(null);
var FullWindowOverlay = RN.View;
var SearchBar = function() { return null; };
var UINavigationControllerView = RN.View;

module.exports = {
  Screen:                           Screen,
  ScreenContainer:                  ScreenContainer,
  ScreenStack:                      ScreenStack,
  ScreenStackItem:                  ScreenStack,   // alias – NativeStackView renders ScreenStackItem
  ScreenStackHeaderConfig:          ScreenStackHeaderConfig,
  ScreenStackHeaderSubview:         ScreenStackHeaderSubview,
  NativeScreen:                     NativeScreen,
  NativeScreenContainer:            NativeScreenContainer,
  NativeScreenNavigationContainer:  NativeScreenNavigationContainer,
  enableScreens:                    enableScreens,
  screensEnabled:                   screensEnabled,
  useTransitionProgress:            useTransitionProgress,
  GestureDetectorProvider:          GestureDetectorProvider,
  ScreensRefsContext:               ScreensRefsContext,
  FullWindowOverlay:                FullWindowOverlay,
  SearchBar:                        SearchBar,
  UINavigationControllerView:       UINavigationControllerView,
  // CRITICAL: NativeStackView line 147 does `'x' in compatibilityFlags`.
  // If undefined → TypeError: right operand of 'in' is not an object → crash.
  compatibilityFlags:               {},
};


// KRITISCH: Muss explizit gesetzt sein damit Metro's _interopNamespace()
// die 'default'-Property beschreiben kann (kein Getter-Only).
module.exports.default = module.exports;
