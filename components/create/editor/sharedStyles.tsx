import { BlurView } from 'expo-blur';
import { useMemo, type ReactNode } from 'react';
import { Dimensions, StyleSheet, View, type TextStyle, type ViewStyle } from 'react-native';

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

/**
 * GlassSheet — theme-aware Frosted-Glass-Body für die Editor-Bottom-Sheets.
 *
 * Gleiche Glas-Sprache wie `components/create/CreateGlass` (Studio/Live):
 * Blur + theme-abhängiger Scrim + Hairline-Top-Border. Das `style`-Prop liefert
 * Radius/Padding — ein `backgroundColor` ist NICHT mehr nötig (der Scrim macht
 * die Fläche). Darkmode → dunkles Glas, Lightmode → helles Glas.
 */
export function GlassSheet({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        { overflow: 'hidden', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border.subtle },
        style as ViewStyle,
      ]}
    >
      <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: isDark ? 'rgba(22,22,28,0.9)' : 'rgba(250,250,252,0.92)' },
        ]}
      />
      {children}
    </View>
  );
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
      // Primär-CTA in Marken-Lila — in BEIDEN Themes lesbar (weißer Text auf Lila),
      // anders als accent.primary (weiß/schwarz → white-on-white-Falle).
      doneBtn:     { marginHorizontal: 20, backgroundColor: colors.accent.secondary, paddingVertical: 15, borderRadius: 16, alignItems: 'center' as const, marginTop: 8 } as ViewStyle,
      doneBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const } as TextStyle,
      // Roh-Tokens für Sheet-Innenleben (Labels/Chips/Tracks).
      text:          colors.text.primary,
      textSecondary: colors.text.secondary,
      textMuted:     colors.text.muted,
      accent:        colors.accent.secondary,
      border:        colors.border.subtle,
      fill,
      fillActive,
      isDark,
    };
  }, [colors, isDark]);
}
