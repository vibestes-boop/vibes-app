// Sendeplan — angekündigte Shows.
//
// Der Hebel Nr. 1 aus der Whatnot-Analyse: „Whatnots gesamte Retention hängt an
// planbaren, wiederkehrenden Shows … was fehlt, ist das Ritual: benannte,
// wiederkehrende Sendungen + Erinnerungs-Push."
//
// Es gibt hier **keine eigene Tabelle**. Serlo hat den ganzen Apparat seit dem
// 21.04.2026 (`scheduled_lives` + vier RPCs + pg_cron), und Berkat hängt sich
// mit `20260815120000` nur an — getrennt über die Spalte `app`.
//
// ⚠️ **Erinnert werden die Follower des Gastgebers**, 15 Minuten vorher, vom
// Cron. Es gibt bewusst keinen „Erinnere mich"-Knopf: Das wäre ein zweiter
// Mechanismus neben `follows`, und Folgen ist die Beziehung, die auch sonst
// zählt. Wer erinnert werden will, folgt — und bekommt damit gleich alle
// weiteren Termine desselben Verkäufers.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type PlannedShow = {
  id: string;
  host_id: string;
  title: string;
  scheduled_at: string;
  status: 'scheduled' | 'reminded' | 'live' | 'cancelled' | 'expired';
  women_only: boolean;
  session_id: string | null;
  /**
   * Vorschaubild des Termins.
   *
   * ⚠️ Steht hier UND in beiden `.select()`-Ketten unten. Genau diese Doppelung
   * ist am 16.08.2026 schiefgegangen: `useSellerShows` selektierte
   * `thumbnail_url` von Anfang an, der Zeilentyp trug das Feld nicht — das Bild
   * wurde geholt und weggeworfen, und eine gelaufene Show stand als grauer
   * Kreis da, obwohl ihr Cover vorlag. Wer hier ein Feld ergänzt, muss beide
   * Abfragen mit ergänzen.
   */
  cover_url: string | null;
  host: { username: string | null; avatar_url: string | null } | null;
};

/** Die Spalten für beide Abfragen — einmal, damit sie nicht auseinanderlaufen. */
const COLUMNS =
  'id, host_id, title, scheduled_at, status, women_only, session_id, cover_url, ' +
  'profiles!host_id(username, avatar_url)';

const UPCOMING: PlannedShow['status'][] = ['scheduled', 'reminded'];

/** Ein Eintrag gilt als „kommt noch", bis er zehn Minuten überfällig ist. */
const GRACE_MS = 10 * 60_000;

/**
 * So viele Wochen kann eine Reihe im Voraus stehen.
 *
 * Keine Designentscheidung, sondern die Serverregel: `schedule_live` lehnt alles
 * über 30 Tage ab. Vier Wochen passen im schlechtesten Fall gerade hinein
 * (6 Tage Vorlauf + 21 = 27 Tage), eine fünfte nie.
 */
export const MAX_WEEKS = 4;

/** Eine Reihe ist „derselbe Verkäufer, derselbe Name". */
export type Series = { next: PlannedShow; count: number };

/**
 * Aus allen Terminen je Reihe nur den **nächsten** machen.
 *
 * Ohne das stünden vier gleiche Karten nebeneinander im „Demnächst"-Streifen und
 * verdrängten die anderen Verkäufer. Der Streifen beantwortet „wann kommt als
 * Nächstes was?", nicht „zeig mir einen Kalender". Die Anzahl bleibt erhalten —
 * aus ihr wird der Hinweis „jede Woche", und genau der ist das Ritual-Signal.
 */
