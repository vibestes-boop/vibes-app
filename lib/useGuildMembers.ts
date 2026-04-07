import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type GuildMember = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

export function useGuildMembers(guildId: string | null | undefined) {
  return useQuery<GuildMember[]>({
    queryKey: ['guild-members', guildId],
    queryFn: async () => {
      if (!guildId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('guild_id', guildId)
        .order('username', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as GuildMember[];
    },
    enabled: !!guildId,
    staleTime: 1000 * 60 * 5,
  });
}
