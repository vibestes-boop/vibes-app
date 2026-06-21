import { StyleSheet } from "react-native";
import { LC } from "@/lib/liveColors";

// Ausgelagert aus app/live/host.tsx (Refactor #2) — reine Style-Definitionen,
// keine Logikaenderung. In host.tsx als `s` importiert.

export const hostStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  // ── Duet / Co-Host Split-Screen (Fix #4) ──────────────────
  // Label-Badge für "HOST" / "GAST" im Duet-Modus
  duetLabelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 2,
  },
  duetLabelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  // v1.22.0: X-Button oben rechts pro Co-Host-Kachel (Host-only).
  // Klein aber gut tappable (hitSlop 10). Zurückhaltender Look: schwarz-
  // transparent mit rotem Tint — Short-Video-parity.
  tileKickBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  // Trennlinien am Rand der Remote-Hälfte
  duetDividerHorizontal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  duetDividerVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  reactionsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingBottom: 120,
    zIndex: 5,
    // pointerEvents ist kein StyleSheet-Property in RN-Typen → als any nötig
    // TODO: pointerEvents als View-Prop herausnehmen (SW-14 Rest)
    pointerEvents: "none",
  } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  reactionBubble: {
    position: "absolute",
    bottom: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionEmoji: { fontSize: 26 },
  floatingHeartWrap: {
    position: 'absolute',
    bottom: 80,
    zIndex: 6,
  },

  topBar: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 20,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    // backgroundColor entfernt — wird durch LinearGradient-Wrapper gesetzt.
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    // dezenter Glow (matcht dem Pink-Gradient)
    shadowColor: "#FF2E63",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#fff" },
  liveLabel: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  titleText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "600" },
  viewerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  viewerCount: { color: "#fff", fontSize: 13, fontWeight: "700" },
  endBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(239,68,68,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Host TopBar (v1.22.0 Short-Video-Style) ──
  hostInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  // v1.22.1 — Short-Video-Parity: Avatar + Meta kompakter (42→32)
  avatarRing: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
    padding: 1,
  },
  hostAvatarLg: {
    width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
  },
  hostAvatarLgFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  hostInitialLg: { color: '#fff', fontWeight: '800', fontSize: 13 },
  hostMeta: { gap: 1 },
  hostUsernameLg: {
    color: '#fff', fontWeight: '700', fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  viewerPillSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  viewerPillText: {
    color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600',
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  guestAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestAvatarMini: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.6)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  guestAvatarMiniImg: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
  },
  guestAvatarMiniInitial: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
  },
  closeTopBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // LEGACY: früher rechter vertikaler Stack. Bleibt als leere Referenz
  // falls noch irgendwo referenziert — jetzt durch topLeftControls + bottomActionPos ersetzt.
  controlsPos: { position: "absolute", right: 14, zIndex: 20 },
  // v1.16.0: flexDirection 'row' damit Mic/Cam/Flip horizontal nebeneinander liegen (oben links).
  controls: { flexDirection: 'row', gap: 8 },
  // Oben links — nur Mic/Cam/Flip-Pills (v1.16.0 UI-Polish)
  topLeftControls: { position: "absolute", left: 14, zIndex: 20, flexDirection: 'row', gap: 8 },
  // Horizontal scrollbare Action-Row direkt über dem Chat-Input
  // Absolut positioniert mit `bottom` inline gesetzt (abhängig von safe-area insets).
  bottomActionPos: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bottomActionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 10,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnOff: { backgroundColor: "rgba(239,68,68,0.25)" },

  /** Kleines Badge auf dem Shield-Button zeigt Anzahl der Host-eigenen Wörter */
  moderationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moderationBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },

  /**  Leaderboard Badge — links, über dem Chat-Bereich  */
  topGifterPos: {
    position: 'absolute',
    left: 12,
    bottom: 120,     // über dem Input-Bereich
    zIndex: 18,
  },

  emojiRow: {
    position: "absolute",
    right: 14,
    gap: 8,
    zIndex: 15,
  },
  emojiBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: { fontSize: 22 },

  commentsArea: {
    left: 0,
    right: 0,
    maxHeight: 280,
    // v1.16.0 UI-Polish: marginBottom reserviert die Höhe der absolut
    // positionierten Action-Row (bottomActionPos) — so überdeckt der Button-
    // Overlay nicht die letzten Chat-Messages.
    marginBottom: 52,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  // ── Short-Video Comment Style: Avatar links, Name oben, Text darunter ──
  commentRow: {
    marginBottom: 10,
    alignSelf: 'flex-start',
    maxWidth: '82%',
  },
  commentInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',   // Avatar oben ausrichten
    gap: 9,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  commentAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: { color: '#fff', fontSize: 15, fontWeight: '800' },
  // Vertikaler Stack: Name + Kommentar
  commentStack: {
    flexShrink: 1,
    flexDirection: 'column',
    gap: 1,
  },
  commentPill: {}, // leer, nur für Rückwärtskompatibilität
  commentTextWrap: {},
  commentUser: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  /* v1.23 — Chat-Row Badges */
  commentUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  commentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  commentBadgeHost:   { backgroundColor: `${LC.accent.rose}E6` },    // Rose — Host
  commentBadgeMod:    { backgroundColor: 'rgba(59,130,246,0.9)' },  // Blue    — Mod
  commentBadgeGifter: { backgroundColor: 'rgba(250,204,21,0.9)' },  // Gold    — Top Gifter
  commentBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  commentText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  systemText: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontStyle: 'italic' },

  emojiPickerRow: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(20,20,30,0.92)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 10,
    zIndex: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 20,
  },

  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: '#fff',
    fontSize: 14,
  },
  sendBtn: { padding: 4, flexShrink: 0 },
  bottomEmojiBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bottomEmojiText: { fontSize: 18 },

  // ── Live-End Summary ──
  summaryScreen: {
    flex: 1,
    backgroundColor: '#0D0D18',
  },
  summaryTopBar: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  summaryDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  summaryHeadline: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  summarySeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  summaryStatsCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 14,
  },
  summaryStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryStatItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  summaryStatNum: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  summaryStatLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  summaryLeaderCard: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 10,
    marginBottom: 14,
  },
  summaryLeaderTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryLeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryLeaderRank: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '700',
    width: 22,
  },
  summaryLeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  summaryLeaderAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLeaderName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryLeaderCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  summaryActionsWrap: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 32,
  },
  summaryActionPrimary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  summaryActionPrimaryText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  summaryActionSecondary: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  summaryActionSecondaryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  summaryDoneBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  summaryDoneBtnText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    fontWeight: '600',
  },
  // Legacy styles (unused but kept for type safety)
  summaryBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  summaryCard: { backgroundColor: '#0f0f1a', borderRadius: 24, padding: 24, width: '100%', gap: 16 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  summaryDuration: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  summaryLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  summaryDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', width: '100%' },
  summaryActions: { gap: 10, width: '100%' },
  summaryActionBtn: { paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', minHeight: 48 },
  summaryActionBtnDone: { backgroundColor: 'rgba(255,255,255,0.08)' },
  summaryActionText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '600' },
  summaryActionTextDone: { color: '#FFFFFF' },
  summaryBtnEnd: { paddingVertical: 14, alignItems: 'center' },
  summaryBtnEndText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: '600' },
  // Legacy (wird noch genutzt):
  summaryBtn: {
    backgroundColor: "#CCCCCC",
    borderRadius: 14,
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  summaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  // Pinned Comment Banner
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderLeftWidth: 3,
    borderLeftColor: '#FFFFFF',
    borderRadius: 10,
    marginHorizontal: 8,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  pinnedLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginRight: 4 },
  pinnedUser: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  pinnedText: { color: '#fff', fontSize: 12 },
  pinnedUnpin: { color: 'rgba(255,255,255,0.5)', fontSize: 16, paddingLeft: 4 },

  // Like-Counter Badge
  likeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,45,85,0.18)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.35)',
  },
  likeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // HD-Badge
  hdBadge: {
    position: 'absolute',
    top: 0,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 5,
  },
  hdBadgeText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});
