import { useEffect, useState, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState } from 'react-native';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// So früh wie möglich: setzt den DOMException-Ersatz und meldet LiveKit an,
// bevor irgendein Screen geladen wird. LiveKit verlangt das ausdrücklich vor
// der ersten Benutzung.
// ⚠️ MUSS VOR `../lib/livekit` stehen. Dieser Import startet die
// Fehlerüberwachung als Nebenwirkung; `livekit` meldet als Nebenwirkung LiveKit
// an. Module werden in der Reihenfolge ihrer Imports ausgewertet — wer die
// beiden Zeilen tauscht, verliert alle Abstürze aus der Video-Schicht.
import '../lib/report';
import { keyboardKit } from '../lib/keyboardKit';
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
      {/* ⚠️ `KeyboardProvider` MUSS über allem liegen, was die Tastatur
          beobachtet — die Bibliothek liest ihre Werte aus diesem Kontext.
          Fehlt er, tut ihr `KeyboardAvoidingView` schlicht nichts, ohne sich
          zu beschweren.

          `KeyboardShell` ist bewusst KEIN harter Import: Bis ein Build mit dem
          nativen Modul gelaufen ist, gibt es die Bibliothek im Binary gar
          nicht, und die Hülle reicht ihre Kinder dann einfach durch.
          Begründung in `lib/keyboardKit.ts`. */}
      <KeyboardShell>
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
            {/* Alles, was aus dem Verkäufer-Sheet abgeht. Von rechts wie der
                Rest — nur der Live-Raum und die Anmeldung kommen von unten. */}
            <Stack.Screen name="seller/[id]" />
            <Stack.Screen name="messages/index" />
            <Stack.Screen name="messages/[id]" />
            <Stack.Screen name="tip/[id]" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
          {/* Liegt über allem, weil die verkleinerte Show über jedem Reiter
              weiterlaufen soll — nicht nur über der Startseite. */}
          <MiniLivePlayer />
        </LiveRoomProvider>
      </SafeAreaProvider>
      </KeyboardShell>
    </QueryClientProvider>
  );
}

/**
 * Reicht die Kinder durch, solange das native Tastatur-Modul fehlt.
 *
 * Bis zum nächsten Build ist das der Normalfall — der TestFlight-Build
 * 1.0.0 (1) und Zaurs Dev-Build kennen es nicht. Danach umschliesst es alles
 * mit `KeyboardProvider`, und der Chat wechselt automatisch auf den
 * UI-Thread-Weg (`lib/keyboardKit.ts`).
 */
function KeyboardShell({ children }: { children: React.ReactNode }) {
  const Provider = keyboardKit?.KeyboardProvider;
  if (!Provider) return <>{children}</>;
  return <Provider>{children}</Provider>;
}
