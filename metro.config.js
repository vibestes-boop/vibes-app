const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// ─── Build-Modus-Erkennung ───────────────────────────────────────────────────
// EAS_BUILD=1         → gesetzt in eas.json env für alle EAS Build Profiles
// CI=true             → gesetzt von EAS Build Servern
// EXPO_NO_DOTENV=1    → intern von EAS CLI gesetzt während Builds
// APP_ENV=development → gesetzt in unserem eas.json development profile
//
// WICHTIG: Im Dev Client (Dev Build + npx expo start) läuft Metro auf dem Mac,
// nicht auf dem EAS Server. Daher EAS_BUILD NICHT gesetzt — aber wir wollen
// KEINE Stubs, weil der Dev Build echte native Module hat.
// Lösung: APP_ENV=development → Dev Build, kein Stub.
const IS_DEV_BUILD =
  process.env.EAS_BUILD === '1' ||
  process.env.CI === 'true' ||
  process.env.CI === '1' ||
  process.env.EXPO_NO_DOTENV === '1' ||
  process.env.APP_ENV === 'development';   // ← Dev Build mit npx expo start

const IS_EAS_BUILD = IS_DEV_BUILD; // Alias für Abwärtskompatibilität

console.log(`[metro] Build-Modus: ${IS_EAS_BUILD ? '🏗️  Dev/EAS Build (native Module aktiv)' : '📱 Expo Go (Stubs aktiv)'}`);


// ─── Permanente Stubs (immer aktiv — lösen CJS/ESM-Hazards) ─────────────────
const ALWAYS_STUBS = {
  // @tanstack/react-query: dual-package hazard → zwei Context-Instanzen → "No QueryClient set"
  '@tanstack/react-query': require.resolve('@tanstack/react-query'),
  // LiveKit: ab Phase 3 installiert → Stubs entfernt, echte Native Module aktiv
};

// ─── Expo-Go-Stubs (nur aktiv wenn KEIN EAS Build) ───────────────────────────
// Ersetzt native TurboModule die in Hermes HBC crashen würden.
// Im EAS Dev-Build: EAS_BUILD=1 → Stubs NICHT aktiv → echte native Module.
const EXPO_GO_STUBS = {
  'react-native-reanimated':        path.resolve(__dirname, 'stubs/reanimated-compat.js'),
  'react-native-safe-area-context': path.resolve(__dirname, 'stubs/safe-area-compat.js'),
  'react-native-screens':           path.resolve(__dirname, 'stubs/screens-compat.js'),
  'expo-linear-gradient':           path.resolve(__dirname, 'stubs/linear-gradient-compat.js'),
  'expo-haptics':                   path.resolve(__dirname, 'stubs/haptics-compat.js'),
  'expo-image-picker':              path.resolve(__dirname, 'stubs/expo-image-picker-mock.js'),
  'expo-clipboard':                 path.resolve(__dirname, 'stubs/expo-clipboard-mock.js'),
  'expo-video-thumbnails':          path.resolve(__dirname, 'stubs/expo-video-thumbnails-mock.js'),
  'expo-image':                     path.resolve(__dirname, 'stubs/expo-image-mock.js'),
  'expo-blur':                      path.resolve(__dirname, 'stubs/expo-blur-mock.js'),
  'expo-network':                   path.resolve(__dirname, 'stubs/expo-network-mock.js'),
  'expo-notifications':             path.resolve(__dirname, 'stubs/expo-notifications-mock.js'),
  '@shopify/flash-list':            path.resolve(__dirname, 'stubs/flash-list-mock.js'),
  '@livekit/react-native':          path.resolve(__dirname, 'stubs/livekit-mock.js'),
  '@livekit/react-native-webrtc':   path.resolve(__dirname, 'stubs/livekit-webrtc-mock.js'),
  'lottie-react-native':            path.resolve(__dirname, 'stubs/lottie-mock.js'),
  'react-native-purchases':         path.resolve(__dirname, 'stubs/purchases-mock.js'),
  // Skia: braucht Reanimated Worklet Runtime → funktioniert nicht in Expo Go
  // (weil Reanimated selbst gestrubbt ist). SKIA_READY wird false →
  // index.tsx fällt auf View-Overlays + expo-image zurück.
  '@shopify/react-native-skia':     path.resolve(__dirname, 'stubs/skia-mock.js'),
};

// Aktive Stubs basierend auf Build-Modus
const STUBS = IS_EAS_BUILD
  ? ALWAYS_STUBS
  : { ...ALWAYS_STUBS, ...EXPO_GO_STUBS };

const originalResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (STUBS[moduleName]) {
    return { filePath: STUBS[moduleName], type: 'sourceFile' };
  }
  if (originalResolve) {
    return originalResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// ────────────────────────────────────────────────────────────────────────────
// GLOBALER INTEROP-FIX: Metro's _interopRequireWildcard() wirft TypeError in
// Hermes strict-mode wenn 'default' ein non-configurable getter ist.
// Fix: Bundle-String nach dem Build patchen.
// ────────────────────────────────────────────────────────────────────────────
config.serializer = config.serializer || {};
const expoSerializer = config.serializer.customSerializer;

if (expoSerializer) {
  config.serializer.customSerializer = async function patchBundle(
    entryPoint, preModules, graph, options
  ) {
    const result = await expoSerializer(entryPoint, preModules, graph, options);

    if (typeof result !== 'string') return result;

    const patched = result.replace(
      /\bn\.default\s*=\s*e(?=[,;])/g,
      '(0,function(){try{n.default=e}catch(_IE){try{Object.defineProperty(n,"default",{value:e,writable:true,configurable:true})}catch(_IE2){}}})()' 
    );

    if (patched !== result) {
      console.log('[metro-patch] ✅ _interopNamespace fix applied');
    } else {
      console.warn('[metro-patch] ⚠️ Pattern "n.default=e" NOT FOUND – fix not applied!');
    }

    return patched;
  };
} else {
  console.warn('[metro-patch] ⚠️ Expo serializer not found – interop fix skipped');
}

module.exports = config;
