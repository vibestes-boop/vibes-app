// Was verkauft wurde und wohin es soll.
//
// Nach der Show ist die Frage nicht mehr „was lege ich auf", sondern „was packe
// ich ein". Die Adresse kommt von der Stripe-Bezahlseite und steht hier
// vollständig — man soll nicht zwischen App und Stripe-Dashboard springen.
//
// AUFBAU seit dem 16.08.2026: nach Zustand gruppiert.
// Vorher standen alle Bestellungen als gleich große, voll ausgeklappte Karten
// untereinander — auch die längst versendeten, mit Adressblock und leerem
// Sendungsnummer-Feld. Bei vier Bestellungen war das eine Wand, bei zwanzig
// wäre es unbenutzbar. Jetzt: „Zu packen" oben und offen, alles Erledigte
// darunter als eine Zeile.

import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Package, Truck } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { trackingUrl, type SellerOrder } from '../lib/useSellerOrders';
import { formatCents, useShippingCheck } from '../lib/useShipping';
import { useUsernames } from '../lib/useAuction';
import { useSession } from '../lib/session';

type Props = {
  orders: SellerOrder[];
  busyId: string | null;
  onShip: (orderId: string, carrier: string, tracking: string) => void;
};

/**
 * Die Zusteller, für die `trackingUrl` eine Adresse kennt.
 *
 * ⚠️ DER GRUND FÜR DIE AUSWAHL statt eines Textfelds: Das Feld war frei
 * beschreibbar, `trackingUrl` kennt aber genau diese sechs. Wer „Deutsche
 * Post", „Post AT" oder auch nur „dhl paket" eintippt, erzeugt beim KÄUFER
 * einen Eintrag ohne Verfolgungs-Link — ohne Fehlermeldung, ohne dass es
 * jemandem auffällt. Genau das Muster, das dieses Projekt an anderer Stelle
 * schon Stunden gekostet hat.
 *
 * Wer diese Liste erweitert, muss `trackingUrl` in `lib/useSellerOrders.ts`
 * mit erweitern — sonst ist der neue Eintrag wieder ein toter Link.
 */
const CARRIERS = ['DHL', 'DHL Express', 'Hermes', 'DPD', 'GLS', 'UPS'] as const;

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

/** „vor 3 Std", „gestern" — wie lange wartet der Käufer schon? */
function since(iso: string | null): string {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `vor ${Math.max(1, min)} Min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std`;
  const tage = Math.floor(std / 24);
  return tage === 1 ? 'gestern' : `vor ${tage} Tagen`;
}

