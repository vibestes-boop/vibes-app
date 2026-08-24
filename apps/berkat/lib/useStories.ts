// Stories — was ein Verkäufer zwischen zwei Sendungen zeigt.
//
// ── WARUM ES DAS GIBT ────────────────────────────────────────────────────────
//
// Berkats Grundzustand ist „Gerade ist niemand live". Zwischen den Sendungen
// ist die App ein stilles Regal. Das ist kein Problem für den, der schon kauft
// — aber es ist eines für den, der überlegt, hier zu VERKAUFEN. Und das
// Anwerben von Verkäufern ist seit Wochen der Engpass, nicht die Funktionen.
//
// ⚠️ Deshalb ist die Zielgruppe dieser Funktion nicht der Käufer, sondern der
// Verkäufer, der sich die App ansieht, bevor er zusagt. Wer das vergisst, baut
// die falschen Entscheidungen ein — zum Beispiel den Ring auf „nur wem du
// folgst" zu beschränken (siehe unten).
//
// ── WAS SIE NICHT IST ────────────────────────────────────────────────────────
//
// Kein Social-Feed. Berkats These bleibt: **der Abend ist das Produkt.** Eine
// Story darf neugierig machen und auf einen Termin zeigen — sie darf kein
// Ersatz dafür werden, dabei zu sein. Deshalb gibt es hier bewusst KEINE
// Reaktionen, keine Antworten, keine Umfragen (Serlo hat all das). Eine Story
// ist ein Schaufenster, kein Aufenthaltsort.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import { useSession } from './session';
import { pickAndUpload } from './uploadImage';

/** Ein einzelnes Bild einer Story. */
export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  /**
   * Das Vorschaubild für die Scheibe im Ring.
   *
   * ⚠️ Berkat schreibt es heute nie — `useCreateStory` setzt nur `media_url`,
   * und bei einem Bild wäre beides ohnehin dasselbe. Gelesen wird es trotzdem
   * (`StoryRail.coverOf`), weil es der Riegel für den Tag ist, an dem eine
   * Story ein VIDEO ist: Dann ist `media_url` eine .mp4, `expo-image` zeichnet
   * sie nicht, und die Scheibe bliebe leer.
   */
  thumbnail_url: string | null;
  media_type: string | null;
  created_at: string;
};

/** Alle Stories EINES Verkäufers, plus was der Betrachter davon kennt. */
export type StoryGroup = {
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  stories: Story[];
  /** Hat der Betrachter schon alle gesehen? Entscheidet über den Ring. */
  seen: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Alle Berkat-Stories der letzten 24 Stunden, nach Verkäufer gruppiert.
 *
 * ⚠️ BEWUSST NICHT AUF „WEM DU FOLGST" GEFILTERT — anders als Serlo.
 *
 * Serlos Fassung zeigt Guild-Mitglieder bzw. Gefolgte. Für Berkat wäre das
 * heute fatal: Ein neuer Nutzer folgt niemandem, der Ring wäre leer, und **ein
 * leerer Ring ist schlimmer als gar keiner** — er sagt „hier ist nichts los".
 * Genau derselbe Fehler wie der „Demnächst"-Streifen mit einer einzigen Karte
 * (Übergabe 62, Fund 6).
 *
 * Bei fünf Verkäufern ist „alle" ausserdem die richtige Menge. Die Reihenfolge
 * erledigt die Priorisierung: eigene zuerst, dann Ungesehenes, dann der Rest.
 *
 * ⚠️ Wenn Berkat je über ~50 sendende Verkäufer hinauswächst, gehört hier ein
 * Filter hin. Der Auslöser ist eine Zahl, keine Ahnung: Sobald der Ring mehr
 * als zwei Bildschirmbreiten lang wird, scrollt ihn niemand mehr zu Ende.
 */
export function useBerkatStories() {
  const myUserId = useSession((s) => s.userId);

  return useQuery<StoryGroup[]>({
    queryKey: ['berkat', 'stories', myUserId ?? 'anon'],
    // Eine Story lebt 24 Stunden; alle zwei Minuten nachzusehen reicht völlig
    // und hält die Realtime-Kosten bei null (Regel aus der Kostenhygiene).
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const since = new Date(Date.now() - DAY_MS).toISOString();

      // ⚠️ `.eq('app', 'berkat')` ist die ganze Trennung. `stories` ist eine
      // geerbte Serlo-Tabelle mit weit offener Lese-Policy
      // (`archived = false` reicht) — ohne diesen Filter stünden Serlos
      // Stories in Berkats Ring. Siehe `20260823210000`.
      const { data: rows, error } = await supabase
        .from('stories')
        .select('id, user_id, media_url, thumbnail_url, media_type, created_at')
        .eq('app', 'berkat')
        .eq('archived', false)
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      // ⚠️ Fehler NICHT verschlucken. Ein leerer Ring und ein kaputter Ring
      // sehen gleich aus — das ist die Fehlerklasse, an der heute vier tote
      // Meldungspfade hingen (Übergabe 75).
      if (error) throw error;
      if (!rows || rows.length === 0) return [];

      const userIds = [...new Set(rows.map((r) => r.user_id))];

      // Namen und Bilder der Verkäufer. Eine Abfrage, nicht eine pro Story.
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

      // Was der Betrachter schon gesehen hat. Ohne Anmeldung: nichts.
      let seenIds = new Set<string>();
      if (myUserId) {
        const { data: views } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('user_id', myUserId)
          .in('story_id', rows.map((r) => r.id));
        seenIds = new Set((views ?? []).map((v) => v.story_id as string));
      }

      const grouped = new Map<string, StoryGroup>();
      for (const r of rows) {
        let g = grouped.get(r.user_id);
        if (!g) {
          const p = byId.get(r.user_id);
          g = {
            userId: r.user_id,
            username: p?.username ?? null,
            avatarUrl: p?.avatar_url ?? null,
            stories: [],
            seen: true,
          };
          grouped.set(r.user_id, g);
        }
        g.stories.push(r as Story);
        if (!seenIds.has(r.id)) g.seen = false;
      }

      // Reihenfolge: eigene zuerst (man will sehen, dass die eigene Story
      // steht), dann Ungesehenes, dann der Rest nach Aktualität.
      return [...grouped.values()].sort((a, b) => {
        if (a.userId === myUserId) return -1;
        if (b.userId === myUserId) return 1;
        if (a.seen !== b.seen) return a.seen ? 1 : -1;
        const at = a.stories[a.stories.length - 1]?.created_at ?? '';
        const bt = b.stories[b.stories.length - 1]?.created_at ?? '';
        return bt.localeCompare(at);
      });
    },
  });
}

