/**
 * expo-image-picker stub
 * Purpose: Replaces the native expo-image-picker module which uses TurboModules
 * that crash in Hermes production builds due to non-configurable default getters.
 *
 * Fix: Permissions geben jetzt 'granted' zurück — vorher 'denied', was dazu
 * geführt hat dass nach "OK" im Berechtigung-Alert einfach nichts passierte.
 *
 * Picker-Funktionen zeigen einen informativen Alert statt stumm {} zu returnen.
 * Caption-only Posts funktionieren weiterhin vollständig.
 */
'use strict';

var RN = require('react-native');

var MediaTypeOptions = {
  All: 'All',
  Videos: 'Videos',
  Images: 'Images',
};

var UIImagePickerPresentationStyle = {
  AUTOMATIC: 'automatic',
  FULL_SCREEN: 'fullScreen',
  PAGE_SHEET: 'pageSheet',
  FORM_SHEET: 'formSheet',
  CURRENT_CONTEXT: 'currentContext',
  OVER_FULL_SCREEN: 'overFullScreen',
  OVER_CURRENT_CONTEXT: 'overCurrentContext',
  POPOVER: 'popover',
  NONE: 'none',
};

var CameraType = { front: 'front', back: 'back' };

// Zeigt einen erklärenden Alert und gibt danach 'canceled: true' zurück,
// damit der Create-Screen nicht hängt.
function showPickerUnavailable(title) {
  return new Promise(function (resolve) {
    RN.Alert.alert(
      title || 'Nicht verfügbar',
      'Kamera/Galerie sind in diesem Build deaktiviert (Native-Modul-Schutz). ' +
      'Du kannst trotzdem einen Text-Post (Caption) erstellen.',
      [{ text: 'OK', onPress: function () { resolve({ canceled: true, assets: null }); } }]
    );
  });
}

function launchImageLibraryAsync(_options) {
  return showPickerUnavailable('Galerie nicht verfügbar');
}

function launchCameraAsync(_options) {
  return showPickerUnavailable('Kamera nicht verfügbar');
}

// Permissions: geben 'granted' zurück damit der Create-Screen weiterläuft
var grantedResult = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };

function requestMediaLibraryPermissionsAsync() {
  return Promise.resolve(grantedResult);
}

function requestCameraPermissionsAsync() {
  return Promise.resolve(grantedResult);
}

function getMediaLibraryPermissionsAsync() {
  return Promise.resolve(grantedResult);
}

function getCameraPermissionsAsync() {
  return Promise.resolve(grantedResult);
}

module.exports = {
  __esModule: true,
  MediaTypeOptions: MediaTypeOptions,
  UIImagePickerPresentationStyle: UIImagePickerPresentationStyle,
  CameraType: CameraType,
  launchImageLibraryAsync: launchImageLibraryAsync,
  launchCameraAsync: launchCameraAsync,
  requestMediaLibraryPermissionsAsync: requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync: requestCameraPermissionsAsync,
  getMediaLibraryPermissionsAsync: getMediaLibraryPermissionsAsync,
  getCameraPermissionsAsync: getCameraPermissionsAsync,
};
module.exports.default = module.exports;

