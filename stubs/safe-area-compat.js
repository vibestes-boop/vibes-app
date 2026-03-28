/**
 * react-native-safe-area-context compatibility stub.
 *
 * Purpose: Prevent RNCSafeAreaProvider from being initialized from JS.
 * On iOS 18+, the module's startObserving() void method accesses UIWindow
 * from its serial dispatch queue, which throws an ObjC exception. This
 * triggers ObjCTurboModule::convertNSExceptionToJSError from the background
 * thread, causing concurrent Hermes access → SIGSEGV.
 *
 * Trade-off: Safe area insets are hardcoded (iPhone-typical values).
 * The UI may have slight padding differences on non-standard devices.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

// Typical iPhone notch/home-indicator values.
// Using Platform to differentiate iOS vs Android.
var TOP_INSET    = RN.Platform.OS === 'ios' ? 47 : 24;
var BOTTOM_INSET = RN.Platform.OS === 'ios' ? 34 : 0;
var SIDE_INSET   = 0;

var DEFAULT_INSETS = {
  top:    TOP_INSET,
  bottom: BOTTOM_INSET,
  left:   SIDE_INSET,
  right:  SIDE_INSET,
};

// Approximate screen dimensions (overridden dynamically where possible)
function getDefaultFrame() {
  var d = RN.Dimensions.get('window');
  return { x: 0, y: 0, width: d.width, height: d.height };
}

var SafeAreaInsetsContext = React.createContext({
  insets: DEFAULT_INSETS,
  frame:  getDefaultFrame(),
});

function SafeAreaProvider(props) {
  return React.createElement(
    SafeAreaInsetsContext.Provider,
    { value: { insets: DEFAULT_INSETS, frame: getDefaultFrame() } },
    props.children
  );
}

var SafeAreaConsumer = SafeAreaInsetsContext.Consumer;

function SafeAreaView(props) {
  var insets  = DEFAULT_INSETS;
  var edges   = props.edges || ['top', 'right', 'bottom', 'left'];
  var padding = {
    paddingTop:    edges.includes('top')    ? insets.top    : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft:   edges.includes('left')   ? insets.left   : 0,
    paddingRight:  edges.includes('right')  ? insets.right  : 0,
  };
  return React.createElement(RN.View, Object.assign({}, props, {
    style: [padding, props.style],
  }));
}

function useSafeAreaInsets() {
  return DEFAULT_INSETS;
}

function useSafeAreaFrame() {
  return getDefaultFrame();
}

var initialWindowMetrics = {
  insets: DEFAULT_INSETS,
  frame:  getDefaultFrame(),
};

module.exports = {
  SafeAreaProvider:    SafeAreaProvider,
  SafeAreaView:        SafeAreaView,
  SafeAreaConsumer:    SafeAreaConsumer,
  SafeAreaInsetsContext: SafeAreaInsetsContext,
  useSafeAreaInsets:   useSafeAreaInsets,
  useSafeAreaFrame:    useSafeAreaFrame,
  initialWindowMetrics: initialWindowMetrics,
};
module.exports.default = module.exports;
