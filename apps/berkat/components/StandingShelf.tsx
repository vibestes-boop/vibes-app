// „Jetzt kaufbar" — der Laden eines Verkäufers zwischen den Shows.
//
// Steht bewusst ÜBER „Zuletzt verkauft": Das eine ist Ware, das andere ein
// Beleg. Wer auf ein Profil kommt, während niemand sendet, soll etwas tun
// können und nicht nur Vergangenheit lesen.
//
// ⚠️ SEIT DEM 17.08.2026 IST DAS REGAL EIN WEGWEISER, KEIN KAUFHAUS.
// Vorher hing an jeder Zeile ein „Kaufen"- oder „Nachricht"-Knopf, und die
// Karte selbst war überhaupt nicht antippbar — man konnte einen Artikel kaufen,
// aber nicht ansehen. Beschreibung, Rechtsfolge und Versandkosten standen
// nirgends.
//
// Jetzt führt jede Karte auf `/listing/<id>`, und dort steht der einzige
// Kaufknopf der App. Das ist dieselbe Linie, die am 16.08.2026 aus dem
// Gebots-Tipper eine Ziehbahn gemacht hat: Ein Kauf ist eine bindende
// Willenserklärung über echtes Geld und darf nicht dieselbe Geste sein wie
// „mal gucken".
//
// Die Zeichenarbeit liegt in `ListingCard` — einmal für alle vier Flächen
// (Marktplatz, Kategorie, Profil, eigenes Regal). Vorher war sie viermal
// abgeschrieben und bereits auseinandergelaufen.

import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MoreHorizontal, ShoppingBag } from 'lucide-react-native';

import { ui, radius, space } from '../theme/tokens';
import type { Listing } from '../lib/useListings';
import { ListingCard } from './ListingCard';

type Props = {
  listings: Listing[];
  /** Der Betrachter ist der Verkäufer — dann steht am Regal das Zurückziehen. */
  isOwner: boolean;
  /** Aufrufe je Angebot — nur im eigenen Regal gesetzt. */
  viewCounts?: Map<string, number>;
  /**
   * Merkungen je Angebot — ebenfalls nur im eigenen Regal.
   *
   * ⚠️ Das staerkere der beiden Signale. Ein Aufruf heisst „draufgetippt",
   * eine Merkung „will ich haben, nur noch nicht jetzt". Der Verkaeufer sah
   * sie bis zum 21.09.2026 nirgends — dabei ist genau sie der Grund, den Preis
   * zu senken statt den Artikel zurueckzuziehen.
   */
  saveCounts?: Map<string, number>;
  busyId: string | null;
  onCancel: (listing: Listing) => void;
  /**
   * Ersetzt den Schlusssatz unter der Liste.
   *
   * ⚠️ Damit dort nicht ZWEI graue Saetze untereinander stehen: Der
   * Regal-Bildschirm trug seinen „noch nicht angesehen"-Hinweis bis zum
   * 21.09.2026 ausserhalb der Karte, direkt unter diesem hier. Zwei Fussnoten
   * derselben Farbe an derselben Stelle liest niemand.
   */
  hint?: string | null;
  /**
   * Was bei einem leeren Regal stehen soll. Ohne diesen Text bleibt die
   * Komponente unsichtbar.
   *
   * Am 16.08.2026 aufgefallen: Ein leeres Regal war von „gibt es hier gar
   * nicht" nicht zu unterscheiden — ausgerechnet auf dem EIGENEN Profil, also
   * genau dort, wo die Aufforderung stehen müsste, eines zu füllen. Auf einem
   * fremden Profil bleibt es richtig, nichts zu zeigen: „Dieser Verkäufer hat
   * nichts" ist eine Auskunft, die niemand braucht.
   */
  emptyText?: string | null;
  /**
   * ⚠️ Ohne diese zwei erscheint KEIN Merken-Herz — `ListingCard` zeigt es nur,
   * wenn `onToggleSaved` ankommt.
   *
   * Bis zum 23.08.2026 fehlten sie hier, und damit war das Regal auf einem
   * FREMDEN Profil die einzige Stöber-Fläche ohne Herz: Dieselben Artikel
   * tragen auf `/shop`, in der Kategorie und auf der Startseite eines. Wer
   * einen Verkäufer über sein Profil entdeckt — also auf dem Weg, den der
   * „Demnächst"-Streifen und die Verkäufer-Suche nehmen — konnte sich nichts
   * merken.
   *
   * Im EIGENEN Regal bleibt das Herz weg, und das entscheidet `ListingCard`
   * selbst über `mine`: Gemerkt wird, was einem nicht gehört.
   */
  savedIds?: Set<string>;
  onToggleSaved?: (auctionId: string, saved: boolean) => void;
  /**
   * `grid` zeigt große quadratische Bilder in zwei Spalten, `list` die
   * kompakten Zeilen.
   *
   * Der Unterschied ist keine Geschmacksfrage, sondern folgt der Frage, die der
   * Bildschirm beantwortet:
   *   • Auf dem PROFIL stöbert ein Fremder — „was soll ich mir ansehen?".
   *     Dort trägt das Bild.
   *   • Unter `/shelf` verwaltet der Verkäufer sein eigenes Regal — „welches
   *     davon ziehe ich zurück?". Dort ist das Bild nur Wiedererkennung, und
   *     eine Zeile zeigt mehr Artikel auf einmal.
   *
   * Am 16.08.2026 nachgemessen: Whatnot benutzt beide Größen, nur an den
   * jeweils richtigen Stellen.
   */
  layout?: 'list' | 'grid';
};

