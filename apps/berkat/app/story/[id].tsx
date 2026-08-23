// Der Vollbild-Betrachter für Stories.
//
// ⚠️ Er liegt auf der BÜHNE (`stage`), nicht auf der hellen Fläche. Das ist
// keine Geschmacksfrage: Ein formatfüllendes Foto braucht einen dunklen Rand,
// sonst leuchtet der Bildschirm um das Bild herum und die Ware sieht flau aus.
// Dieselbe Begründung wie beim Live-Raum (Abschnitt 4 der Übergabe) — deshalb
// setzt dieser Bildschirm die Statusleiste auch selbst auf hell.
//
// ── WAS ER BEWUSST NICHT KANN ────────────────────────────────────────────────
//
// Keine Reaktionen, keine Antworten, keine Umfragen. Berkats These bleibt: der
// Abend ist das Produkt. Eine Story macht neugierig und zeigt auf einen Termin;
// sie soll kein Aufenthaltsort werden. Der einzige Weg hier heraus führt
// deshalb ZUM VERKÄUFER — nicht in einen Chat.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Trash2, X } from 'lucide-react-native';

import { Avatar } from '../../components/Avatar';
import { useSession } from '../../lib/session';
import { goBack } from '../../lib/nav';
import { useBerkatStories, useDeleteStory, useMarkStoryViewed } from '../../lib/useStories';
import { radius, space, stage } from '../../theme/tokens';

/** Wie lange ein Bild steht, bevor weitergeblättert wird. */
const DAUER_MS = 5000;
/** Der Takt, in dem der Balken wächst. 50 ms sind flüssig genug und billig. */
const TAKT_MS = 50;

export default function StoryViewer() {
  const { id: sellerId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { data: groups = [], isLoading } = useBerkatStories();
  const markViewed = useMarkStoryViewed();
  const del = useDeleteStory();

  const group = useMemo(
    () => groups.find((g) => g.userId === sellerId) ?? null,
    [groups, sellerId],
  );
  const stories = group?.stories ?? [];

  const [idx, setIdx] = useState(0);
  const [fortschritt, setFortschritt] = useState(0);
  const [pausiert, setPausiert] = useState(false);
  const aktuell = stories[idx] ?? null;

  const schliessen = useCallback(() => goBack('/(tabs)/'), []);

  // Weiterblättern — oder raus, wenn es die letzte war.
  const weiter = useCallback(() => {
    setFortschritt(0);
    setIdx((i) => {
      if (i + 1 < stories.length) return i + 1;
      schliessen();
      return i;
    });
  }, [stories.length, schliessen]);

  const zurueck = useCallback(() => {
    setFortschritt(0);
    setIdx((i) => Math.max(0, i - 1));
  }, []);

  /**
   * Die Uhr.
   *
   * ⚠️ `setInterval` statt einer Animation, weil der Balken NUR anzeigt, wie
   * viel Zeit noch bleibt — er treibt nichts an. Eine Reanimated-Animation
   * wäre flüssiger und müsste ihren Zustand mit dem Weiterblättern abgleichen;
   * das ist zwei Wahrheiten über dieselbe Sache, und genau daran ist heute die
   * Tastatur gescheitert.
   */
  useEffect(() => {
    if (!aktuell || pausiert) return;
    const t = setInterval(() => {
      setFortschritt((f) => {
        const n = f + TAKT_MS / DAUER_MS;
        if (n >= 1) {
          // ⚠️ NICHT hier `weiter()` aufrufen — das wäre ein setState während
          // des Renderns des Elternteils. Erst den Balken vollmachen, das
          // Weiterblättern übernimmt der Effekt darunter.
          return 1;
        }
        return n;
      });
    }, TAKT_MS);
    return () => clearInterval(t);
  }, [aktuell, pausiert, idx]);

  useEffect(() => {
    if (fortschritt >= 1) weiter();
  }, [fortschritt, weiter]);

  // Als gesehen vermerken, sobald ein Bild steht. Der Vermerk darf scheitern —
  // Begründung am Hook.
  useEffect(() => {
    if (aktuell) markViewed.mutate(aktuell.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktuell?.id]);

  // Verschwindet die Story unter uns (gelöscht, abgelaufen), nicht auf einem
  // schwarzen Bildschirm stehenbleiben.
  useEffect(() => {
    if (!isLoading && stories.length === 0) schliessen();
  }, [isLoading, stories.length, schliessen]);

  const halb = Dimensions.get('window').width / 2;
  const eigene = myUserId != null && myUserId === sellerId;

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
      <Pressable style={[s.tap, { left: 0, width: halb }]} onPress={zurueck}
        onLongPress={() => setPausiert(true)} onPressOut={() => setPausiert(false)} />
      <Pressable style={[s.tap, { right: 0, width: halb }]} onPress={weiter}
        onLongPress={() => setPausiert(true)} onPressOut={() => setPausiert(false)} />

      <View style={[s.head, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        {/* Ein Balken je Bild. Der aktuelle wächst, die davor sind voll, die
            danach leer — die Auskunft „wie viele kommen noch" ohne eine Zahl. */}
        <View style={s.bars}>
          {stories.map((st, i) => (
            <View key={st.id} style={s.barTrack}>
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
            onPress={() => router.replace(`/seller/${sellerId}`)}
            accessibilityRole="button"
            accessibilityLabel={`Profil von ${group?.username ?? 'Verkäufer'}`}
          >
            <Avatar uri={group?.avatarUrl ?? null} name={group?.username} size={30} />
            <Text numberOfLines={1} style={s.name}>
              {group?.username ?? 'Verkäufer'}
            </Text>
            <ChevronRight size={15} color={stage.textMuted} />
          </Pressable>

          {eigene ? (
            <Pressable
              hitSlop={10}
              style={s.headBtn}
              onPress={() => del.mutate(aktuell.id, { onSuccess: schliessen })}
              accessibilityRole="button"
              accessibilityLabel="Story löschen"
            >
              <Trash2 size={19} color={stage.text} />
            </Pressable>
          ) : null}

          <Pressable hitSlop={10} style={s.headBtn} onPress={schliessen}
            accessibilityRole="button" accessibilityLabel="Schliessen">
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
  name: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: stage.text },
  headBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
