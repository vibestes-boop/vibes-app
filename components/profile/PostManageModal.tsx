import { Modal, Pressable, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { Pencil, Trash2, BarChart2, Pin, PinOff, Bookmark } from 'lucide-react-native';
import { profileStyles as s } from './profileStyles';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAddHighlight } from '@/lib/useStoryHighlights';
import { HighlightNameSheet } from './HighlightNameSheet';

type PostStats = {
  likes: number;
  comments: number;
  resonanz: number;
};

export function PostManageModal({
  visible, postId, mediaUrl, mediaType = 'video',
  isPinned = false, onClose, onEdit, onDelete, onTogglePin,
}: {
  visible: boolean;
  postId: string;
  mediaUrl?: string;
  mediaType?: string;
  isPinned?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin?: () => void;
}) {
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [highlightSheetVisible, setHighlightSheetVisible] = useState(false);
  const { mutate: addHighlight } = useAddHighlight();

  const handleClose = () => {
    setStatsOpen(false);
    setStats(null);
    onClose();
  };

  // Öffnet den HighlightNameSheet (ohne Alert.prompt — funktioniert auf iOS & Android)
  const handleAddToHighlight = () => {
    onClose(); // PostManageModal schließen
    // Kurze Verzögerung damit der Modal-Close-Anim fertig ist bevor neuer Sheet öffnet
    setTimeout(() => setHighlightSheetVisible(true), 300);
  };

  const handleHighlightConfirm = (title: string) => {
    addHighlight({
      type: 'post',
      postId,
      items: [{
        media_url:     mediaUrl ?? '',
        media_type:    (mediaType === 'video' ? 'video' : 'image') as 'image' | 'video',
        thumbnail_url: null,
      }],
      title,
    });
  };

  const loadStats = async () => {
    setLoadingStats(true);
    setStatsOpen(true);
    const [{ count: likes }, { count: comments }, { data: post }] = await Promise.all([
      supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('posts').select('dwell_time_score').eq('id', postId).single(),
    ]);
    setStats({
      likes: likes ?? 0,
      comments: comments ?? 0,
      resonanz: Math.round(((post as any)?.dwell_time_score ?? 0) * 100),
    });
    setLoadingStats(false);
  };

  return (
    <>
      {/* Haupt-Modal */}
      {visible && (
        <Modal visible={visible} transparent animationType="fade">
          <Pressable style={s.modalOverlay} onPress={handleClose}>
            <Pressable style={s.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={s.modalTitle}>Post verwalten</Text>

              {/* Statistiken */}
              <Pressable style={s.modalItem} onPress={loadStats}>
                <BarChart2 size={18} color="#22D3EE" strokeWidth={2} />
                <Text style={[s.modalItemText, { color: '#22D3EE' }]}>Statistiken</Text>
              </Pressable>

              {statsOpen && (
                <View style={localStyles.statsPanel}>
                  {loadingStats ? (
                    <ActivityIndicator color="#22D3EE" />
                  ) : stats ? (
                    <View style={localStyles.statsGrid}>
                      <View style={localStyles.statCard}>
                        <Text style={localStyles.statVal}>{stats.likes}</Text>
                        <Text style={localStyles.statLabel}>Likes</Text>
                      </View>
                      <View style={localStyles.statDivider} />
                      <View style={localStyles.statCard}>
                        <Text style={localStyles.statVal}>{stats.comments}</Text>
                        <Text style={localStyles.statLabel}>Kommentare</Text>
                      </View>
                      <View style={localStyles.statDivider} />
                      <View style={localStyles.statCard}>
                        <Text style={[localStyles.statVal, { color: '#22D3EE' }]}>{stats.resonanz}%</Text>
                        <Text style={localStyles.statLabel}>Resonanz</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              )}

              <Pressable
                style={s.modalItem}
                onPress={() => { handleClose(); onEdit(); }}
              >
                <Pencil size={18} color="#9CA3AF" strokeWidth={2} />
                <Text style={s.modalItemText}>Bearbeiten</Text>
              </Pressable>

              {onTogglePin && (
                <Pressable
                  style={s.modalItem}
                  onPress={() => { handleClose(); onTogglePin(); }}
                >
                  {isPinned
                    ? <PinOff size={18} color="#FBBF24" strokeWidth={2} />
                    : <Pin    size={18} color="#FBBF24" strokeWidth={2} />}
                  <Text style={[s.modalItemText, { color: '#FBBF24' }]}>
                    {isPinned ? 'Loslösen' : 'Anpinnen'}
                  </Text>
                </Pressable>
              )}

              {/* Zu Highlight — nur wenn mediaUrl vorhanden */}
              {mediaUrl && (
                <Pressable style={s.modalItem} onPress={handleAddToHighlight}>
                  <Bookmark size={18} color="#A78BFA" strokeWidth={2} />
                  <Text style={[s.modalItemText, { color: '#A78BFA' }]}>Zu Highlight</Text>
                </Pressable>
              )}

              <Pressable
                style={[s.modalItem, s.modalItemDestructive]}
                onPress={() => { handleClose(); onDelete(); }}
              >
                <Trash2 size={18} color="#EF4444" strokeWidth={2} />
                <Text style={s.modalItemTextDestructive}>Löschen</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Highlight-Naming Sheet (außerhalb des Haupt-Modals) */}
      <HighlightNameSheet
        visible={highlightSheetVisible}
        mediaUrl={mediaUrl ?? ''}
        mediaType={mediaType ?? 'video'}
        onClose={() => setHighlightSheetVisible(false)}
        onConfirm={handleHighlightConfirm}
      />
    </>
  );
}

const localStyles = StyleSheet.create({
  statsPanel: {
    backgroundColor: 'rgba(34,211,238,0.05)',
    borderRadius: 12,
    marginHorizontal: 4,
    marginBottom: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(34,211,238,0.2)',
  },
  statsGrid:   { flexDirection: 'row', alignItems: 'center' },
  statCard:    { flex: 1, alignItems: 'center', gap: 4 },
  statVal:     { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel:   { color: '#6B7280', fontSize: 11, fontWeight: '600' },
  statDivider: {
    width: StyleSheet.hairlineWidth, height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
