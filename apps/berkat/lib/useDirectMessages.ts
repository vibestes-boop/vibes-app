// Direktnachrichten.
//
// Berkat hatte keine. Gebaut wird trotzdem nichts Neues: `conversations` und
// `messages` gehören Serlo, liegen in derselben Datenbank und sind schlicht
// genug, dass beide Apps sie teilen können — dieselbe Entscheidung wie beim
// Live-Chat und beim Folgen (Übergabe, Abschnitt 4).
//
// Folge davon, bewusst in Kauf genommen: Eine Nachricht, die hier geschrieben
// wird, taucht in Serlos Posteingang auf und umgekehrt. Das ist richtig — es
// ist dieselbe Person, die schreibt. Eine getrennte Nachrichtenwelt je App
// hätte zwei Posteingänge für einen Menschen bedeutet.
//
// Das Paar (participant_1, participant_2) ist sortiert abgelegt, sonst gäbe es
// dieselbe Unterhaltung zweimal — je nachdem, wer zuerst geschrieben hat.

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { subscribeToTable } from './realtime';

export type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  read: boolean;
  /**
   * Das Angebot, um das es in dieser Nachricht geht (`20260822140000`).
   *
   * ⚠️ Der Bezug hängt an der NACHRICHT, nicht an der Unterhaltung: Über
   * Wochen fragt derselbe Mensch nach mehreren Artikeln, und an der
   * Unterhaltung überschriebe die zweite Frage die erste. Dieselbe
   * Entscheidung wie bei der Streit-Karte im Verlauf (HANDOFF 68).
   *
   * Ob der Leser den Artikel SEHEN darf, entscheidet nicht diese Spalte,
   * sondern `live_auctions_select_standing` beim separaten Lesen — ein
   * geschütztes Angebot kommt als `null` zurück, die Karte rendert dann
   * nichts, und der Text bleibt stehen.
   */
  listing_id: string | null;
};

export type Conversation = {
  id: string;
  otherId: string;
  lastMessageAt: string | null;
  /**
   * Die letzte Nachricht, gekürzt auf eine Zeile — `null`, wenn sie sich nicht
   * laden ließ.
   *
   * ⚠️ Ohne sie ist ein Posteingang nicht sortierbar: Man muss JEDE Unterhaltung
   * öffnen, um zu wissen, worum es geht. Bei drei fällt das nicht auf, bei
   * dreißig ist die Liste wertlos (elfte Whatnot-Analyse, Nachtrag zur
   * Gestaltung).
   */
  preview: string | null;
  /** `true`, wenn der ANDERE geschrieben hat und ich es noch nicht gelesen habe. */
  unread: boolean;
  /** War die letzte Nachricht von mir? Dann steht „Du: " davor. */
  lastFromMe: boolean;
};

function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Die Unterhaltung mit genau dieser Person — **nur nachschlagen, nie anlegen.**
 *
 * ⚠️ RICHTIGSTELLUNG 21.08.2026. Hier wurde beim Öffnen des Bildschirms eine
 * Zeile ANGELEGT, mit der Begründung, ein leerer Verlauf sei ehrlicher als ein
 * Feld, das erst beim Absenden entscheidet, wohin es schreibt.
 *
 * Die Begründung stimmt für den eigenen Bildschirm — und übersieht die andere
 * Seite. `conversations` ist mit Serlo GETEILT: Wer nur nachsieht, wer da
 * eigentlich schreibt, erzeugte damit im Posteingang des anderen eine
 * Unterhaltung. In Berkat **und in Serlo**, von jemandem, der ihn nie
 * angeschrieben hat.
 *
 * Sichtbar wurde es erst, als der Posteingang Vorschautexte bekam (Abschnitt
 * 64): Die Zeile stand da, mit Namen und leerer zweiter Zeile. Vorher sah sie
 * aus wie jede andere.
 *
 * > **Eine Nebenwirkung auf einer geteilten Tabelle ist nie nur die eigene.**
 *
 * Angelegt wird jetzt beim ersten Absenden (`useSendMessage`). Der leere
 * Verlauf funktioniert unverändert — er hat nur noch keine ID, und das merkt
 * niemand.
 */
export function useConversationWith(myUserId: string | null, otherId: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'conversation', myUserId, otherId],
    enabled: Boolean(myUserId && otherId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const [p1, p2] = sortedPair(myUserId!, otherId!);

      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_1', p1)
        .eq('participant_2', p2)
        .maybeSingle();
      return (existing as { id: string } | null)?.id ?? null;
    },
  });
}

