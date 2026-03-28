/**
 * expo-linear-gradient stub
 * Purpose: Prevents _interopNamespace TypeError from frozen ESM exports.
 * Renders a View with a visible blended color instead of full black.
 *
 * Fix: nimmt die mittlere Farbe (oder zweite wenn vorhanden) statt der ersten,
 * da die erste oft #0A0A0A (schwarz) ist was wie ein leerer Screen wirkt.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

var LinearGradient = function(props) {
  var colors = props.colors || [];
  // Wähle die mittlere Farbe für bessere Sichtbarkeit.
  // colors[0] ist oft #0A0A0A (fast schwarz) – nicht ideal als Fallback.
  var midIndex = Math.floor((colors.length - 1) / 2);
  var visibleColor = '#1a0a24'; // Fallback: dunkles Lila (App default)
  if (colors.length === 1) {
    visibleColor = typeof colors[0] === 'string' ? colors[0] : visibleColor;
  } else if (colors.length >= 2) {
    // Nimm zweite oder mittlere Farbe — meist nicht schwarz
    var pick = typeof colors[midIndex] === 'string' ? colors[midIndex] : null;
    if (!pick || pick === 'transparent') pick = typeof colors[1] === 'string' ? colors[1] : visibleColor;
    if (pick && pick !== 'transparent') visibleColor = pick;
  }
  return React.createElement(RN.View, {
    ...props,
    style: [{ backgroundColor: visibleColor }, props.style],
  }, props.children);
};
LinearGradient.displayName = 'LinearGradient';

module.exports = { LinearGradient: LinearGradient };
module.exports.default = module.exports;

