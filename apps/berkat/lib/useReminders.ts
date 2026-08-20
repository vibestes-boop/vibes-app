// „Sag mir Bescheid, wenn der drankommt" — die Glocke je Artikel.
//
// Der leiseste der drei Wege auf einen vorbereiteten Artikel. Ein Vorabgebot
// (`usePrebid.ts`) sagt „bis hierhin gehe ich" und ist ein Gebot; eine
// Vormerkung sagt nur „ruf mich, wenn es soweit ist" und verpflichtet zu
// nichts. Wer genau EINEN Artikel will, will meistens das zweite.
//
// ⚠️ Beim Start der Auktion wird die Vormerkung VERBRAUCHT: `start_live_auction`
// legt die Meldung an und löscht die Zeile (Migration `20260819160000`). Sie hat
// genau einen Zweck, und der ist dann erfüllt.
//
// Geschrieben wird ohne RPC, direkt auf der Tabelle — anders als bei allem
// Geldnahen. Das ist hier richtig: Die Zeile trägt keine Beträge und keine
// Rechtsfolge, und die INSERT-Policy erledigt die ganze Prüfung (nur eigene
// Nutzer-ID, nur ein vorbereiteter fremder Artikel, Frauen-Only geerbt).

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/** Habe ich mir diesen Artikel vorgemerkt? */
export function useMyReminder(auctionId: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'reminder', auctionId, userId],
    enabled: Boolean(auctionId && userId),
    staleTime: 15_000,
    queryFn: async (): Promise<boolean> => {
      const { count, error } = await supabase
        .from('berkat_auction_reminders')
        .select('auction_id', { count: 'exact', head: true })
        .eq('auction_id', auctionId!)
        .eq('user_id', userId!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

/**
 * Wie viele auf diese Artikel warten — nur für den VERKÄUFER.
 *
 * Die Namen bekommt er NICHT. In einer Gemeinschaft, in der man sich kennt, ist
 * „ich will das haben" nichts, was der Verkäufer namentlich wissen muss — die
 * Begründung steht an der SELECT-Policy in `20260819160000`.
 */
export function useReminderCounts(auctionIds: string[]) {
  const key = [...auctionIds].sort().join(',');

  return useQuery({
    queryKey: ['berkat', 'reminder-counts', key],
    enabled: auctionIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc('get_reminder_counts', {
        p_auction_ids: key.split(','),
      });
      if (error) {
        // Wie bei den Vorabgeboten: Die Zahl ist eine Zugabe, kein Inhalt.
        if (__DEV__) console.warn('[Berkat] Vormerkungen zählen:', error.message);
        return new Map();
      }
      const rows = (data ?? []) as { auction_id: string; watchers: number }[];
      return new Map(rows.map((r) => [r.auction_id, r.watchers]));
    },
  });
}

export function reminderErrorText(message: string): string {
  // Die INSERT-Policy ist die einzige Hürde, und sie antwortet mit 42501. Drei
  // Fälle laufen dort zusammen: eigener Artikel, kein vorbereiteter Artikel,
  // Frauen-Only ohne Freigabe. Sie auseinanderzuhalten hieße, dem Aufrufer zu
  // verraten, welcher zutrifft — bei Frauen-Only wäre das genau das Leck, das
  // die Policy verhindert.
  if (message.includes('42501') || message.includes('row-level security'))
    return 'Für diesen Artikel geht das nicht.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST205'))
    return 'Die Vormerk-Tabelle fehlt noch in der Datenbank. Migration einspielen.';
  return message ? `Der Server sagt: ${message}` : 'Das hat nicht geklappt.';
}

export function useReminderActions(userId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'reminder'] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'reminder-counts'] });
  }, [queryClient]);

  const toggle = useMutation({
    mutationFn: async (input: { auctionId: string; on: boolean }) => {
      if (!userId) throw new Error('not_authenticated');
      if (input.on) {
        const { error } = await supabase
          .from('berkat_auction_reminders')
          // Zweimal tippen soll nicht scheitern — der Primärschlüssel ist das
          // Paar, ein zweiter Versuch ist derselbe Wunsch.
          .upsert(
            { auction_id: input.auctionId, user_id: userId },
            { onConflict: 'auction_id,user_id', ignoreDuplicates: true },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('berkat_auction_reminders')
          .delete()
          .eq('auction_id', input.auctionId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return { toggle };
}