export function StandingShelf({
  listings,
  isOwner,
  viewCounts,
  saveCounts,
  hint,
  busyId,
  onCancel,
  emptyText,
  layout = 'list',
  savedIds,
  onToggleSaved,
}: Props) {
  const head = (
    <View style={s.head}>
      <ShoppingBag size={16} color={ui.text} />
      <Text style={s.title}>Jetzt kaufbar</Text>
      {listings.length > 0 ? <Text style={s.count}>{listings.length}</Text> : null}
    </View>
  );

  if (listings.length === 0) {
    if (!emptyText) return null;
    return (
      <View style={s.wrap}>
        {head}
        <Text style={s.empty}>{emptyText}</Text>
      </View>
    );
  }

  const open = (item: Listing) => router.push(`/listing/${item.id}`);

  return (
    <View style={s.wrap}>
      {head}

      {layout === 'grid' ? (
        <View style={s.grid}>
          {listings.map((item) => (
            // `48%` statt `flex: 1`: In einem umbrechenden Flex-Container würde
            // `flex: 1` eine einzelne Karte in der letzten Zeile auf volle
            // Breite ziehen.
            <View key={item.id} style={s.cell}>
              <ListingCard
                listing={item}
                mine={isOwner}
                saved={Boolean(savedIds?.has(item.id))}
                onPress={() => open(item)}
                onToggleSaved={
                  onToggleSaved
                    ? () => onToggleSaved(item.id, Boolean(savedIds?.has(item.id)))
                    : undefined
                }
              />
            </View>
          ))}
          {/* Hält die letzte Spalte offen, wenn die Anzahl ungerade ist. */}
          {listings.length % 2 === 1 ? <View style={s.cell} /> : null}
        </View>
      ) : (
        listings.map((item) => (
          <ListingCard
            key={item.id}
            listing={item}
            layout="row"
            mine={isOwner}
            viewCount={viewCounts?.get(item.id)}
            saveCount={saveCounts?.get(item.id)}
            saved={Boolean(savedIds?.has(item.id))}
            onPress={() => open(item)}
            onToggleSaved={
              onToggleSaved
                ? () => onToggleSaved(item.id, Boolean(savedIds?.has(item.id)))
                : undefined
            }
            /* ⚠️ HIER STAND SECHSMAL „ZURUECKZIEHEN" (bis 21.09.2026).
               Ein breiter, umrandeter Knopf an jeder Zeile — die
               zerstoererischste Handlung des Bildschirms als sein
               auffaelligstes Element, untereinander wiederholt. Und
               BEARBEITEN gab es hier gar nicht: Fuer eine Preissenkung
               brauchte es vier Tipps (Zeile → Artikelseite → Bearbeiten →
               Feld).

               Jetzt ein stilles „⋯" mit beidem dahinter. Zurueckziehen
               bekommt damit seine Rueckfrage — dieselbe Linie wie bei
               „Artikel verwerfen?" in `PrepareSheet`: Was weg ist, ist weg,
               also fragt man einmal. */
            trailing={
              isOwner ? (
                <Pressable
                  style={s.more}
                  hitSlop={6}
                  disabled={busyId === item.id}
                  onPress={() =>
                    Alert.alert(item.title, undefined, [
                      {
                        text: 'Bearbeiten',
                        onPress: () => router.push(`/listing/${item.id}?edit=1`),
                      },
                      {
                        text: 'Zurückziehen',
                        style: 'destructive',
                        onPress: () => onCancel(item),
                      },
                      { text: 'Abbrechen', style: 'cancel' },
                    ])
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}: bearbeiten oder zurückziehen`}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator color={ui.textMuted} />
                  ) : (
                    <MoreHorizontal size={20} color={ui.textMuted} />
                  )}
                </Pressable>
              ) : undefined
            }
          />
        ))
      )}

      {/* Derselbe Satz wie im Live-Raum, und er stimmt aus demselben Grund:
          Ein Kauf hier landet im gleichen Paket wie ein Zuschlag heute Abend. */}
      <Text style={s.hint}>
        {hint ??
          (isOwner
            ? 'Diese Artikel bleiben kaufbar, auch wenn du nicht sendest.'
            : 'Kommt in dasselbe Paket wie deine Zuschläge — du zahlst nur einmal Versand.')}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.lg,
    marginTop: space.md,
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: ui.text },
  count: { fontSize: 12, fontWeight: '700', color: ui.textMuted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xs },
  cell: { width: '48%' },

  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  hint: { fontSize: 11, color: ui.textMuted, marginTop: space.xs, lineHeight: 16 },
  empty: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },
});
