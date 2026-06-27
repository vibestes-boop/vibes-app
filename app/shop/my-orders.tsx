/**
 * app/shop/my-orders.tsx — Käufer: Echtgeld-Bestellungen (physische Ware / Parfüm)
 *
 * Der Wiederkehr-Hook: Status + Tracking live sehen, bezahlen, Empfang bestätigen.
 * Getrennt vom coin-/digital-Order-System (app/shop/orders.tsx).
 */
import {
  formatEur,
  useConfirmOrderDelivered,
  useMyProductOrders,
  usePayProductOrder,
  type ProductOrder,
  type ProductOrderStatus,
} from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
ArrowLeft,
CheckCircle2,
Clock,
CreditCard,
Package,
ShoppingBag,
Store,
Truck,
} from 'lucide-react-native';
import {
ActivityIndicator,
Alert,
FlatList,
Pressable,
RefreshControl,
StyleSheet,
Text,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const STATUS: Record<ProductOrderStatus, { label: string; color: string }> = {
  reserved:          { label: 'Vorgemerkt',   color: '#9CA3AF' },
  payment_requested: { label: 'Zahlung offen', color: '#F59E0B' },
  paid:              { label: 'Bezahlt',       color: '#3B82F6' },
  shipped:           { label: 'Unterwegs',     color: '#14B8A6' },
  delivered:         { label: 'Geliefert',     color: '#22C55E' },
  cancelled:         { label: 'Storniert',     color: '#EF4444' },
  refunded:          { label: 'Erstattet',     color: '#8B5CF6' },
  disputed:          { label: 'In Klärung',    color: '#EF4444' },
};

export default function MyOrdersScreen() {
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { data: orders = [], isLoading, refetch, isRefetching } = useMyProductOrders();
  const { pay, isPaying } = usePayProductOrder();
  const confirmDelivered = useConfirmOrderDelivered();

  const handlePay = async (o: ProductOrder) => {
    const res = await pay(o.id);
    if (res.error) {
      Alert.alert('Hoppla', 'Die Bezahlung konnte gerade nicht geöffnet werden — gleich nochmal? 🙏');
    }
    // Bei Erfolg öffnet sich Stripe im Browser; nach Rückkehr aktualisiert die Liste.
  };

  const handleConfirm = (o: ProductOrder) => {
    Alert.alert(
      'Erhalten?',
      'Bestätige, dass dein Paket angekommen ist.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Ja, erhalten ✓',
          onPress: () => confirmDelivered.mutate(o.id, {
            onError: () => Alert.alert('Hoppla', 'Hat nicht geklappt — gleich nochmal?'),
          }),
        },
      ],
    );
  };

  const renderItem = ({ item: o }: { item: ProductOrder }) => {
    const st = STATUS[o.status] ?? STATUS.reserved;
    const cover = o.product?.cover_url ?? null;
    return (
      <View style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
        <Pressable
          style={s.cardTop}
          onPress={() => o.product?.id && router.push(`/shop/${o.product.id}` as any)}
          disabled={!o.product?.id}
        >
          {cover ? (
            <Image source={{ uri: cover }} style={s.cover} contentFit="cover" cachePolicy="memory-disk" />
          ) : (
            <View style={[s.cover, { backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center' }]}>
              <ShoppingBag size={22} color={colors.text.muted} strokeWidth={1.5} />
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[s.title, { color: colors.text.primary }]} numberOfLines={2}>
              {o.product?.title ?? 'Produkt'}
            </Text>
            <Text style={[s.amount, { color: colors.text.primary }]}>
              {formatEur(o.amount_eur) ?? '—'}{o.quantity > 1 ? `  ·  ${o.quantity}×` : ''}
            </Text>
            <View style={[s.badge, { backgroundColor: st.color + '22' }]}>
              <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
            </View>
            <Text style={[s.dateText, { color: colors.text.muted }]}>{fmtDateTime(o.created_at)}</Text>
          </View>
        </Pressable>

        {/* Zahlung offen → bezahlen */}
        {o.status === 'payment_requested' && (
          <Pressable
            onPress={() => handlePay(o)}
            disabled={isPaying}
            style={[s.payBtn, { backgroundColor: colors.text.primary, opacity: isPaying ? 0.6 : 1 }]}
          >
            {isPaying
              ? <ActivityIndicator size="small" color={colors.bg.primary} />
              : <CreditCard size={16} color={colors.bg.primary} strokeWidth={2.4} />}
            <Text style={[s.payBtnText, { color: colors.bg.primary }]}>Jetzt bezahlen</Text>
          </Pressable>
        )}

        {/* Unterwegs → Tracking + Empfang bestätigen */}
        {o.status === 'shipped' && (
          <>
            {(o.tracking_carrier || o.tracking_number) && (
              <View style={s.trackRow}>
                <Truck size={14} color={colors.text.muted} strokeWidth={2} />
                <Text style={[s.trackText, { color: colors.text.muted }]} numberOfLines={1}>
                  {[o.tracking_carrier, o.tracking_number].filter(Boolean).join(' · ')}
                </Text>
              </View>
            )}
            <Pressable
              onPress={() => handleConfirm(o)}
              style={[s.confirmBtn, { borderColor: colors.border.subtle }]}
            >
              <CheckCircle2 size={16} color="#22C55E" strokeWidth={2.4} />
              <Text style={[s.confirmText, { color: colors.text.primary }]}>Erhalten</Text>
            </Pressable>
          </>
        )}

        {o.status === 'delivered' && (
          <View style={s.deliveredRow}>
            <CheckCircle2 size={14} color="#22C55E" strokeWidth={2.4} />
            <Text style={[s.deliveredText, { color: '#22C55E' }]}>Geliefert — viel Freude 🌸</Text>
          </View>
        )}

        {o.status === 'paid' && (
          <View style={s.trackRow}>
            <Clock size={14} color={colors.text.muted} strokeWidth={2} />
            <Text style={[s.trackText, { color: colors.text.muted }]}>Bezahlt — wird vorbereitet 📦</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.headerBtn}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>Meine Bestellungen</Text>
        <Pressable onPress={() => router.push('/shop/fulfillment' as any)} hitSlop={10} style={s.headerBtn}>
          <Store size={20} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.text.primary} /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40, gap: 12 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.text.muted} />}
          ListEmptyComponent={
            <View style={s.center}>
              <Package size={44} color={colors.text.muted} strokeWidth={1.3} />
              <Text style={[s.emptyText, { color: colors.text.muted }]}>
                Noch keine Bestellungen — sobald du etwas vormerkst, erscheint es hier. 🌸
              </Text>
            </View>
          }
          ListFooterComponent={
            <Pressable onPress={() => router.push('/shop/orders' as any)} style={s.footerLink} hitSlop={6}>
              <Text style={[s.footerLinkText, { color: colors.text.muted }]}>Digitale Käufe ansehen →</Text>
            </Pressable>
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

  card: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  cardTop: { flexDirection: 'row', gap: 12 },
  cover: { width: 64, height: 64, borderRadius: 12 },
  title: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  amount: { fontSize: 15, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  dateText: { fontSize: 11, fontWeight: '500', marginTop: 1 },

  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 44, borderRadius: 12,
  },
  payBtnText: { fontSize: 14, fontWeight: '700' },

  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackText: { fontSize: 12, fontWeight: '500', flex: 1 },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 42, borderRadius: 12, borderWidth: 1,
  },
  confirmText: { fontSize: 14, fontWeight: '700' },

  deliveredRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveredText: { fontSize: 13, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40, paddingTop: 80 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  footerLink: { alignItems: 'center', paddingVertical: 18 },
  footerLinkText: { fontSize: 13, fontWeight: '600' },
});
