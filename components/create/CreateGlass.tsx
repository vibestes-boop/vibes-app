/**
 * CreateGlass — geteilte, theme-aware Glas-Oberfläche für Erstellen / Studio / Live.
 *
 * EINE Quelle für Panel, Scrim, Border, Typo, Chips, Segment-Control und CTA —
 * damit Studio, Editor und Live-Setup exakt gleich aussehen und beide Themes
 * korrekt bedienen:
 *   - Darkmode  → dunkles Frosted-Glass (Blur dark + dunkler Scrim, weißer Text)
 *   - Lightmode → helles Frosted-Glass  (Blur light + heller Scrim, dunkler Text)
 *
 * Die Kamera/der Hintergrund scheint durch den Blur durch, der Scrim hält alles
 * lesbar. Marken-Lila (accent.primary) ist der Akzent; Rot bleibt LIVE vorbehalten.
 */
import { useTheme } from '@/lib/useTheme';
import { BlurView } from 'expo-blur';
import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

// Brand-Lila-Tint für Akzent-Icon-Flächen — funktioniert auf hell + dunkel.
export const ACCENT_TINT = 'rgba(168,85,247,0.18)';

/** Frosted-Glass-Panel: Blur + theme-abhängiger Scrim + Hairline-Border. */
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
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.subtle },
        style as ViewStyle,
      ]}
    >
      <BlurView intensity={55} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          // Kräftigerer, leicht heller Scrim → das Panel liest sich als klare
          // Fläche (nicht murkig-dunkel über der dunklen Kamera).
          { backgroundColor: isDark ? 'rgba(30,30,38,0.86)' : 'rgba(252,252,253,0.86)' },
        ]}
      />
      <View style={{ padding }}>{children}</View>
    </View>
  );
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
      segBtnActive:  { backgroundColor: colors.accent.primary } as ViewStyle,
      segLabel:       { color: colors.text.secondary, fontSize: 12, fontWeight: '600' as const },
      segLabelActive: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' as const },

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

      // Roh-Tokens für Sonderfälle
      accent: colors.accent.primary,
      textPrimary: colors.text.primary,
      textMuted: colors.text.muted,
      border: colors.border.subtle,
      fill, fillHover, isDark,
    };
  }, [colors, isDark]);
}
