/**
 * ViewerListSheet.tsx
 * TikTok-style multi-layer viewer system:
 * 1. Viewer List (bottom sheet with all viewers)
 * 2. User Profile Mini-Sheet (opens on top when viewer is tapped)
 * 3. Report Flow (flag icon → select what to report)
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,

  Image,
  Modal,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  X,
  Flag,
  AtSign,
  UserPlus,
  UserCheck,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useFollow } from '@/lib/useFollow';

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewerUser = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  /** Callback: fügt @username in Kommentar-Input ein */
  onMention?: (username: string) => void;
};

// ─── Report-Optionen ──────────────────────────────────────────────────────────
const REPORT_REASONS = [
  { key: 'name', label: 'Unangemessener Name' },
  { key: 'photo', label: 'Unangemessenes Profilbild' },
  { key: 'spam', label: 'Spam / Werbung' },
  { key: 'hate', label: 'Hassrede / Belästigung' },
  { key: 'impersonation', label: 'Identitätsdiebstahl' },
  { key: 'other', label: 'Anderer Grund' },
];

// ─── User Profile Mini-Sheet ──────────────────────────────────────────────────
function UserProfileSheet({
  user,
  visible,
  onClose,
  onMention,
}: {
  user: ViewerUser;
  visible: boolean;
  onClose: () => void;
  onMention?: (username: string) => void;
}) {
  const { isFollowing, toggle, isLoading, isOwnProfile } = useFollow(user.id);
  const [showReport, setShowReport] = useState(false);

  const handleReport = (reason: string) => {
    setShowReport(false);
    // Fire & forget: Report in DB speichern
    const { profile } = useAuthStore.getState();
    if (!profile) return;
    supabase
      .from('reports')
      .insert({
        reporter_id: profile.id,
        reported_user_id: user.id,
        reason,
      })
      .then();
    Alert.alert('Gemeldet', 'Deine Meldung wurde eingereicht. Danke!');
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
        style={s.profileBackdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Profile Card */}
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(160)}
        exiting={SlideOutDown.duration(200)}
        style={s.profileSheet}
      >
        {/* Header mit Melden-Fahne */}
        <View style={s.profileHeader}>
          <View style={s.profileHandle} />
          <Pressable onPress={() => setShowReport(true)} style={s.flagBtn} hitSlop={12}>
            <Flag size={18} stroke="#888" strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={onClose} style={s.profileCloseBtn} hitSlop={12}>
            <X size={18} stroke="#aaa" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Avatar + Name */}
        <View style={s.profileInfo}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={s.profileAvatar} />
          ) : (
            <View style={[s.profileAvatar, s.profileAvatarFallback]}>
              <Text style={s.profileAvatarLetter}>
                {user.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <Text style={s.profileUsername}>@{user.username}</Text>
          {user.bio ? (
            <Text style={s.profileBio} numberOfLines={2}>
              {user.bio}
            </Text>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={s.profileActions}>
          {/* Follow/Unfollow */}
          {!isOwnProfile && (
            <Pressable
              style={[s.profileActionBtn, isFollowing && s.profileActionBtnActive]}
              onPress={toggle}
              disabled={isLoading}
            >
              {isFollowing ? (
                <>
                  <UserCheck size={16} stroke="#22D3EE" strokeWidth={2} />
                  <Text style={[s.profileActionText, s.profileActionTextActive]}>
                    Folge ich
                  </Text>
                </>
              ) : (
                <>
                  <UserPlus size={16} stroke="#fff" strokeWidth={2} />
                  <Text style={s.profileActionText}>Folgen</Text>
                </>
              )}
            </Pressable>
          )}

          {/* @ Mention */}
          {onMention && (
            <Pressable
              style={s.profileActionBtn}
              onPress={() => {
                onMention(user.username);
                onClose();
              }}
            >
              <AtSign size={16} stroke="#fff" strokeWidth={2} />
              <Text style={s.profileActionText}>Erwähnen</Text>
            </Pressable>
          )}
        </View>

        {/* Report Options (stacked) */}
        {showReport && (
          <Animated.View entering={FadeIn.duration(150)} style={s.reportOverlay}>
            <Text style={s.reportTitle}>Was möchtest du melden?</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable
                key={r.key}
                style={s.reportOption}
                onPress={() => handleReport(r.key)}
              >
                <Text style={s.reportOptionText}>{r.label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={s.reportCancel}
              onPress={() => setShowReport(false)}
            >
              <Text style={s.reportCancelText}>Abbrechen</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Main Viewer List Sheet ───────────────────────────────────────────────────
export default function ViewerListSheet({ visible, onClose, sessionId, onMention }: Props) {
  const [viewers, setViewers] = useState<ViewerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ViewerUser | null>(null);

  // Zuschauer laden (alle die in der letzten Minute reaktionen/kommentare hatten + session viewer)
  useEffect(() => {
    if (!visible) return;
    setLoading(true);

    (async () => {
      // Aktive Kommentatoren als "Viewers" nehmen (bessere Datenquelle als LiveKit participants)
      const { data: commentUsers } = await supabase
        .from('live_comments')
        .select('user_id, profiles!live_comments_user_id_fkey(id, username, avatar_url, bio)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (commentUsers) {
        const seen = new Set<string>();
        const uniqueViewers: ViewerUser[] = [];
        for (const row of commentUsers) {
          const p = row.profiles as unknown as ViewerUser;
          if (p && !seen.has(p.id)) {
            seen.add(p.id);
            uniqueViewers.push(p);
          }
        }
        setViewers(uniqueViewers);
      }
      setLoading(false);
    })();
  }, [visible, sessionId]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={s.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Viewer List Sheet */}
      <Animated.View
        entering={SlideInDown.springify().damping(18).stiffness(140)}
        exiting={SlideOutDown.duration(250)}
        style={s.sheet}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.handle} />
          <Text style={s.headerTitle}>Zuschauer</Text>
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={12}>
            <X size={20} stroke="#aaa" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Viewer Count */}
        <Text style={s.viewerCountLabel}>
          {viewers.length} {viewers.length === 1 ? 'Zuschauer' : 'Zuschauer'}
        </Text>

        {/* List */}
        {loading ? (
          <ActivityIndicator color="#22D3EE" style={{ paddingVertical: 40 }} />
        ) : viewers.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>👀</Text>
            <Text style={s.emptyText}>Noch keine Zuschauer</Text>
          </View>
        ) : (
          <FlatList
            data={viewers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 34 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                style={s.viewerRow}
                onPress={() => setSelectedUser(item)}
              >
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={s.viewerAvatar} />
                ) : (
                  <View style={[s.viewerAvatar, s.viewerAvatarFallback]}>
                    <Text style={s.viewerAvatarLetter}>
                      {item.username?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
                <View style={s.viewerInfo}>
                  <Text style={s.viewerName}>@{item.username}</Text>
                  {item.bio ? (
                    <Text style={s.viewerBio} numberOfLines={1}>
                      {item.bio}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        )}
      </Animated.View>

      {/* User Profile Mini-Sheet (stacked on top) */}
      {selectedUser && (
        <UserProfileSheet
          user={selectedUser}
          visible={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          onMention={onMention}
        />
      )}
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // ── Main Sheet ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  handle: {
    position: 'absolute',
    top: 8,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCountLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyEmoji: { fontSize: 36 },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },

  // ── Viewer Row ──
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(34,211,238,0.3)',
  },
  viewerAvatarFallback: {
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerAvatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  viewerInfo: {
    flex: 1,
    gap: 2,
  },
  viewerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  viewerBio: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },

  // ── User Profile Mini-Sheet ──
  profileBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  profileSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#222',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  profileHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -18,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  flagBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Profile Content ──
  profileInfo: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.4)',
  },
  profileAvatarFallback: {
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarLetter: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  profileUsername: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  profileBio: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ── Action Buttons ──
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  profileActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0891B2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  profileActionBtnActive: {
    backgroundColor: 'rgba(34,211,238,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.4)',
  },
  profileActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  profileActionTextActive: {
    color: '#22D3EE',
  },

  // ── Report Overlay ──
  reportOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: '#222',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  reportTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  reportOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  reportOptionText: {
    color: '#fff',
    fontSize: 15,
  },
  reportCancel: {
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  reportCancelText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
