// Gemerkt — die drei Arten, sich etwas aufzuheben, an einem Ort.
//
// ── ⚠️ WARUM DREI UND NICHT EINE (24.08.2026) ───────────────────────────────
//
// Berkat kannte drei Wege, „darauf komme ich zurück" zu sagen — und sie lagen an
// drei Orten, einer davon nirgends:
//
//   Merken (Herz)        „interessiert mich"                → Konto
//   Vormerken (Glocke)   „ruf mich, wenn der drankommt"     → NIRGENDS
//   Gespeicherte Suche   „sag mir, wenn so etwas reinkommt" → nur `shop.tsx`
//
// Die Vormerkung war die schmerzhafteste Lücke: Setzen konnte man sie am
// Aufgebot eines Termins, nachsehen nirgends. Wer sich drei Sachen bei drei
// Verkäufern vormerkte, hatte keinen Ort, an dem sie stehen — obwohl das das
// Signal ist, das am meisten über Kaufabsicht sagt.
//
// Whatnots „Saved" führt dieselben drei (Shows · Products · Searches) unter
// einer Reihe Pillen. Von dort ist die Bauform abgeschaut, mit einer bewussten
// Abweichung: Ihre „Shows" merken eine GANZE Sendung vor, unsere Vormerkung
// gilt EINEM Artikel darin. Deshalb heisst die Pille „Vorgemerkt" und nicht
// „Sendungen" — sie verspricht nicht, was sie nicht hält.
//
// ── ZWEISPALTIG, UND WAS DAS KOSTET ─────────────────────────────────────────
//
// Im Zeilen-Layout trug der `trailing`-Bereich von `ListingCard` das Etikett
// „Verkauft" / „Weg". Den gibt es im Gitter nicht. Damit die Auskunft nicht
// stumm verschwindet — und sie IST der Zweck einer Merkliste —, zeigt die
// Gitter-Karte den Status seit dem 24.08.2026 selbst, unten links über dem Bild.
//
// ── DIE BAUFORM ─────────────────────────────────────────────────────────────
//
// Eine FlatList trägt das Gitter der Artikel (Virtualisierung), die beiden
// anderen Abschnitte hängen als Kopf und Fuss daran. „Alle" mischt NICHT,
// sondern gliedert — genau wie bei Whatnot: Abschnitte untereinander, jeder mit
// Überschrift, statt einer chronologischen Suppe.
//
// Was hier NICHT hineingehört: Kopfzeile und Navigation. Die unterscheiden sich
// je Haus — auf `/saved` ein Titel mit Zurück, im Reiter „Gemerkt" gar nichts.

import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Bell, ChevronRight, Search, X } from 'lucide-react-native';

import { useSavedCounts, useSavedListings, useToggleSaved, type SavedListing } from '../lib/useSaved';
import { useMyReminders, type MyReminder } from '../lib/useReminders';
import { useSavedSearchActions, useSavedSearches } from '../lib/useSavedSearches';
import { useUsernames } from '../lib/useAuction';
import { ListingCard } from './ListingCard';
import { BerkatMark } from './BerkatMark';
import { radius, space, ui } from '../theme/tokens';

/**
 * Der Lückenfüller der letzten Reihe.
 *
 * ⚠️ Kein Zierrat: `ListingCard`s Zelle ist `flex: 1`. Bei ungerader Anzahl
 * zöge die letzte Karte sonst über die volle Breite — derselbe Fehler, der im
 * Shop schon einmal auftrat (v1.26.3).
 */
const SPACER_ID = '__spacer__';
type Row = SavedListing | { id: typeof SPACER_ID; spacer: true };

type Slice = 'alle' | 'vorgemerkt' | 'artikel' | 'suchen';

const SLICES: { key: Slice; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'vorgemerkt', label: 'Vorgemerkt' },
  { key: 'artikel', label: 'Artikel' },
  { key: 'suchen', label: 'Suchen' },
];

