// Wer gerade im Raum ist — nur für den Gastgeber.
//
// WARUM ES DAS GIBT
// Ein Verkäufer, der jemanden mit Namen begrüßt, behält den Zuschauer. Das ist
// für Phase 0 mehr wert als jede weitere Funktion: Bei fünf Verkäufern, die man
// einzeln überzeugt hat, entscheidet die zweite Sendung darüber, ob es eine
// dritte gibt — und die zweite Sendung entscheidet sich daran, ob beim ersten
// Mal jemand zurückgeschrieben hat.
//
// Whatnot macht es genauso: Tipp auf die Zuschauerzahl öffnet die Liste, mit
// einem @-Knopf je Zeile, um jemanden im Chat anzusprechen.
//
// ⚠️ NUR DER GASTGEBER. Das ist keine Nachahmung, sondern Berkats eigene
// Grenze. `live_reactions_select` stand am 14.08.2026 auf `USING(true)` und gab
// damit die Teilnehmerliste JEDES Frauen-Only-Raums preis — der Fund, der die
// Policy-Regel in Abschnitt 5 ausgelöst hat. Eine für Zuschauer sichtbare Liste
// würde genau das zurückbringen.
//
// Die Datenbank setzt das ohnehin durch, unabhängig von dieser Datei:
//
//   lsv_select_host  -- der Gastgeber darf die Liste lesen
//   lsv_select_self  -- jeder darf seine eigene Zeile lesen
//
// Ein Zuschauer, der diese Abfrage trotzdem abschickt, bekommt genau eine Zeile
// zurück: sich selbst.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type LiveViewer = {
  user_id: string;
  joined_at: string;
  username: string | null;
  avatar_url: string | null;
};

type Row = {
  user_id: string;
  joined_at: string;
  profiles: { username: string | null; avatar_url: string | null } | null;
};

/**
 * Die Anwesenden einer Sendung.
 *
 * ⚠️ `enabled` hängt an `open`, nicht nur am Gastgeber-Sein. Die Liste läuft
 * also nur, solange das Blatt offen ist — und dann mit einem Takt.
 *
 * Der Takt ist Absicht und die Lehre vom 16.08.2026: Eine Abfrage in einem
 * Bildschirm, der offen stehen bleibt, hat sonst NICHTS, was sie neu lädt (der
 * Sammelkorb blieb an genau dieser Stelle eine ganze Sendung lang stumm). Kein
 * Realtime-Abo, weil das eine Veröffentlichung der Tabelle voraussetzt, die
 * niemand geprüft hat — und ein Abo, das still nicht greift, ist schlechter als
 * ein Takt, der greift.
 *
 * Zehn Sekunden reichen: Wer den Raum betritt, will nicht in derselben Sekunde
 * begrüßt werden, und das Blatt ist selten länger als eine Minute offen.
 */
export function useLiveViewers(sessionId: string | undefined, open: boolean) {
  return useQuery({
    queryKey: ['berkat', 'live-viewers', sessionId],
    enabled: Boolean(sessionId) && open,
    refetchInterval: open ? 10_000 : false,
    staleTime: 5_000,
    queryFn: async (): Promise<LiveViewer[]> => {
      const { data, error } = await supabase
        .from('live_session_viewers')
        .select('user_id, joined_at, profiles!user_id(username, avatar_url)')
        .eq('session_id', sessionId!)
        // Zuletzt gekommen zuerst — wen man begrüßen will, ist der, der gerade
        // reingekommen ist.
        .order('joined_at', { ascending: false })
        // Bei fünf Verkäufern ist das weit jenseits des Realistischen; die
        // Grenze steht trotzdem da, damit ein voller Raum die Liste nicht in
        // eine Endlos-Rolle verwandelt.
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map((row) => ({
        user_id: row.user_id,
        joined_at: row.joined_at,
        username: row.profiles?.username ?? null,
        avatar_url: row.profiles?.avatar_url ?? null,
      }));
    },
  });
}

/** „gerade eben", „seit 3 Min", „seit 1 Std" — wie lange jemand schon zusieht. */
export function watchingSince(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `seit ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  return `seit ${hours} Std`;
}
