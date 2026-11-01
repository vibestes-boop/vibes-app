import { darkColors, type ThemeColors } from '@/lib/theme';
import { StyleSheet } from 'react-native';
import { GRID_CELL_WIDTH,GRID_GAP } from './profileConstants';

// ── Factory — wird in jedem Aufruf von useProfileTheme() gecacht ──────────────
// Damit StyleSheet.create() nur neu ausgeführt wird, wenn sich colors ändert.
const cache = new WeakMap<ThemeColors, ReturnType<typeof buildStyles>>();

export function getProfileStyles(colors: ThemeColors) {
  if (cache.has(colors)) return cache.get(colors)!;
  const s = buildStyles(colors);
  cache.set(colors, s);
  return s;
}

/** Dunkle Palette erkennen (hex-Helligkeit von bg.primary) */
function isDarkPalette(c: ThemeColors): boolean {
  const hex = c.bg.primary.replace('#', '');
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/**
 * Eine Fläche fürs ganze Profil: hell weiß, dunkel schwarz (Zaur 01.11.2026).
 * Vorher wechselten Grau (bg.primary) und Weiß (bg.secondary) ab, und die
 * Reiterleiste wirkte ausgegraut.
 */
export function profileSurface(c: ThemeColors): string {
  return isDarkPalette(c) ? c.bg.primary : c.bg.secondary;
}

function buildStyles(c: ThemeColors) {
  const surface = profileSurface(c);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: surface },
    surfaceBg: { backgroundColor: surface },
    heroBg: { position: 'absolute', top: 0, left: 0, right: 0 },

    // ── Top Navigation Header ─────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border.subtle,
    },
    studioLabel: {
      color: c.accent.primary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      opacity: 0.7,
    },
    handle: {
      flex: 1, minWidth: 0, marginRight: 10,
      color: c.text.primary,
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: -0.4,
      marginTop: 1,
    },
    headerRight: { flexDirection: 'row', gap: 4 },
    hBtn: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: c.bg.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border.default,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    hBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: c.accent.danger,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
      borderWidth: 1.5,
      borderColor: c.bg.primary,
    },
    hBadgeText: { color: '#fff', fontSize: 7, fontWeight: '600' },

    // ── Profile Top (Avatar + Stats) ─────────────────────────
    // Bild links, rechts daneben oben Name und @Name, darunter die Zahlen
    // (Zaur 01.11.2026: Name und Nickname über den Zahlen wie bei TikTok, Bild aber links)
    profileTop: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,   // einheitliches 16er-Raster
      paddingTop: 8,
      paddingBottom: 16,
      gap: 16,
      backgroundColor: surface,
    },
    profileInfo: { flex: 1, gap: 2 },
    avatarWrap: { position: 'relative' },
    avatarRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarGap: {
      width: 79,
      height: 79,
      borderRadius: 39.5,
      overflow: 'hidden',
      backgroundColor: surface,  // Spalt zwischen Ring und Bild in Flächenfarbe
    },
    avatarImg: { width: '100%', height: '100%' },
    avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { color: c.text.primary, fontSize: 30, fontWeight: '600' },
    storyDot: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: c.bg.subtle,
      borderWidth: 2,
      borderColor: c.bg.primary,
    },
    storyDotActive: { backgroundColor: c.accent.primary },
    storyAddBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.accent.solid,
      borderWidth: 2,
      borderColor: c.bg.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    storyAddBadgeText: {
      color: c.text.onAccent,
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 16,
      marginTop: -1,
    },

    // Stats
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
    },
    statItem: { alignItems: 'center', flex: 1 },
    // Schriftstufen des Profils (Zaur 01.11.2026: „zu viele Textgrößen“): Name 20,
    // Zahlen 17, Text und Knöpfe 14, alles Nebensächliche 12. Eine Schriftfamilie.
    statNum: { color: c.text.primary, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
    statLabel: { color: c.text.muted, fontSize: 12, fontWeight: '500', marginTop: 1 },
    statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: c.border.subtle },

    // ── Bio Section ───────────────────────────────────────────
    bioSection: {
      paddingHorizontal: 16,             // einheitliches Raster
      paddingBottom: 10,
      paddingTop: 0,
      gap: 4,
      backgroundColor: surface,   // fortsetzung der Karte — KEIN borderBottom mehr
    },                                   // (durchgehende Fläche statt gestapelter Bänder)
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    displayName: { color: c.text.primary, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, flexShrink: 1 },
    verifiedBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.bg.elevated,    // Theme-Token statt hartem Weiß (Light-Mode!)
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border.default,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Konsolidierte Meta-Zeile (Teip · WOZ · Battle · Resonanz) ──
    // Ersetzt die früheren 4 verstreuten Chips/Emoji um den Namen herum.
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: c.text.muted, fontSize: 12, fontWeight: '500' },
    // Identitäts-Chip (Teip / Women-Only / Battle): dezente Pille, gibt den
    // Signalen mehr Präsenz als die alte gequetschte Icon-Text-Reihe.
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: c.bg.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border.subtle,
    },
    metaChipText: { color: c.text.secondary, fontSize: 12, fontWeight: '600' },
    bio: {
      color: c.text.secondary,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400',
    },
    websiteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 2,
      alignSelf: 'flex-start',
    },
    websiteText: {
      color: c.accent.primary,
      fontSize: 12,
      fontWeight: '500',
      maxWidth: 220,
    },

    resonanzChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 20,
      // backgroundColor + borderColor via inline mit colors
      borderWidth: StyleSheet.hairlineWidth,
    },
    resonanzDot: { fontSize: 10 },
    resonanzText: { fontSize: 12, fontWeight: '600' },

    // Legacy
    avatarCol: { alignItems: 'center', gap: 6 },
    guildBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: 'rgba(52,211,153,0.1)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(52,211,153,0.25)',
    },
    guildBadgePending: { backgroundColor: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.2)' },
    guildBadgeText: { color: '#34D399', fontSize: 9, fontWeight: '700' },
    bioCol: { flex: 1, gap: 4 },
    followRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
    followNum: { color: c.text.secondary, fontSize: 12, fontWeight: '700' },
    followLabel: { color: c.text.muted, fontSize: 12 },
    followDot: { color: c.text.muted, fontSize: 12 },
    editPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
      backgroundColor: c.bg.subtle,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border.default, marginTop: 2,
    },
    editPillText: { color: c.text.muted, fontSize: 12, fontWeight: '600' },
    scoreCol: { alignItems: 'center', justifyContent: 'center' },
    creatorCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, gap: 14 },

    // ── Action Buttons ────────────────────────────────────────
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 14,
      paddingTop: 10,
      gap: 8,
      backgroundColor: c.bg.primary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border.subtle,
    },

    // Profil bearbeiten — Outline, breiter
    btnEdit: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.bg.elevated,
      borderWidth: 1,
      borderColor: c.border.default,
    },
    btnEditText: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.1,
    },

    // Teilen — gleiches Outline-Design, etwas schmaler
    btnAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.bg.elevated,
      borderWidth: 1,
      borderColor: c.border.default,
    },
    btnActionText: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.1,
    },

    // Coins — Gold-Akzent
    btnCoins: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(251,191,36,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(251,191,36,0.35)',
    },
    btnCoinsText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#B45309',   // Amber-700 — lesbar auf gold
    },

    // Legacy (werden nicht mehr genutzt, sicherheitshalber drin)
    btnPrimary: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: c.accent.solid,
    },
    btnPrimaryText: { color: c.text.onAccent, fontSize: 14, fontWeight: '600' },
    btnSecondary: {
      width: 40, height: 40, borderRadius: 10,
      backgroundColor: c.bg.subtle, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border.default, alignItems: 'center', justifyContent: 'center',
    },

    // ── Metrics Row ────────────────────────────────────────────
    metricsRow: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 12,
      borderRadius: 16,
      backgroundColor: c.bg.primary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border.default,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    },
    metricDivider: { width: StyleSheet.hairlineWidth, backgroundColor: c.border.subtle, marginVertical: 14 },
    kachel: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
    kachelIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    kachelValue: { color: c.text.primary, fontSize: 15, fontWeight: '600', letterSpacing: -0.3 },
    kachelLabel: { color: c.text.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },

    // ── Tab Bar ───────────────────────────────────────────────
    tabRow: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border.subtle,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border.subtle,
      marginBottom: GRID_GAP,
      backgroundColor: surface,
    },
    tabBtn: {
      gap: 6, minWidth: 82, paddingHorizontal: 12,
      // Breite kommt inline aus TAB_WIDTH (scrollbare Leiste) — kein flex:1 mehr,
      // da flex in einer horizontalen ScrollView zu 0 kollabieren würde.
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabLabel: { color: c.text.muted, fontSize: 12, fontWeight: '600' },

    // ── Grid ──────────────────────────────────────────────────
    gridCell: { width: GRID_CELL_WIDTH, marginBottom: GRID_GAP },
    cell: { width: '100%', aspectRatio: 4 / 5, overflow: 'hidden', backgroundColor: c.bg.secondary, position: 'relative' },
    cellAdd: {
      width: '100%', aspectRatio: 4 / 5, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.bg.primary,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border.subtle,
    },

    cellImg: { width: '100%', height: '100%' },

    // ── Shop-Tab Produkt-Overlays (gespiegelt aus UserProfileContent) ──
    shopSaleBadge: {
      position: 'absolute', top: 6, left: 6,
      backgroundColor: '#EF4444', borderRadius: 5,
      paddingHorizontal: 5, paddingVertical: 2,
    },
    shopSaleBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    shopPricePill: {
      position: 'absolute', left: 6, right: 6, bottom: 6,
      backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8,
      paddingHorizontal: 7, paddingVertical: 4,
    },
    shopPriceText: { color: '#fff', fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
    cellText: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: c.bg.secondary },
    cellCaption: { color: c.text.muted, fontSize: 10, textAlign: 'center', lineHeight: 15 },

    // ── Modal ─────────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', maxWidth: 320, backgroundColor: c.bg.elevated, borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border.default },
    modalTitle: { color: c.text.primary, fontSize: 16, fontWeight: '700', marginBottom: 12, paddingHorizontal: 4 },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10 },
    modalItemText: { color: c.text.primary, fontSize: 15, fontWeight: '600' },
    modalItemDestructive: { marginTop: 4 },
    modalItemTextDestructive: { color: c.accent.danger, fontSize: 15, fontWeight: '600' },

    // ── Empty ─────────────────────────────────────────────────
    empty: { paddingVertical: 56, alignItems: 'center', gap: 8, paddingHorizontal: 40 },
    emptyEmoji: { fontSize: 32, marginBottom: 2 },
    emptyTitle: { color: c.text.secondary, fontSize: 15, fontWeight: '700' },
    emptySub: { color: c.text.muted, fontSize: 13, textAlign: 'center', lineHeight: 18 },

    // ── Analytics Tab ─────────────────────────────────────────
    analyticsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border.subtle,
    },
    analyticsRank: { color: c.text.muted, fontSize: 13, fontWeight: '700', width: 28, textAlign: 'center' },
    analyticsContent: { flex: 1, gap: 6 },
    analyticsCaption: { color: c.text.secondary, fontSize: 13, fontWeight: '500' },
    analyticsBarTrack: { height: 5, borderRadius: 3, backgroundColor: c.bg.subtle, overflow: 'hidden' },
    analyticsBarFill: { height: '100%', borderRadius: 3 },
    analyticsScore: { alignItems: 'center', minWidth: 44 },
    analyticsScoreNum: { color: c.accent.primary, fontSize: 15, fontWeight: '600' },
    analyticsScoreLabel: { color: c.text.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  });
}

// ── Backward-Compat Alias (wird ersetzt wenn Komponenten migriert sind) ────────
// Bleibt bis alle Imports auf getProfileStyles() umgestellt sind.
export const profileStyles = buildStyles(darkColors);
