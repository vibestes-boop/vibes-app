// Sperren und Melden.
//
// Beide Tabellen gehören Serlo und sind app-übergreifend gedacht: Wer jemanden
// in Berkat sperrt, hat ihn auch in Serlo gesperrt. Das ist gewollt — eine
// Sperre gilt der Person, nicht der Oberfläche.
//
// Die RLS trägt beides ohne Zutun: `user_blocks_insert` verlangt
// `blocker_id = auth.uid()`, `user_reports_insert` verlangt
// `reporter_id = auth.uid()`. Kein RPC, keine Migration.

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type ReportReason = 'spam' | 'scam' | 'harassment' | 'nudity' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'scam', label: 'Betrug — Ware kam nie an' },
  { key: 'spam', label: 'Spam oder Werbung' },
  { key: 'harassment', label: 'Beleidigung oder Belästigung' },
  { key: 'nudity', label: 'Nacktheit oder Gewalt' },
  { key: 'other', label: 'Etwas anderes' },
];

/** Wen ich gesperrt habe. Eine Abfrage für die ganze App, nicht eine pro Kopf. */
export function useMyBlocks(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-blocks', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId!);
      if (error) throw error;
      return new Set((data ?? []).map((r) => (r as { blocked_id: string }).blocked_id));
    },
  });
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export function useSellerActions(userId: string | null) {
  const queryClient = useQueryClient();

  const refreshBlocks = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'my-blocks', userId] });
  }, [queryClient, userId]);

  const block = useCallback(
    async (targetId: string): Promise<ActionResult> => {
      if (!userId) return { ok: false, message: 'Melde dich an, dann geht es.' };
      if (userId === targetId) return { ok: false, message: 'Dich selbst zu sperren geht nicht.' };

      const { error } = await supabase
        .from('user_blocks')
        .upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id' });
      if (error) return { ok: false, message: 'Das Sperren hat nicht geklappt. Nochmal?' };

      refreshBlocks();
      return { ok: true };
    },
    [userId, refreshBlocks],
  );

  const unblock = useCallback(
    async (targetId: string): Promise<ActionResult> => {
      if (!userId) return { ok: false, message: 'Melde dich an, dann geht es.' };

      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', targetId);
      if (error) return { ok: false, message: 'Das Entsperren hat nicht geklappt. Nochmal?' };

      refreshBlocks();
      return { ok: true };
    },
    [userId, refreshBlocks],
  );

  const report = useCallback(
    async (targetId: string, reason: ReportReason, note?: string): Promise<ActionResult> => {
      if (!userId) return { ok: false, message: 'Melde dich an, dann geht es.' };
      if (userId === targetId) return { ok: false, message: 'Dich selbst zu melden geht nicht.' };

      const { error } = await supabase.from('user_reports').insert({
        reporter_id: userId,
        reported_id: targetId,
        reason,
        note: note?.trim() || null,
      });
      // Eine Meldung ist kein Vorgang, den man wiederholt sehen will — ein
      // zweiter Bericht zur selben Person ist erlaubt und harmlos.
      if (error) return { ok: false, message: 'Die Meldung ging nicht raus. Versuch es nochmal.' };

      return { ok: true };
    },
    [userId],
  );

  return { block, unblock, report };
}
