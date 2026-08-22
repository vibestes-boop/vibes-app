// Die Live-Vorschau auf einer Show-Karte — was in dieser Show gerade passiert.
//
// EINE Komponente, drei Zustände. Zeile 1 und Zeile 3 wechseln nur ihren
// Inhalt, Zeile 2 ist immer der Artikelname:
//
//   läuft      · „Läuft aktuell"               · 00:04 rot   · Gebot
//   verkauft   · „Warten auf nächsten Artikel"  · „Verkauft"  · Endpreis
//   geplant    · „Als nächstes …"               · „Beginnt bald …" · Startpreis
//
// ⚠️ Die Fläche ist fast deckend, und das ist kein Geschmack. Das Widget liegt
// auf einem fremden Vorschaubild, das mal hell und mal dunkel ist. Zartes Glas
// wäre auf dem einen lesbar und auf dem nächsten unsichtbar — genau der Fehler,
// den Berkats zwei feste Flächen sonst strukturell ausschließen. Hier geht es
// nicht anders, also deckt die Fläche und die Textfarben stehen fest.

import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ui, radius, space } from '../theme/tokens';
import { formatCountdown, formatEuro, type ShowPreview } from '../lib/useAuction';
import { RollupNumber } from './RollupNumber';

type Props = {
  preview: ShowPreview;
  /** Sekunden bis zum Zuschlag. Nur im Zustand `running` gesetzt, sonst null. */
  secondsLeft: number | null;
};

/** Artikel und Zustand zusammen — daran hängt das Kommen und Gehen. */
const keyOf = (p: ShowPreview) => `${p.id}:${p.status}`;

