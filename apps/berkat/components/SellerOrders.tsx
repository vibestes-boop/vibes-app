// Was verkauft wurde und wohin es soll.
//
// Steht im Reiter „Verkaufen", weil es dorthin gehört: Nach der Show ist die
// Frage nicht mehr „was lege ich auf", sondern „was packe ich ein". Die Adresse
// kommt von der Stripe-Bezahlseite und steht hier vollständig — man soll nicht
// zwischen App und Stripe-Dashboard hin- und herspringen müssen.

import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MapPin, Package, Truck } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { trackingUrl, type SellerOrder } from '../lib/useSellerOrders';
import { formatCents, useShippingCheck } from '../lib/useShipping';
import { useSession } from '../lib/session';

type Props = {
  orders: SellerOrder[];
  busyId: string | null;
  onShip: (orderId: string, carrier: string, tracking: string) => void;
};

function statusLabel(status: string): { text: string; bg: string; color: string } {
  switch (status) {
    case 'paid':
      return { text: 'bezahlt · packen', bg: ui.gold, color: ui.goldInk };
    case 'shipped':
      return { text: 'unterwegs', bg: ui.success, color: ui.successInk };
    case 'delivered':
      return { text: 'angekommen', bg: ui.sunken, color: ui.text };
    default:
      return { text: status, bg: ui.sunken, color: ui.text };
  }
}

function OrderRow({
  order,
  busy,
  onShip,
  shortfall,
}: {
  order: SellerOrder;
  busy: boolean;
  onShip: Props['onShip'];
  /** Fehlbetrag beim Versand in Cent, `null` wenn alles passt. */
  shortfall: number | null;
}) {
  const [carrier, setCarrier] = useState('DHL');
  const [tracking, setTracking] = useState('');
  const status = statusLabel(order.status);
  const link = trackingUrl(order.tracking_carrier, order.tracking_number);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Package size={16} color={ui.text} />
        <Text numberOfLines={1} style={styles.title}>
          {order.title ?? 'Bestellung'}
        </Text>
        <Text style={styles.amount}>
          {Number(order.amount_eur).toLocaleString('de-DE', {
            style: 'currency',
            currency: 'EUR',
          })}
        </Text>
      </View>

      <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
        <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
      </View>

      {order.ship_name ? (
        <View style={styles.address}>
          <MapPin size={13} color={ui.textMuted} />
          <Text style={styles.addressText}>
            {order.ship_name}
            {'\n'}
            {order.ship_street}
            {'\n'}
            {order.ship_zip} {order.ship_city}
            {order.ship_country && order.ship_country !== 'DE' ? `\n${order.ship_country}` : ''}
          </Text>
        </View>
      ) : (
        <Text style={styles.noAddress}>Noch keine Adresse übermittelt.</Text>
      )}

      {/* Stripe Checkout kann Versandoptionen nicht ans Lieferland binden — der
          Käufer wählt frei. Meist ist das ein Versehen (erste Option getippt),
          kein Betrug. Deshalb wird nichts blockiert, sondern nur sichtbar
          gemacht, BEVOR gepackt wird. */}
      {shortfall ? (
        <View style={styles.shortfall}>
          <Text style={styles.shortfallText}>
            Versand passt nicht zum Land: {formatCents(order.shipping_cents)} bezahlt,
            nach {order.ship_country} wären es {formatCents(order.shipping_cents + shortfall)}.
            Frag kurz nach, bevor du packst.
          </Text>
        </View>
      ) : null}

      {order.status === 'paid' ? (
        <>
          <View style={styles.shipRow}>
            <TextInput
              value={carrier}
              onChangeText={setCarrier}
              placeholder="DHL"
              placeholderTextColor={ui.textMuted}
              style={[styles.input, { width: 88 }]}
            />
            <TextInput
              value={tracking}
              onChangeText={setTracking}
              placeholder="Sendungsnummer"
              placeholderTextColor={ui.textMuted}
              autoCapitalize="characters"
              style={[styles.input, { flex: 1 }]}
            />
          </View>
          <Pressable
            style={[styles.shipButton, busy && styles.shipButtonBusy]}
            disabled={busy}
            onPress={() => onShip(order.id, carrier, tracking)}
            accessibilityRole="button"
          >
            <Truck size={16} color={ui.goldInk} />
            <Text style={styles.shipButtonText}>Als versendet markieren</Text>
          </Pressable>
        </>
      ) : order.tracking_number ? (
        <Pressable
          disabled={!link}
          onPress={() => link && void Linking.openURL(link)}
          style={styles.trackRow}
        >
          <Truck size={13} color={ui.textMuted} />
          <Text style={[styles.trackText, link ? styles.trackLink : null]}>
            {order.tracking_carrier} · {order.tracking_number}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SellerOrders({ orders, busyId, onShip }: Props) {
  // Der Verkäufer ist hier immer der angemeldete Nutzer — seine eigenen Sätze
  // schlagen also die Plattform-Vorgabe, falls er welche hinterlegt hat.
  // Hook VOR dem frühen Return: Die Zahl der Hooks muss über alle Renderläufe
  // gleich bleiben, sonst bricht React beim ersten leeren Bestell-Stapel.
  const checkShipping = useShippingCheck(useSession((s) => s.userId));

  if (orders.length === 0) return null;

  return (
    <>
      <Text style={styles.sectionLabel}>Bestellungen ({orders.length})</Text>
      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          busy={busyId === order.id}
          onShip={onShip}
          shortfall={checkShipping(order.shipping_cents, order.ship_country)}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  // Terrakotta ist auf hell die Dringlichkeit — hier als Fläche mit dunkler
  // Schrift, weil ein reiner Farbtext neben grauer Adresse untergeht.
  shortfall: {
    marginTop: space.sm,
    backgroundColor: 'rgba(214,69,47,0.10)',
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  shortfallText: { fontSize: 12, lineHeight: 17, color: ui.live, fontWeight: '600' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ui.textMuted,
    marginBottom: space.sm,
    marginTop: space.md,
  },
  card: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    marginBottom: space.md,
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: ui.text },
  amount: { fontSize: 15, fontWeight: '700', color: ui.text },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  address: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  addressText: { flex: 1, fontSize: 13, color: ui.text, lineHeight: 19 },
  noAddress: { fontSize: 12, color: ui.textMuted },
  shipRow: { flexDirection: 'row', gap: space.sm },
  input: {
    height: 40,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.lineStrong,
    backgroundColor: ui.bg,
    paddingHorizontal: space.md,
    fontSize: 14,
    color: ui.text,
  },
  shipButton: {
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shipButtonBusy: { opacity: 0.6 },
  shipButtonText: { fontSize: 14, fontWeight: '700', color: ui.goldInk },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trackText: { fontSize: 12, color: ui.textMuted },
  trackLink: { color: ui.text, textDecorationLine: 'underline' },
});
