/**
 * lib/themeStore.ts — Theme-State (Zustand + AsyncStorage)
 *
 * - mode: 'system' | 'dark' | 'light'  → User-Präferenz
 * - resolved: 'dark' | 'light'          → tatsächlich aktiv
 * - colors: ThemeColors                 → aktuelle Token
 *
 * Standard: 'system' (folgt iOS Dark/Light automatisch)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type ThemeColors, type ThemeMode } from './theme';

interface ThemeStore {
  mode: ThemeMode;
  resolved: 'dark' | 'light';
  colors: ThemeColors;

  /** Wird vom ThemeProvider mit dem aktuellen System-Wert aufgerufen */
  _systemScheme: 'dark' | 'light';
  setSystemScheme: (scheme: 'dark' | 'light') => void;

  /** User ändert Theme in den Einstellungen */
  setMode: (mode: ThemeMode) => void;
}

function resolveColors(
  mode: ThemeMode,
  systemScheme: 'dark' | 'light',
): { resolved: 'dark' | 'light'; colors: ThemeColors } {
  const resolved = mode === 'system' ? systemScheme : mode;
  return {
    resolved,
    colors: resolved === 'dark' ? darkColors : lightColors,
  };
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      mode: 'system',
      _systemScheme: 'dark',
      resolved: 'dark',
      colors: darkColors,

      setSystemScheme: (scheme) => {
        const { mode } = get();
        const { resolved, colors } = resolveColors(mode, scheme);
        set({ _systemScheme: scheme, resolved, colors });
      },

      setMode: (mode) => {
        const { _systemScheme } = get();
        const { resolved, colors } = resolveColors(mode, _systemScheme);
        set({ mode, resolved, colors });
      },
    }),
    {
      name: 'vibes-theme-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Nur mode persistieren — resolved wird beim Start neu berechnet
      partialize: (s) => ({ mode: s.mode }),
    },
  ),
);
