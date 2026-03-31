import { useCallback, useMemo, useState } from "react";
import { View, ActivityIndicator, Alert, Text, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { launchImageLibraryAsync } from "expo-image-picker";
import { GuildLeaderboard } from "@/components/ui/GuildLeaderboard";
import { StoriesRow } from "@/components/ui/StoriesRow";
import {
  GUILD_COLORS,
  GuildCard,
  GuildRoomHeader,
  EmptyGuildState,
  guildStyles as styles,
  type GuildViewMode,
} from "@/components/guild";
import { useAuthStore } from "@/lib/authStore";
import { useGuildFeed, useGuildInfo, type GuildPost } from "@/lib/usePosts";
import {
  useGuildStories,
  useCreateStory,
  type StoryGroup,
} from "@/lib/useStories";
import { useStoryViewerStore } from "@/lib/storyViewerStore";
import { uploadPostMedia } from "@/lib/uploadMedia";
import { useGuildMemberCount } from "@/lib/useGuildMemberCount";

export default function GuildScreen() {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const { data: guild } = useGuildInfo(profile?.guild_id ?? null);
  const { data: posts = [], isLoading, refetch, isRefetching } = useGuildFeed();
  const { data: storyGroups = [] } = useGuildStories();
  const { mutateAsync: createStory } = useCreateStory();
  const storeOpen = useStoryViewerStore((s) => s.open);
  const router = useRouter();
  const [viewMode, setViewMode] = useState<GuildViewMode>("feed");
  const [isUploading, setIsUploading] = useState(false);

  const { data: memberCount } = useGuildMemberCount(profile?.guild_id);

  // Auto-Refetch wenn User zum Guild-Tab zurückkehrt (wie im Feed-Screen)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  const openViewer = useCallback(
    (group: StoryGroup) => {
      storeOpen(group, storyGroups);
      router.push("/story-viewer" as any);
    },
    [storeOpen, storyGroups, router],
  );

  const guildName = guild?.name ?? "Dein Pod";
  const guildColorPair = useMemo(
    () =>
      (GUILD_COLORS[guildName] ?? ["#0891B2", "#22D3EE"]) as [string, string],
    [guildName],
  );

  const handleAddStory = useCallback(async () => {
    if (!profile?.id) return;
    if (isUploading) return; // Doppel-Tap Guard
    const result = await launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
      videoMaxDuration: 15,
    });
    if (result.canceled) return;
    if (!result.assets?.[0]) {
      Alert.alert(
        "Story nicht verfügbar",
        "Kein Medium ausgewählt. Bitte erlaube den Galerie-Zugriff in den Einstellungen.",
      );
      return;
    }
    const asset = result.assets[0];
    const mediaType = asset.type === "video" ? "video" : "image";
    const mimeType = mediaType === "video" ? "video/mp4" : "image/jpeg";
    setIsUploading(true);
    try {
      const upload = await uploadPostMedia(profile.id, asset.uri, mimeType);
      await createStory({ mediaUrl: upload.url, mediaType });
    } catch (e: any) {
      Alert.alert(
        "Upload fehlgeschlagen",
        e?.message ?? "Bitte versuche es erneut.",
      );
    } finally {
      setIsUploading(false);
    }
  }, [profile?.id, createStory, isUploading]);

  const renderItem = useCallback(
    ({ item }: { item: GuildPost }) => (
      <GuildCard post={item} guildColors={guildColorPair} />
    ),
    [guildColorPair],
  );

  const ListHeader = useCallback(
    () => (
      <>
        <GuildRoomHeader
          guildName={guildName}
          guildColors={guildColorPair}
          memberCount={memberCount}
          mode={viewMode}
          onToggle={setViewMode}
        />
        {viewMode === "feed" && (
          <View style={styles.storiesWrap}>
            <StoriesRow
              groups={storyGroups}
              onSelectGroup={openViewer}
              onAddStory={handleAddStory}
            />
            <View style={styles.storiesDivider} />
          </View>
        )}
      </>
    ),
    [
      guildName,
      guildColorPair,
      memberCount,
      storyGroups,
      openViewer,
      handleAddStory,
      viewMode,
    ],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Upload-Overlay: User sieht Feedback während Story hochgeladen wird */}
      {isUploading && (
        <View style={uploadOverlay.container}>
          <ActivityIndicator size="large" color="#22D3EE" />
          <Text style={uploadOverlay.text}>Story wird hochgeladen…</Text>
        </View>
      )}
      {viewMode === "leaderboard" ? (
        <>
          <GuildRoomHeader
            guildName={guildName}
            guildColors={guildColorPair}
            memberCount={memberCount}
            mode={viewMode}
            onToggle={setViewMode}
          />
          <GuildLeaderboard
            guildId={profile?.guild_id}
            guildColors={guildColorPair}
          />
        </>
      ) : (
        <FlashList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={400}
          contentContainerStyle={
            posts.length === 0
              ? { paddingBottom: insets.bottom }
              : { paddingBottom: insets.bottom + 90 }  // Tab-Bar (~83px) + Puffer
          }
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyGuildState guildColors={guildColorPair} />
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color={guildColorPair[0]} />
                </View>
              )}
            </View>
          }
          refreshing={isRefetching}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const uploadOverlay = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 999,
  },
  text: {
    color: '#22D3EE',
    fontSize: 15,
    fontWeight: '600',
  },
});
