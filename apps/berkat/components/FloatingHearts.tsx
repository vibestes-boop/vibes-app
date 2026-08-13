// Die Herzen, die neben der rechten Leiste hochsteigen.
//
// Jedes Herz ist eine eigene Komponente, nicht eine Schleife in einer. Der
// Grund ist keine Kosmetik: Animationswerte kommen aus Hooks, und Hooks in
// einer Schleife brechen, sobald die Liste sich ändert — genau der Absturz, den
// Serlos Geschenk-Animation bei schnell aufeinanderfolgenden Gaben hatte. So
// hat jedes Herz seinen eigenen, festen Satz.
//
// Jedes bekommt außerdem einen leicht anderen Weg. Ohne das steigt bei Applaus
// eine gerade Kette auf, und die sieht aus wie ein Fehler, nicht wie Jubel.

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { LiveReaction } from '../lib/useReactions';

/** Muss unter `LIFETIME_MS` im Hook bleiben, sonst verschwindet ein Herz hart. */
const RISE_MS = 2_400;

/** Halbe Herzgröße — rückt das Herz unter die Fingerkuppe statt daneben. */
const TAP_OFFSET = 15;

function randomPath() {
  return {
    startX: Math.random() * 24 - 12,
    drift: (Math.random() * 2 - 1) * 30,
    rise: 190 + Math.random() * 90,
    size: 21 + Math.random() * 9,
    tilt: `${Math.round(Math.random() * 26 - 13)}deg`,
  };
}

function FloatingHeart({ emoji, anchor }: { emoji: string; anchor: ViewStyle }) {
  const drive = useRef(new Animated.Value(0)).current;
  const path = useRef(randomPath()).current;

  useEffect(() => {
    Animated.timing(drive, {
      toValue: 1,
      duration: RISE_MS,
      easing: Easing.out(Easing.quad),
      // Nur Verschiebung, Größe und Deckkraft — alles davon läuft nativ und
      // damit unabhängig von der Bildrate des Videos.
      useNativeDriver: true,
    }).start();
  }, [drive]);

  const translateY = drive.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -path.rise],
  });

  // Ein Schlenker statt einer Geraden: hoch, leicht raus, wieder rein.
  const translateX = drive.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: [
      path.startX,
      path.startX + path.drift,
      path.startX - path.drift * 0.6,
      path.startX + path.drift * 0.3,
    ],
  });

  const opacity = drive.interpolate({
    inputRange: [0, 0.08, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });

  // Kurzer Stups beim Erscheinen, dann ruhig weiter.
  const scale = drive.interpolate({
    inputRange: [0, 0.12, 0.3, 1],
    outputRange: [0.4, 1.2, 1, 0.9],
  });

  return (
    <Animated.View
      style={[
        styles.heart,
        anchor,
        { opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate: path.tilt }] },
      ]}
    >
      <Text style={{ fontSize: path.size }}>{emoji}</Text>
    </Animated.View>
  );
}

/**
 * Herzen, die am Herz-Knopf losfliegen: eigene und fremde, wenn kein Punkt
 * dabei ist. Liegt über dem Video und fängt bewusst keine Berührung ab —
 * darunter sitzen Leiste und Auktion.
 */
export function FloatingHearts({ reactions }: { reactions: LiveReaction[] }) {
  return (
    <View style={styles.layer} pointerEvents="none">
      {reactions
        .filter((reaction) => !reaction.origin)
        .map((reaction) => (
          <FloatingHeart key={reaction.id} emoji={reaction.emoji} anchor={styles.railAnchor} />
        ))}
    </View>
  );
}

/**
 * Herzen, die dort losfliegen, wo der Finger war. Braucht die ganze Fläche,
 * weil der Punkt in Bildschirmkoordinaten kommt — deshalb eine eigene Ebene
 * statt derselben wie oben, die am Knopf klebt.
 */
export function TapHearts({ reactions }: { reactions: LiveReaction[] }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {reactions
        .filter((reaction) => reaction.origin)
        .map((reaction) => (
          <FloatingHeart
            key={reaction.id}
            emoji={reaction.emoji}
            anchor={{
              left: reaction.origin!.x - TAP_OFFSET,
              top: reaction.origin!.y - TAP_OFFSET,
            }}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Der Kasten reicht vom Herz-Knopf bis nach oben, und die Herzen starten an
  // seiner Unterkante.
  //
  // `bottom` ist ausgerechnet, nicht geraten: In der rechten Leiste liegen
  // unter dem Herzen der Innenabstand (12), „Shop" und „Teilen" mit je 38 px
  // Knopf plus 14 px Beschriftung, und zwischen den Einträgen je 12 px —
  // zusammen 164. Damit startet ein Herz auf Höhe des Herz-Knopfes. Kommt ein
  // Eintrag dazu oder fällt einer weg, muss dieser Wert mit.
  //
  // Bewusst über `bottom` statt über eine feste Höhe: so bleibt der Kasten
  // immer innerhalb seines Elternteils, und kein Herz gerät auf Android an eine
  // beschnittene Kante.
  layer: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 164,
    width: 92,
    alignItems: 'center',
  },
  // Ohne eigene Kante — die setzt der Anker. Sonst kämen bei einem Herz am
  // Finger `top` und `bottom` zusammen und es würde in die Länge gezogen.
  heart: { position: 'absolute' },
  railAnchor: { bottom: 0 },
});
