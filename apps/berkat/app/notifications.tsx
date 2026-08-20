// Die Liste der Meldungen, die Berkat geschickt hat.
//
// Warum es sie gibt: Ein Push ist flüchtig. Wer ihn wegwischt oder das Handy erst
// später ansieht, hatte bis zum 14.08.2026 keine Möglichkeit mehr, den Zuschlag
// wiederzufinden. Beim ersten echten Durchlauf fiel genau das auf.
//
// Die Liste ist bewusst schlicht: drei Ereignisse, jedes mit einer klaren
// nächsten Handlung. Antippen führt dorthin, wo man sie ausführt — ins Konto.

import { useCallback } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  Bell,
  CalendarClock,
  ChevronLeft,
  Gavel,
  Hourglass,
  PackageCheck,
  PartyPopper,
  Radio,
  Truck,
} from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import {
  notificationTarget,
  useBerkatNotifications,
  useMarkAllRead,
  useUnreadCount,
  type BerkatNotification,
} from '../lib/useNotifications';
import { radius, space, ui } from '../theme/tokens';

/** Symbol und Überschrift je Ereignis. Unbekanntes bekommt die Glocke. */
function present(type: string): { Icon: typeof Bell; title: string; tint: string } {
  switch (type) {
    case 'auction_won':
      return { Icon: PartyPopper, title: 'Zuschlag — du hast gewonnen', tint: ui.gold };
    case 'order_payment_reminder':
      return { Icon: Hourglass, title: 'Dein Sammelkorb wartet', tint: ui.gold };
    case 'order_shipped':
      return { Icon: Truck, title: 'Unterwegs zu dir', tint: ui.success };
    // Rot, als einzige Käufer-Meldung: In Berkat ist Rot die laufende Uhr, und
    // genau darum geht es hier — der Artikel wird gerade aufgerufen.
    case 'auction_up':
      return { Icon: Gavel, title: 'Dein Artikel ist dran', tint: ui.live };
    // ── Ab hier VERKÄUFER-Ereignisse ────────────────────────────────────────
    // Bis zum 16.08.2026 fielen sie in den Standard-Zweig und hießen „Neu bei
    // Berkat" — für eine Meldung, die „pack das Paket" bedeutet, ist das keine
    // Auskunft.
    case 'order_paid':
      return { Icon: PackageCheck, title: 'Bezahlt — bitte packen', tint: ui.success };
    case 'new_order':
      return { Icon: PackageCheck, title: 'Neue Bestellung', tint: ui.gold };
    case 'order_review':
      return { Icon: PartyPopper, title: 'Neue Bewertung', tint: ui.gold };
    case 'scheduled_live_reminder':
      return { Icon: CalendarClock, title: 'Gleich live', tint: ui.gold };
    case 'live':
      return { Icon: Radio, title: 'Sendet jetzt', tint: ui.live };
    default:
      return { Icon: Bell, title: 'Neu bei Berkat', tint: ui.textMuted };
  }
}

/** „vor 3 Min", „vor 2 Std", „gestern", sonst das Datum. */
function whenLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std`;
  if (std < 48) return 'gestern';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function Row({ item }: { item: BerkatNotification }) {
  const { Icon, title, tint } = present(item.type);

  return (
    <Pressable
      style={[styles.row, !item.read && styles.rowUnread]}
      onPress={() => router.push(
          notificationTarget({
            type: item.type,
            sessionId: item.session_id,
            senderId: item.sender_id,
          }) as never,
        )}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
        <Icon size={19} color={tint} />
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {item.comment_text ? (
          <Text numberOfLines={2} style={styles.rowText}>
            {item.comment_text}
          </Text>
        ) : null}
        {/* Der Artikelname, wenn er nicht ohnehin im Satz steht.
            Bei `order_paid` ist der Satz für alle Bestellungen derselbe („Eine
            Bestellung wurde bezahlt — bitte versenden"); ohne diese Zeile
            standen bei vier offenen Bestellungen vier wortgleiche Meldungen
            untereinander. Bei `auction_won` trägt `comment_text` den Namen
            bereits — dann wäre er hier doppelt. */}
        {item.product_name && !item.comment_text?.includes(item.product_name) ? (
          <Text numberOfLines={1} style={styles.rowProduct}>
            {item.product_name}
          </Text>
        ) : null}
        <Text style={styles.rowMeta}>
          {item.sender_name ? `${item.sender_name} · ` : ''}
          {whenLabel(item.created_at)}
        </Text>
      </View>

      {!item.read ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);

  const { data: items = [], refetch, isLoading } = useBerkatNotifications(userId);
  const { refetch: refetchUnread } = useUnreadCount(userId);
  const markAllRead = useMarkAllRead(userId);
  const [pulling, setPulling] = useState(false);

  // Reiter- und Stack-Bildschirme bleiben in Expo Router aufgebaut. Ohne diesen
  // Effekt sähe man beim zweiten Öffnen denselben Stand wie beim ersten — genau
  // die Falle, die am 14.08. beim Konto-Reiter zuschlug.
  useFocusEffect(
    useCallback(() => {
      void refetch();
      // Wer die Liste ansieht, hat sie gesehen. Das Abzeichen an der Glocke muss
      // danach neu gezählt werden, sonst bleibt es stehen.
      markAllRead();
      void refetchUnread();
    }, [refetch, markAllRead, refetchUnread]),
  );

  // Eigener Zustand statt `isRefetching`: Sonst springt der Kreisel bei jedem
  // Hintergrund-Abruf an und die Liste wirkt, als hinge sie.
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Meldungen</Text>
        <View style={styles.back} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <Row item={item} />}
        contentContainerStyle={
          items.length === 0 ? styles.emptyWrap : { paddingBottom: insets.bottom + space.xl }
        }
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Bell size={30} color={ui.lineStrong} />
              <Text style={styles.emptyTitle}>Noch nichts passiert</Text>
              <Text style={styles.emptyBody}>
                Wenn du eine Auktion gewinnst, steht es hier — und dein Paket wartet unter „Konto".
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  rowUnread: { backgroundColor: ui.card },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: ui.text },
  rowText: { fontSize: 14, color: ui.text, lineHeight: 19 },
  rowProduct: { fontSize: 14, fontWeight: '700', color: ui.text, marginTop: 1 },
  rowMeta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    marginTop: space.md,
  },

  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: ui.text, marginTop: space.sm },
  emptyBody: { fontSize: 14, color: ui.textMuted, textAlign: 'center', lineHeight: 20 },
});
