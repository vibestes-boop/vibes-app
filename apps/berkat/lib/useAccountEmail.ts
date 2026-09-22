// Mit welchem Konto bin ich hier eigentlich angemeldet?
//
// ⚠️ WARUM ES DAS GIBT (22.09.2026)
// Zaur, nachdem wir eine Stunde lang an einer Zahlung feststeckten:
//
//   „eigentlich sollte es auf handy sichtbar sein welche infos man hat drin,
//    welche email man benutzt hat und so weiter, in berkat ist das nicht der
//    Fall."
//
// Er hatte recht, und es war nicht theoretisch: Auf dem iPhone lief Berkat als
// `zaur`, im Simulator als `brandwerkx1`. Beide Zustände waren richtig, und
// **beide sahen gleich aus**, weil nirgends steht, WER angemeldet ist — nur ein
// Benutzername, den man selbst gewählt hat und der nichts über das Konto sagt.
//
// Die Folgen waren teuer: Eine rote Warnung („Geld empfangen unvollständig")
// wurde für einen Fehler gehalten, obwohl sie zu einem anderen Konto gehörte.
// Danach war das Passwort des zweiten Kontos nicht auffindbar, weil die App die
// zugehörige E-Mail nie zeigt — und ohne sie findet man den Eintrag auch in der
// Nutzerverwaltung nicht, denn die sucht nach E-Mail, nicht nach Benutzernamen.
//
// ⚠️ Der Benutzername ist KEINE Kontokennung. Er ist ein Anzeigename. Die
// E-Mail ist die einzige Angabe, mit der man ein Konto wiederfindet, ein
// Passwort zurücksetzt oder zwei Geräte auseinanderhält.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * ⚠️ Aus der SITZUNG, nicht aus `profiles`. Die E-Mail gehört zu `auth.users`,
 * und dort kommt der Client ohnehin nur an seine eigene — genau richtig für
 * eine Angabe, die niemanden sonst etwas angeht.
 */
export function useAccountEmail(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'account-email', userId],
    enabled: Boolean(userId),
    // Sie ändert sich praktisch nie; ein erneutes Holen bei jedem Reiterwechsel
    // wäre eine Abfrage für eine Zeile, die stillsteht.
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session?.user.email ?? null;
    },
  });
}
