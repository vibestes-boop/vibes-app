// Der Posteingang.
//
// Er existiert aus genau einem Grund: Ohne ihn wäre jede Nachricht, die man
// bekommt, unauffindbar. Man könnte schreiben, aber nie lesen — derselbe
// Fehler, der bei den Push-Meldungen erst am 14.08. auffiel.
//
// ⚠️ Hier stand bis zum 21.08.2026: „Vorschautexte gibt es nicht — dafür müsste
// jede Zeile eine eigene Abfrage machen, und ein Posteingang mit fünfzig
// Abfragen ist kein Posteingang."
//
// Die Sorge war berechtigt, die Schlussfolgerung falsch. Es braucht KEINE
// fünfzig Abfragen: PostgREST kann „die neueste Zeile je Elternteil" in einem
// Rundgang (`limit(1, { referencedTable })`, siehe `useConversations`). Ohne
// Vorschau war der Posteingang nicht sortierbar — man musste jede Unterhaltung
// öffnen, um zu wissen, worum es geht.
//
// Die Lehre: Eine technische Annahme, die ein Merkmal streicht, gehört geprüft,
// bevor sie zur Begründung wird.

import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, MessageSquare, ShieldAlert } from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { useProfiles } from '../../lib/useAuction';
import { useConversations } from '../../lib/useDirectMessages';
import { goBack } from '../../lib/nav';
import { Avatar } from '../../components/Avatar';
import { radius, space, ui } from '../../theme/tokens';

