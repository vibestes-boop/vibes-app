/**
 * lib/i18n/i18nStore.ts — Sprach-State (Zustand + AsyncStorage)
 *
 * v2: Sprache folgt beim ERSTEN Start der Gerätesprache (Russisch → ru,
 * sonst de). Sobald der User in den Einstellungen manuell umschaltet
 * (`setLocale`), gewinnt diese Wahl dauerhaft (`pickedByUser`).
 *
 * Gerätesprache wird über React-Native-Core gelesen (SettingsManager /
 * I18nManager) — KEIN expo-localization (natives Modul → bräuchte Binary).
 * Dadurch OTA-fähig ohne neuen Build.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppLocale } from './messages';

/** Liest die Gerätesprache aus RN-Core und mappt auf unsere Locales. */
function detectDeviceLocale(): AppLocale {
  try {
    let raw: string | undefined;
    if (Platform.OS === 'ios') {
      const s: any = NativeModules.SettingsManager?.settings;
      raw = s?.AppleLocale ?? (Array.isArray(s?.AppleLanguages) ? s.AppleLanguages[0] : undefined);
    } else {
      raw = (NativeModules.I18nManager as any)?.localeIdentifier;
    }
    if (raw && raw.toLowerCase().startsWith('ru')) return 'ru';
  } catch {
    // Fallback unten
  }
  return 'de';
}

interface I18nStore {
  locale: AppLocale;
  /** true, sobald der User die Sprache manuell gewählt hat. */
  pickedByUser: boolean;
  setLocale: (locale: AppLocale) => void;
  /** Auf „Automatisch" zurücksetzen: folgt wieder der Gerätesprache. */
  useDeviceLocale: () => void;
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      // Synchroner Erst-Wert (vor Rehydration): direkt aus der Gerätesprache.
      locale: detectDeviceLocale(),
      pickedByUser: false,
      setLocale: (locale) => set({ locale, pickedByUser: true }),
      useDeviceLocale: () => set({ locale: detectDeviceLocale(), pickedByUser: false }),
    }),
    {
      name: 'vibes-i18n-v1',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persisted: any, from: number) => {
        // v1 kannte kein pickedByUser → als "nie manuell gewählt" behandeln,
        // damit auch Bestands-User die Gerätesprache bekommen.
        if (from < 2 && persisted && typeof persisted === 'object') {
          return { ...persisted, pickedByUser: false };
        }
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        // Nach dem Laden: hat der User NIE manuell gewählt, folgt die
        // Sprache der aktuellen Gerätesprache.
        if (state && !state.pickedByUser) {
          state.locale = detectDeviceLocale();
        }
      },
    },
  ),
);
