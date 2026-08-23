// Highlights — was auf dem Verkäufer-Profil stehen bleibt.
//
// ── WARUM ES DAS GIBT ────────────────────────────────────────────────────────
//
// Die zweite Hälfte der Stories, und die wichtigere. Eine Story ist nach 24
// Stunden weg; ein Profil, das nur davon lebt, ist an jedem Tag ohne Posten
// wieder leer. Die Zielgruppe ist dieselbe wie bei den Stories und NICHT der
// Käufer: der Verkäufer, der sich die App ansieht, bevor er zusagt. Der schaut
// auf ein Profil, nicht auf einen Ring — und ein leeres Profil sagt „hier ist
// noch nichts".
//
// Ein Highlight ist deshalb bewusst KEIN Story-Archiv, sondern ein Schaufenster:
// „Abayas", „Versand", „Was Kundinnen sagen". Es entsteht aus vorhandenen
// Stories ODER aus frisch gewählten Fotos — der zweite Weg ist der wichtigere,
// weil ein neuer Verkäufer noch keine Story hat und sein Profil trotzdem heute
// füllen soll.
//
// ── ⚠️ DIE FALLE, DIE SERLO SCHON EINMAL ERWISCHT HAT ────────────────────────
//
// Ein Highlight, das nur die `media_url` der Story speichert, wird TOT, sobald
// die Story abläuft: Zeile gelöscht → Trigger reiht die R2-Datei ein → der
// Cleanup löscht sie → leeres Cover, kein Inhalt. Wer Highlights ohne die Edge
// Function `highlight-copy-media` baut, baut den Fehler nach.
//
// Die Function kopiert per S3-`CopyObject` nach `highlights/{userId}/` — ein
// Pfad, der in `r2-delete` NICHT in `ALLOWED_ROOTS` steht (`posts`,
// `thumbnails`, `avatars`). Die Datei ist damit für den Cleanup unerreichbar.
//
// ⚠️ Das gilt AUCH für frisch hochgeladene Fotos, obwohl die zu keiner Story
// gehören: `pickAndUpload('cover', …)` legt sie unter `thumbnails/` ab, und das
// ist einer der drei löschbaren Pfade. Deshalb geht JEDES Medium durch die
// Kopie, nicht nur das aus einer Story.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';
import { useSession } from './session';

/** Ein einzelnes Bild in einem Highlight. */
export type HighlightItem = {
  media_url: string;
  media_type: 'image';
  thumbnail_url?: string | null;
};

export type Highlight = {
  id: string;
  user_id: string;
  title: string;
  /** Das Titelbild — das erste Medium. */
  cover_url: string;
  items: HighlightItem[];
  created_at: string;
};

/** Titel eines Highlights. Kurz, weil er unter eine 66er-Scheibe passen muss. */
export const HIGHLIGHT_TITLE_MAX = 20;
/** Mehr passt in ein Schaufenster nicht, ohne dass es ein Archiv wird. */
export const HIGHLIGHT_ITEMS_MAX = 12;

/**
 * Die Highlights eines Verkäufers.
 *
 * ⚠️ `.eq('app', 'berkat')` ist wieder die ganze Trennung. `story_highlights`
 * ist eine geerbte Serlo-Tabelle, ihre Lese-Policy lautet schlicht
 * `USING (true)` — ohne den Filter stünden Serlos Highlights auf Berkats
 * Profilen. Die Spalte gibt es seit `20260823210000`.
 */
export function useHighlights(userId: string | null | undefined) {
  return useQuery<Highlight[]>({
    queryKey: ['berkat', 'highlights', userId ?? 'none'],
    enabled: !!userId,
    // Highlights ändern sich selten — anders als der Ring, der täglich neu ist.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_highlights')
        .select('id, user_id, title, media_url, thumbnail_url, items, created_at')
        .eq('user_id', userId!)
        .eq('app', 'berkat')
        .order('created_at', { ascending: false });

      // ⚠️ Fehler NICHT verschlucken: Ein leeres Profil und ein kaputter
      // Lesepfad sehen identisch aus. Genau diese Klasse hat am 23.08.2026 vier
      // tote Meldungspfade so lange verdeckt (Übergabe 75).
      if (error) throw error;

      return (data ?? []).map((row) => {
        const raw = Array.isArray(row.items) ? (row.items as HighlightItem[]) : [];
        // `||` statt `??`: Ein leerer String ist hier so unbrauchbar wie null.
        const items = raw.length > 0
          ? raw
          : row.media_url
            ? [{ media_url: row.media_url, media_type: 'image' as const, thumbnail_url: row.thumbnail_url }]
            : [];
        return {
          id: row.id as string,
          user_id: row.user_id as string,
          title: (row.title as string) || 'Highlight',
          cover_url: (row.thumbnail_url as string) || (row.media_url as string) || items[0]?.media_url || '',
          items,
          created_at: row.created_at as string,
        };
      })
      // Ein Highlight ohne ein einziges Medium ist eine leere Scheibe — es
      // wäre nur zu erklären, dass es nichts zu zeigen gibt.
      .filter((h) => h.items.length > 0);
    },
  });
}

