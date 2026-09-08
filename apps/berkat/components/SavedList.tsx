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
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ArrowRight, Bell, ChevronRight, Heart, RefreshCw, Search, X } from 'lucide-react-native';

import { useSavedCounts, useSavedListings, useToggleSaved, type SavedListing } from '../lib/useSaved';
import { useMyReminders, type MyReminder } from '../lib/useReminders';
import { useSavedSearchActions, useSavedSearches } from '../lib/useSavedSearches';
import { useUsernames } from '../lib/useAuction';
import { ListingCard } from './ListingCard';
import { radius, space, ui } from '../theme/tokens';
import { PressFeedback } from './PressFeedback';

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
  const { data: saved = [], isLoading, isError, refetch } = useSavedListings(userId);
  const { data: reminders = [], isLoading: remindersLoading, isError: remindersError, refetch: refetchReminders } = useMyReminders(userId);
  const { data: searches = [], isLoading: searchesLoading, isError: searchesError, refetch: refetchSearches } = useSavedSearches(userId);
  const { remove: removeSearch } = useSavedSearchActions(userId);
  const toggle = useToggleSaved(userId);

  const [slice, setSlice] = useState<Slice>('alle');
  const [pulling, setPulling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
  const hasVisibleData = (showItems && saved.length > 0) || (showReminders && reminders.length > 0) || (showSearches && searches.length > 0);
  const loading = (showItems && isLoading) || (showReminders && remindersLoading) || (showSearches && searchesLoading);
  const failed = (showItems && isError) || (showReminders && remindersError) || (showSearches && searchesError);
  const emptyCopy = slice === 'vorgemerkt'
    ? { title: 'Deine nächsten Entdeckungen', body: 'Mit der Glocke an einem vorbereiteten Artikel merkst du dir, was du in einer Show sehen möchtest.', action: 'Shows entdecken', target: '/(tabs)' as const }
    : slice === 'suchen'
      ? { title: 'Deine Suchen an einem Ort', body: 'Speichere eine Suche im Marktplatz. Hier kannst du sie jederzeit wieder öffnen.', action: 'Suche starten', target: '/shop' as const }
      : slice === 'artikel'
        ? { title: 'Platz für deine Favoriten', body: 'Tippe auf das Herz an einem Angebot. So findest du es hier schnell wieder.', action: 'Angebote entdecken', target: '/shop' as const }
        : { title: 'Behalte deine Favoriten im Blick', body: 'Angebote, Vormerkungen und gespeicherte Suchen — hier ist alles, worauf du zurückkommen möchtest.', action: 'Entdecken', target: '/shop' as const };

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
          {nothingAtAll && slice === 'alle' ? null : (
            <View style={styles.pills}>
              {SLICES.map((sl) => {
                const active = slice === sl.key;
                return (
                  <PressFeedback
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
                  </PressFeedback>
                );
              })}
            </View>
          )}

          {failed && hasVisibleData ? (
            <PressFeedback onPress={() => void onPull()} style={styles.notice} accessibilityRole="button">
              <RefreshCw size={16} color={ui.textMuted} />
              <Text style={styles.noticeText}>Ein Teil fehlt gerade. Erneut laden</Text>
            </PressFeedback>
          ) : null}
          {actionError ? <Text style={styles.actionError} accessibilityRole="alert">{actionError}</Text> : null}

          {/* ── Vorgemerkt. Steht ZUERST, weil es das Einzige hier mit einer Uhr
              ist: Ein gemerkter Artikel wartet, eine Vormerkung läuft ab. */}
          {showReminders && reminders.length > 0 ? (
            <View style={styles.section}>
              {slice === 'alle' ? <Text style={styles.sectionLabel}>Vorgemerkt</Text> : null}
              {reminders.map((r: MyReminder) => {
                const when = whenLabel(r.scheduledAt);
                return (
                  <PressFeedback
                    key={r.auctionId}
                    style={[styles.line]}
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
                      <Text numberOfLines={2} style={styles.lineTitle}>
                        {r.title}
                      </Text>
                      <Text style={styles.lineMeta}>{sellerNames[r.sellerId] ?? 'Verkäufer'}</Text>
                    </View>
                    <ChevronRight size={18} color={ui.textMuted} />
                  </PressFeedback>
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
                <PressFeedback
                  style={styles.searchAction}
                  onPress={() => router.push(`/shop?q=${encodeURIComponent(sq.query)}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Nach ${sq.query} suchen`}
                >
                  <Text numberOfLines={2} style={styles.lineTitle}>
                    {sq.query}
                  </Text>
                  <Text style={styles.lineMeta}>Du wirst benachrichtigt, wenn etwas passt</Text>
                </PressFeedback>
                <PressFeedback
                  style={styles.remove}
                  disabled={removeSearch.isPending}
                  accessibilityState={{ disabled: removeSearch.isPending, busy: removeSearch.isPending && removeSearch.variables === sq.id }}
                  onPress={() => {
                    setActionError(null);
                    removeSearch.mutate(sq.id, { onError: () => setActionError('Die Suche konnte nicht entfernt werden. Versuch es noch einmal.') });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Suche ${sq.query} löschen`}
                >
                  {removeSearch.isPending && removeSearch.variables === sq.id ? <ActivityIndicator size="small" color={ui.textMuted} /> : <X size={18} color={ui.textMuted} />}
                </PressFeedback>
              </View>
            ))}
          </View>
        ) : null
      }
      ListEmptyComponent={
        hasVisibleData ? null : (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              {loading ? <ActivityIndicator color={ui.brand} /> : failed ? <RefreshCw size={28} color={ui.brand} /> : slice === 'suchen' ? <Search size={28} color={ui.brand} /> : slice === 'vorgemerkt' ? <Bell size={28} color={ui.brand} /> : <Heart size={28} color={ui.brand} />}
            </View>
            <Text style={styles.emptyTitle} accessibilityRole="header">{loading ? 'Wird geladen' : failed ? 'Gerade nicht erreichbar' : emptyCopy.title}</Text>
            <Text style={styles.emptyBody}>
              {loading ? 'Deine Merkliste ist gleich da.' : failed ? 'Wir konnten diesen Bereich nicht vollständig laden. Versuch es gleich noch einmal.' : emptyCopy.body}
            </Text>
            {!loading ? (
              <PressFeedback style={[styles.emptyAction]} onPress={failed ? () => void onPull() : () => router.push(emptyCopy.target)} accessibilityRole="button">
                <Text style={styles.emptyActionText}>{failed ? 'Erneut versuchen' : emptyCopy.action}</Text>
                <ArrowRight size={17} color={ui.card} />
              </PressFeedback>
            ) : null}
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
            onToggleSaved={() => {
              if (toggle.isPending) return;
              setActionError(null);
              toggle.mutate({ auctionId: item.id, saved: true }, { onError: () => setActionError('Der Artikel konnte nicht entfernt werden. Versuch es noch einmal.') });
            }}
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
    minHeight: 40,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: ui.brand, borderColor: ui.brand },
  pillText: { fontSize: 13, fontWeight: '600', color: ui.textMuted },
  pillTextActive: { color: ui.bg },

  section: { gap: space.sm },
  sectionLabel: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.text },

  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: ui.card, padding: space.md, borderRadius: radius.lg },
  lineThumb: { width: 56, height: 64, borderRadius: radius.md, backgroundColor: ui.sunken },
  searchIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lineWhen: { flexShrink: 1, fontSize: 13, lineHeight: 19, fontWeight: '700', color: ui.textMuted },
  lineTitle: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.text, marginTop: space.xs },
  lineMeta: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginTop: space.xs },
  searchAction: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center' },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notice: { flexDirection: 'row', gap: space.sm, alignItems: 'center', backgroundColor: ui.card, borderRadius: radius.md, padding: space.md },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, color: ui.textMuted },
  actionError: { fontSize: 13, lineHeight: 19, color: ui.live },

  empty: {
    alignItems: 'center',
    paddingTop: space.xl * 2,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: ui.card, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  emptyTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', color: ui.text, textAlign: 'center' },
  emptyBody: { fontSize: 15, color: ui.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 340 },
  emptyAction: { minHeight: 48, paddingHorizontal: space.lg, paddingVertical: space.md, marginTop: space.md, borderRadius: radius.pill, backgroundColor: ui.brand, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  emptyActionText: { flexShrink: 1, fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.card },
});
