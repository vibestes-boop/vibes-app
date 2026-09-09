import { useMemo, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Bell, BellRing, CalendarClock, Lock, Repeat } from 'lucide-react-native';
import { formatSlot, formatUntil, type PlannedShow, type Series } from '../lib/useSchedule';
import { usePreparedByPlan, type PreparedAuction } from '../lib/usePrepared';
import { showReasonText, type ShowReasons } from '../lib/showDiscovery';
import type { DiscoveryReason } from '../lib/discovery';
import { useShowReminder } from '../lib/useShowReminders';
import { useSession } from '../lib/session';
import { ui, radius, space } from '../theme/tokens';
import { Avatar } from './Avatar';
import { BerkatMark } from './BerkatMark';

type Props = { series: Series[]; reasons?: ShowReasons; onSelect: (hostId: string) => void };

export function ReminderBell({ show }: { show: Pick<PlannedShow, 'id' | 'host_id' | 'title' | 'scheduled_at'> }) {
  const myUserId = useSession((state) => state.userId);
  const { on, flip, busy } = useShowReminder(show.id, myUserId);
  if (myUserId === show.host_id) return null;
  return <Pressable style={({ pressed }) => [s.reminder, on && s.reminderOn, pressed && s.pressed]}
    disabled={busy} accessibilityRole="button" accessibilityState={{ selected: on, busy, disabled: busy }}
    accessibilityLabel={on ? `Nicht mehr an ${show.title} erinnern` : `An ${show.title} erinnern, ${formatSlot(show.scheduled_at)}`}
    onPress={() => {
      if (!myUserId) { router.push('/login'); return; }
      void flip().catch(() => Alert.alert('Erinnerung nicht geändert', 'Bitte versuche es noch einmal.'));
    }}>
    {on ? <BellRing size={17} color={ui.successInk} /> : <Bell size={17} color={ui.brand} />}
    <Text style={[s.reminderText, on && s.reminderTextOn]}>{busy ? 'Einen Moment …' : on ? 'Vorgemerkt' : 'Erinnern'}</Text>
  </Pressable>;
}

/** Shared display; the reminder is a sibling of the card action, also for VoiceOver. */
export function UpcomingShowCard({ series: { next: show, count }, prepared, reason, wide, cardWidth, onSelect, reminder }: {
  series: Series; prepared: Pick<PreparedAuction, 'id' | 'image_url'>[];
  reason?: DiscoveryReason; wide: boolean; cardWidth?: number;
  onSelect: (hostId: string) => void; reminder: ReactNode;
}) {
  const { fontScale } = useWindowDimensions();
  const horizontal = wide && fontScale <= 1.5;
  const photos = prepared.filter((item) => item.image_url).slice(0, 3);
  return <View key={fontScale} style={[s.card, !wide && { width: cardWidth }]}>
    <Pressable onPress={() => onSelect(show.host_id)} style={({ pressed }) => [s.open, horizontal && s.horizontal, pressed && s.pressed]}
      accessibilityRole="button" accessibilityLabel={`${show.title}, ${formatSlot(show.scheduled_at)}, ${show.host?.username ?? 'Verkäufer'}${reason ? `, ${showReasonText(reason)}` : ''}${show.women_only ? ', Frauen-Only' : ''}`}
      accessibilityHint="Öffnet die Termine und Shows dieses Verkäuferprofils.">
      <View style={[s.cover, horizontal && s.coverWide]}>
        {show.cover_url ? <Image source={{ uri: show.cover_url }} style={StyleSheet.absoluteFill}
          contentFit="cover" enforceEarlyResizing accessible={false} /> : <BerkatMark size={42} color={ui.brand} />}
      </View>
      <View style={s.copy}>
        <View style={s.hostRow}>
          <Avatar uri={show.host?.avatar_url} name={show.host?.username} size={24} />
          <Text style={s.host} numberOfLines={fontScale > 1.5 ? undefined : 1}>{show.host?.username ?? 'Verkäufer'}</Text>
          {show.women_only ? <Lock size={14} color={ui.success} /> : null}
        </View>
        {reason ? <Text style={s.reason}>{showReasonText(reason)}</Text> : null}
        <Text style={s.title} numberOfLines={fontScale > 1.5 ? undefined : 2}>{show.title}</Text>
        <View style={s.when}>
          <Text style={s.slot}>{formatSlot(show.scheduled_at)}</Text>
          <Text style={s.until}>{formatUntil(show.scheduled_at)}</Text>
        </View>
        {prepared.length > 0 ? <View style={s.peekRow}>
          {photos.map((item) => <Image key={item.id} source={{ uri: item.image_url! }} style={s.peek}
            contentFit="cover" enforceEarlyResizing accessible={false} />)}
          <Text style={s.meta}>{prepared.length} {prepared.length === 1 ? 'Angebot' : 'Angebote'}</Text>
        </View> : null}
        {count > 1 ? <View style={s.repeat}><Repeat size={13} color={ui.textMuted} /><Text style={s.meta}>{count} Termine</Text></View> : null}
      </View>
    </Pressable>
    {reminder}
  </View>;
}