/**
 * EIN Highlight samt Besitzer — für den Vollbild-Betrachter.
 *
 * Eigene Abfrage statt eines Griffs in die Liste des Profils: Der Betrachter
 * ist ein eigener Bildschirm und muss auch dann tragen, wenn er direkt geöffnet
 * wird (Neustart der App auf dieser Adresse, später ein Verweis von aussen).
 * Ein Bildschirm, der nur aus dem Zwischenspeicher eines anderen lebt, ist
 * genau bis zum ersten Neustart in Ordnung.
 *
 * ⚠️ `.eq('app', 'berkat')` auch hier, obwohl die Kennung eindeutig ist: Ohne
 * den Filter könnte eine Serlo-Adresse in Berkats Betrachter geraten und würde
 * dort brav gezeichnet.
 */
export function useHighlight(highlightId: string | null | undefined) {
  return useQuery<{ highlight: Highlight; username: string | null; avatarUrl: string | null } | null>({
    queryKey: ['berkat', 'highlight', highlightId ?? 'none'],
    enabled: !!highlightId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('story_highlights')
        .select('id, user_id, title, media_url, thumbnail_url, items, created_at')
        .eq('id', highlightId!)
        .eq('app', 'berkat')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const raw = Array.isArray(data.items) ? (data.items as HighlightItem[]) : [];
      const items = raw.length > 0
        ? raw
        : data.media_url
          ? [{ media_url: data.media_url as string, media_type: 'image' as const, thumbnail_url: data.thumbnail_url as string | null }]
          : [];

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', data.user_id as string)
        .maybeSingle();

      return {
        highlight: {
          id: data.id as string,
          user_id: data.user_id as string,
          title: (data.title as string) || 'Highlight',
          cover_url: (data.thumbnail_url as string) || (data.media_url as string) || items[0]?.media_url || '',
          items,
          created_at: data.created_at as string,
        },
        username: (profile?.username as string) ?? null,
        avatarUrl: (profile?.avatar_url as string) ?? null,
      };
    },
  });
}

/**
 * Die eigenen Berkat-Stories als Vorlage für ein Highlight.
 *
 * ⚠️ OHNE Altersgrenze und einschliesslich der archivierten — anders als der
 * Ring. Das ist der Punkt der Funktion: Was aus dem Ring gefallen ist, soll
 * genau hier noch einmal auftauchen. Die RLS lässt eigene Zeilen in jedem Fall
 * durch (`stories_own_archived_select`).
 */
export function useMyStoryArchive(enabled: boolean) {
  const myUserId = useSession((s) => s.userId);

  return useQuery<HighlightItem[]>({
    queryKey: ['berkat', 'story-archive', myUserId ?? 'anon'],
    enabled: enabled && !!myUserId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('id, media_url, thumbnail_url, created_at')
        .eq('user_id', myUserId!)
        .eq('app', 'berkat')
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? [])
        .filter((row) => !!row.media_url)
        .map((row) => ({
          media_url: row.media_url as string,
          media_type: 'image' as const,
          thumbnail_url: (row.thumbnail_url as string) ?? (row.media_url as string),
        }));
    },
  });
}

/**
 * Ein Highlight anlegen.
 *
 * Reihenfolge ist Absicht: erst kopieren, dann schreiben. Andersherum stünde
 * eine Zeile in der Datenbank, die auf eine vergängliche Datei zeigt — und
 * niemand käme je zurück, um sie zu reparieren.
 */
