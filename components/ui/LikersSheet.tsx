/**
 * components/ui/LikersSheet.tsx
 * Bottom Sheet mit Liste aller User die einen Post geliked haben.
 * Wird per Tap auf die Like-Zahl geöffnet.
 */
import { Modal, View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { X, Heart } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { usePostLikers, type LikerProfile } from '@/lib/usePostLikers';
import { useFollow } from '@/lib/useFollow';
import { useAuthStore } from '@/lib/authStore';
import * as Haptics from 'expo-haptics';

// ─── User-Row mit Follow-Button ───────────────────────────────────────────────
function LikerRow({ liker, onClose }: { liker: LikerProfile; onClose: () => void }) {
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const username = liker.profiles?.username ?? 'Nutzer';
  const avatar = liker.profiles?.avatar_url;
  const initial = username[0]?.toUpperCase() ?? '?';
  const isOwn = liker.user_id === currentUserId;

  const { isFollowing, toggle } = useFollow(isOwn ? null : liker.user_id);

  const handlePress = () => {
    onClose();
    router.push({ pathname: '/user/[id]', params: { id: liker.user_id } });
  };

  return (
    <Pressable
      style={ls.row}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Profil von @${username} öffnen`}
    >
      {/* Avatar */}
      {avatar ? (
        <Image source={{ uri: avatar }} style={ls.avatar} contentFit="cover" />
      ) : (
        <View style={[ls.avatar, ls.avatarFallback]}>
          <Text style={ls.avatarText}>{initial}</Text>
        </View>
      )}

      {/* Name + Bio */}
      <View style={ls.textWrap}>
        <Text style={ls.username}>@{username}</Text>
        {liker.profiles?.bio ? (
          <Text style={ls.bio} numberOfLines={1}>{liker.profiles.bio}</Text>
        ) : null}
      </View>

      {/* Follow-Button (nicht für eigenes Profil) */}
      {!isOwn && (
        <Pressable
          style={[ls.followBtn, isFollowing && ls.followBtnActive]}
          onPress={(e) => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toggle();
          }}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? 'Entfolgen' : 'Folgen'}
        >
          <Text style={[ls.followBtnText, isFollowing && ls.followBtnTextActive]}>
            {isFollowing ? 'Gefolgt' : 'Folgen'}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
type Props = {
  visible: boolean;
  postId: string | null;
  onClose: () => void;
};

export function LikersSheet({ visible, postId, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { data: likers = [], isLoading } = usePostLikers(postId, visible && !!postId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={ls.overlay} onPress={onClose}>
        <Pressable style={[ls.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={ls.handle} />

          {/* Header */}
          <View style={ls.header}>
            <Heart size={18} color="#EE1D52" fill="#EE1D52" strokeWidth={1.8} />
            <Text style={ls.title}>
              {isLoading ? 'Lädt…' : `${likers.length} ${likers.length === 1 ? 'Like' : 'Likes'}`}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} style={ls.closeBtn}>
              <X size={18} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            </Pressable>
          </View>

          {/* Liste */}
          {isLoading ? (
            <View style={ls.loadingWrap}>
              <ActivityIndicator color="#EE1D52" />
            </View>
          ) : likers.length === 0 ? (
            <View style={ls.emptyWrap}>
              <Text style={ls.emptyIcon}>🤍</Text>
              <Text style={ls.emptyText}>Noch keine Likes</Text>
            </View>
          ) : (
            <FlatList
              data={likers}
              keyExtractor={(item) => item.user_id}
              renderItem={({ item }) => <LikerRow liker={item} onClose={onClose} />}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              style={ls.list}
              ItemSeparatorComponent={() => <View style={ls.separator} />}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ls = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    minHeight: 200,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 4,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyWrap: { paddingVertical: 48, alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  list: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.06)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(238,29,82,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#EE1D52', fontSize: 16, fontWeight: '800' },
  textWrap: { flex: 1 },
  username: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bio: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#22D3EE',
    backgroundColor: 'transparent',
  },
  followBtnActive: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  followBtnText: { color: '#22D3EE', fontSize: 12, fontWeight: '700' },
  followBtnTextActive: { color: 'rgba(255,255,255,0.5)' },
});
