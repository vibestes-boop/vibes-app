// Die Vollbild-Bühne für Stories UND Highlights.
//
// ── WARUM EINE KOMPONENTE UND NICHT ZWEI BILDSCHIRME ─────────────────────────
//
// Stories und Highlights sehen identisch aus: formatfüllendes Bild, ein Balken
// je Foto, zwei Tippflächen, Kopfzeile mit Verkäufer. Nur die QUELLE ist
// verschieden — 24 Stunden alt gegen dauerhaft. Zwei Dateien mit demselben
// Aufbau driften auseinander, und zwar genau dann, wenn an einer davon etwas
// behoben wird; dieselbe Begründung wie „Kein zweiter Weg, wo Serlo schon einen
// hat" (Übergabe, Abschnitt 4), nur eine Ebene tiefer.
//
// ⚠️ SIE LIEGT AUF DER BÜHNE (`stage`), nicht auf der hellen Fläche. Das ist
// keine Geschmacksfrage: Ein formatfüllendes Foto braucht einen dunklen Rand,
// sonst leuchtet der Bildschirm um das Bild herum und die Ware sieht flau aus.
// Deshalb setzt sie die Statusleiste auch selbst auf hell.
//
// ── WAS SIE BEWUSST NICHT KANN ───────────────────────────────────────────────
//
// Keine Reaktionen, keine Antworten, keine Umfragen. Berkats These bleibt: der
// Abend ist das Produkt. Eine Story macht neugierig und zeigt auf einen Termin;
// sie soll kein Aufenthaltsort werden. Der einzige Weg hier heraus führt
// deshalb ZUM VERKÄUFER — nicht in einen Chat.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Trash2, X } from 'lucide-react-native';

import { Avatar } from './Avatar';
import { space, stage } from '../theme/tokens';

/** Wie lange ein Bild steht, bevor weitergeblättert wird. */
const DAUER_MS = 5000;
/** Der Takt, in dem der Balken wächst. 50 ms sind flüssig genug und billig. */
const TAKT_MS = 50;

export type StageItem = { id: string; media_url: string };

type Props = {
  items: StageItem[];
  /** Wer es zeigt. Der Tipp darauf führt auf sein Profil. */
  who: { username: string | null; avatarUrl: string | null } | null;
  /** Zweite Zeile in der Kopfzeile — bei Highlights ihr Name. */
  caption?: string | null;
  /** Läuft die Abfrage noch? Dann NICHT wegen „keine Bilder" schliessen. */
  loading?: boolean;
  /** Wird gerufen, sobald ein Bild steht. Für den Sicht-Vermerk. */
  onSeen?: (itemId: string) => void;
  /** Gesetzt = Papierkorb in der Kopfzeile. Bekommt das gerade sichtbare Bild. */
  onDelete?: (itemId: string) => void;
  deleteLabel?: string;
  onOpenProfile: () => void;
  onClose: () => void;
};

