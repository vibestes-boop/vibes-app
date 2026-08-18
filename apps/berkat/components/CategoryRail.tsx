// Die Kategorie-Leiste mit zwei Größen.
//
// Ganz oben sind es Kacheln, beim Scrollen schrumpfen sie zu Pillen und beim
// Zurückscrollen wachsen sie wieder. Der Sinn: solange man noch nicht weiß,
// was man will, ist die Auswahl das Wichtigste auf dem Bildschirm. Sobald man
// scrollt, hat man sich entschieden — dann darf sie Platz abgeben, ohne ganz
// zu verschwinden.
//
// SEIT 18.08.2026: ENTDECKUNG, NICHT FILTER FÜR LAUFENDE SHOWS.
// Vorher wurde die Leiste aus den gerade laufenden Shows aufgebaut. Damit war
// sie genau dann leer, wenn niemand sendet — also rund 94 % der Zeit, und dann
// stand dort eine einzelne goldene Kachel „Für dich", die nichts filterte.
//
// Whatnots Leiste zeigt ALLE Kategorien, immer, unabhängig davon ob dort jemand
// sendet (WHATNOT-ANALYSE, Nachtrag zur vierten Analyse). Sie beantwortet „was
// gibt es hier?", nicht „was läuft gerade?" — die zweite Frage beantwortet das
// Raster darunter ohnehin schon.
//
// Jede Kachel trägt deshalb ein Bild: heute das Symbol aus `categoryArt`,
// später das freigestellte Produktfoto. Die Kachel ändert sich dabei nicht.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { categoryArt } from '../theme/categoryArt';
import { ui, radius, space } from '../theme/tokens';

export const RAIL_TALL = 112;
export const RAIL_SHORT = 44;

export type RailItem = {
  /**
   * Der Schlüssel — und zwar der Slug, NICHT der Anzeigename.
   *
   * Bis zum 16.08.2026 war beides dasselbe Feld, weil `live_sessions.category`
   * eine freie Zeichenkette war (und in Berkat immer `'shopping'`). Seit die
   * Kategorien eine gepflegte Liste sind, stehen dort Slugs — die Leiste hätte
   * „beauty" und „buecher" angezeigt statt „Beauty & Duft" und „Bücher &
   * Medien".
   */
  slug: string;
  /** Was der Mensch liest. */
  name: string;
  /** Wie viele Shows laufen gerade darin */
  liveCount: number;
  /**
   * Wie viele Artikel dort dauerhaft liegen.
   *
   * Steht auf der Kachel, wenn keine Show läuft — sonst wäre die Leiste eine
   * Reihe von Namen ohne jede Auskunft darüber, wo sich das Hinsehen lohnt.
   */
  listingCount?: number;
  /**
   * `false` für Einträge, die keine Kategorie sind — heute nur „Für dich".
   *
   * Ein Symbol wäre dort eine Behauptung: Es gibt kein Bild für „alles". Bei
   * Whatnot steht an dieser Stelle der eigene Avatar; bis Berkat den in der
   * Leiste hat, bleibt die Fläche leer und die Kachel trägt nur ihren Namen.
   */
  art?: false;
};

type Props = {
  items: RailItem[];
  /** Slug der gewählten Kategorie. */
  active: string;
  collapsed: boolean;
  onSelect: (slug: string) => void;
};

