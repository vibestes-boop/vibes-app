import { View, Text, Modal, Pressable, Alert, Share } from 'react-native';
import {
  SlidersHorizontal,
  UserPlus,
  UserCheck,
  EyeOff,
  Flag,
  Share2,
  Download,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useReport } from '@/lib/useReport';
import { useSaveVideo } from '@/lib/useSaveVideo';
import { postOptionsModalStyles as pos } from './feedStyles';

export function PostOptionsModal({
  visible,
  postId,
  isFollowing,
  isOwnProfile,
  authorName,
  mediaType,
  mediaUrl,
  onToggleFollow,
  onOpenTune,
  onClose,
}: {
  visible: boolean;
  postId: string;
  isFollowing: boolean;
  isOwnProfile: boolean;
  authorName: string;
  mediaType?: string;
  mediaUrl?: string;
  onToggleFollow: () => void;
  onOpenTune: () => void;
  onClose: () => void;
}) {
  const handleShare = async () => {
    onClose();
    try {
      await Share.share({
        message: `Schau dir diesen Vibe an! 🎬\nhttps://vibes-web-nine.vercel.app/post/${postId}`,
        title: `Vibe von @${authorName}`,
      });
    } catch { /* User cancelled */ }
  };
  const { saveVideo, isSaving } = useSaveVideo();
  const OPTIONS = [
    {
      id: 'tune',
      label: 'Tune my Vibe',
      sub: 'Passe deinen Feed-Algorithmus an',
      icon: SlidersHorizontal,
      color: '#FFFFFF',
      bg: 'rgba(255,255,255,0.08)',
    },
    ...(!isOwnProfile
      ? [
        {
          id: 'follow',
          label: isFollowing ? `@${authorName} entfolgen` : `@${authorName} folgen`,
          sub: isFollowing ? 'Aus deinem Netzwerk entfernen' : 'Zu deinem Netzwerk hinzufügen',
          icon: isFollowing ? UserCheck : UserPlus,
          color: isFollowing ? '#4ade80' : '#60a5fa',
          bg: isFollowing ? 'rgba(74,222,128,0.1)' : 'rgba(96,165,250,0.1)',
        },
      ]
      : []),
    {
      id: 'notinterested',
      label: 'Kein Interesse',
      sub: 'Weniger von diesem Content zeigen',
      icon: EyeOff,
      color: '#9CA3AF',
      bg: 'rgba(255,255,255,0.06)',
    },
    {
      id: 'share',
      label: 'Teilen',
      sub: 'Per WhatsApp, iMessage oder Link teilen',
      icon: Share2,
      color: '#4ade80',
      bg: 'rgba(74,222,128,0.08)',
    },
    ...(mediaType === 'video' && mediaUrl ? [{
      id: 'save',
      label: isSaving ? 'Wird gespeichert…' : 'In Galerie speichern',
      sub: 'Video lokal auf dein Gerät herunterladen',
      icon: Download,
      color: '#818CF8',
      bg: 'rgba(129,140,248,0.1)',
    }] : []),
    {
      id: 'report',
      label: 'Melden',
      sub: 'Verstoß oder Spam melden',
      icon: Flag,
      color: '#f87171',
      bg: 'rgba(248,113,113,0.1)',
    },
  ];

  const { mutate: reportPost } = useReport();

  const handlePress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    switch (id) {
      case 'tune':
        onClose();
        setTimeout(onOpenTune, 80);
        break;
      case 'follow':
        onClose();
        onToggleFollow();
        break;
      case 'share':
        handleShare();
        break;
      case 'save':
        if (mediaUrl) saveVideo(mediaUrl);
        break;
      case 'notinterested':
        onClose();
        reportPost({ postId, reason: 'not_interested' });
        Alert.alert('Verstanden', 'Wir zeigen dir weniger von diesem Content.');
        break;
      case 'report':
        onClose();
        Alert.alert('Melden', 'Wähle einen Grund:', [
          {
            text: 'Spam',
            onPress: () => {
              reportPost({ postId, reason: 'report' });
              Alert.alert('Danke', 'Der Post wurde gemeldet.');
            },
          },
          {
            text: 'Unangemessener Inhalt',
            onPress: () => {
              reportPost({ postId, reason: 'report' });
              Alert.alert('Danke', 'Der Post wurde gemeldet.');
            },
          },
          { text: 'Abbrechen', style: 'cancel' },
        ]);
        break;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={pos.overlay} onPress={onClose}>
        <Pressable style={pos.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={pos.handle} />
          <Text style={pos.title}>Optionen</Text>

          {OPTIONS.map((opt) => {
            const IconComp = opt.icon;
            return (
              <Pressable key={opt.id} style={pos.row} onPress={() => handlePress(opt.id)}>
                <View style={[pos.iconWrap, { backgroundColor: opt.bg }]}>
                  <IconComp size={20} color={opt.color} strokeWidth={1.8} />
                </View>
                <View style={pos.textWrap}>
                  <Text style={[pos.rowLabel, { color: opt.id === 'report' ? '#f87171' : '#fff' }]}>{opt.label}</Text>
                  <Text style={pos.rowSub}>{opt.sub}</Text>
                </View>
              </Pressable>
            );
          })}

          <Pressable style={pos.cancelBtn} onPress={onClose}>
            <Text style={pos.cancelText}>Abbrechen</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
