import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { exploreStyles as styles } from './exploreStyles';
import type { ExploreUserResult } from '@/lib/useExplore';
import { useFollow } from '@/lib/useFollow';

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

  // Kompakte vertikale Karte für horizontales Scrollen (Discover-Sektion)
  if (compact) {
    return (
      <Pressable
        style={compactStyles.card}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
      >
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={compactStyles.avatar} />
        ) : (
          <View style={[compactStyles.avatar, compactStyles.avatarFallback]}>
            <Text style={compactStyles.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={compactStyles.username} numberOfLines={1}>@{user.username}</Text>
        {reasonLabel && (
          <Text style={compactStyles.reason} numberOfLines={1}>{reasonLabel}</Text>
        )}
        {!isOwnProfile && (
          <Pressable
            onPress={(e) => { e.stopPropagation(); toggle(); }}
            disabled={isLoading}
            style={[
              compactStyles.followBtn,
              isFollowing && compactStyles.followBtnActive,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#22D3EE" />
            ) : (
              <Text style={[
                compactStyles.followBtnText,
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
            borderColor: isFollowing ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.25)',
            backgroundColor: isFollowing ? 'rgba(34,211,238,0.1)' : 'transparent',
          }}
          hitSlop={6}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#22D3EE" />
          ) : (
            <Text style={{
              color: isFollowing ? '#22D3EE' : 'rgba(255,255,255,0.8)',
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
    backgroundColor: 'rgba(34,211,238,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#22D3EE',
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
    borderColor: 'rgba(34,211,238,0.4)',
    backgroundColor: 'rgba(34,211,238,0.1)',
  },
  followBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: '#22D3EE',
  },
});
