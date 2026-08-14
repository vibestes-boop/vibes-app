import { useEffect, useState, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// So früh wie möglich: setzt den DOMException-Ersatz und meldet LiveKit an,
// bevor irgendein Screen geladen wird. LiveKit verlangt das ausdrücklich vor
// der ersten Benutzung.
import { liveKitAvailable } from '../lib/livekit';
import { useSessionBootstrap } from '../lib/session';
import { usePushRegistration } from '../lib/usePush';
import { MiniLivePlayer } from '../components/MiniLivePlayer';
import { ui } from '../theme/tokens';

type ProviderProps = { children: ReactNode };

// Die Video-Verbindung umschließt den GESAMTEN Navigations-Baum — nur so
// überlebt sie den Wechsel zwischen Raum, Startseite und Reitern. Ohne LiveKit
// (Expo Go) ist es einfach ein Durchreicher.
const LiveStageModule = liveKitAvailable
  ? (require('../components/LiveStage') as {
      LiveRoomProvider: (props: ProviderProps) => ReactNode;
    })
  : null;

function PassThrough({ children }: ProviderProps) {
  return <>{children}</>;
}

const LiveRoomProvider = LiveStageModule?.LiveRoomProvider ?? PassThrough;

function Bootstrap() {
  useSessionBootstrap();
  // Muss NACH useSessionBootstrap stehen: Der Token wird an die Nutzer-ID
  // gebunden, und die kommt erst aus dem Auth-Check.
  usePushRegistration();
  return null;
}

export default function RootLayout() {
  // QueryClient einmal pro App-Leben — nicht bei jedem Render neu, sonst
  // verliert jeder Re-Render den kompletten Cache.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  // React Native hat kein Fenster, das den Fokus verlieren könnte — ohne diese
  // Verkabelung erfährt TanStack Query nie, dass die App im Hintergrund liegt.
  //
  // Zwei Wirkungen, beide gewollt:
  //   • Beim Zurückkommen aus einer fremden App wird nachgeladen statt einen
  //     alten Stand zu zeigen. Bezahlt wird bei Stripe im Browser, und wer
  //     danach zurückwechselt, will sein Paket nicht mehr offen sehen.
  //   • Die regelmäßigen Abfragen pausieren, solange das Gerät in der Tasche
  //     steckt. Vorher lief die 15-Sekunden-Abfrage einer Show weiter, die
  //     gerade niemand ansieht.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Bootstrap />
        {/* Der Standard ist hell — dunkle Symbole in der Statusleiste.
            Der Live-Raum ist die einzige dunkle Fläche und setzt sie selbst
            auf hell. Zwei Flächen, zwei feste Werte, kein Rätselraten. */}
        <StatusBar style="dark" />
        <LiveRoomProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: ui.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="live/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="login" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
          </Stack>
          {/* Liegt über allem, weil die verkleinerte Show über jedem Reiter
              weiterlaufen soll — nicht nur über der Startseite. */}
          <MiniLivePlayer />
        </LiveRoomProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
