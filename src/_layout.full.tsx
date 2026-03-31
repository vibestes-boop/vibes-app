/**
 * Full app root layout – loaded lazily from app/_layout.tsx via require().
 *
 * CRITICAL: This module's factory MUST NOT throw. Any throw in the factory causes
 * Hermes production to silently return `undefined` for this module.
 *
 * Strategy:
 *  - ONLY named imports from 'react' and 'react-native' at the top level.
 *  - EVERYTHING else: lazy require() with string literals inside component bodies.
 *    This avoids ANY module-init-time failure (tanstack-query, zustand, supabase, etc.)
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

// ─── AuthGuard ────────────────────────────────────────────────────────────────
function AuthGuard() {
  const { useRouter, useSegments } =
    require('expo-router') as typeof import('expo-router');
  const { supabase } =
    require('@/lib/supabase') as typeof import('@/lib/supabase');
  const { useAuthStore } =
    require('@/lib/authStore') as typeof import('@/lib/authStore');

  const { session, initialized, profile, setSession, fetchProfile } =
    useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      useAuthStore.setState({ initialized: true });
    }, 2500);

    supabase.auth
      .getSession()
      .then(
        async ({
          data: { session },
        }: {
          data: { session: import('@supabase/supabase-js').Session | null };
        }) => {
          setSession(session);
          if (session?.user) await fetchProfile(session.user.id);
          useAuthStore.setState({ initialized: true });
        },
      )
      .catch(() => {
        useAuthStore.setState({ initialized: true });
      })
      .finally(() => clearTimeout(safetyTimer));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: string, session: import('@supabase/supabase-js').Session | null) => {
        setSession(session);
        if (session?.user) await fetchProfile(session.user.id);
        if (event === 'PASSWORD_RECOVERY')
          router.replace('/reset-password' as never);
      },
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';

    __DEV__ && console.log(
      '[AuthGuard] initialized:', initialized,
      'session:', !!session,
      'profile:', !!profile,
      'segments:', segments,
    );

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login' as never);
      return;
    }
    if (!profile) {
      if (!inOnboardingGroup) router.replace('/(onboarding)' as never);
      return;
    }
    if (inAuthGroup) {
      router.replace(
        !profile.onboarding_complete
          ? ('/(onboarding)' as never)
          : ('/(tabs)' as never),
      );
      return;
    }
    if (!inAuthGroup && !inOnboardingGroup && !profile.onboarding_complete) {
      router.replace('/(onboarding)' as never);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, initialized, profile, segments]);

  // ── Deep-Link Handler (vibes://live/<id> und vibes://post/<id>) ──────────
  // Race-Condition-Fix: URL beim Cold-Start sofort speichern,
  // aber erst nach Auth-Initialisierung navigieren.
  const pendingDeepLink = useRef<string | null>(null);

  // Schritt 1: URL so früh wie möglich einfangen (bevor Auth fertig ist)
  useEffect(() => {
    const { Linking } = require('react-native') as typeof import('react-native');

    // Cold-Start: initial URL sichern
    Linking.getInitialURL().then((url: string | null) => {
      if (url?.startsWith('vibes://')) pendingDeepLink.current = url;
    }).catch(() => {});

    // Foreground/Background: URL direkt verarbeiten (Auth ist dann schon aktiv)
    const sub = Linking.addEventListener('url', ({ url }: { url: string }) => {
      if (!url?.startsWith('vibes://')) return;
      navigateDeepLink(url);
    });

    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schritt 2: Pending-URL verarbeiten sobald User authentifiziert ist
  useEffect(() => {
    if (!initialized || !session || !profile) return;
    if (!pendingDeepLink.current) return;

    const url = pendingDeepLink.current;
    pendingDeepLink.current = null; // einmalig verarbeiten

    // Kleiner Delay damit Router nach Auth-Redirect bereit ist
    const t = setTimeout(() => navigateDeepLink(url), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, session, profile]);

  function navigateDeepLink(url: string) {
    // vibes://reset-password — Passwort-Reset per E-Mail-Link
    if (url.match(/^vibes:\/\/reset-password/)) {
      router.push('/reset-password' as never);
      return;
    }
    const liveMatch = url.match(/^vibes:\/\/live\/([^/?#]+)/);
    if (liveMatch?.[1]) {
      router.push({ pathname: '/live/watch/[id]', params: { id: liveMatch[1] } });
      return;
    }
    const postMatch = url.match(/^vibes:\/\/post\/([^/?#]+)/);
    if (postMatch?.[1]) {
      router.push({ pathname: '/post/[id]', params: { id: postMatch[1] } });
      return;
    }
    const userMatch = url.match(/^vibes:\/\/user\/([^/?#]+)/);
    if (userMatch?.[1]) {
      router.push({ pathname: '/user/[id]', params: { id: userMatch[1] } });
    }
  }

  return null;
}

// ─── PushNotificationsProvider ────────────────────────────────────────────────
function PushNotificationsProvider() {
  const { usePushNotifications } =
    require('@/lib/usePushNotifications') as typeof import('@/lib/usePushNotifications');
  const { useAuthStore } =
    require('@/lib/authStore') as typeof import('@/lib/authStore');
  const initialized = useAuthStore((s: { initialized: boolean }) => s.initialized);
  const session = useAuthStore((s: { session: unknown }) => s.session);
  const profile = useAuthStore((s: { profile: unknown }) => s.profile);

  usePushNotifications();

  // Cold-Start: App war geschlossen, User tippt auf eine Push-Notification.
  // Expo stellt die Response via getLastNotificationResponseAsync() bereit.
  // Wir verarbeiten sie EINMAL, sobald Auth bereit ist.
  const coldStartHandled = useRef(false);
  useEffect(() => {
    if (!initialized || !session || !profile) return;
    if (coldStartHandled.current) return;
    coldStartHandled.current = true;

    try {
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      if (typeof Notifications.getLastNotificationResponseAsync !== 'function') return;

      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as Record<string, any>;
        const { router } = require('expo-router') as typeof import('expo-router');

        // Kleiner Delay damit der Router nach Auth-Redirect bereit ist
        setTimeout(() => {
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
          } else if (
            (data?.type === 'live' || data?.type === 'live_invite') &&
            data?.session_id
          ) {
            router.push({ pathname: '/live/watch/[id]', params: { id: data.session_id } });
          }
        }, 400);
      }).catch(() => {});
    } catch { /* Expo Go stub */ }
  }, [initialized, session, profile]);

  return null;
}

