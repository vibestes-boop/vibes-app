import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, ActivityIndicator, Alert, Text, StyleSheet } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
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
import { GuildMembersSheet } from "@/components/guild/GuildMembersSheet";
import { useAuthStore } from "@/lib/authStore";
import { useGuildFeed, useGuildInfo, type GuildPost } from "@/lib/usePosts";
import {
  useGuildStories,
  useCreateStory,
  type StoryGroup,
} from "@/lib/useStories";
import { useStoryViewerStore } from "@/lib/storyViewerStore";
import { uploadPostMedia, generateAndUploadThumbnail } from "@/lib/uploadMedia";
import { useGuildMemberCount } from "@/lib/useGuildMemberCount";
import { guildFeedActions, useTabRefreshStore } from "@/lib/useTabRefresh";
import { useGuildNavStore } from "@/lib/guildNavStore";
import { useActiveLiveSessions } from "@/lib/useLiveSession";

export default function GuildScreen() {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const { data: guild } = useGuildInfo(profile?.guild_id ?? null);
  const { data: posts = [], isLoading, refetch } = useGuildFeed();
  // Trennung: isPullRefreshing = nur User-initiierter Pull-to-Refresh (zeigt Spinner).
  // Hintergrund-Refetches (useFocusEffect, Tab-Klick) laufen still, kein Spinner sichtbar.
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const { data: storyGroups = [] } = useGuildStories();
  const { mutateAsync: createStory } = useCreateStory();
  const storeOpen = useStoryViewerStore((s) => s.open);
  const router = useRouter();
  const [viewMode, setViewMode] = useState<GuildViewMode>("feed");
  const [isUploading, setIsUploading] = useState(false);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  const { data: memberCount } = useGuildMemberCount(profile?.guild_id);
  const [membersOpen, setMembersOpen] = useState(false);
  const { data: activeLives = [] } = useActiveLiveSessions();
  const listRef = useRef<FlashList<GuildPost>>(null);
  const setGuildRefreshing = useTabRefreshStore((s) => s.setGuildRefreshing);
  const guildRefreshTick = useTabRefreshStore((s) => s.guildRefreshTick);

  // Viewability: Video spielt nur wenn Karte zu ≥60% sichtbar
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ item: GuildPost; isViewable: boolean }> }) => {
      const first = viewableItems.find((vi) => vi.isViewable);
      setVisiblePostId(first?.item.id ?? null);
    },
    []
  );

  // Globalen Ref registrieren — Tab-Layout ruft dies direkt auf
  useEffect(() => {
    guildFeedActions.refresh = () => {
      // Zuerst zum Offset 0 scrollen, DANN refetchen
      // (gleichzeitiger Refetch bricht animated scroll ab → stops at wrong position)
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      setTimeout(() => {
        refetch().finally(() => setGuildRefreshing(false));
      }, 100);
    };
    return () => { guildFeedActions.refresh = null; };
    // refetch ist stabil
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backup: Zustand-Tick (falls Ref nicht gesetzt)
  useEffect(() => {
    if (guildRefreshTick === 0) return;
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setTimeout(() => {
      refetch().finally(() => setGuildRefreshing(false));
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildRefreshTick]);

  // Stilles Hintergrund-Refetch bei Fokus + Video-Steuerung:
  // - Bei Fokus: Screen als aktiv markieren → Videos dürfen spielen
  // - Bei Blur (Navigation weg): isScreenFocused = false → alle Videos stoppen sofort
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      refetch();
      return () => {
        // Screen verliert Fokus (z.B. Navigation zur Detailseite)
        setIsScreenFocused(false);
      };
    }, [refetch]),
  );

  // User-initiierter Pull-to-Refresh — einzige Stelle die den Spinner aktiviert
  const handlePullRefresh = useCallback(() => {
    setIsPullRefreshing(true);
    refetch().finally(() => setIsPullRefreshing(false));
  }, [refetch]);
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

  // Guild-Posts + Farben in Store speichern — Swipe-Detail liest daraus
  const setGuildNavPosts = useGuildNavStore((s) => s.setPosts);
  useEffect(() => {
    if (posts.length > 0) {
      setGuildNavPosts(posts, guildColorPair);
      // Prefetch die ersten 5 Bilder proaktiv — sofortiges Laden in der Detailseite
      const imageUrls = posts
        .slice(0, 5)
        .map((p) => p.media_url)
        .filter((url): url is string => !!url && true);
      // Alle auf einmal prefetchen — expo-image batcht das intern
      if (imageUrls.length > 0) {
        Image.prefetch?.(imageUrls).catch(() => { /* ignorieren */ });
      }
    }
  }, [posts, guildColorPair, setGuildNavPosts]);

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

      // Thumbnail für Videos generieren
      let thumbnailUrl: string | null = null;
      if (mediaType === 'video') {
        thumbnailUrl = await generateAndUploadThumbnail(profile.id, asset.uri);
      }

      await createStory({ mediaUrl: upload.url, mediaType, thumbnailUrl });
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
      <GuildCard
        post={item}
        guildColors={guildColorPair}
        isVisible={item.id === visiblePostId && isScreenFocused}
      />
    ),
    [guildColorPair, visiblePostId, isScreenFocused],
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
          onMembersPress={() => setMembersOpen(true)}
        />
        {viewMode === "feed" && (
          <View style={styles.storiesWrap}>
            <StoriesRow
              groups={storyGroups}
              onSelectGroup={openViewer}
              onAddStory={handleAddStory}
              liveSessions={activeLives}
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
            onMembersPress={() => setMembersOpen(true)}
          />
          <GuildLeaderboard
            guildId={profile?.guild_id}
            guildColors={guildColorPair}
          />
        </>
      ) : (
        <FlashList
          ref={listRef}
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          estimatedItemSize={500}
          contentContainerStyle={
            posts.length === 0
              ? { paddingBottom: insets.bottom }
              : { paddingBottom: insets.bottom + 90 }
          }
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
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
          refreshing={isPullRefreshing}
          onRefresh={handlePullRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Guild-Mitgliederliste */}
      <GuildMembersSheet
        visible={membersOpen}
        onClose={() => setMembersOpen(false)}
        guildId={profile?.guild_id}
        guildName={guildName}
        guildColors={guildColorPair}
      />
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
