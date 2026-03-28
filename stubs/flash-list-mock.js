/**
 * @shopify/flash-list Stub für Expo Go.
 * AutoLayoutView ist ein nativer View der nur im EAS-Build verfügbar ist.
 * Im Expo Go mappen wir FlashList auf FlatList — selbe Props, kein nativer Code.
 * Im EAS Build (EAS_BUILD=1) wird dieses Stub nicht geladen.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

function FlashList(props) {
  // FlashList-spezifische Props die FlatList nicht kennt → entfernen
  var estimatedItemSize = props.estimatedItemSize;
  var overrideItemLayout = props.overrideItemLayout;
  var drawDistance = props.drawDistance;
  var prepareForLayoutAnimationRender = props.prepareForLayoutAnimationRender;
  // Rest an FlatList weitergeben
  var rest = Object.assign({}, props);
  delete rest.estimatedItemSize;
  delete rest.overrideItemLayout;
  delete rest.drawDistance;
  delete rest.prepareForLayoutAnimationRender;

  return React.createElement(RN.FlatList, rest);
}

module.exports = {
  FlashList: FlashList,
  MasonryFlashList: RN.FlatList, // Fallback
};
