/**
 * expo-av compatibility stub.
 *
 * Purpose: Prevent expo-av's native EXAVModule from being accessed from JS.
 * The module's serial dispatch queue may throw an ObjC exception on iOS 18+
 * during Audio session setup, triggering the ObjCTurboModule::performVoidMethodInvocation
 * crash (convertNSExceptionToJSError accessing Hermes from wrong thread → SIGSEGV).
 *
 * Video: zeigt URI als Image mit Play-Overlay (iOS extrahiert oft erstes Frame).
 * Audio: no-ops returning resolved promises.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

// ResizeMode constants
var ResizeMode = {
  CONTAIN: 'contain',
  COVER:   'cover',
  STRETCH: 'stretch',
  NONE:    'none',
};

var AVPlaybackStatus = {};

// Video stub – zeigt URI als Image mit Play-Overlay statt schwarzem Screen
var Video = React.forwardRef(function VideoStub(props, _ref) {
  var source = props.source;
  var uri = source && source.uri ? source.uri : null;
  var style = props.style || {};

  return React.createElement(
    RN.View,
    { style: [style, { backgroundColor: '#000', overflow: 'hidden' }] },

    // Video-URI als Image (iOS kann erstes Frame extrahieren)
    uri ? React.createElement(RN.Image, {
      source: { uri: uri },
      style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      resizeMode: 'cover',
    }) : null,

    // Leichtes Overlay
    React.createElement(RN.View, {
      style: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.15)',
      },
    }),

    // Play-Button Mitte
    React.createElement(
      RN.View,
      {
        style: {
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
        },
      },
      React.createElement(
        RN.View,
        {
          style: {
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: 'rgba(0,0,0,0.55)',
            alignItems: 'center', justifyContent: 'center',
          },
        },
        React.createElement(
          RN.Text,
          { style: { color: '#fff', fontSize: 22, marginLeft: 3 } },
          '\u25B6'
        )
      )
    )
  );
});

// Audio stub
var Audio = {
  Sound: {
    createAsync: function () { return Promise.resolve({ sound: {}, status: {} }); },
  },
  setAudioModeAsync:        function () { return Promise.resolve(); },
  setIsEnabledAsync:        function () { return Promise.resolve(); },
  requestPermissionsAsync:  function () { return Promise.resolve({ status: 'undetermined' }); },
  getPermissionsAsync:      function () { return Promise.resolve({ status: 'undetermined' }); },
  AndroidAudioEncoder:      {},
  AndroidOutputFormat:      {},
  IOSAudioQuality:          {},
  IOSOutputFormat:          {},
};

var AndroidImportance = { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 };

module.exports = {
  Video:              Video,
  ResizeMode:         ResizeMode,
  AVPlaybackStatus:   AVPlaybackStatus,
  Audio:              Audio,
  AndroidImportance:  AndroidImportance,
};
module.exports.default = module.exports;
