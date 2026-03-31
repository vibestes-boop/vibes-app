/**
 * useDiscoverPeople.ts
 *
 * Empfiehlt User zum Folgen basierend auf:
 * 1. Gleiche Guild (stärkstes Signal)
 * 2. Gleiche Hashtag-Interessen (aus posts.tags des eingeloggten Users)
 * 3. Neueste aktive User (Fallback)
 *
 * Schließt User aus denen man bereits folgt (und sich selbst).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

export type DiscoverUser = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  reason: 'guild' | 'interests' | 'new';
};

export function useDiscoverPeople() {
  const { profile } = useAuthStore();
  const userId   = profile?.id;
  const guildId  = profile?.guild_id;

  return useQuery<DiscoverUser[]>({
    queryKey: ['discover-people', userId],
    queryFn: async (): Promise<DiscoverUser[]> => {
      if (!userId) return [];

      // ── Wer wird bereits gefolgt? ─────────────────────────────────────────
      const { data: followingRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);
      const alreadyFollowing = new Set(
        (followingRows ?? []).map((r) => r.following_id as string)
      );
      alreadyFollowing.add(userId); // sich selbst ausschließen

      const results: DiscoverUser[] = [];
      const seen = new Set<string>();

      const addUser = (u: { id: string; username: string; avatar_url: string | null; bio: string | null }, reason: DiscoverUser['reason']) => {
        if (!seen.has(u.id) && !alreadyFollowing.has(u.id)) {
          seen.add(u.id);
          results.push({ ...u, reason });
        }
      };

      // ── 1. Gleiche Guild ──────────────────────────────────────────────────
      if (guildId) {
        const { data: guildUsers } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .eq('guild_id', guildId)
          .neq('id', userId)
          .limit(8);
        (guildUsers ?? []).forEach((u) => addUser(u, 'guild'));
      }

      // ── 2. Gleiche Interessen (Tags) ──────────────────────────────────────
      // Eigene Top-Tags ermitteln
      const { data: myPosts } = await supabase
        .from('posts')
        .select('tags')
        .eq('author_id', userId)
        .limit(20);

      const tagFreq = new Map<string, number>();
      (myPosts ?? []).forEach((p) => {
        (p.tags as string[] ?? []).forEach((t) => tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1));
      });
      const topTags = [...tagFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

      if (topTags.length > 0) {
        const { data: tagPosts } = await supabase
          .from('posts')
          .select('author_id, profiles!inner(id, username, avatar_url, bio)')
          .contains('tags', topTags.slice(0, 1))
          .neq('author_id', userId)
          .limit(20);

        (tagPosts ?? []).forEach((p) => {
          const u = p.profiles as unknown as { id: string; username: string; avatar_url: string | null; bio: string | null };
          if (u) addUser(u, 'interests');
        });
      }

      // ── 3. Fallback — neueste aktive User ─────────────────────────────────
      if (results.length < 5) {
        const { data: newUsers } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .neq('id', userId)
          .order('created_at', { ascending: false })
          .limit(10);
        (newUsers ?? []).forEach((u) => addUser(u, 'new'));
      }

      return results.slice(0, 10); // max 10 Empfehlungen
    },
    staleTime: 1000 * 60 * 5, // 5 Min — nicht zu oft aktualisieren
    enabled: !!userId,
  });
}