export function LivePreview({ preview, secondsLeft }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [frozen, setFrozen] = useState<ShowPreview | null>(null);
  const lastRef = useRef(preview);

  // Erstes Erscheinen: einblenden statt aufpoppen.
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [opacity]);

  // Das „Kommen und Gehen" ist kein eigener Mechanismus, sondern die Folge des
  // Zustandswechsels. Der alte Stand bleibt eingefroren stehen, solange er
  // ausblendet — sonst springt der Inhalt um, bevor ihn jemand gehen sieht.
  useEffect(() => {
    const previous = lastRef.current;
    lastRef.current = preview;
    if (keyOf(previous) === keyOf(preview)) return;

    setFrozen(previous);
    Animated.timing(opacity, { toValue: 0, duration: 130, useNativeDriver: true }).start(
      ({ finished }) => {
        // Abgebrochen heißt: ein zweiter Wechsel hat übernommen. Der räumt
        // selbst auf — hier weiterzumachen ließe zwei Blenden gegeneinander
        // laufen.
        if (!finished) return;
        setFrozen(null);
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      },
    );
  }, [preview, opacity]);

  const shown = frozen ?? preview;
  const hasImage = Boolean(shown.imageUrl);

  // Kurz halten: Auf einer halbbreiten Karte bleiben für diese Zeile knapp
  // zwanzig Zeichen, der Rest wird abgeschnitten. „Warten auf nächsten
  // Artikel" endete als „Warten auf nächst…".
  const label =
    shown.status === 'running'
      ? 'Läuft aktuell'
      : shown.status === 'sold'
        ? 'Gleich der Nächste'
        : 'Als Nächstes …';

  return (
    <Animated.View
      // Reine Anzeige. Ein Tipp gehört der Karte darunter, nicht dem Widget.
      pointerEvents="none"
      style={[
        s.root,
        {
          opacity,
          transform: [
            { translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          ],
        },
      ]}
    >
      <Text numberOfLines={1} style={[s.label, hasImage && s.textInset]}>
        {label}
      </Text>
      {/* Der Artikelname bekommt die volle Breite. Das Bild hängt so weit über
          die Oberkante, dass es nur die kurze Zeile darüber berührt — sonst
          bliebe vom Namen auf einer halbbreiten Karte kaum etwas übrig. */}
      <Text numberOfLines={1} style={s.title}>
        {shown.title}
      </Text>

      <View style={s.bottomRow}>
        <StateText status={shown.status} secondsLeft={secondsLeft} />
        {shown.status === 'running' ? (
          // Schlüssel je Artikel: Ohne ihn zählt der neue Artikel vom Preis des
          // alten herunter, sobald das Widget umschaltet.
          <RollupNumber key={shown.id} cents={shown.priceCents} style={s.price} />
        ) : (
          <Text style={s.price}>{formatEuro(shown.priceCents)}</Text>
        )}
      </View>

      {/* ⚠️ BERKATS BESTES VERSANDARGUMENT STAND AUF KEINER KARTE.
          Whatnot setzt an genau diese Stelle „Vergünstigter Versand" — eine
          eigene Zeile in der Vorschau-Box, dort wo jemand entscheidet, ob er
          reingeht (zwölfte Analyse).

          Berkats Argument ist stärker als ihres: Alles, was man bei einem
          Verkäufer an einem Abend gewinnt, kommt in EINEM Paket. Das ist laut
          Ausgangsanalyse der Grund, warum eine 5-€-Auktion überhaupt möglich
          ist — ohne den Sammelkorb wäre der Versand teurer als die Ware.

          Es steht fest da und nicht bedingt: Der Sammelkorb ist eine
          Eigenschaft von Berkat, nicht dieser Show. */}
      <Text style={s.shipping}>Alles in einem Paket</Text>

      {shown.imageUrl ? (
        <View style={s.thumb}>
          <Image
            source={{ uri: shown.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={140}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Zeile 3 links — der Zustand in einem Wort oder einer Uhr. */
function StateText({
  status,
  secondsLeft,
}: {
  status: ShowPreview['status'];
  secondsLeft: number | null;
}) {
  if (status === 'sold') {
    return <Text style={[s.state, s.urgent]}>Verkauft</Text>;
  }
  if (status === 'scheduled') {
    return <Text style={[s.state, s.calm]}>Beginnt bald …</Text>;
  }
  // Zwischen „Zeit um" und dem Zuschlag liegt ein Server-Aufruf. Eine stehende
  // 00:00 sieht nach Absturz aus — dieselbe Formulierung wie im Live-Raum.
  if (secondsLeft == null || secondsLeft <= 0) {
    return <Text style={[s.state, s.calm]}>Zuschlag …</Text>;
  }
  return <Text style={[s.state, s.urgent]}>{formatCountdown(secondsLeft)}</Text>;
}

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: space.sm,
    borderRadius: radius.md,
    backgroundColor: ui.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  /** Platz für das Artikelbild, das rechts über die Oberkante hinausragt. */
  textInset: { marginRight: 42 },

  // `overlayMuted`/`overlayUrgent` statt `textMuted`/`live`: Am 15.08.2026 über
  // einem echten Foto nachgemessen — die hellen Fassungen kamen auf 3,84:1 und
  // 3,92:1 und lagen damit unter den 4,5:1, die WCAG für diese Schriftgrößen
  // verlangt. Nur hier abgedunkelt; auf der Sandfläche bleibt es beim Original.
  label: { fontSize: 10, fontWeight: '600', color: ui.overlayMuted },
  title: { fontSize: 13, fontWeight: '700', color: ui.text, marginTop: 1 },

  bottomRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 3 },
  state: { flex: 1, fontSize: 12, fontWeight: '700' },
  urgent: { color: ui.overlayUrgent },
  calm: { color: ui.overlayMuted },
  price: { fontSize: 13, fontWeight: '700', color: ui.text },

  // Gedämpft wie die Zustandszeile: Es ist eine Zusicherung, kein Preis. Und
  // `overlayMuted`, weil auch diese Zeile auf einem fremden Foto liegt — die
  // Messung von oben gilt hier genauso.
  shipping: { fontSize: 10, fontWeight: '600', color: ui.overlayMuted, marginTop: 3 },

  thumb: {
    position: 'absolute',
    right: 6,
    top: -22,
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: ui.card,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
});
