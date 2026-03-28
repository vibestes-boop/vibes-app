/**
 * react-native-reanimated compatibility stub.
 *
 * Purpose: Replace the native worklet runtime with a pure-JS implementation
 * to prevent the ObjCTurboModule::performVoidMethodInvocation crash on iOS.
 *
 * When reanimated is mocked here, the NativeReanimated TurboModule is never
 * loaded from JS, so its native initialization (which throws an ObjC exception)
 * never runs.
 *
 * Trade-off: animations are instant (no smooth transitions), but all final
 * states are correct and the app does not crash.
 */
'use strict';

var React = require('react');
var RN = require('react-native');

// ---------------------------------------------------------------------------
// useSharedValue
// Stores a mutable value. Setting .value batches the React state update via
// setTimeout(0) so that rapid gesture updates (pan.onUpdate fires every frame)
// are coalesced into fewer re-renders, and state updates never fire on
// already-unmounted components (which caused the CommentsSheet swipe crash).
// ---------------------------------------------------------------------------
function useSharedValue(initialValue) {
  var stateArr = React.useState(initialValue);
  var setState = stateArr[1];
  var ref = React.useRef(initialValue);
  var pendingRef = React.useRef(null);

  return React.useMemo(function () {
    return {
      get value() { return ref.current; },
      set value(v) {
        ref.current = v;
        // Cancel any previously scheduled update and schedule a new one.
        // This batches all rapid updates (e.g. from pan.onUpdate) into a
        // single re-render at the end of the current gesture event.
        if (pendingRef.current !== null) {
          clearTimeout(pendingRef.current);
        }
        pendingRef.current = setTimeout(function () {
          pendingRef.current = null;
          setState(function () { return ref.current; });
        }, 0);
      },
    };
  }, [setState]);
}

