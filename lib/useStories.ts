import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export type StoryPoll = {
  type: 'poll';
  question: string;
  options: [string, string]; // genau 2 Optionen
};

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
  viewed: boolean;
  interactive?: StoryPoll | null;
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

      let members: { id: string; username: string | null; avatar_url: string | null }[] = [];

      if (guildId) {
        // Normaler Pfad: Guild-Member holen
        const { data: guildMembers } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('guild_id', guildId);
        members = guildMembers ?? [];
      } else {
        // Bug 8 Fix: Kein Guild → Fallback auf gefolgten Usern (+ eigenes Profil)
        const { data: followRows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);

        const followedIds = (followRows ?? []).map((r) => r.following_id);
        // Eigene userId immer einschließen damit eigene Stories sichtbar sind
        const allIds = [...new Set([userId, ...followedIds])];

        if (allIds.length > 0) {
          const { data: followedProfiles } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', allIds);
          members = followedProfiles ?? [];
        }
      }

      if (!members || members.length === 0) return [];
      const memberIds = members.map((m) => m.id);

      // Stories dieser Member (letzte 24h)
      const { data: stories, error } = await supabase
        .from('stories')
        .select('id, user_id, media_url, media_type, created_at, interactive')
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
      queryClient.invalidateQueries({ queryKey: ['guild-stories', userId] });
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
      interactive,
    }: {
      mediaUrl: string;
      mediaType: string;
      interactive?: StoryPoll | null;
    }) => {
      if (!userId) return;
      const { error } = await supabase
        .from('stories')
        .insert({
          user_id:     userId,
          media_url:   mediaUrl,
          media_type:  mediaType,
          interactive: interactive ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-stories', userId] });
    },
  });
}

// ── Poll-Voting ──────────────────────────────────────────────────────────────

/** Eigene Abstimmung für eine Story laden */
export function useMyStoryVote(storyId: string | null) {
  const userId = useAuthStore((s) => s.profile?.id);

  return useQuery<number | null>({
    queryKey: ['story-vote', storyId, userId],
    queryFn: async () => {
      if (!storyId || !userId) return null;
      const { data } = await supabase
        .from('story_votes')
        .select('option_idx')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .maybeSingle();
      return data ? (data.option_idx as number) : null;
    },
    enabled: !!storyId && !!userId,
    staleTime: 30_000,
  });
}

/** Gesamt-Ergebnis eines Polls */
export function useStoryPollResults(storyId: string | null) {
  return useQuery<{ counts: [number, number]; total: number }>({
    queryKey: ['story-poll-results', storyId],
    queryFn: async () => {
      if (!storyId) return { counts: [0, 0], total: 0 };
      const { data } = await supabase
        .from('story_votes')
        .select('option_idx')
        .eq('story_id', storyId);
      const votes = data ?? [];
      const c0 = votes.filter((v) => v.option_idx === 0).length;
      const c1 = votes.filter((v) => v.option_idx === 1).length;
      return { counts: [c0, c1] as [number, number], total: c0 + c1 };
    },
    enabled: !!storyId,
    staleTime: 10_000,
  });
}

/** Abstimmen — mit Optimistic Update */
export function useVoteStoryPoll() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.profile?.id);

  return useMutation({
    mutationFn: async ({ storyId, optionIdx }: { storyId: string; optionIdx: number }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      // upsert: verhindert Doppelabstimmung
      const { error } = await supabase
        .from('story_votes')
        .upsert({ story_id: storyId, user_id: userId, option_idx: optionIdx });
      if (error) throw error;
    },
    onSuccess: (_data, { storyId }) => {
      queryClient.invalidateQueries({ queryKey: ['story-vote', storyId, userId] });
      queryClient.invalidateQueries({ queryKey: ['story-poll-results', storyId] });
    },
  });
}
