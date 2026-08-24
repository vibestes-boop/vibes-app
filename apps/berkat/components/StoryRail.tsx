// Der Story-Ring über dem Regal.
//
// ⚠️ Er rendert NICHTS, wenn es weder eine fremde Story noch ein eigenes Konto
// gibt. Ein leerer Ring ist schlimmer als gar keiner — er sagt „hier ist nichts
// los", also genau das Gegenteil von dem, wofür die Funktion gebaut wurde.
// Dieselbe Regel wie beim „Demnächst"-Streifen (Übergabe 62, Fund 6) und beim
// Fuss-Knopf der Kategorie-Seite.
//
// Angemeldet ohne jede Story sieht man nur die Kamera-Kachel. Das ist Absicht:
// Sie ist eine Einladung, keine Behauptung über andere.

import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';

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
/** Der Durchmesser INNERHALB des Rings, also die Bildfläche selbst. */
const INNER = SIZE - RING * 2 - 4;
/** Wie weit die Namens-Pille unter den Kreis ragt. */
const PILL_OVERHANG = 6;

type Props = {
  groups: StoryGroup[];
  myUserId: string | null;
  /** Läuft gerade ein Upload? Dann ist die Kamera-Kachel gesperrt. */
  busy?: boolean;
  onOpen: (userId: string) => void;
  onCreate: () => void;
};

/**
 * Die Kamera-Kachel ganz vorne.
 *
 * ── ⚠️ WARUM SIE DAUERHAFT DASTEHT (24.08.2026) ─────────────────────────────
 *
 * Bis heute trug die eigene Scheibe ein „+", aber nur `plus={!mine}` — also nur,
 * solange man KEINE Story hatte. Sobald eine stand, öffnete ein Tipp den
 * Betrachter, und es gab **keinen Weg mehr, eine zweite hinzuzufügen**. Man
 * hätte die erste löschen müssen. Das war eine Lücke, kein Entwurf.
 *
 * Zwei Auswege waren möglich:
 *
 *   1. Instagram: Das „+"-Abzeichen bleibt auf der eigenen Scheibe. Tipp auf den
 *      Kreis = ansehen, Tipp auf das Abzeichen = neu. **Verworfen** — das sind
 *      zwei Ziele auf einem Kreis, und das kleinere (22 Punkte) ist das
 *      wichtigere. Für eine Zielgruppe, die nicht täglich Instagram bedient, ist
 *      dieser Unterschied unsichtbar.
 *   2. Eine eigene Kachel davor. **Gewählt** — ein großes, eindeutiges Ziel, das
 *      immer dasselbe tut. So macht es auch der Wettbewerber, an dem Berkat sich
 *      hier misst.
 *
 * Sie kostet dauerhaft einen Platz. Bei fünf Verkäufern ist das der richtige
 * Handel: Der Engpass ist nicht der Platz im Ring, sondern dass überhaupt jemand
 * etwas hineinstellt.
 */
function AddTile({ dimmed, onPress }: { dimmed?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={dimmed}
      style={({ pressed }) => [s.item, (pressed || dimmed) && s.itemPressed]}
      accessibilityRole="button"
      accessibilityLabel="Story hinzufügen"
    >
      {/* Gestrichelt, damit die Kachel als PLATZ lesbar ist und nicht als Bild,
          das nicht geladen hat — dieselbe Sprache wie die „Neu"-Scheibe bei den
          Highlights. Ein Kamera-Zeichen statt eines „+", weil es sagt, WAS
          passiert: Es geht ein Bild-Wähler auf, kein Formular. */}
      <View style={s.add}>
        <Camera size={26} color={ui.brand} strokeWidth={1.8} />
      </View>
      <View style={s.pill}>
        <Text numberOfLines={1} style={s.pillText}>
          Hinzufügen
        </Text>
      </View>
    </Pressable>
  );
}

