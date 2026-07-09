/**
 * lib/i18n/i18nStore.ts — Sprach-State (Zustand + AsyncStorage)
 *
 * v1: manueller Sprachwechsel in den Einstellungen, Default Deutsch.
 * Bewusst OHNE expo-localization (natives Modul → bräuchte neuen Binary +
 * Apple-Review). Systemsprachen-Erkennung kommt mit dem nächsten ohnehin
 * fälligen Binary-Build; dann wird hier ein 'system'-Modus ergänzt.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppLocale } from './messages';

interface I18nStore {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      locale: 'de',
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'vibes-i18n-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