/**
 * Die Unterhaltung anlegen — oder die inzwischen entstandene finden.
 *
 * ⚠️ Der Fehlerpfad ist kein Beiwerk. Zwei Geräte desselben Menschen (oder
 * beide Seiten gleichzeitig) können im selben Moment senden; der zweite Insert
 * läuft dann in den Eindeutigkeits-Konflikt. Das ist kein Fehler, sondern die
 * Auskunft „gibt es schon" — also noch einmal nachschlagen statt werfen.
 */
async function ensureConversation(myUserId: string, otherId: string): Promise<string | null> {
  const [p1, p2] = sortedPair(myUserId, otherId);

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ participant_1: p1, participant_2: p2 })
    .select('id')
    .single();
  if (!error && created) return (created as { id: string }).id;

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_1', p1)
    .eq('participant_2', p2)
    .maybeSingle();
  return (existing as { id: string } | null)?.id ?? null;
}

/** Der Verlauf. Neueste unten, wie in jedem Messenger. */
export function useMessages(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['berkat', 'messages', conversationId],
    enabled: Boolean(conversationId),
    queryFn: async (): Promise<DirectMessage[]> => {
      /**
       * ⚠️ ABSTEIGEND holen, dann umdrehen — NICHT aufsteigend mit `limit`.
       *
       * Hier stand `ascending: true` mit `limit(200)`, und das nimmt die
       * **ältesten** 200. Ab der 201. Nachricht sähe man für immer den Anfang
       * der Unterhaltung und nie das Aktuelle: Die Antwort von gerade eben wäre
       * unsichtbar, und zwar ohne Fehler, ohne Lücke, ohne Hinweis.
       *
       * Zugeschlagen hätte es zuerst in der aktivsten Unterhaltung — also der
       * wichtigsten. Gefunden beim Durchlesen am 21.08.2026, bevor jemand 200
       * Nachrichten hatte.
       *
       * `reverse()` läuft auf höchstens 200 Einträgen; die Kosten sind keine.
       */
      const { data, error } = await supabase
        .from('messages')
        // ⚠️ Feste Spaltenliste: Wer `listing_id` anzeigen will, muss sie HIER
        // ergänzen. Genau so blieb `description` zwei Tage unsichtbar — Spalte
        // da, Abfrage holt sie nicht, niemand sieht sie (HANDOFF 3).
        .select('id, conversation_id, sender_id, content, image_url, listing_id, created_at, read')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as DirectMessage[]).reverse();
    },
  });

  // Ein Abo je Unterhaltung, gefiltert auf genau sie — nie tabellenweit.
  // Ohne den Filter zahlte jedes offene Gerät für jede Nachricht der ganzen
  // Plattform (Übergabe: Realtime-Kostenhygiene).
  useEffect(() => {
    if (!conversationId) return;
    return subscribeToTable(
      `messages-${conversationId}`,
      { event: 'INSERT', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      () => {
        void queryClient.invalidateQueries({
          queryKey: ['berkat', 'messages', conversationId],
        });
      },
    );
  }, [conversationId, queryClient]);

  return query;
}

export type SendResult = { ok: true } | { ok: false; message: string };

