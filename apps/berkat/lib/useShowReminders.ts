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

import { useRef } from 'react';
import { useIsMutating, useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

const KEY = ['berkat', 'show-reminders'] as const;
const changeKey = (userId: string | null, scheduleId: string) => [...KEY, 'change', userId, scheduleId];
type ReminderChange = { owner: string; scheduleId: string; on: boolean };

/** One shared query for all visible cards, explicitly bound to its account. */
export function useMyShowReminders(userId: string | null) {
  return useQuery({
    queryKey: [...KEY, userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    retry: 1,
    networkMode: 'always',
    refetchOnReconnect: true,
    queryFn: async ({ signal }): Promise<Set<string>> => {
      const { data, error } = await supabase.from('berkat_show_reminders')
        .select('schedule_id').eq('user_id', userId!).abortSignal(signal).retry(false);
      if (error) throw error;
      if (!data) throw new Error('reminder_state_missing');
      return new Set(data.map((row) => (row as { schedule_id: string }).schedule_id));
    },
  });
}

export function useShowReminderActions(userId: string | null, scheduleId: string) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationKey: changeKey(userId, scheduleId),
    retry: false,
    // Fail visibly while offline rather than enqueue a write for a later session.
    networkMode: 'always',
    mutationFn: async ({ owner, scheduleId: target, on }: ReminderChange) => {
      if (on) {
        const { error } = await supabase.from('berkat_show_reminders')
          .upsert({ schedule_id: target, user_id: owner }, { ignoreDuplicates: true }).retry(false);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('berkat_show_reminders').delete()
          .eq('schedule_id', target).eq('user_id', owner).retry(false);
        if (error) throw error;
      }
    },
    onMutate: ({ owner }) => qc.cancelQueries({ queryKey: [...KEY, owner], exact: true }),
    onSuccess: async (_, { owner, scheduleId: target, on }) => {
      const key = [...KEY, owner];
      await qc.cancelQueries({ queryKey: key, exact: true });
      // Merge only the confirmed item so concurrent changes keep each other.
      qc.setQueryData<Set<string>>(key, previous => {
        if (!previous) return previous;
        const next = new Set(previous);
        if (on) next.add(target); else next.delete(target);
        return next;
      });
      // Reminders are consumed by the server when the event starts.
      void qc.invalidateQueries({ queryKey: key, exact: true });
    },
  });
  return { toggle };
}

/** State and in-flight requests are shared between home and profile cards. */
export function useShowReminder(scheduleId: string, userId: string | null) {
  const qc = useQueryClient();
  const state = useMyShowReminders(userId);
  const { toggle } = useShowReminderActions(userId, scheduleId);
  const locked = useRef(false);
  const mutationKey = changeKey(userId, scheduleId);
  const pending = useIsMutating({ mutationKey, exact: true }) > 0;
  const changes = useMutationState({ filters: { mutationKey, exact: true }, select: mutation => mutation.state.status });
  const lastChange = changes[changes.length - 1];
  const enabled = Boolean(userId && scheduleId);
  const on = enabled && Boolean(state.data?.has(scheduleId));
  const needsLoad = enabled && (state.isError || state.data === undefined);
  const busy = enabled && (pending || (needsLoad && state.isFetching));
  const error = enabled && state.isError ? 'Deine Erinnerung konnte nicht geladen werden. Bitte lade sie erneut.'
    : enabled && lastChange === 'error' ? 'Die Erinnerung konnte nicht geändert werden. Bitte versuche es erneut.' : null;
  const label = busy ? 'Einen Moment …' : needsLoad ? 'Erneut laden'
    : error ? 'Erneut versuchen' : on ? 'Vorgemerkt' : 'Erinnern';

  const flip = async () => {
    if (!enabled || !userId || locked.current || qc.isMutating({ mutationKey, exact: true })) return;
    locked.current = true;
    try {
      const current = qc.getQueryState<Set<string>>([...KEY, userId]);
      if (current?.status !== 'success' || !current.data) {
        await state.refetch({ cancelRefetch: false });
        return;
      }
      await toggle.mutateAsync({ owner: userId, scheduleId, on: !current.data.has(scheduleId) });
    } catch {
      // The shared query/mutation state keeps a visible retry at the affected card.
    } finally {
      locked.current = false;
    }
  };
  return { on, flip, busy, error, label, needsLoad };
}

export function showReminderError(message: string): string {
  if (message.includes('not_signed_in')) return 'Melde dich an, dann erinnern wir dich.';
  if (message.includes('42501') || message.includes('permission'))
    return 'Melde dich an, dann erinnern wir dich.';
  // ⚠️ NUR der PostgREST-Code, NICHT „does not exist". Der Satz steht in
  // JEDER Postgres-Meldung über eine fehlende Spalte — am 26.08.2026 hat er
  // genau deshalb einen Tippfehler im Funktionsrumpf
  // (`payment_status` statt `status`) als „Migration einspielen" ausgegeben
  // und die Suche in die falsche Richtung geschickt. Ein Übersetzer, der zu
  // breit greift, verschluckt die Auskunft genauso wie gar keiner.
  if (message.includes('PGRST205'))
    return 'Die Vormerkung fehlt noch in der Datenbank. Migration einspielen.';
  // Kein Sammel-Satz: Was der Server sagt, steht hier (die Regel aus
  // `useStanding.ts`).
  return message ? `Der Server sagt: ${message}` : 'Das hat gerade nicht geklappt.';
}