export function nextPerSeries(shows: PlannedShow[]): Series[] {
  const byKey = new Map<string, Series>();
  for (const show of shows) {
    const key = `${show.host_id}·${show.title}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { next: show, count: 1 });
      continue;
    }
    seen.count += 1;
    if (new Date(show.scheduled_at) < new Date(seen.next.scheduled_at)) seen.next = show;
  }
  return [...byKey.values()].sort(
    (a, b) =>
      new Date(a.next.scheduled_at).getTime() - new Date(b.next.scheduled_at).getTime(),
  );
}

type Row = Omit<PlannedShow, 'host'> & {
  profiles: { username: string | null; avatar_url: string | null } | null;
};

function toShow(row: Row): PlannedShow {
  const { profiles, ...rest } = row;
  return { ...rest, host: profiles };
}

/** Was demnächst ansteht — für die Startseite. */
export function useUpcomingShows(limit = 12) {
  return useQuery({
    queryKey: ['berkat', 'upcoming-shows', limit],
    staleTime: 60_000,
    queryFn: async (): Promise<PlannedShow[]> => {
      const { data, error } = await supabase
        .from('scheduled_lives')
        .select(COLUMNS)
        // Ohne diesen Filter stünden Serlos geplante Lives in Berkats Liste.
        .eq('app', 'berkat')
        .in('status', UPCOMING)
        .gt('scheduled_at', new Date(Date.now() - GRACE_MS).toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(toShow);
    },
  });
}

/** Die eigenen Termine — für den Verkaufen-Reiter. */
export function useMyPlannedShows(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-planned-shows', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<PlannedShow[]> => {
      const { data, error } = await supabase
        .from('scheduled_lives')
        .select(COLUMNS)
        .eq('app', 'berkat')
        .eq('host_id', userId!)
        .in('status', UPCOMING)
        .order('scheduled_at', { ascending: true })
        .limit(20);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map(toShow);
    },
  });
}

export function scheduleErrorText(message: string): string {
  if (message.includes('mind. 5 Minuten'))
    return 'Der Termin muss mindestens 5 Minuten in der Zukunft liegen.';
  if (message.includes('max. 30 Tage'))
    return 'Höchstens 30 Tage im Voraus — sonst vergisst es jeder. 🙂';
  if (message.includes('Titel ist erforderlich')) return 'Gib der Show einen Namen.';
  if (message.includes('Not authenticated') || message.includes('not_authenticated'))
    return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Sendeplan-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  return 'Der Termin ließ sich nicht eintragen. Versuch es noch einmal.';
}

export function usePlanShow(userId: string | null) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'my-planned-shows', userId] });
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'upcoming-shows'] });
    // Der dritte Ort, an dem derselbe Termin steht: der Reiter „Termine & Shows"
    // auf dem Verkäufer-Profil (`useSellerShows`). Er fehlte hier bis zum
    // 16.08.2026 — wer einen Termin eintrug und danach sein eigenes Profil
    // öffnete, sah ihn dort nicht.
    //
    // Dieselbe Regel wie beim zurückgezogenen Dauerangebot (HANDOFF 18): Wer
    // etwas an drei Orten anzeigt, muss an allen drei zurücksetzen.
    void queryClient.invalidateQueries({
      queryKey: ['berkat', 'seller-announced-shows', userId],
    });
  }, [queryClient, userId]);

  /**
   * Trägt einen Termin ein — oder eine ganze Reihe.
   *
   * Die Analyse sagt „benannte, **wiederkehrende** Sendungen". Ein Verkäufer,
   * der jede Woche daran denken muss, vergisst es irgendwann — und dann bricht
   * das Ritual für alle, die sich „donnerstags 20 Uhr" gemerkt haben.
   *
   * `MAX_WEEKS` ist keine Designentscheidung, sondern die Serverregel:
   * `schedule_live` lehnt alles ab, was mehr als 30 Tage entfernt liegt. Vier
   * Wochen passen immer hinein (spätester Fall: 6 Tage Vorlauf + 21 = 27 Tage),
   * eine fünfte nie.
   */
  const plan = useMutation({
    mutationFn: async (input: {
      title: string;
      at: Date;
      weeks?: number;
      womenOnly?: boolean;
      /**
       * Freiwillig. Bleibt es leer, setzt der Server das Cover der letzten
       * eigenen Berkat-Show ein (`20260816180000`) — der Client muss dafür
       * nichts nachschlagen und kann es auch nicht besser wissen.
       */
      coverUrl?: string | null;
    }): Promise<{ created: number; total: number }> => {
      const total = Math.max(1, Math.min(MAX_WEEKS, Math.floor(input.weeks ?? 1)));
      const title = input.title.trim();
      const created: string[] = [];
      let firstError: string | null = null;

      for (let week = 0; week < total; week += 1) {
        // Über den Kalender rechnen, NICHT über Millisekunden: `+7 * 86_400_000`
        // verschiebt die Uhrzeit um eine Stunde, sobald die Reihe über die
        // Zeitumstellung läuft — aus „20:00" würde Ende Oktober lautlos „19:00".
        const at = new Date(input.at);
        at.setDate(at.getDate() + week * 7);

        // Alle Termine einer Reihe tragen dasselbe Bild — es ist derselbe Abend,
        // nur vier Wochen lang.
        const { data, error } = await supabase.rpc('schedule_berkat_show', {
          p_scheduled_at: at.toISOString(),
          p_title: title,
          p_women_only: input.womenOnly ?? false,
          p_cover_url: input.coverUrl ?? null,
        });
        if (error) {
          firstError = error.message;
          break;
        }
        created.push(data as string);
      }

      // Nur wenn gar nichts entstanden ist, ist es ein Fehlschlag. Sonst hat der
      // Verkäufer echte Termine, und die Zahl sagt ihm ehrlich, wie viele.
      if (created.length === 0) throw new Error(firstError ?? 'unknown');
      return { created: created.length, total };
    },
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      // Kein blankes `void supabase.rpc(…)` — das baut die Anfrage nur und
      // wirft sie weg, ohne dass je etwas rausgeht (HANDOFF Abschnitt 3).
      const { error } = await supabase.rpc('cancel_scheduled_live', { p_id: id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { plan, cancel };
}

/**
 * Den angekündigten Termin mit der tatsächlich gestarteten Show verbinden.
 *
 * Ohne das bliebe der Eintrag auf `scheduled` stehen, liefe irgendwann in
 * `expired` — und wer ihn auf der Startseite antippt, käme nirgendwo hin,
 * obwohl die Show längst läuft.
 *
 * Schlägt bewusst **nicht** laut fehl: Die Show ist zu diesem Zeitpunkt schon
 * gestartet, und ein misslungenes Verknüpfen darf den Gastgeber nicht aus
 * seiner eigenen Sendung werfen.
 */
export async function linkShowToPlan(planId: string, sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('link_live_session_to_scheduled', {
    p_scheduled_live_id: planId,
    p_session_id: sessionId,
  });
  if (error && __DEV__) {
    console.warn('[Berkat] Termin konnte nicht verknüpft werden:', error.message);
  }
}

/**
 * Der Termin, der zu einem Start „gemeint" ist: der nächste eigene, der
 * höchstens zwei Stunden entfernt liegt — in beide Richtungen.
 *
 * Zwei Stunden, weil eine Show selten pünktlich beginnt und ein Verkäufer
 * genauso gut zwanzig Minuten zu früh wie eine Stunde zu spät anfängt. Ein
 * engeres Fenster hätte den häufigsten Fall verfehlt.
 */
export function matchingPlan(plans: PlannedShow[], now: number): PlannedShow | null {
  const WINDOW = 2 * 3_600_000;
  let best: PlannedShow | null = null;
  let bestDistance = Infinity;
  for (const plan of plans) {
    const distance = Math.abs(new Date(plan.scheduled_at).getTime() - now);
    if (distance <= WINDOW && distance < bestDistance) {
      best = plan;
      bestDistance = distance;
    }
  }
  return best;
}

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** „Heute 20:00", „Morgen 20:00", „Do 20:00" — nie ein nacktes Datum. */
export function formatSlot(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const dayDiff = Math.round((startOfDay(date.getTime()) - startOfDay(now)) / 86_400_000);

  if (dayDiff === 0) return `Heute ${time}`;
  if (dayDiff === 1) return `Morgen ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${DAYS[date.getDay()]} ${time}`;
  return `${date.getDate()}.${date.getMonth() + 1}. ${time}`;
}

/** „in 2 Std" / „in 14 Min" / „gleich" — die Dringlichkeit, nicht die Uhrzeit. */
export function formatUntil(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'jetzt';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'gleich';
  if (minutes < 60) return `in ${minutes} Min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} Std`;
  return `in ${Math.round(hours / 24)} Tagen`;
}
