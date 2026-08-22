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
import { Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { AlertTriangle, MapPin, MessageCircle, Package, Truck } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { trackingUrl, type SellerOrder } from '../lib/useSellerOrders';
import { formatCents, useShippingCheck } from '../lib/useShipping';
import { useUsernames } from '../lib/useAuction';
import { useSession } from '../lib/session';
import {
  disputeReasonLabel,
  disputeWhen,
  orderRef,
  useBuyerRelation,
  useIsAdmin,
  useResolveDispute,
  type IncomingDispute,
} from '../lib/useDispute';

type Props = {
  orders: SellerOrder[];
  busyId: string | null;
  onShip: (orderId: string, carrier: string, tracking: string) => void;
  /** Offene Beanstandungen je Bestellung — leer, solange es keine gibt. */
  disputes?: Map<string, IncomingDispute>;
  onNotice?: (text: string) => void;
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


/**
 * Eine offene Beanstandung — Whatnots „Support Request", auf Berkats Maß.
 *
 * ⚠️ EIGENER ABSCHNITT GANZ OBEN, nicht als Zeile in „Zu packen".
 * Ein Streitfall ist keine Versandaufgabe, sondern eine andere Arbeit: Er hat
 * keinen Knopf, der ihn erledigt, und er wartet auf einen Menschen. Whatnot
 * gibt ihm dafür einen eigenen Reiter; bei Berkats Menge reicht ein Abschnitt,
 * aber er gehört VOR das Packen — das ist die Reihenfolge, in der man es tun
 * sollte.
 *
 * ⚠️ WAS HIER NICHT STEHT: „Erstatten" und „Ersatz senden". Beides verspricht
 * Geld, und Berkat hat weder einen Erstattungsweg noch eine
 * Käuferschutz-Zusage über die gesetzliche Pflicht hinaus (Fassung A,
 * `STRATEGIE-VERKAEUFER-UND-GELD.md` Abschnitt 8). Ein Knopf, der nichts
 * auslösen kann, wäre schlimmer als keiner.
 */
function DisputeCard({
  dispute,
  order,
  buyerName,
  onNotice,
}: {
  dispute: IncomingDispute;
  order: SellerOrder;
  buyerName: string;
  onNotice?: (text: string) => void;
}) {
  const myUserId = useSession((st) => st.userId);
  const { data: relation } = useBuyerRelation(dispute.reporter_id, myUserId);
  const { data: isAdmin } = useIsAdmin(myUserId);
  const resolve = useResolveDispute();
  const [note, setNote] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

  return (
    <View style={styles.disputeCard}>
      <View style={styles.disputeHead}>
        <AlertTriangle size={16} color={ui.live} />
        <Text style={styles.disputeReason}>{disputeReasonLabel(dispute.reason)}</Text>
        <Text style={styles.disputeWhen}>{disputeWhen(dispute.created_at)}</Text>
      </View>

      {/* ⚠️ Bild UND Nummer. Whatnot zeigt beides („Items in Request"), und bei
          zwei gleichartigen Bestellungen ist die Nummer der einzige eindeutige
          Bezug — sie steht identisch auf der Bestellseite des Käufers, also
          kann man sich im Chat darauf berufen. Das Bild beantwortet die andere
          Frage: „welches Stück war das?" */}
      <View style={styles.disputeItem}>
        <View style={styles.disputeItemThumb}>
          {order.items[0]?.image_url ? (
            <Image
              source={{ uri: order.items[0].image_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <Package size={16} color={ui.lineStrong} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.disputeItemTitle}>
            {order.items[0]?.title ?? order.title ?? 'Bestellung'}
          </Text>
          <Text style={styles.disputeOrder}>
            {buyerName} ·{' '}
            {Number(order.amount_eur).toLocaleString('de-DE', {
              style: 'currency',
              currency: 'EUR',
            })}{' '}
            · {orderRef(order.id)}
          </Text>
        </View>
      </View>

      {dispute.detail ? <Text style={styles.disputeDetail}>„{dispute.detail}"</Text> : null}

      {/* Der Beleg, den der Käufer beim Melden angehängt hat. Antippen zeigt
          ihn groß — bei „so kam es an" ist das Ansehen der Zweck. */}
      {dispute.image_url ? (
        <Pressable onPress={() => setZoom(dispute.image_url)} accessibilityRole="imagebutton">
          <Image
            source={{ uri: dispute.image_url }}
            style={styles.disputePhoto}
            contentFit="cover"
            transition={140}
          />
        </Pressable>
      ) : null}

      {/* ⚠️ NUR die Beziehung zu MIR, nicht das Verhalten auf der Plattform.
          Die Begründung steht ausführlich in `useBuyerRelation`: In einer engen
          Gemeinschaft ist „hat dreimal reklamiert" kein Datenpunkt, sondern
          Gerede. */}
      {relation && relation.orders > 0 ? (
        <Text style={styles.disputeRelation}>
          Bei dir {relation.orders === 1 ? '1× gekauft' : `${relation.orders}× gekauft`} ·{' '}
          {formatCents(relation.cents)}
          {relation.disputes > 1 ? ` · ${relation.disputes} Meldungen` : ''}
        </Text>
      ) : null}

      {/* ⚠️ Hilfe an der Stelle der Entscheidung, wie Whatnots „How to Respond".
          Aufklappbar, nicht dauerhaft: Wer schon weiß, was er tut, soll nicht
          jedes Mal daran vorbeilesen.

          Kein Satz darin nennt einen Betrag. Unter Fassung A gibt es keine
          Zusage über die gesetzliche Pflicht hinaus — der Hinweis darf also
          zum Verhalten raten, nicht zum Ergebnis. */}
      <Pressable
        onPress={() => setHelp((v) => !v)}
        style={styles.disputeHelpToggle}
        accessibilityRole="button"
      >
        <Text style={styles.disputeHelpToggleText}>
          {help ? 'Hinweis ausblenden' : 'Wie antworte ich darauf?'}
        </Text>
      </Pressable>
      {help ? (
        <View style={styles.disputeHelp}>
          <Text style={styles.disputeHelpText}>
            • Antworte am selben Tag — auch wenn du noch keine Lösung hast. Schweigen ist das
            Einzige, was den Streit sicher größer macht.{'\n'}• Fehlt ein Foto, frag zuerst danach.
            Es klärt die meisten Fälle in einer Nachricht.{'\n'}• Was ihr vereinbart, haltet ihr
            hier im Chat fest — dann steht es später für euch beide da.{'\n'}• Deine gesetzlichen
            Pflichten gelten unabhängig davon, was ihr vereinbart.
          </Text>
        </View>
      ) : null}

      <Pressable
        style={styles.disputeReply}
        onPress={() => router.push(`/messages/${dispute.reporter_id}`)}
        accessibilityRole="button"
      >
        <MessageCircle size={15} color={ui.text} />
        <Text style={styles.disputeReplyText}>Antworten</Text>
      </Pressable>

      {/* Nur der Betreiber schließt einen Fall. Ein Verkäufer, der die
          Beanstandung gegen sich selbst wegwischen kann, ist keine
          Schlichtung — der Server lehnt es ohnehin ab (`not_authorized`). */}
      {isAdmin ? (
        <View style={styles.disputeResolve}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Wie wurde es geklärt?"
            placeholderTextColor={ui.textMuted}
            style={styles.disputeInput}
          />
          <Pressable
            style={styles.disputeDone}
            disabled={resolve.isPending}
            onPress={() =>
              void resolve
                .mutateAsync({ id: dispute.id, resolution: note.trim() || null })
                .then(() => onNotice?.('Fall geschlossen.'))
                .catch(() => onNotice?.('Das ließ sich gerade nicht schließen.'))
            }
            accessibilityRole="button"
          >
            <Text style={styles.disputeDoneText}>Geklärt</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Schwarz und randlos — dieselbe Begründung wie im Chat (Übergabe 66):
          Ein Beleg wird auf neutralem Grund beurteilt. */}
      <Modal visible={zoom !== null} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomWrap} onPress={() => setZoom(null)}>
          {zoom ? <Image source={{ uri: zoom }} style={styles.zoomImage} contentFit="contain" /> : null}
        </Pressable>
      </Modal>
    </View>
  );
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

export function SellerOrders({ orders, busyId, onShip, disputes, onNotice }: Props) {
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

  const flagged = disputes && disputes.size > 0 ? orders.filter((o) => disputes.has(o.id)) : [];

  return (
    <>
      {flagged.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionLabelAlarm]}>
            Beanstandet ({flagged.length})
          </Text>
          {flagged.map((order) => (
            <DisputeCard
              key={`d-${order.id}`}
              dispute={disputes!.get(order.id)!}
              order={order}
              buyerName={buyerNames[order.buyer_id] ?? '…'}
              onNotice={onNotice}
            />
          ))}
        </>
      ) : null}

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
  // Rot, weil es eine Frist ist — jemand wartet auf Antwort. Dieselbe
  // Begründung wie beim Symbol in der Meldungsliste.
  sectionLabelAlarm: { color: ui.live },

  disputeCard: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ui.live,
    padding: space.lg,
    marginBottom: space.md,
    gap: 6,
  },
  disputeHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  disputeReason: { flex: 1, fontSize: 15, fontWeight: '700', color: ui.text },
  disputeWhen: { fontSize: 11, color: ui.textMuted },
  disputeOrder: { fontSize: 12, color: ui.textMuted },
  disputeDetail: { fontSize: 14, color: ui.text, lineHeight: 20, marginTop: 2 },
  disputeRelation: { fontSize: 11, color: ui.textMuted },
  disputeItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  disputeItemThumb: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeItemTitle: { fontSize: 13, fontWeight: '600', color: ui.text },
  disputeHelpToggle: { paddingVertical: 4 },
  disputeHelpToggleText: { fontSize: 12, fontWeight: '600', color: ui.brand },
  disputeHelp: {
    backgroundColor: ui.sunken,
    borderRadius: radius.sm,
    padding: space.md,
  },
  disputeHelpText: { fontSize: 12, color: ui.text, lineHeight: 19 },
  disputePhoto: {
    width: 96,
    aspectRatio: 4 / 5,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    marginTop: 2,
  },
  zoomWrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { width: '100%', height: '100%' },
  disputeReply: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.lineStrong,
  },
  disputeReplyText: { fontSize: 14, fontWeight: '600', color: ui.text },
  disputeResolve: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  disputeInput: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: ui.line,
    backgroundColor: ui.bg,
    paddingHorizontal: space.md,
    fontSize: 13,
    color: ui.text,
  },
  disputeDone: {
    height: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: ui.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeDoneText: { fontSize: 13, fontWeight: '700', color: ui.successInk },

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
