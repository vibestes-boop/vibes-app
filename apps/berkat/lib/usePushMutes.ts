// Welche Push-Anlässe jemand stummgeschaltet hat.
//
// ⚠️ Die Meldung bleibt, nur der Push geht. Eine stummgeschaltete Meldung steht
// weiterhin in der Glocke — das ist der Unterschied zwischen „nicht stören" und
// „nicht informieren", und nur der erste ist eine Einstellung.
//
// ⚠️ Anwesenheit einer Zeile = STUMM. Es gibt keine `enabled`-Spalte: Der
// Normalfall („an") kostet damit keinen Datensatz, und beim Anlegen eines
// Kontos muss niemand Voreinstellungen schreiben.
//
// Durchgesetzt wird das im SQL-Trigger `fn_send_push_on_notification`
// (`20260822130000`), nicht hier. Ein Client-seitiger Filter wäre wirkungslos:
// Der Push entsteht in der Datenbank, lange bevor eine App ihn sehen könnte.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';

/**
 * Die abschaltbaren Anlässe — gespiegelt aus dem CHECK auf `push_mutes.type`.
 *
 * ⚠️ ABSCHALTBAR IST, WAS EINLÄDT — NICHT, WAS BETRIFFT. Zuschlag,
 * Zahlungserinnerung, Versand, neue Bestellung und Streitfall fehlen hier mit
 * Absicht: Überall dort hängt Geld oder eine Frist daran, und wer sie stumm
 * schalten könnte, sperrte sich selbst aus einem laufenden Geschäft aus — der
 * Sammelkorb läuft in 24 Stunden ab, und niemand bringt das mit einem Schalter
 * in Verbindung, den er vor Wochen umgelegt hat.
 *
 * Die Datenbank hält dieselbe Liste als CHECK. Wer hier einen Typ ergänzt, muss
 * dort eine Migration schreiben — sonst läuft das Speichern in einen 23514.
 */
/**
 * `audience` teilt den Bildschirm in zwei Gruppen. Bis zum 11.09.2026 stand
 * stattdessen „Nur für Verkäufer." als Hinweis an zwei Zeilen — ein Hinweis,
 * der die Arbeit einer Überschrift tat, und das zweimal. Jetzt trägt die
 * Gruppe den Titel, und der Hinweis darf sagen, was die Meldung wirklich ist.
 */
export type PushAudience = 'buyer' | 'seller';

export const MUTABLE_PUSH: {
  type: string;
  audience: PushAudience;
  label: string;
  hint: string;
}[] = [
  {
    type: 'scheduled_live_reminder',
    audience: 'buyer',
    label: 'Erinnerung an Sendungen',
    hint: '15 Minuten bevor jemand live geht, dem du folgst.',
  },
  {
    type: 'live',
    audience: 'buyer',
    label: 'Wenn jemand live geht',
    hint: 'Sofort, wenn ein Verkäufer seine Sendung aufmacht.',
  },
  {
    type: 'saved_search_hit',
    audience: 'buyer',
    label: 'Treffer auf gespeicherte Suchen',
    hint: 'Wenn etwas eingestellt wird, das zu deiner Suche passt.',
  },
  {
    type: 'auction_up',
    audience: 'buyer',
    label: 'Vorgemerkte Artikel',
    hint: 'Wenn ein Artikel drankommt, für den du die Glocke gesetzt hast.',
  },
  {
    type: 'product_saved',
    audience: 'seller',
    label: 'Jemand merkt sich deinen Artikel',
    hint: 'Wenn ein Angebot von dir aufs Herz genommen wird.',
  },
  {
    type: 'order_review',
    audience: 'seller',
    label: 'Neue Bewertung',
    hint: 'Wenn ein Käufer dich nach der Lieferung bewertet.',
  },
];

/** Die stummgeschalteten Typen als Set — `has()` ist der einzige Zugriff. */
export function usePushMutes(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'push-mutes', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('push_mutes')
        .select('type')
        .eq('user_id', userId!)
        .eq('app', 'berkat');
      if (error) throw error;
      return new Set(((data ?? []) as { type: string }[]).map((r) => r.type));
    },
  });
}

export function useTogglePushMute(userId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'push-mutes', userId] });
  }, [queryClient, userId]);

  return useMutation({
    /** `mute = true` legt die Zeile an, `false` löscht sie. */
    mutationFn: async (input: { type: string; mute: boolean }) => {
      if (!userId) throw new Error('not_authenticated');
      if (input.mute) {
        // ⚠️ `upsert`, nicht `insert`: Zwei Geräte oder ein Doppeltipp legen
        // sonst dieselbe Zeile zweimal an und laufen in den Primärschlüssel.
        // Ein Fehler für „ist schon aus" wäre Unsinn.
        const { error } = await supabase
          .from('push_mutes')
          .upsert(
            { user_id: userId, app: 'berkat', type: input.type },
            { onConflict: 'user_id,app,type' },
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('push_mutes')
          .delete()
          .eq('user_id', userId)
          .eq('app', 'berkat')
          .eq('type', input.type);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}