/** Die offene Bestellung: alles, was zum Packen nötig ist. */
function OpenOrder({
  order,
  buyerName,
  busy,
  onShip,
  shortfall,
  defaultCarrier,
}: {
  order: SellerOrder;
  buyerName: string;
  busy: boolean;
  onShip: Props['onShip'];
  /** Fehlbetrag beim Versand in Cent, `null` wenn alles passt. */
  shortfall: number | null;
  /** Womit dieser Verkäufer zuletzt versendet hat. */
  defaultCarrier: string;
}) {
  const [carrier, setCarrier] = useState<string>(defaultCarrier);
  const [tracking, setTracking] = useState('');
  const status = statusLabel(order.status);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Package size={16} color={ui.text} />
        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Der KÄUFERNAME, nicht der Bestelltitel. Der Titel ist bei einem
              Sammelkorb ohnehin nur „3 Artikel aus der Live-Show", und die
              Artikel stehen gleich darunter mit Bild. Wer packt, will wissen,
              für wen. */}
          <Text numberOfLines={1} style={styles.title}>
            {buyerName}
          </Text>
          {/* Wie lange der Käufer schon wartet. Die durchschnittliche
              Versandzeit ist eine Kachel auf dem öffentlichen Profil — diese
              Zahl ist also nicht nur Höflichkeit. */}
          {order.paid_at ? <Text style={styles.waiting}>{since(order.paid_at)}</Text> : null}
        </View>
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

      {order.items.length > 0 ? (
        <View style={styles.items}>
          {order.items.map((item, index) => (
            <View key={`${order.id}-${index}`} style={styles.itemRow}>
              <View style={styles.itemThumb}>
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                  />
                ) : (
                  <Package size={14} color={ui.textMuted} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.itemTitle}>
                {item.title}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {order.ship_name ? (
        <View style={styles.address}>
          <MapPin size={13} color={ui.textMuted} />
          {/* `selectable`: Die Adresse muss in ein Versandportal übertragen
              werden. Langes Antippen markiert und kopiert sie — das kostet
              nichts und braucht kein Zwischenablage-Modul (das wäre nativ und
              damit ein neuer Build). */}
          <Text selectable style={styles.addressText}>
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

      <Text style={styles.fieldLabel}>Zusteller</Text>
      <View style={styles.carriers}>
        {CARRIERS.map((name) => {
          const on = name === carrier;
          return (
            <Pressable
              key={name}
              onPress={() => setCarrier(name)}
              style={[styles.carrierChip, on && styles.carrierChipOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.carrierText, on && styles.carrierTextOn]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={tracking}
        onChangeText={setTracking}
        placeholder="Sendungsnummer"
        placeholderTextColor={ui.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.input}
      />

      <Pressable
        style={[styles.shipButton, (busy || !tracking.trim()) && styles.shipButtonOff]}
        // Ohne Nummer hat der Käufer nichts zu verfolgen, und der Zustand
        // `shipped` wäre eine Behauptung ohne Beleg.
        disabled={busy || !tracking.trim()}
        onPress={() => onShip(order.id, carrier, tracking.trim())}
        accessibilityRole="button"
      >
        <Truck size={16} color={ui.goldInk} />
        <Text style={styles.shipButtonText}>
          {busy ? 'Einen Moment …' : 'Als versendet markieren'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Erledigt — eine Zeile, kein Formular. */
function DoneOrder({ order, buyerName }: { order: SellerOrder; buyerName: string }) {
  const status = statusLabel(order.status);
  const link = trackingUrl(order.tracking_carrier, order.tracking_number);

  return (
    <View style={styles.doneRow}>
      <View style={styles.doneThumb}>
        {order.items[0]?.image_url ? (
          <Image
            source={{ uri: order.items[0].image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <Package size={14} color={ui.textMuted} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.doneName}>
          {buyerName}
        </Text>
        {order.tracking_number ? (
          <Pressable
            disabled={!link}
            onPress={() => link && void Linking.openURL(link)}
            hitSlop={6}
          >
            <Text numberOfLines={1} style={[styles.trackText, link ? styles.trackLink : null]}>
              {order.tracking_carrier} · {order.tracking_number}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.donePill, { backgroundColor: status.bg }]}>
        <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
      </View>
    </View>
  );
}

export function SellerOrders({ orders, busyId, onShip }: Props) {
  // Der Verkäufer ist hier immer der angemeldete Nutzer — seine eigenen Sätze
  // schlagen also die Plattform-Vorgabe, falls er welche hinterlegt hat.
  // Hook VOR dem frühen Return: Die Zahl der Hooks muss über alle Renderläufe
  // gleich bleiben, sonst bricht React beim ersten leeren Bestell-Stapel.
  const checkShipping = useShippingCheck(useSession((s) => s.userId));
  const buyerNames = useUsernames(orders.map((o) => o.buyer_id));

  const { open, done, lastCarrier } = useMemo(() => {
    // Womit dieser Verkäufer ZULETZT versendet hat.
    //
    // Ein Verkäufer benutzt fast immer denselben Zusteller — ihn bei jeder
    // Bestellung neu auswählen zu lassen, ist die eigentliche Zumutung, nicht
    // die Form des Widgets. Eine gespeicherte Einstellung bräuchte
    // AsyncStorage (nativ, neuer Build); die Antwort steht ohnehin schon in
    // den Daten, und sie ist dort sogar ehrlicher: Sie spiegelt, was er
    // TATSÄCHLICH tut, nicht was er einmal eingestellt hat.
    //
    // `orders` kommt nach `paid_at` absteigend — der erste Treffer ist der
    // jüngste. Nur bekannte Zusteller zählen, sonst käme aus einer alten
    // Freitext-Eingabe eine Vorauswahl, die es als Chip gar nicht gibt.
    const known = orders.find(
      (o) =>
        o.tracking_carrier &&
        (CARRIERS as readonly string[]).includes(o.tracking_carrier),
    );
    return {
      open: orders.filter((o) => o.status === 'paid'),
      done: orders.filter((o) => o.status !== 'paid'),
      lastCarrier: known?.tracking_carrier ?? CARRIERS[0],
    };
  }, [orders]);

  if (orders.length === 0) return null;

  return (
    <>
      {open.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Zu packen ({open.length})</Text>
          {open.map((order) => (
            <OpenOrder
              key={order.id}
              order={order}
              buyerName={buyerNames[order.buyer_id] ?? '…'}
              busy={busyId === order.id}
              onShip={onShip}
              shortfall={checkShipping(order.shipping_cents, order.ship_country)}
              defaultCarrier={lastCarrier}
            />
          ))}
        </>
      ) : null}

      {done.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, open.length > 0 && { marginTop: space.xl }]}>
            Erledigt ({done.length})
          </Text>
          <View style={styles.doneCard}>
            {done.map((order, index) => (
              <View key={order.id} style={index > 0 ? styles.doneSplit : undefined}>
                <DoneOrder order={order} buyerName={buyerNames[order.buyer_id] ?? '…'} />
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ui.textMuted,
    marginBottom: space.sm,
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
  title: { fontSize: 16, fontWeight: '700', color: ui.text },
  waiting: { fontSize: 11, color: ui.textMuted, marginTop: 1 },
  amount: { fontSize: 16, fontWeight: '700', color: ui.text },

  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: { fontSize: 11, fontWeight: '800' },

  items: { gap: space.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  /**
   * 56 statt 36 — und das ist eine Verfeinerung der Regel aus Abschnitt 18,
   * nicht ihre Verletzung.
   *
   * Die Regel lautete „stöbern → groß, arbeiten → klein". Zu grob: Beim PACKEN
   * ist die Arbeit selbst visuell. Man vergleicht das Bild mit einem
   * Gegenstand auf dem Tisch. Das Foto ist hier die Information, nicht das
   * Etikett dazu.
   *
   * Genauer also: **Ist das Bild die Auskunft oder nur die Wiedererkennung?**
   * Bestellliste im Konto („wo ist mein Zeug") → Wiedererkennung, klein.
   * Packliste („welches Ding nehme ich in die Hand") → Auskunft, groß.
   *
   * Kostet nichts: Die Datei ist dieselbe, egal wie groß sie gezeichnet wird
   * (am 16.08.2026 nachgemessen — 250–330 KB je Bild).
   */
  itemThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemTitle: { flex: 1, fontSize: 14, color: ui.text },

  address: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  addressText: { flex: 1, fontSize: 13, color: ui.text, lineHeight: 19 },
  noAddress: { fontSize: 13, color: ui.textMuted },

  shortfall: {
    backgroundColor: ui.sunken,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: ui.live,
    padding: space.sm,
  },
  shortfallText: { fontSize: 12, color: ui.text, lineHeight: 17 },

  fieldLabel: { fontSize: 11, color: ui.textMuted },
  carriers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  carrierChip: {
    paddingHorizontal: space.md,
    height: 32,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  carrierChipOn: { backgroundColor: ui.brand },
  carrierText: { fontSize: 12, fontWeight: '600', color: ui.text },
  carrierTextOn: { color: ui.bg },

  input: {
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: 15,
    color: ui.text,
  },

  shipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    marginTop: space.xs,
  },
  shipButtonOff: { opacity: 0.45 },
  shipButtonText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },

  // ── Erledigt: eine Karte, je Bestellung eine Zeile ───────────────────────
  doneCard: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    paddingHorizontal: space.md,
  },
  doneSplit: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.line },
  // Erledigt heißt: nichts mehr in die Hand nehmen. Hier ist das Bild wieder
  // nur Wiedererkennung, also klein.
  doneThumb: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  doneName: { fontSize: 14, fontWeight: '700', color: ui.text },
  donePill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  trackText: { fontSize: 12, color: ui.textMuted, marginTop: 2 },
  trackLink: { color: ui.brand, fontWeight: '700', textDecorationLine: 'underline' },
});
