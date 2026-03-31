import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import type * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { ImagePlus, Video } from 'lucide-react-native';
import { Video as AvVideo, ResizeMode } from 'expo-av';
import { createStyles as styles } from './createStyles';

export function CreateMediaPicker({
  asset,
  onPickLibrary,
  onOpenCamera,
}: {
  asset: ImagePicker.ImagePickerAsset | null;
  onPickLibrary: () => void;
  onOpenCamera: () => void;
}) {
  const isVideo = asset?.type === 'video';

  return (
    <>
      <Pressable onPress={onPickLibrary} style={styles.imagePicker}>
        {asset ? (
          <>
            {isVideo ? (
              <AvVideo
                source={{ uri: asset.uri }}
                style={styles.previewImage}
                resizeMode={ResizeMode.COVER}
                isLooping
                shouldPlay
                isMuted
              />
            ) : (
              <Image source={{ uri: asset.uri }} style={styles.previewImage} />
            )}
            <View style={styles.imageOverlay}>
              {isVideo && (
                <View style={styles.videoBadge}>
                  <Video size={12} color="#fff" />
                  <Text style={styles.videoBadgeText}>Video</Text>
                </View>
              )}
              <Text style={styles.changeImageText}>Tippen zum Ändern</Text>
            </View>
          </>
        ) : (
          <>
            <LinearGradient colors={['#0d0016', '#0a0a0a']} style={StyleSheet.absoluteFill} />
            <ImagePlus size={36} stroke="#374151" strokeWidth={1.5} />
            <Text style={styles.imagePickerTitle}>Foto oder Video</Text>
            <Text style={styles.imagePickerSub}>Tippe hier oder nutze die Kamera</Text>
          </>
        )}
      </Pressable>

      {!asset && (
        <Pressable onPress={onOpenCamera} style={styles.cameraBtn}>
          <Text style={styles.cameraBtnText}>📷  Kamera öffnen</Text>
        </Pressable>
      )}
    </>
  );
}
