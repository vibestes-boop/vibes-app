/**
 * app/shop/orders.tsx
 * Meine Bestellungen — Käufer-Ansicht + Verkäufer-Ansicht
 * Theme-aware (Dark/Light), Marken-CoinIcon, gepolierte Cards.
 */
import { ProductCoverImage } from '@/components/shop/ProductCoverImage';
import { ReviewSheet } from '@/components/shop/ReviewSheet';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { useI18n } from '@/lib/i18n';
import { useMyReview } from '@/lib/useProductReviews';
import { useTheme } from '@/lib/useTheme';
import { useDownloadDigitalProduct,useMyOrders,type Order } from '@/lib/useShop';
import { router } from 'expo-router';
import {
ArrowLeft,
CheckCircle2,
Clock,
Download,
FileText,
RefreshCw,
ShoppingBag,
Star,
Store,
XCircle,
} from 'lucide-react-native';
import { useState } from 'react';
import {
ActivityIndicator,Alert,
FlatList,Pressable,
StyleSheet,
Text,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

// ─── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { label: 'Ausstehend',    color: '#F59E0B', icon: Clock },
  completed: { label: 'Abgeschlossen', color: '#22C55E', icon: CheckCircle2 },
  cancelled: { label: 'Storniert',     color: '#EF4444', icon: XCircle },
  refunded:  { label: 'Erstattet',     color: '#8B5CF6', icon: RefreshCw },
};

