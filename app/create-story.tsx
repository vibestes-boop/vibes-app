import { darkColors } from '@/lib/theme';
import { useIsFocused } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthStore } from '@/lib/authStore';
import { useI18n } from '@/lib/i18n';
import { generateAndUploadThumbnail,uploadPostMedia } from '@/lib/uploadMedia';
import { useCreateStory,type StoryPoll } from '@/lib/useStories';
import { Image } from 'expo-image';
import {
launchImageLibraryAsync,
requestMediaLibraryPermissionsAsync,
} from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams,useRouter } from 'expo-router';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { ArrowLeft,BarChart2,ImagePlus,Send,X } from 'lucide-react-native';
import { useCallback,useEffect,useRef,useState } from 'react';
import {
ActivityIndicator,
Alert,
KeyboardAvoidingView,
Platform,
Pressable,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateStoryScreen() {
  useThemedStatusBar('light');
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const { mutateAsync: createStory } = useCreateStory();

  // Optional von außen (z.B. Text-Modus) ein fertiges Bild durchreichen → Picker überspringen
  const params = useLocalSearchParams<{ mediaUri?: string; mediaType?: string; mediaMimeType?: string }>();
  const [mediaUri, setMediaUri] = useState<string | null>(params.mediaUri ?? null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>(params.mediaType === 'video' ? 'video' : 'image');
  const [mediaMimeType, setMediaMimeType] = useState<string | null>(params.mediaMimeType || null);
  const [uploading, setUploading] = useState(false);
  const publishingRef = useRef(false);
  const focused = useIsFocused();
  const videoPlayer = useVideoPlayer(mediaType === 'video' ? mediaUri : null, player => { player.loop = true; });
  useEffect(() => {
    if (focused && mediaType === 'video') videoPlayer.play();
    else videoPlayer.pause();
  }, [focused, mediaType, videoPlayer]);

  // ── Poll-State ────────────────────────────────────────────────────────────────
  const [pollActive, setPollActive] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOption0, setPollOption0] = useState(t('story.yes'));
  const [pollOption1, setPollOption1] = useState(t('story.no'));

  // ── Bild aus Galerie auswählen ──────────────────────────────────────────────
  const pickMedia = useCallback(async () => {
    const { status } = await requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('story.permTitle'), t('story.permPhotos'));
      return;
    }
    const result = await launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'] as any,
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 15,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.type === 'video' ? 'video' : 'image');
      setMediaMimeType(asset.mimeType ?? null);
    }
  }, [t]);

  // ── Upload + Story erstellen ────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!mediaUri || !profile || publishingRef.current) return;
    publishingRef.current = true;
    setUploading(true);
    try {
      const mimeType = mediaMimeType ?? (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
      const { url: publicUrl } = await uploadPostMedia(profile.id, mediaUri, mimeType);

      // Für Videos: Thumbnail aus erstem Frame generieren
      let thumbnailUrl: string | null = null;
      if (mediaType === 'video') {
        thumbnailUrl = await generateAndUploadThumbnail(profile.id, mediaUri);
      }

      // Poll nur hinzufügen wenn Frage ausgefüllt
      const interactive: StoryPoll | null =
        pollActive && pollQuestion.trim()
          ? {
            type: 'poll',
            question: pollQuestion.trim(),
            options: [
              pollOption0.trim() || t('story.option1'),
              pollOption1.trim() || t('story.option2'),
            ],
          }
          : null;

      await createStory({ mediaUrl: publicUrl, mediaType, interactive, thumbnailUrl });
      Alert.alert(t('story.published'), t('story.publishedText'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(t('story.almostTitle'), err?.message ?? t('story.failedText'));
    } finally {
      publishingRef.current = false;
      setUploading(false);
    }
  }, [mediaUri, mediaType, mediaMimeType, profile, createStory, router, pollActive, pollQuestion, pollOption0, pollOption1, t]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[darkColors.bg.primary, darkColors.bg.secondary, darkColors.bg.primary]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('mobileDesign.back')} disabled={uploading} onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} stroke="#9CA3AF" strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('story.createTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Haupt-Preview */}
      <View style={styles.previewArea}>
        {mediaUri ? (mediaType === 'video' ? (
          <VideoView player={videoPlayer} style={styles.previewImage} contentFit="contain" nativeControls />
        ) : (
          <Image
            source={{ uri: mediaUri }}
            style={styles.previewImage}
            contentFit="contain"
          />
        )) : (
          /* Kein Bild — großer Pick-Button */
          <Pressable onPress={pickMedia} style={styles.pickerBtn}>
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(220,229,241,0.08)']}
              style={StyleSheet.absoluteFill}
            />
            <ImagePlus size={48} stroke="#FFFFFF" strokeWidth={1.5} />
            <Text style={styles.pickerLabel}>{t('story.pickMedia')}</Text>
            <Text style={styles.pickerSub}>{t('story.visible24')}</Text>
          </Pressable>
        )}
      </View>

      {/* Aktionen am unteren Rand */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {mediaUri && (
          <Pressable disabled={uploading} onPress={pickMedia} style={styles.changeBtn}>
            <ImagePlus size={16} stroke="#9CA3AF" strokeWidth={2} />
            <Text style={styles.changeBtnText}>{t('editorUx.changeMedia')}</Text>
          </Pressable>
        )}

        {/* Poll-Button: nur wenn Bild vorhanden */}
        {mediaUri && (
          <Pressable
            disabled={uploading}
            onPress={() => setPollActive((v) => !v)}
            style={[
              styles.changeBtn,
              pollActive && { borderColor: 'rgba(251,191,36,0.5)', backgroundColor: 'rgba(251,191,36,0.1)' },
            ]}
          >
            {pollActive
              ? <X size={16} stroke="#FBBF24" strokeWidth={2} />
              : <BarChart2 size={16} stroke="#9CA3AF" strokeWidth={2} />}
            <Text style={[styles.changeBtnText, pollActive && { color: '#FBBF24' }]}>
              {pollActive ? t('story.pollRemove') : t('story.pollAdd')}
            </Text>
          </Pressable>
        )}

        {/* Poll-Editor */}
        {pollActive && mediaUri && (
          <View style={{
            backgroundColor: 'rgba(251,191,36,0.08)',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(251,191,36,0.3)',
            padding: 14,
            gap: 10,
            marginTop: 4,
          }}>
            <Text style={{ color: '#FBBF24', fontWeight: '700', fontSize: 13 }}>📊 Poll</Text>
            <TextInput
              style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: 10,
                color: '#fff',
                fontSize: 14,
              }}
              placeholder={t('story.pollQuestion')}
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={pollQuestion}
              onChangeText={setPollQuestion}
              maxLength={80}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: 10,
                  color: '#fff',
                  fontSize: 13,
                }}
                placeholder={t('story.option1')}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={pollOption0}
                onChangeText={setPollOption0}
                maxLength={30}
              />
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: 10,
                  color: '#fff',
                  fontSize: 13,
                }}
                placeholder={t('story.option2')}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={pollOption1}
                onChangeText={setPollOption1}
                maxLength={30}
              />
            </View>
          </View>
        )}

        <Pressable
          onPress={mediaUri ? handlePublish : pickMedia}
          style={[styles.publishBtn, { backgroundColor: mediaUri ? darkColors.accent.solid : darkColors.bg.elevated }, !mediaUri && styles.publishBtnDisabled]}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={darkColors.text.onAccent} />
          ) : (
            <>
              <LinearGradient
                colors={mediaUri ? [darkColors.accent.solid, darkColors.accent.solid] : [darkColors.bg.elevated, darkColors.bg.elevated]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Send size={16} stroke={mediaUri ? darkColors.text.onAccent : darkColors.text.primary} strokeWidth={2.2} />
              <Text style={[styles.publishBtnText, { color: mediaUri ? darkColors.text.onAccent : darkColors.text.primary }]}>
                {mediaUri ? t('story.publishBtn') : t('story.pickImageBtn')}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // ── Preview ──
  previewArea: {
    flex: 1,
    margin: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  pickerBtn: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    overflow: 'hidden',
    borderRadius: 20,
  },
  pickerLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  pickerSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },

  // ── Bottom ──
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  changeBtnText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    overflow: 'hidden',
  },
  publishBtnDisabled: {
    opacity: 0.6,
  },
  publishBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
