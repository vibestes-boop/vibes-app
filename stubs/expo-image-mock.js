/**
 * expo-image stub
 * 
 * expo-image nutzt native Module (RNCImageView) die in unserem Setup
 * nicht initialisiert werden. Als Fallback verwenden wir React Native's
 * eingebautes Image-Component das immer funktioniert.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

// Image: Wraps RN.Image with same API surface as expo-image
var Image = function(props) {
  var source = props.source;
  var style = props.style;
  
  // expo-image supports string source directly, RN.Image needs { uri: ... }
  var rnSource = typeof source === 'string' ? { uri: source } : source;
  
  return React.createElement(RN.Image, {
    source: rnSource,
    style: style,
    resizeMode: props.contentFit === 'contain' ? 'contain' : 
                props.contentFit === 'fill' ? 'stretch' : 'cover',
    onLoad: props.onLoad,
    onError: props.onError,
    onLoadStart: props.onLoadStart,
    onLoadEnd: props.onLoadEnd,
    accessibilityLabel: props.accessibilityLabel,
    blurRadius: props.blurRadius,
  });
};
Image.displayName = 'Image';

// ImageBackground: similar to RN.ImageBackground
var ImageBackground = function(props) {
  return React.createElement(RN.ImageBackground, props);
};
ImageBackground.displayName = 'ImageBackground';

// prefetch: no-op in stub
function prefetch() {
  return Promise.resolve(true);
}

// clearDiskCache / clearMemoryCache: no-ops
function clearDiskCache() { return Promise.resolve(); }
function clearMemoryCache() { return Promise.resolve(); }

module.exports = {
  Image: Image,
  ImageBackground: ImageBackground,
  prefetch: prefetch,
  clearDiskCache: clearDiskCache,
  clearMemoryCache: clearMemoryCache,
};
module.exports.default = Image; // for default import