function Bubble({
  label,
  coverUrl,
  avatarUrl,
  name,
  seen,
  onPress,
}: {
  label: string;
  /**
   * Das ERSTE Bild dieser Story-Reihe — das, was beim Antippen als Erstes
   * kommt. Eine Scheibe ohne Story gibt es nicht mehr; das Anlegen hat seit dem
   * 24.08.2026 eine eigene Kachel.
   */
  coverUrl: string | null;
  avatarUrl: string | null;
  name: string | null;
  seen: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.item, pressed && s.itemPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {/* ⚠️ Der Ring ist die ganze Auskunft: Marke = ungesehen, blass = gesehen.
          Kein Text sagt das, und das ist die Konvention, die jeder kennt. */}
      {/* ⚠️ Im Kreis liegt die WARE, nicht das Gesicht (24.08.2026).
          Vorher stand hier das Profilbild. Das beantwortet „wer", aber die
          Frage im Ring ist „was gibt es zu sehen" — und ein Verkäufer, der
          eine Abaya zeigt, wirbt mit der Abaya, nicht mit seinem Avatar.
          Genau deshalb braucht der Name die Pille darunter: Der Platz, auf
          dem er sonst stünde, ist jetzt Bildfläche.

          Das ERSTE Bild, nicht das neueste — die Liste ist aufsteigend
          sortiert, `stories[0]` ist also das, was beim Antippen als Erstes
          kommt. Die Scheibe zeigt damit eine Vorschau und keine Überraschung. */}
      <View style={[s.ring, seen ? s.ringSeen : s.ringFresh]}>
        <View style={s.ringInner}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={s.cover} contentFit="cover" transition={120} />
          ) : (
            <Avatar uri={avatarUrl} name={name} size={INNER} />
          )}
        </View>
      </View>

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

/**
 * Das Bild, das auf der Scheibe steht: das erste der Reihe.
 *
 * ⚠️ `thumbnail_url` hat Vorrang. Heute schreibt Berkat es nie (eine eigene
 * Story trägt nur `media_url`), und für ein Bild wäre es ohnehin dasselbe. Der
 * Vorrang ist der Riegel für den Tag, an dem eine Story ein VIDEO ist: Dann ist
 * `media_url` eine .mp4, und `expo-image` zeichnet sie nicht — die Scheibe
 * bliebe leer. Serlo hat genau diesen Fehler schon einmal gehabt
 * (`lib/useStoryHighlights.ts`, Kommentar an Schritt 2).
 */
function coverOf(group: StoryGroup | null): string | null {
  const first = group?.stories[0];
  if (!first) return null;
  return first.thumbnail_url || first.media_url || null;
}

function StoryRailInner({ groups, myUserId, busy, onOpen, onCreate }: Props) {
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
      {/* Die Kamera-Kachel steht IMMER vorne, auch wenn schon eine Story steht.
          Genau das war vorher nicht so, und deshalb kam man nach der ersten
          Story nicht mehr an eine zweite (Begründung an `AddTile`). */}
      {myUserId ? <AddTile dimmed={busy} onPress={onCreate} /> : null}

      {mine ? (
        <Bubble
          label="Deine Story"
          coverUrl={coverOf(mine)}
          avatarUrl={mine.avatarUrl}
          name={mine.username}
          // Die eigene Story ist nie „ungesehen" — man hat sie selbst gemacht.
          seen={mine.seen}
          onPress={() => onOpen(mine.userId)}
        />
      ) : null}

      {others.map((g) => (
        <Bubble
          key={g.userId}
          label={g.username ?? 'Verkäufer'}
          coverUrl={coverOf(g)}
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
  cover: {
    width: INNER,
    height: INNER,
    borderRadius: radius.pill,
    // Bis das Bild da ist, steht hier eine ruhige Fläche und kein Loch.
    backgroundColor: ui.sunken,
  },

  /**
   * Die Kamera-Kachel. Gleiche Außenmaße wie eine Scheibe, damit die Reihe
   * fluchtet — nur ohne Ring, weil sie keine Story IST.
   */
  add: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: ui.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: ui.lineStrong,
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
