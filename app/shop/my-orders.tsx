/**
 * app/shop/my-orders.tsx — Käufer: Echtgeld-Bestellungen (physische Ware / Parfüm)
 *
 * Der Wiederkehr-Hook: Status + Tracking live sehen, bezahlen, Empfang bestätigen.
 * Getrennt vom coin-/digital-Order-System (app/shop/orders.tsx).
 */
import {
  formatEur,
  useCancelProductOrder,
  useConfirmOrderDelivered,
  useMyProductOrders,
  usePayProductOrder,
  useUpdateOrderShippingAddress,
  type ProductOrder,
  type ProductOrderStatus,
} from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useAuthStore } from '@/lib/authStore';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
ArrowLeft,
Check,
CheckCircle2,
Clock,
Copy,
CreditCard,
ExternalLink,
MapPin,
MessageCircle,
Package,
ShoppingBag,
Store,
Truck,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { trackingUrl } from '@/lib/tracking';
import { useState } from 'react';
import { useOrCreateConversation } from '@/lib/useMessages';
import { OrderReviewControl } from '@/components/shop/OrderReviewControl';
import { OrderDisputeControl } from '@/components/shop/OrderDisputeControl';
import {
ActivityIndicator,
Alert,
FlatList,
Linking,
Modal,
Pressable,
RefreshControl,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// Sendungsverfolgung — „Sendung verfolgen"-Chip (Carrier-Deeplink) + Kopier-Chip.
function TrackingRow({ carrier, number, colors }: { carrier: string | null; number: string | null; colors: any }) {
  const [copied, setCopied] = useState(false);
  if (!carrier && !number) return null;
  const url = number ? trackingUrl(carrier, number) : null;
  const copy = async () => {
    if (!number) return;
    await Clipboard.setStringAsync(number);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
      {url ? (
        <Pressable onPress={() => Linking.openURL(url)} style={[s.trackChip, { borderColor: '#14B8A6', backgroundColor: 'rgba(20,184,166,0.10)' }]}>
          <Truck size={13} color="#0F766E" strokeWidth={2.2} />
          <Text style={{ color: '#0F766E', fontSize: 12, fontWeight: '600' }}>
            Sendung verfolgen{carrier ? ` · ${carrier}` : ''}
          </Text>
          <ExternalLink size={11} color="#0F766E" strokeWidth={2.2} />
        </Pressable>
      ) : (
        <View style={[s.trackChip, { borderColor: colors.border.subtle }]}>
          <Truck size={13} color={colors.text.muted} strokeWidth={2.2} />
          <Text style={{ color: colors.text.muted, fontSize: 12 }}>{[carrier, number].filter(Boolean).join(' · ')}</Text>
        </View>
      )}
      {number && (
        <Pressable onPress={copy} style={[s.trackChip, { borderColor: colors.border.subtle }]}>
          {copied
            ? <Check size={13} color="#22C55E" strokeWidth={2.6} />
            : <Copy size={13} color={colors.text.muted} strokeWidth={2.2} />}
          <Text style={{ color: colors.text.muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>{number}</Text>
        </Pressable>
      )}
    </View>
  );
}

const STATUS: Record<ProductOrderStatus, { labelKey: TranslationKey; color: string }> = {
  reserved:          { labelKey: 'orders.stPreordered', color: '#9CA3AF' },
  payment_requested: { labelKey: 'orders.stPaymentDue', color: '#F59E0B' },
  paid:              { labelKey: 'orders.stPaid',       color: '#3B82F6' },
  shipped:           { labelKey: 'orders.stShipped',    color: '#14B8A6' },
  delivered:         { labelKey: 'orders.stDelivered',  color: '#22C55E' },
  cancelled:         { labelKey: 'orders.stCancelled',  color: '#EF4444' },
  refunded:          { labelKey: 'orders.stRefunded',   color: '#8B5CF6' },
  disputed:          { labelKey: 'orders.stDisputed',   color: '#EF4444' },
};

export default function MyOrdersScreen() {
  const { t } = useI18n();
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  // Verkäufer-/Vorbestell-Verwaltung (fulfillment) ist eine reine Admin-Funktion
  // (Sammelbestell-Aktion, z.B. Parfüm). Normale Käufer sehen die Verkaufs-
  // Einstiege nicht — diese Seite bleibt für sie reine Käufer-Ansicht.
  const isAdmin = useAuthStore((st) => st.profile?.is_admin) ?? false;
  const { data: orders = [], isLoading, refetch, isRefetching } = useMyProductOrders();
  const { pay, isPaying } = usePayProductOrder();
  const confirmDelivered = useConfirmOrderDelivered();
  const cancelOrder = useCancelProductOrder();
  const { update: updateAddr, isWorking: isSavingAddr } = useUpdateOrderShippingAddress();
  const orCreate = useOrCreateConversation();

  const handleMessage = async (o: ProductOrder) => {
    try {
      const convId = await orCreate.mutateAsync(o.seller_id);
      router.push({ pathname: '/messages/[id]', params: { id: convId } } as any);
    } catch {
      Alert.alert(t('orders.oops'), t('orders.chatFailed'));
    }
  };

  const [addrOrder, setAddrOrder] = useState<ProductOrder | null>(null);
  const [form, setForm] = useState({ name: '', street: '', zip: '', city: '', country: 'DE' });

  const handlePay = async (o: ProductOrder) => {
    const res = await pay(o.id);
    if (res.error) {
      Alert.alert(t('orders.oops'), t('orders.payFailed'));
    }
    // Bei Erfolg öffnet sich Stripe im Browser; nach Rückkehr aktualisiert die Liste.
  };

  const handleCancel = (o: ProductOrder) => {
    Alert.alert(
      t('orders.cancelTitle'),
      t('orders.cancelText'),
      [
        { text: t('orders.keep'), style: 'cancel' },
        {
          text: t('orders.cancelOrder'), style: 'destructive',
          onPress: () => cancelOrder.mutate(o.id, {
            onError: () => Alert.alert(t('orders.oops'), t('orders.retry')),
          }),
        },
      ],
    );
  };

  const openAddr = (o: ProductOrder) => {
    setForm({
      name: o.ship_name ?? '', street: o.ship_street ?? '', zip: o.ship_zip ?? '',
      city: o.ship_city ?? '', country: o.ship_country ?? 'DE',
    });
    setAddrOrder(o);
  };

  const saveAddr = async () => {
    if (!addrOrder) return;
    const res = await updateAddr(addrOrder.id, form);
    if (res.error) {
      Alert.alert(t('orders.oops'), res.error === 'incomplete_address'
        ? t('orders.addressIncomplete')
        : t('orders.retry'));
      return;
    }
    setAddrOrder(null);
  };

  const addrText = (o: ProductOrder) =>
    [o.ship_name, o.ship_street, [o.ship_zip, o.ship_city].filter(Boolean).join(' '), o.ship_country]
      .filter(Boolean).join('\n');

  const handleConfirm = (o: ProductOrder) => {
    Alert.alert(
      t('orders.receivedTitle'),
      t('orders.receivedText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('orders.yesReceived'),
          onPress: () => confirmDelivered.mutate(o.id, {
            onError: () => Alert.alert(t('orders.oops'), t('orders.retry')),
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
              {o.product?.title ?? t('orders.product')}
            </Text>
            <Text style={[s.amount, { color: colors.text.primary }]}>
              {formatEur(o.amount_eur) ?? '—'}{o.quantity > 1 ? `  ·  ${o.quantity}×` : ''}
            </Text>
            <View style={[s.badge, { backgroundColor: st.color + '22' }]}>
              <Text style={[s.badgeText, { color: st.color }]}>{t(st.labelKey)}</Text>
            </View>
            <Text style={[s.dateText, { color: colors.text.muted }]}>{fmtDateTime(o.created_at)}</Text>
          </View>
        </Pressable>

        {/* Zahlung offen → bezahlen oder doch absagen */}
        {o.status === 'payment_requested' && (
          <View style={s.actionRow}>
            <Pressable
              onPress={() => handleCancel(o)}
              style={[s.cancelBtn, { borderColor: colors.border.subtle }]}
            >
              <Text style={[s.cancelText, { color: colors.text.muted }]}>{t('orders.notNow')}</Text>
            </Pressable>
            <Pressable
              onPress={() => handlePay(o)}
              disabled={isPaying}
              style={[s.payBtn, { flex: 1, backgroundColor: colors.text.primary, opacity: isPaying ? 0.6 : 1 }]}
            >
              {isPaying
                ? <ActivityIndicator size="small" color={colors.bg.primary} />
                : <CreditCard size={16} color={colors.bg.primary} strokeWidth={2.4} />}
              <Text style={[s.payBtnText, { color: colors.bg.primary }]}>{t('orders.payNow')}</Text>
            </Pressable>
          </View>
        )}

        {/* Unterwegs → Tracking + Empfang bestätigen */}
        {o.status === 'shipped' && (
          <>
            {(o.tracking_carrier || o.tracking_number) && (
              <TrackingRow carrier={o.tracking_carrier} number={o.tracking_number} colors={colors} />
            )}
            <Pressable
              onPress={() => handleConfirm(o)}
              style={[s.confirmBtn, { borderColor: colors.border.subtle }]}
            >
              <CheckCircle2 size={16} color="#22C55E" strokeWidth={2.4} />
              <Text style={[s.confirmText, { color: colors.text.primary }]}>{t('orders.received')}</Text>
            </Pressable>
          </>
        )}

        {o.status === 'delivered' && (
          <>
            <View style={s.deliveredRow}>
              <CheckCircle2 size={14} color="#22C55E" strokeWidth={2.4} />
              <Text style={[s.deliveredText, { color: '#22C55E' }]}>{t('orders.deliveredJoy')}</Text>
            </View>
            <OrderReviewControl
              orderId={o.id}
              role="buyer"
              myReview={o.my_review}
              receivedReview={o.received_review}
            />
          </>
        )}

        {o.status === 'paid' && (
          <>
            <View style={s.trackRow}>
              <Clock size={14} color={colors.text.muted} strokeWidth={2} />
              <Text style={[s.trackText, { color: colors.text.muted }]}>{t('orders.paidPreparing')}</Text>
            </View>
            <View style={[s.addrBox, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={s.addrLabelRow}>
                  <MapPin size={12} color={colors.text.muted} strokeWidth={2} />
                  <Text style={[s.addrLabel, { color: colors.text.muted }]}>{t('orders.shippingAddress')}</Text>
                </View>
                <Text style={[s.addrVal, { color: colors.text.secondary }]}>
                  {addrText(o) || t('orders.noAddress')}
                </Text>
              </View>
              <Pressable onPress={() => openAddr(o)} hitSlop={8}>
                <Text style={[s.addrEdit, { color: colors.text.primary }]}>{t('orders.change')}</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Direktkontakt zum Verkäufer (Rückfragen, Probleme) */}
        <Pressable onPress={() => handleMessage(o)} style={s.msgRow} hitSlop={6}>
          <MessageCircle size={14} color={colors.text.muted} strokeWidth={2} />
          <Text style={[s.msgText, { color: colors.text.muted }]}>{t('orders.messageSeller')}</Text>
        </Pressable>

        {/* Problem melden / Streit-Status (ab Bezahlung) */}
        {(o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered') && (
          <OrderDisputeControl orderId={o.id} role="buyer" dispute={o.dispute} />
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
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>{t('orders.myOrders')}</Text>
        {isAdmin ? (
          <Pressable onPress={() => router.push('/shop/fulfillment' as any)} hitSlop={10} style={s.headerBtn}>
            <Store size={20} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={s.headerBtn} />
        )}
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
          ListHeaderComponent={
            isAdmin ? (
              <Pressable
                onPress={() => router.push('/shop/fulfillment' as any)}
                style={[s.sellLink, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              >
                <Store size={16} color={colors.text.primary} strokeWidth={2.2} />
                <Text style={[s.sellLinkText, { color: colors.text.primary, flex: 1 }]}>{t('orders.manageSales')}</Text>
                <Text style={[s.sellLinkText, { color: colors.text.muted }]}>→</Text>
              </Pressable>
            ) : null
          }
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
              <Text style={[s.footerLinkText, { color: colors.text.muted }]}>{t('orders.viewDigital')}</Text>
            </Pressable>
          }
        />
      )}

      {/* Adresse ändern (nur bezahlt, noch nicht versendet) */}
      <Modal transparent visible={!!addrOrder} animationType="fade" onRequestClose={() => setAddrOrder(null)}>
        <Pressable style={s.backdrop} onPress={() => setAddrOrder(null)}>
          <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated, paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: colors.text.primary }]}>{t('orders.editAddress')}</Text>
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder={t('orders.fieldName')} placeholderTextColor={colors.text.muted}
              value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder={t('orders.fieldStreet')} placeholderTextColor={colors.text.muted}
              value={form.street} onChangeText={(v) => setForm((f) => ({ ...f, street: v }))}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[s.input, { flex: 1, color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
                placeholder={t('orders.fieldZip')} placeholderTextColor={colors.text.muted} keyboardType="number-pad"
                value={form.zip} onChangeText={(v) => setForm((f) => ({ ...f, zip: v }))}
              />
              <TextInput
                style={[s.input, { flex: 2, color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
                placeholder={t('orders.fieldCity')} placeholderTextColor={colors.text.muted}
                value={form.city} onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
              />
            </View>
            <View style={s.countryRow}>
              {(['DE', 'AT', 'CH'] as const).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setForm((f) => ({ ...f, country: c }))}
                  style={[s.countryChip, { borderColor: colors.border.subtle, backgroundColor: form.country === c ? colors.text.primary : 'transparent' }]}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: form.country === c ? colors.bg.primary : colors.text.muted }}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={saveAddr}
              disabled={isSavingAddr}
              style={[s.payBtn, { backgroundColor: colors.text.primary, opacity: isSavingAddr ? 0.6 : 1, marginTop: 4 }]}
            >
              {isSavingAddr
                ? <ActivityIndicator size="small" color={colors.bg.primary} />
                : <Text style={[s.payBtnText, { color: colors.bg.primary }]}>{t('orders.save')}</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelBtn: {
    alignItems: 'center', justifyContent: 'center',
    height: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1,
  },
  cancelText: { fontSize: 14, fontWeight: '600' },

  addrBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 10,
  },
  addrLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addrLabel: { fontSize: 11, fontWeight: '700' },
  addrVal: { fontSize: 12.5, fontWeight: '500', lineHeight: 18 },
  addrEdit: { fontSize: 13, fontWeight: '700' },

  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackText: { fontSize: 12, fontWeight: '500', flex: 1 },
  trackChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 42, borderRadius: 12, borderWidth: 1,
  },
  confirmText: { fontSize: 14, fontWeight: '700' },

  deliveredRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveredText: { fontSize: 13, fontWeight: '600' },

  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  msgText: { fontSize: 12.5, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40, paddingTop: 80 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  footerLink: { alignItems: 'center', paddingVertical: 18 },
  footerLinkText: { fontSize: 13, fontWeight: '600' },
  sellLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12,
    borderRadius: 14, borderWidth: 1,
  },
  sellLinkText: { fontSize: 14, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 10, gap: 10 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 46, fontSize: 14 },
  countryRow: { flexDirection: 'row', gap: 8 },
  countryChip: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 10, borderWidth: 1 },
});
