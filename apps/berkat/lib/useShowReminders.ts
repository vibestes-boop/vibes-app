// „Erinner mich an diesen Abend" — eine Sendung vormerken, ohne zu folgen.
//
// ── ⚠️ WARUM ES DAS GIBT, OBWOHL EINE NOTIZ DAS GEGENTEIL SAGT ──────────────
//
// Im Kopf von `useSchedule.ts` steht seit dem 15.08.2026:
//
//   „Es gibt bewusst keinen ‚Erinnere mich'-Knopf: Das wäre ein zweiter
//    Mechanismus neben `follows` … Wer erinnert werden will, folgt."
//
// Die Begründung ist gut und hat ein Loch, das erst in Phase 0 aufgeht: **Am
// ersten Abend folgt niemand niemandem.** Ein Verkäufer, der zum ersten Mal
// sendet, hat null Follower — sein Erinnerungs-Fanout geht an null Menschen.
// Genau der Abend, an dem Publikum am meisten zählt, ist der, an dem der
// Mechanismus nichts tut.
//
// Folgen ist eine Aussage über eine PERSON („zeig mir alles von dem").
// Vormerken ist eine über einen TERMIN („ich habe Freitag um acht Zeit").
// Zwei Fragen; die zweite kann man beantworten, ohne die erste zu stellen.
//
// ⚠️ Der Preis, vor dem die alte Notiz warnt, ist echt: zwei Wege zu derselben
// Meldung. Er ist auf dem Server bezahlt — der Fanout in `20260825140000` ist
// ein **UNION**, wer folgt UND vormerkt bekommt EINE Meldung. Am Nachbau
// gemessen, nicht angenommen.
//
// ⚠️ Die Vormerkung wird beim Erinnern VERBRAUCHT (die Zeile wird gelöscht),
// genau wie die Glocke am Artikel. Sie hat einen Zweck, und der ist dann
// erfüllt. Für die Oberfläche heisst das: Nach dem Erinnerungs-Push steht der
// Knopf wieder leer da — das ist richtig, der Termin ist ja gleich.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

const KEY = ['berkat', 'show-reminders'] as const;

/**
 * Welche Termine habe ich vorgemerkt?
 *
 * EINE Abfrage für alle sichtbaren Karten statt einer je Karte — der
 * „Demnächst"-Streifen zeigt bis zu zwölf, und zwölf Abfragen für ein Glöckchen
 * wären die Kostenhygiene-Sünde aus Übergabe 4. Die RLS filtert ohnehin auf das
 * eigene Konto; ein `eq('user_id', …)` wäre eine zweite Wahrheit darüber.
 */
export function useMyShowReminders(userId: string | null) {
  return useQuery({
    queryKey: [...KEY, userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('berkat_show_reminders')
        .select('schedule_id');
      if (error) throw error;
      return new Set((data ?? []).map((r) => (r as { schedule_id: string }).schedule_id));
    },
  });
}

export function useShowReminderActions(userId: string | null) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: async ({ scheduleId, on }: { scheduleId: string; on: boolean }) => {
      if (!userId) throw new Error('not_signed_in');
      if (on) {
        const { error } = await supabase
          .from('berkat_show_reminders')
          // ⚠️ `ignoreDuplicates` statt eines Fehlers: Ein zweiter Tipp auf
          // denselben Knopf ist kein Fehlverhalten, sondern ein doppelter
          // Finger. Der Primärschlüssel fängt es ab, und der Nutzer soll
          // davon nichts merken.
          .upsert({ schedule_id: scheduleId, user_id: userId }, { ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('berkat_show_reminders')
          .delete()
          .eq('schedule_id', scheduleId)
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });

  return { toggle };
}

export function showReminderError(message: string): string {
  if (message.includes('not_signed_in')) return 'Melde dich an, dann erinnern wir dich.';
  if (message.includes('42501') || message.includes('permission'))
    return 'Melde dich an, dann erinnern wir dich.';
  if (message.includes('does not exist') || message.includes('PGRST205'))
    return 'Die Vormerkung fehlt noch in der Datenbank. Migration einspielen.';
  // Kein Sammel-Satz: Was der Server sagt, steht hier (die Regel aus
  // `useStanding.ts`).
  return message ? `Der Server sagt: ${message}` : 'Das hat gerade nicht geklappt.';
}

/**
 * Der Knopf-Zustand für EINEN Termin, aus der gemeinsamen Menge.
 *
 * Bewusst kein eigener Hook mit eigener Abfrage je Karte — siehe oben.
 */
export function useShowReminder(scheduleId: string, userId: string | null) {
  const { data: marked } = useMyShowReminders(userId);
  const { toggle } = useShowReminderActions(userId);
  const on = Boolean(marked?.has(scheduleId));
  const flip = useCallback(
    () => toggle.mutateAsync({ scheduleId, on: !on }),
    [toggle, scheduleId, on],
  );
  return { on, flip, busy: toggle.isPending };
}
