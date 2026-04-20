import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/lib/theme';

export const getGuildStyles = (c: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: c.bg.primary,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: c.text.muted,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 280,
  },
  loadingOverlay: {
    alignItems: 'center',
    paddingTop: 16,
  },
  list: {
    paddingBottom: 100,
    gap: 16,
  },
  listEmpty: {
    flex: 1,
  },

  toggleWrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 4,
    backgroundColor: c.bg.elevated,
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: c.border.default,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  toggleBtnActive: {
    backgroundColor: c.bg.subtle,
  },
  toggleBtnActiveGold: {
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  toggleText: {
    color: c.text.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: c.text.primary,
    fontWeight: '700',
  },
  toggleTextGold: {
    color: '#FBBF24',
    fontWeight: '700',
  },

  storiesWrap: {
    marginBottom: 4,
  },
  storiesDivider: {
    height: 1,
    backgroundColor: c.border.subtle,
    marginHorizontal: 16,
    marginBottom: 8,
  },

  guildHeader: {
    marginBottom: 8,
    borderRadius: 0,
    overflow: 'hidden',
  },
  guildHeaderBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
    overflow: 'hidden',
    backgroundColor: c.bg.secondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border.subtle,
  },
  guildHeaderIcon: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  guildIconGradient: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guildHeaderLabel: {
    color: c.text.muted,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  guildHeaderName: {
    color: c.text.primary,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  memberCountBadge: {
    marginLeft: 'auto',
    backgroundColor: c.bg.elevated,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  memberCountText: {
    color: c.text.muted,
    fontSize: 11,
  },

  card: {
    marginHorizontal: 0,
    marginBottom: 0,
    overflow: 'hidden',
    backgroundColor: c.bg.secondary,
  },
  cardBlur: {
    backgroundColor: c.bg.secondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border.default,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  avatarWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  username: {
    color: c.text.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    color: c.text.muted,
    fontSize: 11,
  },
  guildBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  guildBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  caption: {
    color: c.text.secondary,
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
  mediaWrap: {
    overflow: 'hidden',
    marginBottom: 0,
    width: '100%',
    aspectRatio: 4 / 5,
    maxHeight: 560,
    backgroundColor: c.bg.elevated,
  },
  mediaWrapNoMedia: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
  },
  captionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  captionUser: {
    color: c.text.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  tag: {
    backgroundColor: c.bg.elevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border.subtle,
  },
  tagText: {
    color: c.text.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 10,
  },
  actionCount: {
    color: c.text.muted,
    fontSize: 14,
    fontWeight: '600',
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
    marginTop: 80,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: c.text.primary,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: c.text.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Legacy-Alias — damit alter Import-Code nicht bricht
});

/** @deprecated use getGuildStyles(colors) */
export const guildStyles = getGuildStyles({
  bg: { primary: '#050508', secondary: '#0D0D0D', elevated: '#1A1A1A', input: '#111', subtle: 'rgba(255,255,255,0.04)' },
  text: { primary: '#FFFFFF', secondary: '#9CA3AF', muted: '#4B5563', inverse: '#FFFFFF' },
  accent: { primary: '#FFFFFF', secondary: '#A855F7', danger: '#EF4444', success: '#22C55E', warning: '#F59E0B', gold: '#FBBF24' },
  border: { default: 'rgba(255,255,255,0.08)', subtle: 'rgba(255,255,255,0.04)', strong: 'rgba(255,255,255,0.16)' },
  icon: { default: '#9CA3AF', muted: '#4B5563', active: '#FFFFFF', inactive: '#6B7280' },
  tabBar: { bg: '#050508', border: 'rgba(255,255,255,0.06)', active: '#FFFFFF', inactive: '#6B7280' },
});
