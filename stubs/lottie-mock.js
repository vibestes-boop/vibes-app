/**
 * lottie-react-native Stub für Expo Go / Dev Build ohne native Lottie.
 * Im echten Dev Build (mit lottie native compiled) wird dieser Stub
 * durch APP_ENV=development in .env deaktiviert.
 */
const React = require('react');
const { View } = require('react-native');

// No-op LottieView — rendert transparente leere View
const LottieView = React.forwardRef(function LottieView({ style }, ref) {
  return React.createElement(View, { style, ref });
});
LottieView.displayName = 'LottieView';
LottieView.__isStub = true;  // ← Banner erkennt Stub und zeigt Emoji stattdessen

module.exports = LottieView;
module.exports.default = LottieView;
