/**
 * components/ui/StoryViewersSheet.tsx
 * Bottom Sheet das die Viewer-Liste einer eigenen Story anzeigt.
 * Öffnet sich über den "Augen"-Button in der eigenen Story-Ansicht.
 */
import { Modal, View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { X, Eye } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useStoryViewers, type StoryViewerEntry } from '@/lib/useStoryViews';

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

type Props = {
  visible: boolean;
  storyId: string | null;
  onClose: () => void;
  onNavigateToProfile: () => void; // Schließt den StoryViewer auch
};

export function StoryViewersSheet({ visible, storyId, onClose, onNavigateToProfile }: Props) {
  const insets = useSafeAreaInsets();
  const { data: viewers = [], isLoading } = useStoryViewers(storyId, visible && !!storyId);

  const handlePressUser = (userId: string) => {
    onClose();
    onNavigateToProfile();
    router.push({ pathname: '/user/[id]', params: { id: userId } });
  };

  const renderItem = ({ item }: { item: StoryViewerEntry }) => {
    const username = item.profiles?.username ?? 'Nutzer';
    const avatar = item.profiles?.avatar_url;
    const initial = username[0]?.toUpperCase() ?? '?';

    return (
      <Pressable
        style={sv.row}
        onPress={() => handlePressUser(item.user_id)}
        accessibilityRole="button"
        accessibilityLabel={`Profil von @${username} öffnen`}
      >
        {/* Avatar */}
        {avatar ? (
          <Image source={{ uri: avatar }} style={sv.avatar} contentFit="cover" />
        ) : (
          <View style={[sv.avatar, sv.avatarFallback]}>
            <Text style={sv.avatarText}>{initial}</Text>
          </View>
        )}

        {/* Name + Zeit */}
        <View style={sv.textWrap}>
          <Text style={sv.username}>@{username}</Text>
          <Text style={sv.time}>{formatTimeAgo(item.viewed_at)}</Text>
        </View>

        {/* Eye icon */}
        <Eye size={16} color="rgba(255,255,255,0.25)" strokeWidth={1.6} />
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={sv.overlay} onPress={onClose}>
        <Pressable style={[sv.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={(e) => e.stopPropagation()}>
          {/* Handle */}
          <View style={sv.handle} />

          {/* Header */}
          <View style={sv.header}>
            <Eye size={18} color="#FFFFFF" strokeWidth={1.8} />
            <Text style={sv.title}>
              {isLoading ? 'Lädt…' : `${viewers.length} ${viewers.length === 1 ? 'Aufrufer' : 'Aufrufe'}`}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} style={sv.closeBtn}>
              <X size={18} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            </Pressable>
          </View>

          {/* Liste */}
          {isLoading ? (
            <View style={sv.loadingWrap}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : viewers.length === 0 ? (
            <View style={sv.emptyWrap}>
              <Text style={sv.emptyIcon}>👀</Text>
              <Text style={sv.emptyText}>Noch keine Aufrufe</Text>
              <Text style={sv.emptyHint}>Sei gespannt!</Text>
            </View>
          ) : (
            <FlatList
              data={viewers}
              keyExtractor={(item) => item.user_id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              style={sv.list}
              ItemSeparatorComponent={() => <View style={sv.separator} />}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const sv = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111118',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
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
    marginBottom: 8,
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
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' },
  emptyHint: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  textWrap: { flex: 1 },
  username: { color: '#fff', fontSize: 14, fontWeight: '700' },
  time: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 },
});
