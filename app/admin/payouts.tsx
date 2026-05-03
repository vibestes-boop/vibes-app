/**
 * app/admin/payouts.tsx — Creator Auszahlungs-Anfragen
 * Design: App-native Monochrom-Stil (wie admin/index.tsx)
 */

import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Alert, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Diamond, CheckCircle2, XCircle,
  CreditCard, Mail, Search, Users, ChevronRight,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAdminSellerBalances } from '@/lib/useAdmin';
import { useTheme } from '@/lib/useTheme';

type PayoutStatus = 'pending' | 'processing' | 'paid' | 'rejected';
type AdminTab     = 'requests' | 'balances';

interface PayoutRequest {
  id: string;
  creator_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  diamonds_amount: number;
  euro_amount: number;
  iban: string | null;
  paypal_email: string | null;
  note: string | null;
  status: PayoutStatus;
  admin_note: string | null;
  created_at: string;
}

function usePayoutRequests(status: PayoutStatus | 'all') {
  return useQuery<PayoutRequest[]>({
    queryKey: ['admin-payout-requests', status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_payout_requests', {
        p_status: status === 'all' ? null : status,
      });
      if (error) throw error;
      return (data ?? []) as PayoutRequest[];
    },
    staleTime: 60 * 1000,
  });
}

function useUpdatePayoutStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, status, adminNote }: { requestId: string; status: PayoutStatus; adminNote?: string }) => {
      const { error } = await supabase.rpc('admin_update_payout_status', {
        p_request_id: requestId,
        p_status:     status,
        p_admin_note: adminNote ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-payout-requests'] }),
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdminPayoutsScreen() {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { colors } = useTheme();

  const [tab,    setTab]    = useState<AdminTab>('requests');
  const [filter, setFilter] = useState<PayoutStatus | 'all'>('pending');
  const [search, setSearch] = useState('');

  const { data: requests = [], isLoading, refetch, isRefetching } = usePayoutRequests(filter);
  const { data: sellers  = [], refetch: refetchSellers }           = useAdminSellerBalances();
  const { mutate: updateStatus, isPending: updating }              = useUpdatePayoutStatus();

  const filtered      = search.trim() ? requests.filter(r => r.username.toLowerCase().includes(search.toLowerCase())) : requests;
  const pendingCount  = requests.filter(r => r.status === 'pending').length;

  const handleStatusChange = (req: PayoutRequest, newStatus: PayoutStatus) => {
    const label: string = ({ paid: 'Bezahlt markieren', rejected: 'Ablehnen', processing: 'In Bearbeitung', pending: 'Zurücksetzen' } as Record<PayoutStatus, string>)[newStatus] ?? newStatus;
    Alert.alert(
      label,
      `@${req.username} · ${req.diamonds_amount} 💎 ≈ ${req.euro_amount}€`,
      [
        {
          text: label,
          style: newStatus === 'rejected' ? 'destructive' : 'default',
          onPress: () => {
            if (newStatus === 'rejected') {
              Alert.prompt('Ablehnungsgrund', 'Optional', (note) => updateStatus({ requestId: req.id, status: newStatus, adminNote: note }), 'plain-text');
            } else {
              updateStatus({ requestId: req.id, status: newStatus });
            }
          },
        },
        { text: 'Abbrechen', style: 'cancel' },
      ]
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: colors.text.primary }]}>Auszahlungen</Text>
          {pendingCount > 0 && (
            <View style={[s.pendingBadge, { backgroundColor: colors.text.primary }]}>
              <Text style={[s.pendingBadgeText, { color: colors.bg.primary }]}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Tabs ── */}
      <View style={[s.tabRow, { borderBottomColor: colors.border.subtle }]}>
        {([
          { id: 'requests' as AdminTab, label: 'Anfragen' },
          { id: 'balances' as AdminTab, label: 'Guthaben' },
        ]).map(({ id, label }) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[s.tabBtn, tab === id && { borderBottomColor: colors.text.primary, borderBottomWidth: 2 }]}
          >
            <Text style={[s.tabLabel, { color: tab === id ? colors.text.primary : colors.text.muted }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'requests' ? (
        <>
          {/* Filter Chips */}
          <View style={s.filterWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
              {(['all', 'pending', 'processing', 'paid', 'rejected'] as const).map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[
                    s.filterChip,
                    { borderColor: filter === f ? colors.text.primary : colors.border.subtle },
                    filter === f && { backgroundColor: colors.text.primary },
                  ]}
                >
                  <Text style={[s.filterChipText, { color: filter === f ? colors.bg.primary : colors.text.secondary }]}>
                    {{ all: 'Alle', pending: 'Ausstehend', processing: 'In Arbeit', paid: 'Bezahlt', rejected: 'Abgelehnt' }[f]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Suche */}
          <View style={[s.searchRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
            <Search size={15} color={colors.text.muted} strokeWidth={2} />
            <TextInput
              style={[s.searchInput, { color: colors.text.primary }]}
              placeholder="Creator suchen…"
              placeholderTextColor={colors.text.muted}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.accent.primary} style={{ marginTop: 40 }} />
          ) : filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <Diamond size={32} color={colors.text.muted} strokeWidth={1.2} />
              <Text style={[s.emptyText, { color: colors.text.muted }]}>Keine Anfragen.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={r => r.id}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 10 }}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent.primary} />}
              renderItem={({ item: req }) => (
                <PayoutCard req={req} colors={colors} onStatusChange={handleStatusChange} updating={updating} />
              )}
            />
          )}
        </>
      ) : (
        <BalancesTab sellers={sellers} colors={colors} insets={insets} refetch={refetchSellers} />
      )}
    </View>
  );
}

