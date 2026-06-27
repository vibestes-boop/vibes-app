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
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
ArrowLeft,
CheckCircle2,
Clock,
CreditCard,
MapPin,
MessageCircle,
Package,
ShoppingBag,
Store,
Truck,
} from 'lucide-react-native';
import { useState } from 'react';
import { useOrCreateConversation } from '@/lib/useMessages';
import { OrderReviewControl } from '@/components/shop/OrderReviewControl';
import {
ActivityIndicator,
Alert,
FlatList,
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
  const cancelOrder = useCancelProductOrder();
  const { update: updateAddr, isWorking: isSavingAddr } = useUpdateOrderShippingAddress();
  const orCreate = useOrCreateConversation();

  const handleMessage = async (o: ProductOrder) => {
    try {
      const convId = await orCreate.mutateAsync(o.seller_id);
      router.push({ pathname: '/messages/[id]', params: { id: convId } } as any);
    } catch {
      Alert.alert('Hoppla', 'Chat konnte gerade nicht geöffnet werden — gleich nochmal?');
    }
  };

  const [addrOrder, setAddrOrder] = useState<ProductOrder | null>(null);
  const [form, setForm] = useState({ name: '', street: '', zip: '', city: '', country: 'DE' });

  const handlePay = async (o: ProductOrder) => {
    const res = await pay(o.id);
    if (res.error) {
      Alert.alert('Hoppla', 'Die Bezahlung konnte gerade nicht geöffnet werden — gleich nochmal? 🙏');
    }
    // Bei Erfolg öffnet sich Stripe im Browser; nach Rückkehr aktualisiert die Liste.
  };

  const handleCancel = (o: ProductOrder) => {
    Alert.alert(
      'Bestellung stornieren?',
      'Solange noch nicht bezahlt ist, kannst du jederzeit absagen.',
      [
        { text: 'Behalten', style: 'cancel' },
        {
          text: 'Stornieren', style: 'destructive',
          onPress: () => cancelOrder.mutate(o.id, {
            onError: () => Alert.alert('Hoppla', 'Hat nicht geklappt — gleich nochmal?'),
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
      Alert.alert('Hoppla', res.error === 'incomplete_address'
        ? 'Bitte Name, Straße, PLZ und Ort ausfüllen.'
        : 'Hat nicht geklappt — gleich nochmal?');
      return;
    }
    setAddrOrder(null);
  };

  const addrText = (o: ProductOrder) =>
    [o.ship_name, o.ship_street, [o.ship_zip, o.ship_city].filter(Boolean).join(' '), o.ship_country]
      .filter(Boolean).join('\n');

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

        {/* Zahlung offen → bezahlen oder doch absagen */}
        {o.status === 'payment_requested' && (
          <View style={s.actionRow}>
            <Pressable
              onPress={() => handleCancel(o)}
              style={[s.cancelBtn, { borderColor: colors.border.subtle }]}
            >
              <Text style={[s.cancelText, { color: colors.text.muted }]}>Doch nicht</Text>
            </Pressable>
            <Pressable
              onPress={() => handlePay(o)}
              disabled={isPaying}
              style={[s.payBtn, { flex: 1, backgroundColor: colors.text.primary, opacity: isPaying ? 0.6 : 1 }]}
            >
              {isPaying
                ? <ActivityIndicator size="small" color={colors.bg.primary} />
                : <CreditCard size={16} color={colors.bg.primary} strokeWidth={2.4} />}
              <Text style={[s.payBtnText, { color: colors.bg.primary }]}>Jetzt bezahlen</Text>
            </Pressable>
          </View>
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
          <>
            <View style={s.deliveredRow}>
              <CheckCircle2 size={14} color="#22C55E" strokeWidth={2.4} />
              <Text style={[s.deliveredText, { color: '#22C55E' }]}>Geliefert — viel Freude 🌸</Text>
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
              <Text style={[s.trackText, { color: colors.text.muted }]}>Bezahlt — wird vorbereitet 📦</Text>
            </View>
            <View style={[s.addrBox, { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={s.addrLabelRow}>
                  <MapPin size={12} color={colors.text.muted} strokeWidth={2} />
                  <Text style={[s.addrLabel, { color: colors.text.muted }]}>Lieferadresse</Text>
                </View>
                <Text style={[s.addrVal, { color: colors.text.secondary }]}>
                  {addrText(o) || 'Keine Adresse hinterlegt'}
                </Text>
              </View>
              <Pressable onPress={() => openAddr(o)} hitSlop={8}>
                <Text style={[s.addrEdit, { color: colors.text.primary }]}>Ändern</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Direktkontakt zum Verkäufer (Rückfragen, Probleme) */}
        <Pressable onPress={() => handleMessage(o)} style={s.msgRow} hitSlop={6}>
          <MessageCircle size={14} color={colors.text.muted} strokeWidth={2} />
          <Text style={[s.msgText, { color: colors.text.muted }]}>Verkäufer anschreiben</Text>
        </Pressable>
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

      {/* Adresse ändern (nur bezahlt, noch nicht versendet) */}
      <Modal transparent visible={!!addrOrder} animationType="fade" onRequestClose={() => setAddrOrder(null)}>
        <Pressable style={s.backdrop} onPress={() => setAddrOrder(null)}>
          <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated, paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: colors.text.primary }]}>Lieferadresse ändern</Text>
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder="Name" placeholderTextColor={colors.text.muted}
              value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder="Straße & Hausnummer" placeholderTextColor={colors.text.muted}
              value={form.street} onChangeText={(v) => setForm((f) => ({ ...f, street: v }))}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[s.input, { flex: 1, color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
                placeholder="PLZ" placeholderTextColor={colors.text.muted} keyboardType="number-pad"
                value={form.zip} onChangeText={(v) => setForm((f) => ({ ...f, zip: v }))}
              />
              <TextInput
                style={[s.input, { flex: 2, color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
                placeholder="Ort" placeholderTextColor={colors.text.muted}
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
                : <Text style={[s.payBtnText, { color: colors.bg.primary }]}>Speichern</Text>}
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

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 10, gap: 10 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 46, fontSize: 14 },
  countryRow: { flexDirection: 'row', gap: 8 },
  countryChip: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 10, borderWidth: 1 },
});
