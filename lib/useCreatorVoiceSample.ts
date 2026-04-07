/**
 * useCreatorVoiceSample
 * Lädt die voice_sample_url des Creators.
 * Eigener Account → direkt aus authStore (kein Cache-Delay nach Voice-Save).
 * Fremder Creator → React Query mit 2-Min-Cache.
 *
 * Deaktiviert (UI-Button entfernt) — Infrastruktur bleibt für
 * zukünftiges AI-Narration Feature (Phase 2: Creator-Stimme für Videos).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';

export function useCreatorVoiceSample(userId: string | null | undefined): string | null {
  const { profile } = useAuthStore();
  const isOwnProfile = !!userId && userId === profile?.id;

  // React Query für fremde Profile (immer aufrufen — Rules of Hooks)
  const { data: remoteData } = useQuery({
    queryKey: ['creator-voice', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('voice_sample_url')
        .eq('id', userId)
        .single();
      return (data as any)?.voice_sample_url ?? null;
    },
    enabled: !!userId && !isOwnProfile,
    staleTime: 2 * 60 * 1000,
  });

  if (isOwnProfile) {
    return (profile as any)?.voice_sample_url ?? null;
  }

  return remoteData ?? null;
}