// ─── Payout-Karte ─────────────────────────────────────────────────────────────

function PayoutCard({ req, colors, onStatusChange, updating }: {
  req: PayoutRequest; colors: any;
  onStatusChange: (req: PayoutRequest, status: PayoutStatus) => void;
  updating: boolean;
}) {
  const STATUS_LABEL: Record<PayoutStatus, string> = {
    pending:    'Ausstehend',
    processing: 'In Bearbeitung',
    paid:       'Bezahlt',
    rejected:   'Abgelehnt',
  };
  const isPending    = req.status === 'pending' || req.status === 'processing';
  const isRejected   = req.status === 'rejected';

  return (
    <View style={[s.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      {/* Top Row */}
      <View style={s.cardTop}>
        <View style={[s.cardAvatar, { backgroundColor: colors.bg.primary }]}>
          {req.avatar_url
            ? <Image source={{ uri: req.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <Text style={{ fontSize: 16 }}>👤</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.cardName, { color: colors.text.primary }]}>
            {req.display_name ?? `@${req.username}`}
          </Text>
          <Text style={[s.cardSub, { color: colors.text.muted }]}>@{req.username}</Text>
        </View>
        <View style={[s.statusPill, { borderColor: isRejected ? 'rgba(239,68,68,0.25)' : colors.border.subtle }]}>
          <Text style={[s.statusText, { color: isRejected ? '#EF4444' : req.status === 'paid' ? '#22C55E' : colors.text.secondary }]}>
            {STATUS_LABEL[req.status]}
          </Text>
        </View>
      </View>

      {/* Betrag */}
      <View style={[s.cardMid, { borderTopColor: colors.border.subtle, borderBottomColor: isPending ? colors.border.subtle : 'transparent' }]}>
        <View style={s.cardMidLeft}>
          <Text style={[s.cardAmount, { color: colors.text.primary }]}>{req.diamonds_amount} 💎</Text>
          <Text style={[s.cardEur, { color: colors.text.muted }]}>≈ {req.euro_amount}€</Text>
        </View>
        <View style={s.cardMidRight}>
          {req.iban
            ? <><CreditCard size={12} color={colors.text.muted} strokeWidth={2} /><Text style={[s.cardMeta, { color: colors.text.muted }]}>{req.iban.slice(0, 12)}…</Text></>
            : <><Mail size={12} color={colors.text.muted} strokeWidth={2} /><Text style={[s.cardMeta, { color: colors.text.muted }]}>{req.paypal_email}</Text></>
          }
        </View>
      </View>

      {/* Notizen */}
      {req.note       && <Text style={[s.cardNote, { color: colors.text.muted }]}>{`"${req.note}"`}</Text>}
      {req.admin_note && <Text style={[s.cardNote, { color: '#EF4444' }]}>Admin: {req.admin_note}</Text>}

      {/* Aktionen */}
      {isPending && (
        <View style={s.actionRow}>
          {req.status === 'pending' && (
            <Pressable
              style={[s.actionBtn, { borderColor: colors.border.strong }]}
              onPress={() => onStatusChange(req, 'processing')}
              disabled={updating}
            >
              <Text style={[s.actionBtnText, { color: colors.text.secondary }]}>In Bearbeitung</Text>
            </Pressable>
          )}
          <Pressable
            style={[s.actionBtn, { backgroundColor: colors.text.primary, borderColor: colors.text.primary }]}
            onPress={() => onStatusChange(req, 'paid')}
            disabled={updating}
          >
            <CheckCircle2 size={13} color={colors.bg.primary} strokeWidth={2} />
            <Text style={[s.actionBtnText, { color: colors.bg.primary }]}>Bezahlt</Text>
          </Pressable>
          <Pressable
            style={[s.actionBtn, { borderColor: 'rgba(239,68,68,0.3)' }]}
            onPress={() => onStatusChange(req, 'rejected')}
            disabled={updating}
          >
            <XCircle size={13} color="#EF4444" strokeWidth={2} />
            <Text style={[s.actionBtnText, { color: '#EF4444' }]}>Ablehnen</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Balances Tab ─────────────────────────────────────────────────────────────

function BalancesTab({ sellers, colors, insets, refetch }: any) {
  const total = sellers.reduce((sum: number, s: any) => sum + s.diamond_balance, 0);
  return (
    <FlatList
      data={sellers}
      keyExtractor={(s: any) => s.seller_id}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 8 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
      ListHeaderComponent={() => (
        <View style={[s.balHeader, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <Text style={[s.balHeaderLabel, { color: colors.text.muted }]}>GESAMT-AUSSTEHEND</Text>
          <Text style={[s.balHeaderValue, { color: colors.text.primary }]}>
            {total.toLocaleString('de-DE')} 💎
          </Text>
        </View>
      )}
      renderItem={({ item: sel }: any) => (
        <View style={[s.balRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardName, { color: colors.text.primary }]}>@{sel.username}</Text>
            <Text style={[s.cardSub, { color: colors.text.muted }]}>
              {sel.total_earned} Coins · {sel.pending_orders} offen
            </Text>
          </View>
          <Text style={[s.cardAmount, { color: colors.text.primary }]}>{sel.diamond_balance} 💎</Text>
        </View>
      )}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  pendingBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  pendingBadgeText: { fontSize: 11, fontWeight: '800' },

  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabLabel: { fontSize: 13, fontWeight: '700' },

  filterWrap: { height: 52 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  filterChipText: { fontSize: 12, fontWeight: '700' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 4,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, marginTop: 40 },
  emptyText: { fontSize: 13 },

  // Card
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cardAvatar: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 14, fontWeight: '800' },
  cardSub: { fontSize: 11, marginTop: 1 },
  statusPill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },

  cardMid: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, marginBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardMidLeft: { flex: 1 },
  cardMidRight: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '45%' },
  cardAmount: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  cardEur: { fontSize: 11, marginTop: 2 },
  cardMeta: { fontSize: 11, fontWeight: '500' },
  cardNote: { fontSize: 12, lineHeight: 18, marginBottom: 10, fontStyle: 'italic' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderRadius: 10, borderWidth: 1, paddingVertical: 9,
  },
  actionBtnText: { fontSize: 12, fontWeight: '700' },

  // Balances
  balHeader: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 6 },
  balHeaderLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  balHeaderValue: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  balRow: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, flexDirection: 'row', alignItems: 'center' },
});