export function CategoryRail({ items, active, collapsed, onSelect }: Props) {
  // Ein Wert von 0 (Kachel) bis 1 (Pille) treibt Höhe und Übergang.
  const shrink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(shrink, {
      toValue: collapsed ? 1 : 0,
      duration: 190,
      // Höhe lässt sich nicht auf dem UI-Thread animieren.
      useNativeDriver: false,
    }).start();
  }, [collapsed, shrink]);

  const height = shrink.interpolate({
    inputRange: [0, 1],
    outputRange: [RAIL_TALL, RAIL_SHORT],
  });
  const tileOpacity = shrink.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0] });
  const pillOpacity = shrink.interpolate({ inputRange: [0.4, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={{ height }}>
      {/* Beide Formen liegen übereinander und blenden gegeneinander — das ist
          ruhiger als ein Umbau des Baums mitten in der Bewegung. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: tileOpacity }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {items.map((item) => {
            const on = item.slug === active;
            const art = categoryArt(item.slug);
            const Icon = art.icon;
            // Live schlägt Bestand: Wo gerade jemand sendet, ist das die
            // Auskunft, die zählt. Sonst die Zahl der Artikel — und wenn beides
            // fehlt, gar nichts. Eine Null ist kein Stand, sondern eine
            // Enttäuschung in Zahlenform (dieselbe Regel wie im Reiter).
            const line =
              item.liveCount > 0
                ? `${item.liveCount} live`
                : item.listingCount
                  ? `${item.listingCount} kaufbar`
                  : null;
            return (
              <Pressable
                key={item.slug}
                onPress={() => onSelect(item.slug)}
                style={[styles.tile, on && styles.tileActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={line ? `${item.name}, ${line}` : item.name}
              >
                {/* Zwei Zeilen, nicht eine: „Beauty & Duft" und „Bücher &
                    Medien" enden sonst nach dem Kaufmanns-Und. Genau so stand
                    es am 18.08.2026 am Gerät — „Beauty &…", „Haus & D…". */}
                <Text
                  numberOfLines={2}
                  style={[
                    styles.tileText,
                    item.art === false && styles.tileTextSolo,
                    on && styles.tileTextActive,
                  ]}
                >
                  {item.name}
                </Text>

                {/* Die Bildfläche. Heute ein Symbol auf gedecktem Ton, später
                    das freigestellte Foto — `categoryArt` entscheidet, diese
                    Kachel bleibt gleich. */}
                {item.art !== false ? (
                  <View style={[styles.tileArt, { backgroundColor: on ? ui.bg : art.tint }]}>
                    {art.photo ? (
                      <Image
                        source={art.photo}
                        style={StyleSheet.absoluteFill}
                        contentFit="contain"
                        transition={120}
                      />
                    ) : (
                      <Icon size={22} color={ui.brand} />
                    )}
                  </View>
                ) : null}

                {line ? (
                  <Text style={[styles.tileCount, on && styles.tileCountActive]}>{line}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: pillOpacity }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rowShort}
        >
          {items.map((item) => {
            const on = item.slug === active;
            return (
              <Pressable
                key={item.slug}
                onPress={() => onSelect(item.slug)}
                style={[styles.pill, on && styles.pillActive]}
                accessibilityRole="button"
              >
                <Text numberOfLines={1} style={[styles.pillText, on && styles.pillTextActive]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingHorizontal: space.md, alignItems: 'center' },
  rowShort: { gap: space.sm, paddingHorizontal: space.md, alignItems: 'center', height: RAIL_SHORT },

  // Name oben, Bild darunter, Zahl unten — dieselbe Anordnung wie bei Whatnot
  // und wie im Kategorien-Reiter. Schmaler als vorher (88 statt 104): Es sind
  // jetzt zwölf Kacheln statt einer, und wer scrollen soll, muss am Rand sehen,
  // dass da noch etwas kommt.
  tile: {
    width: 88,
    height: 100,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    padding: 8,
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileActive: { backgroundColor: ui.gold, borderColor: ui.brand },
  tileText: { fontSize: 12, fontWeight: '700', color: ui.text, textAlign: 'center' },
  // „Für dich" trägt kein Bild und hätte sonst den Namen oben und darunter
  // nichts. Ohne Bildfläche gehört der Text in die Mitte — die Kachel sieht
  // dadurch anders aus als die Kategorien, und das ist richtig: Sie ist keine.
  tileTextSolo: { flex: 1, fontSize: 14, textAlignVertical: 'center', paddingTop: 22 },
  tileTextActive: { color: ui.goldInk },
  // Die Bildfläche wächst in den freien Raum: Fehlt die Zahl unten, wird sie
  // höher, statt eine Lücke zu lassen.
  tileArt: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileCount: { fontSize: 10, color: ui.textMuted },
  tileCountActive: { color: ui.goldInk, opacity: 0.75 },

  pill: {
    paddingHorizontal: space.lg,
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  pillActive: { backgroundColor: ui.gold },
  pillText: { fontSize: 13, fontWeight: '600', color: ui.text },
  pillTextActive: { color: ui.goldInk },
});