export function useCreateHighlight() {
  const myUserId = useSession((s) => s.userId);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { title: string; items: HighlightItem[] }) => {
      if (!myUserId) throw new Error('Nicht angemeldet.');
      if (input.items.length === 0) throw new Error('Mindestens ein Bild.');

      // ── Die Medien dauerhaft machen ──────────────────────────────────────
      //
      // ⚠️ BEST-EFFORT, und das ist eine bewusste Abwägung: Schlägt die Kopie
      // fehl, bleibt die Original-Adresse stehen. Das Highlight ist dann
      // vergänglich, aber es entsteht. Der umgekehrte Weg — Abbruch — würde
      // einen Verkäufer, der gerade sein Profil füllt, mit einer Fehlermeldung
      // stehen lassen, deren Ursache er nicht beheben kann.
      //
      // Serlo macht es genauso (`lib/useStoryHighlights.ts`). Wer das je
      // umdreht, muss auch sagen, was der Nutzer dann tun soll.
      let items = input.items;
      try {
        const { data, error } = await supabase.functions.invoke('highlight-copy-media', {
          body: { items: input.items.map((i) => ({
            media_url: i.media_url,
            media_type: i.media_type,
            thumbnail_url: i.thumbnail_url ?? null,
          })) },
        });
        const copied = (data as { items?: HighlightItem[] } | null)?.items;
        // ⚠️ Die Längenprüfung ist nicht Zierde: Käme die Function je mit einer
        // kürzeren Liste zurück, fehlten Bilder — und zwar lautlos.
        if (!error && Array.isArray(copied) && copied.length === input.items.length) {
          items = copied;
        }
      } catch {
        /* Original-Adressen behalten */
      }

      const cover = items[0];
      const { error } = await supabase.from('story_highlights').insert({
        user_id: myUserId,
        title: input.title.trim().slice(0, HIGHLIGHT_TITLE_MAX) || 'Highlight',
        media_url: cover.media_url,
        media_type: 'image',
        thumbnail_url: cover.thumbnail_url ?? cover.media_url,
        items: items.map((i) => ({
          media_url: i.media_url,
          media_type: i.media_type,
          thumbnail_url: i.thumbnail_url ?? i.media_url,
        })),
        // ⚠️ Ohne den Stempel steht das Highlight auf Serlos Profil.
        app: 'berkat',
        // `story_id` und `post_id` bleiben leer: Ein Berkat-Highlight ist eine
        // eigene Zusammenstellung, keine Verknüpfung auf eine Story-Zeile.
        // Genau deshalb überlebt es deren Ablauf auch dann, wenn die Kopie
        // oben fehlgeschlagen sein sollte — gelöscht wird höchstens die Datei,
        // nie diese Zeile (`story_highlights_story_id_fkey` ist ON DELETE
        // CASCADE, und das würde bei gesetzter `story_id` mitreissen).
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['berkat', 'highlights', myUserId ?? 'none'] });
    },
  });
}

/** Ein eigenes Highlight entfernen. Die RLS lässt nur eigene Zeilen zu. */
export function useDeleteHighlight() {
  const myUserId = useSession((s) => s.userId);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (highlightId: string) => {
      const { error } = await supabase
        .from('story_highlights')
        .delete()
        .eq('id', highlightId);
      if (error) throw error;
      return highlightId;
    },
    onSuccess: (highlightId) => {
      void qc.invalidateQueries({ queryKey: ['berkat', 'highlights', myUserId ?? 'none'] });
      // ⚠️ Auch die Einzel-Abfrage, sonst zeichnet der Betrachter beim nächsten
      // Öffnen aus dem Zwischenspeicher etwas, das es nicht mehr gibt.
      void qc.invalidateQueries({ queryKey: ['berkat', 'highlight', highlightId] });
    },
  });
}

/**
 * Warum ein Anlegen scheiterte — in Sätzen, die sagen, was zu tun ist.
 *
 * Die Regel aus der Übergabe: Eine Fehlermeldung für alles ist keine
 * Fehlermeldung. Die drei Fälle hier sind die einzigen, die realistisch
 * vorkommen — alles andere bekommt den ehrlichen Rest.
 */
export function highlightErrorText(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('nicht angemeldet')) return 'Melde dich an, dann geht es weiter.';
  if (m.includes('mindestens ein bild')) return 'Wähl zuerst ein Bild aus. 🖼️';
  if (m.includes('row-level security') || m.includes('42501')) {
    return 'Das darfst du hier nicht — bist du noch angemeldet?';
  }
  return 'Das hat nicht geklappt. Nochmal?';
}