export function useSendMessage(
  conversationId: string | null | undefined,
  myUserId: string | null,
  /** Nötig, seit die Unterhaltung erst beim ersten Absenden entsteht. */
  otherId: string | undefined,
) {
  const queryClient = useQueryClient();

  return useCallback(
    /**
     * Text, Bild oder beides.
     *
     * ⚠️ `messages` gehört SERLO MIT — App und Web lesen dieselbe Tabelle. Die
     * Form ist deshalb nicht frei wählbar, sondern abgeschrieben von dem, was
     * Serlo seit jeher schreibt (`lib/useMessages.ts:238` und
     * `apps/web/app/actions/messages.ts:134`):
     *
     *     content: <text> oder ''      ← NOT NULL, deshalb leerer String
     *     image_url: <url> oder null
     *
     * Genau so und nicht anders: Ein `content: null` bräche Serlos Insert-Pfad
     * nicht, aber eine Zeile, die Serlos Clients nicht erwarten, erscheint dort
     * als leere Blase — in einer ausgelieferten App, die wir nicht anfassen.
     * Am 21.08.2026 vor dem Bau gegengeprüft, nicht angenommen.
     */
    async (
      text: string,
      imageUrl?: string | null,
      /**
       * Das Angebot, um das es geht (`20260822140000`). Wird nur an die EINE
       * Nachricht gehängt, mit der man es anspricht — nicht an jede weitere.
       */
      listingId?: string | null,
    ): Promise<SendResult> => {
      const content = text.trim();
      if (!content && !imageUrl) return { ok: false, message: 'Da steht noch nichts.' };
      if (!myUserId || !otherId) {
        return { ok: false, message: 'Die Unterhaltung ist noch nicht bereit.' };
      }

      // Erst hier entsteht die Zeile — siehe `useConversationWith`.
      const cid = conversationId ?? (await ensureConversation(myUserId, otherId));
      if (!cid) return { ok: false, message: 'Die Unterhaltung ließ sich nicht öffnen. Nochmal?' };

      /**
       * ⚠️ Sofort anzeigen, dann erst senden.
       *
       * Ohne das verschwindet der getippte Satz aus dem Feld und erscheint erst
       * nach der Serverantwort — bei schlechtem Netz eine Sekunde ins Leere, in
       * der die App aussieht, als hätte sie nichts getan. Serlos Hook macht es
       * seit jeher optimistisch, Berkats nicht.
       *
       * Der Platzhalter braucht eine ID, die mit keiner echten kollidieren
       * kann; `optimistic-` plus Zeitstempel reicht, weil er Sekunden lebt. Er
       * verschwindet von selbst, sobald das Nachladen die echte Liste bringt —
       * die ersetzt das Feld vollständig, es gibt also kein Aufräumen und keine
       * Dublette.
       */
      const key = ['berkat', 'messages', cid];
      const optimistic: DirectMessage = {
        id: `optimistic-${Date.now()}`,
        conversation_id: cid,
        sender_id: myUserId,
        content,
        image_url: imageUrl ?? null,
        listing_id: listingId ?? null,
        created_at: new Date().toISOString(),
        read: false,
      };
      const before = queryClient.getQueryData<DirectMessage[]>(key);
      queryClient.setQueryData<DirectMessage[]>(key, (old) => [...(old ?? []), optimistic]);

      const { error } = await supabase.from('messages').insert({
        conversation_id: cid,
        sender_id: myUserId,
        content,
        image_url: imageUrl ?? null,
        // ⚠️ IMMER mitschicken — anders als `listing_id` darunter.
        //
        // Bis zum 23.08.2026 entschied allein `listing_id`, ob eine Meldung in
        // Berkats oder Serlos Glocke landet. Wer hier einfach jemanden
        // anschrieb — vom Profil, aus dem Posteingang, als Antwort —, hängte
        // an keinem Angebot: Die Meldung ging nach SERLO. Von Zaur am Gerät
        // gefunden.
        //
        // `listing_id IS NOT NULL` hiess nie „kommt aus Berkat", es hiess
        // „hängt an einem Angebot". Solange es nur einen Weg in den Chat gab,
        // war das dasselbe — und genau bis zum zweiten Weg.
        //
        // Siehe `20260823200000`; dort entscheidet `notify_on_dm` jetzt über
        // BEIDE Merkmale.
        app: 'berkat',
        // ⚠️ Nur mitschicken, wenn wirklich etwas dranhängt. Ein `listing_id`
        // auf JEDER Nachricht wäre kein Bezug mehr, sondern Rauschen — und die
        // Karte im Verlauf würde sich unter jeder Zeile wiederholen.
        ...(listingId ? { listing_id: listingId } : {}),
      });
      if (error) {
        // Zurücknehmen, sonst steht eine Nachricht da, die es nicht gibt — die
        // schlimmste Form von optimistisch.
        queryClient.setQueryData<DirectMessage[]>(key, before);
        return { ok: false, message: 'Die Nachricht ging nicht raus. Nochmal?' };
      }

      // `last_message_at` pflegt in Serlo ein Trigger. Falls der je verschwindet,
      // sortiert der Posteingang falsch — er fällt dann auf created_at zurück.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'messages', cid] });
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'conversations', myUserId] });
      // ⚠️ Beim ERSTEN Absenden gibt es die ID auf dem Bildschirm noch nicht —
      // ohne diese Zeile bliebe der Verlauf ohne Realtime-Abo und ohne
      // Nachladen, und die eigene Nachricht erschiene gar nicht.
      if (!conversationId) {
        void queryClient.invalidateQueries({
          queryKey: ['berkat', 'conversation', myUserId, otherId],
        });
      }
      return { ok: true };
    },
    [conversationId, myUserId, otherId, queryClient],
  );
}

