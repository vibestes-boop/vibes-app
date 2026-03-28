/**
 * expo-haptics stub
 * Purpose: Prevents _interopNamespace TypeError and TurboModule ObjC exceptions.
 * expo-haptics calls native vibration APIs that throw on iOS 26 if the module
 * is initialized from a background thread.
 * All haptic functions are safe no-ops.
 */
'use strict';

var ImpactFeedbackStyle = {
  Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid', Soft: 'soft',
};

var NotificationFeedbackType = {
  Success: 'success', Warning: 'warning', Error: 'error',
};

var SelectionFeedbackStyle = {};

function impactAsync(_style) { return Promise.resolve(); }
function notificationAsync(_type) { return Promise.resolve(); }
function selectionAsync() { return Promise.resolve(); }

module.exports = {
  __esModule: true,
  ImpactFeedbackStyle: ImpactFeedbackStyle,
  NotificationFeedbackType: NotificationFeedbackType,
  SelectionFeedbackStyle: SelectionFeedbackStyle,
  impactAsync: impactAsync,
  notificationAsync: notificationAsync,
  selectionAsync: selectionAsync,
};
module.exports.default = module.exports;
