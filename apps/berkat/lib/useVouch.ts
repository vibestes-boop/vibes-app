// Bürgen — wer für diesen Verkäufer geradesteht.
//
// Der Kern ist die **Reihenfolge**, nicht die Liste: Wem der Betrachter selbst
// folgt, steht oben. „3 Bürgen" wäre wieder ein Sterne-Durchschnitt; „Amir und
// Ruslan bürgen — beiden folgst du" ist die Aussage, um die es geht.
//
// Neben jedem Namen steht, was dieser Mensch selbst wiegt (Käufe, Zuschläge).
// Ohne das ist „Amir bürgt" für einen Fremden nicht unterscheidbar von einem
// Konto, das vor zehn Minuten entstanden ist. Es gibt bewusst KEINE Hürde vorm
// Bürgen — die wäre am Anfang tot, wenn noch niemand gehandelt hat, also genau
// dann, wenn die ersten Verkäufer Vertrauen brauchen.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type Vouch = {
  id: string;
  voucher_id: string;
  note: string | null;
  username: string | null;
  avatar_url: string | null;
  /** `null` für nicht angemeldete Betrachter — die Gewichte sind nur mit Konto lesbar. */
  purchases: number | null;
  sales: number | null;
  youFollow: boolean;
};

export const VOUCH_NOTE_MAX = 140;

export function useVouches(sellerId: string | undefined, myUserId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'vouches', sellerId, myUserId],
    enabled: Boolean(sellerId),
    staleTime: 60_000,
    queryFn: async (): Promise<Vouch[]> => {
      const { data: rows, error } = await supabase
        .from('berkat_vouches')
        .select('id, voucher_id, note, created_at')
        .eq('seller_id', sellerId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;

      const list = (rows ?? []) as {
        id: string;
        voucher_id: string;
        note: string | null;
      }[];
      if (list.length === 0) return [];

      const ids = list.map((v) => v.voucher_id);

      // Drei Abfragen parallel: Namen, Gewichte, und wem ich folge. Nacheinander
      // wären es drei Wartezeiten für eine Liste, die selten mehr als ein
      // Dutzend Einträge hat.
      const [profilesRes, weightsRes, followsRes] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').in('id', ids),
        // Nur mit Konto: Die Funktion ist auf `authenticated` beschränkt, weil
        // sie sonst jedem erlauben würde, die Kaufzahl beliebiger Nutzer
        // abzufragen. Ohne Anmeldung bleiben die Gewichte leer — der NAME ist
        // ohnehin das Signal, und bieten kann man ohne Konto sowieso nicht.
        myUserId
          ? supabase.rpc('get_vouch_weights', { p_user_ids: ids })
          : Promise.resolve({ data: null, error: null }),
        myUserId
          ? supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', myUserId)
              .in('following_id', ids)
          : Promise.resolve({ data: null, error: null }),
      ]);

      const names = new Map(
        ((profilesRes.data ?? []) as { id: string; username: string | null; avatar_url: string | null }[]).map(
          (p) => [p.id, p],
        ),
      );
      const weights = new Map(
        ((weightsRes.data ?? []) as { user_id: string; purchases: number; sales: number }[]).map(
          (w) => [w.user_id, w],
        ),
      );
      const followed = new Set(
        ((followsRes.data ?? []) as { following_id: string }[]).map((f) => f.following_id),
      );

      const enriched: Vouch[] = list.map((v) => {
        const profile = names.get(v.voucher_id);
        const weight = weights.get(v.voucher_id);
        return {
          id: v.id,
          voucher_id: v.voucher_id,
          note: v.note,
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
          purchases: weight ? weight.purchases : null,
          sales: weight ? weight.sales : null,
          youFollow: followed.has(v.voucher_id),
        };
      });

      // Die eigentliche Aussage: erst die, die der Betrachter kennt. Danach
      // die, die hier am meisten gehandelt haben.
      return enriched.sort((a, b) => {
        if (a.youFollow !== b.youFollow) return a.youFollow ? -1 : 1;
        const wa = (a.purchases ?? 0) + (a.sales ?? 0);
        const wb = (b.purchases ?? 0) + (b.sales ?? 0);
        return wb - wa;
      });
    },
  });
}

/** „Amir und Ruslan bürgen — beiden folgst du" statt „3 Bürgen". */
export function vouchSummary(vouches: Vouch[]): string | null {
  if (vouches.length === 0) return null;
  const known = vouches.filter((v) => v.youFollow);
  const names = (known.length > 0 ? known : vouches)
    .slice(0, 2)
    .map((v) => v.username ?? 'jemand');
  const rest = vouches.length - names.length;

  const lead =
    names.length === 1 ? `${names[0]} bürgt` : `${names[0]} und ${names[1]} bürgen`;
  const tail = rest > 0 ? ` · +${rest}` : '';

  if (known.length === 0) return `${lead}${tail}`;
  return `${lead}${known.length > 1 ? ' — beiden folgst du' : ' — du folgst ihm'}${tail}`;
}

export function vouchErrorText(message: string): string {
  if (message.includes('berkat_vouches_once')) return 'Du bürgst schon für ihn.';
  if (message.includes('berkat_vouches_not_self'))
    return 'Für sich selbst zu bürgen wäre keine Aussage. 🙂';
  if (message.includes('note_check') || message.includes('char_length'))
    return `Ein Satz zwischen 3 und ${VOUCH_NOTE_MAX} Zeichen — oder gar keiner.`;
  if (message.includes('not_authenticated') || message.includes('JWT'))
    return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('42P01'))
    return 'Die Bürgen-Tabelle fehlt noch in der Datenbank. Migration einspielen.';
  return 'Das hat nicht geklappt. Versuch es noch einmal.';
}

export function useVouchActions(sellerId: string | undefined, myUserId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'vouches', sellerId] });
  }, [queryClient, sellerId]);

  const add = useMutation({
    mutationFn: async (note: string | null) => {
      if (!myUserId) throw new Error('not_authenticated');
      const trimmed = note?.trim();
      const { error } = await supabase.from('berkat_vouches').insert({
        seller_id: sellerId,
        voucher_id: myUserId,
        note: trimmed ? trimmed : null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!myUserId) throw new Error('not_authenticated');
      const { error } = await supabase
        .from('berkat_vouches')
        .delete()
        .eq('seller_id', sellerId!)
        .eq('voucher_id', myUserId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove };
}
