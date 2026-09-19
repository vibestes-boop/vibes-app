import { useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUpRight, Bell, CalendarClock, CheckCheck, ChevronLeft, Gavel, Hourglass, MessageSquare, PackageCheck, Radio, RefreshCw, Search, Star, TriangleAlert, Truck } from 'lucide-react-native';
import type { BerkatNotification } from '../lib/useNotifications';
import { notificationSections, notificationWhen, presentNotification } from '../lib/notificationPresentation';
import { useReducedMotion } from '../lib/useReducedMotion';
import { PressFeedback } from './PressFeedback';
import { radius, space, ui } from '../theme/tokens';

const icons = { won: Gavel, payment: Hourglass, shipping: Truck, live: Radio, order: PackageCheck,
  review: Star, reminder: CalendarClock, search: Search, problem: TriangleAlert, message: MessageSquare, notice: Bell };

function NotificationArtwork({ item, kind }: { item: BerkatNotification; kind: keyof typeof icons }) {
  const reduced = useReducedMotion();
  const [imageFailed, setImageFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const uri = !imageFailed && item.image_url ? item.image_url : !avatarFailed ? item.sender_avatar : null;
  const avatar = !item.image_url || imageFailed;
  const Icon = icons[kind];
  const initials = item.sender_name?.trim().slice(0, 2).toUpperCase();
  return <View style={s.artColumn} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={[s.art, avatar && s.avatar, avatar && initials ? s.initialsBg : null]}>
      {avatar && initials ? <Text allowFontScaling={false} style={s.initials}>{initials}</Text> : <Icon size={25} color={ui.brand} strokeWidth={1.6} />}
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={uri}
        enforceEarlyResizing transition={reduced ? 0 : 120}
        onError={() => avatar ? setAvatarFailed(true) : setImageFailed(true)} /> : null}
    </View>
    {uri || initials ? <View style={[s.eventBadge, avatar && s.avatarBadge]}><Icon size={13} color={ui.brand} strokeWidth={1.8} /></View> : null}
  </View>;
}

export function NotificationRow({ item, onOpen, now = new Date() }: { item: BerkatNotification; onOpen: (item: BerkatNotification) => void; now?: Date }) {
  const { fontScale } = useWindowDimensions();
  const info = presentNotification(item);
  const title = info.subject ?? (['message', 'live', 'reminder'].includes(info.kind) ? item.sender_name : null) ?? info.title;
  const time = notificationWhen(item.created_at, now);
  return <PressFeedback onPress={() => onOpen(item)} style={s.row} accessibilityRole="button"
    accessibilityLabel={[!item.read ? 'Ungelesen' : null, info.title, info.subject, info.body, item.sender_name, time].filter(Boolean).join('. ')}
    accessibilityHint={info.action}>
    <NotificationArtwork key={`${item.id}:${item.image_url}:${item.sender_avatar}:${item.sender_name}`} item={item} kind={info.kind} />
    <View key={`copy:${fontScale}`} style={s.rowCopy}>
      <View style={s.kickerRow}>
        <Text style={[s.kicker, title === info.title && s.mainTitle]}>{info.title}</Text>
        {!item.read ? <View style={s.dot} /> : null}
      </View>
      {title !== info.title ? <Text style={s.mainTitle}>{title}</Text> : null}
      <Text style={s.body}>{info.body}</Text>
      <Text style={s.meta}>{item.sender_name && item.sender_name !== title ? `${item.sender_name} · ` : ''}{time}</Text>
      <View style={s.action}><Text style={s.actionText}>{info.action}</Text><ArrowUpRight size={14} color={ui.brand} /></View>
    </View>
  </PressFeedback>;
}

type Props = {
  items: BerkatNotification[];
  loading?: boolean;
  guest?: boolean;
  error?: boolean;
  partial?: boolean;
  refreshing?: boolean;
  marking?: boolean;
  readError?: boolean;
  onBack: () => void;
  onOpen: (item: BerkatNotification) => void;
  onReadAll: () => void;
  onRefresh: () => void;
  onLogin: () => void;
  onExplore: () => void;
};

