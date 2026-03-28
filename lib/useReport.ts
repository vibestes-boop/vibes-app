import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

type ReportReason = 'report' | 'not_interested';

export function useReport() {
  const userId = useAuthStore((s) => s.profile?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, reason }: { postId: string; reason: ReportReason }) => {
      if (!userId) throw new Error('Nicht eingeloggt');
      const { error } = await supabase.from('post_reports').insert({
        reporter_id: userId,
        post_id: postId,
        reason,
      });
      // Unique-Constraint-Fehler ignorieren (schon gemeldet)
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: (_data, { reason }) => {
      if (reason === 'not_interested') {
        // Feed-Cache invalidieren damit der Post verschwindet
        queryClient.invalidateQueries({ queryKey: ['vibe-feed'] });
      }
    },
    onError: (err: any) => {
      if (err?.code !== '23505') {
        Alert.alert('Fehler', err?.message ?? 'Melden fehlgeschlagen.');
      }
    },
  });
}
