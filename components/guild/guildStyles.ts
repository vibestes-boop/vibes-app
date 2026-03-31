import { StyleSheet } from 'react-native';
import { GUILD_SCREEN_WIDTH } from './guildConstants';

export const guildStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050508',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#6B7280',
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  toggleBtnActiveGold: {
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  toggleText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    color: '#9CA3AF',
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  guildHeaderName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  memberCountBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  memberCountText: {
    color: '#9CA3AF',
    fontSize: 11,
  },

  card: {
    // Full-width edge-to-edge (Instagram style)
    marginHorizontal: 0,
    marginBottom: 2,
    overflow: 'hidden',
  },
  cardBlur: {
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
    color: '#F9FAFB',
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
    color: '#6B7280',
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
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
  mediaWrap: {
    // Full display width, no radius (Instagram style)
    overflow: 'hidden',
    marginBottom: 0,
    // 4:5 portrait ratio = Instagram standard (1080×1350)
    height: GUILD_SCREEN_WIDTH * 1.25,
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
    color: '#F9FAFB',
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    color: '#0891B2',
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
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
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
