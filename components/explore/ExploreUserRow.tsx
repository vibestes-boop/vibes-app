import { View, Text, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { UserCircle } from 'lucide-react-native';
import { exploreStyles as styles } from './exploreStyles';
import type { ExploreUserResult } from '@/lib/useExplore';

export function ExploreUserRow({ user }: { user: ExploreUserResult }) {
  const initials = user.username?.[0]?.toUpperCase() ?? '?';
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
          <Text style={styles.userBio} numberOfLines={1}>
            {user.bio}
          </Text>
        ) : null}
      </View>
      <UserCircle size={18} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
    </Pressable>
  );
}
