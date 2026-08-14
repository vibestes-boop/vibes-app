// Ankunft bestätigen und bewerten.
//
// Beide Funktionen liegen seit Serlos Shop auf dem Server und sind sauber
// gebaut — Berkat hat sie nur nie gerufen. Folge davon: Keine Berkat-Bestellung
// erreichte je `delivered`, und weil `submit_order_review` genau das verlangt,
// konnte niemand bewertet werden. Die Stern-Kachel im Verkäufer-Sheet wäre für
// immer leer geblieben.
//
// Die Reihenfolge ist Absicht und keine Bürokratie: Erst bestätigt der Käufer,
// dass die Ware da ist, dann darf er urteilen. Eine Bewertung vor der Lieferung
// bewertet eine Erwartung, keinen Verkäufer.

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type ReviewResult = { ok: true } | { ok: false; message: string };

/** Die RPCs antworten mit `jsonb` statt zu werfen — der Fehler steht IM Ergebnis. */
type RpcAnswer = { success?: boolean; error?: string } | null;

function answerToResult(data: unknown, rpcError: { message: string } | null): ReviewResult {
  if (rpcError) {
    if (rpcError.message.includes('PGRST202') || rpcError.message.includes('does not exist')) {
      return { ok: false, message: 'Die Funktion fehlt noch in der Datenbank.' };
    }
    return { ok: false, message: 'Das hat nicht geklappt. Versuch es noch einmal.' };
  }
  const answer = data as RpcAnswer;
  if (answer?.success) return { ok: true };

  switch (answer?.error) {
    case 'not_authenticated':
      return { ok: false, message: 'Melde dich an, dann geht es weiter.' };
    case 'not_authorized':
      return { ok: false, message: 'Das ist nicht deine Bestellung.' };
    case 'order_not_found':
      return { ok: false, message: 'Diese Bestellung gibt es nicht mehr.' };
    case 'not_shipped':
      return { ok: false, message: 'Der Verkäufer hat noch nicht versendet.' };
    case 'not_delivered':
      return { ok: false, message: 'Bestätige zuerst, dass die Ware da ist.' };
    case 'invalid_rating':
      return { ok: false, message: 'Wähl zwischen einem und fünf Sternen.' };
    default:
      return { ok: false, message: 'Das hat nicht geklappt. Versuch es noch einmal.' };
  }
}

export function useOrderReviewActions(userId: string | null) {
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'my-orders', userId] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'my-reviews', userId] });
    // Der Schnitt des Verkäufers ändert sich mit — im Sheet und auf seiner Seite.
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'seller-stats'] });
  }, [queryClient, userId]);

  /** „Ist angekommen." Nur der Käufer, nur nach dem Versand. */
  const confirmDelivered = useCallback(
    async (orderId: string): Promise<ReviewResult> => {
      const { data, error } = await supabase.rpc('confirm_order_delivered', {
        p_order_id: orderId,
      });
      const res = answerToResult(data, error);
      if (res.ok) refresh();
      return res;
    },
    [refresh],
  );

  const submitReview = useCallback(
    async (orderId: string, rating: number, comment?: string): Promise<ReviewResult> => {
      const { data, error } = await supabase.rpc('submit_order_review', {
        p_order_id: orderId,
        p_rating: rating,
        p_comment: comment?.trim() || null,
      });
      const res = answerToResult(data, error);
      if (res.ok) refresh();
      return res;
    },
    [refresh],
  );

  return { confirmDelivered, submitReview };
}

/**
 * Welche meiner Bestellungen ich schon bewertet habe.
 *
 * Eine Abfrage für alle statt eine je Zeile. `order_reviews_party_read` lässt
 * mich meine eigenen Bewertungen lesen — die brauche ich, um nicht zweimal
 * nach derselben zu fragen.
 */
export function useMyReviews(userId: string | null, orderIds: string[]) {
  const key = [...orderIds].sort().join(',');

  return useQuery({
    queryKey: ['berkat', 'my-reviews', userId, key],
    enabled: Boolean(userId) && orderIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('order_reviews')
        .select('order_id, rating')
        .eq('reviewer_id', userId!)
        .in('order_id', orderIds);
      if (error) throw error;

      const map: Record<string, number> = {};
      for (const row of (data ?? []) as { order_id: string; rating: number }[]) {
        map[row.order_id] = row.rating;
      }
      return map;
    },
  });
}
