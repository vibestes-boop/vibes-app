/**
 * lib/i18n/i18nStore.ts — Sprach-State (Zustand + AsyncStorage)
 *
 * v2: Sprache folgt beim ERSTEN Start der Gerätesprache (Russisch → ru,
 * sonst de). Sobald der User in den Einstellungen manuell umschaltet
 * (`setLocale`), gewinnt diese Wahl dauerhaft (`pickedByUser`).
 *
 * Gerätesprache: bevorzugt expo-localization (natives Modul, erst ab dem
 * nächsten Binary verlinkt — guarded require), Fallback React-Native-Core
 * (SettingsManager / I18nManager, funktioniert im aktuellen Binary 291).
 * Dadurch OTA-sicher heute UND sauber nativ ab dem nächsten Build.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppLocale } from './messages';

/** Mappt einen Sprach-/Locale-Code auf unsere AppLocales. */
function mapCode(code: string | null | undefined): AppLocale | null {
  const low = code?.toLowerCase() ?? '';
  if (low.startsWith('ru')) return 'ru';
  if (low.startsWith('ce')) return 'ce';
  if (low.startsWith('en')) return 'en';
  if (low.startsWith('de')) return 'de';
  return null;
}

/**
 * Liest die Gerätesprache und mappt auf unsere Locales.
 *
 * 1. expo-localization — zuverlässige native API, aber erst ab dem NÄCHSTEN
 *    Binary-Build verlinkt. Guarded require: im aktuellen Binary (291) wirft
 *    der Zugriff → Fallback greift, kein Crash per OTA.
 * 2. RN-Core (SettingsManager / I18nManager) — funktioniert überall heute.
 */
function detectDeviceLocale(): AppLocale {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = require('expo-localization') as typeof import('expo-localization');
    const mapped = mapCode(Localization.getLocales?.()[0]?.languageCode);
    if (mapped) return mapped;
    if (Localization.getLocales?.()[0]) return 'de'; // bekannte, nicht unterstützte Sprache
  } catch {
    // Natives Modul (noch) nicht im Binary → RN-Core-Fallback.
  }
  try {
    let raw: string | undefined;
    if (Platform.OS === 'ios') {
      const s: any = NativeModules.SettingsManager?.settings;
      raw = s?.AppleLocale ?? (Array.isArray(s?.AppleLanguages) ? s.AppleLanguages[0] : undefined);
    } else {
      raw = (NativeModules.I18nManager as any)?.localeIdentifier;
    }
    const mapped = mapCode(raw);
    if (mapped) return mapped;
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
