/**
 * PostLongPressSheet.tsx
 * Premium bottom sheet that appears on long-press of a post.
 * Groups actions into three sections: Quick Actions, Social, Safety.
 */
import { setStringAsync as clipboardSetString } from 'expo-clipboard';
import { useI18n } from '@/lib/i18n';
import { webPostUrl } from '@/lib/webLinks';
import {
Bookmark,
Download,
EyeOff,
Flag,
Heart,
Link2,
MessageCircle,
Share2,
User,
UserCheck,
UserPlus,
X,
} from 'lucide-react-native';
import { useCallback } from 'react';
import {
Alert,
Modal,
Pressable,
ScrollView,
Share,
StyleSheet,
Text,
View
} from 'react-native';
import {
FadeIn,
FadeOut,
SlideInDown,
SlideOutDown,
} from 'react-native-reanimated';

import { useBookmark } from '@/lib/useBookmark';
import { useLike } from '@/lib/useLike';
import { useReport } from '@/lib/useReport';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };

type Props = {
  visible: boolean;
  onClose: () => void;
  postId: string;
  mediaUrl?: string | null;
  authorId: string | null | undefined;
  authorName: string;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onToggleFollow: () => void;
  onOpenComments: () => void;
  onOpenShare: () => void;
};

// ── Action Row Item ──────────────────────────────────────────────────────────
function ActionRow({
  icon: Icon,
  label,
  sublabel,
  color = '#fff',
  bg = 'rgba(255,255,255,0.07)',
  onPress,
  rightBadge,
}: {
  icon: any;
  label: string;
  sublabel?: string;
  color?: string;
  bg?: string;
  onPress: () => void;
  rightBadge?: string;
}) {
  // Safety guard: never crash if an icon is undefined
  if (!Icon) return null;
  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={s.iconBox}>
        <Icon size={22} color={color} strokeWidth={1.9} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.rowLabel, { color }]}>{label}</Text>
        {sublabel ? <Text style={s.rowSub}>{sublabel}</Text> : null}
      </View>
      {rightBadge ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{rightBadge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── Quick Action Pill (top row) ───────────────────────────────────────────────
function QuickPill({
  icon: Icon,
  label,
  active,
  activeColor,
  onPress,
}: {
  icon: any;
  label: string;
  active?: boolean;
  activeColor?: string;
  onPress: () => void;
}) {
  // Safety guard: never crash if an icon is undefined
  if (!Icon) return null;
  const color = active ? (activeColor ?? '#FFFFFF') : 'rgba(255,255,255,0.75)';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.pill, active && s.pillActive, pressed && { opacity: 0.75 }]}
    >
      <Icon size={18} color={color} strokeWidth={active ? 2.5 : 1.8} />
      <Text style={[s.pillLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PostLongPressSheet({
  visible,
  onClose,
  postId,
  mediaUrl,
  authorId,
  authorName,
  isFollowing,
  isOwnProfile,
  onToggleFollow,
  onOpenComments,
  onOpenShare,
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const { liked, toggle: toggleLike } = useLike(postId);
  const { bookmarked, toggle: toggleBookmark } = useBookmark(postId);
  const { mutate: report } = useReport();

  const postLink = webPostUrl(postId);

  const handleDownload = useCallback(async () => {
    if (!mediaUrl) {
      Alert.alert(t('share.noMediaTitle'), t('share.noMediaText'));
      return;
    }
    onClose();
    try {
      // Native Share-Sheet — iOS: "In Fotos sichern" erscheint direkt, Android: Speichern möglich
      await Share.share({ url: mediaUrl, title: 'Vibes Post' });
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert(t('create.oops'), e?.message ?? t('share.failGeneric'));
      }
    }
  }, [mediaUrl, onClose]);

  const copyLink = useCallback(async () => {
    await clipboardSetString(postLink);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
    Alert.alert(t('share.linkCopiedCheck'), '');
  }, [postLink, onClose]);

  const visitProfile = useCallback(() => {
    if (!authorId) return;
    onClose();
    setTimeout(() => router.push({ pathname: '/user/[id]', params: { id: authorId } }), 80);
  }, [authorId, onClose, router]);

  const handleReport = useCallback(() => {
    onClose();
    setTimeout(() => {
      Alert.alert(t('share.report'), t('share.chooseReason'), [
        {
          text: t('share.reasonSpam'),
          onPress: () => { report({ postId, reason: 'report' }); Alert.alert(t('share.thanks'), t('share.reported')); },
        },
        {
          text: t('share.reasonInappropriate'),
          onPress: () => { report({ postId, reason: 'report' }); Alert.alert(t('share.thanks'), t('share.reported')); },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }, 100);
  }, [onClose, postId, report]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(160)}
        exiting={SlideOutDown.duration(220)}
        style={s.sheet}
      >
        {/* Handle + close */}
        <View style={s.header}>
          <View style={s.handle} />
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={12}>
            <X size={18} stroke="rgba(255,255,255,0.45)" strokeWidth={2} />
          </Pressable>
        </View>

        {/* ── Schnelle Pills (Like / Kommentar / Speichern / Teilen) ── */}
        <View style={s.pillRow}>
          <QuickPill
            icon={Heart}
            label={liked ? 'Geliked' : 'Liken'}
            active={liked}
            activeColor="#F472B6"
            onPress={() => { toggleLike(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
          />
          <QuickPill
            icon={MessageCircle}
            label="Kommentar"
            onPress={() => { onClose(); setTimeout(onOpenComments, 80); }}
          />
          <QuickPill
            icon={Bookmark}
            label={bookmarked ? 'Gespeichert' : 'Speichern'}
            active={bookmarked}
            activeColor="#FFFFFF"
            onPress={() => { toggleBookmark(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          />
          <QuickPill
            icon={Share2}
            label="Teilen"
            onPress={() => { onClose(); setTimeout(onOpenShare, 80); }}
          />
        </View>

        <View style={s.divider} />

        <ScrollView scrollEnabled={false}>
          {/* ── Sozial ── */}
          <Text style={s.sectionLabel}>Sozial</Text>
          <ActionRow
            icon={User}
            label={`@${authorName} besuchen`}
            sublabel="Profil & alle Posts ansehen"
            onPress={visitProfile}
          />
          {!isOwnProfile && (
            <ActionRow
              icon={isFollowing ? UserCheck : UserPlus}
              label={isFollowing ? `@${authorName} entfolgen` : `@${authorName} folgen`}
              sublabel={isFollowing ? 'Aus deinem Netzwerk entfernen' : 'Netzwerk erweitern'}
              onPress={() => { onToggleFollow(); onClose(); }}
            />
          )}

          <View style={s.divider} />

          {/* ── Post-Aktionen ── */}
          <Text style={s.sectionLabel}>Post</Text>
          <ActionRow
            icon={Link2}
            label="Link kopieren"
            sublabel="In die Zwischenablage"
            onPress={copyLink}
          />
          <ActionRow
            icon={Download}
            label="Herunterladen"
            sublabel="Video / Bild auf dein Gerät"
            onPress={handleDownload}
          />

          {!isOwnProfile && (
            <>
              <View style={s.divider} />
              <Text style={s.sectionLabel}>Sicherheit</Text>
              <ActionRow
                icon={EyeOff}
                label="Kein Interesse"
                sublabel="Weniger solchen Content zeigen"
                onPress={() => {
                  report({ postId, reason: 'not_interested' });
                  onClose();
                  Alert.alert(t('share.lessTitle'), t('share.feedAdjusted'));
                }}
              />
              <ActionRow
                icon={Flag}
                label="Melden"
                sublabel="Spam oder unangemessenen Inhalt"
                color="#f87171"
                onPress={handleReport}
              />
            </>
          )}
        </ScrollView>

        <View style={{ height: 28 }} />
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111118',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Quick Pills ──
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  pillActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // ── Section ──
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 6,
    marginHorizontal: 16,
  },

  // ── Action Row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#fff' },
  rowSub: { fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 15 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
});
