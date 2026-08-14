// Push-Registrierung für Berkat.
//
// Ohne das erreichen den Käufer weder „Du hast gewonnen" noch die
// Zahlungserinnerung noch „Dein Paket ist unterwegs", sobald die App zu ist —
// und genau das ist der Motor des Formats.
//
// ─────────────────────────────────────────────────────────────────────────────
// WICHTIG: NUR in `push_tokens` schreiben, NIEMALS in `profiles.push_token`.
//
// Berkat und Serlo teilen sich dieselbe `profiles`-Zeile. Die Einzelspalte
// `push_token` kann genau einen Token halten — Berkat würde also den von Serlo
// verdrängen und umgekehrt, je nachdem welche App zuletzt gestartet wurde.
// Genau deshalb hat Berkat bis zum 14.08.2026 überhaupt kein Push registriert.
//
// Die Zustellung liest ohnehin die Tabelle: `send_push_to_user()` geht über
// `push_tokens` und filtert nach `app` (Migration 20260814190000). Die
// Einzelspalte wird nur noch von Serlos eigener Registrierung gepflegt und vom
// aktiven Push-Pfad nicht mehr gelesen.
// ─────────────────────────────────────────────────────────────────────────────
//
// Nativ-Modul: braucht einen eigenen Build. In Expo Go schlägt der Import fehl,
// deshalb bedingt per `require` — dieselbe Bauform wie `lib/livekit.ts`.

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { supabase } from './supabase';
import { useSession } from './session';

// Expo Go hat die nativen Module nicht. Ein statischer Import würde die App
// schon beim Laden der Datei töten, lange bevor irgendetwas mit Push passiert.
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;
try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
} catch {
  if (__DEV__) {
    console.warn('[Berkat] expo-notifications fehlt — läuft die App in Expo Go? Push braucht einen eigenen Build.');
  }
}

export const pushAvailable = Notifications !== null;

if (Notifications) {
  // Ohne Handler zeigt iOS im Vordergrund gar nichts an.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Wohin führt ein Tipp auf die Meldung? Alle drei enden im Konto. */
function routeFor(type: unknown): string | null {
  switch (type) {
    // Gewonnen, Erinnerung, versendet — was der Käufer als Nächstes tun oder
    // sehen will, steht im Konto: Sammelkorb bezahlen bzw. Sendung verfolgen.
    case 'auction_won':
    case 'order_payment_reminder':
    case 'order_shipped':
      return '/(tabs)/account';
    default:
      return null;
  }
}

/**
 * Registriert das Gerät und verkabelt das Antippen. Einmal im Wurzel-Layout
 * aufrufen — mehrfach ist unschädlich, aber sinnlos.
 */
export function usePushRegistration(): void {
  const userId = useSession((s) => s.userId);
  // Ein Token je Anmeldung genügt. Ohne diese Sperre schreibt jeder Re-Render
  // erneut in die Tabelle.
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!Notifications || !userId) return;
    if (registeredFor.current === userId) return;

    let cancelled = false;

    (async () => {
      try {
        // Der Simulator hat keine Push-Fähigkeit — dort gar nicht erst fragen,
        // sonst steht eine Berechtigungs-Abfrage im Weg, die nie etwas bringt.
        if (Device && !Device.isDevice) return;

        const current = await Notifications!.getPermissionsAsync();
        let granted = current.granted;
        if (!granted && current.canAskAgain) {
          const asked = await Notifications!.requestPermissionsAsync();
          granted = asked.granted;
        }
        if (!granted || cancelled) return;

        if (Platform.OS === 'android') {
          // Ohne eigenen Kanal landet alles im System-Kanal „Sonstiges":
          // kein Banner, kein Ton, im Doze-Modus verzögert.
          await Notifications!.setNotificationChannelAsync('default', {
            name: 'Berkat',
            importance: Notifications!.AndroidImportance.MAX,
          });
        }

        const projectId =
          (require('expo-constants').default?.expoConfig?.extra?.eas?.projectId as string | undefined) ??
          undefined;
        const { data: token } = await Notifications!.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (!token || cancelled) return;

        const { error } = await supabase
          .from('push_tokens')
          .upsert(
            {
              user_id: userId,
              token,
              platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'other',
              // Der Unterschied, um den es geht.
              app: 'berkat',
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,token' },
          );

        if (error) {
          if (__DEV__) console.warn('[Berkat] push_tokens-Eintrag fehlgeschlagen:', error.message);
          return;
        }

        registeredFor.current = userId;
        if (__DEV__) console.log('[Berkat] Push registriert');
      } catch (err) {
        if (__DEV__) console.warn('[Berkat] Push-Registrierung:', (err as Error)?.message ?? err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Antippen einer Meldung → passender Bildschirm.
  useEffect(() => {
    if (!Notifications) return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = routeFor(response.notification.request.content.data?.type);
      if (target) router.push(target as never);
    });

    return () => sub.remove();
  }, []);
}
