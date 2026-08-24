// Der Story-Ring über dem Regal.
//
// ⚠️ Er rendert NICHTS, wenn es weder eine fremde Story noch ein eigenes Konto
// gibt. Ein leerer Ring ist schlimmer als gar keiner — er sagt „hier ist nichts
// los", also genau das Gegenteil von dem, wofür die Funktion gebaut wurde.
// Dieselbe Regel wie beim „Demnächst"-Streifen (Übergabe 62, Fund 6) und beim
// Fuss-Knopf der Kategorie-Seite.
//
// Angemeldet ohne jede Story sieht man nur die eigene „+"-Scheibe. Das ist
// Absicht: Sie ist eine Einladung, keine Behauptung über andere.

import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';

import { Avatar } from './Avatar';
import type { StoryGroup } from '../lib/useStories';
import { radius, space, ui } from '../theme/tokens';

/**
 * ⚠️ 78 statt 62 — und der Platz dafür kommt aus dem Namen (24.08.2026).
 *
 * Bis dahin stand der Name als eigene Textzeile UNTER dem Kreis. Die kostete
 * rund 18 Punkte Höhe, in denen nichts zu sehen war. Ein Wettbewerber aus
 * derselben Gegend legt den Namen stattdessen als Pille auf die Unterkante des
 * Kreises — damit fällt die Zeile weg und der Kreis darf sie sich nehmen.
 *
 * Gerechnet: vorher 62 + 5 Abstand + ~13 Textzeile = 80. Jetzt 78 Kreis + 6
 * Überstand der Pille = 84. **Vier Punkte mehr Höhe für einen Kreis, der im
 * Durchmesser um ein Viertel und in der Fläche um die Hälfte wächst.**
 *
 * Warum das nicht Kosmetik ist: Der Ring ist das Einzige auf der Startseite,
 * das sich täglich ändert, und er ist gebaut worden, damit die App nicht tot
 * aussieht, wenn niemand sendet (Übergabe 81). Genau dafür ist seine Größe das
 * Werkzeug — eine 62er-Scheibe mit Bildunterschrift liest sich als Liste, eine
 * 78er als Bühne.
 */
const SIZE = 78;
const RING = 2.5;
/** Wie weit die Namens-Pille unter den Kreis ragt. */
const PILL_OVERHANG = 6;

type Props = {
  groups: StoryGroup[];
  myUserId: string | null;
  /**
   * Das eigene Profilbild.
   *
   * ⚠️ Muss von aussen kommen und darf NICHT aus `groups` gelesen werden: Wer
   * noch keine Story hat, steht dort gar nicht drin — die eigene Scheibe zeigte
   * dann ein „?" statt des eigenen Gesichts. Genau das war beim ersten Bau der
   * Fall, und es sieht aus wie ein Fehler, nicht wie eine Einladung.
   */
  myAvatarUrl?: string | null;
  myUsername?: string | null;
  /** Läuft gerade ein Upload? Dann ist die eigene Scheibe gesperrt. */
  busy?: boolean;
  onOpen: (userId: string) => void;
  onCreate: () => void;
};

