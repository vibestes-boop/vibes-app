/** Shared glass controls for creation, studio and live setup. */
import { useTheme } from '@/lib/useTheme';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

// Silberner Tint für Akzent-Icon-Flächen — funktioniert auf hell + dunkel.
export const ACCENT_TINT = 'rgba(124,139,160,0.10)';

/** Native glass where available, with a glossy fallback and theme-aware text. */
export function GlassPanel({
  children,
  style,
  radius = 22,
  padding = 14,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  padding?: number;
}) {
  return <GlassSurface radius={radius} style={style}>
    <View style={{ padding }}>{children}</View>
  </GlassSurface>;
}

/** Theme-aware Style-Tokens für die Create/Studio/Live-Oberflächen. */
export function useCreateGlass() {
  const { colors, isDark } = useTheme();
  return useMemo(() => {
    const fill      = isDark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.06)';
    const fillHover = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.09)';
    return {
      // Text — hell genug, damit auch die dezenten Labels klar lesbar sind.
      title:        { color: colors.text.primary,   fontSize: 15, fontWeight: '600' as const },
      sub:          { color: colors.text.secondary, fontSize: 11.5 },
      sectionLabel: { color: colors.text.secondary, fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.4, marginBottom: 8 },

      // Option-Karte (Aus Galerie / Text-Post / …)
      card: {
        flex: 1,
        backgroundColor: fill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border.subtle,
        borderRadius: 14,
        padding: 12,
      } as ViewStyle,
      cardIcon: {
        width: 34, height: 34, borderRadius: 11,
        alignItems: 'center' as const, justifyContent: 'center' as const,
        marginBottom: 8, backgroundColor: ACCENT_TINT,
      } as ViewStyle,

      // Segment-Control (Format 9:16 / 1:1 / 16:9)
      segTrack: {
        flexDirection: 'row' as const, gap: 4,
        backgroundColor: fill, borderRadius: 12, padding: 4,
      } as ViewStyle,
      segBtn:        { flex: 1, alignItems: 'center' as const, paddingVertical: 8, borderRadius: 9 } as ViewStyle,
      segBtnActive:  { backgroundColor: colors.accent.solid } as ViewStyle,
      segLabel:       { color: colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
      segLabelActive: { color: colors.text.onAccent, fontSize: 12, fontWeight: '700' as const },

      // Chip (Editor-Werkzeuge)
      chip: {
        flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5,
        backgroundColor: fill, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6,
      } as ViewStyle,
      chipText:  { color: colors.text.primary, fontSize: 12, fontWeight: '500' as const },
      chipIcon:  colors.text.secondary,

      // Zeilen-Button (Entwürfe fortsetzen)
      rowBtn: {
        flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
        backgroundColor: fill, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
      } as ViewStyle,
      rowText: { flex: 1, color: colors.text.primary, fontSize: 14, fontWeight: '500' as const },

      // Kamera-Rail-Icon-Button (Wenden/Blitz/Timer/Sound)
      railBtn: {
        width: 38, height: 38, borderRadius: 19,
        alignItems: 'center' as const, justifyContent: 'center' as const,
        backgroundColor: isDark ? 'rgba(20,20,26,0.5)' : 'rgba(0,0,0,0.28)',
        borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)',
      } as ViewStyle,

      // Roh-Tokens für Sonderfälle. textMuted ist bewusst text.SECONDARY (nicht
      // text.muted) — über dem Kamera-Glas müssen auch die „dezenten" Labels
      // (Publikum/Kategorie/Titel …) klar lesbar bleiben; echtes muted verschwand.
      accent: colors.accent.primary,
      textPrimary: colors.text.primary,
      textSecondary: colors.text.secondary,
      textMuted: colors.text.secondary,
      textFaint: colors.text.muted,
      border: colors.border.subtle,
      fill, fillHover, isDark,
    };
  }, [colors, isDark]);
}
