import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useGuildMemberCount(guildId: string | null | undefined) {
  return useQuery({
    queryKey: ['guild-member-count', guildId],
    queryFn: async () => {
      if (!guildId) return 0;
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('guild_id', guildId);
      return count ?? 0;
    },
    enabled: !!guildId,
    staleTime: 1000 * 60 * 5,
  });
}
