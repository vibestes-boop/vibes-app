/**
 * app/shop/fulfillment.tsx — Verkäufer: Bestellungen verwalten
 *
 * Zwei Aufgaben:
 *  A) „Ware ist da" → Zahlungsaufforderungen aus Vormerkungen erzeugen
 *     (mark_preorders_payable pro Vorbestell-Produkt).
 *  B) „Zu versenden" → bezahlte Bestellungen mit Tracking als versendet markieren
 *     (set_order_shipped).
 */
import {
  formatEur,
  useMarkPreordersPayable,
  useMyPreorderGroups,
  useSellerProductOrders,
  useSetOrderShipped,
  type ProductOrder,
} from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, Bell, CheckCircle2, Clock, MessageCircle, Package, PackageCheck, Truck } from 'lucide-react-native';
import { useState } from 'react';
import { useOrCreateConversation } from '@/lib/useMessages';
import {
ActivityIndicator,
Alert,
Modal,
Pressable,
ScrollView,
StyleSheet,
Text,
TextInput,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function FulfillmentScreen() {
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { data: preorderGroups = [] } = useMyPreorderGroups();
  const { data: orders = [], isLoading } = useSellerProductOrders();
  const { markPayable, isWorking: isMarking } = useMarkPreordersPayable();
  const { setShipped, isWorking: isShipping } = useSetOrderShipped();
  const orCreate = useOrCreateConversation();

  const handleMessage = async (o: ProductOrder) => {
    try {
      const convId = await orCreate.mutateAsync(o.buyer_id);
      router.push({ pathname: '/messages/[id]', params: { id: convId } } as any);
    } catch {
      Alert.alert('Hoppla', 'Chat konnte gerade nicht geöffnet werden — gleich nochmal?');
    }
  };

  // Versand-Modal
  const [shipOrder, setShipOrder] = useState<ProductOrder | null>(null);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');

  const toShip   = orders.filter((o) => o.status === 'paid');
  const waiting  = orders.filter((o) => o.status === 'payment_requested');
  const shipped  = orders.filter((o) => o.status === 'shipped' || o.status === 'delivered');

  const handleMarkPayable = async (productId: string, title: string) => {
    const res = await markPayable(productId);
    if (res.error) { Alert.alert('Hoppla', 'Hat nicht geklappt — gleich nochmal?'); return; }
    Alert.alert(
      'Zahlung angefordert ✓',
      `${res.created ?? 0} neue Zahlungsaufforderung(en) für „${title}" gesendet` +
      ((res.skipped ?? 0) > 0 ? `, ${res.skipped} waren schon offen.` : '.'),
    );
  };

  const openShip = (o: ProductOrder) => { setShipOrder(o); setCarrier(o.tracking_carrier ?? ''); setTracking(o.tracking_number ?? ''); };
  const confirmShip = async () => {
    if (!shipOrder) return;
    const res = await setShipped(shipOrder.id, carrier, tracking);
    if (res.error) { Alert.alert('Hoppla', 'Hat nicht geklappt — gleich nochmal?'); return; }
    setShipOrder(null); setCarrier(''); setTracking('');
  };

  const addr = (o: ProductOrder) =>
    [o.ship_name, o.ship_street, [o.ship_zip, o.ship_city].filter(Boolean).join(' '), o.ship_country]
      .filter(Boolean).join('\n');

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.headerBtn}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>Bestellungen verwalten</Text>
        <View style={s.headerBtn} />
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.text.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40, gap: 22 }}>

          {/* A) Ware ist da → Zahlung anfordern */}
          {preorderGroups.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={[s.section, { color: colors.text.primary }]}>Ware ist da → Zahlung anfordern</Text>
              {preorderGroups.map((g) => (
                <View key={g.id} style={[s.row, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
                  <Pressable onPress={() => router.push(`/shop/${g.id}` as any)}>
                    {g.cover_url ? (
                      <Image source={{ uri: g.cover_url }} style={s.thumb} contentFit="cover" cachePolicy="memory-disk" />
                    ) : (
                      <View style={[s.thumb, s.thumbFallback, { backgroundColor: colors.bg.elevated }]}>
                        <Package size={18} color={colors.text.muted} strokeWidth={1.6} />
                      </View>
                    )}
                  </Pressable>
                  <Pressable onPress={() => router.push(`/shop/${g.id}` as any)} style={{ flex: 1, gap: 3 }}>
                    <Text style={[s.rowTitle, { color: colors.text.primary }]} numberOfLines={1}>{g.title}</Text>
                    <Text style={[s.rowSub, { color: colors.text.muted }]}>
                      {formatEur(g.price_eur) ?? 'kein €-Preis gesetzt'}
                      {'  ·  '}{g.people} {g.people === 1 ? 'Person' : 'Personen'} · {g.bottles} {g.bottles === 1 ? 'Flasche' : 'Flaschen'}
                    </Text>
                    {g.buyers.length > 0 && (
                      <Text style={[s.rowSub, { color: colors.text.muted }]} numberOfLines={1}>
                        {g.buyers.map((u) => `@${u}`).join(', ')} · seit {fmtDate(g.first_at)}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => handleMarkPayable(g.id, g.title)}
                    disabled={isMarking || g.price_eur == null}
                    style={[s.smallBtn, { backgroundColor: colors.text.primary, opacity: (isMarking || g.price_eur == null) ? 0.5 : 1 }]}
                  >
                    <Bell size={13} color={colors.bg.primary} strokeWidth={2.4} />
                    <Text style={[s.smallBtnText, { color: colors.bg.primary }]}>Anfordern</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* B) Zu versenden (bezahlt) */}
          <View style={{ gap: 10 }}>
            <Text style={[s.section, { color: colors.text.primary }]}>
              Zu versenden{toShip.length > 0 ? ` (${toShip.length})` : ''}
            </Text>
            {toShip.length === 0 ? (
              <Text style={[s.empty, { color: colors.text.muted }]}>Nichts zu versenden. 📭</Text>
            ) : toShip.map((o) => (
              <View key={o.id} style={[s.orderCard, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
                <Pressable
                  onPress={() => o.product?.id && router.push(`/shop/${o.product.id}` as any)}
                  disabled={!o.product?.id}
                  style={s.orderCardTop}
                >
                  {o.product?.cover_url ? (
                    <Image source={{ uri: o.product.cover_url }} style={s.thumb} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={[s.thumb, s.thumbFallback, { backgroundColor: colors.bg.elevated }]}>
                      <Package size={18} color={colors.text.muted} strokeWidth={1.6} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.rowTitle, { color: colors.text.primary }]} numberOfLines={1}>{o.product?.title ?? 'Produkt'}</Text>
                    <Text style={[s.rowSub, { color: colors.text.muted }]}>{formatEur(o.amount_eur)}{o.quantity > 1 ? ` · ${o.quantity}×` : ''}</Text>
                  </View>
                </Pressable>
                <Text style={[s.addr, { color: colors.text.secondary }]}>{addr(o) || 'Keine Adresse'}</Text>
                <Pressable onPress={() => openShip(o)} style={[s.shipBtn, { backgroundColor: colors.text.primary }]}>
                  <PackageCheck size={15} color={colors.bg.primary} strokeWidth={2.4} />
                  <Text style={[s.shipBtnText, { color: colors.bg.primary }]}>Als versendet markieren</Text>
                </Pressable>
                <Pressable onPress={() => handleMessage(o)} style={s.msgRow} hitSlop={6}>
                  <MessageCircle size={14} color={colors.text.muted} strokeWidth={2} />
                  <Text style={[s.msgText, { color: colors.text.muted }]}>Käufer anschreiben</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* Wartet auf Zahlung */}
          {waiting.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[s.section, { color: colors.text.primary }]}>Wartet auf Zahlung ({waiting.length})</Text>
              {waiting.map((o) => (
                <View key={o.id} style={[s.miniRow]}>
                  <Clock size={13} color="#F59E0B" strokeWidth={2.2} />
                  <Text style={[s.miniText, { color: colors.text.muted }]} numberOfLines={1}>
                    {o.product?.title ?? 'Produkt'} · {formatEur(o.amount_eur)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Versendet / Geliefert */}
          {shipped.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[s.section, { color: colors.text.primary }]}>Versendet</Text>
              {shipped.map((o) => (
                <View key={o.id} style={[s.miniRow]}>
                  {o.status === 'delivered'
                    ? <CheckCircle2 size={13} color="#22C55E" strokeWidth={2.2} />
                    : <Truck size={13} color="#14B8A6" strokeWidth={2.2} />}
                  <Text style={[s.miniText, { color: colors.text.muted }]} numberOfLines={1}>
                    {o.product?.title ?? 'Produkt'}
                    {o.tracking_number ? ` · ${o.tracking_number}` : ''}
                    {o.status === 'delivered' ? ' · geliefert' : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Versand-Modal */}
      <Modal transparent visible={!!shipOrder} animationType="fade" onRequestClose={() => setShipOrder(null)}>
        <Pressable style={s.backdrop} onPress={() => setShipOrder(null)}>
          <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated, paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: colors.text.primary }]}>Versand bestätigen</Text>
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder="Versanddienst (z.B. DHL)"
              placeholderTextColor={colors.text.muted}
              value={carrier}
              onChangeText={setCarrier}
            />
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder="Sendungsnummer (optional)"
              placeholderTextColor={colors.text.muted}
              value={tracking}
              onChangeText={setTracking}
              autoCapitalize="characters"
            />
            <Pressable
              onPress={confirmShip}
              disabled={isShipping}
              style={[s.shipBtn, { backgroundColor: colors.text.primary, opacity: isShipping ? 0.6 : 1, marginTop: 4 }]}
            >
              {isShipping
                ? <ActivityIndicator size="small" color={colors.bg.primary} />
                : <PackageCheck size={15} color={colors.bg.primary} strokeWidth={2.4} />}
              <Text style={[s.shipBtnText, { color: colors.bg.primary }]}>Als versendet markieren</Text>
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

  section: { fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 12, fontWeight: '500' },

  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: 10 },
  smallBtnText: { fontSize: 13, fontWeight: '700' },

  orderCard: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  orderCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 46, height: 46, borderRadius: 10 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  addr: { fontSize: 12.5, fontWeight: '500', lineHeight: 18 },
  shipBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 12, marginTop: 4 },
  shipBtnText: { fontSize: 14, fontWeight: '700' },
  msgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 8 },
  msgText: { fontSize: 12.5, fontWeight: '600' },

  empty: { fontSize: 13, fontWeight: '500' },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  miniText: { fontSize: 13, fontWeight: '500', flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 10, gap: 10 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(128,128,128,0.4)', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 46, fontSize: 14 },
});
