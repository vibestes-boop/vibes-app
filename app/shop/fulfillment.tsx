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
  useActivePreorderRound,
  useAnnouncePreorderRound,
  useClosePreorderRound,
  useCreatePreorderRound,
  useMarkPreordersPayable,
  useMyPreorderGroups,
  useMyProducts,
  useNotifyPreorderBuyers,
  useSellerProductOrders,
  useSetOrderShipped,
  type PreorderGroup,
  type ProductOrder,
} from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n } from '@/lib/i18n';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeft, Bell, CheckCircle2, Clock, Megaphone, MessageCircle, Package, PackageCheck, Send, Target, Truck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useOrCreateConversation } from '@/lib/useMessages';
import { useAuthStore } from '@/lib/authStore';
import { OrderReviewControl } from '@/components/shop/OrderReviewControl';
import { OrderDisputeControl } from '@/components/shop/OrderDisputeControl';
import {
ActivityIndicator,
Alert,
KeyboardAvoidingView,
Modal,
Platform,
Pressable,
RefreshControl,
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

// Nächster Samstag 23:59 (lokal) + optionale Extra-Wochen — Zaurs realer
// Bestell-Rhythmus („Sammelbestellung nur Samstag").
function nextSaturday(extraWeeks = 0): Date {
  const d = new Date();
  const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7; // heute Samstag → nächster
  d.setDate(d.getDate() + daysUntilSat + extraWeeks * 7);
  d.setHours(23, 59, 0, 0);
  return d;
}

function fmtDeadline(d: Date): string {
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

// „zuletzt angefordert vor X" — kompakt (gerade eben / N Min / N Std / N Tagen).
function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'gerade eben';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `vor ${mins} Min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `vor ${hrs} Std`;
  const days = Math.floor(hrs / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

export default function FulfillmentScreen() {
  const { t } = useI18n();
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Vorbestell-/Verkaufs-Verwaltung ist eine reine Admin-Funktion (einmalige
  // Sammelbestell-Aktion, z.B. Parfüm). Deep-Link-Schutz: Nicht-Admins werden
  // zurückgeschickt (die Einstiegspunkte sind ohnehin schon ausgeblendet).
  const isAdmin = useAuthStore((st) => st.profile?.is_admin) ?? false;
  useEffect(() => {
    if (!isAdmin) router.back();
  }, [isAdmin]);

  const { data: preorderGroups = [], refetch: refetchGroups } = useMyPreorderGroups();
  const { data: orders = [], isLoading, refetch: refetchOrders } = useSellerProductOrders();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchGroups(), refetchOrders()]);
    setRefreshing(false);
  };
  const { markPayable, isWorking: isMarking } = useMarkPreordersPayable();
  const { announce, isWorking: isAnnouncing } = useAnnouncePreorderRound();
  const { setShipped, isWorking: isShipping } = useSetOrderShipped();
  const { notifyBuyers, isWorking: isNotifying } = useNotifyPreorderBuyers();
  const orCreate = useOrCreateConversation();

  // ── Guild-Commerce: Sammelbestellungs-Runde ──────────────────────────────
  const { data: activeRound, refetch: refetchRound } = useActivePreorderRound();
  const { createRound, isWorking: isCreatingRound } = useCreatePreorderRound();
  const { closeRound, isWorking: isClosingRound } = useClosePreorderRound();
  const { data: myProducts = [] } = useMyProducts();
  const preorderProducts = myProducts.filter((p) => p.sale_mode === 'preorder' && p.is_active);

  const [roundSheetOpen, setRoundSheetOpen] = useState(false);
  const [roundProductId, setRoundProductId] = useState<string | null>(null);
  const [roundTarget, setRoundTarget] = useState('80');
  const [roundWeeks, setRoundWeeks] = useState(0); // 0 = nächster Samstag, 1/2 = +Wochen

  const openRoundSheet = () => {
    setRoundProductId(preorderProducts[0]?.id ?? null);
    setRoundTarget('80');
    setRoundWeeks(0);
    setRoundSheetOpen(true);
  };
  const confirmCreateRound = async () => {
    if (!roundProductId) return;
    const target = parseInt(roundTarget, 10);
    if (!target || target < 1) { Alert.alert(t('orders.oopsEmoji'), t('orders.targetMissing')); return; }
    const res = await createRound(roundProductId, target, nextSaturday(roundWeeks));
    if (res.error) { Alert.alert(t('orders.oopsEmoji'), t('orders.retry')); return; }
    setRoundSheetOpen(false);
    showFlash(t('orders.roundStarted'));
    refetchRound();
  };
  const handleCloseRound = () => {
    if (!activeRound) return;
    Alert.alert(
      t('orders.closeRoundTitle'),
      t('orders.closeRoundText', { title: activeRound.title, reserved: activeRound.reserved_qty, target: activeRound.target_qty }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('orders.close'),
          style: 'destructive',
          onPress: async () => {
            const res = await closeRound(activeRound.id);
            if (res.error) { Alert.alert(t('orders.oopsEmoji'), t('orders.retry')); return; }
            showFlash(t('orders.roundClosed'));
            refetchRound();
          },
        },
      ],
    );
  };

  // Welche Produkte wurden in dieser Session schon „angefordert" → Button sofort umschalten.
  const [requested, setRequested] = useState<Set<string>>(new Set());

  // Eigenes Erfolgs-Banner (statt nativem Alert.alert) — warm + on-brand.
  const [flash, setFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFlash = (msg: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFlash(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2800);
  };

  // „Anschreiben"-Modal (DM-Heads-up an alle Vorbesteller eines Produkts)
  const [notifyGroup, setNotifyGroup] = useState<PreorderGroup | null>(null);
  const [notifyMsg, setNotifyMsg] = useState('');
  const openNotify = (g: PreorderGroup) => {
    setNotifyGroup(g);
    setNotifyMsg(`Hey! 🌸 Kurzes Update zu deiner Vorbestellung „${g.title}": Es geht voran — ich melde mich, sobald sie da ist. Danke fürs Vorbestellen!`);
  };
  const confirmNotify = async () => {
    if (!notifyGroup) return;
    const res = await notifyBuyers(notifyGroup.id, notifyMsg);
    if (res.error) { Alert.alert(t('orders.oops'), t('orders.retry')); return; }
    setNotifyGroup(null); setNotifyMsg('');
    showFlash(`Angeschrieben ✓ — ${res.notified ?? 0} Vorbesteller`);
  };

  const handleMessage = async (o: ProductOrder) => {
    try {
      const convId = await orCreate.mutateAsync(o.buyer_id);
      router.push({ pathname: '/messages/[id]', params: { id: convId } } as any);
    } catch {
      Alert.alert(t('orders.oops'), t('orders.chatFailed'));
    }
  };

  // Versand-Modal
  const [shipOrder, setShipOrder] = useState<ProductOrder | null>(null);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');

  const toShip   = orders.filter((o) => o.status === 'paid');
  const waiting  = orders.filter((o) => o.status === 'payment_requested');
  const shipped  = orders.filter((o) => o.status === 'shipped' || o.status === 'delivered');

  // „Ware ist da → Zahlung anfordern": pro Vorbestell-Gruppe ableiten, wer schon
  // im Bestell-Pipeline ist. handled = angefordert/bezahlt/versandt/geliefert.
  // Ein Produkt VERSCHWINDET hier, sobald niemand mehr offen (newCount) ist UND
  // keine Zahlung mehr aussteht (waitingCount) — dann läuft alles unten weiter.
  const HANDLED = new Set(['payment_requested', 'paid', 'shipped', 'delivered']);
  const requestableGroups = preorderGroups
    .map((g) => {
      const groupOrders = orders.filter((o) => o.product_id === g.id && HANDLED.has(o.status));
      const handledCount = groupOrders.length;
      const waitingOrders = groupOrders.filter((o) => o.status === 'payment_requested');
      const waitingCount = waitingOrders.length;
      const newCount = Math.max(0, g.people - handledCount); // #2/#3 noch nicht angefordert
      const lastRequestedAt = waitingOrders.reduce<string | null>(
        (latest, o) => (!latest || o.created_at > latest ? o.created_at : latest),
        null,
      );
      const requestedDone = handledCount > 0 || requested.has(g.id);
      const hasNew = handledCount > 0 && newCount > 0;
      return { g, handledCount, waitingCount, newCount, lastRequestedAt, requestedDone, hasNew };
    })
    // Sichtbar nur solange es noch was zu tun gibt: offene Vormerker ODER
    // ausstehende Zahlung. Bezahlt+versandfertig → verschwindet hier, läuft unten
    // in „Zu versenden" weiter. (Nicht aus `requested` ableiten — das ist
    // Session-State und würde ein bezahltes Produkt fälschlich oben halten.)
    .filter((x) => x.newCount > 0 || x.waitingCount > 0);

  const handleMarkPayable = async (productId: string, title: string) => {
    const res = await markPayable(productId);
    if (res.error) { Alert.alert(t('orders.oopsEmoji'), t('orders.retry')); return; }
    setRequested((prev) => new Set(prev).add(productId));
    if ((res.created ?? 0) === 0 && (res.skipped ?? 0) > 0) {
      showFlash(`Schon angefordert ✓ — ${res.skipped} warten auf Zahlung`);
    } else {
      showFlash(
        `Zahlung angefordert ✓ — ${res.created ?? 0} an Vorbesteller von „${title}"` +
        ((res.skipped ?? 0) > 0 ? ` (${res.skipped} schon offen)` : ''),
      );
    }
  };

  const handleAnnounce = async (g: PreorderGroup) => {
    const res = await announce(g.id);
    if (res.error) { Alert.alert(t('orders.oopsEmoji'), t('orders.retry')); return; }
    showFlash(`Sammelbestellung angekündigt 🌸 — ${res.notified ?? 0} erreicht`);
  };

  const openShip = (o: ProductOrder) => { setShipOrder(o); setCarrier(o.tracking_carrier ?? ''); setTracking(o.tracking_number ?? ''); };
  const confirmShip = async () => {
    if (!shipOrder) return;
    const res = await setShipped(shipOrder.id, carrier, tracking);
    if (res.error) { Alert.alert(t('orders.oopsEmoji'), t('orders.retry')); return; }
    setShipOrder(null); setCarrier(''); setTracking('');
    showFlash(t('orders.markedShipped'));
  };

  const addr = (o: ProductOrder) =>
    [o.ship_name, o.ship_street, [o.ship_zip, o.ship_city].filter(Boolean).join(' '), o.ship_country]
      .filter(Boolean).join('\n');

  // Nicht-Admins sehen nichts (der useEffect oben navigiert bereits zurück).
  if (!isAdmin) {
    return <View style={[s.root, { backgroundColor: colors.bg.primary }]} />;
  }

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={s.headerBtn}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>{t('orders.manageOrders')}</Text>
        <View style={s.headerBtn} />
      </View>

      {flash && (
        <View style={[s.flash, { backgroundColor: colors.text.primary, top: insets.top + 52 }]} pointerEvents="none">
          <CheckCircle2 size={15} color={colors.bg.primary} strokeWidth={2.6} />
          <Text style={[s.flashText, { color: colors.bg.primary }]} numberOfLines={2}>{flash}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.text.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40, gap: 22 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text.muted} />
          }
        >

          {/* 0) Sammelbestellungs-Runde (Guild-Commerce) */}
          <View style={{ gap: 10 }}>
            <Text style={[s.section, { color: colors.text.primary }]}>{t('orders.round')}</Text>
            {activeRound ? (
              <View style={[s.row, { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}>
                <View style={[s.thumb, s.thumbFallback, { backgroundColor: colors.bg.elevated }]}>
                  <Target size={18} color="#FBBF24" strokeWidth={2} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[s.rowTitle, { color: colors.text.primary }]} numberOfLines={1}>{activeRound.title}</Text>
                  <Text style={[s.rowSub, { color: colors.text.muted }]}>
                    {activeRound.reserved_qty}/{activeRound.target_qty} gesammelt · {activeRound.participant_count}{' '}
                    {activeRound.participant_count === 1 ? t('orders.person') : t('orders.persons')} · bis {fmtDeadline(new Date(activeRound.closes_at))}
                  </Text>
                </View>
                <Pressable
                  onPress={handleCloseRound}
                  disabled={isClosingRound}
                  style={[s.smallBtnOutline, { borderColor: colors.border.strong, opacity: isClosingRound ? 0.5 : 1 }]}
                >
                  <Text style={[s.smallBtnText, { color: colors.text.primary }]}>{t('orders.close')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={openRoundSheet}
                disabled={preorderProducts.length === 0}
                style={[s.smallBtn, { backgroundColor: colors.text.primary, alignSelf: 'flex-start', opacity: preorderProducts.length === 0 ? 0.5 : 1 }]}
              >
                <Target size={13} color={colors.bg.primary} strokeWidth={2.4} />
                <Text style={[s.smallBtnText, { color: colors.bg.primary }]}>{t('orders.startRound')}</Text>
              </Pressable>
            )}
            {!activeRound && preorderProducts.length === 0 && (
              <Text style={[s.empty, { color: colors.text.muted }]}>
                Braucht ein aktives Vorbestell-Produkt. 🧴
              </Text>
            )}
          </View>

          {/* A) Ware ist da → Zahlung anfordern */}
          {requestableGroups.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={[s.section, { color: colors.text.primary }]}>{t('orders.goodsArrived')}</Text>
              {requestableGroups.map(({ g, waitingCount, newCount, lastRequestedAt, requestedDone, hasNew }) => (
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
                      {'  ·  '}{g.people} {g.people === 1 ? t('orders.person') : t('orders.persons')} · {g.bottles} {g.bottles === 1 ? t('orders.bottle') : t('orders.bottles')}
                    </Text>
                    {g.buyers.length > 0 && (
                      <Text style={[s.rowSub, { color: colors.text.muted }]} numberOfLines={1}>
                        {g.buyers.map((u) => `@${u}`).join(', ')} · seit {fmtDate(g.first_at)}
                      </Text>
                    )}
                    {/* #1 Zähler (wartende Zahlungen) + #2/#3 neu + #4 Zeitstempel */}
                    {(waitingCount > 0 || hasNew) && (
                      <Text
                        style={[s.rowSub, { color: hasNew ? colors.text.primary : '#16A34A', fontWeight: '600' }]}
                        numberOfLines={1}
                      >
                        {waitingCount > 0 ? `✓ ${waitingCount} ${waitingCount === 1 ? 'wartet' : 'warten'} auf Zahlung` : ''}
                        {hasNew ? `${waitingCount > 0 ? ' · ' : ''}${newCount} neu` : ''}
                        {lastRequestedAt ? ` · ${timeAgo(lastRequestedAt)}` : ''}
                      </Text>
                    )}
                  </Pressable>
                  <View style={{ gap: 6 }}>
                    {/* 3 Zustände: Anfordern (neu) · Erneut anfordern (neue dazu) · Angefordert ✓ */}
                    <Pressable
                      onPress={() => handleMarkPayable(g.id, g.title)}
                      disabled={isMarking || g.price_eur == null}
                      style={[
                        s.smallBtn,
                        (requestedDone && !hasNew)
                          ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#22C55E' }
                          : { backgroundColor: colors.text.primary },
                        { opacity: (isMarking || g.price_eur == null) ? 0.5 : 1 },
                      ]}
                    >
                      {(requestedDone && !hasNew)
                        ? <CheckCircle2 size={13} color="#22C55E" strokeWidth={2.6} />
                        : <Bell size={13} color={colors.bg.primary} strokeWidth={2.4} />}
                      <Text style={[s.smallBtnText, { color: (requestedDone && !hasNew) ? '#22C55E' : colors.bg.primary }]}>
                        {!requestedDone ? t('orders.request') : hasNew ? t('orders.requestAgain') : t('orders.requested')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openNotify(g)}
                      disabled={isNotifying}
                      style={[s.smallBtnOutline, { borderColor: colors.border.strong, opacity: isNotifying ? 0.5 : 1 }]}
                    >
                      <Send size={13} color={colors.text.primary} strokeWidth={2.2} />
                      <Text style={[s.smallBtnText, { color: colors.text.primary }]}>{t('orders.writeTo')}</Text>
                    </Pressable>
                    {/* Sammelbestellung offen → Vormerker + Speicherer anpingen */}
                    <Pressable
                      onPress={() => handleAnnounce(g)}
                      disabled={isAnnouncing}
                      style={[s.smallBtnOutline, { borderColor: colors.border.strong, opacity: isAnnouncing ? 0.5 : 1 }]}
                    >
                      <Megaphone size={13} color={colors.text.primary} strokeWidth={2.2} />
                      <Text style={[s.smallBtnText, { color: colors.text.primary }]}>{t('orders.announce')}</Text>
                    </Pressable>
                  </View>
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
              <Text style={[s.empty, { color: colors.text.muted }]}>{t('orders.nothingToShip')}</Text>
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
                    <Text style={[s.rowTitle, { color: colors.text.primary }]} numberOfLines={1}>{o.product?.title ?? t('orders.product')}</Text>
                    <Text style={[s.rowSub, { color: colors.text.muted }]}>{formatEur(o.amount_eur)}{o.quantity > 1 ? ` · ${o.quantity}×` : ''}</Text>
                  </View>
                </Pressable>
                <Text style={[s.addr, { color: colors.text.secondary }]}>{addr(o) || t('orders.noAddressShort')}</Text>
                <Pressable onPress={() => openShip(o)} style={[s.shipBtn, { backgroundColor: colors.text.primary }]}>
                  <PackageCheck size={15} color={colors.bg.primary} strokeWidth={2.4} />
                  <Text style={[s.shipBtnText, { color: colors.bg.primary }]}>{t('orders.markShipped')}</Text>
                </Pressable>
                <Pressable onPress={() => handleMessage(o)} style={s.msgRow} hitSlop={6}>
                  <MessageCircle size={14} color={colors.text.muted} strokeWidth={2} />
                  <Text style={[s.msgText, { color: colors.text.muted }]}>{t('orders.messageBuyer')}</Text>
                </Pressable>
                <OrderDisputeControl orderId={o.id} role="seller" dispute={o.dispute} />
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
                    {o.product?.title ?? t('orders.product')} · {formatEur(o.amount_eur)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Versendet / Geliefert */}
          {shipped.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[s.section, { color: colors.text.primary }]}>{t('orders.shipped')}</Text>
              {shipped.map((o) => (
                <View key={o.id} style={{ gap: 4 }}>
                  <View style={[s.miniRow]}>
                    {o.status === 'delivered'
                      ? <CheckCircle2 size={13} color="#22C55E" strokeWidth={2.2} />
                      : <Truck size={13} color="#14B8A6" strokeWidth={2.2} />}
                    <Text style={[s.miniText, { color: colors.text.muted }]} numberOfLines={1}>
                      {o.product?.title ?? t('orders.product')}
                      {o.tracking_number ? ` · ${o.tracking_number}` : ''}
                      {o.status === 'delivered' ? ' · geliefert' : ''}
                    </Text>
                  </View>
                  <View style={{ paddingLeft: 20, gap: 4 }}>
                    {o.status === 'delivered' && (
                      <OrderReviewControl
                        orderId={o.id}
                        role="seller"
                        myReview={o.my_review}
                        receivedReview={o.received_review}
                      />
                    )}
                    <OrderDisputeControl orderId={o.id} role="seller" dispute={o.dispute} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Versand-Modal */}
      <Modal transparent visible={!!shipOrder} animationType="fade" onRequestClose={() => setShipOrder(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.backdrop} onPress={() => setShipOrder(null)}>
          <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated, paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: colors.text.primary }]}>{t('orders.confirmShipping')}</Text>
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder={t('orders.carrier')}
              placeholderTextColor={colors.text.muted}
              value={carrier}
              onChangeText={setCarrier}
            />
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder={t('orders.trackingNumber')}
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
              <Text style={[s.shipBtnText, { color: colors.bg.primary }]}>{t('orders.markShipped')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Runde-starten-Sheet (Guild-Commerce) */}
      <Modal transparent visible={roundSheetOpen} animationType="fade" onRequestClose={() => setRoundSheetOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.backdrop} onPress={() => setRoundSheetOpen(false)}>
          <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated, paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: colors.text.primary }]}>{t('orders.startRoundTitle')}</Text>
            <Text style={[s.rowSub, { color: colors.text.muted, marginBottom: 2 }]}>
              Erscheint als „Jetzt aktiv"-Karte in jedem Clan — mit Fortschritt und Mitbestellern. Tipp: danach „Ankündigen" drücken. 📣
            </Text>

            {/* Produkt wählen */}
            {preorderProducts.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
                {preorderProducts.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setRoundProductId(p.id)}
                    style={[
                      s.smallBtnOutline,
                      { borderColor: roundProductId === p.id ? colors.text.primary : colors.border.subtle },
                    ]}
                  >
                    <Text style={[s.smallBtnText, { color: roundProductId === p.id ? colors.text.primary : colors.text.muted }]} numberOfLines={1}>
                      {p.title.length > 24 ? `${p.title.slice(0, 24)}…` : p.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            {preorderProducts.length === 1 && (
              <Text style={[s.rowSub, { color: colors.text.secondary }]} numberOfLines={1}>🧴 {preorderProducts[0].title}</Text>
            )}

            {/* Ziel-Menge */}
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle }]}
              placeholder={t('orders.targetQty')}
              placeholderTextColor={colors.text.muted}
              value={roundTarget}
              onChangeText={setRoundTarget}
              keyboardType="number-pad"
              maxLength={4}
            />

            {/* Deadline: Samstags-Presets */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([0, 1, 2] as const).map((w) => (
                <Pressable
                  key={w}
                  onPress={() => setRoundWeeks(w)}
                  style={[
                    s.smallBtnOutline,
                    { flex: 1, borderColor: roundWeeks === w ? colors.text.primary : colors.border.subtle },
                  ]}
                >
                  <Text style={[s.smallBtnText, { color: roundWeeks === w ? colors.text.primary : colors.text.muted }]}>
                    {w === 0
                      ? `Sa. ${nextSaturday(0).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
                      : `+${w} Wo.`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={confirmCreateRound}
              disabled={isCreatingRound || !roundProductId}
              style={[s.shipBtn, { backgroundColor: colors.text.primary, opacity: (isCreatingRound || !roundProductId) ? 0.6 : 1 }]}
            >
              {isCreatingRound
                ? <ActivityIndicator size="small" color={colors.bg.primary} />
                : <Target size={15} color={colors.bg.primary} strokeWidth={2.4} />}
              <Text style={[s.shipBtnText, { color: colors.bg.primary }]}>
                Runde starten · bis {fmtDeadline(nextSaturday(roundWeeks))}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Anschreiben-Modal (DM an alle Vorbesteller) */}
      <Modal transparent visible={!!notifyGroup} animationType="fade" onRequestClose={() => setNotifyGroup(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={s.backdrop} onPress={() => setNotifyGroup(null)}>
          <Pressable style={[s.sheet, { backgroundColor: colors.bg.elevated, paddingBottom: insets.bottom + 16 }]} onPress={(e) => e.stopPropagation()}>
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: colors.text.primary }]} numberOfLines={1}>
              Alle anschreiben{notifyGroup ? ` · ${notifyGroup.people}` : ''}
            </Text>
            <Text style={[s.rowSub, { color: colors.text.muted, marginBottom: 4 }]}>
              Geht als persönliche Nachricht an alle, die „{notifyGroup?.title}" vorgemerkt haben.
            </Text>
            <TextInput
              style={[s.input, { color: colors.text.primary, backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, height: 120, paddingTop: 12, textAlignVertical: 'top' }]}
              placeholder={t('orders.yourMessage')}
              placeholderTextColor={colors.text.muted}
              value={notifyMsg}
              onChangeText={setNotifyMsg}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={confirmNotify}
              disabled={isNotifying || notifyMsg.trim().length === 0}
              style={[s.shipBtn, { backgroundColor: colors.text.primary, opacity: (isNotifying || notifyMsg.trim().length === 0) ? 0.6 : 1, marginTop: 4 }]}
            >
              {isNotifying
                ? <ActivityIndicator size="small" color={colors.bg.primary} />
                : <Send size={15} color={colors.bg.primary} strokeWidth={2.4} />}
              <Text style={[s.shipBtnText, { color: colors.bg.primary }]}>{t('orders.send')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
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
  flash: {
    position: 'absolute', left: 14, right: 14, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 8,
  },
  flashText: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { fontSize: 12, fontWeight: '500' },

  smallBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: 10 },
  smallBtnOutline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: 10, borderWidth: 1, backgroundColor: 'transparent' },
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
