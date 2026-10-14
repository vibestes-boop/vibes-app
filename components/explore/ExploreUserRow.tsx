import type { ExploreUserResult } from '@/lib/useExplore';
import { useFollow } from '@/lib/useFollow';
import { useTheme } from '@/lib/useTheme';
import { useI18n } from '@/lib/i18n';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator,Pressable,StyleSheet,Text,View } from 'react-native';
import { getExploreStyles } from './exploreStyles';

export function ExploreUserRow({
  user,
  reasonLabel,
  compact = false,
}: {
  user: ExploreUserResult & { reason?: string };
  reasonLabel?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const initials = user.username?.[0]?.toUpperCase() ?? '?';
  const { isFollowing, toggle, isLoading, isOwnProfile } = useFollow(user.id);
  const { colors } = useTheme();
  const styles = getExploreStyles(colors);

  // Kompakte vertikale Karte für horizontales Scrollen (Discover-Sektion)
  if (compact) {
    return (
      <Pressable
        style={[compactStyles.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
      >
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={compactStyles.avatar} />
        ) : (
          <View style={[compactStyles.avatar, compactStyles.avatarFallback, { backgroundColor: colors.bg.subtle }]}>
            <Text style={[compactStyles.avatarText, { color: colors.text.secondary }]}>{initials}</Text>
          </View>
        )}
        <Text style={[compactStyles.username, { color: colors.text.primary }]} numberOfLines={1}>@{user.username}</Text>
        {reasonLabel && (
          <Text style={[compactStyles.reason, { color: colors.text.muted }]} numberOfLines={1}>{reasonLabel}</Text>
        )}
        {!isOwnProfile && (
          <Pressable
            onPress={(e) => { e.stopPropagation(); toggle(); }}
            accessibilityRole="button" accessibilityLabel={t(isFollowing ? 'explore.following' : 'explore.follow')}
            disabled={isLoading}
            style={[
              compactStyles.followBtn,
              { borderColor: isFollowing ? colors.accent.primary : colors.border.default },
              isFollowing && { backgroundColor: colors.bg.subtle },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.accent.primary} />
            ) : (
              <Text style={[
                compactStyles.followBtnText,
                { color: isFollowing ? colors.accent.primary : colors.text.secondary },
                isFollowing && { color: colors.accent.primary },
              ]}>
                {isFollowing ? t('explore.following') : t('explore.follow')}
              </Text>
            )}
          </Pressable>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.userRow}
      onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
    >
      {user.avatar_url ? (
        <Image source={{ uri: user.avatar_url }} style={styles.userAvatar} />
      ) : (
        <View style={[styles.userAvatar, styles.userAvatarFallback, { backgroundColor: colors.bg.subtle }]}>
          <Text style={[styles.userAvatarText, { color: colors.text.secondary }]}>{initials}</Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <Text style={styles.userName}>@{user.username}</Text>
        {user.bio ? (
          <Text style={styles.userBio} numberOfLines={1}>{user.bio}</Text>
        ) : null}
      </View>

      {/* Follow-Button — nur für fremde User */}
      {!isOwnProfile && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); toggle(); }}
          accessibilityRole="button" accessibilityLabel={t(isFollowing ? 'explore.following' : 'explore.follow')}
          disabled={isLoading}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            minHeight: 44,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: isFollowing ? colors.accent.primary : colors.border.default,
            backgroundColor: isFollowing ? colors.bg.subtle : 'transparent',
          }}
          hitSlop={6}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accent.primary} />
          ) : (
            <Text style={{
              color: isFollowing ? colors.accent.primary : colors.text.secondary,
              fontSize: 12,
              fontWeight: '700',
            }}>
              {isFollowing ? t('explore.following') : t('explore.follow')}
            </Text>
          )}
        </Pressable>
      )}
    </Pressable>
  );
}

// ── Compact-Card Styles (für Discover-Sektion) ───────────────────────────
const compactStyles = StyleSheet.create({
  card: {
    width: 156,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  username: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  reason: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textAlign: 'center',
  },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    marginTop: 2,
  },
  followBtnActive: {
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  followBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: '#FFFFFF',
  },
});
