import { useCallback, useMemo, useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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

  const { data: memberCount } = useGuildMemberCount(profile?.guild_id);

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
      (GUILD_COLORS[guildName] ?? ["#6366F1", "#8B5CF6"]) as [string, string],
    [guildName],
  );

  const handleAddStory = useCallback(async () => {
    if (!profile?.id) return;
    const result = await launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
      videoMaxDuration: 15,
    });
    // Stub gibt canceled:true → erklärender Hinweis statt stiller Fail
    if (result.canceled || !result.assets?.[0]) {
      if (!result.assets) {
        Alert.alert(
          "Story nicht verfügbar",
          "Galerie-Zugriff ist in diesem Build deaktiviert. Stories können nach dem EAS-Build erstellt werden.",
        );
      }
      return;
    }
    const asset = result.assets[0];
    const mediaType = asset.type === "video" ? "video" : "image";
    const mimeType = mediaType === "video" ? "video/mp4" : "image/jpeg";
    try {
      const upload = await uploadPostMedia(profile.id, asset.uri, mimeType);
      await createStory({ mediaUrl: upload.url, mediaType });
    } catch (e) {
      console.error("Story upload failed", e);
    }
  }, [profile?.id, createStory]);

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
            posts.length === 0 ? { paddingBottom: 0 } : { paddingBottom: 20 }
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
