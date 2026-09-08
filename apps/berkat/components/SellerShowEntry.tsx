import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowUpRight, CalendarClock, Lock, Radio } from 'lucide-react-native';
import { showWhen, type AnnouncedShow } from '../lib/useSellerShows';
import { radius, space, ui } from '../theme/tokens';

type Props = {
  live: { id: string; title: string | null; women_only: boolean } | null | undefined;
  planned: AnnouncedShow | null;
  onLive: (id: string) => void;
  onSchedule: () => void;
};

export function SellerShowEntry({ live, planned, onLive, onSchedule }: Props) {
  if (!live && !planned) return null;
  const title = (live ? live.title : planned?.title) ?? 'Berkat-Show';
  const womenOnly = live ? live.women_only : planned?.women_only;
  const when = live ? 'Jetzt live' : showWhen(planned!.scheduled_at);
  return <Pressable onPress={() => live ? onLive(live.id) : onSchedule()}
    accessibilityRole="button" accessibilityLabel={`${when}, ${title}${womenOnly ? ', Nur Frauen' : ''}. ${live ? 'Show ansehen' : 'Termine ansehen'}`}
    style={({ pressed }) => [s.card, pressed && s.pressed]}>
    <View style={s.top}>
      {live ? <Radio size={18} color={ui.live} /> : <CalendarClock size={18} color={ui.brand} />}
      <Text style={[s.label, live && s.live]}>{live ? 'Jetzt live' : 'Nächster Termin'}</Text>
      <ArrowUpRight size={18} color={ui.textMuted} />
    </View>
    <Text numberOfLines={2} style={s.title}>{title}</Text>
    <View style={s.meta}>
      <Text style={s.when}>{live ? 'Show ansehen' : when}</Text>
      {womenOnly ? <View style={s.women}><Lock size={13} color={ui.success} /><Text style={s.womenText}>Nur Frauen</Text></View> : null}
    </View>
  </Pressable>;
}
const s = StyleSheet.create({
  card: { backgroundColor: ui.card, borderRadius: radius.lg, padding: space.lg, gap: space.sm, marginBottom: space.md },
  pressed: { opacity: 0.65 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600', color: ui.textMuted },
  live: { color: ui.live },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: ui.text },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' },
  when: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: ui.brand },
  women: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  womenText: { fontSize: 13, lineHeight: 19, color: ui.success },
});
