import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuthStore } from './authStore';

// Expo Project ID aus app.json (für getExpoPushTokenAsync in Expo SDK 54 erforderlich)
const EXPO_PROJECT_ID = '02ab536a-5836-4560-a5ec-2dfd6e059f90';
const TOKEN_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  /* Expo Go stub — ignorieren */
}

// Android 8+: Ohne explizit angelegten HIGH/MAX-Channel zeigt Android keine
// Heads-up-Banner und spielt keinen Sound. Expo-Push ohne channelId → 'default'.
try {
  if (Platform.OS === 'android' && typeof Notifications.setNotificationChannelAsync === 'function') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Benachrichtigungen',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#a78bfa',
    }).catch(() => {});
  }
} catch {
  /* Expo Go stub — ignorieren */
}

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener    = useRef<Notifications.EventSubscription | null>(null);
  const tokenSyncInFlight   = useRef(false);
  const lastTokenSync       = useRef<{ userId: string; at: number } | null>(null);

  // ── Reaktiv auf Session warten ────────────────────────────────────────────
  // useAuthStore.getState().session ist beim ersten Mount noch null (SecureStore
  // lädt async). Durch Subscribeuse – wir auf die Session warten.
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Noch nicht eingeloggt → warten
    if (!session || !profile?.id) return;

    let cancelled = false;

    const register = async (force = false) => {
      const previousSync = lastTokenSync.current;
      if (
        !force &&
        previousSync?.userId === profile.id &&
        Date.now() - previousSync.at < TOKEN_REFRESH_INTERVAL_MS
      ) {
        return;
      }
      if (tokenSyncInFlight.current) return;
      tokenSyncInFlight.current = true;

      try {
        if (typeof Notifications.getPermissionsAsync !== 'function') return;

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          __DEV__ && console.log('[PushNotif] Berechtigung nicht erteilt');
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: EXPO_PROJECT_ID,
        });

        const token = tokenData?.data;
        if (!token) {
          __DEV__ && console.warn('[PushNotif] Kein Token erhalten');
          return;
        }

        __DEV__ && console.log('[PushNotif] Token:', token);
        if (cancelled) return;

        // Direkt per REST in profiles speichern — kein Supabase-Client-Hang
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
        const baseHeaders = {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=minimal',
        };

        const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}`, {
          method: 'PATCH',
          headers: baseHeaders,
          body: JSON.stringify({ push_token: token }),
        });

        let pushTokensOk = true;
        try {
          const tokenRes = await fetch(`${supabaseUrl}/rest/v1/push_tokens?on_conflict=user_id,token`, {
            method: 'POST',
            headers: {
              ...baseHeaders,
              'Prefer': 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
              user_id: profile.id,
              token,
              platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'other',
              last_seen_at: new Date().toISOString(),
            }),
          });
          pushTokensOk = tokenRes.ok;
          if (!tokenRes.ok) {
            const text = await tokenRes.text();
            __DEV__ && console.warn('[PushNotif] ❌ push_tokens upsert fehlgeschlagen:', tokenRes.status, text.substring(0, 150));
          }
        } catch (err) {
          pushTokensOk = false;
          __DEV__ && console.warn('[PushNotif] ❌ push_tokens upsert Fehler:', (err as Error)?.message ?? err);
        }

        if (res.ok) {
          __DEV__ && console.log('[PushNotif] ✅ Token in DB gespeichert:', token);
          if (pushTokensOk) {
            lastTokenSync.current = { userId: profile.id, at: Date.now() };
          }
        } else {
          const text = await res.text();
          __DEV__ && console.warn('[PushNotif] ❌ PATCH fehlgeschlagen:', res.status, text.substring(0, 150));
        }
      } catch (err) {
        __DEV__ && console.log('[PushNotif] Fehler (Expo Go oder Stub):', (err as Error)?.message ?? err);
      } finally {
        tokenSyncInFlight.current = false;
      }
    };

    register();

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') register();
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, [session, profile?.id]); // Re-fires wenn Session/Profile verfügbar wird

  // Notification Listeners
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener(async (n) => {
        __DEV__ && console.log('[PushNotif] Eingehend:', n.request.content.title);
        // Badge-Count erhöhen wenn Notification eintrifft
        try {
          const current = await Notifications.getBadgeCountAsync();
          await Notifications.setBadgeCountAsync(current + 1);
        } catch { /* Expo Go stub */ }
      });

      // D: Deep-Link beim Tippen auf Notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener((r) => {
        const data = r.notification.request.content.data as Record<string, any>;
        __DEV__ && console.log('[PushNotif] Getippt:', data);

        // Lazy import um circular dep zu vermeiden
// eslint-disable-next-line @typescript-eslint/no-require-imports
        const { router } = require('expo-router');

        if (data?.type === 'message' && data?.conversationId) {
          router.push({
            pathname: '/messages/[id]',
            params: {
              id: data.conversationId,
              username: data.senderUsername ?? '',
              avatarUrl: data.senderAvatar ?? '',
            },
          });
        } else if ((data?.type === 'like' || data?.type === 'comment') && data?.postId) {
          router.push({ pathname: '/post/[id]', params: { id: data.postId } });
        } else if (data?.type === 'follow' && data?.senderId) {
          router.push({ pathname: '/user/[id]', params: { id: data.senderId } });
        } else if (data?.type === 'gift' && data?.senderId) {
          // Gift → Sender-Profil öffnen damit Creator sehen kann wer gifted hat
          router.push({ pathname: '/user/[id]', params: { id: data.senderId } });
        } else if (
          (data?.type === 'live' || data?.type === 'live_invite') &&
          data?.session_id
        ) {
          router.push({ pathname: '/live/watch/[id]', params: { id: data.session_id } });
        } else if (data?.type === 'scheduled_live_reminder' && data?.senderId) {
          // Scheduled-Live-Reminder: Host ist noch nicht live (session_id=null).
          // Öffne Host-Profil — User sieht dort „geht gleich live" Banner.
          router.push({ pathname: '/user/[id]', params: { id: data.senderId } });
        } else if ((data?.type === 'preorder_round_open' || data?.type === 'product_saved') && data?.productId) {
          // Sammelbestellung offen / Produkt gemerkt → direkt aufs Produkt
          router.push({ pathname: '/shop/[id]', params: { id: String(data.productId) } });
        } else if (
          data?.type === 'order_payment_requested' ||
          data?.type === 'order_payment_reminder' ||
          data?.type === 'order_shipped' ||
          data?.type === 'order_review' ||
          data?.type === 'order_dispute'
        ) {
          // Käufer-seitig / Rolle nicht eindeutig → eigene Bestellungen
          router.push('/shop/my-orders');
        } else if (
          data?.type === 'order_paid' ||
          data?.type === 'order_cancelled' ||
          data?.type === 'order_address_updated' ||
          data?.type === 'preorder_interest'
        ) {
          // Verkäufer-seitig → Fulfillment
          router.push('/shop/fulfillment');
        } else if (data?.type === 'support_reply') {
          router.push('/support');
        }
      });
    } catch {
      /* Expo Go stub */
    }
    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);
}
