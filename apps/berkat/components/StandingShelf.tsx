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
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';

import { ui, radius, space } from '../theme/tokens';
import type { Listing } from '../lib/useListings';
import { ListingCard } from './ListingCard';

type Props = {
  listings: Listing[];
  /** Der Betrachter ist der Verkäufer — dann steht am Regal das Zurückziehen. */
  isOwner: boolean;
  busyId: string | null;
  onCancel: (listing: Listing) => void;
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
  busyId,
  onCancel,
  emptyText,
  layout = 'list',
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
              <ListingCard listing={item} mine={isOwner} onPress={() => open(item)} />
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
            onPress={() => open(item)}
            // Der Knopf sitzt NEBEN der Fläche, die zum Artikel führt. Im
            // eigenen Regal ist Zurückziehen der häufige Handgriff — ihn erst
            // eine Seite tiefer anzubieten hieße, fünf Artikel fünfmal zu
            // öffnen.
            trailing={
              isOwner ? (
                <Pressable
                  style={s.ghost}
                  disabled={busyId === item.id}
                  onPress={() => onCancel(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} zurückziehen`}
                >
                  {busyId === item.id ? (
                    <ActivityIndicator color={ui.textMuted} />
                  ) : (
                    <Text style={s.ghostText}>Zurückziehen</Text>
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
        {isOwner
          ? 'Diese Artikel bleiben kaufbar, auch wenn du nicht sendest.'
          : 'Kommt in dasselbe Paket wie deine Zuschläge — du zahlst nur einmal Versand.'}
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

  ghost: {
    minWidth: 84,
    height: 38,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 12, fontWeight: '600', color: ui.textMuted },

  hint: { fontSize: 11, color: ui.textMuted, marginTop: space.xs, lineHeight: 16 },
  empty: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },
});
