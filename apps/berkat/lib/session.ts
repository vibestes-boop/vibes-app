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

async function loadProfile(userId: string, signal: AbortSignal): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, women_only_verified')
      .eq('id', userId)
      .abortSignal(signal)
      .maybeSingle();

    if (error) throw error;
    return (data as Profile | null) ?? null;
  } catch {
    // Profilfehler ändern weder die bekannte Sitzung noch deren Bereitschaft.
    if (__DEV__ && !signal.aborted) console.warn('[Berkat] Profil konnte nicht geladen werden.');
    return null;
  }
}

/**
 * Einmal im Root-Layout aufrufen. Stellt die gespeicherte Sitzung wieder her
 * und hört auf Anmelden/Abmelden.
 */
export function useSessionBootstrap(): void {
  useEffect(() => {
    let cancelled = false;
    let receivedAuthEvent = false;
    let currentUserId: string | null | undefined;
    let profileVersion = 0;
    let profileTimer: ReturnType<typeof setTimeout> | null = null;
    let profileRequest: AbortController | null = null;

    const cancelProfile = () => {
      profileVersion++;
      if (profileTimer !== null) clearTimeout(profileTimer);
      profileTimer = null;
      profileRequest?.abort();
      profileRequest = null;
    };

    const scheduleProfile = (userId: string, force = false) => {
      // Gleichzeitige INITIAL_SESSION/getSession/SIGNED_IN teilen den Abruf.
      if (!force && (profileTimer !== null || profileRequest !== null)) return;
      cancelProfile();
      const version = profileVersion;
      // Auth wartet auf seine Listener. Netzarbeit gehört außerhalb dieses
      // Rückrufs, damit nachfolgende Auth-Ereignisse sofort verarbeitet werden.
      profileTimer = setTimeout(() => {
        profileTimer = null;
        const request = new AbortController();
        profileRequest = request;
        void loadProfile(userId, request.signal).then((profile) => {
          if (!cancelled && version === profileVersion && !request.signal.aborted) {
            useSession.setState({ profile });
          }
          if (profileRequest === request) profileRequest = null;
        });
      }, 0);
    };

    const applySession = (userId: string | null, event?: string) => {
      if (cancelled) return;
      if (currentUserId !== userId) {
        currentUserId = userId;
        cancelProfile();
        // Atomar: niemals die neue Nutzer-ID mit dem alten Profil anzeigen.
        // Der Auth-Check ist fertig; das Profil darf unabhängig davon laden.
        useSession.setState({ userId, profile: null, loading: false });
        if (userId) scheduleProfile(userId);
      } else if (userId && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        scheduleProfile(userId, event === 'USER_UPDATED');
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      receivedAuthEvent = true;
      applySession(session?.user.id ?? null, event);
    });

    // Ein neueres Auth-Ereignis gewinnt gegen diesen eventuell langsamen
    // Start-Snapshot. Auch ein fehlgeschlagener Check darf nicht endlos laden.
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!receivedAuthEvent) applySession(error ? null : data.session?.user.id ?? null);
    }).catch(() => {
      if (!receivedAuthEvent) applySession(null);
    });

    return () => {
      cancelled = true;
      cancelProfile();
      sub.subscription.unsubscribe();
    };
  }, []);
}
