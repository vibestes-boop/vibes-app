/**
 * lib/useTheme.ts — Theme Hook für alle Komponenten
 *
 * Verwendung:
 *   const { colors, isDark } = useTheme();
 *   style={{ backgroundColor: colors.bg.primary }}
 */

import { useThemeStore } from './themeStore';

export function useTheme() {
  const colors   = useThemeStore((s) => s.colors);
  const resolved = useThemeStore((s) => s.resolved);
  const mode     = useThemeStore((s) => s.mode);

  return {
    colors,
    isDark:  resolved === 'dark',
    isLight: resolved === 'light',
    mode,
  };
}
