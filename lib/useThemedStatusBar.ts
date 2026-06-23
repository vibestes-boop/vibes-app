/**
 * lib/useThemedStatusBar.ts
 *
 * Setzt den iOS/Android-Status-Bar-Stil (Uhr/Akku/WLAN-Icons) beim Fokussieren
 * eines Screens — zuverlässig per useFocusEffect, unabhängig von der Mount-Reihenfolge.
 *
 * Hintergrund: app.json pinnt global `UIStatusBarStyle=LightContent` (weiße Icons).
 * Das passt auf immer-dunkle Screens (Feed/Live/Story), macht die Icons aber auf
 * theme-aware Screens im Light-Mode unsichtbar (weiß auf weiß). Da der Stil global
 * ist und „zuletzt gesetzt gewinnt", war das Verhalten je nach Navigation flaky.
 *
 *   'light' → weiße Icons  (für dunkle Hintergründe: Feed, Live, Story)
 *   'dark'  → schwarze Icons (für helle Hintergründe)
 *   'auto'  → passend zum App-Theme (Dark→light, Light→dark)
 */
import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { useTheme } from './useTheme';

export function useThemedStatusBar(mode: 'light' | 'dark' | 'auto' = 'auto') {
  const { isDark } = useTheme();
  const style: 'light' | 'dark' = mode === 'auto' ? (isDark ? 'light' : 'dark') : mode;
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style, true);
    }, [style]),
  );
}