function StatusBadge({ status }: { status: Order['status'] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <View style={[sx.badge, { backgroundColor: cfg.color + '1F' }]}>
      <Icon size={11} color={cfg.color} strokeWidth={2.4} />
      <Text style={[sx.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Kategorie-Label ──────────────────────────────────────────────────────────
const CAT_LABELS: Record<string, string> = {
  digital: 'Digital',
  physical: 'Physisch',
  service: 'Service',
  collectible: 'Collectible',
  preset: 'Preset',
  video: 'Video',
};

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, role, colors }: { order: Order; role: 'buyer' | 'seller'; colors: ThemeColors }) {
  const { t } = useI18n();
  const { download, isLoading } = useDownloadDigitalProduct();
  const [reviewOpen, setReviewOpen] = useState(false);
  const product = order.product as any;
  const isDigital = product?.category === 'digital' || product?.category === 'preset' || product?.category === 'video';
  const canDownload = role === 'buyer' && isDigital && order.status === 'completed';
  const canReview  = role === 'buyer' && order.status === 'completed';
  const { data: myReview } = useMyReview(canReview ? product?.id ?? null : null);

  const handleDownload = async () => {
    const result = await download(order.id);
    if (result.error) {
      Alert.alert(t('common.error'), t('orders.downloadFailedText'));
    }
  };

  const formattedDate = new Date(order.created_at).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <View style={[sx.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
      <ProductCoverImage uri={product?.cover_url} category={product?.category} style={sx.cover} />

      <View style={sx.info}>
        <View style={sx.infoTop}>
          <Text style={[sx.productTitle, { color: colors.text.primary }]} numberOfLines={2}>
            {product?.title ?? 'Unbekanntes Produkt'}
          </Text>
          <StatusBadge status={order.status} />
        </View>

        <View style={sx.metaRow}>
          <Text style={[sx.metaCat, { color: colors.text.secondary }]}>
            {CAT_LABELS[product?.category ?? ''] ?? 'Produkt'}
          </Text>
          <View style={[sx.metaDot, { backgroundColor: colors.text.muted }]} />
          <Text style={[sx.metaDate, { color: colors.text.muted }]}>{formattedDate}</Text>
        </View>

        <View style={sx.priceRow}>
          <CoinIcon size={15} />
          <Text style={[sx.price, { color: colors.text.primary }]}>{order.total_coins.toLocaleString()}</Text>
          {order.quantity > 1 && (
            <Text style={[sx.qty, { color: colors.text.muted }]}>× {order.quantity}</Text>
          )}
        </View>

        {/* Aktions-Buttons */}
        {(canDownload || canReview) && (
          <View style={sx.actionRow}>
            {canDownload && (
              <Pressable
                style={({ pressed }) => [sx.primaryBtn, { backgroundColor: colors.accent.secondary }, pressed && { opacity: 0.8 }]}
                onPress={handleDownload}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator size={13} color={colors.text.inverse} />
                  : <Download size={13} color={colors.text.inverse} strokeWidth={2.2} />
                }
                <Text style={[sx.primaryBtnText, { color: colors.text.inverse }]}>Herunterladen</Text>
              </Pressable>
            )}

            {canReview && (
              <Pressable
                style={({ pressed }) => [sx.ghostBtn, { backgroundColor: colors.bg.subtle, borderColor: colors.border.subtle }, pressed && { opacity: 0.75 }]}
                onPress={() => setReviewOpen(true)}
              >
                <Star
                  size={13}
                  color={myReview ? colors.accent.gold : colors.text.secondary}
                  fill={myReview ? colors.accent.gold : 'transparent'}
                  strokeWidth={1.8}
                />
                <Text style={[sx.ghostBtnText, { color: colors.text.secondary }]}>
                  {myReview ? `${'★'.repeat(myReview.rating)}` : 'Bewerten'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Liefernotiz */}
        {order.delivery_notes && (
          <View style={[sx.noteRow, { backgroundColor: colors.bg.subtle }]}>
            <FileText size={12} color={colors.text.muted} />
            <Text style={[sx.noteText, { color: colors.text.secondary }]} numberOfLines={2}>{order.delivery_notes}</Text>
          </View>
        )}
      </View>

      {canReview && (
        <ReviewSheet
          productId={product?.id ?? ''}
          orderId={order.id}
          productTitle={product?.title ?? ''}
          visible={reviewOpen}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ role, colors }: { role: 'buyer' | 'seller'; colors: ThemeColors }) {
  return (
    <View style={sx.empty}>
      <View style={[sx.emptyIconWrap, { backgroundColor: colors.bg.subtle }]}>
        {role === 'buyer'
          ? <ShoppingBag size={40} color={colors.text.muted} strokeWidth={1.6} />
          : <Store size={40} color={colors.text.muted} strokeWidth={1.6} />
        }
      </View>
      <Text style={[sx.emptyTitle, { color: colors.text.primary }]}>
        {role === 'buyer' ? 'Noch keine Käufe' : 'Noch keine Verkäufe'}
      </Text>
      <Text style={[sx.emptySub, { color: colors.text.secondary }]}>
        {role === 'buyer'
          ? 'Entdecke Produkte im Shop und hol dir was Schönes mit Coins. 🛍️'
          : 'Sobald jemand dein Produkt kauft, taucht es hier auf. 🎉'}
      </Text>
      <Pressable
        style={({ pressed }) => [sx.emptyBtn, { backgroundColor: colors.accent.secondary }, pressed && { opacity: 0.85 }]}
        onPress={() => (role === 'buyer' ? router.push('/(tabs)/shop' as any) : router.push('/shop/my-shop' as any))}
      >
        <Text style={[sx.emptyBtnText, { color: colors.text.inverse }]}>
          {role === 'buyer' ? 'Zum Shop' : 'Produkt erstellen'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrdersScreen() {
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const { data: orders = [], isLoading, refetch } = useMyOrders(role);

  const totalCoins = orders.reduce((s, o) => s + o.total_coins, 0);

  return (
    <View style={[sx.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[sx.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={sx.backBtn}>
          <ArrowLeft size={22} color={colors.text.primary} />
        </Pressable>
        <Text style={[sx.headerTitle, { color: colors.text.primary }]}>Meine Bestellungen</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Tab Switch (Segmented Control) */}
      <View style={[sx.tabs, { backgroundColor: colors.bg.subtle }]}>
        <Pressable
          style={[sx.tab, role === 'buyer' && [sx.tabActive, { backgroundColor: colors.bg.secondary }]]}
          onPress={() => setRole('buyer')}
        >
          <ShoppingBag size={15} color={role === 'buyer' ? colors.text.primary : colors.text.muted} strokeWidth={2} />
          <Text style={[sx.tabText, { color: role === 'buyer' ? colors.text.primary : colors.text.muted }]}>Käufe</Text>
        </Pressable>
        <Pressable
          style={[sx.tab, role === 'seller' && [sx.tabActive, { backgroundColor: colors.bg.secondary }]]}
          onPress={() => setRole('seller')}
        >
          <Store size={15} color={role === 'seller' ? colors.text.primary : colors.text.muted} strokeWidth={2} />
          <Text style={[sx.tabText, { color: role === 'seller' ? colors.text.primary : colors.text.muted }]}>Verkäufe</Text>
        </Pressable>
      </View>

      {/* Metrik-Karten */}
      {orders.length > 0 && (
        <View style={sx.metricsRow}>
          <View style={[sx.metricCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
            <Text style={[sx.metricNum, { color: colors.text.primary }]}>{orders.length}</Text>
            <Text style={[sx.metricLabel, { color: colors.text.secondary }]}>
              {role === 'buyer' ? (orders.length === 1 ? 'Kauf' : 'Käufe') : (orders.length === 1 ? 'Verkauf' : 'Verkäufe')}
            </Text>
          </View>
          <View style={[sx.metricCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
            <View style={sx.metricCoinRow}>
              <CoinIcon size={17} />
              <Text style={[sx.metricNum, { color: colors.text.primary }]}>{totalCoins.toLocaleString()}</Text>
            </View>
            <Text style={[sx.metricLabel, { color: colors.text.secondary }]}>
              {role === 'buyer' ? 'Ausgegeben' : 'Einnahmen'}
            </Text>
          </View>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={sx.loader}>
          <ActivityIndicator color={colors.accent.secondary} size="large" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OrderCard order={item} role={role} colors={colors} />}
          ListEmptyComponent={<EmptyState role={role} colors={colors} />}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onRefresh={refetch}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles (nur Struktur — Farben kommen aus dem Theme) ─────────────────────────
const sx = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    margin: 14,
    marginBottom: 8,
    borderRadius: 14,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 3,
  },
  metricCoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricNum: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Loading
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Card
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cover: {
    width: 96,
    height: '100%',
    minHeight: 96,
  },
  info: {
    flex: 1,
    padding: 12,
    gap: 6,
  },
  infoTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  productTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 19,
  },
  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Meta
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaCat: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
  metaDate: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  qty: {
    fontSize: 12.5,
    fontWeight: '500',
    marginLeft: 1,
  },
  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  primaryBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ghostBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  // Note
  noteRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    marginTop: 4,
    borderRadius: 10,
    padding: 9,
  },
  noteText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
    gap: 14,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 6,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
