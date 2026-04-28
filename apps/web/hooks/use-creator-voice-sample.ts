'use client';

/**
 * useCreatorVoiceSample — v1.w.UI.218
 *
 * Web-Pendant zu `lib/useCreatorVoiceSample.ts` (Native).
 * Lädt die voice_sample_url des Creators:
 *   - Eigener Account: direkt aus Supabase Auth-Session (kein extra Fetch)
 *   - Fremder Creator: React Query mit 5-Min-Cache
 *
 * Gibt null zurück wenn keine Stimme hinterlegt.
 */

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export function useCreatorVoiceSample(
  creatorUserId: string | null | undefined,
): string | null {
  // Eigener Account: via Supabase user + profiles select
  const [ownVoiceUrl, setOwnVoiceUrl] = useState<string | null>(null);
  const [ownUserId, setOwnUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!creatorUserId) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled || !data?.user) return;
      if (data.user.id !== creatorUserId) return;
      setOwnUserId(data.user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('voice_sample_url')
        .eq('id', data.user.id)
        .single();
      if (!cancelled) {
        setOwnVoiceUrl(
          (profile as { voice_sample_url?: string | null } | null)
            ?.voice_sample_url ?? null,
        );
      }
    });
    return () => { cancelled = true; };
  }, [creatorUserId]);

  // Fremder Creator: React Query
  const isOwn = !!ownUserId && ownUserId === creatorUserId;
  const { data: remoteUrl } = useQuery({
    queryKey: ['creator-voice-sample', creatorUserId],
    queryFn: async () => {
      if (!creatorUserId) return null;
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('voice_sample_url')
        .eq('id', creatorUserId)
        .single();
      return (
        (data as { voice_sample_url?: string | null } | null)
          ?.voice_sample_url ?? null
      );
    },
    enabled: !!creatorUserId && !isOwn,
    staleTime: 5 * 60 * 1000,
  });

  return isOwn ? ownVoiceUrl : (remoteUrl ?? null);
}