export function UpcomingStrip({ series, reasons = {}, onSelect }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const planIds = useMemo(() => series.map((item) => item.next.id), [series]);
  const { byPlan } = usePreparedByPlan(planIds);
  const cardWidth = Math.min(width - 48, Math.round(208 * Math.max(1, fontScale)));
  if (series.length === 0) return null;
  const card = (item: Series, wide: boolean) => <UpcomingShowCard key={item.next.id} series={item}
    prepared={byPlan.get(item.next.id) ?? []} reason={reasons[item.next.id]} wide={wide} cardWidth={cardWidth}
    onSelect={onSelect} reminder={<ReminderBell show={item.next} />} />;
  return <View key={fontScale} style={s.wrap}>
    <View style={s.head}><CalendarClock size={19} color={ui.brand} /><Text style={s.heading} accessibilityRole="header">Demnächst</Text></View>
    <Text style={s.hint}>Mit der Glocke deinen Termin vormerken.</Text>
    {series.length === 1 ? card(series[0], true) : <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}>{series.map((item) => card(item, false))}</ScrollView>}
  </View>;
}

const s = StyleSheet.create({
  wrap: { marginBottom: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: ui.text, flex: 1 },
  hint: { fontSize: 12, lineHeight: 18, color: ui.textMuted, marginTop: space.xs, marginBottom: space.md },
  row: { gap: space.md, paddingRight: space.md, alignItems: 'stretch' },
  card: { backgroundColor: ui.card, borderRadius: radius.lg, borderWidth: 1, borderColor: ui.line, overflow: 'hidden' },
  open: { flex: 1 },
  horizontal: { flexDirection: 'row' },
  cover: { height: 148, backgroundColor: ui.sunken, alignItems: 'center', justifyContent: 'center' },
  coverWide: { width: 112, height: 'auto', alignSelf: 'stretch' },
  copy: { flex: 1, minWidth: 0, padding: space.md, gap: space.sm },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  host: { flex: 1, fontSize: 12, lineHeight: 18, color: ui.textMuted, fontWeight: '600' },
  reason: { fontSize: 12, lineHeight: 18, color: ui.brand, fontWeight: '600' },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: ui.text },
  when: { marginTop: 'auto', gap: space.xs },
  slot: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: ui.brand },
  until: { fontSize: 12, lineHeight: 18, color: ui.textMuted },
  peekRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  peek: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: ui.sunken },
  meta: { fontSize: 12, lineHeight: 18, color: ui.textMuted },
  repeat: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  reminder: { minHeight: 48, paddingVertical: space.sm, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: ui.bg },
  reminderOn: { backgroundColor: ui.success },
  reminderText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.brand, flexShrink: 1 },
  reminderTextOn: { color: ui.successInk },
  pressed: { opacity: 0.65 },
});