// ---------------------------------------------------------------------------
// useAnimatedStyle
// Runs the factory on every render so that it always reflects the current
// value of any shared values accessed inside.
// Wrapped in try-catch: if factory throws (e.g. undefined.value), returns {}
// instead of crashing the entire component tree.
// ---------------------------------------------------------------------------
function useAnimatedStyle(factory) {
  try {
    return factory();
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Animation helpers – return the target value immediately (no easing).
// Callbacks use a 50ms delay (instead of 0ms) so that all pending
// useSharedValue setState calls (which use 0ms) fire and commit BEFORE
// onClose() is called. This prevents setState on unmounted components:
//
//   withTiming(SCREEN_HEIGHT, {}, onClose)  →  schedules callback at t+0
//   translateY.value = SCREEN_HEIGHT        →  schedules setState  at t+0
//
//   Without delay: callback fires FIRST → onClose → unmount → setState CRASHES
//   With 50ms:     setState fires first (0ms) → re-render done → callback (50ms)
//                  → onClose → unmount cleanly ✓
// ---------------------------------------------------------------------------
function withTiming(toValue, _options, callback) {
  if (typeof callback === 'function') {
    var cb = callback;
    setTimeout(function () { cb(true); }, 50);
  }
  return toValue;
}

function withSpring(toValue, _options, callback) {
  if (typeof callback === 'function') {
    var cb = callback;
    setTimeout(function () { cb(true); }, 50);
  }
  return toValue;
}

function withSequence() {
  return arguments[arguments.length - 1];
}

function withRepeat(animation) {
  return animation;
}

function withDelay(_delay, animation) {
  return animation;
}

// ---------------------------------------------------------------------------
// Layout animation stubs (entering / exiting props are silently ignored).
// ---------------------------------------------------------------------------
var noopLayoutAnim = {
  duration: function () { return noopLayoutAnim; },
  delay: function () { return noopLayoutAnim; },
  springify: function () { return noopLayoutAnim; },
  easing: function () { return noopLayoutAnim; },
  damping: function () { return noopLayoutAnim; },
  stiffness: function () { return noopLayoutAnim; },
};

var FadeIn      = noopLayoutAnim;
var FadeOut     = noopLayoutAnim;
var FadeInDown  = noopLayoutAnim;
var FadeInUp    = noopLayoutAnim;
var FadeOutDown = noopLayoutAnim;
var FadeOutUp   = noopLayoutAnim;
var SlideInDown = noopLayoutAnim;
var SlideInUp   = noopLayoutAnim;
var SlideOutDown = noopLayoutAnim;
var SlideOutUp  = noopLayoutAnim;
var ZoomIn      = noopLayoutAnim;
var ZoomOut     = noopLayoutAnim;
var BounceIn    = noopLayoutAnim;
var BounceOut   = noopLayoutAnim;
var Layout      = noopLayoutAnim;
var LinearTransition = noopLayoutAnim;
var CurvedTransition = noopLayoutAnim;

// ---------------------------------------------------------------------------
// Animated components – wraps regular RN components and strips
// reanimated-specific props (entering, exiting, layout).
// ---------------------------------------------------------------------------
function stripReanimatedProps(props) {
  var rest = Object.assign({}, props);
  delete rest.entering;
  delete rest.exiting;
  delete rest.layout;
  return rest;
}

var AnimatedView = React.forwardRef(function (props, ref) {
  return React.createElement(RN.View, Object.assign({}, stripReanimatedProps(props), { ref: ref }));
});

var AnimatedText = React.forwardRef(function (props, ref) {
  return React.createElement(RN.Text, Object.assign({}, stripReanimatedProps(props), { ref: ref }));
});

var AnimatedImage = React.forwardRef(function (props, ref) {
  return React.createElement(RN.Image, Object.assign({}, stripReanimatedProps(props), { ref: ref }));
});

var AnimatedScrollView = React.forwardRef(function (props, ref) {
  return React.createElement(RN.ScrollView, Object.assign({}, stripReanimatedProps(props), { ref: ref }));
});

var AnimatedFlatList = React.forwardRef(function (props, ref) {
  return React.createElement(RN.FlatList, Object.assign({}, stripReanimatedProps(props), { ref: ref }));
});

function createAnimatedComponent(Component) {
  return React.forwardRef(function (props, ref) {
    return React.createElement(Component, Object.assign({}, stripReanimatedProps(props), { ref: ref }));
  });
}

// Default export mimics the Animated namespace from reanimated
// IMPORTANT: useEvent must be here because react-native-gesture-handler
// accesses it via the DEFAULT export: import Reanimated from 'react-native-reanimated'
// → Reanimated.useEvent(...). Without it, GestureDetector setup fails and
// swiping causes a crash.
var Animated = {
  View: AnimatedView,
  Text: AnimatedText,
  Image: AnimatedImage,
  ScrollView: AnimatedScrollView,
  FlatList: AnimatedFlatList,
  createAnimatedComponent: createAnimatedComponent,
  // Exposed here so RNGH can access via default export
  useEvent: function useEvent(handler, _eventNames, _rebuild) {
    return React.useCallback(function (event) {
      if (typeof handler === 'function') handler(event, {});
    }, [handler]);
  },
  addWhitelistedNativeProps: function () {},
  addWhitelistedUIProps: function () {},
};

// ---------------------------------------------------------------------------
// Other exports that may be used
// ---------------------------------------------------------------------------
function useAnimatedScrollHandler() { return {}; }
function useAnimatedRef() { return React.createRef(); }
function useScrollViewOffset() { return useSharedValue(0); }
function useDerivedValue(factory) { return useSharedValue(factory()); }
function useAnimatedReaction() {}
function useFrameCallback() {}
function useAnimatedKeyboard() { return { height: useSharedValue(0) }; }

function runOnUI(fn) { return fn; }
function runOnJS(fn) { return fn; }
function makeMutable(v) { return useSharedValue(v); }
function makeShareable(v) { return v; }

// useEvent: wird von react-native-gesture-handler intern verwendet
// um Gesture-Callbacks mit dem Reanimated-Worklet-System zu verbinden.
// In unserem Stub rufen wir den Handler direkt auf dem JS-Thread auf.
function useEvent(handler, _eventNames, _rebuild) {
  return React.useCallback(function (event) {
    if (typeof handler === 'function') {
      handler(event, {});
    }
  }, [handler]);
}

var Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
var Extrapolate  = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };

function interpolate(value, inputRange, outputRange) {
  var inputMin  = inputRange[0];
  var inputMax  = inputRange[inputRange.length - 1];
  var outputMin = outputRange[0];
  var outputMax = outputRange[outputRange.length - 1];
  var progress  = (value - inputMin) / (inputMax - inputMin);
  progress = Math.max(0, Math.min(1, progress));
  return outputMin + progress * (outputMax - outputMin);
}

var Easing = RN.Easing;

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------
module.exports = Animated;
module.exports.default = Animated;
module.exports.useSharedValue = useSharedValue;
module.exports.useAnimatedStyle = useAnimatedStyle;
module.exports.useAnimatedScrollHandler = useAnimatedScrollHandler;
module.exports.useAnimatedRef = useAnimatedRef;
module.exports.useScrollViewOffset = useScrollViewOffset;
module.exports.useDerivedValue = useDerivedValue;
module.exports.useAnimatedReaction = useAnimatedReaction;
module.exports.useFrameCallback = useFrameCallback;
module.exports.useAnimatedKeyboard = useAnimatedKeyboard;
module.exports.withTiming = withTiming;
module.exports.withSpring = withSpring;
module.exports.withSequence = withSequence;
module.exports.withRepeat = withRepeat;
module.exports.withDelay = withDelay;
module.exports.runOnUI = runOnUI;
module.exports.runOnJS = runOnJS;
module.exports.makeMutable = makeMutable;
module.exports.makeShareable = makeShareable;
module.exports.useEvent = useEvent;
module.exports.interpolate = interpolate;
module.exports.Extrapolation = Extrapolation;
module.exports.Extrapolate = Extrapolate;
module.exports.Easing = Easing;
module.exports.createAnimatedComponent = createAnimatedComponent;
module.exports.FadeIn = FadeIn;
module.exports.FadeOut = FadeOut;
module.exports.FadeInDown = FadeInDown;
module.exports.FadeInUp = FadeInUp;
module.exports.FadeOutDown = FadeOutDown;
module.exports.FadeOutUp = FadeOutUp;
module.exports.SlideInDown = SlideInDown;
module.exports.SlideInUp = SlideInUp;
module.exports.SlideOutDown = SlideOutDown;
module.exports.SlideOutUp = SlideOutUp;
module.exports.ZoomIn = ZoomIn;
module.exports.ZoomOut = ZoomOut;
module.exports.BounceIn = BounceIn;
module.exports.BounceOut = BounceOut;
module.exports.Layout = Layout;
module.exports.LinearTransition = LinearTransition;
module.exports.CurvedTransition = CurvedTransition;
