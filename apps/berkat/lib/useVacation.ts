/**
 * Urlaubsmodus — ein Schalter statt zwanzig Rückzügen
 * ============================================================================
 *
 * Wer zwei Wochen weg ist und seine Angebote stehen lässt, bezahlt den Urlaub
 * mit seinem Vertrauenswert: Die durchschnittliche Versandzeit ist eine der
 * drei Kacheln auf dem öffentlichen Profil (Übergabe 10). Genau dieser
 * Verkäufer ist der, den Phase 0 halten muss.
 *
 * ⚠️ EIN DATUM, KEIN SCHALTER. Es läuft von selbst ab — ein Boolean bleibt
 * stehen, bis jemand daran denkt, und der häufigste Fall ist, dass niemand
 * daran denkt. Ausserdem lässt sich ein Datum ANZEIGEN: „wieder da am 5.
 * September" ist eine Auskunft, „im Urlaub" ist eine Entschuldigung.
 *
 * Die Sichtbarkeit regelt die Lese-Policy des Regals (`20260823150000`), nicht
 * dieser Hook — sonst müsste die Regel an sechs Flächen stehen (Startseite,
 * Marktplatz, Kategorie, Suche, Profil, „Mehr von diesem Verkäufer").
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import { invalidateShelfSurfaces } from './useStanding';

/** Läuft der Urlaub gerade? Ein Datum in der Vergangenheit zählt nicht. */
export function onVacation(until: string | null | undefined): boolean {
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

/**
 * „wieder da am 5. September" — oder null, wenn kein Urlaub läuft.
 *
 * Bewusst das Rückkehr-Datum und nicht die Dauer: „noch 11 Tage" ist eine
 * Zahl, die der Leser erst umrechnen muss.
 */
export function vacationLabel(until: string | null | undefined): string | null {
  if (!onVacation(until)) return null;
  const d = new Date(until!);
  return `wieder da am ${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}`;
}

/** Die Kacheln im Blatt. Ein freies Datum bräuchte einen nativen Wähler
 *  (`@react-native-community/datetimepicker` → Build, Übergabe 26). */
export const VACATION_PRESETS: { days: number; label: string }[] = [
  { days: 3,  label: 'bis übermorgen' },
  { days: 7,  label: 'eine Woche' },
  { days: 14, label: 'zwei Wochen' },
  { days: 30, label: 'einen Monat' },
];

/**
 * Setzt oder beendet den Urlaub. `null` beendet ihn.
 *
 * ⚠️ Gerechnet wird über den KALENDER, nicht über Millisekunden.
 * `+ days * 86_400_000` verschiebt die Uhrzeit um eine Stunde, sobald der
 * Zeitraum über die Zeitumstellung läuft — dieselbe Falle wie bei den
 * wiederkehrenden Terminen (Übergabe 13).
 */
export function useSetVacation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (days: number | null) => {
      let until: string | null = null;
      if (days !== null) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        // Bis Mitternacht des Rückkehrtags — sonst endet der Urlaub zur
        // Uhrzeit, zu der man ihn eingeschaltet hat, und das Regal geht mitten
        // in der Nacht wieder auf.
        d.setHours(23, 59, 59, 0);
        until = d.toISOString();
      }
      const { error } = await supabase.rpc('set_seller_vacation', { p_until: until });
      if (error) throw new Error(vacationError(error.message));
      return until;
    },
    // ⚠️ ÜBER DIE GEMEINSAME FUNKTION, nicht mit einer eigenen Liste. Hier
    // stand bis zum 23.08.2026 eine nachgebaute Aufzählung — und ihr fehlten
    // `category-listings` und `shop-count`. Die Ware blieb also auf der
    // Kategorie-Seite und im Zähler der Startseite stehen.
    onSuccess: () => {
      invalidateShelfSurfaces(qc);
      // ⚠️ PLUS `seller-kind`, und das ist KEIN Duplikat: Dort hängt der
      // Urlaubs-Zustand selbst — die Zeile „im Urlaub" im Konto und die grüne
      // Karte auf dem Versand-Bildschirm. Beim Zusammenlegen auf die
      // gemeinsame Funktion war er mir zuerst herausgefallen; danach blieb die
      // Karte nach dem Umschalten stehen. „Jede Abweichung erst als Absicht
      // lesen, dann als Versehen" (Übergabe 53).
      void qc.invalidateQueries({ queryKey: ['berkat', 'seller-kind'] });
    },
  });
}

export function vacationError(raw: string): string {
  if (raw.includes('vacation_in_past')) return 'Der Zeitpunkt liegt schon hinter dir.';
  if (raw.includes('vacation_too_long')) return 'Länger als ein Jahr geht nicht — zieh die Angebote dann lieber zurück.';
  if (raw.includes('not_authenticated')) return 'Melde dich an, um das zu ändern.';
  return 'Der Urlaub ließ sich nicht speichern.';
}
