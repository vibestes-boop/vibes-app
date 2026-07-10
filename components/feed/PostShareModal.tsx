import { useAuthStore } from '@/lib/authStore';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { webPostUrl } from '@/lib/webLinks';
import { supabase } from '@/lib/supabase';
import { useOrCreateConversation,useSendMessage } from '@/lib/useMessages';
import { useReport } from '@/lib/useReport';
import { useSaveVideo } from '@/lib/useSaveVideo';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
Check,
Copy,
Download,
EyeOff,
Flag,
Search,
Send,
Share2,
SlidersHorizontal,
Trash2,
UserCheck,
UserPlus,
} from 'lucide-react-native';
import { useAdminRemovePost } from '@/lib/useAdmin';
import { useState,type ElementType } from 'react';
import {
Alert,
Linking,
Modal,
Platform,
Pressable,
ScrollView,
Share,
Text,
TextInput,
View,
} from 'react-native';
import { postShareModalStyles as pss } from './feedStyles';

const POST_APP_OPTIONS: { id: string; label: string; labelKey?: TranslationKey; emoji?: string; icon?: any; color: string }[] = [
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬', color: '#25D366' },
  { id: 'telegram', label: 'Telegram', emoji: '✈️', color: '#2CA5E0' },
  { id: 'copy', label: 'Link', labelKey: 'sheet.link', icon: Copy, color: '#6366f1' },
  { id: 'more', label: 'Mehr', labelKey: 'sheet.more', icon: Share2, color: '#374151' },
];

type ShareTarget = { id: string; username: string | null; avatar_url: string | null };

