// Konto — wer du bist und was noch offen ist.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  ChevronRight,
  FileText,
  Gift,
  Heart,
  Lock,
  MessageSquare,
  Package,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { buyerStatus, useMyOrders, type CartItem } from '../../lib/useMyOrders';
import {
  formatCartWindow,
  formatEuro,
  useServerClock,
  useUsernames,
} from '../../lib/useAuction';
import { useCheckoutCart } from '../../lib/useCheckout';
import { shippingHint, useShippingLookup } from '../../lib/useShipping';
import { useUnreadMessageCount } from '../../lib/useDirectMessages';
import { missingBusinessFields, useBerkatSeller } from '../../lib/useBerkatSeller';
import { useMyRewards } from '../../lib/useRewards';
import { useMyReviews } from '../../lib/useOrderReview';
import { buildLabel } from '../../lib/buildInfo';
import { RatingStars } from '../../components/RatingStars';
import { Avatar } from '../../components/Avatar';
import { BerkatMark } from '../../components/BerkatMark';
import { ui, radius, space } from '../../theme/tokens';

type OpenCart = {
  id: string;
  seller_id: string;
  closes_at: string;
  /**
   * `open` sammelt weiter, `checkout_pending` ist eingefroren.
   *
   * ⚠️ Der Unterschied ist für den Käufer teuer, nicht kosmetisch: Ein
   * eingefrorener Korb nimmt NICHTS mehr auf (`checkout_auction_cart`,
   * HANDOFF 4). Was danach gewonnen wird, landet in einem neuen Paket — mit
   * eigenem Versand. Wer das nicht sieht, hält zwei Körbe für einen Fehler
   * und zahlt zweimal 4,90 €.
   */
  status: string;
  itemCount: number;
  totalCents: number;
  items: CartItem[];
};

/**
 * Welche dieser Verkäufer senden GERADE.
 *
 * ⚠️ Die Frage klingt nach Kosmetik und ist die teuerste auf diesem Bildschirm.
 * `checkout_auction_cart` friert den Korb ein (HANDOFF 4) — wer bezahlt,
 * während der Verkäufer noch sendet, bekommt jeden weiteren Zuschlag in ein
 * NEUES Paket und zahlt ein zweites Mal Versand. Genau das ist am 19.08.2026
 * im Zwei-Konten-Durchlauf passiert.
 *
 * HANDOFF 11 hat diese Regel längst aufgeschrieben — als Begründung dafür,
 * dass es im Live-Raum keinen Bezahlknopf gibt. Nur steht hier einer, einen
 * Reiter entfernt, und die Regel wurde nie mitgezogen.
 *
 * Eine Abfrage für alle Verkäufer auf einmal; ohne Körbe läuft sie nicht.
 */
function useLiveSellers(sellerIds: string[]) {
  const key = [...new Set(sellerIds)].sort().join(',');
  return useQuery({
    queryKey: ['berkat', 'carts-live-sellers', key],
    enabled: key.length > 0,
    staleTime: 20_000,
    // Eine Show kann während des Hinschauens enden — dann soll die Warnung weg.
    refetchInterval: 30_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('host_id')
        .in('host_id', key.split(','))
        .eq('app', 'berkat')
        .eq('status', 'active');
      if (error) {
        // Fehlt die Auskunft, warnen wir lieber nicht, als falsch zu warnen.
        if (__DEV__) console.warn('[Berkat] Live-Verkäufer:', error.message);
        return new Set();
      }
      return new Set(((data ?? []) as { host_id: string }[]).map((r) => r.host_id));
    },
  });
}

