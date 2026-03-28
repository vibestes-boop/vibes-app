/**
 * expo-av compatibility stub.
 *
 * Purpose: Prevent expo-av's native EXAVModule from being accessed from JS.
 * The module's serial dispatch queue may throw an ObjC exception on iOS 18+
 * during Audio session setup, triggering the ObjCTurboModule::performVoidMethodInvocation
 * crash (convertNSExceptionToJSError accessing Hermes from wrong thread → SIGSEGV).
 *
 * Trade-off: Video fallback (Expo Go) won't work, but in production builds
 * expo-video is used instead (USE_EXPO_VIDEO = true). Audio is still usable
 * via expo-video's built-in audio handling.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

// ResizeMode constants (used in FallbackFeedVideo)
var ResizeMode = {
  CONTAIN: 'contain',
  COVER: 'cover',
  STRETCH: 'stretch',
  NONE: 'none',
};

// AVPlaybackStatus type placeholder (only used as TypeScript type, fine as empty object)
var AVPlaybackStatus = {};

// No-op Video component (only used when USE_EXPO_VIDEO = false, i.e. Expo Go)
var Video = React.forwardRef(function (props, ref) {
  return React.createElement(RN.View, { style: props.style, ref: ref });
});

// Audio stub – all methods are no-ops returning resolved promises
var Audio = {
  Sound: {
    createAsync: function () { return Promise.resolve({ sound: {}, status: {} }); },
  },
  setAudioModeAsync: function () { return Promise.resolve(); },
  setIsEnabledAsync: function () { return Promise.resolve(); },
  requestPermissionsAsync: function () { return Promise.resolve({ status: 'undetermined' }); },
  getPermissionsAsync: function () { return Promise.resolve({ status: 'undetermined' }); },
  AndroidAudioEncoder: {},
  AndroidOutputFormat: {},
  IOSAudioQuality: {},
  IOSOutputFormat: {},
};

// AndroidImportance placeholder (was in expo-notifications, keep for safety)
var AndroidImportance = { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 };

module.exports = {
  Video: Video,
  ResizeMode: ResizeMode,
  AVPlaybackStatus: AVPlaybackStatus,
  Audio: Audio,
  AndroidImportance: AndroidImportance,
};
module.exports.default = module.exports;
