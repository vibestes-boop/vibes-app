// Nichtzahler melden — und die eigene Lage nachsehen.
//
// Die lange Begründung steht in `20260825160000`. Das Wichtigste in drei Sätzen:
//
// Ohne Stripe Connect kassiert der Verkäufer selbst, also sieht Berkat die
// Zahlung nie. **Wer die Zahlung nicht sieht, darf über sie nicht urteilen** —
// deshalb ist der Strike eine MELDUNG des Verkäufers, keine Feststellung des
// Systems. Und weil eine Meldung, die eine Sperre auslöst, eine Waffe ist,
// sitzen vier Bremsen auf dem Server: nur der Verkäufer dieser Auktion, erst
// 48 Stunden nach dem Zuschlag, einmal je Auktion, zurücknehmbar.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/** Ab wie vielen gültigen Strikes kein Gebot mehr durchgeht. */
export const STRIKE_LIMIT = 3;

/**
 * Wie viele gültige Strikes habe ich?
 *
 * ⚠️ Über die RPC, nicht über die Tabelle: `berkat_unpaid_count` rechnet den
 * Zwölf-Monats-Verfall mit. Selbst zu zählen hiesse, dieselbe Frist ein drittes
 * Mal abzuschreiben — und die abgelaufene mitzuzählen, sobald jemand es
 * vergisst.
 */
export function useMyStrikes(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-strikes', userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('berkat_unpaid_count');
      if (error) throw error;
      return (data as number | null) ?? 0;
    },
  });
}

export function useUnpaidActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['berkat', 'unpaid-reports'] });
    void qc.invalidateQueries({ queryKey: ['berkat', 'my-strikes'] });
  };

  const report = useMutation({
    mutationFn: async ({ auctionId, note }: { auctionId: string; note?: string }) => {
      const { data, error } = await supabase.rpc('report_unpaid_buyer', {
        p_auction_id: auctionId,
        p_note: note ?? null,
      });
      if (error) throw error;
      return (data as number | null) ?? 0;
    },
    onSuccess: invalidate,
  });

  const withdraw = useMutation({
    mutationFn: async (auctionId: string) => {
      const { error } = await supabase.rpc('withdraw_unpaid_report', {
        p_auction_id: auctionId,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { report, withdraw };
}

export function unpaidErrorText(message: string): string {
  if (message.includes('too_early'))
    return 'Noch zu früh. Gib ihm 48 Stunden — die meisten zahlen einfach spät.';
  if (message.includes('already_paid'))
    return 'Diese Bestellung ist bezahlt. Da können wir nichts melden. 🙂';
  if (message.includes('not_owner')) return 'Das darf nur, wem der Artikel gehört.';
  if (message.includes('not_sold')) return 'Für diesen Artikel gibt es keinen Zuschlag.';
  if (message.includes('auction_not_found')) return 'Den Artikel gibt es nicht mehr.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  // ⚠️ NUR der PostgREST-Code, NICHT „does not exist". Der Satz steht in
  // JEDER Postgres-Meldung über eine fehlende Spalte — am 26.08.2026 hat er
  // genau deshalb einen Tippfehler im Funktionsrumpf
  // (`payment_status` statt `status`) als „Migration einspielen" ausgegeben
  // und die Suche in die falsche Richtung geschickt. Ein Übersetzer, der zu
  // breit greift, verschluckt die Auskunft genauso wie gar keiner.
  if (message.includes('PGRST202'))
    return 'Die Meldung fehlt noch in der Datenbank. Migration einspielen.';
  return message ? `Der Server sagt: ${message}` : 'Das hat gerade nicht geklappt.';
}

/**
 * Was der Betroffene liest.
 *
 * ⚠️ Der Ton ist Absicht. Ein Mensch, der drei Zuschläge nicht bezahlt hat, ist
 * meistens kein Betrüger, sondern jemand, der drei Abende vergessen hat — und
 * er liest das gerade in einer App, in der er einkaufen wollte. Der Satz sagt
 * deshalb, WAS gilt und WAS man tun kann, ohne ein Urteil zu fällen
 * (Design-Gesetz 2: Tiefs wärmer machen).
 */
export function strikeNotice(count: number): { title: string; body: string } | null {
  if (count <= 0) return null;
  if (count < STRIKE_LIMIT) {
    const left = STRIKE_LIMIT - count;
    return {
      title: count === 1 ? 'Ein offener Zuschlag' : `${count} offene Zuschläge`,
      body:
        `Verkäufer haben gemeldet, dass hier nicht bezahlt wurde. ` +
        `Nach ${STRIKE_LIMIT} Meldungen kannst du erst mal nicht mehr mitbieten — ` +
        `${left === 1 ? 'eine' : String(left)} ${left === 1 ? 'Meldung' : 'Meldungen'} bleibt dir. ` +
        `Wenn etwas nicht stimmt, schreib dem Verkäufer: Er kann eine Meldung zurücknehmen.`,
    };
  }
  return {
    title: 'Mitbieten geht gerade nicht',
    body:
      `Es liegen ${count} Meldungen über nicht bezahlte Zuschläge vor. ` +
      `Stöbern, zuschauen und schreiben kannst du weiter. ` +
      `Sprich die Verkäufer an — wer sich geirrt hat, kann seine Meldung zurücknehmen. ` +
      `Nach zwölf Monaten verfällt eine Meldung von selbst.`,
  };
}