export function NotificationInbox({ items, loading, guest, error, partial, refreshing = false, marking, readError,
  onBack, onOpen, onReadAll, onRefresh, onLogin, onExplore }: Props) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const now = new Date();
  const unread = items.filter(item => !item.read).length;
  const emptyTitle = loading ? 'Meldungen werden geladen' : guest ? 'Deine Meldungen an einem Ort' : error ? 'Meldungen gerade nicht erreichbar' : 'Du bist auf dem neuesten Stand';
  const emptyBody = guest ? 'Melde dich an, um Neuigkeiten zu deinen Käufen, Shows und Nachrichten zu sehen.'
    : error ? 'Wir konnten deine Meldungen nicht laden. Versuche es noch einmal.'
    : 'Zuschläge, Versand und neue Nachrichten erscheinen hier, sobald es etwas Neues für dich gibt.';
  return <View style={[s.screen, { paddingTop: insets.top }]}>
    <View style={s.header}>
      <PressFeedback style={s.headerButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Zurück"><ChevronLeft size={24} color={ui.text} /></PressFeedback>
      <Text key={`heading:${fontScale}`} style={s.heading} accessibilityRole="header">Meldungen</Text>
      {unread > 0 && !guest ? <PressFeedback style={s.headerButton} onPress={onReadAll} disabled={marking}
        accessibilityRole="button" accessibilityLabel={unread === 1 ? 'Angezeigte Meldung als gelesen markieren' : `${unread} angezeigte Meldungen als gelesen markieren`} accessibilityState={{ disabled: Boolean(marking), busy: Boolean(marking) }}>
        {marking ? <ActivityIndicator color={ui.brand} /> : <CheckCheck size={23} color={ui.brand} />}
      </PressFeedback> : null}
    </View>
    <SectionList sections={notificationSections(items, now)} keyExtractor={item => item.id}
      renderItem={({ item }) => <NotificationRow item={item} onOpen={onOpen} now={now} />}
      renderSectionHeader={({ section }) => <Text key={`section:${fontScale}`} style={s.section} accessibilityRole="header">{section.title}</Text>}
      stickySectionHeadersEnabled={false} ItemSeparatorComponent={() => <View style={s.separator} />}
      contentContainerStyle={[{ paddingBottom: insets.bottom + space.xl }, items.length === 0 && s.emptyList]}
      refreshControl={!guest ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ui.brand} /> : undefined}
      ListHeaderComponent={<>
        {items.length > 0 && (error || partial) ? <PressFeedback onPress={onRefresh} style={s.notice} accessibilityRole="button">
          <RefreshCw size={18} color={ui.brand} /><Text style={s.noticeText}>{error ? 'Meldungen konnten nicht aktualisiert werden.' : 'Einige Bilder und Details fehlen noch.'} Erneut laden</Text>
        </PressFeedback> : null}
        {readError ? <Text style={s.readError} accessibilityRole="alert">Der Gelesen-Status konnte nicht gespeichert werden. Versuche es erneut über das Häkchen.</Text> : null}
      </>}
      ListEmptyComponent={<View style={s.empty}>
        <View style={s.emptyArt}>{loading ? <ActivityIndicator color={ui.brand} /> : <Bell size={30} strokeWidth={1.5} color={ui.brand} />}</View>
        <Text style={s.emptyTitle} accessibilityRole="header">{emptyTitle}</Text>
        {!loading ? <><Text style={s.emptyBody}>{emptyBody}</Text>
          <PressFeedback onPress={guest ? onLogin : error ? onRefresh : onExplore} style={s.emptyAction} accessibilityRole="button">
            <Text style={s.emptyActionText}>{guest ? 'Anmelden' : error ? 'Erneut versuchen' : 'Entdecken'}</Text>
          </PressFeedback></> : null}
      </View>}
      ListFooterComponent={items.length === 50 ? <Text style={s.footer}>Deine letzten 50 Meldungen</Text> : null}
    />
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.card },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingTop: space.xs, paddingBottom: space.sm, gap: space.xs },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontSize: 24, lineHeight: 32, fontWeight: '700', color: ui.text, letterSpacing: -0.4 },
  section: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: ui.textMuted, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg },
  artColumn: { width: 64, minHeight: 76, alignItems: 'center' },
  art: { width: 64, height: 76, borderRadius: radius.md, backgroundColor: ui.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  initialsBg: { backgroundColor: ui.avatar },
  initials: { fontSize: 19, fontWeight: '600', color: ui.card },
  eventBadge: { position: 'absolute', right: 0, bottom: 0, width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: ui.card, backgroundColor: ui.bg, alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { bottom: 18 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  kicker: { flexShrink: 1, fontSize: 12, lineHeight: 18, fontWeight: '500', color: ui.textMuted },
  mainTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: ui.text },
  body: { fontSize: 14, lineHeight: 20, color: ui.textMuted },
  meta: { fontSize: 12, lineHeight: 18, color: ui.textMuted, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ui.brand },
  action: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingTop: 2 },
  actionText: { flexShrink: 1, fontSize: 12, lineHeight: 18, fontWeight: '600', color: ui.brand },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: ui.line, marginLeft: 96, marginRight: space.lg },
  notice: { marginHorizontal: space.lg, marginVertical: space.sm, padding: space.md, backgroundColor: ui.bg, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, color: ui.textMuted },
  readError: { marginHorizontal: space.lg, fontSize: 13, lineHeight: 19, color: ui.textMuted },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: 64, gap: space.md },
  emptyArt: { width: 76, height: 76, borderRadius: 25, backgroundColor: ui.bg, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 21, lineHeight: 28, fontWeight: '600', color: ui.text, textAlign: 'center' },
  emptyBody: { fontSize: 15, lineHeight: 22, color: ui.textMuted, textAlign: 'center', maxWidth: 340 },
  emptyAction: { minHeight: 48, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: ui.brand, marginTop: space.sm },
  emptyActionText: { fontSize: 15, lineHeight: 21, color: ui.card, fontWeight: '600', textAlign: 'center' },
  footer: { fontSize: 12, lineHeight: 18, color: ui.textMuted, textAlign: 'center', padding: space.lg },
});
