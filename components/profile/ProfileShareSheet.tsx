/**
 * components/profile/ProfileShareSheet.tsx
 * TikTok-Style Share Sheet für Benutzerprofile
 *
 * Layer 1: Follower-Liste (In-App DM)
 * Layer 2: Apps (WhatsApp, Telegram, Link kopieren, …)
 * Layer 3: Aktionen (Melden, Sperren, QR-Code, Nachricht)
 */
import { useState } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView,
  TextInput, Share, Clipboard, Alert,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Search, X, Copy, Share2, Check, Flag, UserX, QrCode, Send } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useOrCreateConversation, useSendMessage } from '@/lib/useMessages';
import { router } from 'expo-router';

// ─── Typen ────────────────────────────────────────────────────────────────────
type ShareTarget = { id: string; username: string | null; avatar_url: string | null };

interface Props {
  visible:    boolean;
  onClose:    () => void;
  userId:     string;
  username:   string | null;
  avatarUrl?: string | null;
  /** true wenn es das eigene Profil ist — versteckt Melden/Sperren */
  isOwnProfile?: boolean;
}

// ─── App-Optionen ─────────────────────────────────────────────────────────────
const APP_OPTIONS = [
  { id: 'copy',     label: 'Link\nkopieren',  Emoji: '🔗', color: '#374151' },
  { id: 'whatsapp', label: 'WhatsApp',        Emoji: '💬', color: '#25D366' },
  { id: 'telegram', label: 'Telegram',        Emoji: '✈️', color: '#2CA5E0' },
  { id: 'sms',      label: 'SMS',             Emoji: '💬', color: '#4CAF50' },
  { id: 'more',     label: 'Mehr…',           Emoji: '⋯',  color: '#6B7280' },
];

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export function ProfileShareSheet({ visible, onClose, userId, username, avatarUrl, isOwnProfile }: Props) {
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied]   = useState(false);
  const [sending, setSending] = useState(false);

  const { mutateAsync: getOrCreateConv } = useOrCreateConversation();
  const { mutateAsync: sendMsg }         = useSendMessage();

  // Follower/Following laden für "Senden an"
  const { data: users = [] } = useQuery<ShareTarget[]>({
    queryKey: ['profile-share-users', currentUserId],
    enabled: visible && !!currentUserId,
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, username, avatar_url)')
        .eq('follower_id', currentUserId)
        .limit(40);
      return ((data ?? [])
        .map((d: any) => d.profiles)
        .filter(Boolean)) as ShareTarget[];
    },
  });

  const profileUrl = `serlo://user/${userId}`;
  const profileText = username
    ? `Schau dir @${username} auf Serlo an!\n${profileUrl}`
    : `Schau dir dieses Profil auf Serlo an!\n${profileUrl}`;

  const filtered = users.filter((u) =>
    !search || u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAppOption = async (id: string) => {
    onClose();
    if (id === 'copy') {
      Clipboard.setString(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    if (id === 'whatsapp') {
      const url = `whatsapp://send?text=${encodeURIComponent(profileText)}`;
      const { Linking } = await import('react-native');
      Linking.openURL(url).catch(() => Share.share({ message: profileText }));
      return;
    }
    if (id === 'telegram') {
      const url = `tg://msg?text=${encodeURIComponent(profileText)}`;
      const { Linking } = await import('react-native');
      Linking.openURL(url).catch(() => Share.share({ message: profileText }));
      return;
    }
    // Mehr / SMS / Fallback → natives Sheet
    Share.share({ message: profileText });
  };

  const handleSend = async () => {
    if (!currentUserId || selected.size === 0) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Promise.all(
        Array.from(selected).map(async (targetId) => {
          const conversationId = await getOrCreateConv(targetId);
          await sendMsg({ conversationId, content: profileText });
        })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch {
      Alert.alert('Fehler', 'Profil konnte nicht gesendet werden.');
    }
    setSending(false);
  };

  const handleDM = async () => {
    onClose();
    try {
      // messages/[id] erwartet conversationId, nicht userId
      const conversationId = await getOrCreateConv(userId);
      router.push({ pathname: '/messages/[id]', params: { id: conversationId, otherUserId: userId, username: username ?? '' } } as any);
    } catch {
      Alert.alert('Fehler', 'Konversation konnte nicht geöffnet werden.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ss.backdrop} onPress={onClose}>
        <Pressable style={ss.sheet} onPress={() => {}}>

          {/* ── Handle ── */}
          <View style={ss.handle} />

          {/* ── Header ── */}
          <View style={ss.header}>
            <View style={ss.headerProfile}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={ss.headerAvatar} contentFit="cover" />
              ) : (
                <View style={[ss.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
              )}
              <View>
                <Text style={ss.headerTitle}>Senden an</Text>
                {username && <Text style={ss.headerSub}>@{username}</Text>}
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={ss.closeBtn}>
              <X size={20} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>

          {/* ── Suche ── */}
          <View style={ss.searchBar}>
            <Search size={15} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={ss.searchInput}
              placeholder="Suchen…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>

          {/* ── User-Liste (In-App) ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={ss.userRow}
          >
            {filtered.map((u) => {
              const isSelected = selected.has(u.id);
              return (
                <Pressable key={u.id} style={ss.userItem} onPress={() => toggleSelect(u.id)}>
                  <View style={[ss.userAvatarWrap, isSelected && ss.userAvatarSelected]}>
                    {u.avatar_url ? (
                      <Image source={{ uri: u.avatar_url }} style={ss.userAvatar} contentFit="cover" />
                    ) : (
                      <View style={[ss.userAvatar, ss.userAvatarFallback]}>
                        <Text style={ss.userInitial}>{(u.username ?? '?')[0].toUpperCase()}</Text>
                      </View>
                    )}
                    {isSelected && (
                      <View style={ss.checkBadge}>
                        <Check size={12} color="#000" strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text style={ss.userName} numberOfLines={1}>
                    {u.username ?? 'User'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* ── Senden-Button wenn ausgewählt ── */}
          {selected.size > 0 && (
            <Pressable
              style={({ pressed }) => [ss.sendBtn, pressed && { opacity: 0.8 }]}
              onPress={handleSend}
              disabled={sending}
            >
              {sending
                ? <ActivityIndicator color="#000" size="small" />
                : <>
                    <Send size={16} color="#000" strokeWidth={2.5} />
                    <Text style={ss.sendBtnText}>
                      Senden{selected.size > 1 ? ` (${selected.size})` : ''}
                    </Text>
                  </>
              }
            </Pressable>
          )}

          {/* ── Apps ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={ss.appRow}
          >
            {APP_OPTIONS.map((app) => (
              <Pressable key={app.id} style={ss.appItem} onPress={() => handleAppOption(app.id)}>
                <View style={[ss.appIcon, { backgroundColor: app.id === 'copy' && copied ? '#22C55E' : app.color }]}>
                  {app.id === 'copy' && copied
                    ? <Check size={24} color="#fff" strokeWidth={2.5} />
                    : <Text style={ss.appEmoji}>{app.Emoji}</Text>
                  }
                </View>
                <Text style={ss.appLabel}>{app.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* ── Trennlinie ── */}
          <View style={ss.divider} />

          {/* ── Aktionen ── */}
          <View style={ss.actions}>
            {!isOwnProfile && (
              <Pressable style={ss.actionRow} onPress={handleDM}>
                <View style={ss.actionIcon}><Send size={18} color="#fff" strokeWidth={1.8} /></View>
                <Text style={ss.actionLabel}>Nachricht senden</Text>
              </Pressable>
            )}

            <Pressable
              style={ss.actionRow}
              onPress={() => {
                onClose();
                Share.share({ message: `${profileUrl}\nQR: serlo://qr/${userId}` });
              }}
            >
              <View style={ss.actionIcon}><QrCode size={18} color="#fff" strokeWidth={1.8} /></View>
              <Text style={ss.actionLabel}>QR-Code</Text>
            </Pressable>

            {!isOwnProfile && (
              <>
                <Pressable
                  style={ss.actionRow}
                  onPress={() => {
                    onClose();
                    Alert.alert('Melden', `@${username ?? 'User'} melden?`, [
                      { text: 'Abbrechen', style: 'cancel' },
                      { text: 'Melden', style: 'destructive', onPress: () => {} },
                    ]);
                  }}
                >
                  <View style={ss.actionIcon}><Flag size={18} color="#fff" strokeWidth={1.8} /></View>
                  <Text style={ss.actionLabel}>Melden</Text>
                </Pressable>

                <Pressable
                  style={[ss.actionRow, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    onClose();
                    Alert.alert('Sperren', `@${username ?? 'User'} sperren?`, [
                      { text: 'Abbrechen', style: 'cancel' },
                      { text: 'Sperren', style: 'destructive', onPress: () => {} },
                    ]);
                  }}
                >
                  <View style={ss.actionIcon}><UserX size={18} color="#EF4444" strokeWidth={1.8} /></View>
                  <Text style={[ss.actionLabel, { color: '#EF4444' }]}>Sperren</Text>
                </Pressable>
              </>
            )}
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 16,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 14,
  },
  headerProfile: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },
  closeBtn:    { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // Suche
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },

  // User-Zeile
  userRow: { paddingHorizontal: 20, gap: 16, paddingBottom: 4, alignItems: 'flex-start' },
  userItem: { alignItems: 'center', gap: 6, width: 64 },
  userAvatarWrap: { position: 'relative' },
  userAvatarSelected: { opacity: 1 },
  userAvatar: { width: 52, height: 52, borderRadius: 26 },
  userAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  userInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  checkBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0F0F0F',
  },
  userName: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center' },

  // Senden Button
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14,
    marginHorizontal: 20, marginTop: 12, paddingVertical: 12,
  },
  sendBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },

  // App-Icons
  appRow: { paddingHorizontal: 20, gap: 20, paddingVertical: 14 },
  appItem: { alignItems: 'center', gap: 6, width: 64 },
  appIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  appEmoji: { fontSize: 24 },
  appLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, textAlign: 'center', lineHeight: 13 },

  // Divider
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20, marginBottom: 4 },

  // Aktionen
  actions: { paddingHorizontal: 20, marginTop: 4 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
});
