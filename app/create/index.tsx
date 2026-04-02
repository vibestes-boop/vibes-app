import { useState, useRef, useCallback } from "react";
import {
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  launchImageLibraryAsync,
  launchCameraAsync,
  type ImagePickerAsset,
} from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { uploadPostMedia, generateAndUploadThumbnail } from "@/lib/uploadMedia";
import { useAuthStore } from "@/lib/authStore";
import { useGuildInfo } from "@/lib/usePosts";
import { useQueryClient } from "@tanstack/react-query";
import { useDrafts } from "@/lib/useDrafts";
import {
  CreateProgressBar,
  CreateHeader,
  CreateMediaPicker,
  CreateCaptionField,
  CreateTagPicker,
  CreateGuildBanner,
  createStyles as styles,
} from "@/components/create";

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: guildInfo } = useGuildInfo(profile?.guild_id ?? null);
  const { saveDraft } = useDrafts();

  const [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // progress: 0-100 = normal, negative = retry attempt number
  const [uploadPct, setUploadPct] = useState(0);

  // AbortController ref — replaced on each new upload
  const abortRef = useRef<AbortController | null>(null);

  const pickImage = async () => {
    const { status } = await requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Berechtigung erforderlich",
        "Bitte erlaube den Zugriff auf deine Fotos.",
      );
      return;
    }
    const result = await launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,   // Kein Zuschneiden — Original hochladen wie TikTok
      quality: 0.92,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0]);
  };

  const takePhoto = async () => {
    const { status } = await requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Berechtigung erforderlich",
        "Bitte erlaube den Kamera-Zugriff.",
      );
      return;
    }
    const result = await launchCameraAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,   // Kein Zuschneiden — Original hochladen wie TikTok
      quality: 0.92,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0]);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag].slice(0, 4),
    );
  };

  /** Cancel an in-progress upload — aborts all fetch calls and returns to Create screen */
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setUploading(false);
    setUploadPct(0);
    // Stay on Create screen so the user keeps their draft
  }, []);

  const handlePost = async () => {
    if (!profile) return;
    if (!image && !caption.trim()) {
      Alert.alert("Fehler", "Füge ein Bild oder eine Caption hinzu.");
      return;
    }

    // Create a fresh AbortController for this upload
    const controller = new AbortController();
    abortRef.current = controller;

    setUploading(true);
    setUploadPct(0);

    try {
      let mediaUrl: string | null = null;
      let thumbnailUrl: string | null = null;
      const isVideo = image?.type === 'video';

      if (image) {
        const { url } = await uploadPostMedia(
          profile.id,
          image.uri,
          image.mimeType,
          (pct) => setUploadPct(pct),
          controller.signal,
        );
        mediaUrl = url;

        // Für Videos: Thumbnail aus erstem Frame generieren
        if (isVideo) {
          thumbnailUrl = await generateAndUploadThumbnail(
            profile.id,
            image.uri,
            controller.signal,
          );
        }
      }

      // Bail out if the user cancelled between the upload and the DB insert
      if (controller.signal.aborted) return;

      const { error } = await supabase.from("posts").insert({
        author_id: profile.id,
        caption: caption.trim() || null,
        media_url: mediaUrl,
        media_type: isVideo ? "video" : "image",
        thumbnail_url: thumbnailUrl,
        tags: selectedTags.map((t) => t.toLowerCase()),
        is_guild_post: false,
        guild_id: profile.guild_id,
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["vibe-feed"] });
      await queryClient.invalidateQueries({ queryKey: ["guild-feed"] });
      await queryClient.invalidateQueries({ queryKey: ["user-posts", profile.id] });

      Alert.alert("🎉 Vibe gepostet!", "Dein Post ist jetzt im Feed.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      // Ignore abort errors — user intentionally cancelled
      if (err instanceof Error && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Upload fehlgeschlagen.";
      Alert.alert("Fehler", message);
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <CreateProgressBar
        visible={uploading}
        progress={uploadPct}
        onCancel={handleCancel}
      />

      <CreateHeader
        onClose={() => {
          // Wenn Content vorhanden → fragen ob Entwurf speichern
          if ((caption.trim() || selectedTags.length > 0 || image) && !uploading) {
            Alert.alert(
              'Entwurf speichern?',
              'Möchtest du diesen Post als Entwurf speichern?',
              [
                {
                  text: 'Verwerfen',
                  style: 'destructive',
                  onPress: () => router.back(),
                },
                {
                  text: 'Als Entwurf speichern',
                  onPress: async () => {
                    await saveDraft({
                      caption,
                      tags: selectedTags,
                      mediaUri: image?.uri ?? null,
                      mediaType: image?.type === 'video' ? 'video' : image ? 'image' : null,
                    });
                    router.back();
                  },
                },
              ]
            );
          } else {
            router.back();
          }
        }}
        onPost={handlePost}
        uploading={uploading}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CreateMediaPicker
          asset={image}
          onPickLibrary={pickImage}
          onOpenCamera={takePhoto}
        />

        <CreateCaptionField
          usernameInitial={profile?.username?.[0]?.toUpperCase() ?? "?"}
          caption={caption}
          onChangeCaption={setCaption}
        />

        <CreateTagPicker selectedTags={selectedTags} onToggleTag={toggleTag} />

        {guildInfo ? <CreateGuildBanner guildName={guildInfo.name} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
