import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  username: string;
  bio: string | null;
  website: string | null;
  avatar_url: string | null;
  guild_id: string | null;
  explore_vibe: number;
  brain_vibe: number;
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
};


type AuthStore = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
};

// Direkter REST-Fetch — umgeht den Supabase-Client-Proxy der nach Hot-Reload hängt
async function fetchProfileViaRest(userId: string, accessToken: string): Promise<Profile | null> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const res = await fetch(
    `${url}/rest/v1/profiles?id=eq.${userId}&select=*&limit=1`,
    {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      profile: null,
      loading: false,
      initialized: false,

      setSession: (session) =>
        set({ session, user: session?.user ?? null }),

      setProfile: (profile) =>
        set({ profile }),

      fetchProfile: async (userId: string) => {
        try {
          const accessToken = get().session?.access_token;
          if (!accessToken) {
            if (__DEV__) console.warn('[auth] fetchProfile: kein Access-Token');
            set({ profile: null });
            return;
          }
          const profile = await fetchProfileViaRest(userId, accessToken);
          set({ profile });
        } catch (e) {
          if (__DEV__) console.warn('[auth] fetchProfile failed', e);
          set({ profile: null });
        }
      },

      signOut: async () => {
        const { supabase } = await import('./supabase');
        await supabase.auth.signOut();
        set({ session: null, user: null, profile: null, initialized: false });
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