/** Der Posteingang. Ohne ihn wäre jede eingehende Nachricht unauffindbar. */
export function useConversations(myUserId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['berkat', 'conversations', myUserId],
    enabled: Boolean(myUserId),
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, participant_1, participant_2, last_message_at')
        .or(`participant_1.eq.${myUserId},participant_2.eq.${myUserId}`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;

      const base = ((data ?? []) as {
        id: string;
        participant_1: string;
        participant_2: string;
        last_message_at: string | null;
      }[]).map((row) => ({
        id: row.id,
        otherId: row.participant_1 === myUserId ? row.participant_2 : row.participant_1,
        lastMessageAt: row.last_message_at,
        preview: null as string | null,
        unread: false,
        lastFromMe: false,
      }));

      if (base.length === 0) return base;
      const ids = base.map((c) => c.id);

      /**
       * ⚠️ ZWEI EIGENE ABFRAGEN, und beide dürfen scheitern, ohne den
       * Posteingang mitzureißen.
       *
       * Der Einbau (`conversations → messages`) wäre kürzer gewesen, als Teil
       * der Abfrage oben. Genau das wäre aber der Fehler aus Abschnitt 3: Löst
       * PostgREST eine Beziehung nicht auf, antwortet es mit 400 (PGRST200) —
       * und dann wäre nicht die Vorschau weg, sondern die ganze Liste. Eine
       * Verzierung darf den Inhalt nicht mit ins Grab nehmen.
       *
       * Deshalb: Grundliste zuerst und unabhängig, Vorschau und Ungelesenes
       * danach in `try/catch`. Fällt eines aus, fehlt genau das eine.
       */
      try {
        // Genau die NEUESTE Nachricht je Unterhaltung — ein Rundgang, nicht
        // fünfzig. `limit(1, { referencedTable })` ist das „top N je Elternteil"
        // von PostgREST; ohne das müsste man raten, wie viele Zeilen reichen,
        // und eine einzige geschwätzige Unterhaltung fräße das Kontingent auf.
        const { data: rows, error: previewError } = await supabase
          .from('conversations')
          .select('id, messages(content, image_url, sender_id, created_at)')
          .in('id', ids)
          .order('created_at', { referencedTable: 'messages', ascending: false })
          .limit(1, { referencedTable: 'messages' });
        if (previewError) throw previewError;

        const newest = new Map<
          string,
          { content: string; image_url: string | null; sender_id: string }
        >();
        for (const row of (rows ?? []) as {
          id: string;
          messages: { content: string; image_url: string | null; sender_id: string }[] | null;
        }[]) {
          const last = row.messages?.[0];
          if (last) newest.set(row.id, last);
        }
        for (const c of base) {
          const last = newest.get(c.id);
          if (!last) continue;
          // ⚠️ Ein Bild ohne Text hat `content: ''` (so schreibt es Serlo, siehe
          // `useSendMessage`). Ohne diesen Zweig stünde im Posteingang eine
          // LEERE Zeile — die schlimmste Vorschau von allen, weil sie wie ein
          // Ladefehler aussieht statt wie eine Nachricht.
          c.preview = last.content.trim() || (last.image_url ? '📷 Foto' : null);
          c.lastFromMe = last.sender_id === myUserId;
        }
      } catch (e) {
        if (__DEV__) console.warn('[Berkat] Vorschau im Posteingang:', e);
      }

      try {
        // Nur ungelesene Zeilen — die Abfrage ist billig, weil sie fast immer
        // leer ist. Bewusst NICHT aus der Vorschau abgeleitet: Die neueste
        // Nachricht kann gelesen sein, während eine ältere es nicht ist.
        const { data: unreadRows, error: unreadError } = await supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', ids)
          .eq('read', false)
          .neq('sender_id', myUserId!);
        if (unreadError) throw unreadError;

        const withUnread = new Set(
          ((unreadRows ?? []) as { conversation_id: string }[]).map((r) => r.conversation_id),
        );
        for (const c of base) c.unread = withUnread.has(c.id);
      } catch (e) {
        if (__DEV__) console.warn('[Berkat] Ungelesenes im Posteingang:', e);
      }

      return base;
    },
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['berkat', 'conversations', myUserId] });
  }, [queryClient, myUserId]);

  /**
   * Der Posteingang hört mit — sonst sagt die Glocke „1 neu" und die Liste
   * darunter zeigt nichts, bis jemand zieht. Zwei Wahrheiten über dasselbe.
   *
   * ⚠️ ZWEI Abos, und beide gefiltert. Das ist keine Umständlichkeit:
   *
   *   - Auf `messages` zu hören wäre TABELLENWEIT — jedes offene Gerät bezahlte
   *     dann jede Nachricht der ganzen Plattform. Genau das verbietet die
   *     Kostenhygiene (Übergabe, Abschnitt 4).
   *   - Auf `conversations` zu hören geht, aber der Realtime-Filter kennt nur
   *     EINE Bedingung — und ich stehe mal in `participant_1`, mal in
   *     `participant_2`. Ein Abo je Spalte ist die einzige Form, die beide
   *     Fälle abdeckt, ohne die Tabelle aufzumachen.
   *
   * Gehört wird UPDATE, nicht INSERT: `last_message_at` pflegt Serlos Trigger
   * bei jeder neuen Nachricht. Die Zeile selbst entsteht nur einmal.
   */
  useEffect(() => {
    if (!myUserId) return;
    const bump = () => {
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'conversations', myUserId] });
    };
    const offA = subscribeToTable(
      `conversations-p1-${myUserId}`,
      { event: 'UPDATE', table: 'conversations', filter: `participant_1=eq.${myUserId}` },
      bump,
    );
    const offB = subscribeToTable(
      `conversations-p2-${myUserId}`,
      { event: 'UPDATE', table: 'conversations', filter: `participant_2=eq.${myUserId}` },
      bump,
    );
    return () => {
      offA();
      offB();
    };
  }, [myUserId, queryClient]);

  return { ...query, refresh };
}