export function PostShareModal({
  visible,
  postId,
  postCaption,
  postAuthor,
  isFollowing,
  isOwnProfile,
  onToggleFollow,
  onClose,
  onOpenTune,
  mediaType,
  mediaUrl,
}: {
  visible: boolean;
  postId: string;
  postCaption?: string;
  postAuthor: string;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
  // Optional: "Tune my Vibe" (nur im Feed sinnvoll — Algorithmus anpassen)
  onOpenTune?: () => void;
  // Optional: echtes Video-Speichern in die Galerie (statt Stub)
  mediaType?: string;
  mediaUrl?: string;
}) {
  const { t } = useI18n();
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const isAdmin = useAuthStore((s) => s.profile?.is_admin);
  const { mutateAsync: adminRemovePost } = useAdminRemovePost();
  const { saveVideo, isSaving } = useSaveVideo();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const { mutateAsync: getOrCreateConv } = useOrCreateConversation();
  const { mutateAsync: sendMsg } = useSendMessage();

  const { data: users = [] } = useQuery<ShareTarget[]>({
    queryKey: ['share-user-list'],
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .neq('id', currentUserId)
        .order('username')
        .limit(50);
      return (data ?? []) as ShareTarget[];
    },
    enabled: visible && !!currentUserId,
    staleTime: 1000 * 60 * 5,
  });

  const postLink = webPostUrl(postId);
  const filtered = search.trim()
    ? users.filter((u) => u.username?.toLowerCase().includes(search.toLowerCase()))
    : users;

  const toggleUser = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSendToUsers = async () => {
    if (selected.size === 0) return;
    setSending(true);
    try {
      // Content is only a short teaser – the post preview card shows the real media
      const caption = postCaption ? `"${postCaption}"` : 'einen Post';
      await Promise.all(
        Array.from(selected).map(async (uid) => {
          const convId = await getOrCreateConv(uid);
          await sendMsg({
            conversationId: convId,
            content: `📸 ${caption} von @${(postAuthor ?? '').replace(/^@+/, '')}`,
            postId,
          });
        })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelected(new Set());
      setSearch('');
      onClose();
    } catch {
      Alert.alert(t('common.error'), t('share.failPost'));
    } finally {
      setSending(false);
    }
  };

  const handleAppShare = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Kurzer Teaser — die Vorschaukarte zeigt Titel + @user + Thumbnail bereits,
    // der Text muss das NICHT wiederholen (kein "von @user auf Vibes", keine
    // doppelte URL). Der Link steht auf eigener Zeile.
    const teaser = postCaption ? `„${postCaption}"` : t('share.thisVibe');
    const text = t('share.shareTeaser', { teaser });
    switch (id) {
      case 'whatsapp':
        // wa.me erzeugt echten anklickbaren Link
        Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${text}\n${postLink}`)}`).catch(() =>
          Alert.alert(t('share.whatsappMissing'))
        );
        break;
      case 'telegram':
        Linking.openURL(`tg://msg_url?url=${encodeURIComponent(postLink)}&text=${encodeURIComponent(text)}`).catch(() =>
          Alert.alert(t('share.telegramMissing'))
        );
        break;
      case 'copy':
        Alert.alert(t('share.linkCopied'), postLink);
        break;
      case 'more':
        Share.share(
          Platform.OS === 'ios' ? { message: text, url: postLink } : { message: `${text}\n${postLink}` },
          { dialogTitle: t('share.postShareDialog') }
        );
        break;
    }
  };

  const hasSavableVideo = mediaType === 'video' && !!mediaUrl;
  const actionButtons = [
    ...(!isOwnProfile
      ? [
          {
            id: 'follow',
            label: isFollowing ? t('sheet.unfollow') : t('sheet.follow'),
            icon: isFollowing ? UserCheck : UserPlus,
            color: '#FFFFFF',
          },
        ]
      : []),
    ...(onOpenTune
      ? [{ id: 'tune', label: t('sheet.tuneVibe'), icon: SlidersHorizontal, color: '#FFFFFF' }]
      : []),
    // Melden / Kein Interesse ergeben nur bei FREMDEN Posts Sinn.
    ...(!isOwnProfile
      ? [
          { id: 'notinterested', label: t('sheet.notInterested'), icon: EyeOff, color: '#6B7280' },
          { id: 'report', label: t('sheet.report'), icon: Flag, color: '#ef4444' },
        ]
      : []),
    ...(hasSavableVideo
      ? [{ id: 'download', label: isSaving ? t('sheet.saving') : t('sheet.save'), icon: Download, color: '#6B7280' }]
      : []),
    // Admin-only: fremden Post direkt entfernen (protokolliert). Nicht am eigenen Post.
    ...(isAdmin && !isOwnProfile
      ? [{ id: 'adminremove', label: t('sheet.adminRemove'), icon: Trash2, color: '#ef4444' }]
      : []),
  ];

  const { mutate: reportPost } = useReport();

  const handleAction = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    switch (id) {
      case 'follow':
        onToggleFollow();
        break;
      case 'tune':
        setTimeout(() => onOpenTune?.(), 80);
        break;
      case 'notinterested':
        reportPost({ postId, reason: 'not_interested' });
        Alert.alert(t('share.lessTitle'), t('share.lessContent'));
        break;
      case 'report':
        Alert.alert(t('share.report'), t('share.chooseReason'), [
          {
            text: t('share.reasonSpam'),
            onPress: () => {
              reportPost({ postId, reason: 'report' });
              Alert.alert(t('share.thanks'), t('share.reportedPost'));
            },
          },
          {
            text: t('share.reasonInappropriate'),
            onPress: () => {
              reportPost({ postId, reason: 'report' });
              Alert.alert(t('share.thanks'), t('share.reportedPost'));
            },
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]);
        break;
      case 'download':
        if (mediaUrl) saveVideo(mediaUrl);
        break;
      case 'adminremove':
        Alert.alert(
          t('share.adminRemoveTitle'),
          t('share.adminRemoveText'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('share.remove'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await adminRemovePost({ postId });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert(t('share.removedTitle'), t('share.removedText'));
                } catch (e) {
                  Alert.alert(t('share.removeFailedTitle'), e instanceof Error ? e.message : t('share.removeFailedText'));
                }
              },
            },
          ]
        );
        break;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pss.overlay} onPress={onClose}>
        <Pressable style={pss.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={pss.handle} />

          <Text style={pss.sectionLabel}>{t('sheet.sendTo')}</Text>
          <View style={pss.searchRow}>
            <Search size={15} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={pss.searchInput}
              placeholder={t('sheet.search')}
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pss.userScroll} contentContainerStyle={pss.userScrollContent}>
            {filtered.length === 0 ? (
              <Text style={pss.emptyUsers}>{t('sheet.noUsers')}</Text>
            ) : (
              filtered.map((u) => {
                const chosen = selected.has(u.id);
                return (
                  <Pressable key={u.id} style={pss.userItem} onPress={() => toggleUser(u.id)}>
                    <View style={[pss.userAvatarWrap, chosen && pss.userAvatarChosen]}>
                      {u.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={pss.userAvatar} />
                      ) : (
                        <View style={[pss.userAvatar, pss.userAvatarFallback]}>
                          <Text style={pss.userAvatarText}>{(u.username ?? '?')[0].toUpperCase()}</Text>
                        </View>
                      )}
                      {chosen && (
                        <View style={pss.checkBadge}>
                          <Check size={10} color="#fff" strokeWidth={3} />
                        </View>
                      )}
                    </View>
                    <Text style={pss.userLabel} numberOfLines={1}>
                      {u.username ?? '?'}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
          {selected.size > 0 && (
            <Pressable style={[pss.sendBtn, sending && { opacity: 0.5 }]} onPress={handleSendToUsers} disabled={sending}>
              <Send size={16} color="#fff" />
              <Text style={pss.sendBtnText}>{sending ? t('sheet.sending') : t('sheet.sendN', { count: selected.size })}</Text>
            </Pressable>
          )}

          <View style={pss.divider} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pss.appRow}>
            {POST_APP_OPTIONS.map((opt) => {
              const IconComp = (opt as { icon?: ElementType }).icon;
              return (
                <Pressable key={opt.id} style={pss.appItem} onPress={() => handleAppShare(opt.id)}>
                  <View style={[pss.appIcon, { backgroundColor: opt.color }]}>
                    {'emoji' in opt && opt.emoji ? (
                      <Text style={pss.appEmoji}>{opt.emoji}</Text>
                    ) : (
                      IconComp && <IconComp size={22} color="#fff" strokeWidth={1.8} />
                    )}
                  </View>
                  <Text style={pss.appLabel}>{opt.labelKey ? t(opt.labelKey) : opt.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {actionButtons.length > 0 && <View style={pss.divider} />}

          <View style={pss.actionRow}>
            {actionButtons.map((btn) => {
              const IconComp = btn.icon;
              return (
                <Pressable key={btn.id} style={pss.actionItem} onPress={() => handleAction(btn.id)}>
                  <View style={[pss.actionIcon, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
                    <IconComp size={22} color={btn.color} strokeWidth={1.8} />
                  </View>
                  <Text style={pss.actionLabel}>{btn.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
