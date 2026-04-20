/**
 * app/admin/orders.tsx — Shop-Bestellungen überwachen
 *
 * Alle Transaktionen mit Status-Update-Funktion
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Package, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react-native';
import { useAdminOrders, useAdminUpdateOrderStatus, type AdminOrder } from '@/lib/useAdmin';
import { useTheme } from '@/lib/useTheme';

// ─── Status-Meta ──────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; icon: any; color: string }> = {
  pending:   { label: 'Ausstehend',    icon: Clock,        color: '#F59E0B' },
  completed: { label: 'Abgeschlossen', icon: CheckCircle,  color: '#16A34A' },
  cancelled: { label: 'Storniert',     icon: XCircle,      color: '#EF4444' },
  refunded:  { label: 'Erstattet',     icon: RefreshCw,    color: '#6B7280' },
};

// ─── Status-Filter ────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'pending', 'completed', 'cancelled', 'refunded'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export default function AdminOrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: orders = [], isLoading, refetch, isRefetching } = useAdminOrders();
  const { mutateAsync: updateStatus } = useAdminUpdateOrderStatus();

  const filtered = statusFilter === 'all'
    ? orders
    : orders.filter(o => o.status === statusFilter);

  const handleStatusChange = (order: AdminOrder) => {
    const nextStatuses = Object.keys(STATUS).filter(s => s !== order.status) as string[];
    Alert.alert(
      'Status ändern',
      `Aktuelle Status: ${STATUS[order.status]?.label ?? order.status}`,
      [
        ...nextStatuses.map(s => ({
          text: STATUS[s]?.label ?? s,
          onPress: async () => {
            try { await updateStatus({ orderId: order.id, status: s }); }
            catch { Alert.alert('Fehler', 'Update fehlgeschlagen.'); }
          },
        })),
        { text: 'Abbrechen', style: 'cancel' as const },
      ]
    );
  };

  const totalCoins = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + o.total_coins, 0);

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <View>
          <Text style={[s.headerTitle, { color: colors.text.primary }]}>Bestellungen</Text>
          <Text style={[s.headerSub, { color: colors.text.muted }]}>
            {orders.length} gesamt · 🪙 {totalCoins.toLocaleString('de-DE')} Coins
          </Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {/* Filter-Chips */}
      <View style={s.filterRow}>
        <FlatList
          horizontal
          data={STATUS_FILTERS as unknown as StatusFilter[]}
          keyExtractor={f => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item: f }) => {
            const isActive = statusFilter === f;
            const meta = f === 'all' ? null : STATUS[f];
            return (
              <Pressable
                style={[
                  s.filterChip,
                  { borderColor: isActive ? colors.text.primary : colors.border.subtle,
                    backgroundColor: isActive ? colors.text.primary : colors.bg.elevated },
                ]}
                onPress={() => setStatusFilter(f)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
              >
                <Text style={[s.filterLabel, { color: isActive ? colors.bg.primary : colors.text.primary }]}>
                  {f === 'all' ? 'Alle' : meta?.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {/* Liste */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent.primary} />
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Package size={40} color={colors.text.muted} strokeWidth={1.2} />
              <Text style={[s.emptyText, { color: colors.text.muted }]}>Keine Bestellungen</Text>
            </View>
          }
          renderItem={({ item: order }) => {
            const statusMeta = STATUS[order.status] ?? STATUS.pending;
            const StatusIcon = statusMeta.icon;
            const date = new Date(order.created_at).toLocaleDateString('de-DE', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            });
            return (
              <Pressable
                style={[s.orderCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
                onPress={() => handleStatusChange(order)}
                accessibilityRole="button"
              >
                {/* Produkt */}
                <View style={s.orderTop}>
                  <Text style={[s.orderProduct, { color: colors.text.primary }]} numberOfLines={1}>
                    {(order.product as any)?.title ?? 'Produkt'}
                  </Text>
                  <View style={[s.statusBadge, { backgroundColor: `${statusMeta.color}18` }]}>
                    <StatusIcon size={12} color={statusMeta.color} strokeWidth={2} />
                    <Text style={[s.statusLabel, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                  </View>
                </View>

                {/* Beteiligte */}
                <View style={s.orderParties}>
                  <Text style={[s.orderPartyText, { color: colors.text.muted }]}>
                    Käufer: @{(order.buyer as any)?.username ?? '?'}
                  </Text>
                  <Text style={[s.orderPartyText, { color: colors.text.muted }]}>
                    Seller: @{(order.seller as any)?.username ?? '?'}
                  </Text>
                </View>

                {/* Betrag + Datum */}
                <View style={s.orderFooter}>
                  <Text style={[s.orderCoins, { color: colors.text.primary }]}>
                    🪙 {order.total_coins.toLocaleString('de-DE')} · ×{order.quantity}
                  </Text>
                  <Text style={[s.orderDate, { color: colors.text.muted }]}>{date}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub:   { fontSize: 11 },

  filterRow: { paddingVertical: 10 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  filterLabel: { fontSize: 12, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14 },

  orderCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderProduct: { flex: 1, fontSize: 14, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  statusLabel: { fontSize: 10, fontWeight: '700' },
  orderParties: { gap: 2 },
  orderPartyText: { fontSize: 11 },
  orderFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderCoins: { fontSize: 13, fontWeight: '700' },
  orderDate: { fontSize: 11 },
});
