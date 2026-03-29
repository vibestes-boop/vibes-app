import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
// SplashScreen: 'import * as' → _interopRequireWildcard → TypeError on non-configurable .default getter.
// Named imports only to bypass wildcard interop in Hermes production builds.
import { preventAutoHideAsync as splashPreventHide, hideAsync as splashHide } from 'expo-splash-screen';
import type { ComponentType } from 'react';
// WebRTC muss vor jeglicher LiveKit-Room-Verbindung initialisiert werden.
// In Expo Go liefert der Stub eine no-op Implementierung.
import { registerGlobals } from '@livekit/react-native-webrtc';

// Fix: LiveKit's getBrowser() ruft navigator.userAgent.toLowerCase() auf.
// In React Native ist navigator.userAgent undefined → TypeError.
// Workaround: github.com/livekit/client-sdk-js#issues
// @ts-ignore
if (!global.navigator) global.navigator = {} as Navigator;
// @ts-ignore
if (!global.navigator.userAgent) global.navigator.userAgent = 'react-native';

registerGlobals();

splashPreventHide().catch(() => {});

const IS_QUARANTINE = process.env.EXPO_PUBLIC_QUARANTINE_UI === '1';

function QuarantineLayout() {
  useEffect(() => {
    const t = setTimeout(() => splashHide().catch(() => {}), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={qStyles.root} testID="quarantine-root">
      <Text style={qStyles.title}>VIBES — QUARANTÄNE</Text>
      <Text style={qStyles.line}>Build 95 — JS + Rendering funktioniert</Text>
      <Text style={qStyles.hint}>
        Wenn du das siehst:{'\n'}Binary + JS ok → Problem in voller App.
      </Text>
      <Text style={qStyles.mono}>EXPO_PUBLIC_QUARANTINE_UI=1</Text>
    </View>
  );
}

const qStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  line: {
    color: '#FEE2E2',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    color: '#FECACA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  mono: {
    color: '#FCA5A5',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});

export default function RootLayout() {
  // ── Guaranteed fallback: hide native splash after 3s, regardless of child crashes ──
  useEffect(() => {
    const t = setTimeout(() => splashHide().catch(() => {}), 3000);
    return () => clearTimeout(t);
  }, []);

  if (IS_QUARANTINE) {
    return <QuarantineLayout />;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../src/_layout.full') as Record<string, unknown>;
    // Try mod.default first (ESM compiled), then mod itself (CJS module.exports = fn)
    const Full = (mod?.default ?? mod) as (ComponentType<object> | undefined);

    if (typeof Full !== 'function') {
      // Show exactly what the module contains for diagnosis
      const modType = typeof mod;
      const defType = typeof mod?.default;
      const defVal = String(mod?.default);
      const keys = Object.keys(mod ?? {}).slice(0, 8).join(', ') || '(keine)';
      const esm = String((mod as { __esModule?: boolean })?.__esModule);
      return (
        <View style={{ flex: 1, backgroundColor: '#0891B2', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center' }}>
            ERR: kein gültiger Default-Export
          </Text>
          <Text style={{ color: '#A5F3FC', fontSize: 11, textAlign: 'center', marginTop: 12, fontFamily: 'monospace' }}>
            mod type: {modType}{'\n'}
            mod.default type: {defType}{'\n'}
            mod.default val: {defVal}{'\n'}
            __esModule: {esm}{'\n'}
            keys: {keys}
          </Text>
        </View>
      );
    }

    return <Full />;
  } catch (e: unknown) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return (
      <View style={{ flex: 1, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center' }}>
          ERR: require(_layout.full) threw
        </Text>
        <Text style={{ color: '#FEE2E2', fontSize: 11, textAlign: 'center', marginTop: 12, fontFamily: 'monospace' }}>
          {msg}
        </Text>
      </View>
    );
  }
}

