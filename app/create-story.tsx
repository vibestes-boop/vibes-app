import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  requestMediaLibraryPermissionsAsync,
  launchImageLibraryAsync,
} from 'expo-image-picker';
import { ArrowLeft, ImagePlus, Type, Send, BarChart2, X } from 'lucide-react-native';
import { uploadPostMedia, generateAndUploadThumbnail } from '@/lib/uploadMedia';
import { useAuthStore } from '@/lib/authStore';
import { useCreateStory, type StoryPoll } from '@/lib/useStories';

export default function CreateStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const { mutateAsync: createStory } = useCreateStory();

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);

  // ── Poll-State ────────────────────────────────────────────────────────────────
  const [pollActive, setPollActive] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOption0, setPollOption0] = useState('Ja');
  const [pollOption1, setPollOption1] = useState('Nein');

  // ── Bild aus Galerie auswählen ──────────────────────────────────────────────
  const pickMedia = useCallback(async () => {
    const { status } = await requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung', 'Bitte erlaube den Zugriff auf deine Fotos.');
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
    }
  }, []);

  // ── Upload + Story erstellen ────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!mediaUri || !profile) return;
    setUploading(true);
    try {
      const mimeType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
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
              pollOption0.trim() || 'Option 1',
              pollOption1.trim() || 'Option 2',
            ],
          }
          : null;

      await createStory({ mediaUrl: publicUrl, mediaType, interactive, thumbnailUrl });
      Alert.alert('Story veröffentlicht! 🎉', 'Deine Story ist 24 Stunden sichtbar.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Fehler', err?.message ?? 'Story konnte nicht erstellt werden.');
    } finally {
      setUploading(false);
    }
  }, [mediaUri, mediaType, profile, createStory, router, pollActive, pollQuestion, pollOption0, pollOption1]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#0A0A0A', '#0d1a2e', '#0A0A0A']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} stroke="#9CA3AF" strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle}>Story erstellen</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Haupt-Preview */}
      <View style={styles.previewArea}>
        {mediaUri ? (
          <Image
            source={{ uri: mediaUri }}
            style={styles.previewImage}
            contentFit="contain"
          />
        ) : (
          /* Kein Bild — großer Pick-Button */
          <Pressable onPress={pickMedia} style={styles.pickerBtn}>
            <LinearGradient
              colors={['rgba(255,255,255,0.10)', 'rgba(22,163,74,0.05)']}
              style={StyleSheet.absoluteFill}
            />
            <ImagePlus size={48} stroke="#FFFFFF" strokeWidth={1.5} />
            <Text style={styles.pickerLabel}>Foto oder Video auswählen</Text>
            <Text style={styles.pickerSub}>Sichtbar für 24 Stunden</Text>
          </Pressable>
        )}
      </View>

      {/* Aktionen am unteren Rand */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {mediaUri && (
          <Pressable onPress={pickMedia} style={styles.changeBtn}>
            <Type size={16} stroke="#9CA3AF" strokeWidth={2} />
            <Text style={styles.changeBtnText}>Anderes Bild</Text>
          </Pressable>
        )}

        {/* Poll-Button: nur wenn Bild vorhanden */}
        {mediaUri && (
          <Pressable
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
              {pollActive ? 'Poll entfernen' : 'Poll hinzufügen'}
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
              placeholder="Deine Frage…"
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
                placeholder="Option 1"
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
                placeholder="Option 2"
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
          style={[styles.publishBtn, !mediaUri && styles.publishBtnDisabled]}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <LinearGradient
                colors={mediaUri ? ['#CCCCCC', '#FFFFFF'] : ['#1F2937', '#1F2937']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Send size={16} stroke="#fff" strokeWidth={2.2} />
              <Text style={styles.publishBtnText}>
                {mediaUri ? 'Story veröffentlichen' : 'Bild auswählen'}
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
