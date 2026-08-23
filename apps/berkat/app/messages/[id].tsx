// Ein Verlauf mit genau einer Person.
//
// Der Parameter ist die **Gegenseite**, nicht die Unterhaltung — man kommt aus
// dem Live-Raum, und dort kennt man den Menschen, nicht die Konversations-ID.
// Die wird beim Öffnen aufgelöst oder angelegt.
//
// Helle Fläche: Schreiben ist kein Zuschauen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Ban,
  ChevronLeft,
  Flag,
  ImagePlus,
  MoreHorizontal,
  SendHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { useProfiles } from '../../lib/useAuction';
import { goBack } from '../../lib/nav';
import { useEvidenceUri } from '../../lib/uploadEvidence';
import {
  useConversationWith,
  useMarkMessagesRead,
  useMessages,
  useSendMessage,
  type DirectMessage,
} from '../../lib/useDirectMessages';
import { Avatar } from '../../components/Avatar';
import { pickAndUpload } from '../../lib/uploadImage';
import { REPORT_REASONS, useMyBlocks, useSellerActions } from '../../lib/useSellerActions';
import { disputeReasonLabel, orderRef, useDisputeWith } from '../../lib/useDispute';
import { useListing, useListingsByIds } from '../../lib/useListings';
import { formatEuro } from '../../lib/useAuction';
import { formatCents } from '../../lib/useShipping';
import { radius, ratio, space, ui } from '../../theme/tokens';

/** Eine Zeile im Verlauf: eine Nachricht oder der offene Fall. */
type Row =
  | { kind: 'msg'; at: string; msg: DirectMessage }
  | { kind: 'case'; at: string };

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * ⚠️ Vergleicht den KALENDERTAG, nicht den Abstand in Stunden.
 *
 * „Weniger als 24 Stunden her" ist nicht dasselbe wie „heute": Um 01:00 wäre
 * eine Nachricht von gestern 23:00 nach dieser Rechnung „heute". Der Trenner
 * würde dann fehlen, obwohl der Tag gewechselt hat — und genau dafür ist er da.
 */
function sameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/**
 * „Heute" / „Gestern" / „Mo., 12. August".
 *
 * Bis zum 21.08.2026 trug jede Blase ihre Uhrzeit und keine den Tag. In einer
 * Unterhaltung, die sich über Wochen zieht, steht dann „14:20" — und niemand
 * weiß, ob das heute oder im Juli war (elfte Whatnot-Analyse, zweiter
 * Durchgang).
 */
function dayLabel(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  if (sameDay(iso, now.toISOString())) return 'Heute';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(iso, yesterday.toISOString())) return 'Gestern';
  // Das Jahr nur, wenn es ein anderes ist — sonst liest man es jedes Mal mit,
  // ohne dass es etwas beiträgt.
  return then.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

