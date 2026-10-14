import { GlassSurface } from '@/components/ui/GlassSurface';
import { useMemo, type ReactNode } from 'react';
import { Dimensions, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/lib/useTheme';

export const { width: SW, height: SH } = Dimensions.get('window');

// Legacy statische Dark-Tokens — noch von den Medien-Overlay-Items
// (StickerOverlayItem/TextOverlay) genutzt, die BEWUSST über dem Medium liegen
// und dort dunkel/weiß bleiben. Neue Bottom-Sheets nutzen useEditorSheet() +
// GlassSheet für die theme-aware Glas-Sprache (Parität mit Studio/Live).
export const shared = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 14 },
  title:       { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  doneBtn:     { marginHorizontal: 20, backgroundColor: '#fff', paddingVertical: 15, borderRadius: 16, alignItems: 'center' as const, marginTop: 8 },
  doneBtnText: { color: '#000', fontSize: 15, fontWeight: '600' as const },
});

/** Opaque, studio-lit sheet keeps form labels readable above busy media. */
export function GlassSheet({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <GlassSurface material="solid" radius={28} style={style}>{children}</GlassSurface>;
}

/** Theme-aware Tokens für die Editor-Bottom-Sheets (Filter/Anpassen/Drehen/…). */
export function useEditorSheet() {
  const { colors, isDark } = useTheme();
  return useMemo(() => {
    const fill       = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const fillActive = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.10)';
    return {
      overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' } as ViewStyle,
      handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border.strong, alignSelf: 'center' as const, marginBottom: 14 } as ViewStyle,
      title:       { color: colors.text.primary, fontSize: 17, fontWeight: '700' as const, paddingHorizontal: 20, marginBottom: 12 } as TextStyle,
      // Action foreground follows the neutral button surface in each theme.
      doneBtn:     { marginHorizontal: 20, backgroundColor: colors.accent.solid, paddingVertical: 15, borderRadius: 16, alignItems: 'center' as const, marginTop: 8 } as ViewStyle,
      doneBtnText: { color: colors.text.onAccent, fontSize: 15, fontWeight: '600' as const } as TextStyle,
      // Roh-Tokens für Sheet-Innenleben (Labels/Chips/Tracks).
      text:          colors.text.primary,
      textSecondary: colors.text.secondary,
      textMuted:     colors.text.muted,
      accent:        colors.accent.primary,
      action:        colors.accent.solid,
      onAction:      colors.text.onAccent,
      border:        colors.border.subtle,
      fill,
      fillActive,
      isDark,
    };
  }, [colors, isDark]);
}
