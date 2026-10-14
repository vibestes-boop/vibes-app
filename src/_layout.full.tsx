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
/* eslint-disable @typescript-eslint/no-require-imports */
import { useEffect, useRef, useState } from 'react';
import { passwordRecovery } from '@/lib/passwordRecovery';
import { View, Text, ActivityIndicator, Pressable, StyleSheet, useColorScheme } from 'react-native';
import {
  useFonts,
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

  const { session, initialized, profile, profileStatus, setSession, fetchProfile } =
    useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // Warten bis Zustand-Persist-Middleware AsyncStorage gelesen hat
  // Ohne das würde der Guard profile=null sehen und fälschlicherweise zum Onboarding navigieren
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Zustand 5: persist.hasHydrated() oder über onFinishHydration
    const unsub = (useAuthStore as any).persist?.onFinishHydration?.(() => setHydrated(true));
    // Falls Hydration bereits abgeschlossen ist
    if ((useAuthStore as any).persist?.hasHydrated?.()) setHydrated(true);
    return () => unsub?.();
  }, [useAuthStore]);

  useEffect(() => {
    if (!hydrated || initialized) return;
    const cached = useAuthStore.getState();
    if (cached.session?.user && cached.profile?.id === cached.session.user.id) {
      useAuthStore.setState({ initialized: true });
    }
  }, [hydrated, initialized, useAuthStore]);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    let receivedAuthEvent = false;
    const safetyTimer = setTimeout(() => {
      if (active) useAuthStore.setState({ initialized: true });
    }, 2500);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      receivedAuthEvent = true;
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecovery.active = true;
        router.replace('/reset-password' as never);
      }
      setSession(nextSession);
      useAuthStore.setState({ initialized: true });
      // Keep this callback synchronous. Profile loading runs in its own effect.
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (active && !receivedAuthEvent) setSession(data.session);
    }).catch(() => {
      // Keep the hydrated session when the network is unavailable.
    }).finally(() => {
      clearTimeout(safetyTimer);
      if (active) useAuthStore.setState({ initialized: true });
    });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [hydrated, router, setSession, supabase, useAuthStore]);

  const userId = session?.user.id;
  const accessToken = session?.access_token;
  useEffect(() => {
    if (hydrated && initialized && userId && accessToken) void fetchProfile(userId);
  }, [hydrated, initialized, userId, accessToken, fetchProfile]);

  useEffect(() => {
    if (!hydrated || !initialized) return;
    const { authDestination } = require('@/lib/authDestination') as typeof import('@/lib/authDestination');
    const destination = authDestination({
      authenticated: !!session,
      profile: profile?.id === session?.user.id ? profile : null,
      profileStatus,
      group: segments[0],
      recovering: passwordRecovery.active,
    });
    if (destination) router.replace(destination as never);
  }, [session, initialized, profile, profileStatus, segments, hydrated, router]);

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
    }).catch(() => { });

    // Foreground/Background: URL direkt verarbeiten (Auth ist dann schon aktiv)
    const sub = Linking.addEventListener('url', ({ url }: { url: string }) => {
      if (!url?.startsWith('vibes://')) return;
      navigateDeepLink(url);
    });

    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schritt 2: Pending-URL verarbeiten sobald User authentifiziert ist.
  // AUSNAHME Passwort-Reset: der Recovery-Link kommt per Definition OHNE Sitzung
  // an (der Nutzer kann sich ja gerade nicht anmelden). Früher wartete dieser
  // Effekt auf session+profile → beim Kaltstart aus der E-Mail passierte nie etwas.
  useEffect(() => {
    if (!initialized) return;
    const isRecovery = pendingDeepLink.current?.startsWith('vibes://reset-password');
    if (!isRecovery && (!session || !profile)) return;
    if (!pendingDeepLink.current) return;

    const url = pendingDeepLink.current;
    pendingDeepLink.current = null; // einmalig verarbeiten

    // Kleiner Delay damit Router nach Auth-Redirect bereit ist
    const t = setTimeout(() => navigateDeepLink(url), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, session, profile]);

  function navigateDeepLink(url: string) {
    // vibes://reset-password — Passwort-Reset per E-Mail-Link.
    // Supabase hängt die Tokens ans URL-Fragment (Implicit Flow, der Client hat
    // detectSessionInUrl:false — in React Native parst das niemand automatisch).
    // Ohne setSession() gäbe es keine Sitzung: updateUser() schlüge mit
    // „Auth session missing" fehl und der Guard würde zurück zum Login werfen.
    if (url.match(/^vibes:\/\/reset-password/)) {
      const { parseFragment } =
        require('@/lib/useGoogleSignIn') as typeof import('@/lib/useGoogleSignIn');
      const p = parseFragment(url);
      if (p.access_token && p.refresh_token) {
        passwordRecovery.active = true;
        router.replace('/reset-password' as never);
        void supabase.auth
          .setSession({ access_token: p.access_token, refresh_token: p.refresh_token })
          .then(({ error }: { error: unknown }) => {
            if (error) {
              passwordRecovery.active = false;
              router.replace('/(auth)/login' as never);
            }
          })
          .catch(() => {
            passwordRecovery.active = false;
            router.replace('/(auth)/login' as never);
          });
      } else {
        // Abgelaufener oder bereits benutzter Link (Fragment enthält dann error=…)
        const { Alert } = require('react-native') as typeof import('react-native');
        const { tStatic } = require('@/lib/i18n') as typeof import('@/lib/i18n');
        Alert.alert(tStatic('auth.rpLinkExpiredTitle'), tStatic('auth.rpLinkExpiredBody'));
        router.replace('/(auth)/login' as never);
      }
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
  const { useLocaleProfileSync } =
    require('@/lib/i18n/useLocaleProfileSync') as typeof import('@/lib/i18n/useLocaleProfileSync');
  const initialized = useAuthStore((s: { initialized: boolean }) => s.initialized);
  const session = useAuthStore((s: { session: unknown }) => s.session);
  const profile = useAuthStore((s: { profile: unknown }) => s.profile);

  usePushNotifications();
  // App-Sprache → profiles.locale (für lokalisierte Push-Texte serverseitig).
  useLocaleProfileSync();

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
        const { routeFromNotificationData } =
          require('@/lib/usePushNotifications') as typeof import('@/lib/usePushNotifications');

        // Kleiner Delay damit der Router nach Auth-Redirect bereit ist.
        // Volle Typ-Kette aus usePushNotifications — vorher kannte der
        // Cold-Start nur 5 Typen (Gift/Order/Shop/Support-Taps liefen ins Leere;
        // auf Android der Normalfall, weil das OS Apps aggressiv killt).
        setTimeout(() => {
          routeFromNotificationData(data);
        }, 400);
      }).catch(() => { });
    } catch { /* Expo Go stub */ }
  }, [initialized, session, profile]);

  return null;
}

