/**
 * Expo Go Stub für @shopify/react-native-skia
 *
 * Skia braucht native TurboModule + Reanimated Worklet Runtime.
 * Beides ist in Expo Go nicht verfügbar (Reanimated ist selbst gestrubbt).
 *
 * Dieser Stub gibt leere Platzhalter zurück → SKIA_READY = false →
 * index.tsx fällt automatisch auf View-Overlays + expo-image zurück.
 */

const noop = () => {};
const NoopComponent = () => null;

module.exports = {
  // Canvas & Rendering
  Canvas: NoopComponent,
  Image: NoopComponent,
  Path: NoopComponent,
  Text: NoopComponent,
  Fill: NoopComponent,
  Circle: NoopComponent,
  Rect: NoopComponent,
  RoundedRect: NoopComponent,
  Group: NoopComponent,
  Blur: NoopComponent,
  Shadow: NoopComponent,
  // Filters
  ColorMatrix: NoopComponent,
  Paint: NoopComponent,
  LinearGradient: NoopComponent,
  RadialGradient: NoopComponent,
  // Hooks
  useImage: () => null,
  useFont: () => null,
  useSharedValueEffect: noop,
  useValue: () => ({ current: 0 }),
  useComputedValue: () => ({ current: null }),
  useTouchHandler: () => ({}),
  usePaintRef: () => ({ current: null }),
  useCanvasRef: () => ({ current: null }),
  useValueEffect: noop,
  // Skia API
  Skia: {
    Path: {
      Make: () => ({
        moveTo: noop,
        lineTo: noop,
        copy: () => ({ moveTo: noop, lineTo: noop, copy: noop }),
        reset: noop,
      }),
      MakeFromSVGString: () => null,
    },
    Font: { Make: () => null },
    Paint: { Make: () => null },
    Image: { MakeImageFromEncoded: () => null },
    MakeImageFromEncoded: () => null,
  },
};
