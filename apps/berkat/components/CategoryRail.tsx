// Die Kategorie-Leiste auf der Startseite — Kacheln oben, Pillen beim Scrollen.
//
// ⚠️ ZWEIMAL FALSCH GEBAUT, BEVOR ES STIMMTE (22.08.2026).
//
// 1. Fassung: ein SCHALTER. Ab 48 Punkten Scrollhöhe klappte sie zu, unter 8
//    wieder auf, dazwischen lief eine 190-ms-Animation auf die HÖHE. Zwei
//    Fehler in einem:
//      * Eine Höhe lässt sich in React Native nicht auf dem UI-Thread
//        animieren (`useNativeDriver: false`). Sie lief also auf demselben
//        Strang wie das Scrollen.
//      * Die Leiste stand ÜBER der Liste im Fluss — jede Höhenänderung
//        verschob den Listeninhalt gleich mit. Ruckeln war die Regel.
//      * Und ein Schalter SPRINGT. Wer nahe am oberen Rand auf und ab wischt,
//        kreuzt die Schwelle ständig; genau das war am Gerät zu sehen.
//
// 2. Fassung: ersatzlos gestrichen. Ehrlich, aber die stumpfe Lösung.
//
// 3. Fassung, diese: **fortlaufend statt geschaltet.** Die Leiste hängt an der
//    Scrollposition und folgt dem Finger, statt bei einer Schwelle
//    umzuklappen. Bewegt werden nur `translateY` und `opacity` — beides läuft
//    mit `useNativeDriver: true` auf dem UI-Thread und ist selbst dann flüssig,
//    wenn JavaScript gerade beschäftigt ist. Und die Leiste LIEGT ÜBER der
//    Liste (die trägt oben ein Polster), also ändert sich am Listen-Layout
//    nichts mehr.
//
// Die Regel daraus: **Was beim Scrollen mitgeht, darf weder die Höhe eines
// Geschwisters ändern noch auf dem JS-Thread laufen — und es soll folgen, nicht
// umschalten.**
import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { BerkatMark } from './BerkatMark';
import { categoryArt } from '../theme/categoryArt';
import { ui, radius, space } from '../theme/tokens';
import { PressFeedback } from './PressFeedback';
import { useReducedMotion } from '../lib/useReducedMotion';

export const RAIL_TALL = 132;
export const RAIL_SHORT = 52;

// Leiste und Listenpolster müssen dieselben Maße verwenden.
export function categoryRailMetrics(fontScale: number) {
  const scale = Math.max(1, fontScale);
  return {
    tall: RAIL_TALL + Math.ceil(49 * (scale - 1)),
    short: RAIL_SHORT + Math.ceil(18 * (scale - 1)),
    tileWidth: Math.ceil(96 * scale),
    pillHeight: 44 + Math.ceil(18 * (scale - 1)),
  };
}

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
  /** Der allgemeine Einstieg trägt das Markenzeichen statt Kategorie-Artwork. */
  art?: false;
};

type Props = {
  items: RailItem[];
  /** Slug der gewählten Kategorie. */
  active: string;
  onSelect: (slug: string) => void;
  /**
   * 0 = ganz oben (Kacheln), 1 = gescrollt (Pillen).
   *
   * ⚠️ Kommt von AUSSEN und wird nicht hier gerechnet: Nur der Bildschirm
   * kennt die Scrollposition, und nur wenn derselbe Wert Leiste UND Verschiebung
   * treibt, laufen beide synchron. Zwei getrennte Animationen für eine Bewegung
   * wären genau der Bruch, den man als Zucken sieht.
   */
  progress: Animated.AnimatedInterpolation<number>;
  compact: boolean;
  loading?: boolean;
};

