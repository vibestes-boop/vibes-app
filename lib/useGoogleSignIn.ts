/**
 * useGoogleSignIn.ts
 *
 * Google-Login für Mobile via Supabase OAuth + In-App-Browser (expo-web-browser).
 *
 * ⚠️ NATIV: braucht `expo-web-browser` (Config-Plugin) → nur in einem NEUEN
 * EAS-Build vorhanden, NICHT per OTA. Deshalb ist der Login-Button hinter
 * `ENABLE_GOOGLE_LOGIN` gated. Flag erst im selben Commit wie der Rebuild auf
 * `true` setzen — so kann der Code gefahrlos vorher per OTA mitlaufen
 * (Button bleibt versteckt, kein Crash auf dem alten Build 285).
 *
 * Einmalige Dashboard-Config (sonst gibt es nur Fehler):
 *   1. Google Cloud → OAuth-Client (Typ „Web") anlegen.
 *   2. Supabase → Authentication → Providers → Google: Client-ID + Secret
 *      eintragen + aktivieren.
 *   3. Supabase → Authentication → URL Configuration → Redirect URLs:
 *      `vibes://login-callback` hinzufügen.
 *
 * Flow (Implicit): signInWithOAuth liefert die Google-Auth-URL → In-App-Browser
 * öffnet sie → nach Login Redirect auf `vibes://login-callback#access_token=…`
 * → Tokens aus dem Fragment lesen → setSession → onAuthStateChange loggt ein.
 */
import { Alert } from 'react-native';
import { supabase } from './supabase';

/** Ab Build 286 (1.30.0) mit expo-web-browser nativ → aktiv. */
export const ENABLE_GOOGLE_LOGIN: boolean = true;

const REDIRECT_URL = 'vibes://login-callback';

export type GoogleSignInResult = 'success' | 'canceled' | 'error';

// expo-web-browser ist ein NATIVES Modul (Config-Plugin) → erst ab dem nächsten
// Build vorhanden. Bewusst LAZY via require INNERHALB von googleSignIn(): auf dem
// alten Build 285 wird das Modul nie berührt (Button ist gated), also kein Crash,
// selbst wenn dieser Code versehentlich per OTA mitläuft.

/** Liest key=value-Paare aus dem URL-Fragment (`#a=1&b=2`). RN-sicher (kein URLSearchParams).
 *  Exportiert für app/(auth)/login-callback.tsx (Android-Deep-Link-Landing). */
export function parseFragment(url: string): Record<string, string> {
  const hash = url.includes('#') ? url.substring(url.indexOf('#') + 1) : '';
  const out: Record<string, string> = {};
  for (const pair of hash.split('&')) {
    if (!pair) continue;
    const idx = pair.indexOf('=');
    const key = idx >= 0 ? pair.slice(0, idx) : pair;
    const val = idx >= 0 ? pair.slice(idx + 1) : '';
    out[decodeURIComponent(key)] = decodeURIComponent(val);
  }
  return out;
}

export async function googleSignIn(): Promise<GoogleSignInResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
    WebBrowser.maybeCompleteAuthSession();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: REDIRECT_URL,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Keine Auth-URL von Supabase erhalten.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);

    if (result.type === 'cancel' || result.type === 'dismiss') return 'canceled';
    if (result.type !== 'success' || !result.url) {
      throw new Error('Google-Login wurde nicht abgeschlossen.');
    }

    const params = parseFragment(result.url);
    const access_token = params.access_token;
    const refresh_token = params.refresh_token;
    if (!access_token || !refresh_token) {
      throw new Error('Login fehlgeschlagen — keine Tokens erhalten.');
    }

    const { error: sessErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessErr) throw sessErr;

    // onAuthStateChange (Root-Layout) übernimmt die Navigation in die App.
    return 'success';
  } catch (err: any) {
    const msg = err?.message ?? 'Unbekannter Fehler.';
    if (msg.includes('cancel')) return 'canceled';
    Alert.alert('Google-Login fehlgeschlagen', msg);
    return 'error';
  }
}
