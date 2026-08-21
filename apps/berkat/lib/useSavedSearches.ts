// Gespeicherte Suchen — „sag mir Bescheid, wenn so etwas kommt".
//
// WOZU
// Eine erfolglose Suche ist sonst verloren. Wer „Abaya 42" tippt und nichts
// findet, geht — und erfährt nie, dass zwei Tage später genau das eingestellt
// wird. Aus der neunten Whatnot-Analyse (21.08.2026, Korb A); dort merkt
// dieselbe Geste dreierlei: eine Sendung, ein Angebot ODER eine Suche.
//
// ⚠️ Der Wert steigt, je LEERER das Regal ist. Bei Whatnots vollem Bestand ist
// eine gespeicherte Suche Komfort; bei Berkats dünnem ist sie der einzige
// Mechanismus, der einen erfolglosen Besuch in einen späteren verwandelt.
//
// Die Meldung entsteht serverseitig per Trigger (`notify_saved_searches`,
// Migration `20260821120000`) — nicht hier. Der Client legt nur an und löscht.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

export type SavedSearch = {
  id: string;
  query: string;
  created_at: string;
  last_notified_at: string | null;
};

const KEY = ['berkat', 'saved-searches'] as const;

/**
 * Normalisiert wie der eindeutige Index in der Datenbank
 * (`lower(btrim(query))`). Ohne dasselbe Rechnen im Client sähe „ Abaya" wie
 * eine neue Suche aus, und das Anlegen scheiterte am Index statt freundlich
 * „hast du schon" zu sagen — dieselbe Lehre wie bei `tidySize()`
 * (Abschnitt 47): **Eine Schreibregel gehört dorthin, wo der Wert entsteht.**
 */
export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function useSavedSearches(userId: string | null) {
  return useQuery({
    queryKey: [...KEY, userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async (): Promise<SavedSearch[]> => {
      const { data, error } = await supabase
        .from('berkat_saved_searches')
        .select('id, query, created_at, last_notified_at')
        .order('created_at', { ascending: false })
        // Eine Obergrenze, damit niemand sich hundert Suchen anlegt und
        // anschließend hundert Pushes bekommt. Die Zahl ist großzügig; sie
        // steht hier als Netz, nicht als Regel.
        .limit(50);
      if (error) throw error;
      return (data ?? []) as SavedSearch[];
    },
  });
}

export function useSavedSearchActions(userId: string | null) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const save = useMutation({
    mutationFn: async (raw: string) => {
      const query = normalizeQuery(raw);
      if (!userId) throw new Error('not_signed_in');
      if (query.length < 2) throw new Error('too_short');
      const { error } = await supabase
        .from('berkat_saved_searches')
        .insert({ user_id: userId, query });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('berkat_saved_searches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}

/**
 * Der Text für den Fehlschlag. Wie überall in Berkat: warm, knapp, und er sagt,
 * was zu tun ist (Design-Gesetz 2).
 *
 * `23505` ist der eindeutige Index — „schon gespeichert" ist kein Fehler,
 * sondern eine Auskunft.
 */
export function savedSearchError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  const message = (err as { message?: string } | null)?.message;
  if (code === '23505') return 'Die hast du schon gespeichert 🙂';
  if (message === 'not_signed_in') return 'Melde dich an, dann merken wir uns die Suche.';
  if (message === 'too_short') return 'Zwei Zeichen brauchen wir mindestens.';
  if (code === '42501') return 'Melde dich an, dann merken wir uns die Suche.';
  return 'Das hat gerade nicht geklappt — probier es gleich noch einmal.';
}
