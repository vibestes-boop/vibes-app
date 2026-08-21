// Konto löschen — der Weg, den Apple verlangt und die DSGVO meint.
//
// ⚠️ „Löschen" heißt hier ANONYMISIEREN, und das ist keine Ausrede, sondern die
// einzig zulässige Form. `profiles.id` hängt mit ON DELETE CASCADE an
// `auth.users`, und an `profiles` hängen mit demselben Verhalten
// `product_orders`, `berkat_tips`, `coin_purchases`, `live_auctions`. Ein
// hartes Löschen nähme also nicht nur die Daten dieses Menschen, sondern auch
// den **Verkaufsbeleg des Geschäftspartners** — und das verstößt gegen § 147 AO
// und § 257 HGB (sechs bis zehn Jahre Aufbewahrung).
//
// Die DSGVO verlangt das auch gar nicht: Art. 17 Abs. 3 lit. b nimmt die
// Löschpflicht ausdrücklich zurück, soweit eine rechtliche Verpflichtung die
// Verarbeitung erfordert. Die Person verschwindet, der Beleg bleibt.
//
// Die ganze Arbeit macht `delete_own_account()` (Migration `20260821140000`).
// Diese Datei ruft sie nur und übersetzt die zwei Blocker in Sätze.

import { useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * Was nach dem Löschen bleibt — wörtlich das, was der Bildschirm anzeigt.
 *
 * Es steht hier und nicht im Bildschirm, weil es eine **Zusage** ist: Wer sie
 * ändert, ändert eine Auskunft über Rechte, nicht einen Text.
 */
export const DELETION_FACTS = {
  weg: [
    'Dein Name, dein Bild, dein Kopfbild und deine Beschreibung',
    'Wem du folgst und wer dir folgt',
    'Deine gemerkten Artikel, gespeicherten Suchen und Vormerkungen',
    'Bürgschaften, die du für andere ausgesprochen hast',
    'Deine Anmeldung — du kommst danach nicht mehr hinein',
  ],
  bleibt: [
    'Bestellungen und Zahlungen, anonymisiert',
    'Was du verkauft oder ersteigert hast',
    'Sterne, die du vergeben hast — der Text dazu wird gelöscht',
  ],
  warum:
    'Ein Kauf ist ein Beleg für zwei Menschen. Würden wir ihn löschen, verlöre auch dein '
    + 'Gegenüber seinen Nachweis — und das Gesetz verlangt, dass Rechnungen aufbewahrt werden.',
} as const;

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw error;
      // Erst danach abmelden. Die Sitzung ist serverseitig ohnehin schon weg
      // (die Funktion räumt `auth.sessions`), aber der Client hält den Token
      // noch im Speicher und würde bis zum Ablauf weiter angemeldet wirken.
      await supabase.auth.signOut();
    },
  });
}

/**
 * Die beiden Blocker in Sätze, die sagen, was zu tun ist.
 *
 * Beide sind ausdrücklich VORÜBERGEHEND und lösen sich von selbst — genau
 * deshalb sind sie mit Apples Richtlinie 5.1.1(v) vereinbar. Was nicht
 * vereinbar wäre: eine Löschung, die gar nicht geht oder nur per E-Mail an den
 * Support.
 */
export function deleteAccountError(err: unknown): string {
  const message = (err as { message?: string } | null)?.message ?? '';
  if (message.includes('account_delete_open_cart')) {
    return 'Dein Sammelkorb ist noch offen. Bezahl ihn — oder warte, bis er von selbst '
      + 'abläuft, das dauert höchstens 24 Stunden. Danach geht es.';
  }
  if (message.includes('account_delete_unshipped')) {
    return 'Jemand hat bei dir bezahlt und wartet auf sein Paket. Versende es erst — '
      + 'danach kannst du dein Konto löschen.';
  }
  if (message.includes('not_authenticated') || message.includes('42501')) {
    return 'Du bist nicht mehr angemeldet. Melde dich neu an und versuch es noch einmal.';
  }
  return 'Das hat gerade nicht geklappt. Versuch es in einem Moment noch einmal — '
    + 'es ist nichts passiert.';
}
