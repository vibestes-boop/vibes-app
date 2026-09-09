import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { CalendarClock, Lock } from 'lucide-react-native';
import type { AnnouncedShow } from '../lib/useSellerShows';
import { formatSlot, formatUntil } from '../lib/useSchedule';
import { radius, space, ui } from '../theme/tokens';
import { BerkatMark } from './BerkatMark';
import { ReminderBell } from './UpcomingStrip';

/** Same reminder as Home, kept beside the date on its destination profile. */
export function SellerScheduleCard({ show, hostId }: { show: AnnouncedShow; hostId: string }) {
  const { fontScale } = useWindowDimensions();
  return <View key={fontScale} style={s.card}>
    <View style={[s.content, fontScale > 1.5 && s.stacked]}>
      <View style={[s.cover, fontScale > 1.5 && s.wideCover]}>
        {show.cover_url ? <Image source={{ uri: show.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover"
          enforceEarlyResizing accessible={false} /> : <BerkatMark size={36} color={ui.brand} />}
      </View>
      <View style={s.copy}>
        <Text style={s.title} accessibilityRole="header">{show.title ?? 'Berkat-Show'}</Text>
        <View style={s.date}><CalendarClock size={17} color={ui.brand} /><Text style={s.slot}>{formatSlot(show.scheduled_at)}</Text></View>
        <Text style={s.until}>{formatUntil(show.scheduled_at)}</Text>
        {show.women_only ? <View style={s.date}><Lock size={14} color={ui.success} /><Text style={s.women}>Nur Frauen</Text></View> : null}
      </View>
    </View>
    <ReminderBell show={{ id: show.id, host_id: hostId, title: show.title ?? 'Berkat-Show', scheduled_at: show.scheduled_at }} />
  </View>;
}
const s = StyleSheet.create({
  card: { marginVertical: space.sm, borderRadius: radius.lg, backgroundColor: ui.card, borderWidth: 1, borderColor: ui.line, overflow: 'hidden' },
  content: { flexDirection: 'row' },
  stacked: { flexDirection: 'column' },
  cover: { width: 96, minHeight: 128, backgroundColor: ui.sunken, alignItems: 'center', justifyContent: 'center' },
  wideCover: { width: '100%', height: 148 },
  copy: { flex: 1, minWidth: 0, padding: space.md, gap: space.sm },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: ui.text },
  date: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  slot: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.brand },
  until: { fontSize: 12, lineHeight: 18, color: ui.textMuted },
  women: { flex: 1, fontSize: 12, lineHeight: 18, color: ui.success },
});
