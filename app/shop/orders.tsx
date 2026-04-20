/**
 * app/shop/orders.tsx
 * Meine Bestellungen — Käufer-Ansicht + Verkäufer-Ansicht
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Package, Download, ShoppingBag,
  Store, Clock, CheckCircle2, XCircle, RefreshCw,
  Coins, ChevronRight, FileText, Star,
} from 'lucide-react-native';
import { useMyOrders, useDownloadDigitalProduct, type Order } from '@/lib/useShop';
import { ReviewSheet } from '@/components/shop/ReviewSheet';
import { useMyReview } from '@/lib/useProductReviews';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Status Badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { label: 'Ausstehend',   color: '#F59E0B', icon: Clock },
  completed: { label: 'Abgeschlossen', color: '#22C55E', icon: CheckCircle2 },
  cancelled: { label: 'Storniert',    color: '#EF4444', icon: XCircle },
  refunded:  { label: 'Erstattet',    color: '#8B5CF6', icon: RefreshCw },
};

function StatusBadge({ status }: { status: Order['status'] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <View style={[sx.badge, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '55' }]}>
      <Icon size={11} color={cfg.color} />
      <Text style={[sx.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Kategorie-Label ──────────────────────────────────────────────────────────
const CAT_LABELS: Record<string, string> = {
  digital: '📁 Digital',
  physical: '📦 Physisch',
  service: '🛠️ Service',
  preset: '🎨 Preset',
  video: '🎬 Video',
};

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, role }: { order: Order; role: 'buyer' | 'seller' }) {
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
      Alert.alert('Download fehlgeschlagen', 'Bitte versuche es erneut.');
    }
  };

  const formattedDate = new Date(order.created_at).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <View style={sx.card}>
      {/* Cover */}
      {product?.cover_url ? (
        <Image
          source={{ uri: product.cover_url }}
          style={sx.cover}
          contentFit="cover"
        />
      ) : (
        <View style={[sx.cover, sx.coverFallback]}>
          <Package size={28} color="rgba(255,255,255,0.3)" />
        </View>
      )}

      {/* Info */}
      <View style={sx.info}>
        <View style={sx.infoTop}>
          <Text style={sx.productTitle} numberOfLines={2}>
            {product?.title ?? 'Unbekanntes Produkt'}
          </Text>
          <StatusBadge status={order.status} />
        </View>

        <View style={sx.metaRow}>
          <Text style={sx.metaCat}>{CAT_LABELS[product?.category ?? ''] ?? '📦 Produkt'}</Text>
          <Text style={sx.metaDot}>·</Text>
          <Text style={sx.metaDate}>{formattedDate}</Text>
        </View>

        <View style={sx.priceRow}>
          <Coins size={13} color="#F59E0B" />
          <Text style={sx.price}>{order.total_coins.toLocaleString()} Coins</Text>
          {order.quantity > 1 && (
            <Text style={sx.qty}>×{order.quantity}</Text>
          )}
        </View>

        {/* Download Button */}
        {canDownload && (
          <Pressable
            style={({ pressed }) => [sx.downloadBtn, pressed && { opacity: 0.7 }]}
            onPress={handleDownload}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator size={13} color="#fff" />
              : <Download size={13} color="#fff" />
            }
            <Text style={sx.downloadText}>Herunterladen</Text>
          </Pressable>
        )}

        {/* Bewertungs-Button */}
        {canReview && (
          <Pressable
            style={({ pressed }) => [sx.reviewBtn, pressed && { opacity: 0.75 }]}
            onPress={() => setReviewOpen(true)}
          >
            <Star
              size={13}
              color={myReview ? '#FFFFFF' : 'rgba(255,255,255,0.6)'}
              fill={myReview ? '#FFFFFF' : 'transparent'}
              strokeWidth={1.5}
            />
            <Text style={sx.reviewText}>
              {myReview ? `Deine Bewertung: ${'★'.repeat(myReview.rating)}` : 'Bewerten'}
            </Text>
          </Pressable>
        )}

        {/* Liefernotiz */}
        {order.delivery_notes && (
          <View style={sx.noteRow}>
            <FileText size={12} color="rgba(255,255,255,0.4)" />
            <Text style={sx.noteText} numberOfLines={2}>{order.delivery_notes}</Text>
          </View>
        )}
      </View>

      {/* Review Sheet */}
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
function EmptyState({ role }: { role: 'buyer' | 'seller' }) {
  return (
    <View style={sx.empty}>
      {role === 'buyer'
        ? <ShoppingBag size={56} color="rgba(255,255,255,0.15)" />
        : <Store size={56} color="rgba(255,255,255,0.15)" />
      }
      <Text style={sx.emptyTitle}>
        {role === 'buyer' ? 'Noch keine Käufe' : 'Noch keine Verkäufe'}
      </Text>
      <Text style={sx.emptySub}>
        {role === 'buyer'
          ? 'Entdecke Produkte im Shop und kaufe direkt mit Coins.'
          : 'Sobald jemand dein Produkt kauft, erscheint es hier.'}
      </Text>
      {role === 'buyer' && (
        <Pressable
          style={({ pressed }) => [sx.emptyBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
        >
          <Text style={sx.emptyBtnText}>Zurück</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const { data: orders = [], isLoading, refetch } = useMyOrders(role);

  return (
    <View style={sx.root}>
      {/* Header */}
      <View style={[sx.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={sx.backBtn}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text style={sx.headerTitle}>Meine Bestellungen</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Tab Switch */}
      <View style={sx.tabs}>
        <Pressable
          style={[sx.tab, role === 'buyer' && sx.tabActive]}
          onPress={() => setRole('buyer')}
        >
          <ShoppingBag size={15} color={role === 'buyer' ? '#fff' : 'rgba(255,255,255,0.4)'} />
          <Text style={[sx.tabText, role === 'buyer' && sx.tabTextActive]}>Käufe</Text>
        </Pressable>
        <Pressable
          style={[sx.tab, role === 'seller' && sx.tabActive]}
          onPress={() => setRole('seller')}
        >
          <Store size={15} color={role === 'seller' ? '#fff' : 'rgba(255,255,255,0.4)'} />
          <Text style={[sx.tabText, role === 'seller' && sx.tabTextActive]}>Verkäufe</Text>
        </Pressable>
      </View>

      {/* Stats Bar */}
      {orders.length > 0 && (
        <View style={sx.statsBar}>
          <Text style={sx.statsText}>
            {orders.length} {role === 'buyer' ? 'Kauf' : 'Verkauf'}{orders.length !== 1 ? role === 'buyer' ? 'käufe' : 'verkäufe' : ''}
          </Text>
          <Text style={sx.statsCoins}>
            {orders.reduce((s, o) => s + o.total_coins, 0).toLocaleString()} Coins gesamt
          </Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={sx.loader}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => <OrderCard order={item} role={role} />}
          ListEmptyComponent={<EmptyState role={role} />}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onRefresh={refetch}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sx = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    margin: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  // Stats
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  statsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  statsCoins: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  // Loading
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cover: {
    width: 90,
    height: 90,
  },
  coverFallback: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    padding: 12,
    gap: 5,
  },
  infoTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  productTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
    borderWidth: 1,
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
    gap: 4,
  },
  metaCat: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
  },
  metaDot: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
  },
  metaDate: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    color: '#F59E0B',
    fontSize: 13,
    fontWeight: '700',
  },
  qty: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginLeft: 2,
  },
  // Download
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1D9BF0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  downloadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Review
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  reviewText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  // Note
  noteRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'flex-start',
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    lineHeight: 15,
  },
  // Empty
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: '#EE1D52',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