export function StoryStage({
  items,
  who,
  caption,
  loading,
  onSeen,
  onDelete,
  deleteLabel = 'Löschen',
  onOpenProfile,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const [fortschritt, setFortschritt] = useState(0);
  const [pausiert, setPausiert] = useState(false);
  const aktuell = items[idx] ?? null;

  /**
   * ⚠️ Der Riegel gegen das doppelte Schliessen.
   *
   * Das Weiterblättern hängt am Fortschritt, und der bleibt beim letzten Bild
   * auf 1 stehen. Wird die Wirkung noch einmal ausgewertet, bevor der
   * Bildschirm wirklich weg ist, liefe `onClose` ein zweites Mal — und weil das
   * ein `router.back()` ist, spränge die App ZWEI Stufen zurück statt einer.
   * Ein Fehler, den man nur unter Last sieht und dann nicht mehr erklären kann.
   */
  const zu = useRef(false);
  const schliessen = useCallback(() => {
    if (zu.current) return;
    zu.current = true;
    onClose();
  }, [onClose]);

  const weiter = useCallback(() => {
    if (idx + 1 >= items.length) {
      schliessen();
      return;
    }
    setFortschritt(0);
    setIdx(idx + 1);
  }, [idx, items.length, schliessen]);

  const zurueck = useCallback(() => {
    setFortschritt(0);
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  /**
   * Die Uhr.
   *
   * ⚠️ `setInterval` statt einer Animation, weil der Balken NUR anzeigt, wie
   * viel Zeit noch bleibt — er treibt nichts an. Eine Reanimated-Animation wäre
   * flüssiger und müsste ihren Zustand mit dem Weiterblättern abgleichen; das
   * sind zwei Wahrheiten über dieselbe Sache, und genau daran ist am 23.08.2026
   * die Tastatur gescheitert (Übergabe, Abschnitt 79).
   */
  useEffect(() => {
    if (!aktuell || pausiert) return;
    const t = setInterval(() => {
      setFortschritt((f) => {
        const n = f + TAKT_MS / DAUER_MS;
        // ⚠️ NICHT hier `weiter()` rufen — das wäre eine Zustandsänderung
        // während der Auswertung einer anderen. Erst den Balken vollmachen,
        // das Weiterblättern übernimmt die Wirkung darunter.
        return n >= 1 ? 1 : n;
      });
    }, TAKT_MS);
    return () => clearInterval(t);
  }, [aktuell, pausiert, idx]);

  useEffect(() => {
    if (fortschritt >= 1) weiter();
  }, [fortschritt, weiter]);

  // Sicht-Vermerk, sobald ein Bild steht.
  useEffect(() => {
    if (aktuell && onSeen) onSeen(aktuell.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktuell?.id]);

  // Verschwindet der Inhalt unter uns (gelöscht, abgelaufen), nicht auf einem
  // schwarzen Bildschirm stehenbleiben. ⚠️ Erst wenn die Abfrage durch ist —
  // sonst schliesst der Bildschirm sich im ersten Lidschlag wieder selbst.
  useEffect(() => {
    if (!loading && items.length === 0) schliessen();
  }, [loading, items.length, schliessen]);

  const halb = Dimensions.get('window').width / 2;

  if (!aktuell) {
    return (
      <View style={s.screen}>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar style="light" />

      <Image
        source={{ uri: aktuell.media_url }}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={120}
      />

      {/* ⚠️ Die zwei Tippflächen liegen UNTER der Kopfzeile im Baum, damit
          Schliessen und Löschen die Tipps bekommen und nicht das Blättern.
          Ohne `box-none` weiter oben wäre der Kopf tot (Abschnitt 3). */}
      <Pressable
        style={[s.tap, { left: 0, width: halb }]}
        onPress={zurueck}
        onLongPress={() => setPausiert(true)}
        onPressOut={() => setPausiert(false)}
      />
      <Pressable
        style={[s.tap, { right: 0, width: halb }]}
        onPress={weiter}
        onLongPress={() => setPausiert(true)}
        onPressOut={() => setPausiert(false)}
      />

      <View style={[s.head, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        {/* Ein Balken je Bild. Der aktuelle wächst, die davor sind voll, die
            danach leer — die Auskunft „wie viele kommen noch" ohne eine Zahl. */}
        <View style={s.bars}>
          {items.map((it, i) => (
            <View key={it.id} style={s.barTrack}>
              <View
                style={[
                  s.barFill,
                  { width: i < idx ? '100%' : i === idx ? `${Math.round(fortschritt * 100)}%` : '0%' },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={s.headRow} pointerEvents="box-none">
          <Pressable
            style={s.who}
            onPress={onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel={`Profil von ${who?.username ?? 'Verkäufer'}`}
          >
            <Avatar uri={who?.avatarUrl ?? null} name={who?.username} size={30} />
            <View style={s.whoText}>
              <Text numberOfLines={1} style={s.name}>
                {who?.username ?? 'Verkäufer'}
              </Text>
              {caption ? (
                <Text numberOfLines={1} style={s.caption}>
                  {caption}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={15} color={stage.textMuted} />
          </Pressable>

          {onDelete ? (
            <Pressable
              hitSlop={10}
              style={s.headBtn}
              onPress={() => onDelete(aktuell.id)}
              accessibilityRole="button"
              accessibilityLabel={deleteLabel}
            >
              <Trash2 size={19} color={stage.text} />
            </Pressable>
          ) : null}

          <Pressable
            hitSlop={10}
            style={s.headBtn}
            onPress={schliessen}
            accessibilityRole="button"
            accessibilityLabel="Schliessen"
          >
            <X size={22} color={stage.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stage.ink },
  tap: { position: 'absolute', top: 0, bottom: 0 },

  head: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  bars: { flexDirection: 'row', gap: 3 },
  barTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: stage.lineStrong,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: stage.text },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 0 },
  whoText: { flexShrink: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: stage.text },
  caption: { fontSize: 11, color: stage.textMuted, marginTop: 1 },
  headBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
