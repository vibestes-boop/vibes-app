/**
 * useWomenOnly.ts
 *
 * Zentraler Hook für die Women-Only Zone.
 *
 * Zugangs-Modell (seit 16.7.2026, WOZ-Audit Gap 3): Selbstdeklaration →
 * Antrag → Admin-Freigabe. Der Client kann `women_only_verified` NICHT mehr
 * direkt setzen (DB-Trigger sperrt die Spalte) — alles läuft über SECURITY-
 * DEFINER-RPCs. `canAccessWomenOnly` bleibt der einzige Gate für die UI.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from './authStore';
import { supabase } from './supabase';

export type WozStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'revoked';

export function useWomenOnly() {
  const { profile, setProfile } = useAuthStore();

  /** Hat die Nutzerin Zugang zur Women-Only Zone? (Gate für alle UI-Flächen) */
  const canAccessWomenOnly =
    profile?.gender === 'female' && profile?.women_only_verified === true;

  const verificationLevel = profile?.verification_level ?? 0;

  // Antrags-Status (pending/rejected/…) für die Beitritts-UI. Wird lazy geladen.
  const [status, setStatus] = useState<WozStatus>(canAccessWomenOnly ? 'approved' : 'none');

  const refreshStatus = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase.rpc('get_my_women_only_status');
    const s = (data as { status?: WozStatus } | null)?.status;
    if (s) setStatus(s);
  }, [profile?.id]);

  useEffect(() => {
    if (canAccessWomenOnly) setStatus('approved');
    else void refreshStatus();
  }, [canAccessWomenOnly, refreshStatus]);

  /**
   * Zugang beantragen (Selbstdeklaration). Setzt gender='female' + Level 1 und
   * legt einen `pending`-Antrag an — GEWÄHRT ABER KEINEN ZUGANG. Erst die
   * Admin-Freigabe setzt `women_only_verified=true`.
   */
  const requestAccess = useCallback(async (): Promise<{ error: string | null; status?: WozStatus }> => {
    if (!profile?.id) return { error: 'Kein Profil gefunden' };
    const { data, error } = await supabase.rpc('request_women_only');
    if (error) return { error: error.message };
    const res = data as { success?: boolean; status?: WozStatus; error?: string };
    if (!res?.success) return { error: res?.error ?? 'network_error' };
    const s = res.status ?? 'pending';
    setStatus(s);
    // gender/level lokal spiegeln (women_only_verified bleibt bis zur Freigabe false)
    setProfile({ ...profile, gender: 'female', verification_level: 1 });
    return { error: null, status: s };
  }, [profile, setProfile]);

  /** Women-Only Zone freiwillig verlassen (kein Admin-Aberkennen). */
  const leave = useCallback(async (): Promise<{ error: string | null }> => {
    if (!profile?.id) return { error: 'Kein Profil gefunden' };
    const { data, error } = await supabase.rpc('leave_women_only');
    if (error) return { error: error.message };
    if (!(data as { success?: boolean } | null)?.success) return { error: 'network_error' };
    setStatus('none');
    setProfile({ ...profile, women_only_verified: false, verification_level: 0 });
    return { error: null };
  }, [profile, setProfile]);

  return {
    canAccessWomenOnly,
    verificationLevel,
    status,
    refreshStatus,
    requestAccess,
    leave,
  };
}
