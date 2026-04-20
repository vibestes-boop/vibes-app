// LiveKit WebRTC globals — MUSS vor allem anderen geladen werden
// try/catch: falls native Module nicht gelinkt (Expo Go oder alter Build) → kein Crash
try {
  const lk = require('@livekit/react-native');
  if (typeof lk?.registerGlobals === 'function') {
    lk.registerGlobals();
    console.log('[LiveKit] registerGlobals ✅');
  }
} catch (e) {
  console.warn('[LiveKit] registerGlobals nicht verfügbar (Stub oder nicht gelinkt):', e);
}

import 'expo-router/entry';