// ─── PromptProvider (cross-platform Alert.prompt) ────────────────────────────
const { PromptProvider } =
  require('@/lib/promptCrossPlatform') as typeof import('@/lib/promptCrossPlatform');

// ─── ThemeProvider ───────────────────────────────────────────────────────────
// Liest iOS-System-Präferenz und synct sie in den themeStore.
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { Appearance } = require('react-native') as typeof import('react-native');
  const scheme = useColorScheme() ?? Appearance.getColorScheme() ?? 'dark';
  const { useThemeStore } = require('@/lib/themeStore') as any;
  const setSystemScheme = useThemeStore((s: any) => s.setSystemScheme);
  const colors = useThemeStore((s: any) => s.colors);

  useEffect(() => {
    setSystemScheme(scheme as 'dark' | 'light');
  }, [scheme, setSystemScheme]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {children}
    </View>
  );
}

// ─── AppSplash ────────────────────────────────────────────────────────────────
function AppSplash() {
  const { useAuthStore } = require('@/lib/authStore') as typeof import('@/lib/authStore');
  const { useThemeStore } = require('@/lib/themeStore') as typeof import('@/lib/themeStore');
  const { useI18n } = require('@/lib/i18n') as typeof import('@/lib/i18n');
  const { initialized, session, profile, profileStatus, fetchProfile } = useAuthStore();
  const colors = useThemeStore((s) => s.colors);
  const { t } = useI18n();
  const needsProfile = !!session && profile?.id !== session.user.id && profileStatus !== 'missing';
  if (initialized && (!needsProfile || passwordRecovery.active)) return null;
  const failed = needsProfile && profileStatus === 'error';
  return (
    <View style={[splashStyles.overlay, { backgroundColor: colors.bg.primary }]}>
      {!failed && <ActivityIndicator color={colors.accent.primary} size="large" />}
      <Text style={[splashStyles.label, { color: colors.text.primary }]} accessibilityRole={failed ? 'alert' : undefined}>
        {t(failed ? 'auth.profileLoadFailed' : 'auth.loadingAccount')}
      </Text>
      {failed && (
        <Pressable accessibilityRole="button" onPress={() => session && void fetchProfile(session.user.id)}
          style={[splashStyles.retry, { backgroundColor: colors.text.primary }]}>
          <Text style={{ color: colors.bg.primary, fontWeight: '700' }}>{t('auth.retryProfile')}</Text>
        </Pressable>
      )}
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
  const build = C?.expoConfig?.ios?.buildNumber ?? C?.expoConfig?.android?.versionCode ?? '?';
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
    paddingHorizontal: 28,
  },
  retry: { minHeight: 48, paddingHorizontal: 24, borderRadius: 16, justifyContent: 'center' },
  label: {
    color: '#CFFAFE',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
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
  useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // Lazy-load everything inside the function – NEVER at module level
  const { Stack } = require('expo-router') as typeof import('expo-router');
  const { ErrorBoundary } =
    require('@/components/ui/ErrorBoundary') as typeof import('@/components/ui/ErrorBoundary');
  const { QueryClient } =
    require('@tanstack/react-query') as typeof import('@tanstack/react-query');
  const { PersistQueryClientProvider } =
    require('@tanstack/react-query-persist-client') as typeof import('@tanstack/react-query-persist-client');
  const { createAsyncStoragePersister } =
    require('@tanstack/query-async-storage-persister') as typeof import('@tanstack/query-async-storage-persister');
  const AsyncStorage =
    (require('@react-native-async-storage/async-storage') as any)?.default;
  const { GestureHandlerRootView } =
    require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');

  // QueryClient once via ref
  const qcRef = useRef<InstanceType<typeof QueryClient> | null>(null);
  if (!qcRef.current) {
    qcRef.current = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60 * 1000, retry: 1, gcTime: 5 * 60 * 1000 },
      },
    });
  }

  // Persister: Feed-Daten überleben Kaltstarts — gleicher lazy-require Pattern wie alles andere
  const persisterRef = useRef<any>(null);
  if (!persisterRef.current && AsyncStorage) {
    persisterRef.current = createAsyncStoragePersister({
      storage: AsyncStorage,
      key: 'vibes-rq-cache-v1',
      throttleTime: 3000,  // max. 1 Schreibvorgang alle 3s — kein AsyncStorage-Spam
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
    // Splash so früh wie möglich verstecken — kein künstliches Delay.
    // PersistQueryClientProvider liefert gecachte Daten sofort → kein weißer Blitz.
    const hide = () =>
      (require('expo-splash-screen') as any).hideAsync?.().catch(() => { });
    hide(); // sofort versuchen
    const t = setTimeout(hide, 3000); // Garantie-Fallback
    return () => clearTimeout(t);
  }, []);

  const persistedQueryKeys = new Set([
    'vibe-feed',
    'trending-feed',
    'following-feed',
    'guild-feed',
    'guild-info',
    'guild-member-count',
    'guild-stories',
    'story-highlights',
    'shop-products',
    'saved-products',
    'user-posts',
    'bookmarked-posts',
  ]);

  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={qcRef.current}
        persistOptions={{
          persister: persisterRef.current,
          maxAge: 24 * 60 * 60 * 1000,  // 24 Stunden
          // Nur öffentliche Read-Queries persistieren — kein Schreiben von Auth-sensiblen Daten.
          // Profile/Profil-Posts bleiben so bei schwachem Netz sichtbar und laden im Hintergrund frisch nach.
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              const key = query.queryKey[0];
              return typeof key === 'string' && persistedQueryKeys.has(key);
            },
          },
        }}
      >
        <ThemeProvider>
          <PromptProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
          <AuthGuard />
          <PushNotificationsProvider />
          <AppSplash />
          {/* Nur in Entwicklungs-Builds: die Versions-/Build-Pille ist ein
              Debug-Hilfsmittel und hatte im Store-Build nichts verloren —
              sie war 4 Sekunden lang das Erste, was jeder Nutzer sah. */}
          {__DEV__ && <BuildBanner />}
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen
              name="create/index"
              // 'card' statt 'modal': der iOS-Modal hat eine native Swipe-down-zum-Schließen-
              // Geste, die gestureEnabled:false NICHT zuverlässig abschaltet und die mit dem
              // Ziehen von Text-/Sticker-Overlays (PanResponder) kollidierte (Editor wanderte
              // mit runter). 'card' hat KEINE Dismiss-Geste, ist die App-Standard-Präsentation
              // (Buttons funktionieren — anders als das vorher getestete 'fullScreenModal').
              // slide_from_bottom behält die hochschiebende Optik; gestureEnabled:false killt
              // auch das Edge-Back-Swipe. Schließen weiter über das X oben links.
              options={{ presentation: 'card', animation: 'slide_from_bottom', gestureEnabled: false }}
            />
            {/* slide_from_bottom: Swipe-zu-nächstem-Post (router.replace) kommt
                vertikal von unten rein — wie im Feed, statt horizontal „von der
                Seite" (war slide_from_right). */}
            <Stack.Screen name="post/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen
              name="guild-post/[id]"
              options={{
                headerShown: false,
                animation: 'slide_from_bottom',
                presentation: 'fullScreenModal',
              }}
            />
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
          </PromptProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}