/** „Sa, 24.08. · 20:00" — kurz, weil es über dem Titel steht und nicht statt ihm. */
function whenLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const tag = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${tag} · ${uhr}`;
}

type Props = {
  userId: string | null;
  /** Platz für die Reiter-Leiste beziehungsweise den unteren Rand. */
  bottomInset: number;
};

export function SavedList({ userId, bottomInset }: Props) {
  const { data: saved = [], isLoading, refetch } = useSavedListings(userId);
  const { data: reminders = [], refetch: refetchReminders } = useMyReminders(userId);
  const { data: searches = [], refetch: refetchSearches } = useSavedSearches(userId);
  const { remove: removeSearch } = useSavedSearchActions(userId);
  const toggle = useToggleSaved(userId);

  const [slice, setSlice] = useState<Slice>('alle');
  const [pulling, setPulling] = useState(false);

  // Verkäufername und Merk-Zähler gehören zur Karte — ohne sie ist das Gitter
  // nur ein Bild. Beides sind Nachschlage-Abfragen über die ohnehin geladenen
  // Kennungen, keine zusätzliche Runde pro Karte.
  const sellerNames = useUsernames([
    ...saved.map((l) => l.seller_id),
    ...reminders.map((r) => r.sellerId),
  ]);
  const { data: saveCounts } = useSavedCounts(saved.map((l) => l.id));

  const showItems = slice === 'alle' || slice === 'artikel';
  const showReminders = slice === 'alle' || slice === 'vorgemerkt';
  const showSearches = slice === 'alle' || slice === 'suchen';

  const rows = useMemo<Row[]>(() => {
    if (!showItems) return [];
    return saved.length % 2 === 1 ? [...saved, { id: SPACER_ID, spacer: true as const }] : saved;
  }, [saved, showItems]);

  // Stack-Falle: Wer von hier einen Artikel öffnet, dort das Herz wegnimmt und
  // zurückkommt, sähe ihn sonst noch in der Liste.
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchReminders();
      void refetchSearches();
    }, [refetch, refetchReminders, refetchSearches]),
  );

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([refetch(), refetchReminders(), refetchSearches()]);
    } finally {
      setPulling(false);
    }
  }, [refetch, refetchReminders, refetchSearches]);

  const nothingAtAll = saved.length === 0 && reminders.length === 0 && searches.length === 0;

  return (
    <FlatList
      data={rows}
      numColumns={2}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={{ gap: space.md }}
      contentContainerStyle={{
        gap: space.md,
        paddingHorizontal: space.md,
        paddingBottom: bottomInset + space.xl,
      }}
      refreshControl={
        <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
      }
      ListHeaderComponent={
        <View style={styles.head}>
          {nothingAtAll ? null : (
            <View style={styles.pills}>
              {SLICES.map((sl) => {
                const active = slice === sl.key;
                return (
                  <Pressable
                    key={sl.key}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setSlice(sl.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={sl.label}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>
                      {sl.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ── Vorgemerkt. Steht ZUERST, weil es das Einzige hier mit einer Uhr
              ist: Ein gemerkter Artikel wartet, eine Vormerkung läuft ab. */}
          {showReminders && reminders.length > 0 ? (
            <View style={styles.section}>
              {slice === 'alle' ? <Text style={styles.sectionLabel}>Vorgemerkt</Text> : null}
              {reminders.map((r: MyReminder) => {
                const when = whenLabel(r.scheduledAt);
                return (
                  <Pressable
                    key={r.auctionId}
                    style={({ pressed }) => [styles.line, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push(`/listing/${r.auctionId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.title}${when ? `, ${when}` : ''}`}
                  >
                    {r.imageUrl ? (
                      <Image
                        source={{ uri: r.imageUrl }}
                        style={styles.lineThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.lineThumb} />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.lineTop}>
                        <Bell size={12} color={ui.textMuted} />
                        {/* ⚠️ Die Uhrzeit steht ZUERST, nicht der Titel. Eine
                            Vormerkung sagt „ruf mich, wenn es soweit ist" —
                            ohne das WANN wäre sie eine Sammlung ohne Aussage. */}
                        <Text style={styles.lineWhen}>{when ?? 'Termin offen'}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.lineTitle}>
                        {r.title}
                      </Text>
                      <Text style={styles.lineMeta}>{sellerNames[r.sellerId] ?? 'Verkäufer'}</Text>
                    </View>
                    <ChevronRight size={18} color={ui.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {showItems && saved.length > 0 && slice === 'alle' ? (
            <Text style={styles.sectionLabel}>Artikel</Text>
          ) : null}
        </View>
      }
      ListFooterComponent={
        showSearches && searches.length > 0 ? (
          <View style={[styles.section, styles.foot]}>
            {slice === 'alle' ? <Text style={styles.sectionLabel}>Suchen</Text> : null}
            {searches.map((sq) => (
              <View key={sq.id} style={styles.line}>
                <View style={styles.searchIcon}>
                  <Search size={16} color={ui.textMuted} />
                </View>
                {/* Die Suche führt in den Marktplatz — `shop.tsx` nimmt `?q=`
                    entgegen. Eine gespeicherte Suche, die man nicht ausführen
                    kann, wäre ein Zettel ohne Stift. */}
                <Pressable
                  style={{ flex: 1, minWidth: 0 }}
                  onPress={() => router.push(`/shop?q=${encodeURIComponent(sq.query)}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Nach ${sq.query} suchen`}
                >
                  <Text numberOfLines={1} style={styles.lineTitle}>
                    {sq.query}
                  </Text>
                  <Text style={styles.lineMeta}>Du wirst benachrichtigt, wenn etwas passt</Text>
                </Pressable>
                <Pressable
                  hitSlop={10}
                  onPress={() => removeSearch.mutate(sq.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Suche ${sq.query} löschen`}
                >
                  <X size={18} color={ui.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null
      }
      ListEmptyComponent={
        // ⚠️ Nur wenn WIRKLICH nichts da ist. Sonst stünde „noch nichts gemerkt"
        // unter einer Liste mit drei Vormerkungen.
        !nothingAtAll ? null : isLoading ? (
          <ActivityIndicator style={{ marginTop: space.xl }} color={ui.textMuted} />
        ) : (
          <View style={styles.empty}>
            <BerkatMark size={36} color={ui.sunken} />
            <Text style={styles.emptyTitle}>Noch nichts gemerkt</Text>
            <Text style={styles.emptyBody}>
              Das Herz an einem Angebot, die Glocke an einem vorbereiteten Artikel oder eine
              gespeicherte Suche im Marktplatz — alles drei findest du hier wieder.
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        if ('spacer' in item) return <View style={{ flex: 1 }} />;
        return (
          <ListingCard
            listing={item}
            layout="grid"
            sellerName={sellerNames[item.seller_id]}
            onPress={() => router.push(`/listing/${item.id}`)}
            // Hier ist per Definition alles gemerkt — das Herz ist gefüllt und
            // der Tipp darauf nimmt es aus der Liste. Dass ein verkaufter
            // Artikel trotzdem sichtbar bleibt, ist Absicht; das Etikett unten
            // links in `ListingCard` sagt, was mit ihm passiert ist.
            saved
            onToggleSaved={() => toggle.mutate({ auctionId: item.id, saved: true })}
            saveCount={saveCounts?.get(item.id)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  head: { marginTop: space.md, gap: space.md },
  foot: { marginTop: space.md },

  // Pillen für den Ausschnitt, Textreiter für das Register darüber: zwei
  // Aufgaben, zwei Formen. Wer beides gleich aussehen lässt, macht aus einer
  // Hierarchie eine Reihe.
  pills: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: space.md,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: ui.text, borderColor: ui.text },
  pillText: { fontSize: 13, fontWeight: '600', color: ui.textMuted },
  pillTextActive: { color: ui.bg },

  section: { gap: space.sm },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: ui.textMuted },

  line: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lineThumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: ui.sunken },
  searchIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lineWhen: { fontSize: 12, fontWeight: '700', color: ui.textMuted },
  lineTitle: { fontSize: 14, fontWeight: '600', color: ui.text, marginTop: 1 },
  lineMeta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },

  empty: {
    alignItems: 'center',
    paddingTop: space.xl * 2,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text },
  emptyBody: { fontSize: 13, color: ui.textMuted, textAlign: 'center', lineHeight: 19 },
});