/**
 * Als gesehen vermerken.
 *
 * ⚠️ `upsert` mit `ignoreDuplicates`, nicht `insert`: Wer eine Story zweimal
 * ansieht, soll keinen Fehler auslösen. Und der Fehler wird verschluckt — ein
 * misslungener Sicht-Vermerk darf das Ansehen nicht unterbrechen. Das ist die
 * einzige Stelle dieser Datei, an der Schweigen richtig ist, weil der Nutzen
 * (der Ring wird grau) den Abbruch nicht wert wäre.
 */
export function useMarkStoryViewed() {
  const myUserId = useSession((s) => s.userId);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!myUserId) return;
      await supabase
        .from('story_views')
        .upsert({ story_id: storyId, user_id: myUserId }, { ignoreDuplicates: true });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['berkat', 'stories'] });
    },
  });
}

/**
 * Eine Story aufnehmen und hochladen.
 *
 * ⚠️ `'portrait'` als Zuschnitt: Eine Story ist hochkant, wie in jeder anderen
 * App auch. Ein quadratischer Rahmen würde die Ware oben und unten abschneiden
 * — bei Abayas ist ausgerechnet die Länge das Merkmal.
 *
 * ⚠️ Der Speicherort ist `'cover'` → `thumbnails/`. Nicht schön benannt, aber
 * Pflicht: `r2-sign` lässt nur zwei Präfixe zu (`products/images` und
 * `thumbnails`) und lehnt alles andere ab. Ein eigenes `stories/` wäre eine
 * Änderung an der Edge Function und damit an Serlos Upload-Weg.
 */
export function useCreateStory() {
  const myUserId = useSession((s) => s.userId);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<{ ok: boolean; message?: string }> => {
      if (!myUserId) return { ok: false, message: 'Melde dich an, dann geht es weiter.' };

      const url = await pickAndUpload('cover', 'portrait');
      // Kein Fehler — der Nutzer hat den Wähler abgebrochen.
      if (!url) return { ok: true };

      const { error } = await supabase.from('stories').insert({
        user_id: myUserId,
        media_url: url,
        media_type: 'image',
        // ⚠️ Ohne diesen Stempel landet die Story in SERLOS Feed. Siehe
        // `20260823210000` — die Spalte gibt es erst seit dem 23.08.2026.
        app: 'berkat',
      });
      if (error) return { ok: false, message: 'Die Story ging nicht raus. Nochmal?' };

      await qc.invalidateQueries({ queryKey: ['berkat', 'stories'] });
      return { ok: true };
    },
  });
}

/** Eigene Story zurückziehen. Die RLS lässt nur die eigene zu. */
export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (storyId: string) => {
      const { error } = await supabase.from('stories').delete().eq('id', storyId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['berkat', 'stories'] });
    },
  });
}