export default function ConversationScreen() {
  const {
    id: otherId,
    draft: presetDraft,
    listing: presetListing,
  } = useLocalSearchParams<{
    id: string;
    /**
     * Vorformulierter erster Satz, z. B. aus einem Angebot heraus.
     *
     * Kleinanzeigens „Ist das noch verfügbar?" ist der meistgetippte Satz im
     * deutschen Gebrauchtmarkt — ihn vorzuschreiben nimmt dem Erstkontakt die
     * Hürde. Als Anfangswert, NICHT als Effekt: Sonst überschriebe er, was der
     * Käufer inzwischen selbst getippt hat.
     */
    draft?: string;
    /**
     * Das Angebot, aus dem heraus geschrieben wird (`20260822140000`).
     *
     * ⚠️ Es hängt an der EINEN Nachricht, mit der man es anspricht — danach
     * wird der Anhang gelöst. Alles Weitere ist ein normales Gespräch, und ein
     * Artikel unter jeder Zeile wäre kein Bezug mehr, sondern Rauschen.
     */
    listing?: string;
  }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { data: conversationId, isLoading: resolving } = useConversationWith(myUserId, otherId);
  const { data: messages = [], isLoading } = useMessages(conversationId);
  const send = useSendMessage(conversationId, myUserId, otherId);
  const markRead = useMarkMessagesRead(conversationId, myUserId);

  const profiles = useProfiles(otherId ? [otherId] : []);
  const other = profiles[otherId ?? ''];

  const [draft, setDraft] = useState(() => presetDraft ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /**
   * Der Artikel, der an der NÄCHSTEN Nachricht hängt.
   *
   * Als Anfangswert, nicht als Effekt — dieselbe Begründung wie beim Entwurf
   * darüber: Ein Effekt hängte ihn wieder an, nachdem der Käufer ihn bewusst
   * abgenommen hat.
   */
  const [attached, setAttached] = useState<string | null>(() => presetListing ?? null);
  const { data: attachedListing } = useListing(attached ?? undefined);

  /**
   * Die Artikel für die Karten im Verlauf — EINE Abfrage für die ganze
   * Unterhaltung, nicht eine je Blase (HANDOFF 4, Kostenhygiene).
   */
  const listingIds = useMemo(
    () => [...new Set(messages.map((m) => m.listing_id).filter(Boolean) as string[])],
    [messages],
  );
  const { data: listingsById } = useListingsByIds(listingIds);

  /**
   * ⚠️ Melden und Sperren GEHÖREN HIERHER, nicht nur aufs Profil.
   *
   * Seit dem 21.08.2026 steht über dem Posteingang „Berkat schreibt dir nie
   * hier" (Abschnitt 64). Wer den Betrugsversuch daraufhin erkennt, hatte in
   * der Unterhaltung aber keinen einzigen Knopf: Beides lag zwei Tipps weiter
   * auf dem Verkäufer-Profil.
   *
   * **Eine Warnung ohne Handlung ist eine Belehrung.** Der Ort, an dem man den
   * Angriff sieht, muss der Ort sein, an dem man ihn beenden kann.
   *
   * Dasselbe Menü wie auf dem Verkäufer-Profil und der Artikelseite — gleiche
   * Reihenfolge, gleiche Gründe, gleiche Sätze. Ein drittes Muster für dieselbe
   * Handlung wäre die teurere Lösung.
   */
  const [menuOpen, setMenuOpen] = useState(false);
  /** Welches Foto gerade vollflächig zu sehen ist. */
  const [zoom, setZoom] = useState<string | null>(null);
  /**
   * Der offene Fall zwischen uns beiden — die Karte, die Whatnot in den
   * Nachrichtenstrom setzt (elfte Analyse). Warum sie hier nachgeschlagen und
   * nicht als Nachricht geschrieben wird, steht ausführlich in `useDisputeWith`.
   */
  const { data: dispute } = useDisputeWith(otherId, myUserId);
  /**
   * ⚠️ Nur ans Ende springen, wenn der Leser ohnehin unten steht.
   *
   * `onContentSizeChange` feuert bei JEDER neuen Nachricht. Wer gerade nach
   * oben gescrollt hat, um etwas nachzulesen, wurde bisher mitten im Satz nach
   * unten gerissen — und zwar durch eine Nachricht, die er noch gar nicht lesen
   * wollte. `atBottom` ist deshalb ein Ref und kein Zustand: Es steuert nichts,
   * was gezeichnet wird, und soll auch kein Neuzeichnen auslösen.
   */
  const atBottom = useRef(true);
  const sellerActions = useSellerActions(myUserId);
  const { data: blocked } = useMyBlocks(myUserId);
  const isBlocked = Boolean(otherId && blocked?.has(otherId));

  /**
   * ⚠️ Der sichere Rand unten gilt NUR ohne Tastatur.
   *
   * `behavior="padding"` legt die volle Höhe des Tastatur-Rahmens als Polster
   * an, und dieser Rahmen reicht auf Geräten mit Home-Indikator schon bis zur
   * Bildschirmkante — der sichere Rand steckt also bereits darin. Wer ihn
   * zusätzlich addiert, schiebt das Eingabefeld um weitere 34 Punkte hoch.
   *
   * Wortgleich zum Live-Raum (Übergabe 62). Dass derselbe Fehler an zwei
   * Stellen unabhängig entstanden ist, heißt: Er entsteht bei JEDEM
   * `KeyboardAvoidingView` mit `padding` neu. Wer den nächsten baut, prüft
   * beides — den Offset oben und den Rand unten.
   */
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  /**
   * ⚠️ Der Fall steht IM STROM, nicht über ihm.
   *
   * Erst hing er als fester Kasten unter der Kopfzeile — mit dem Argument, er
   * scrolle sonst weg. Am 22.08.2026 dagegengehalten, und das Argument hält
   * nicht: Whatnot setzt ihn in den Verlauf (elfte Analyse), und dort hat er
   * etwas, das der Kasten nicht hat — **einen Platz in der Zeit**. Man sieht,
   * was VOR und was NACH der Meldung gesagt wurde. Ein fixierter Kasten
   * verliert genau diese Auskunft.
   *
   * Der Einwand „eine geschriebene Nachricht friert ein" gilt weiterhin — nur
   * schreiben wir keine: Die Karte wird bei jedem Öffnen nachgeschlagen
   * (`useDisputeWith`) und ist damit im Strom genauso aktuell wie oben.
   *
   * Deshalb eine gemeinsame Zeilenliste statt zweier Bereiche: Nur so kann der
   * Fall nach Zeitstempel zwischen zwei Nachrichten stehen.
   */
  const rows = useMemo<Row[]>(() => {
    const base: Row[] = messages.map((m) => ({ kind: 'msg', at: m.created_at, msg: m }));
    if (dispute) base.push({ kind: 'case', at: dispute.created_at });
    return base.sort((a, b) => a.at.localeCompare(b.at));
  }, [messages, dispute]);

  const listRef = useRef<FlatList<Row>>(null);

  // Gelesen setzen, sobald etwas Ungelesenes im Verlauf liegt — nicht nur beim
  // ersten Öffnen: Wer den Bildschirm offen hält, während die Gegenseite
  // schreibt, hat es auch gelesen.
  useEffect(() => {
    if (!conversationId) return;
    if (messages.some((m) => m.sender_id !== myUserId && !m.read)) markRead();
  }, [conversationId, messages, myUserId, markRead]);

  const onSend = useCallback(async () => {
    const text = draft;
    if (!text.trim()) return;
    // ⚠️ Der Anhang wird VOR dem Senden gelöst, nicht danach. Geht die Zeile
    // nicht raus, kommt er mit dem Text zurück — sonst hinge er an der
    // nächsten Nachricht, die davon nichts weiß.
    const withListing = attached;
    setDraft('');
    setAttached(null);
    const res = await send(text, null, withListing);
    if (!res.ok) {
      setDraft(text);
      setAttached(withListing);
      setNotice(res.message);
    }
  }, [draft, attached, send]);

  /**
   * Foto wählen und sofort senden.
   *
   * ⚠️ Der getippte Text geht MIT, wenn welcher dasteht — und das Feld wird
   * dabei geleert. Sonst schickt der Nutzer sein Bild ab, sieht seinen Satz
   * weiter im Feld stehen und tippt ihn ein zweites Mal ab. Zwei Nachrichten
   * für eine Aussage.
   *
   * ⚠️ Zuschnitt `portrait`, also GAR KEIN Rahmen (`allowsEditing: false`).
   *
   * Hier stand zuerst `square`, und das war falsch: Ein Handyfoto ist hochkant,
   * und ein quadratischer Rahmen schneidet zuerst ein Viertel der Höhe weg —
   * bei einem Beleg für „so kam es an" ausgerechnet den Teil, den man zeigen
   * wollte. Am Gerät sofort gesehen (21.08.2026).
   *
   * `portrait` lädt das ganze Bild, und `contentFit="cover"` in der Blase wählt
   * den Ausschnitt erst beim Zeichnen — nichts geht verloren, und das Original
   * bleibt vollständig hinter der URL. Ein 3:4-Handyfoto verliert dabei wenige
   * Prozent oben und unten, weil die Blase 4:5 zeichnet.
   *
   * ⚠️ Der Preis steht in `uploadImage.ts`: Ohne Rahmen kommt das Foto in voller
   * Auflösung, und ein 48-MP-Bild kann die 8-MB-Grenze reißen. Bis
   * `expo-image-manipulator` im nächsten Build steckt, greift nur die gesenkte
   * Qualität (Übergabe 60, Fund 1).
   */
  const addPhoto = useCallback(async () => {
    if (uploading) return;
    setUploading(true);
    setNotice(null);
    try {
      const url = await pickAndUpload('cover', 'portrait');
      if (!url) return;
      const text = draft;
      const withListing = attached;
      setDraft('');
      setAttached(null);
      const res = await send(text, url, withListing);
      if (!res.ok) {
        setDraft(text);
        setAttached(withListing);
        setNotice(res.message);
      }
    } catch {
      setNotice('Das Foto ließ sich nicht senden. Nochmal?');
    } finally {
      setUploading(false);
    }
  }, [draft, attached, send, uploading]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/messages')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Pressable
          style={styles.headerIdentity}
          onPress={() => otherId && router.push(`/seller/${otherId}`)}
          accessibilityRole="button"
        >
          <Avatar uri={other?.avatarUrl} name={other?.username} size={30} />
          <Text numberOfLines={1} style={styles.headerTitle}>
            {other?.username ?? '…'}
          </Text>
        </Pressable>
        <Pressable
          hitSlop={10}
          onPress={() => setMenuOpen(true)}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Mehr"
        >
          <MoreHorizontal size={22} color={ui.text} />
        </Pressable>
      </View>

      {/* ⚠️ KEIN `keyboardVerticalOffset`. Nicht `insets.top`, nicht `+ 52`.
          Hier stand erst `insets.top + 52`, dann `insets.top` — beides zu viel,
          das zweite war MEIN Fehler beim ersten Beheben.

          Der Grund, jetzt in der Bibliothek nachgelesen statt hergeleitet:
          `KeyboardAvoidingView` merkt sich `event.nativeEvent.layout` und
          rechnet `frame.y + frame.height - keyboardY`. Yoga misst `layout.y`
          eines Kindes ab der Kante des ELTERNTEILS — der Innenabstand des
          Elternteils steckt also bereits DRIN. Die Wurzel dieses Bildschirms
          sitzt am Bildschirmrand, folglich ist `frame.y` schon die echte
          Bildschirmposition, und es gibt nichts auszugleichen.

          Jeder angegebene Punkt wird stattdessen zusätzliches Polster unter dem
          Eingabefeld. Genau das war die Lücke.

          Die Lehre: Ein Wert, der „plausibel aussieht" (sicherer Rand plus
          Kopfzeile — beides ist ja da oben), ist keine Herleitung. Der
          Quelltext der Komponente hat die Frage in zwei Minuten beantwortet. */}
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {resolving || isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={ui.brand} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(r) => (r.kind === 'case' ? `case-${r.at}` : r.msg.id)}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => {
              if (atBottom.current) listRef.current?.scrollToEnd({ animated: false });
            }}
            onScroll={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              // 80 Punkte Spielraum: Wer fast unten steht, meint unten.
              atBottom.current =
                contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
            }}
            scrollEventThrottle={100}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Avatar uri={other?.avatarUrl} name={other?.username} size={56} />
                <Text style={styles.emptyTitle}>
                  Schreib {other?.username ?? 'ihm'} die erste Nachricht 👋
                </Text>
                <Text style={styles.emptyBody}>
                  Fragen zum Artikel, zum Versand, oder einfach hallo.
                </Text>
              </View>
            }
            renderItem={({ item: row, index }) => {
              // ⚠️ Der Trenner gehört zur Zeile, nicht zwischen zwei Elemente:
              // Eine `ItemSeparatorComponent` sieht das VORHERIGE Element nicht
              // und könnte den Tageswechsel gar nicht erkennen.
              const prev = index > 0 ? rows[index - 1] : null;
              const showDay = !prev || !sameDay(prev.at, row.at);
              const day = showDay ? <Text style={styles.dayMark}>{dayLabel(row.at)}</Text> : null;

              // ── Der Fall, als Karte im Strom ────────────────────────────
              if (row.kind === 'case') {
                if (!dispute) return null;
                // Links oder rechts wie eine Blase: Wer gemeldet hat, steht auf
                // seiner Seite. Ohne das läse die Gegenseite die Karte als
                // Vorwurf VON DER PLATTFORM statt von einem Menschen.
                const mineCase = dispute.iReported;
                return (
                  <View>
                    {day}
                    <View style={[styles.bubbleRow, mineCase ? styles.rowMine : styles.rowTheirs]}>
                      <View style={styles.caseCard}>
                        <View style={styles.caseHead}>
                          <TriangleAlert size={15} color={ui.live} />
                          <Text style={styles.caseReason}>
                            {disputeReasonLabel(dispute.reason)}
                          </Text>
                        </View>

                        {dispute.orderTitle ? (
                          <Text numberOfLines={1} style={styles.caseOrder}>
                            {dispute.orderTitle}
                            {dispute.amountCents > 0
                              ? ` · ${formatCents(dispute.amountCents)}`
                              : ''}{' '}
                            · {orderRef(dispute.order_id)}
                          </Text>
                        ) : null}

                        {dispute.detail ? (
                          <Text style={styles.caseDetail}>„{dispute.detail}"</Text>
                        ) : null}

                        <CaseEvidence ref_={dispute.image_url} onZoom={setZoom} />

                        <Text style={styles.caseTime}>{timeLabel(dispute.created_at)}</Text>
                      </View>
                    </View>
                  </View>
                );
              }

              // ── Eine gewöhnliche Nachricht ──────────────────────────────
              const item = row.msg;
              const mine = item.sender_id === myUserId;
              const text = (item.content ?? '').trim();
              return (
                <View>
                  {day}
                  <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                    <View
                      style={[
                        styles.bubble,
                        mine ? styles.bubbleMine : styles.bubbleTheirs,
                        item.image_url ? styles.bubblePhoto : null,
                      ]}
                    >
                      {item.image_url ? (
                        <Pressable
                          onPress={() => setZoom(item.image_url)}
                          accessibilityRole="imagebutton"
                          accessibilityLabel="Foto vergrößern"
                        >
                          <Image
                            source={{ uri: item.image_url }}
                            style={styles.photo}
                            contentFit="cover"
                            transition={140}
                          />
                          {!text ? (
                            <Text style={[styles.bubbleTime, styles.bubbleTimeOnPhoto]}>
                              {timeLabel(item.created_at)}
                            </Text>
                          ) : null}
                        </Pressable>
                      ) : null}
                      {/* ⚠️ Die Produktkarte — der Grund, warum es
                          `messages.listing_id` gibt (20260822140000).

                          Sie steht ÜBER dem Text, nicht darunter: Der Satz
                          („Ist das noch da?") bezieht sich auf sie, und man
                          liest von oben nach unten. Ein Bezug, der erst nach
                          der Frage kommt, ist eine Fußnote.

                          Fehlt der Artikel in der Antwort — gelöscht, oder
                          Frauen-Only ohne Freigabe —, rendert sie NICHTS und
                          der Text bleibt stehen. Kein Platzhalter, keine
                          Meldung: dieselbe Sprache wie auf der Artikelseite
                          (HANDOFF 21), damit die Existenz nicht durchsickert. */}
                      {item.listing_id && listingsById?.get(item.listing_id) ? (
                        (() => {
                          const l = listingsById.get(item.listing_id)!;
                          return (
                            <Pressable
                              style={[styles.prod, mine && styles.prodMine]}
                              onPress={() => router.push(`/listing/${l.id}`)}
                              accessibilityRole="button"
                              accessibilityLabel={`${l.title}, ${formatEuro(
                                l.buy_now_cents,
                              )} — Angebot ansehen`}
                            >
                              {l.image_url ? (
                                <Image
                                  source={{ uri: l.image_url }}
                                  style={styles.prodThumb}
                                  contentFit="cover"
                                  transition={120}
                                />
                              ) : (
                                <View style={styles.prodThumb} />
                              )}
                              <View style={styles.prodBody}>
                                <Text
                                  numberOfLines={2}
                                  style={[styles.prodTitle, mine && styles.prodTitleMine]}
                                >
                                  {l.title}
                                </Text>
                                <Text style={[styles.prodPrice, mine && styles.prodPriceMine]}>
                                  {formatEuro(l.buy_now_cents)}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })()
                      ) : null}
                      {text ? (
                        <Text
                          style={[
                            styles.bubbleText,
                            mine && styles.bubbleTextMine,
                            item.image_url ? styles.bubbleTextUnderPhoto : null,
                          ]}
                        >
                          {text}
                        </Text>
                      ) : null}
                      {text || !item.image_url ? (
                        <Text
                          style={[
                            styles.bubbleTime,
                            mine && styles.bubbleTimeMine,
                            item.image_url ? styles.bubbleTimeUnderPhoto : null,
                          ]}
                        >
                          {timeLabel(item.created_at)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        {/* ⚠️ Der Anhang ist SICHTBAR, bevor er rausgeht.
            Ein Bezug, den nur der Empfänger sieht, ist eine Überraschung — und
            wer aus dem Angebot heraus schreibt, soll erkennen, dass der Artikel
            mitgeht, statt ihn im Text noch einmal zu beschreiben. Das ✕ ist
            kein Beiwerk: Man kommt manchmal über ein Angebot in einen Chat und
            will dann etwas ganz anderes fragen. */}
        {attachedListing ? (
          <View style={styles.attach}>
            {attachedListing.image_url ? (
              <Image
                source={{ uri: attachedListing.image_url }}
                style={styles.attachThumb}
                contentFit="cover"
                transition={120}
              />
            ) : (
              <View style={styles.attachThumb} />
            )}
            <View style={styles.attachBody}>
              <Text style={styles.attachLabel}>Zu diesem Angebot</Text>
              <Text numberOfLines={1} style={styles.attachTitle}>
                {attachedListing.title}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => setAttached(null)}
              accessibilityRole="button"
              accessibilityLabel="Angebot nicht mitschicken"
            >
              <X size={18} color={ui.textMuted} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.inputRow, { paddingBottom: keyboardUp ? space.sm : insets.bottom || space.sm }]}>
          {/* ⚠️ Das Foto ist der Grund, warum es diesen Knopf gibt — nicht die
              Nettigkeit. Wenn Ware kaputt ankommt, ist ein Bild der einzige
              Beleg, den ein Käufer hat; ohne ihn steht Aussage gegen Aussage
              (elfte Whatnot-Analyse). Links vom Feld, wie überall: erst was man
              mitschickt, dann was man schreibt. */}
          <Pressable
            onPress={addPhoto}
            disabled={uploading}
            style={styles.photoBtn}
            accessibilityRole="button"
            accessibilityLabel="Foto senden"
          >
            {uploading ? (
              <ActivityIndicator size="small" color={ui.textMuted} />
            ) : (
              <ImagePlus size={21} color={ui.textMuted} />
            )}
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Nachricht schreiben …"
            placeholderTextColor={ui.textMuted}
            style={styles.input}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={() => void onSend()}
            disabled={!draft.trim()}
            style={[styles.sendBtn, !draft.trim() && styles.sendBtnOff]}
            accessibilityRole="button"
            accessibilityLabel="Senden"
          >
            <SendHorizontal size={19} color={ui.goldInk} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Vollbild. Schwarz, nicht Sand: Ein Foto beurteilt man auf neutralem
          Grund, und Berkats helle Fläche färbt jeden Weißabgleich. Das ist die
          einzige schwarze Fläche außerhalb des Live-Raums — begründet, weil sie
          demselben Zweck dient wie die Bühne: Das Bild soll wirken, nicht die
          App. Ein Tipp irgendwohin schließt; ein eigener Schließen-Knopf wäre
          auf einem Foto der einzige Fremdkörper. */}
      <Modal visible={zoom !== null} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomWrap} onPress={() => setZoom(null)}>
          {zoom ? (
            <Image source={{ uri: zoom }} style={styles.zoomImage} contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
        <View style={[styles.menuWrap, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.menuCard}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                if (!otherId) return;
                setMenuOpen(false);
                const run = isBlocked
                  ? sellerActions.unblock(otherId)
                  : sellerActions.block(otherId);
                void run.then((res) =>
                  setNotice(
                    res.ok
                      ? isBlocked
                        ? 'Sperre aufgehoben.'
                        : 'Gesperrt — du siehst seine Nachrichten nicht mehr.'
                      : res.message,
                  ),
                );
              }}
              accessibilityRole="button"
            >
              <Ban size={18} color={ui.text} />
              <Text style={styles.menuText}>
                {isBlocked ? 'Sperre aufheben' : 'Nutzer sperren'}
              </Text>
            </Pressable>

            <View style={styles.menuSplit} />

            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason.key}
                style={styles.menuRow}
                onPress={() => {
                  if (!otherId) return;
                  setMenuOpen(false);
                  void sellerActions
                    .report(otherId, reason.key)
                    .then((res) => setNotice(res.ok ? 'Danke — wir sehen es uns an.' : res.message));
                }}
                accessibilityRole="button"
              >
                <Flag size={18} color={ui.live} />
                <Text style={[styles.menuText, styles.menuTextDanger]}>
                  Melden · {reason.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.menuCancel} onPress={() => setMenuOpen(false)}>
            <Text style={styles.menuCancelText}>Abbrechen</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Das Belegfoto einer Fall-Karte im Verlauf.
 *
 * ⚠️ Eigene Komponente, kein Block in der Schleife: Der Beleg liegt seit dem
 * 23.08.2026 im privaten Eimer, die anzeigbare Adresse entsteht also erst per
 * Hook — und ein Hook in einer `.map()` bräche die Reihenfolge, sobald ein
 * Fall dazukommt oder wegfällt. Dieselbe Bauform wie `PrebidPanel`
 * (Übergabe 50).
 *
 * `ref_` statt `ref`: `ref` ist in React reserviert.
 */
function CaseEvidence({
  ref_,
  onZoom,
}: {
  ref_: string | null;
  onZoom: (uri: string) => void;
}) {
  const uri = useEvidenceUri(ref_);
  if (!uri) return null;
  return (
    <Pressable
      onPress={() => onZoom(uri)}
      accessibilityRole="imagebutton"
      accessibilityLabel="Belegfoto vergrößern"
    >
      <Image source={{ uri }} style={styles.casePhoto} contentFit="cover" transition={140} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: ui.text },

  listContent: { padding: space.md, gap: space.sm, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: ui.brand, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: ui.card, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: ui.text, lineHeight: 20 },
  bubbleTextMine: { color: '#FFFFFF' },
  bubbleTime: { fontSize: 10, color: ui.textMuted, marginTop: 3, alignSelf: 'flex-end' },

  // ── Produktkarte in der Blase ─────────────────────────────────────────────
  // Sie liegt IN der Blase und trägt deshalb keine eigene Farbe, sondern eine
  // Aufhellung der Blasenfläche: Ein weißer Kasten in einer dunkelgrünen Blase
  // wäre ein Fremdkörper, und zwei Kartenfarben nebeneinander (meine/ihre)
  // lesen sich als zwei verschiedene Dinge.
  prod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: 6,
    marginBottom: 6,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
  },
  prodMine: { backgroundColor: 'rgba(255,255,255,0.14)' },
  prodThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
  },
  prodBody: { flex: 1, minWidth: 0, gap: 1 },
  prodTitle: { fontSize: 13, fontWeight: '600', color: ui.text, lineHeight: 17 },
  prodTitleMine: { color: '#FFFFFF' },
  prodPrice: { fontSize: 13, fontWeight: '700', color: ui.text },
  prodPriceMine: { color: '#FFFFFF' },

  // ── Anhang über dem Eingabefeld ───────────────────────────────────────────
  attach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.md,
    marginBottom: space.xs,
    padding: 6,
    borderRadius: radius.md,
    backgroundColor: ui.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
  },
  attachThumb: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: ui.sunken },
  attachBody: { flex: 1, minWidth: 0 },
  attachLabel: { fontSize: 10, color: ui.textMuted, fontWeight: '600' },
  attachTitle: { fontSize: 13, fontWeight: '600', color: ui.text },

  // ── Tagestrenner ──────────────────────────────────────────────────────────
  // Mittig, klein, gedämpft — die übliche Form, weil sie keine Nachricht ist,
  // sondern eine Zwischenüberschrift. Kein Kasten und keine Linie: Der Verlauf
  // ist ohnehin schon eine Folge von Flächen.
  dayMark: {
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: ui.textMuted,
    marginTop: space.md,
    marginBottom: space.sm,
  },

  // ── Bild-Nachricht ────────────────────────────────────────────────────────
  // Die Blase verliert ihren Innenabstand, damit das Bild bündig in der Rundung
  // sitzt statt auf einem Rahmen aus Blase zu schwimmen.
  /**
   * ⚠️ `paddingHorizontal` UND `paddingVertical` auf 0 — NICHT `padding: 0`.
   *
   * Hier stand `padding: 0`, und es tat nichts: In React Native gewinnt die
   * genauere Angabe gegen die Kurzform, **unabhängig von der Reihenfolge**.
   * `bubble` setzt `paddingHorizontal: 13` und `paddingVertical: 9`, also blieb
   * beides stehen — und das Foto saß in einem dunkelgrünen Rahmen, der wie eine
   * Umrandung aussah (am Gerät gemeldet, 21.08.2026).
   *
   * Die Regel gilt für jedes Paar aus Kurz- und Langform (`margin`, `border`,
   * `borderRadius`): Wer eine Langform aufheben will, muss die Langform
   * nennen.
   */
  bubblePhoto: { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' },
  // Hochformat, nicht quadratisch: Handyfotos sind hochkant, und Berkats
  // Stöber-Karten sind es seit dem 18.08. auch (`ratio.card`, 4:5). Eine
  // quadratische Blase wäre die einzige Fläche der App, die anders zuschneidet.
  photo: { width: 210, aspectRatio: ratio.card, backgroundColor: ui.sunken },
  // Text unter einem Bild bekommt den Abstand zurück, den die Blase abgegeben hat.
  bubbleTextUnderPhoto: { paddingHorizontal: space.md, paddingTop: space.sm },
  // Foto MIT Text: Die Blase hat ihren Innenabstand abgegeben, die Uhrzeit
  // holt ihn sich für sich zurück.
  bubbleTimeUnderPhoto: { paddingRight: space.md, paddingBottom: space.sm },
  // ⚠️ Ohne Text hat die Blase keinen Innenabstand mehr — die Uhrzeit stünde
  // sonst hart an der Bildkante.
  // Auf dem Bild statt darunter: Ein Band unter dem Foto wäre wieder ein
  // Rahmen, nur an einer Seite. Schatten statt Fläche, aus demselben Grund wie
  // bei der Leiste im Live-Raum — eine Kachel unter der Uhrzeit wäre die
  // dritte Fläche auf einem Bild, das schon eine hat.
  bubbleTimeOnPhoto: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    marginTop: 0,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  photoBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },

  // ── Melden / Sperren ──────────────────────────────────────────────────────
  // Wortgleich zum Menü auf dem Verkäufer-Profil (`app/seller/[id].tsx`).
  // ── Der offene Fall, über dem Verlauf ─────────────────────────────────────
  // Roter Rahmen, keine rote Fläche: Rot ist in Berkat die laufende Uhr, und
  // eine Fläche bliebe hier dauerhaft stehen (Design-Gesetz 3).
  // Eine Blase wie jede andere — nur mit rotem Rand statt Fläche. Sie steht im
  // Strom, also muss sie sich wie eine Nachricht verhalten: begrenzte Breite,
  // Rundung, Uhrzeit unten rechts.
  caseCard: {
    maxWidth: '86%',
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: ui.live,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: 3,
  },
  caseHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caseReason: { flex: 1, fontSize: 14, fontWeight: '700', color: ui.text },
  caseTime: { fontSize: 10, color: ui.textMuted, alignSelf: 'flex-end', marginTop: 2 },
  caseOrder: { fontSize: 12, color: ui.textMuted },
  caseDetail: { fontSize: 13, color: ui.text, lineHeight: 18 },
  casePhoto: {
    width: 72,
    aspectRatio: ratio.card,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    marginTop: 4,
  },

  zoomWrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: '100%', height: '100%' },

  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  menuWrap: { marginTop: 'auto', paddingHorizontal: space.md, gap: space.sm },
  menuCard: { backgroundColor: ui.card, borderRadius: radius.lg, overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  menuSplit: { height: StyleSheet.hairlineWidth, backgroundColor: ui.line },
  menuText: { fontSize: 15, color: ui.text },
  menuTextDanger: { color: ui.live },
  menuCancel: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  menuCancelText: { fontSize: 16, fontWeight: '700', color: ui.text },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.65)' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: ui.text, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: ui.textMuted, textAlign: 'center', lineHeight: 19 },

  notice: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    padding: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 42,
    borderRadius: radius.lg,
    backgroundColor: ui.sunken,
    paddingHorizontal: space.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    color: ui.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.4 },
});
