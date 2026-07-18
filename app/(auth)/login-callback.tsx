/**
 * login-callback.tsx — Landing für den OAuth-Redirect `vibes://login-callback`.
 *
 * iOS: `openAuthSessionAsync` fängt den Redirect ab, diese Route wird nie erreicht.
 * Android: Der Redirect öffnet die App als Deep-Link → Expo Router landet HIER.
 * Ohne diese Route zeigte Android nach dem Google-Login „Unmatched Route" (Gerätetest 18.7.).
 *
 * Liegt bewusst in (auth): Der AuthGuard (src/_layout.full.tsx) lässt (auth)-Routen
 * ohne Session in Ruhe. Nach erfolgreichem setSession navigiert der Guard selbst
 * weiter zu (tabs) bzw. Onboarding — diese Route zeigt nur den Übergangs-Spinner.
 */
import { supabase } from '@/lib/supabase';
import { parseFragment } from '@/lib/useGoogleSignIn';
import { LinearGradient } from 'expo-linear-gradient';
import { useURL } from 'expo-linking';
import { router } from 'expo-router';
import { Zap } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function LoginCallbackScreen() {
  const url = useURL();
  const processed = useRef(false);

  // Schließt auf Android den noch offenen Auth-Custom-Tab des wartenden
  // openAuthSessionAsync-Aufrufs (löst ihn ggf. mit 'success' auf).
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
      WebBrowser.maybeCompleteAuthSession();
    } catch {
      /* Expo Go stub — ignorieren */
    }
  }, []);

  useEffect(() => {
    if (!url || processed.current) return;
    if (!url.includes('login-callback')) return;
    processed.current = true;

    const { access_token, refresh_token } = parseFragment(url);
    if (access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        if (error) router.replace('/(auth)/login' as never);
        // Erfolg: AuthGuard übernimmt via onAuthStateChange.
      });
    } else {
      // Kein Token im Link — evtl. hat der parallele Hook-Pfad die Session
      // schon gesetzt (dann regelt der Guard), sonst zurück zum Login.
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) router.replace('/(auth)/login' as never);
      });
    }
  }, [url]);

  // Sicherheitsnetz: Falls nie eine verwertbare URL ankommt, nicht ewig hängen.
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.replace('/(auth)/login' as never);
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#000000', '#0d0016', '#000000']} style={StyleSheet.absoluteFill} />
      <Zap size={36} stroke="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
      <ActivityIndicator color="#FFFFFF" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginTop: 24,
  },
});
