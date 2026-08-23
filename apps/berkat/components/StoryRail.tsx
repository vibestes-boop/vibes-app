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

const SIZE = 62;
const RING = 2.5;

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
      {plus ? (
        <View style={s.plus}>
          <Plus size={13} color={ui.card} strokeWidth={3} />
        </View>
      ) : null}
      <Text numberOfLines={1} style={s.label}>
        {label}
      </Text>
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
  item: { width: SIZE + 8, alignItems: 'center' },
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
    right: 2,
    top: SIZE - 20,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: ui.brand,
    borderWidth: 2,
    borderColor: ui.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    marginTop: 5,
    fontSize: 11,
    color: ui.textMuted,
    maxWidth: SIZE + 8,
    textAlign: 'center',
  },
});
