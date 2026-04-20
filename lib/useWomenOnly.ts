/**
 * useWomenOnly.ts
 * 
 * Zentraler Hook für die Women-Only Zone.
 * Gibt an ob die aktuelle Nutzerin Zugang hat und welches Level sie hat.
 */

import { useAuthStore } from './authStore';
import { supabase } from './supabase';

export function useWomenOnly() {
  const { profile, setProfile } = useAuthStore();

  /** Hat die Nutzerin Zugang zur Women-Only Zone? */
  const canAccessWomenOnly =
    profile?.gender === 'female' &&
    profile?.women_only_verified === true;

  /** Aktuelles Verifikations-Level (0, 1 oder 2) */
  const verificationLevel = profile?.verification_level ?? 0;

  /**
   * Level-1-Verifikation aktivieren (Selbstdeklaration).
   * Schreibt gender='female', women_only_verified=true, verification_level=1
   * in die DB und aktualisiert den lokalen Auth-Store.
   */
  async function activateLevel1(): Promise<{ error: string | null }> {
    if (!profile?.id) return { error: 'Kein Profil gefunden' };

    const { data, error } = await supabase
      .from('profiles')
      .update({
        gender: 'female',
        women_only_verified: true,
        verification_level: 1,
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (error) return { error: error.message };

    // Lokalen Store sofort aktualisieren (kein Re-Fetch nötig)
    setProfile({ ...profile, ...data });
    return { error: null };
  }

  /**
   * Women-Only Zone deaktivieren.
   * Setzt women_only_verified=false zurück (gender bleibt gesetzt).
   */
  async function deactivate(): Promise<{ error: string | null }> {
    if (!profile?.id) return { error: 'Kein Profil gefunden' };

    const { data, error } = await supabase
      .from('profiles')
      .update({
        women_only_verified: false,
        verification_level: 0,
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (error) return { error: error.message };

    setProfile({ ...profile, ...data });
    return { error: null };
  }

  return {
    canAccessWomenOnly,
    verificationLevel,
    activateLevel1,
    deactivate,
  };
}