// ─── AppSplash ────────────────────────────────────────────────────────────────
function AppSplash() {
  const { useAuthStore } =
    require('@/lib/authStore') as typeof import('@/lib/authStore');
  const initialized = useAuthStore((s) => s.initialized);
  if (initialized) return null;
  return (
    <View style={splashStyles.overlay}>
      <ActivityIndicator color="#FFFFFF" size="large" />
      <Text style={splashStyles.label}>Vibes — wird geladen…</Text>
    </View>
  );
}

// ─── BuildBanner ─────────────────────────────────────────────────────────────
function BuildBanner() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;

  const cMod = require('expo-constants') as any;
  const C = cMod?.default ?? cMod;
  const build = C?.expoConfig?.ios?.buildNumber ?? '?';
  const version = C?.expoConfig?.version ?? '?';
  return (
    <View style={splashStyles.banner} pointerEvents="none">
      <Text style={splashStyles.bannerText}>
        v{version} ({build})
      </Text>
    </View>
  );
}

// ─── OfflineBanner wrapper ────────────────────────────────────────────────────
function OfflineBanner() {
  const mod = require('@/components/ui/OfflineBanner') as any;
  const OB = mod?.OfflineBanner;
  if (typeof OB !== 'function') return null;
  return <OB />;
}

const splashStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0E7490',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    gap: 16,
  },
  label: {
    color: '#CFFAFE',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  banner: {
    position: 'absolute',
    top: 52,
    right: 16,
    backgroundColor: 'rgba(14, 116, 144, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    zIndex: 1000,
  },
  bannerText: {
    color: '#CFFAFE',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});

// ─── Root ─────────────────────────────────────────────────────────────────────
/**
 * Volle App-Root-Layout.
 * QueryClient is created inside the component via useRef so it's never on
 * module level (module-level @tanstack/react-query calls can throw in Hermes).
 */
export default function RootLayoutFull() {
  // Load Inter font — must be called before any render
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Lazy-load everything inside the function – NEVER at module level
  const { Stack } = require('expo-router') as typeof import('expo-router');
  const { ErrorBoundary } =
    require('@/components/ui/ErrorBoundary') as typeof import('@/components/ui/ErrorBoundary');
  const { QueryClient, QueryClientProvider } =
    require('@tanstack/react-query') as typeof import('@tanstack/react-query');
  const { GestureHandlerRootView } =
    require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');

  // QueryClient created once via ref, not state, to avoid re-creating on re-renders
  const qcRef = useRef<InstanceType<typeof QueryClient> | null>(null);
  if (!qcRef.current) {
    qcRef.current = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60 * 1000, retry: 1, gcTime: 5 * 60 * 1000 },
      },
    });
  }

  // Enable screens lazily (not at module init time)
  useEffect(() => {
    try {
      const { enableScreens } =
        require('react-native-screens') as typeof import('react-native-screens');
      enableScreens(false);
    } catch { /* stub may not export enableScreens */ }
  }, []);

  useEffect(() => {
    // Guaranteed SplashScreen.hideAsync() with delay.
    const hide = () =>
      (require('expo-splash-screen') as any).hideAsync?.().catch(() => {});
    const t1 = setTimeout(hide, 500);
    const t2 = setTimeout(hide, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={qcRef.current}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthGuard />
          <PushNotificationsProvider />
          <AppSplash />
          <BuildBanner />
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen
              name="create/index"
              options={{ presentation: 'modal', animation: 'none' }}
            />
            <Stack.Screen name="post/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen
              name="settings"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="user/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen
              name="story-viewer"
              options={{
                headerShown: false,
                animation: 'none',
                presentation: 'fullScreenModal',
              }}
            />
            <Stack.Screen
              name="edit-post/[id]"
              options={{
                headerShown: false,
                presentation: 'modal',
                animation: 'none',
              }}
            />
            <Stack.Screen
              name="messages/index"
              options={{ headerShown: false, animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="messages/[id]"
              options={{ headerShown: false, animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="reset-password"
              options={{ headerShown: false, animation: 'none' }}
            />
            <Stack.Screen
              name="user-posts"
              options={{
                headerShown: false,
                animation: 'none',
                presentation: 'fullScreenModal',
              }}
            />
            <Stack.Screen
              name="follow-list"
              options={{ headerShown: false, animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="blocked-users"
              options={{ headerShown: false, animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="live/start"
              options={{ headerShown: false, animation: 'none', presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="live/host"
              options={{ headerShown: false, animation: 'none', presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="live/watch/[id]"
              options={{ headerShown: false, animation: 'none', presentation: 'fullScreenModal' }}
            />
          </Stack>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
