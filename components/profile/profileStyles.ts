import { StyleSheet, Dimensions } from 'react-native';
import { GRID_GAP, GRID_CELL_WIDTH } from './profileConstants';
import type { ThemeColors } from '@/lib/theme';

const { width: W } = Dimensions.get('window');

// ── Factory — wird in jedem Aufruf von useProfileTheme() gecacht ──────────────
// Damit StyleSheet.create() nur neu ausgeführt wird, wenn sich colors ändert.
const cache = new WeakMap<ThemeColors, ReturnType<typeof buildStyles>>();

export function getProfileStyles(colors: ThemeColors) {
  if (cache.has(colors)) return cache.get(colors)!;
  const s = buildStyles(colors);
  cache.set(colors, s);
  return s;
}

function buildStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg.primary },
    heroBg: { position: 'absolute', top: 0, left: 0, right: 0 },

    // ── Top Navigation Header ─────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: c.bg.secondary,   // weiße Karte im Light-Mode
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
      color: c.text.primary,
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.4,
      marginTop: 1,
    },
    headerRight: { flexDirection: 'row', gap: 6 },
    hBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
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
      backgroundColor: '#F472B6',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
      borderWidth: 1.5,
      borderColor: c.bg.primary,
    },
    hBadgeText: { color: '#fff', fontSize: 7, fontWeight: '800' },

    // ── Profile Top (Avatar + Stats) ─────────────────────────
    profileTop: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 16,
      gap: 20,
      backgroundColor: c.bg.secondary,   // weiße Karte
    },
    avatarWrap: { position: 'relative' },
    avatarRing: {
      width: 92,
      height: 92,
      borderRadius: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarGap: {
      width: 82,
      height: 82,
      borderRadius: 41,
      overflow: 'hidden',
      backgroundColor: c.bg.primary,  // Gap zwischen Ring und Avatar — passt zum Seitenhintergrund
    },
    avatarImg: { width: '100%', height: '100%' },
    avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { color: '#fff', fontSize: 30, fontWeight: '800' },
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
      backgroundColor: c.accent.primary,
      borderWidth: 2,
      borderColor: c.bg.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    storyAddBadgeText: {
      color: c.bg.primary,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 16,
      marginTop: -1,
    },

    // Stats
    statsRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    statItem: { alignItems: 'center', flex: 1 },
    statNum: { color: c.text.primary, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
    statLabel: { color: c.text.muted, fontSize: 11, fontWeight: '500', marginTop: 2 },
    statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: c.border.subtle },

    // ── Bio Section ───────────────────────────────────────────
    bioSection: {
      paddingHorizontal: 20,
      paddingBottom: 14,
      paddingTop: 2,
      gap: 4,
      backgroundColor: c.bg.secondary,   // fortsetzung der weißen Karte
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border.subtle,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    displayName: { color: c.text.primary, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    verifiedBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bio: {
      color: c.text.secondary,
      fontSize: 13,
      lineHeight: 19,
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
      fontSize: 13,
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
    resonanzText: { fontSize: 11, fontWeight: '700' },

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
    followNum: { color: c.text.secondary, fontSize: 11, fontWeight: '700' },
    followLabel: { color: c.text.muted, fontSize: 11 },
    followDot: { color: c.text.muted, fontSize: 11 },
    editPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
      backgroundColor: c.bg.subtle,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border.default, marginTop: 2,
    },
    editPillText: { color: c.text.muted, fontSize: 11, fontWeight: '600' },
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
      backgroundColor: c.bg.secondary,
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
      fontSize: 13,
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
      fontSize: 13,
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
      fontSize: 13,
      fontWeight: '600',
      color: '#B45309',   // Amber-700 — lesbar auf gold
    },

    // Legacy (werden nicht mehr genutzt, sicherheitshalber drin)
    btnPrimary: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 9, borderRadius: 10, backgroundColor: c.accent.primary,
    },
    btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
      backgroundColor: c.bg.secondary,
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
    kachelValue: { color: c.text.primary, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
    kachelLabel: { color: c.text.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },

    // ── Tab Bar ───────────────────────────────────────────────
    tabRow: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border.subtle,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border.subtle,
      marginBottom: GRID_GAP,
      backgroundColor: c.bg.secondary,
    },
    tabBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabBtnActive: { borderBottomColor: c.accent.primary },
    tabLabel: { color: c.text.muted, fontSize: 12, fontWeight: '600' },

    // ── Grid ──────────────────────────────────────────────────
    gridCell: { width: GRID_CELL_WIDTH, marginBottom: GRID_GAP },
    cell: { width: '100%', aspectRatio: 4 / 5, overflow: 'hidden', backgroundColor: c.bg.secondary, position: 'relative' },
    cellAdd: {
      width: '100%', aspectRatio: 4 / 5, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.bg.secondary,
      borderWidth: StyleSheet.hairlineWidth, borderColor: c.border.subtle,
    },

    cellImg: { width: '100%', height: '100%' },
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
    analyticsScoreNum: { color: c.accent.primary, fontSize: 15, fontWeight: '800' },
    analyticsScoreLabel: { color: c.text.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  });
}

// ── Backward-Compat Alias (wird ersetzt wenn Komponenten migriert sind) ────────
// Bleibt bis alle Imports auf getProfileStyles() umgestellt sind.
export const profileStyles = buildStyles({
  bg: { primary: '#050508', secondary: '#0D0D0D', elevated: '#1A1A1A', input: '#111111', subtle: 'rgba(255,255,255,0.04)' },
  text: { primary: '#FFFFFF', secondary: '#9CA3AF', muted: '#4B5563', inverse: '#FFFFFF' },
  accent: { primary: '#FFFFFF', secondary: '#A855F7', danger: '#EF4444', success: '#22C55E', warning: '#F59E0B', gold: '#FBBF24' },
  border: { default: 'rgba(255,255,255,0.08)', subtle: 'rgba(255,255,255,0.04)', strong: 'rgba(255,255,255,0.16)' },
  icon: { default: '#9CA3AF', muted: '#4B5563', active: '#FFFFFF', inactive: '#6B7280' },
  tabBar: { bg: '#050508', border: 'rgba(255,255,255,0.06)', active: '#FFFFFF', inactive: '#6B7280' },
});
