/**
 * Keep a plain CommonJS export for Hermes, but use Expo Go's native gradient.
 * The old solid-color placeholder erased photographic overlays and contrast.
 * The relative path bypasses the Expo-Go resolver alias without recursion.
 */
'use strict';
const NativeGradient = require('../node_modules/expo-linear-gradient/build/LinearGradient').LinearGradient;
module.exports = { LinearGradient: NativeGradient };
module.exports.default = module.exports;
