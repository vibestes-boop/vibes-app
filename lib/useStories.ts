import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
  viewed: boolean;
};

export type StoryGroup = {
  userId: string;
  username: string | null;
  avatar_url: string | null;
  stories: Story[];
  hasUnviewed: boolean;
};

// Stories der eigenen Guild (letzte 24h), gruppiert nach Nutzer
export function useGuildStories() {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery<StoryGroup[]>({
    queryKey: ['guild-stories', userId],
    queryFn: async () => {
      if (!userId) return [];

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Stories der eigenen Guild holen (alle User im gleichen Guild)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('guild_id')
        .eq('id', userId)
        .single();

      const guildId = profileData?.guild_id;
      if (!guildId) return [];

      // Guild-Member IDs
      const { data: members } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('guild_id', guildId);

      if (!members || members.length === 0) return [];
      const memberIds = members.map((m) => m.id);

      // Stories dieser Member (letzte 24h)
      const { data: stories, error } = await supabase
        .from('stories')
        .select('id, user_id, media_url, media_type, created_at')
        .in('user_id', memberIds)
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (error || !stories) return [];

      // Gesehene Story-IDs holen
      const storyIds = stories.map((s) => s.id);
      let views: { story_id: string }[] = [];
      if (storyIds.length > 0) {
        const { data: viewData } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('user_id', userId)
          .in('story_id', storyIds);
        views = (viewData ?? []) as { story_id: string }[];
      }

      const viewedSet = new Set(views.map((v) => v.story_id));

      // Profil-Map erstellen
      const profileMap = new Map(members.map((m) => [m.id, m]));

      // Gruppieren nach User
      const grouped = new Map<string, StoryGroup>();
      for (const s of stories) {
        const profile = profileMap.get(s.user_id);
        if (!grouped.has(s.user_id)) {
          grouped.set(s.user_id, {
            userId: s.user_id,
            username: profile?.username ?? null,
            avatar_url: profile?.avatar_url ?? null,
            stories: [],
            hasUnviewed: false,
          });
        }
        const group = grouped.get(s.user_id)!;
        const story: Story = {
          ...s,
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
          viewed: viewedSet.has(s.id),
        };
        group.stories.push(story);
        if (!story.viewed) group.hasUnviewed = true;
      }

      // Eigene Stories zuerst, dann ungesehene, dann gesehene
      const groups = Array.from(grouped.values());
      return groups.sort((a, b) => {
        if (a.userId === userId) return -1;
        if (b.userId === userId) return 1;
        if (a.hasUnviewed && !b.hasUnviewed) return -1;
        if (!a.hasUnviewed && b.hasUnviewed) return 1;
        return 0;
      });
    },
    enabled: !!userId,
    staleTime: 1000 * 60,       // 1 Minute Cache — schneller Tab-Wechsel, trotzdem aktuell
    gcTime:   1000 * 60 * 5,
    refetchOnMount: 'always',   // beim ersten Mount immer frisch, danach gecached
    refetchOnWindowFocus: false,
  });
}

// Story als gesehen markieren
export function useMarkStoryViewed() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!userId) return;
      await supabase
        .from('story_views')
        .upsert({ story_id: storyId, user_id: userId }, { onConflict: 'story_id,user_id' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-stories'] });
    },
  });
}

// Story erstellen
export function useCreateStory() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async ({
      mediaUrl,
      mediaType,
    }: {
      mediaUrl: string;
      mediaType: string;
    }) => {
      if (!userId) return;
      const { error } = await supabase
        .from('stories')
        .insert({ user_id: userId, media_url: mediaUrl, media_type: mediaType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-stories'] });
    },
  });
}
