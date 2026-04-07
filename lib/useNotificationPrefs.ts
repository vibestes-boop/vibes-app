/**
 * lib/useNotificationPrefs.ts
 * Speichert die Push-Notification-Einstellungen des Users lokal in AsyncStorage.
 * Die Präferenzen werden beim Laden der App gelesen und beim Ändern sofort persistiert.
 */
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const STORAGE_KEY = '@vibes_notif_prefs';

export type NotifPrefs = {
  likes: boolean;        // Jemand liked deinen Post
  comments: boolean;     // Jemand kommentiert deinen Post
  follows: boolean;      // Neuer Follower
  liveAlerts: boolean;   // Jemand den du folgst startet einen Live-Stream
  messages: boolean;     // Neue Direktnachricht
  reposts: boolean;      // Jemand repostet deinen Post
};

const DEFAULT_PREFS: NotifPrefs = {
  likes: true,
  comments: true,
  follows: true,
  liveAlerts: true,
  messages: true,
  reposts: true,
};

type NotifPrefsStore = {
  prefs: NotifPrefs;
  loaded: boolean;
  setPrefs: (prefs: Partial<NotifPrefs>) => Promise<void>;
  loadPrefs: () => Promise<void>;
};

const useNotifPrefsStore = create<NotifPrefsStore>((set, get) => ({
  prefs: DEFAULT_PREFS,
  loaded: false,

  loadPrefs: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
        set({ prefs: { ...DEFAULT_PREFS, ...parsed }, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  setPrefs: async (update: Partial<NotifPrefs>) => {
    const newPrefs = { ...get().prefs, ...update };
    set({ prefs: newPrefs });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
    } catch {
      // Persistierung fehlgeschlagen — in-memory Änderung bleibt trotzdem
    }
  },
}));

/** Hook für den Rest der App — lädt einmalig aus AsyncStorage */
export function useNotificationPrefs() {
  const { prefs, loaded, setPrefs, loadPrefs } = useNotifPrefsStore();

  useEffect(() => {
    if (!loaded) loadPrefs();
  }, [loaded, loadPrefs]);

  return { prefs, setPrefs, loaded };
}
