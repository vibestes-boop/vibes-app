import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { exploreStyles as styles } from './exploreStyles';
import type { ExploreUserResult } from '@/lib/useExplore';
import { useFollow } from '@/lib/useFollow';
import { useTheme } from '@/lib/useTheme';

export function ExploreUserRow({
  user,
  reasonLabel,
  compact = false,
}: {
  user: ExploreUserResult & { reason?: string };
  reasonLabel?: string;
  compact?: boolean;
}) {
  const initials = user.username?.[0]?.toUpperCase() ?? '?';
  const { isFollowing, toggle, isLoading, isOwnProfile } = useFollow(user.id);
  const { colors } = useTheme();

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
          <View style={[compactStyles.avatar, compactStyles.avatarFallback]}>
            <Text style={compactStyles.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={[compactStyles.username, { color: colors.text.primary }]} numberOfLines={1}>@{user.username}</Text>
        {reasonLabel && (
          <Text style={[compactStyles.reason, { color: colors.text.muted }]} numberOfLines={1}>{reasonLabel}</Text>
        )}
        {!isOwnProfile && (
          <Pressable
            onPress={(e) => { e.stopPropagation(); toggle(); }}
            disabled={isLoading}
            style={[
              compactStyles.followBtn,
              { borderColor: isFollowing ? 'rgba(255,255,255,0.28)' : colors.border.default },
              isFollowing && compactStyles.followBtnActive,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[
                compactStyles.followBtnText,
                { color: isFollowing ? '#FFFFFF' : colors.text.secondary },
                isFollowing && compactStyles.followBtnTextActive,
              ]}>
                {isFollowing ? 'Gefolgt' : '+ Folgen'}
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
        <View style={[styles.userAvatar, styles.userAvatarFallback]}>
          <Text style={styles.userAvatarText}>{initials}</Text>
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
          disabled={isLoading}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: isFollowing ? 'rgba(255,255,255,0.28)' : colors.border.default,
            backgroundColor: isFollowing ? 'rgba(255,255,255,0.08)' : 'transparent',
          }}
          hitSlop={6}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={{
              color: isFollowing ? '#FFFFFF' : colors.text.secondary,
              fontSize: 12,
              fontWeight: '700',
            }}>
              {isFollowing ? 'Gefolgt' : '+ Folgen'}
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
    width: 110,
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
    fontWeight: '800',
  },
  username: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  reason: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    textAlign: 'center',
  },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
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
    fontSize: 11,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: '#FFFFFF',
  },
});
