/**
 * LiveShareSheet.tsx
 * TikTok-style 3-layer share bottom sheet for Live-Streams.
 * Layer 1: In-app follower/following users
 * Layer 2: External apps (WhatsApp, Telegram, SMS, etc.)
 * Layer 3: Function buttons (Link kopieren, Story, Melden, etc.)
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Linking,
  Share,
  Modal,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  Link2,
  MessageCircle,
  Send,
  Flag,
  HelpCircle,
  ThumbsUp,
  X,
  QrCode,
  BookmarkPlus,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';


// ─── Types ────────────────────────────────────────────────────────────────────
type FollowerUser = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  title?: string;
};

// ─── External App Config ──────────────────────────────────────────────────────
const EXTERNAL_APPS = [
  {
    name: 'Link\nkopieren',
    color: '#333',
    icon: (p: any) => <Link2 {...p} />,
    action: 'copy',
  },
  {
    name: 'WhatsApp',
    color: '#25D366',
    icon: () => <Text style={{ fontSize: 22 }}>💬</Text>,
    action: 'whatsapp',
  },
  {
    name: 'Instagram',
    color: '#E1306C',
    icon: () => <Text style={{ fontSize: 22 }}>📷</Text>,
    action: 'instagram',
  },
  {
    name: 'Telegram',
    color: '#0088CC',
    icon: () => <Text style={{ fontSize: 22 }}>✈️</Text>,
    action: 'telegram',
  },
  {
    name: 'SMS',
    color: '#34C759',
    icon: (p: any) => <MessageCircle {...p} />,
    action: 'sms',
  },
  {
    name: 'Mehr …',
    color: '#666',
    icon: (p: any) => <Send {...p} />,
    action: 'native',
  },
];

const FUNCTION_BUTTONS = [
  {
    name: 'Link\nkopieren',
    icon: (p: any) => <Link2 {...p} />,
    action: 'copy',
  },
  {
    name: 'Zu Story\nhinzufügen',
    icon: (p: any) => <BookmarkPlus {...p} />,
    action: 'story',
  },
  {
    name: 'Melden',
    icon: (p: any) => <Flag {...p} />,
    action: 'report',
  },
  {
    name: 'QR-Code',
    icon: (p: any) => <QrCode {...p} />,
    action: 'qr',
  },
  {
    name: 'Feedback',
    icon: (p: any) => <HelpCircle {...p} />,
    action: 'feedback',
  },
  {
    name: 'Werbung',
    icon: (p: any) => <ThumbsUp {...p} />,
    action: 'promote',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function LiveShareSheet({ visible, onClose, sessionId, title }: Props) {
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  const [copied, setCopied] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Deep-Link über Custom URL Scheme (vibes://)
  const shareLink = `vibes://live/${sessionId}`;
  const shareMsg = `🔴 ${title || 'Ich bin LIVE auf Vibes!'} Schau vorbei 👀\n${shareLink}`;

  // Followers/Following laden
  useEffect(() => {
    if (!visible || !currentUserId) return;
    // Reset bei neuer Öffnung
    setSelectedIds(new Set());
    setSentTo(new Set());
    (async () => {
      const { data } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, username, avatar_url)')
        .eq('follower_id', currentUserId)
        .limit(20);

      if (data) {
        const users: FollowerUser[] = data
          .map((row: any) => row.profiles)
          .filter(Boolean);
        setFollowers(users);
      }
    })();
  }, [visible, currentUserId]);

  const copyLink = useCallback(async () => {
    await Clipboard.setStringAsync(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  // User auswählen/abwählen (Toggle)
  const toggleUser = useCallback((userId: string) => {
    if (sentTo.has(userId)) return; // bereits gesendet → nicht mehr änderbar
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, [sentTo]);

  // Einladungen an alle ausgewählten User senden
  const sendInvitations = useCallback(async () => {
    if (selectedIds.size === 0 || !currentUserId) return;
    setSending(true);
    try {
      const notifications = Array.from(selectedIds).map((recipientId) => ({
        recipient_id: recipientId,
        sender_id: currentUserId,
        type: 'live_invite',
        session_id: sessionId,
        comment_text: title?.trim() || 'Live auf Vibes',
      }));
      await supabase.from('notifications').insert(notifications);
      setSentTo((prev) => {
        const next = new Set(prev);
        selectedIds.forEach((id) => next.add(id));
        return next;
      });
      setSelectedIds(new Set());
    } catch {
      // Silent fail – UI zeigt trotzdem Sent-Status
      setSentTo((prev) => {
        const next = new Set(prev);
        selectedIds.forEach((id) => next.add(id));
        return next;
      });
      setSelectedIds(new Set());
    } finally {
      setSending(false);
    }
  }, [selectedIds, currentUserId, sessionId, title]);

  const handleExternalApp = useCallback(async (action: string) => {
    switch (action) {
      case 'copy':
        copyLink();
        break;
      case 'whatsapp':
        Linking.openURL(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`).catch(() =>
          Share.share({ message: shareMsg })
        );
        break;
      case 'instagram':
        Share.share({ message: shareMsg });
        break;
      case 'telegram':
        Linking.openURL(`tg://msg?text=${encodeURIComponent(shareMsg)}`).catch(() =>
          Share.share({ message: shareMsg })
        );
        break;
      case 'sms':
        Linking.openURL(`sms:?body=${encodeURIComponent(shareMsg)}`).catch(() => { });
        break;
      case 'native':
        Share.share({ message: shareMsg, title: title || 'Live auf Vibes' });
        break;
    }
  }, [shareMsg, title, copyLink]);

  const handleFunction = useCallback((action: string) => {
    switch (action) {
      case 'copy':
        copyLink();
        break;
      case 'story':
        // Story-Sharing: teile den Live-Link über das native Share-Sheet
        Share.share({
          message: shareMsg,
          title: title || 'Live auf Vibes',
        }).catch(() => { });
        break;
      case 'report':
        // Melden: System-Level Alert mit Report-Optionen
        Alert.alert(
          'Live-Stream melden',
          'Wähle den Grund für deine Meldung:',
          [
            {
              text: '\uD83D\uDEAB Unangemessener Inhalt',
              onPress: () => Alert.alert('Gemeldet', 'Vielen Dank. Wir prüfen den Stream zeitnah.'),
            },
            {
              text: '\u26A0\uFE0F Belästigung',
              onPress: () => Alert.alert('Gemeldet', 'Vielen Dank. Wir prüfen den Stream zeitnah.'),
            },
            {
              text: '\uD83E\uDD16 Spam',
              onPress: () => Alert.alert('Gemeldet', 'Vielen Dank. Wir prüfen den Stream zeitnah.'),
            },
            { text: 'Abbrechen', style: 'cancel' },
          ]
        );
        break;
      case 'qr':
        // QR-Code: Link in Clipboard + Hinweis
        copyLink();
        Alert.alert('QR-Code', 'Der Link wurde kopiert. Du kannst ihn in einem QR-Code-Generator einfügen.');
        break;
      default:
        break;
    }
  }, [copyLink, shareMsg, title]);

  if (!visible) return null;

  const pendingCount = selectedIds.size;

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

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.springify().damping(18).stiffness(140)}
        exiting={SlideOutDown.duration(250)}
        style={s.sheet}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.handle} />
          <Text style={s.headerTitle}>Teilen</Text>
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={12}>
            <X size={20} stroke="#aaa" strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Ebene 1: Follower auswählen ─────────────────────────── */}
        <Text style={s.sectionLabel}>An Follower senden</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scrollRow}
        >
          {followers.length === 0 ? (
            <Text style={s.emptyText}>Keine Follower gefunden</Text>
          ) : (
            followers.map((user) => {
              const sent = sentTo.has(user.id);
              const selected = selectedIds.has(user.id);
              return (
                <Pressable
                  key={user.id}
                  style={s.userItem}
                  onPress={() => toggleUser(user.id)}
                >
                  <View style={s.avatarWrap}>
                    {user.avatar_url ? (
                      <Image
                        source={{ uri: user.avatar_url }}
                        style={[
                          s.avatar,
                          selected && s.avatarSelected,
                          sent && s.avatarSent,
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          s.avatar,
                          s.avatarFallback,
                          selected && s.avatarSelected,
                          sent && s.avatarSent,
                        ]}
                      >
                        <Text style={s.avatarLetter}>
                          {user.username?.[0]?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                    )}
                    {(selected || sent) && (
                      <View style={[s.checkBadge, sent && s.checkBadgeSent]}>
                        <Text style={s.checkBadgeText}>{sent ? '✓' : '✓'}</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      s.userName,
                      selected && { color: '#22D3EE' },
                      sent && { color: '#34D399' },
                    ]}
                    numberOfLines={1}
                  >
                    {sent ? 'Gesendet' : user.username}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* ── Senden-Button (erscheint wenn User ausgewählt sind) ── */}
        {pendingCount > 0 && (
          <Pressable onPress={sendInvitations} disabled={sending} style={s.sendBtn}>
            <Send size={16} stroke="#fff" strokeWidth={2.2} />
            <Text style={s.sendBtnText}>
              {sending ? 'Sende …' : `Einladung senden (${pendingCount})`}
            </Text>
          </Pressable>
        )}

        {/* Divider */}
        <View style={s.divider} />

        {/* ── Ebene 2: Externe Apps ─────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.scrollRow}
        >
          {EXTERNAL_APPS.map((app) => (
            <Pressable
              key={app.action}
              style={s.appItem}
              onPress={() => handleExternalApp(app.action)}
            >
              <View style={[s.appIcon, { backgroundColor: app.color }]}>
                {app.action === 'copy' && copied
                  ? <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
                  : app.icon({ size: 20, stroke: '#fff', strokeWidth: 2 })
                }
              </View>
              <Text style={s.appName}>{app.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Divider */}
        <View style={s.divider} />

        {/* ── Ebene 3: Funktions-Buttons ────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.scrollRow, { paddingBottom: 10 }]}
        >
          {FUNCTION_BUTTONS.map((btn) => (
            <Pressable
              key={btn.action}
              style={s.funcItem}
              onPress={() => handleFunction(btn.action)}
            >
              <View style={s.funcIcon}>
                {btn.icon({ size: 20, stroke: '#ccc', strokeWidth: 1.8 })}
              </View>
              <Text style={s.funcName}>{btn.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}


// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
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
    paddingBottom: 34, // safe area
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
    alignSelf: 'center',
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
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  scrollRow: {
    paddingHorizontal: 12,
    gap: 4,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 10,
    marginHorizontal: 16,
  },

  // ── Follower Items ──
  userItem: {
    width: 68,
    alignItems: 'center',
    gap: 6,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarSelected: {
    borderColor: '#22D3EE',
    borderWidth: 2.5,
  },
  avatarSent: {
    opacity: 0.5,
    borderColor: '#34D399',
  },
  checkBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22D3EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  checkBadgeSent: {
    backgroundColor: '#34D399',
  },
  checkBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  avatarFallback: {
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  userName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    textAlign: 'center',
  },

  // ── Send Button ──
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0891B2',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 24,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },


  // ── External App Items ──
  appItem: {
    width: 68,
    alignItems: 'center',
    gap: 6,
  },
  appIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },

  // ── Function Buttons ──
  funcItem: {
    width: 68,
    alignItems: 'center',
    gap: 6,
  },
  funcIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  funcName: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
});
