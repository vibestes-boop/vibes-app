import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session,User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage,persist } from 'zustand/middleware';
import { PROFILE_SELECT } from './profileSelect';

export type Profile = {
  id: string;
  username: string;
  bio: string | null;
  website: string | null;
  avatar_url: string | null;
  guild_id: string | null;
  created_at: string;
  onboarding_complete: boolean | null;
  preferred_tags: string[] | null;
  voice_sample_url: string | null;
  is_verified?: boolean | null;        // Goldenes Häkchen
  is_private?: boolean | null;         // Privates Konto
  teip?: string | null;                // Tschetschenischer Clan (Тейп)
  // ── Women-Only Zone ──────────────────────────────────────────
  gender?: 'female' | 'male' | 'other' | null;
  women_only_verified?: boolean | null; // true = Zugang zur Women-Only Zone
  verification_level?: number | null;   // 0=keine, 1=Selbstdeklaration, 2=Selfie
  // ── Creator & Admin ──────────────────────────────────────────
  is_creator?: boolean | null;           // Creator-Status aktiviert
  display_name?: string | null;          // Anzeigename (optional)
  is_admin?: boolean | null;             // Admin-Zugang
  // ── Bottom-Nav-Anpassung (Slot 2/4) ──────────────────────────
  // Explizit in PROFILE_SELECT enthalten; tabBarStore braucht keine Extra-Abfrage.
  nav_slot_2?: string | null;
  nav_slot_4?: string | null;
};


export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

// Invalidate in-flight reads on account changes, logout and local profile edits.
let profileRequest = 0;

type AuthStore = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileStatus: ProfileStatus;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
};

// Do not hold Supabase's auth lock while reading the profile.
async function fetchProfileViaRest(userId: string, accessToken: string): Promise<Profile | null> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Profile API is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      `${url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=${PROFILE_SELECT}&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        signal: controller.signal,
      },
    );
    if (!res.ok) throw new Error(`Profile request failed (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data) || (data.length > 0 && data[0]?.id !== userId)) {
      throw new Error('Invalid profile response');
    }
    return data[0] ?? null;
  } finally {
    clearTimeout(timeout);
  }
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      profile: null,
      loading: false,
      profileStatus: 'idle',
      initialized: false,

      setSession: (session) => {
        const changed = get().session?.access_token !== session?.access_token;
        if (changed) profileRequest++;
        const profile = session && get().profile?.id === session.user.id ? get().profile : null;
        set({
          session, user: session?.user ?? null, profile,
          ...(changed || !session ? {
            loading: false,
            profileStatus: profile ? 'ready' : 'idle',
          } : {}),
        });
      },

      setProfile: (profile) => {
        profileRequest++;
        set({ profile, loading: false, profileStatus: profile ? 'ready' : 'missing' });
      },

      fetchProfile: async (userId: string) => {
        const session = get().session;
        if (!session?.access_token || session.user.id !== userId) return;
        const request = ++profileRequest;
        set({ loading: true, profileStatus: 'loading' });
        const isCurrent = () => request === profileRequest && get().session?.user.id === userId;
        try {
          const profile = await fetchProfileViaRest(userId, session.access_token);
          if (isCurrent()) set({ profile, loading: false, profileStatus: profile ? 'ready' : 'missing' });
        } catch {
          // An unavailable/denied request is not evidence of a new account.
          // A matching cached profile remains usable during offline refreshes.
          if (isCurrent()) {
            set({ loading: false, profileStatus: get().profile?.id === userId ? 'ready' : 'error' });
          }
        }
      },

      signOut: async () => {
        const { supabase } = await import('./supabase');
        // Push-Registrierung dieses Users lösen, bevor die Session weg ist —
        // sonst bekäme der Account nach dem Abmelden weiter Pushes auf dieses
        // Gerät (beim Account-Wechsel greift zusätzlich der DB-Trigger).
        const uid = get().profile?.id ?? get().user?.id;
        if (uid) {
          try {
            await supabase.from('profiles').update({ push_token: null }).eq('id', uid);
            // ⚠️ NUR die Serlo-Registrierung. Ohne `app`-Filter löschte dieses
            // Abmelden auch den Token des BERKAT-Geräts mit — der Nutzer verlor
            // damit still seine Zuschlag- und Zahlungserinnerungen in einer
            // anderen App, ohne sich dort abgemeldet zu haben.
            // Gefunden im Sicherheits-Audit vom 22.08.2026.
            await supabase.from('push_tokens').delete().eq('user_id', uid).eq('app', 'serlo');
          } catch { /* Logout darf nie an der Token-Bereinigung scheitern */ }
        }
        await supabase.auth.signOut();
        // WICHTIG: `initialized` NICHT auf false setzen! Der getSession-Effekt
        // im Root-Layout läuft nur beim Mount und onAuthStateChange setzt bei
        // SIGNED_OUT kein initialized:true — bliebe es false, hinge die App
        // ewig im „wird geladen…"-Screen. Mit initialized=true + session=null
        // greift der AuthGuard und leitet sauber zu /(auth)/login.
        get().setSession(null);
      },
    }),
    {
      // AsyncStorage-Key — wird genau einmal pro Gerät geschrieben
      name: 'vibes-auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      // initialized wird NICHT persistiert → startet immer false
      // Nur session + user + profile werden gecacht
      partialize: (state) => ({
        session: state.session,
        user: state.user,
        profile: state.profile,
      }),
    }
  )
);