function Bubble({
  label,
  avatarUrl,
  name,
  seen,
  plus,
  dimmed,
  onPress,
}: {
  label: string;
  avatarUrl: string | null;
  name: string | null;
  seen: boolean;
  plus?: boolean;
  dimmed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={dimmed}
      style={({ pressed }) => [s.item, (pressed || dimmed) && s.itemPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {/* ⚠️ Der Ring ist die ganze Auskunft: Marke = ungesehen, blass = gesehen.
          Kein Text sagt das, und das ist die Konvention, die jeder kennt. */}
      <View style={[s.ring, seen ? s.ringSeen : s.ringFresh]}>
        <View style={s.ringInner}>
          <Avatar uri={avatarUrl} name={name} size={SIZE - RING * 2 - 4} />
        </View>
      </View>

      {/* ⚠️ Das „+" sitzt OBEN rechts, nicht unten — unten steht jetzt der Name.
          Vor dem 24.08.2026 lag es bei `top: SIZE - 20`, also genau dort, wo die
          Pille hingehört; beides zusammen hätte sich überlappt. */}
      {plus ? (
        <View style={s.plus}>
          <Plus size={13} color={ui.card} strokeWidth={3} />
        </View>
      ) : null}

      {/* Der Name liegt AUF der Kreis-Unterkante statt darunter. Damit fällt die
          eigene Textzeile weg, und der Kreis nimmt sich ihren Platz. */}
      <View style={s.pill}>
        <Text numberOfLines={1} style={s.pillText}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function StoryRailInner({ groups, myUserId, myAvatarUrl, myUsername, busy, onOpen, onCreate }: Props) {
  const mine = groups.find((g) => g.userId === myUserId) ?? null;
  const others = groups.filter((g) => g.userId !== myUserId);

  // Der Riegel gegen den leeren Ring: keine fremden Stories UND nicht
  // angemeldet → gar nichts rendern.
  if (others.length === 0 && !myUserId) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      style={s.wrap}
    >
      {myUserId ? (
        <Bubble
          label={mine ? 'Deine Story' : 'Hinzufügen'}
          avatarUrl={mine?.avatarUrl ?? myAvatarUrl ?? null}
          name={mine?.username ?? myUsername ?? null}
          // Die eigene Story ist nie „ungesehen" — man hat sie selbst gemacht.
          seen={!mine ? true : mine.seen}
          plus={!mine}
          dimmed={busy}
          onPress={() => (mine ? onOpen(mine.userId) : onCreate())}
        />
      ) : null}

      {others.map((g) => (
        <Bubble
          key={g.userId}
          label={g.username ?? 'Verkäufer'}
          avatarUrl={g.avatarUrl}
          name={g.username}
          seen={g.seen}
          onPress={() => onOpen(g.userId)}
        />
      ))}
    </ScrollView>
  );
}

export const StoryRail = memo(StoryRailInner);

const s = StyleSheet.create({
  wrap: { backgroundColor: ui.bg },
  row: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.md },
  // `paddingBottom` hält den Überstand der Pille im Element — ohne ihn würde
  // sie aus der Reihe herausragen und der Streifen darunter rückte hoch.
  item: { width: SIZE + 10, alignItems: 'center', paddingBottom: PILL_OVERHANG },
  itemPressed: { opacity: 0.6 },

  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    borderWidth: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringFresh: { borderColor: ui.brand },
  // Nicht unsichtbar, nur leise: Der Platz bleibt gleich, damit die Scheiben
  // beim Ansehen nicht springen.
  ringSeen: { borderColor: ui.lineStrong },
  ringInner: {
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: ui.bg,
  },

  plus: {
    position: 'absolute',
    // Auf dem Kreisrand, oben rechts bei 45° — gerechnet, nicht geschätzt:
    // Mittelpunkt (44|39), Radius 39, also (44+27,6 | 39−27,6). Ein `right: 0`
    // klebte am Rand der ZELLE (Breite 88) und stünde damit neben dem Kreis.
    right: 5,
    top: 1,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: ui.brand,
    borderWidth: 2,
    borderColor: ui.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /**
   * Die Namens-Pille auf der Unterkante.
   *
   * ⚠️ `ui.onImage` und nicht etwa eine helle Fläche: Der Kreis trägt ein
   * fremdes Profilbild, und darauf ist heller Text mal lesbar und mal weg —
   * dieselbe Begründung wie bei `ui.overlay` in `theme/tokens.ts`, nur nach
   * dunkel. Nachgerechnet gegen den schlimmsten Fall (schneeweißes Bild
   * darunter): Weiß auf der Pille kommt auf **9,3 : 1**. Über einem dunklen
   * Bild ist es mehr. Wer an der Deckkraft dreht, rechnet nach.
   *
   * Der helle Rand trennt die Pille vom Bild — ohne ihn verschwimmt sie auf
   * einem dunklen Avatar mit dem Kreis zu einem Fleck.
   */
  pill: {
    position: 'absolute',
    bottom: 0,
    // ⚠️ Höchstens so breit wie der Kreis plus ein Hauch. Bei `SIZE + 10`
    // spannte „Deine Story" die Pille über die ganze Zelle, und sie stand
    // links und rechts über den Kreis hinaus — dann trägt nicht mehr der Kreis
    // den Namen, sondern der Name den Kreis.
    maxWidth: SIZE + 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: ui.onImage,
    borderWidth: 1.5,
    borderColor: ui.bg,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
    color: ui.card,
    textAlign: 'center',
  },
});
