/**
 * lib/tabBarStore.ts — Customizable Tab Bar (Facebook-Modell)
 *
 * Slot 1 = Feed (fest)
 * Slot 2 = wählbar (default: guild)
 * Slot 3 = + Create (fest)
 * Slot 4 = wählbar (default: shop)
 * Slot 5 = Profil (fest)
 *
 * Persistiert via Zustand + AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LucideIcon } from 'lucide-react-native';
import {
Bell,
Compass,
Flower2,
MessageCircle,
ShoppingBag,
User,
Users,
Video,
Zap,
} from 'lucide-react-native';
import { create } from 'zustand';
import { createJSONStorage,persist } from 'zustand/middleware';

import { normalizeNavSlots, selectNavSlot, type NavSlots } from './navigationSlots';
import { useAuthStore } from './authStore';
import { supabase } from './supabase';

// Alle verfügbaren Tab-Features
export type TabFeature =
  | 'guild'
  | 'messages'
  | 'shop'
  | 'explore'
  | 'notifications'
  | 'live'
  | 'women_only';

export interface TabFeatureMeta {
  key:      TabFeature;
  label:    string;
  /** i18n-Key (tabs.*) — Konsumenten übersetzen am Renderpunkt via t() */
  labelKey: string;
  icon:     LucideIcon;
  route:    string;  // Expo Router route oder push-path
  isPush:   boolean; // true = router.push, false = navigate (tab)
}

// Vollständige Metadaten für jedes Feature
export const TAB_FEATURES: Record<TabFeature, TabFeatureMeta> = {
  guild: {
    key:    'guild',
    labelKey: 'tabs.guild',
    label:  'Clan',
    icon:   Users,
    route:  'guild',
    isPush: false,
  },
  messages: {
    key:    'messages',
    labelKey: 'tabs.messages',
    label:  'Nachrichten',
    icon:   MessageCircle,
    route:  'messages',
    isPush: false,
  },
  shop: {
    key:    'shop',
    labelKey: 'tabs.shop',
    label:  'Shop',
    icon:   ShoppingBag,
    route:  'shop',
    isPush: false,
  },
  explore: {
    key:    'explore',
    labelKey: 'tabs.explore',
    label:  'Entdecken',
    icon:   Compass,
    route:  'explore',
    isPush: false,
  },
  notifications: {
    key:    'notifications',
    labelKey: 'tabs.notifications',
    label:  'Aktivität',
    icon:   Bell,
    route:  'notifications',
    isPush: false,
  },
  live: {
    key:    'live',
    labelKey: 'tabs.live',
    label:  'Live',
    icon:   Video,
    route:  '/live',
    isPush: true,
  },
  women_only: {
    key:    'women_only',
    labelKey: 'tabs.women_only',
    label:  'WOZ',
    icon:   Flower2,
    route:  '/women-only',
    isPush: true,
  },
};

// Alle Features als sortierte Liste für den Customize-Screen
export const ALL_TAB_FEATURES: TabFeature[] = [
  'guild', 'messages', 'shop', 'explore', 'notifications', 'live', 'women_only',
];


// DB-Sync (v1.x): Slot-Wahl wandert nach profiles.nav_slot_2/4, damit die Web-
// Seite dieselbe Nav rendert. Best-effort — AsyncStorage hält den Wert lokal,
// also bleibt die UI auch bei DB-Fehler/Offline funktionsfähig.
async function persistSlotsToDb(slots: NavSlots) {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  const profile = useAuthStore.getState().profile;
  if (profile?.id === userId) {
    useAuthStore.setState({ profile: { ...profile, nav_slot_2: slots.slot2, nav_slot_4: slots.slot4 } });
  }
  try {
    await supabase.from('profiles').update({ nav_slot_2: slots.slot2, nav_slot_4: slots.slot4 }).eq('id', userId);
  } catch {
    /* Spalte fehlt noch (Migration nicht angewandt) / offline → ignorieren */
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface TabBarStore {
  /** Slot 2: Feature links vom Create-Button. Default: guild */
  slot2: TabFeature;
  /** Slot 4: Feature rechts vom Create-Button. Default: shop */
  slot4: TabFeature;
  setSlot2: (f: TabFeature) => void;
  setSlot4: (f: TabFeature) => void;
  /**
   * Übernimmt die Slot-Wahl aus dem BEREITS geladenen Profil (kein Extra-Read).
   * Die Nav-Spalten reiten auf dem select=* mit, das authStore beim Login lädt.
   */
  hydrateFromProfile: () => void;
}

export const useTabBarStore = create<TabBarStore>()(
  persist(
    (set, get) => ({
      slot2: 'guild',
      slot4: 'shop',
      setSlot2: (f) => { const slots = selectNavSlot(get(), 2, f); set(slots); void persistSlotsToDb(slots); },
      setSlot4: (f) => { const slots = selectNavSlot(get(), 4, f); set(slots); void persistSlotsToDb(slots); },
      hydrateFromProfile: () => {
        // KEIN Extra-Read: die Nav-Slots stehen im select=*, das authStore beim
        // Login ohnehin lädt (authStore.fetchProfileViaRest). Wir lesen sie nur
        // aus dem bereits im Speicher liegenden Profil-Objekt.
        const profile = useAuthStore.getState().profile;
        if (!profile) return;
        set(normalizeNavSlots(profile.nav_slot_2, profile.nav_slot_4));
      },
    }),
    {
      name: 'serlo-tab-bar',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      partialize: (s) => ({ slot2: s.slot2, slot4: s.slot4 }),
      merge: (saved, current) => {
        const slots = saved as Partial<NavSlots> | undefined;
        return { ...current, ...normalizeNavSlots(slots?.slot2, slots?.slot4) };
      },
      migrate: (persisted: any, version: number) => {
        // v2: slot4 default auf 'shop' umstellen
        if (version < 2) {
          return { ...persisted, slot4: 'shop' };
        }
        return persisted;
      },
    }
  )
);

// ─── Feste Tab-Konfiguration (Slot 1, 3, 5) ──────────────────────────────────

export interface FixedTab {
  key:      string;
  label:    string;
  labelKey: string;
  icon:     LucideIcon;
  route:    string;
  isCreate: boolean;
  isFixed:  true;
}

export const FIXED_TAB_1: FixedTab = {
  key: 'index', label: 'Feed', labelKey: 'tabs.home', icon: Zap, route: 'index', isCreate: false, isFixed: true,
};
export const FIXED_TAB_3: FixedTab = {
  key: '_create', label: '', labelKey: '', icon: User /* ersetzt */, route: '/create/camera', isCreate: true, isFixed: true,
};
export const FIXED_TAB_5: FixedTab = {
  key: 'profile', label: 'Profil', labelKey: 'tabs.profile', icon: User, route: 'profile', isCreate: false, isFixed: true,
};
