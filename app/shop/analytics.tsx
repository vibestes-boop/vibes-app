/**
 * app/shop/analytics.tsx — Verkäufer: Shop-Statistik
 *
 * Parität mit Web /studio/shop/analytics: Gesamt-Kacheln (€-Umsatz, Coin-
 * Einnahmen, Verkäufe) + pro-Produkt-Liste. Daten via useShopAnalytics
 * (Frontend-Aggregation, seller-scoped). Kein Schreibzugriff, reine Anzeige.
 */
import { CoinIcon } from '@/components/ui/CoinIcon';
import { formatEur, useShopAnalytics } from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, BarChart3, Package } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ShopAnalyticsScreen() {
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data, isLoading } = useShopAnalytics();

  const rows = data?.rows ?? [];

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.headerBtn}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>Shop-Statistik</Text>
        <View style={s.headerBtn} />
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.text.primary} /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.product_id}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }}
          ListHeaderComponent={
            <View style={s.summaryRow}>
              <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
                <Text style={[s.cardValue, { color: colors.text.primary }]}>
                  {formatEur(data?.totalRevenueEur ?? 0) ?? '0 €'}
                </Text>
                <Text style={[s.cardLabel, { color: colors.text.muted }]}>Echtgeld-Umsatz</Text>
              </View>
              <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
                <View style={s.coinRow}>
                  <CoinIcon size={15} />
                  <Text style={[s.cardValue, { color: colors.text.primary }]}>
                    {(data?.totalRevenueCoins ?? 0).toLocaleString('de-DE')}
                  </Text>
                </View>
                <Text style={[s.cardLabel, { color: colors.text.muted }]}>Coin-Einnahmen</Text>
              </View>
              <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
                <Text style={[s.cardValue, { color: colors.text.primary }]}>{data?.totalSold ?? 0}</Text>
                <Text style={[s.cardLabel, { color: colors.text.muted }]}>Verkäufe</Text>
              </View>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/shop/${item.product_id}` as any)}
              style={[s.row, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
            >
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={s.thumb} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[s.thumb, s.thumbFallback, { backgroundColor: colors.bg.elevated }]}>
                  <Package size={18} color={colors.text.muted} strokeWidth={1.6} />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.rowTitle, { color: colors.text.primary }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[s.rowSub, { color: colors.text.muted }]}>
                  {item.sold_count}× verkauft
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                {item.revenue_eur > 0 && (
                  <Text style={[s.rowMoney, { color: colors.text.primary }]}>{formatEur(item.revenue_eur)}</Text>
                )}
                {item.revenue_coins > 0 && (
                  <View style={s.coinRow}>
                    <CoinIcon size={12} />
                    <Text style={[s.rowCoins, { color: colors.text.muted }]}>{item.revenue_coins.toLocaleString('de-DE')}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <BarChart3 size={40} color={colors.icon.muted} strokeWidth={1.6} />
              <Text style={[s.emptyTitle, { color: colors.text.primary }]}>Noch keine Daten</Text>
              <Text style={[s.emptySub, { color: colors.text.muted }]}>
                Sobald du Produkte verkaufst, siehst du hier Umsatz und Verkäufe.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },

  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 4, alignItems: 'flex-start' },
  cardValue: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  cardLabel: { fontSize: 11.5, fontWeight: '600' },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12 },
  thumb: { width: 46, height: 46, borderRadius: 10 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 12, fontWeight: '500' },
  rowMoney: { fontSize: 14, fontWeight: '800' },
  rowCoins: { fontSize: 12, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 70, alignItems: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
});
