// Sitzung und Profil. Dieselben Accounts wie Serlo — wer dort registriert ist,
// ist hier sofort angemeldet, sobald er sich einmal einloggt.

import { useEffect } from 'react';
import { create } from 'zustand';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  /** Freigegeben für Frauen-Only-Räume (Admin-geprüft in der Serlo-DB) */
  women_only_verified: boolean;
};

type SessionState = {
  userId: string | null;
  profile: Profile | null;
  /** true bis der erste Auth-Check durch ist — verhindert Login-Flackern */
  loading: boolean;
  setUser: (userId: string | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
};

export const useSession = create<SessionState>((set) => ({
  userId: null,
  profile: null,
  loading: true,
  setUser: (userId) => set({ userId }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
}));

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, women_only_verified')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    // Profil-Fehler dürfen den Login nicht blockieren — die Sitzung steht
    // bereits, das Profil ist nur Anzeige.
    if (__DEV__) console.warn('[Berkat] Profil konnte nicht geladen werden:', error.message);
    return null;
  }
  return (data as Profile | null) ?? null;
}

/**
 * Einmal im Root-Layout aufrufen. Stellt die gespeicherte Sitzung wieder her
 * und hört auf Anmelden/Abmelden.
 */
export function useSessionBootstrap(): void {
  const setUser = useSession((s) => s.setUser);
  const setProfile = useSession((s) => s.setProfile);
  const setLoading = useSession((s) => s.setLoading);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      const userId = data.session?.user.id ?? null;
      setUser(userId);
      if (userId) setProfile(await loadProfile(userId));
      if (!cancelled) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      const userId = session?.user.id ?? null;
      setUser(userId);
      setProfile(userId ? await loadProfile(userId) : null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [setUser, setProfile, setLoading]);
}
