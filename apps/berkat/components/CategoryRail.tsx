// Die Kategorie-Leiste mit zwei Größen.
//
// Ganz oben sind es Kacheln, beim Scrollen schrumpfen sie zu Pillen und beim
// Zurückscrollen wachsen sie wieder. Der Sinn: solange man noch nicht weiß,
// was man will, ist die Auswahl das Wichtigste auf dem Bildschirm. Sobald man
// scrollt, hat man sich entschieden — dann darf sie Platz abgeben, ohne ganz
// zu verschwinden.

import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ui, radius, space } from '../theme/tokens';

export const RAIL_TALL = 104;
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
            return (
              <Pressable
                key={item.slug}
                onPress={() => onSelect(item.slug)}
                style={[styles.tile, on && styles.tileActive]}
                accessibilityRole="button"
              >
                <Text numberOfLines={2} style={[styles.tileText, on && styles.tileTextActive]}>
                  {item.name}
                </Text>
                {item.liveCount > 0 ? (
                  <Text style={[styles.tileCount, on && styles.tileCountActive]}>
                    {item.liveCount} live
                  </Text>
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

  tile: {
    width: 104,
    height: 92,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    padding: 10,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileActive: { backgroundColor: ui.gold, borderColor: ui.brand },
  tileText: { fontSize: 14, fontWeight: '700', color: ui.text },
  tileTextActive: { color: ui.goldInk },
  tileCount: { fontSize: 11, color: ui.textMuted },
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
