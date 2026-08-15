// „Demnächst" — der Sendeplan auf der Startseite.
//
// Der Zweck ist nicht, Termine anzuzeigen. Der Zweck ist, dass die Startseite
// **nie leer wirkt**: Ohne diesen Streifen sagt Berkat „Gerade ist niemand live"
// und damit faktisch „komm später mal wieder, vielleicht". Mit ihm sagt sie
// „heute um 20:00 bei zaur" — ein Grund, wiederzukommen, statt einer Absage.
//
// Antippen führt aufs Verkäufer-Profil und nicht auf eine Detailseite des
// Termins. Das ist Absicht: **Erinnert werden die Follower**, der Folgen-Knopf
// ist also die einzige Handlung, die hier etwas bewirkt. Eine eigene
// Termin-Seite hätte einen Knopf gebraucht, den es nicht gibt.

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, Lock, Repeat } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { formatSlot, formatUntil, nextPerSeries, type PlannedShow } from '../lib/useSchedule';
import { Avatar } from './Avatar';

type Props = {
  shows: PlannedShow[];
  onSelect: (hostId: string) => void;
};

export function UpcomingStrip({ shows, onSelect }: Props) {
  // Aus einer wöchentlichen Reihe wird EINE Karte. Vier gleiche nebeneinander
  // würden die anderen Verkäufer aus dem Streifen drängen — und die Frage, die
  // er beantwortet, ist „wann kommt als Nächstes was?", nicht „zeig mir einen
  // Kalender".
  const series = nextPerSeries(shows);
  if (series.length === 0) return null;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <CalendarClock size={15} color={ui.textMuted} />
        <Text style={s.headText}>Demnächst</Text>
        <Text style={s.hint}>Folge — dann erinnern wir dich</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {series.map(({ next: show, count }) => (
          <Pressable
            key={show.id}
            style={s.card}
            onPress={() => onSelect(show.host_id)}
            accessibilityRole="button"
            accessibilityLabel={`${show.title} — ${formatSlot(show.scheduled_at)}${
              count > 1 ? ', jede Woche' : ''
            }`}
          >
            <View style={s.cardHead}>
              <Avatar uri={show.host?.avatar_url} name={show.host?.username} size={26} />
              <Text numberOfLines={1} style={s.host}>
                {show.host?.username ?? 'Verkäufer'}
              </Text>
              {show.women_only ? <Lock size={12} color={ui.success} /> : null}
            </View>

            <Text numberOfLines={2} style={s.title}>
              {show.title}
            </Text>

            <View style={s.when}>
              <Text style={s.slot}>{formatSlot(show.scheduled_at)}</Text>
              <Text style={s.until}>{formatUntil(show.scheduled_at)}</Text>
            </View>

            {/* Das eigentliche Ritual-Signal: nicht „heute um 20:00", sondern
                „das ist immer so". Erst dadurch merkt sich jemand den Abend. */}
            {count > 1 ? (
              <View style={s.weeklyPill}>
                <Repeat size={10} color={ui.brand} />
                <Text style={s.weeklyText}>jede Woche</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: space.md },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space.sm,
  },
  headText: { fontSize: 13, fontWeight: '700', color: ui.text },
  // Die Erklärung steht neben der Überschrift und nicht auf jeder Karte —
  // einmal gesagt reicht, zwölfmal wäre Lärm.
  hint: { fontSize: 11, color: ui.textMuted, marginLeft: 'auto' },

  row: { gap: space.md, paddingRight: space.md },
  card: {
    width: 168,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ui.line,
    padding: space.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  host: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '600', color: ui.textMuted },

  title: {
    fontSize: 14,
    fontWeight: '700',
    color: ui.text,
    marginTop: space.sm,
    minHeight: 36,
  },

  when: { marginTop: space.sm, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  weeklyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    marginTop: space.sm,
    backgroundColor: ui.sunken,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  weeklyText: { fontSize: 10, fontWeight: '700', color: ui.brand },
  slot: { fontSize: 13, fontWeight: '700', color: ui.brand },
  until: { fontSize: 11, color: ui.textMuted },
});