export function CategoryRail({ items, active, onSelect, progress, compact, loading = false }: Props) {
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const metrics = categoryRailMetrics(fontScale);
  const tilesRef = useRef<ScrollView>(null);
  const pillsRef = useRef<ScrollView>(null);
  const firstSlug = items[0]?.slug;
  useEffect(() => {
    // Auch beim Zurücksetzen aus einem Leerzustand den gewählten Einstieg zeigen.
    if (active !== firstSlug) return;
    tilesRef.current?.scrollTo({ x: 0, animated: false });
    pillsRef.current?.scrollTo({ x: 0, animated: false });
  }, [active, firstSlug]);
  // Die Kacheln sind schon halb weg, bevor die Pillen kommen — sonst lägen
  // beide gleichzeitig sichtbar übereinander und es sähe nach Doppelbild aus.
  const tileOpacity = reducedMotion ? 1 : progress.interpolate({ inputRange: [0, 0.55], outputRange: [1, 0], extrapolate: 'clamp' });
  const pillOpacity = reducedMotion ? 0 : progress.interpolate({ inputRange: [0.45, 1], outputRange: [0, 1], extrapolate: 'clamp' });


  return (
    <View style={[styles.wrap, { height: metrics.tall }]}>
      <Animated.View pointerEvents={compact ? "none" : "auto"} accessibilityElementsHidden={compact} importantForAccessibility={compact ? "no-hide-descendants" : "auto"} style={[StyleSheet.absoluteFill, { opacity: tileOpacity }]}>
        <ScrollView
          ref={tilesRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {loading ? [0, 1, 2, 3].map((key) => (
            <View key={key} style={[styles.tile, { width: metrics.tileWidth }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.tileArt, { backgroundColor: ui.sunken }]} />
              <View style={styles.skeletonLabel} />
            </View>
          )) : items.map((item) => {
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
              <PressFeedback kind="card"
                key={item.slug}
                onPress={() => onSelect(item.slug)}
                style={[styles.tile, { width: metrics.tileWidth }]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={line ? `${item.name}, ${line}` : item.name}
              >
                <View style={[styles.tileArt, { backgroundColor: art.tint }, on && styles.tileActive, item.art === false && on && styles.discoveryActive]}>
                  {item.art === false ? (
                    <BerkatMark size={34} color={on ? ui.card : ui.brand} />
                  ) : art.photo ? (
                    <Image source={art.photo} style={styles.tilePhoto} contentFit="contain" enforceEarlyResizing transition={0} />
                  ) : (
                    <Icon size={30} color={ui.brand} />
                  )}
                </View>
                <View style={styles.tileCaption}>
                  <Text numberOfLines={2} style={[styles.tileText, on && styles.tileTextActive]}>{item.name}</Text>
                  {line ? <Text style={styles.tileCount}>{line}</Text> : null}
                </View>
              </PressFeedback>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* Die Pillen sitzen UNTEN in der Leiste. Wird sie nach oben
          geschoben, stehen sie genau dort, wo die Leiste endet — der
          Übergang braucht keine zweite Bewegung. */}
      <Animated.View pointerEvents={compact ? "auto" : "none"} accessibilityElementsHidden={!compact} importantForAccessibility={!compact ? "no-hide-descendants" : "auto"} style={[styles.pillLayer, { opacity: pillOpacity, height: metrics.short }]}>
        <ScrollView
          ref={pillsRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.rowShort, { height: metrics.short }]}
        >
          {items.map((item) => {
            const on = item.slug === active;
            return (
              <PressFeedback
                key={item.slug}
                onPress={() => onSelect(item.slug)}
                style={[styles.pill, { height: metrics.pillHeight }, on && styles.pillActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text numberOfLines={1} style={[styles.pillText, on && styles.pillTextActive]}>
                  {item.name}
                </Text>
              </PressFeedback>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: RAIL_TALL, backgroundColor: ui.bg, overflow: 'hidden' },
  pillLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: RAIL_SHORT },
  row: { gap: space.sm, paddingHorizontal: space.md, alignItems: 'flex-start' },
  rowShort: { gap: space.sm, paddingHorizontal: space.md, alignItems: 'center', height: RAIL_SHORT },

  tile: { width: 96, alignItems: 'center', gap: 4 },
  tileArt: {
    width: 88,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tilePhoto: { width: '92%', height: '92%' },
  tileActive: { borderColor: ui.brand },
  discoveryActive: { backgroundColor: ui.brand },
  tileCaption: { alignItems: 'center', gap: 2 },
  skeletonLabel: { width: 52, height: 12, borderRadius: radius.sm, backgroundColor: ui.sunken, marginTop: 4 },
  tileText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: ui.text, textAlign: 'center' },
  tileTextActive: { color: ui.brand },
  tileCount: { fontSize: 11, lineHeight: 15, color: ui.textMuted },

  pill: {
    paddingHorizontal: space.lg,
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  pillActive: { backgroundColor: ui.brand },
  pillText: { fontSize: 13, fontWeight: '600', color: ui.text },
  pillTextActive: { color: ui.card },
});