function whenLabel(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std`;
  if (std < 48) return 'gestern';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const { data: conversations = [], isLoading, refetch } = useConversations(myUserId);

  const profiles = useProfiles(conversations.map((c) => c.otherId));

  /**
   * Nur Ungelesenes zeigen.
   *
   * ⚠️ Der Filter erscheint NUR, wenn es etwas zu filtern gibt — und
   * verschwindet wieder, sobald alles gelesen ist. Eine Pille, die dauerhaft
   * dasteht und in neun von zehn Fällen eine leere Liste erzeugt, ist keine
   * Hilfe, sondern eine Falle: Wer sie antippt und nichts sieht, hält den
   * Posteingang für kaputt.
   *
   * Whatnot zeigt sie dauerhaft (elfte Analyse) — dort gibt es aber immer
   * Ungelesenes. Bei Berkats Menge wäre das die falsche Übernahme.
   */
  const [onlyUnread, setOnlyUnread] = useState(false);
  const unreadCount = conversations.filter((c) => c.unread).length;
  const shown = onlyUnread ? conversations.filter((c) => c.unread) : conversations;

  // Wer den Filter anhat und die letzte ungelesene Nachricht öffnet, stünde
  // beim Zurückkommen vor einer leeren Liste. Also fällt der Filter von selbst
  // weg, sobald es nichts mehr zu filtern gibt.
  useEffect(() => {
    if (onlyUnread && unreadCount === 0) setOnlyUnread(false);
  }, [onlyUnread, unreadCount]);

  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  // Stack-Bildschirme bleiben aufgebaut — wer aus einem Verlauf zurückkommt,
  // sähe sonst die alte Reihenfolge.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/account')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Nachrichten</Text>
        <View style={styles.back} />
      </View>

      {/* ⚠️ DIE WICHTIGSTE ZEILE AUF DIESEM BILDSCHIRM.
          Nicht wegtippbar, nicht an Bedingungen geknüpft, immer da.

          Whatnot setzt denselben Satz über jeden seiner drei Posteingänge
          (elfte Analyse). Der Grund ist der häufigste Marktplatz-Betrug: sich
          als Plattform ausgeben und zu einer Zahlung oder Anmeldung außerhalb
          drängen.

          Berkat ist dafür ANFÄLLIGER als Whatnot, nicht weniger. Der ganze Bau
          steht auf „Vertrauen ist personal" — Bürgen, Teip, enge Gemeinschaft.
          Genau diese Nähe macht die Masche wirksam: „Hier ist Berkat, dein
          Konto muss bestätigt werden" wirkt dort, wo man den Betreiber
          persönlich kennt, GLAUBWÜRDIGER als bei einem anonymen Konzern. Und
          ein Betrug, der über Berkat läuft, beschädigt nicht eine Transaktion,
          sondern das Einzige, was die App gegen TikTok und Whatnot in der Hand
          hat.

          Der Satz nennt deshalb die drei Dinge, nach denen tatsächlich gefragt
          wird — Passwort, Zahlung außerhalb, Konto bestätigen — statt allgemein
          „sei vorsichtig" zu sagen. Eine Warnung, die den Angriff nicht
          beschreibt, erkennt man nicht wieder, wenn er kommt. */}
      <View style={styles.safety}>
        <ShieldAlert size={16} color={ui.textMuted} />
        <Text style={styles.safetyText}>
          <Text style={styles.safetyStrong}>Berkat schreibt dir nie hier.</Text> Wer nach deinem
          Passwort fragt, dich außerhalb der App bezahlen lassen will oder sagt, dein Konto müsse
          bestätigt werden, ist nicht von uns — auch wenn der Name so aussieht.
        </Text>
      </View>

      {unreadCount > 0 ? (
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setOnlyUnread((v) => !v)}
            style={[styles.chip, onlyUnread && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: onlyUnread }}
          >
            <Text style={[styles.chipText, onlyUnread && styles.chipTextOn]}>
              {unreadCount === 1 ? '1 ungelesen' : `${unreadCount} ungelesen`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={shown}
        keyExtractor={(c) => c.id}
        contentContainerStyle={
          shown.length === 0
            ? styles.emptyWrap
            : { paddingBottom: insets.bottom + space.xl }
        }
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <MessageSquare size={38} color={ui.sunken} />
              {/* Zwei Leerzustände, weil es zwei verschiedene Lagen sind: „du
                  hast noch nie geschrieben" ist eine Einladung, „der Filter
                  greift gerade nicht" ist eine Auskunft. Denselben Satz für
                  beides zu nehmen wäre bei der zweiten Lage schlicht falsch. */}
              <Text style={styles.emptyTitle}>
                {onlyUnread ? 'Alles gelesen 🎉' : 'Noch keine Nachrichten'}
              </Text>
              <Text style={styles.emptyBody}>
                {onlyUnread
                  ? 'Tipp oben auf die Pille, dann siehst du wieder alle.'
                  : 'Schreib einem Verkäufer aus seiner Show heraus — tipp dort oben auf seinen Namen.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const other = profiles[item.otherId];
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push(`/messages/${item.otherId}`)}
              accessibilityRole="button"
            >
              <Avatar uri={other?.avatarUrl} name={other?.username} size={46} />
              <View style={styles.rowText}>
                {/* Name und Zeit in EINER Zeile — die zweite gehört dem Text.
                    Vorher trug sie die Uhrzeit, und der Posteingang war damit
                    nicht sortierbar: Man musste jede Unterhaltung öffnen, um zu
                    wissen, worum es geht (elfte Whatnot-Analyse). */}
                <View style={styles.rowHead}>
                  <Text numberOfLines={1} style={styles.rowName}>
                    {other?.username ?? '…'}
                  </Text>
                  <Text style={styles.rowWhen}>{whenLabel(item.lastMessageAt)}</Text>
                </View>
                {/* Ungelesenes wird FETT, nicht bunt: Die Zeile selbst ist die
                    Auskunft, der Punkt rechts nur die Marke am Rand. */}
                <Text
                  numberOfLines={1}
                  style={[styles.rowPreview, item.unread && styles.rowPreviewUnread]}
                >
                  {item.preview
                    ? `${item.lastFromMe ? 'Du: ' : ''}${item.preview}`
                    : // Kein Platzhaltertext wie „Keine Nachricht": Eine
                      // Unterhaltung ohne Vorschau ist entweder frisch angelegt
                      // oder die Abfrage ist ausgefallen — beides erklärt sich
                      // schlecht und ist beim Öffnen sofort geklärt.
                      ' '}
                </Text>
              </View>
              {item.unread ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  /**
   * Randlos über die volle Breite und OHNE Rundung — wie Whatnots Warnband.
   * Das ist kein Zufall: Eine gerundete Karte liest sich als Inhalt, ein
   * randloses Band als Eigenschaft des Bildschirms. Der Hinweis soll zum Raum
   * gehören, nicht zur Liste.
   *
   * Gedämpft, nicht rot: Er ist dauerhaft sichtbar, und ein Dauer-Alarm
   * stumpft ab (Design-Gesetz 3) — dieselbe Überlegung wie bei der
   * Lösch-Zeile im Konto (Abschnitt 59). Getragen wird er von der Fettung im
   * ersten Halbsatz, nicht von der Farbe.
   */
  safety: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: ui.sunken,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  safetyText: { flex: 1, fontSize: 12, lineHeight: 17, color: ui.textMuted },
  filterRow: { flexDirection: 'row', paddingHorizontal: space.md, paddingBottom: space.sm },
  // Dieselbe Pillen-Sprache wie im Regal-Filter und bei den Zustands-Chips.
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    backgroundColor: ui.card,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  chipOn: { borderColor: ui.brand, backgroundColor: ui.sunken },
  chipText: { fontSize: 12, fontWeight: '600', color: ui.textMuted },
  chipTextOn: { color: ui.brand },
  safetyStrong: { fontWeight: '700', color: ui.text },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  rowPressed: { backgroundColor: ui.sunken },
  rowText: { flex: 1, minWidth: 0 },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  // `flexShrink: 1`, nicht `flex: 1`: Ein langer Name soll kürzen, aber die
  // Zeit darf er nicht wegdrücken — sie ist die zweite Auskunft der Zeile.
  rowName: { flexShrink: 1, fontSize: 16, fontWeight: '600', color: ui.text },
  rowWhen: { fontSize: 12, color: ui.textMuted },
  rowPreview: { fontSize: 13, color: ui.textMuted, marginTop: 2 },
  rowPreviewUnread: { color: ui.text, fontWeight: '600' },
  // Klein und am rechten Rand, wie überall sonst eine Markierung. Grün statt
  // rot: Rot ist in Berkat die laufende Uhr, und eine ungelesene Nachricht ist
  // keine Frist.
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ui.success },

  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text },
  emptyBody: { fontSize: 14, color: ui.textMuted, textAlign: 'center', lineHeight: 20 },
});
