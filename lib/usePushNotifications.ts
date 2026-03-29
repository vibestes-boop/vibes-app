import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from './authStore';

// Expo Project ID aus app.json (für getExpoPushTokenAsync in Expo SDK 54 erforderlich)
const EXPO_PROJECT_ID = '02ab536a-5836-4560-a5ec-2dfd6e059f90';

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

export function usePushNotifications() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener    = useRef<Notifications.EventSubscription | null>(null);
  const tokenRegistered     = useRef(false);

  // ── Reaktiv auf Session warten ────────────────────────────────────────────
  // useAuthStore.getState().session ist beim ersten Mount noch null (SecureStore
  // lädt async). Durch Subscribeuse – wir auf die Session warten.
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Noch nicht eingeloggt → warten
    if (!session || !profile?.id) return;
    // Bereits registriert in dieser Session → nicht nochmal
    if (tokenRegistered.current) return;

    const register = async () => {
      try {
        if (typeof Notifications.getPermissionsAsync !== 'function') return;

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('[PushNotif] Berechtigung nicht erteilt');
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: EXPO_PROJECT_ID,
        });

        const token = tokenData?.data;
        if (!token) {
          console.warn('[PushNotif] Kein Token erhalten');
          return;
        }

        console.log('[PushNotif] Token:', token);
        tokenRegistered.current = true;

        // Direkt per REST in profiles speichern — kein Supabase-Client-Hang
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

        const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${session.access_token}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ push_token: token }),
        });

        if (res.ok) {
          console.log('[PushNotif] ✅ Token in DB gespeichert:', token);
        } else {
          const text = await res.text();
          console.warn('[PushNotif] ❌ PATCH fehlgeschlagen:', res.status, text.substring(0, 150));
        }
      } catch (err) {
        console.log('[PushNotif] Fehler (Expo Go oder Stub):', (err as Error)?.message ?? err);
      }
    };

    register();
  }, [session, profile?.id]); // Re-fires wenn Session/Profile verfügbar wird

  // Notification Listeners
  useEffect(() => {
    if (Platform.OS === 'web') return;
    try {
      notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
        console.log('[PushNotif] Eingehend:', n.request.content.title);
      });

      // D: Deep-Link beim Tippen auf Notification
      responseListener.current = Notifications.addNotificationResponseReceivedListener((r) => {
        const data = r.notification.request.content.data as Record<string, any>;
        console.log('[PushNotif] Getippt:', data);

        // Lazy import um circular dep zu vermeiden
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
        } else if (data?.type === 'live_invite' && data?.session_id) {
          router.push({ pathname: '/live/watch/[id]', params: { id: data.session_id } });
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