/** Offene Sammelkörbe des Käufers — je Verkäufer einer, jeder wird ein Paket. */
function useMyCarts(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'my-carts', userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    // Diese Abfrage läuft nicht im Takt — ohne das hier stünde nach der
    // Rückkehr aus dem Stripe-Browser weiterhin „noch offen" da, obwohl längst
    // bezahlt ist. Die App-weite Verkabelung dafür sitzt im Wurzel-Layout.
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<OpenCart[]> => {
      const { data: carts, error } = await supabase
        .from('auction_carts')
        // ⚠️ `status` MUSS mit. Bis zum 19.08.2026 fehlte er, und damit konnte
        // der Bildschirm einen offenen Korb nicht von einem eingefrorenen
        // unterscheiden — beide sahen identisch aus, mit eigenem Bezahlknopf
        // und eigenem „zzgl. Versand". Am Gerät gemeldet: „die stehen
        // getrennt, kein Hinweis dass es ein Korb ist". Genau die
        // Fehlerklasse aus HANDOFF 3: Die Spalte war da, die Abfrage holte
        // sie nicht.
        .select('id, seller_id, closes_at, status')
        .eq('buyer_id', userId!)
        // `checkout_pending` gehört dazu: Der Korb ist eingefroren, weil er
        // schon zur Kasse getragen wurde — die Zahlung steht aber noch aus.
        // Ohne diesen Zustand fände niemand seine angefangene Zahlung wieder.
        .in('status', ['open', 'checkout_pending'])
        .order('closes_at', { ascending: true });
      if (error) throw error;

      const rows = (carts ?? []) as {
        id: string;
        seller_id: string;
        closes_at: string;
        status: string;
      }[];
      if (rows.length === 0) return [];

      const { data: won, error: wonError } = await supabase
        .from('live_auctions')
        .select('cart_id, current_bid_cents, title, image_url')
        .in(
          'cart_id',
          rows.map((c) => c.id),
        )
        .eq('status', 'sold');
      if (wonError) throw wonError;

      const items = (won ?? []) as {
        cart_id: string;
        current_bid_cents: number | null;
        title: string;
        image_url: string | null;
      }[];
      return rows.map((cart) => {
        const mine = items.filter((item) => item.cart_id === cart.id);
        return {
          ...cart,
          itemCount: mine.length,
          totalCents: mine.reduce((sum, item) => sum + (item.current_bid_cents ?? 0), 0),
          // Was drin liegt — vorher war ein offenes Paket nur eine Zahl.
          items: mine.map((item) => ({ title: item.title, image_url: item.image_url })),
        };
      });
    },
  });
}

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myUserId = useSession((s) => s.userId);
  // Fehlen einem gewerblichen Verkäufer Pflichtangaben, steht das an der Zeile
  // — bei privat ist die Liste leer und es erscheint nichts.
  const { data: sellerRow } = useBerkatSeller(myUserId);
  const sellerMissing = missingBusinessFields(sellerRow ?? null);
  const profile = useSession((s) => s.profile);
  const { serverNow } = useServerClock();

  const { data: carts = [], refetch: refetchCarts } = useMyCarts(myUserId);
  const { data: liveSellers } = useLiveSellers(carts.map((c) => c.seller_id));
  const { data: orders = [], refetch: refetchOrders } = useMyOrders(myUserId);
  const { data: unreadMessages = 0, refetch: refetchUnread } = useUnreadMessageCount(myUserId);
  const { data: rewards, refetch: refetchRewards } = useMyRewards(myUserId);
  const openCredits = rewards?.credits_open ?? 0;

  // Bewerten: was ich schon abgegeben habe, damit dieselbe Bestellung nicht
  // zweimal nach Sternen fragt.
  const { data: myReviews = {} } = useMyReviews(myUserId, orders.map((o) => o.id));

  // Beim Öffnen des Reiters neu laden — nicht nur beim ersten Aufbauen.
  //
  // Expo Router hält die Reiter-Bildschirme dauerhaft aufgebaut. Wer „Konto"
  // einmal geöffnet hat, sieht beim Zurückwechseln denselben Stand von vorhin:
  // kein Aufbauen, kein Fokuswechsel der App, also kein Nachladen. Genau so
  // stand am 14.08. „Noch nichts gewonnen" da, während im Live-Raum schon
  // „2 Artikel · 1 Paket" angezeigt wurde — die Pakete waren da, die Abfrage
  // war nur alt.
  useFocusEffect(
    useCallback(() => {
      void refetchCarts();
      void refetchOrders();
      void refetchUnread();
      // Gutschriften entstehen serverseitig (Trigger auf `product_orders`).
      // Ohne diesen Ruf bliebe das Abzeichen stehen, bis die App neu startet.
      void refetchRewards();
    }, [refetchCarts, refetchOrders, refetchUnread, refetchRewards]),
  );
  const sellerNames = useUsernames([
    ...carts.map((c) => c.seller_id),
    ...orders.map((o) => o.seller_id),
  ]);

  const checkout = useCheckoutCart();
  const shippingFor = useShippingLookup();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const startCheckout = async (cartId: string) => {
    setPayingId(cartId);
    setNotice(null);
    const result = await checkout(cartId);
    setPayingId(null);
    if (!result.ok) setNotice(result.message);
  };

  /**
   * ⚠️ Rückfrage, solange der Verkäufer sendet.
   *
   * Bezahlen friert den Korb ein — jeder weitere Zuschlag landet dann in einem
   * NEUEN Paket, mit eigenem Versand. Solange die Show läuft, ist genau das der
   * wahrscheinliche Fall, und der Käufer kann es nicht wissen.
   *
   * Kein Riegel, nur eine Frage: Wer wirklich jetzt zahlen will (etwa weil er
   * gleich weg muss), darf das. Die teure Entscheidung wird nur sichtbar
   * gemacht, nicht verboten — dieselbe Linie wie beim Verwerfen eines
   * vorbereiteten Artikels.
   *
   * Ein bereits eingefrorener Korb fragt NICHT noch einmal: Dort ist der Schaden
   * schon eingetreten, und eine Warnung wäre nur noch ein Vorwurf.
   */
  const pay = async (cartId: string) => {
    const cart = carts.find((c) => c.id === cartId);
    const sellerLive = cart ? liveSellers?.has(cart.seller_id) : false;

    if (!cart || cart.status !== 'open' || !sellerLive) {
      await startCheckout(cartId);
      return;
    }

    Alert.alert(
      'Der Verkäufer sendet noch',
      'Wenn du jetzt bezahlst, ist dieses Paket zu. Alles, was du danach in der Show '
        + 'gewinnst, kommt in ein neues — mit eigenem Versand.',
      [
        { text: 'Warten', style: 'cancel' },
        { text: 'Trotzdem bezahlen', onPress: () => void startCheckout(cartId) },
      ],
    );
  };

  if (!myUserId) {
    return (
      <View style={[styles.screen, styles.center, { padding: space.xl }]}>
        <BerkatMark size={40} color={ui.brand} />
        <Text style={styles.gateTitle}>Noch nicht angemeldet</Text>
        <Text style={styles.gateBody}>
          Mit einem Konto kannst du mitbieten, folgen und verkaufen. Deins von
          Serlo gilt hier auch.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.primaryButtonText}>Anmelden</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.md,
        paddingBottom: insets.bottom + space.xl,
      }}
    >
      {/* Die Tür zum eigenen Profil.
          Bis zum 16.08.2026 gab es keine: Acht Stellen in der App springen auf
          /seller/<id>, keine einzige mit der eigenen. Das eigene Regal, die
          eigenen Bürgen und die eigene Bio waren damit unerreichbar — man sah
          seine Seite nur so, wie ein Fremder sie NICHT sieht, nämlich gar nicht.
          Bei Whatnot IST der Konto-Reiter das Profil; hier führt er hin. */}
      <Pressable
        style={({ pressed }) => [styles.profileRow, pressed && styles.linkRowPressed]}
        onPress={() => myUserId && router.push(`/seller/${myUserId}`)}
        accessibilityRole="button"
        accessibilityLabel="Mein Profil ansehen"
      >
        <Avatar uri={profile?.avatar_url} name={profile?.username} size={56} ring />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.name}>
            {profile?.username ?? 'Dein Konto'}
          </Text>
          <Text style={styles.profileHint}>Mein Profil ansehen</Text>
          {profile?.women_only_verified ? (
            <View style={styles.wozBadge}>
              <Lock size={11} color={ui.successInk} />
              <Text style={styles.wozText}>Frauen-Only freigegeben</Text>
            </View>
          ) : null}
        </View>
        <ChevronRight size={20} color={ui.textMuted} />
      </Pressable>

      {/* Der einzige Weg zu eingehenden Nachrichten. Steht über den Paketen,
          weil eine Frage des Verkäufers zur Lieferadresse dringender ist als
          ein Paket, das ohnehin 24 Stunden Zeit hat. */}
      <Pressable
        style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
        onPress={() => router.push('/messages')}
        accessibilityRole="button"
        accessibilityLabel="Nachrichten"
      >
        <MessageSquare size={19} color={ui.text} />
        <Text style={styles.linkLabel}>Nachrichten</Text>
        {unreadMessages > 0 ? (
          <View style={styles.linkBadge}>
            <Text style={styles.linkBadgeText}>
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </Text>
          </View>
        ) : null}
        <ChevronRight size={18} color={ui.textMuted} />
      </Pressable>

      {/* Einladen steht ÜBER den Paketen, weil es die einzige Zeile hier ist,
          die Berkat größer macht statt nur den eigenen Kram zu verwalten. Das
          Abzeichen zeigt offene Gutschriften — eine Zahl, die etwas wert ist,
          soll man sehen, ohne die Seite zu öffnen. */}
      <Pressable
        style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
        onPress={() => router.push('/rewards')}
        accessibilityRole="button"
        accessibilityLabel="Einladen und Belohnungen"
      >
        <Gift size={19} color={ui.text} />
        <Text style={styles.linkLabel}>Einladen</Text>
        {openCredits > 0 ? (
          <View style={styles.creditBadge}>
            <Text style={styles.creditBadgeText}>
              {openCredits}× Gratis-Versand
            </Text>
          </View>
        ) : null}
        <ChevronRight size={18} color={ui.textMuted} />
      </Pressable>

      {/* Die Merkliste — zwischen Einladen und den Paketen: Sie gehört zum
          Stöbern, nicht zum Abwickeln. Kein Abzeichen: Eine Zahl, die nie auf
          null geht, liest bald niemand mehr (dieselbe Regel wie beim
          Bestell-Abzeichen). */}
      <Pressable
        style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
        onPress={() => router.push('/saved')}
        accessibilityRole="button"
        accessibilityLabel="Gemerkte Angebote"
      >
        <Heart size={19} color={ui.text} />
        <Text style={styles.linkLabel}>Gemerkt</Text>
        <ChevronRight size={18} color={ui.textMuted} />
      </Pressable>

      {/* ── Benachrichtigungen. Berkat schickt Push für acht Anlässe, und bis
          zum 22.08.2026 gab es keinen einzigen Schalter. Wem es zu viel wurde,
          dem blieb nur der Weg über die iPhone-Einstellungen — und dort gibt es
          alles oder nichts, also fällt der Zuschlag mit weg.

          Steht bei „Gemerkt" und nicht bei „Abmelden": Es ist eine
          Einstellung, die man sucht, wenn einen etwas stört — nicht eine, mit
          der man das Konto verlässt. ─────────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
        onPress={() => router.push('/notification-settings')}
        accessibilityRole="button"
        accessibilityLabel="Benachrichtigungen einstellen"
      >
        <Bell size={19} color={ui.text} />
        <Text style={styles.linkLabel}>Benachrichtigungen</Text>
        <ChevronRight size={18} color={ui.textMuted} />
      </Pressable>

      {/* ── Anbieterangaben. Bis zum 19.08.2026 gab es dafür kein Formular:
          Die Spalten standen seit `20260816200000`, die RPC nahm jedes Feld
          entgegen, die Artikelseite prüfte auf Vollständigkeit — nur eintragen
          konnte man sie nirgends. Ein gewerblicher Verkäufer sah damit an jedem
          seiner Angebote einen Mangel, den er selbst nicht beheben konnte
          (Übergabe, Abschnitt 33).

          Die Zeile steht für JEDEN da, nicht nur für Gewerbliche: Auch der
          Wechsel VON privat AUF gewerblich beginnt hier. Der rote Hinweis
          erscheint dagegen nur, wenn tatsächlich etwas fehlt — ein Mahnzeichen
          an einem Privatkonto wäre eine Aufforderung ohne Anlass. ────────── */}
      <Pressable
        style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}
        onPress={() => router.push('/seller-details')}
        accessibilityRole="button"
        accessibilityLabel={
          sellerMissing.length > 0
            ? `Anbieterangaben, unvollständig: es fehlen ${sellerMissing.join(', ')}`
            : 'Anbieterangaben'
        }
      >
        <FileText size={19} color={ui.text} />
        <Text style={styles.linkLabel}>Anbieterangaben</Text>
        {sellerMissing.length > 0 ? (
          <Text style={styles.linkWarn}>unvollständig</Text>
        ) : null}
        <ChevronRight size={18} color={ui.textMuted} />
      </Pressable>

      <Text style={styles.sectionLabel}>Deine Pakete</Text>
      {carts.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Noch nichts gewonnen</Text>
          <Text style={styles.cardBody}>
            Alles, was du bei einem Verkäufer ersteigerst, sammelt sich 24 Stunden lang in einem
            Paket — damit du nicht dreimal Versand zahlst.
          </Text>
        </View>
      ) : (
        carts.map((cart) => (
          <View key={cart.id} style={styles.card}>
            <View style={styles.cartHead}>
              <Package size={17} color={ui.text} />
              <Text style={styles.cardTitle}>{sellerNames[cart.seller_id] ?? '…'}</Text>
              <Text style={styles.cartTotal}>{formatEuro(cart.totalCents)}</Text>
            </View>
            <Text style={styles.cardBody}>
              {cart.itemCount} Artikel · 1 Paket ·{' '}
              {formatCartWindow(cart.closes_at, serverNow)}
            </Text>

            {/* ⚠️ Der eingefrorene Korb muss sich erklären.
                Am 19.08.2026 am Gerät gemeldet: Zwei Körbe desselben
                Verkäufers standen untereinander, gleich aussehend, jeder mit
                eigenem Bezahlknopf und eigenem „zzgl. Versand" — „kein Hinweis,
                dass es ein Korb ist".

                Beide Körbe waren richtig: Der erste war zur Kasse getragen und
                damit eingefroren (`checkout_pending`, HANDOFF 4), der zweite
                nahm den nächsten Zuschlag auf. Nur SAH man das nicht. Und die
                Folge ist teuer, nicht kosmetisch — zwei Pakete heißt zweimal
                Versand. Wer das nicht weiß, hält es für einen Fehler. */}
            {cart.status === 'checkout_pending' ? (
              <Text style={styles.cartFrozen}>
                Zum Bezahlen vorgemerkt — dieses Paket nimmt nichts mehr auf. Was du danach
                gewinnst, kommt in ein neues, mit eigenem Versand.
              </Text>
            ) : null}

            {/* Was drin liegt, als Bilderreihe. Ein offenes Paket war vorher
                nur eine Zahl — man sah nicht, wofür man gleich bezahlt. */}
            {cart.items.length > 0 ? (
              <View style={styles.cartStrip}>
                {cart.items.slice(0, 6).map((item, index) => (
                  <View key={`${cart.id}-${index}`} style={styles.cartThumb}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={120}
                      />
                    ) : (
                      <Package size={15} color={ui.textMuted} />
                    )}
                  </View>
                ))}
                {cart.items.length > 6 ? (
                  <View style={[styles.cartThumb, styles.cartMore]}>
                    <Text style={styles.cartMoreText}>+{cart.items.length - 6}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              style={[styles.payButton, payingId === cart.id && styles.payButtonBusy]}
              disabled={payingId !== null}
              onPress={() => void pay(cart.id)}
              accessibilityRole="button"
              accessibilityLabel={
                cart.status === 'checkout_pending'
                  ? `Bezahlen fortsetzen, ${formatEuro(cart.totalCents)}`
                  : `${formatEuro(cart.totalCents)} bezahlen`
              }
            >
              {payingId === cart.id ? (
                <ActivityIndicator color={ui.goldInk} />
              ) : (
                <Text style={styles.payButtonText}>
                  {cart.status === 'checkout_pending'
                    ? `Bezahlen fortsetzen · ${formatEuro(cart.totalCents)}`
                    : `${formatEuro(cart.totalCents)} bezahlen`}
                </Text>
              )}
            </Pressable>
            <Text style={styles.payHint}>
              {[shippingHint(shippingFor(cart.seller_id)), 'Adresse gibst du auf der Bezahlseite ein.']
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        ))
      )}

      {/* Was schon bezahlt ist. Steht bewusst UNTER den offenen Paketen —
          eine wartende Zahlung ist dringender als eine erledigte. */}
      {orders.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { marginTop: space.lg }]}>Gekauft</Text>
          {orders.map((order) => {
            return (
              // Die ganze Karte führt auf die Detailseite. Sie bleibt eine
              // Zusammenfassung — Adresse, Bestellnummer und das große Bild
              // stehen dort. Bei zwanzig Bestellungen wäre alles inline genau
              // die Wand, die der Verkaufen-Reiter am 16.08. war.
              <Pressable
                key={order.id}
                style={({ pressed }) => [styles.card, pressed && styles.linkRowPressed]}
                onPress={() => router.push(`/order/${order.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Bestellung bei ${sellerNames[order.seller_id] ?? 'Verkäufer'} ansehen`}
              >
                <View style={styles.cartHead}>
                  <Package size={17} color={ui.text} />
                  <Text style={styles.cardTitle}>{sellerNames[order.seller_id] ?? '…'}</Text>
                  <Text style={styles.cartTotal}>
                    {Number(order.amount_eur).toFixed(2).replace('.', ',')} €
                  </Text>
                  <ChevronRight size={17} color={ui.textMuted} />
                </View>

                <Text style={styles.orderStatus}>{buyerStatus(order.status)}</Text>

                {/* Die Bestellung trägt nur eine Zusammenfassung wie „3 Artikel
                    aus der Live-Show". Was tatsächlich drin liegt, weiß nur der
                    Sammelkorb — und genau das will man hier sehen. */}
                {/* Mit Bild statt als Wortliste: Wer an einem Abend drei Sachen
                    gewonnen hat, erkennt sie am Foto, nicht an „Silberring,
                    handgemacht". Das Bild hängt ohnehin an der Auktion — es
                    wurde bis zum 16.08.2026 nur nicht mitgeholt. */}
                {order.items.length > 0 ? (
                  <View style={styles.orderItems}>
                    {order.items.map((item, index) => (
                      <View key={`${order.id}-${index}`} style={styles.orderItemRow}>
                        <View style={styles.orderThumb}>
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
                        <Text numberOfLines={1} style={styles.orderItem}>
                          {item.title}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : order.title ? (
                  <Text style={styles.cardBody}>{order.title}</Text>
                ) : null}

                {/* Nur der HINWEIS, dass etwas zu tun ist — die Handlung
                    selbst liegt auf der Detailseite.
                    Grund: Die Karte ist seit dem 16.08.2026 selbst ein Knopf.
                    Ein Knopf im Knopf ist in diesem Projekt schon einmal
                    schiefgegangen (Serlo v1.26.5, Verkäufer-Karte im Shop) —
                    dort musste das äußere Pressable wieder raus. */}
                {order.status === 'shipped' ? (
                  <Text style={styles.actionHint}>Angekommen? Hier eintragen →</Text>
                ) : order.status === 'delivered' && !myReviews[order.id] ? (
                  <Text style={styles.actionHint}>Noch nicht bewertet →</Text>
                ) : order.status === 'delivered' ? (
                  <View style={styles.reviewDone}>
                    <RatingStars value={myReviews[order.id]} size={15} readOnly />
                  </View>
                ) : order.tracking_number ? (
                  <Text style={styles.payHint}>
                    {order.tracking_carrier ?? 'Sendung'} · {order.tracking_number}
                  </Text>
                ) : (
                  <Text style={styles.payHint}>
                    Sobald der Verkäufer packt, steht die Sendungsnummer hier.
                  </Text>
                )}
              </Pressable>
            );
          })}
        </>
      ) : null}

      {notice ? (
        <Pressable style={styles.notice} onPress={() => setNotice(null)}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.signOut}
        onPress={() => void supabase.auth.signOut()}
        accessibilityRole="button"
      >
        <Text style={styles.signOutText}>Abmelden</Text>
      </Pressable>

      {/* ⚠️ Apple 5.1.1(v): Wer in der App ein Konto anlegen kann, muss es dort
          auch löschen können — und DSGVO Art. 17 verlangt die Löschung an sich.
          Berkat hatte bis zum 21.08.2026 nur „Abmelden"; beim Store-Release
          wäre das ein sicherer Ablehnungsgrund gewesen.

          Bewusst als schlichte Textzeile und nicht als Knopf: Der Weg muss
          ERREICHBAR sein, nicht einladend. Was dahinter passiert, erklärt der
          eigene Bildschirm — in einem Dialog ließe sich die Frage „ist mein Kauf
          dann weg?" nicht beantworten. */}
      <Pressable
        style={styles.deleteRow}
        onPress={() => router.push('/delete-account')}
        accessibilityRole="button"
        accessibilityLabel="Konto löschen"
      >
        <Text style={styles.deleteText}>Konto löschen</Text>
      </Pressable>

      {/* ⚠️ Welcher Stand läuft hier gerade? Am 22.08.2026 blieb ein Fund
          unentscheidbar, weil genau das niemand beantworten konnte (Abschnitt
          68). `expo-updates` startet immer aus dem Zwischenspeicher und nimmt
          eine neue Fassung erst beim NÄCHSTEN Start in Betrieb — an einem Tag
          mit fünfzehn Veröffentlichungen prüft man am Gerät also fast immer den
          vorletzten Stand. Begründung ausführlich in `lib/buildInfo.ts`.

          `selectable`, damit die Zeile aus einer Nachricht heraus lesbar ist —
          dieselbe Überlegung wie bei der Versandadresse in den Bestellungen.
          Kein Knopf: Es gibt nichts zu tun, nur etwas zu wissen. */}
      <Text selectable style={styles.buildLine}>
        {buildLabel()}
      </Text>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm },

  gateTitle: { fontSize: 18, fontWeight: '700', color: ui.text, marginTop: space.sm },
  gateBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    marginBottom: space.md,
    lineHeight: 20,
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xl,
  },
  name: { fontSize: 22, fontWeight: '700', color: ui.text },
  profileHint: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  wozBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 5,
    backgroundColor: ui.success,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  wozText: { fontSize: 11, fontWeight: '700', color: ui.successInk },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: ui.textMuted, marginBottom: space.sm },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    marginBottom: space.lg,
  },
  linkRowPressed: { opacity: 0.6 },
  linkLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: ui.text },
  linkWarn: { fontSize: 12, fontWeight: '600', color: ui.live },
  linkBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBadgeText: { fontSize: 11, fontWeight: '800', color: ui.goldInk },
  creditBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: ui.success,
  },
  creditBadgeText: { fontSize: 11, fontWeight: '700', color: ui.successInk },


  reviewDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  card: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    marginBottom: space.md,
    gap: 5,
  },
  cartHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cartStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm },
  cartThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cartMore: { backgroundColor: ui.lineStrong },
  cartMoreText: { fontSize: 12, fontWeight: '700', color: ui.card },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: ui.text },
  // Rot wäre falsch — es ist kein Fehler, sondern eine Folge. Gedämpft, aber
  // nicht überlesbar: Sie erklärt einen zweiten Versandposten.
  cartFrozen: { fontSize: 12, color: ui.textMuted, marginTop: space.sm, lineHeight: 17 },
  cartTotal: { fontSize: 16, fontWeight: '700', color: ui.text },

  orderStatus: { fontSize: 13, fontWeight: '600', color: ui.success },
  // Kein Knopf, sondern ein Zeiger: Die Handlung liegt eine Ebene tiefer, und
  // der Pfeil sagt genau das.
  actionHint: { fontSize: 13, fontWeight: '700', color: ui.brand, marginTop: 2 },
  orderItems: { gap: 6, marginTop: space.sm },
  orderItemRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  orderThumb: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orderItem: { flex: 1, fontSize: 13, color: ui.text },
  cardBody: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },
  payButton: {
    marginTop: space.sm,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonBusy: { opacity: 0.6 },
  payButtonText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
  payHint: { fontSize: 11, color: ui.textMuted, textAlign: 'center' },
  notice: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.live,
    padding: space.md,
    marginTop: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text },

  primaryButton: {
    backgroundColor: ui.gold,
    borderRadius: radius.pill,
    height: 50,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: ui.goldInk },
  // Textzeile, kein Knopf, und gedämpft statt rot: Rot wäre in Berkat die
  // laufende Uhr, und ein Dauer-Alarmzeichen im Konto-Reiter wäre eine Drohung.
  // Der Ernst gehört auf den Bildschirm dahinter, nicht auf den Weg dorthin.
  deleteRow: { marginTop: space.md, alignItems: 'center', paddingVertical: space.sm },
  deleteText: { fontSize: 13, color: ui.textMuted, textDecorationLine: 'underline' },
  // Leiser als alles andere auf dem Bildschirm: Die Zeile ist eine Auskunft für
  // den Fall, dass jemand fragt — nicht etwas, das man beim Scrollen liest.
  buildLine: { marginTop: space.sm, fontSize: 11, color: ui.textMuted, textAlign: 'center' },
  signOut: {
    marginTop: space.lg,
    height: 46,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: ui.text },
});