/** Ungelesenes für das Abzeichen im Konto. */
export function useUnreadMessageCount(myUserId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'unread-messages', myUserId],
    enabled: Boolean(myUserId),
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('read', false)
        .neq('sender_id', myUserId!);
      // Scheitert die Zählung, ist eine 0 besser als ein kaputtes Konto —
      // dieselbe Regel wie beim Glocken-Abzeichen auf der Startseite.
      if (error) return 0;
      return count ?? 0;
    },
  });
}

/**
 * Gelesen setzen, sobald der Verlauf offen ist.
 *
 * Zwingend über die RPC `mark_messages_read`: Die Policy `msg_update` erlaubt
 * ausschließlich dem **Absender**, seine Zeile zu ändern. Ein direktes
 * `update({ read: true })` durch den Empfänger träfe also null Zeilen — ohne
 * Fehler, einfach wirkungslos. Serlo geht denselben Weg.
 *
 * Das `.then()` ist Pflicht, kein Stil: `supabase.rpc()` liefert einen faulen
 * Erzeuger, der die Anfrage erst beim Abwarten losschickt. Ein blankes
 * `void supabase.rpc(…)` baut ihn nur und wirft ihn weg — lautlos (Übergabe,
 * Abschnitt 3).
 */
export function useMarkMessagesRead(
  conversationId: string | null | undefined,
  myUserId: string | null,
) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!conversationId || !myUserId) return;
    void supabase
      .rpc('mark_messages_read', { p_conversation_id: conversationId })
      .then(({ error }) => {
        if (error && __DEV__) console.warn('[Berkat] gelesen setzen:', error.message);
        void queryClient.invalidateQueries({ queryKey: ['berkat', 'unread-messages', myUserId] });
        void queryClient.invalidateQueries({ queryKey: ['berkat', 'messages', conversationId] });
        // ⚠️ Seit der Posteingang je Zeile einen Ungelesen-Punkt trägt, steht
        // dieselbe Wahrheit an ZWEI Orten: an der Glocke und in der Liste. Wer
        // nur einen zurücksetzt, lässt den Punkt stehen, obwohl der Zähler
        // schon auf 0 ist — dieselbe Regel wie beim zurückgezogenen Angebot
        // (Übergabe 18). Der Fokus-Effekt im Posteingang holt es zwar ohnehin
        // nach, aber sich darauf zu verlassen heißt, den Fehler beim nächsten
        // Umbau zu erben.
        void queryClient.invalidateQueries({ queryKey: ['berkat', 'conversations', myUserId] });
      });
  }, [conversationId, myUserId, queryClient]);
}
