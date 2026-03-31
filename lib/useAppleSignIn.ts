/**
 * useAppleSignIn.ts
 *
 * Zentralisierter Apple Sign-In Flow für Login & Registrierung.
 *
 * Wichtig: Apple liefert den vollständigen Namen NUR beim allerersten Login.
 * Danach ist credential.fullName null. Deshalb: Name beim ersten Login in DB speichern.
 */
import { Alert, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';

export type AppleSignInResult = 'success' | 'canceled' | 'error';

export async function appleSignIn(): Promise<AppleSignInResult> {
  if (Platform.OS !== 'ios') return 'error';

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { identityToken, fullName, user: appleUserId } = credential;
    if (!identityToken) throw new Error('Kein Identity-Token von Apple erhalten.');

    // ── Supabase Auth ──────────────────────────────────────────────────────────
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });

    if (error) throw error;

    // ── Profil-Update: Name aus Apple (nur beim ersten Login verfügbar) ────────
    const userId = data?.user?.id;
    if (userId && (fullName?.givenName || fullName?.familyName)) {
      const displayName = [fullName.givenName, fullName.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (displayName) {
        // Username aus Apple-Name generieren (lowercase, no spaces)
        const generatedUsername = displayName
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
          .substring(0, 30);

        // Nur setzen wenn Profil noch keinen Username hat
        const { data: existing } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .single();

        if (!existing?.username || existing.username.startsWith('apple_')) {
          await supabase
            .from('profiles')
            .upsert({
              id: userId,
              username: generatedUsername || `apple_${appleUserId?.substring(0, 8)}`,
            })
            .eq('id', userId);
        }
      }
    }

    return 'success';
  } catch (err: any) {
    if (
      err?.code === 'ERR_REQUEST_CANCELED' ||
      err?.message?.includes('canceled') ||
      err?.message?.includes('The operation couldn')
    ) {
      return 'canceled';
    }
    Alert.alert('Apple Sign-In fehlgeschlagen', err?.message ?? 'Unbekannter Fehler.');
    return 'error';
  }
}

/** Prüft ob Apple Authentication auf diesem Gerät verfügbar ist */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}
