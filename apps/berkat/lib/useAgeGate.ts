// Die Altersschranke — Selbstauskunft, einmal, bevor das erste Gebot zählt.
//
// WARUM ES SIE GIBT
// Ein Gebot ist bei Berkat eine bindende Willenserklärung (Übergabe 19). Wer
// zwischen 7 und 18 ist, ist beschränkt geschäftsfähig — § 106 BGB —, und ein
// Vertrag, der ihm nicht nur Vorteile bringt, ist ohne Einwilligung der Eltern
// **schwebend unwirksam** (§§ 107, 108). Bietet ein Sechzehnjähriger und
// gewinnt, hängt der Kauf in der Luft: Der Verkäufer hat die Ware
// zurückgehalten, die Auktion ist gelaufen, und ob daraus Geld wird,
// entscheiden Fremde.
//
// ⚠️ DER RIEGEL LIEGT AUF DEM SERVER, NICHT HIER.
// `20260825120000` hängt Trigger an `live_bids`, `berkat_offers` und
// `berkat_tips`. Diese Datei ist die **Höflichkeit** davor: Sie fragt, bevor
// jemand in eine Absage läuft. Wer sie umgeht, kommt trotzdem nicht durch.
//
// Das ist die gleiche Arbeitsteilung wie überall im Geldnahen: „Der Server
// entscheidet, der Client zeigt an" (Übergabe 4).

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * `anonymous` — nicht angemeldet · `missing` — noch nichts gesagt ·
 * `minor` — zu jung · `adult` — durch.
 *
 * ⚠️ `missing` und `minor` auseinanderzuhalten ist der ganze Zweck dieses Typs.
 * Mit einem blossen Ja/Nein bekäme ein Erwachsener, der die Frage nur noch
 * nicht beantwortet hat, dieselbe Abfuhr wie ein Sechzehnjähriger — und keinen
 * Weg, das richtigzustellen.
 */
export type BirthDateState = 'anonymous' | 'missing' | 'minor' | 'adult';

const KEY = ['berkat', 'birth-date-state'] as const;

/**
 * Was der Server über das Alter dieses Kontos weiss.
 *
 * ⚠️ Es kommt **kein Datum** zurück, nur der Zustand. Das Geburtsdatum ist
 * personenbezogen und hat auf keinem Gerät etwas zu suchen; die Spalte trägt
 * deshalb bewusst kein `GRANT` (Migration, Punkt 1).
 *
 * `staleTime: Infinity` ist hier richtig und nicht faul: Der Wert ändert sich
 * genau einmal im Leben eines Kontos, und zwar durch `useSetBirthDate` — das
 * setzt ihn selbst.
 */
export function useBirthDateState(userId: string | null) {
  return useQuery({
    queryKey: [...KEY, userId],
    enabled: Boolean(userId),
    staleTime: Infinity,
    queryFn: async (): Promise<BirthDateState> => {
      const { data, error } = await supabase.rpc('birth_date_state');
      if (error) throw error;
      return (data as BirthDateState | null) ?? 'missing';
    },
  });
}

export function useSetBirthDate(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (iso: string): Promise<BirthDateState> => {
      const { data, error } = await supabase.rpc('set_my_birth_date', { p_date: iso });
      if (error) throw error;
      return (data as BirthDateState | null) ?? 'missing';
    },
    onSuccess: (state) => {
      // Direkt setzen statt zu verwerfen: Der Nutzer steht in einer laufenden
      // Auktion und soll sofort bieten können, nicht auf einen Nachladetakt
      // warten.
      qc.setQueryData([...KEY, userId], state);
    },
  });
}

/**
 * Drei Zahlen zu einem ISO-Datum — oder `null` mit einem Grund.
 *
 * ⚠️ Bewusst KEIN nativer Datums-Wähler. `@react-native-community/datetimepicker`
 * ist ein natives Modul und steckt im TestFlight-Build `1.0.0 (1)` nicht drin —
 * es einzubauen hiesse, die Altersschranke an einen neuen Store-Build zu
 * koppeln (Übergabe 12). Drei Zahlenfelder gehen per OTA raus, heute.
 *
 * ⚠️ Geprüft wird **hier UND auf dem Server**. `set_my_birth_date` weist ein
 * Datum in der Zukunft oder vor 1900 ebenfalls ab; diese Fassung existiert nur,
 * damit der Nutzer den Grund sofort liest statt nach einem Rundweg.
 */
export function toIsoDate(
  day: string,
  month: string,
  year: string,
): { iso: string; error: null } | { iso: null; error: string } {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);

  if (!day || !month || !year) return { iso: null, error: 'Bitte alle drei Felder ausfüllen.' };
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return { iso: null, error: 'Bitte nur Zahlen eintragen.' };
  }
  if (y < 1900 || y > new Date().getFullYear()) {
    return { iso: null, error: 'Das Jahr sieht nicht wie ein Geburtsjahr aus.' };
  }
  if (m < 1 || m > 12) return { iso: null, error: 'Den Monat gibt es nicht.' };
  if (d < 1 || d > 31) return { iso: null, error: 'Den Tag gibt es nicht.' };

  // ⚠️ Der 31. Februar besteht jede Einzelprüfung oben. Erst der Umweg über
  // ein echtes Datum fängt ihn: JavaScript rollt ihn auf den 3. März weiter,
  // und genau dieses Weiterrollen ist der Nachweis, dass es den Tag nicht gab.
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return { iso: null, error: 'Diesen Tag gibt es in dem Monat nicht.' };
  }
  if (probe.getTime() > Date.now()) {
    return { iso: null, error: 'Das Datum liegt in der Zukunft.' };
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return { iso: `${y}-${pad(m)}-${pad(d)}`, error: null };
}

/**
 * Erkennt die Absage des Servers wieder — der Netz-Fall.
 *
 * Jeder Geld-Weg, den die Oberfläche NICHT vorher abfängt, endet in einer
 * dieser zwei Meldungen. Wer sie hier durchreicht, kann dem Nutzer eine
 * Antwort geben statt „Das hat nicht geklappt".
 */
export function ageGateReason(message: string | null | undefined): 'missing' | 'minor' | null {
  if (!message) return null;
  if (message.includes('birth_date_missing')) return 'missing';
  if (message.includes('under_age')) return 'minor';
  return null;
}

export function ageGateError(message: string): string {
  if (message.includes('birth_date_locked'))
    return 'Dein Geburtsdatum steht schon fest und lässt sich nicht selbst ändern. Schreib uns, wenn etwas nicht stimmt.';
  if (message.includes('birth_date_implausible'))
    return 'Das Datum sieht nicht wie ein Geburtsdatum aus. Schau nochmal drauf.';
  if (message.includes('birth_date_required')) return 'Da fehlt noch das Datum.';
  if (message.includes('under_age'))
    return 'Mitbieten geht erst ab 18 — ein Gebot ist ein verbindlicher Kauf. Stöbern und zuschauen kannst du weiter. 🙂';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Altersabfrage fehlt noch in der Datenbank. Migration einspielen.';
  return message ? `Der Server sagt: ${message}` : 'Das hat gerade nicht geklappt.';
}

/**
 * Der Türsteher für einen Geld-Weg.
 *
 * `ensure()` gibt `true` zurück, wenn weitergegangen werden darf, und `false`,
 * wenn stattdessen gefragt werden muss — der Aufrufer öffnet dann das Blatt.
 */
export function useAgeGate(userId: string | null) {
  const { data: state } = useBirthDateState(userId);

  const ensure = useCallback(() => state === 'adult', [state]);

  return { state: state ?? 'missing', ensure, isAdult: state === 'adult' };
}
