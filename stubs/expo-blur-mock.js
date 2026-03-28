/**
 * expo-blur stub
 *
 * Problem: expo-blur nutzt native BlurView die in unserem Setup
 * TurboModule-Exceptions auf iOS 18.7+ werfen können.
 *
 * Fix: BlurView wird als semi-transparentes View gerendert.
 * Kein nativer Blur-Effekt, aber App crasht nicht.
 *
 * Wird verwendet in: FeedItem.tsx (Mute-Button)
 */
'use strict';

var React = require('react');
var RN = require('react-native');

var TINT_COLORS = {
  dark:    'rgba(0, 0, 0, 0.72)',
  light:   'rgba(255, 255, 255, 0.72)',
  default: 'rgba(10, 10, 20, 0.72)',
};

var BlurView = function(props) {
  var tint = props.tint || 'default';
  var bg = TINT_COLORS[tint] || TINT_COLORS['default'];

  return React.createElement(RN.View, {
    style: [{ backgroundColor: bg }, props.style],
  }, props.children);
};
BlurView.displayName = 'BlurView';

var ExpoBlurView = BlurView; // alias

module.exports = {
  BlurView: BlurView,
  ExpoBlurView: ExpoBlurView,
};
module.exports.default = module.exports;
