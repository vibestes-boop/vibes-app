// Konto — wer du bist und was noch offen ist.

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  ChevronRight,
  ChevronDown,
  FileText,
  Truck,
  Gift,
  Heart,
  Lock,
  MessageSquare,
  Package,
  Wallet,
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
import { strikeNotice, useMyStrikes } from '../../lib/useUnpaidStrikes';
import { shippingHint, useShippingLookup } from '../../lib/useShipping';
import { useUnreadMessageCount } from '../../lib/useDirectMessages';
import { missingBusinessFields, useBerkatSeller } from '../../lib/useBerkatSeller';
import { onVacation } from '../../lib/useVacation';
import { useMyRewards } from '../../lib/useRewards';
import { useMyReviews } from '../../lib/useOrderReview';
import { buildLabel } from '../../lib/buildInfo';
import { errText } from '../../lib/errorText';
import {
  stripeConnectLabel,
  useStartStripeConnect,
  useStripeConnectState,
} from '../../lib/useStripeConnect';
import { RatingStars } from '../../components/RatingStars';
import { Avatar } from '../../components/Avatar';
import { BerkatMark } from '../../components/BerkatMark';
import { ui, radius, space } from '../../theme/tokens';
import { PressFeedback } from '../../components/PressFeedback';

type OpenCart = {
  id: string;
  seller_id: string;
  closes_at: string;
  /** Höchste Versandstufe im Paket — bestimmt, was der Käufer an Versand zahlt. */
  shippingTier: number;
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
function useLiveSellers(sellerIds: string[], enabled: boolean) {
  const key = [...new Set(sellerIds)].sort().join(',');
  return useQuery({
    queryKey: ['berkat', 'carts-live-sellers', key],
    enabled: enabled && key.length > 0,
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
function useMyCarts(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['berkat', 'my-carts', userId],
    enabled: enabled && Boolean(userId),
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
        // ⚠️ `shipping_tier` MUSS mit — aus demselben Grund wie `status` oben.
        // Ohne sie kennt der Bildschirm die Versandstufe des Pakets nicht und
        // zeigt den teuersten Satz („ab 4,90 €"), während die Kasse bei einem
        // Brief 1,19 € verlangt. Eine zu HOHE Angabe schreckt ab, und bei
        // 6-€-Ware entscheidet genau sie über den Kauf (`20260823140000`).
        .select('id, cart_id, current_bid_cents, title, image_url, shipping_tier')
        .in(
          'cart_id',
          rows.map((c) => c.id),
        )
        .eq('status', 'sold');
      if (wonError) throw wonError;

      const items = (won ?? []) as {
        id: string;
        cart_id: string;
        current_bid_cents: number | null;
        title: string;
        image_url: string | null;
        shipping_tier: number | null;
      }[];
      return rows.map((cart) => {
        const mine = items.filter((item) => item.cart_id === cart.id);
        return {
          ...cart,
          itemCount: mine.length,
          totalCents: mine.reduce((sum, item) => sum + (item.current_bid_cents ?? 0), 0),
          // Was drin liegt — vorher war ein offenes Paket nur eine Zahl.
          // ⚠️ `id` und Preis gehen MIT — ohne sie ist die Zeile im Paket
          // nicht antippbar und sagt nicht, was sie gekostet hat.
          items: mine.map((item) => ({
            id: item.id,
            title: item.title,
            image_url: item.image_url,
            price_cents: item.current_bid_cents,
          })),
          // Die Stufe eines PAKETS ist die höchste seiner Artikel — alles geht
          // in dieselbe Sendung. `?? 4` innen: Ein Artikel ohne Angabe muss die
          // teuerste Stufe erzwingen, sonst verbilligt eine Lücke den Satz.
          shippingTier: mine.length
            ? Math.max(...mine.map((item) => item.shipping_tier ?? 4))
            : 4,
        };
      });
    },
  });
}

export default function AccountScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const quickActionMinWidth = Math.min(width - space.lg * 2, Math.ceil(136 * Math.max(1, fontScale)));
  const router = useRouter();
  const myUserId = useSession((s) => s.userId);
  // Fehlen einem gewerblichen Verkäufer Pflichtangaben, steht das an der Zeile
  // — bei privat ist die Liste leer und es erscheint nichts.
  const { data: sellerRow } = useBerkatSeller(myUserId);
  const sellerMissing = missingBusinessFields(sellerRow ?? null);

  // Geld empfangen (Connect Standard, Übergabe 96). Der Zustand kommt vom
  // Server; hier wird nur angezeigt und angestossen.
  const { data: stripeState = 'none' } = useStripeConnectState(myUserId);
  const { start: startStripeConnect, isStarting: stripeStarting } =
    useStartStripeConnect(myUserId);
  const sellerAway = onVacation(sellerRow?.vacation_until);
  const profile = useSession((s) => s.profile);
  const { serverNow } = useServerClock();

  const {
    data: carts = [],
    refetch: refetchCarts,
    isLoading: cartsLoading,
    isError: cartsError,
  } = useMyCarts(myUserId, isFocused);
  // Offene Zuschlaege (`20260825160000`). Der Zaehler kommt aus der RPC, damit
  // der Zwoelf-Monats-Verfall nicht ein drittes Mal abgeschrieben wird.
  const { data: strikeCount = 0 } = useMyStrikes(myUserId);
  const strikeText = strikeNotice(strikeCount);
  const { data: liveSellers } = useLiveSellers(carts.map((c) => c.seller_id), isFocused);
  const {
    data: orders = [],
    refetch: refetchOrders,
    isLoading: ordersLoading,
    isError: ordersError,
  } = useMyOrders(myUserId, isFocused);
  const { data: unreadMessages = 0, refetch: refetchUnread } = useUnreadMessageCount(myUserId, isFocused);
  const { data: rewards, refetch: refetchRewards } = useMyRewards(myUserId, isFocused);
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
      if (!myUserId) return;
      void refetchCarts({ cancelRefetch: false });
      void refetchOrders({ cancelRefetch: false });
      void refetchUnread({ cancelRefetch: false });
      // Gutschriften entstehen serverseitig (Trigger auf `product_orders`).
      // Ohne diesen Ruf bliebe das Abzeichen stehen, bis die App neu startet.
      void refetchRewards({ cancelRefetch: false });
    }, [myUserId, refetchCarts, refetchOrders, refetchUnread, refetchRewards]),
  );
  const sellerNames = useUsernames([
    ...carts.map((c) => c.seller_id),
    ...orders.map((o) => o.seller_id),
  ]);

  const checkout = useCheckoutCart();
  const shippingFor = useShippingLookup();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expiredExpanded, setExpiredExpanded] = useState(false);
  const refreshAccount = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchCarts(), refetchOrders(), refetchUnread(), refetchRewards()]);
    } finally {
      setRefreshing(false);
    }
  };
  /**
   * ⚠️ Die Absage gehört AN DIE KARTE, nicht ans Seitenende (27.08.2026).
   *
   * Hier stand ein `notice: string | null`, gerendert ganz unten über
   * „Abmelden" — also hinter allen Paketen und der Liste „Gekauft". Zaur
   * meldete: *„wenn ich auf das Bezahlen klicke passiert nichts."* Es passierte
   * etwas: Der Server lehnte ab, die App schrieb den Grund auf — nur eben
   * ausserhalb des Sichtfelds, an einer Stelle, die niemand ansieht, der gerade
   * mitten auf der Seite auf einen Knopf getippt hat.
   *
   * **Eine Fehlermeldung, die woanders erscheint als die Handlung, ist keine.**
   * Dieselbe Familie wie „Der Server sagt: [object Object]" (Abschnitt 93) —
   * die Auskunft existiert und kommt trotzdem nicht an.
   */
  const [payNotice, setPayNotice] = useState<{ cartId: string; message: string } | null>(null);

  const startCheckout = async (cartId: string) => {
    setPayingId(cartId);
    setPayNotice(null);
    const result = await checkout(cartId);
    setPayingId(null);
    if (!result.ok) setPayNotice({ cartId, message: result.message });
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
  /**
   * Ist das 24-Stunden-Fenster vorbei?
   *
   * ⚠️ Dieselbe Rechnung wie `formatCartWindow` (`useAuction.ts`), das in
   * diesem Fall „Fenster zu" schreibt. Der Knopf hat sich bis zum 27.08.2026
   * nicht darum gekümmert: Er leuchtete weiter golden über einer Karte, auf der
   * „Fenster zu" stand, und tat beim Tippen nichts.
   */
  const isWindowClosed = (c: { closes_at: string }) =>
    new Date(c.closes_at).getTime() <= serverNow();
  const activeCarts: OpenCart[] = [];
  const expiredCarts: OpenCart[] = [];
  for (const cart of carts) {
    (isWindowClosed(cart) ? expiredCarts : activeCarts).push(cart);
  }

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

  // Eine Darstellung für offene und abgelaufene Pakete. Nur ihre Position
  // und Sichtbarkeit ändern sich; Frist, Zahlung und Hinweise bleiben gleich.
  const renderCart = (cart: OpenCart) => (
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

      {/* ── ⚠️ ZEILEN STATT BILDERREIHE (26.08.2026) ────────────────────
          Hier stand eine Reihe 44×44-Kacheln, eingeführt mit der
          richtigen Absicht („ein offenes Paket war vorher nur eine
          Zahl"). Am Gerät gemeldet und zu Recht: Bei EINEM Artikel ist
          ein einzelnes Quadrat keine Auskunft. Zaur: „garkeine
          produktbeschreibung oder titel und das bild ist klein sagt sehr
          wenig aus was das ist, und wenn man drauf klickt öffnet das
          produktdetailsseite nicht."

          Drei Dinge waren falsch, und das dritte ist das schlimmste:
            • kein Titel — man erkennt nicht, wofür man zahlt
            • zu klein, um es am Foto zu erkennen
            • **es sah aus wie ein Knopf und war keiner.**

          Jetzt: Zeile mit Bild im Karten-Format, Titel und Zuschlag,
          antippbar zur Artikelseite. Dort steht seit heute „Du hast den
          Zuschlag" — der Weg führt also nicht ins Nichts zurück. */}
      {cart.items.length > 0 ? (
        <View style={styles.cartItems}>
          {cart.items.slice(0, 6).map((item) => (
            <PressFeedback kind="card"
              key={`${cart.id}-${item.id}`}
              style={[styles.cartRow]}
              onPress={() => router.push(`/listing/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} ansehen`}
            >
              <View style={styles.cartThumb}>
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                  />
                ) : (
                  <Package size={16} color={ui.textMuted} />
                )}
              </View>
              <Text numberOfLines={2} style={styles.cartItemTitle}>
                {item.title}
              </Text>
              {item.price_cents !== null ? (
                <Text style={styles.cartItemPrice}>{formatEuro(item.price_cents)}</Text>
              ) : null}
              <ChevronRight size={16} color={ui.textMuted} />
            </PressFeedback>
          ))}
          {cart.items.length > 6 ? (
            <Text style={styles.cartMoreText}>
              +{cart.items.length - 6} weitere im Paket
            </Text>
          ) : null}
        </View>
      ) : null}

      <PressFeedback
        style={[
          styles.payButton,
          payingId === cart.id && styles.payButtonBusy,
          isWindowClosed(cart) && styles.payButtonDead,
        ]}
        disabled={payingId !== null || isWindowClosed(cart)}
        onPress={() => void pay(cart.id)}
        accessibilityRole="button"
        accessibilityState={{ disabled: payingId !== null || isWindowClosed(cart), busy: payingId === cart.id }}
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
            {isWindowClosed(cart)
              ? 'Fenster zu'
              : cart.status === 'checkout_pending'
                ? `Bezahlen fortsetzen · ${formatEuro(cart.totalCents)}`
                : `${formatEuro(cart.totalCents)} bezahlen`}
          </Text>
        )}
      </PressFeedback>
      {/* ⚠️ Bei zugefallenem Fenster sagt die Zeile, was gilt — ein
          „zzgl. Versand · Adresse gibst du auf der Bezahlseite ein"
          unter einem toten Knopf beschreibt einen Weg, den es nicht
          mehr gibt. */}
      <Text style={styles.payHint}>
        {isWindowClosed(cart)
          ? 'Die 24 Stunden sind vorbei — dieses Paket lässt sich nicht mehr bezahlen. '
            + 'Der Verkäufer stellt die Artikel wieder ein.'
          : [shippingHint(shippingFor(cart.seller_id, cart.shippingTier)), 'Adresse gibst du auf der Bezahlseite ein.']
              .filter(Boolean)
              .join(' · ')}
      </Text>

      {/* Die Absage des Servers, dort wo getippt wurde. */}
      {payNotice?.cartId === cart.id ? (
        <PressFeedback onPress={() => setPayNotice(null)} style={styles.notice}>
          <Text style={styles.noticeText}>{payNotice.message}</Text>
        </PressFeedback>
      ) : null}

      {/* ⚠️ WAS DER OFFENE KORB KANN, STAND NIRGENDS (27.08.2026)
          Am Gerät passiert: Zaur kaufte zwei Artikel bei DEMSELBEN
          Verkäufer, zahlte den ersten sofort — und bekam zwei
          Bestellungen mit zweimal Versand. Beides war mechanisch richtig
          (`ensure_auction_cart` sucht `open`, ein bezahlter Korb ist zu),
          aber 4,90 € zu teuer.

          Die Rückfrage dafür gibt es (`pay()` oben) — sie hängt aber an
          `sellerLive`. Beim Regal-Kauf sendet niemand, also kam sie nie.
          Und gerade dort ist der Fall wahrscheinlich: Man stöbert und
          findet zwei Sachen beim selben Anbieter.

          Bewusst KEINE zweite Rückfrage: Ein Alert vor einem Geldweg
          bremst und stellt eine Frage, die der Käufer nicht beantworten
          kann. Was ihm fehlt, ist eine Auskunft — und sie lädt zum
          Weiterstöbern ein, statt zu warnen. Der eingefrorene Korb sagt
          seit dem 19.08. den Gegensatz („nimmt nichts mehr auf"); hier
          stand die positive Hälfte nie.

          Die Zeile beschreibt die REGEL, nicht den Bestand — sie braucht
          deshalb keine Abfrage, wie viel der Verkäufer noch anbietet. */}
      {cart.status === 'open' && !isWindowClosed(cart) ? (
        <Text style={styles.payHint}>
          Was du in dieser Zeit noch bei {sellerNames[cart.seller_id] ?? 'diesem Verkäufer'}{' '}
          kaufst, kommt in dasselbe Paket — ein Versand.
        </Text>
      ) : null}
    </View>
  );

  if (!myUserId) {
    return (
      <View style={[styles.screen, styles.center, { padding: space.xl }]}>
        <BerkatMark size={40} color={ui.brand} />
        <Text style={styles.gateTitle}>Noch nicht angemeldet</Text>
        <Text style={styles.gateBody}>
          Mit einem Konto kannst du mitbieten, folgen und verkaufen. Deins von
          Serlo gilt hier auch.
        </Text>
        <PressFeedback style={styles.primaryButton} onPress={() => router.push('/login')} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Anmelden</Text>
        </PressFeedback>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.lg,
        paddingBottom: insets.bottom + space.xl,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refreshAccount()} tintColor={ui.brand} />
      }
    >
      {/* Nach einem iOS-Schriftwechsel müssen die Textmaße neu entstehen.
          Der ScrollView und der Zustand dieses Screens bleiben erhalten. */}
      <View key={fontScale}>
      <Text accessibilityRole="header" style={styles.pageTitle}>Konto</Text>
      {/* Die Tür zum eigenen Profil.
          Bis zum 16.08.2026 gab es keine: Acht Stellen in der App springen auf
          /seller/<id>, keine einzige mit der eigenen. Das eigene Regal, die
          eigenen Bürgen und die eigene Bio waren damit unerreichbar — man sah
          seine Seite nur so, wie ein Fremder sie NICHT sieht, nämlich gar nicht.
          Bei Whatnot IST der Konto-Reiter das Profil; hier führt er hin. */}
      <PressFeedback kind="card"
        style={[styles.profileRow]}
        onPress={() => myUserId && router.push(`/seller/${myUserId}`)}
        accessibilityRole="button"
        accessibilityLabel="Mein Profil ansehen"
      >
        <Avatar uri={profile?.avatar_url} name={profile?.username} size={64} ring />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={styles.name}>
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
      </PressFeedback>

      <View style={styles.quickActions}>
        <PressFeedback kind="card"
          style={[styles.quickAction, { minWidth: quickActionMinWidth }]}
          onPress={() => router.push('/messages')}
          accessibilityRole="button"
          accessibilityLabel={unreadMessages > 0 ? `Nachrichten, ${unreadMessages} ungelesen` : 'Nachrichten'}
        >
          <View style={styles.quickHead}>
            <View style={styles.quickIcon}><MessageSquare size={22} color={ui.brand} /></View>
            {unreadMessages > 0 ? (
              <View style={styles.linkBadge}>
                <Text style={styles.linkBadgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.quickLabel}>Nachrichten</Text>
          <Text style={styles.linkHint}>Deine Gespräche</Text>
        </PressFeedback>
        <PressFeedback kind="card"
          style={[styles.quickAction, { minWidth: quickActionMinWidth }]}
          onPress={() => router.push('/saved')}
          accessibilityRole="button"
          accessibilityLabel="Merkliste öffnen"
        >
          <View style={styles.quickHead}>
            <View style={styles.quickIcon}><Heart size={22} color={ui.brand} /></View>
            <ChevronRight size={18} color={ui.textMuted} />
          </View>
          <Text style={styles.quickLabel}>Merkliste</Text>
          <Text style={styles.linkHint}>Deine Favoriten</Text>
        </PressFeedback>
      </View>

      {/* ── ⚠️ OFFENE ZUSCHLÄGE ────────────────────────────────────────────
          Eine Sperre ohne Erklärung ist eine Wand. Wer nicht mehr bieten kann,
          muss hier lesen WARUM und WAS er tun kann — sonst hält er die App für
          kaputt und geht.

          ⚠️ Der Ton ist Absicht (Design-Gesetz 2). Wer drei Zuschläge nicht
          bezahlt hat, ist meistens kein Betrüger, sondern jemand, der drei
          Abende vergessen hat. Der Text nennt den Weg zurück — den Verkäufer
          ansprechen, der seine Meldung zurücknehmen kann — statt ein Urteil.

          Steht VOR den Paketen: Wer gesperrt ist, soll es lesen, bevor er nach
          etwas sucht, das er gerade nicht tun kann. */}
      {strikeText ? (
        <View style={[styles.card, styles.strikeCard]}>
          <Text style={styles.strikeTitle}>{strikeText.title}</Text>
          <Text style={styles.cardBody}>{strikeText.body}</Text>
        </View>
      ) : null}

      <Text accessibilityRole="header" style={styles.sectionLabel}>Deine Pakete</Text>
      {cartsLoading ? (
        <View style={styles.loadState}>
          <ActivityIndicator color={ui.brand} />
          <Text style={styles.cardBody}>Deine Pakete werden geladen …</Text>
        </View>
      ) : null}
      {cartsError ? (
        <View style={styles.card}>
          <Text style={styles.stateTitle}>Pakete gerade nicht erreichbar</Text>
          <Text style={styles.cardBody}>Lade sie noch einmal, damit du den aktuellen Stand siehst.</Text>
          <PressFeedback style={styles.retryButton} onPress={() => void refetchCarts()} accessibilityRole="button">
            <Text style={styles.retryText}>Erneut laden</Text>
          </PressFeedback>
        </View>
      ) : null}
      {!cartsLoading && !cartsError && activeCarts.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}><Package size={24} color={ui.brand} /></View>
          <View style={styles.emptyCopy}>
            <Text style={styles.stateTitle}>
              {expiredCarts.length > 0 ? 'Aktuell kein Paket offen' : 'Platz für deine nächsten Funde'}
            </Text>
            <Text style={styles.cardBody}>
              {expiredCarts.length > 0
                ? 'Deine abgelaufenen Pakete findest du weiter unten.'
                : 'Hier sammelst und bezahlst du deine offenen Artikel. Ein Paket bleibt bis zu 24 Stunden offen.'}
            </Text>
          </View>
        </View>
      ) : null}
      {activeCarts.map(renderCart)}

      {/* Was schon bezahlt ist. Steht bewusst UNTER den offenen Paketen —
          eine wartende Zahlung ist dringender als eine erledigte. */}
      {ordersLoading || ordersError || orders.length > 0 ? (
        <>
          <Text accessibilityRole="header" style={styles.sectionLabel}>Gekauft</Text>
          {ordersLoading ? (
            <View style={styles.loadState}>
              <ActivityIndicator color={ui.brand} />
              <Text style={styles.cardBody}>Deine Käufe werden geladen …</Text>
            </View>
          ) : null}
          {ordersError ? (
            <View style={styles.card}>
              <Text style={styles.stateTitle}>Deine Käufe fehlen gerade</Text>
              <Text style={styles.cardBody}>Versuche es noch einmal. Deine Bestellungen bleiben erhalten.</Text>
              <PressFeedback style={styles.retryButton} onPress={() => void refetchOrders()} accessibilityRole="button">
                <Text style={styles.retryText}>Erneut laden</Text>
              </PressFeedback>
            </View>
          ) : null}
          {orders.map((order) => {
            return (
              // Die ganze Karte führt auf die Detailseite. Sie bleibt eine
              // Zusammenfassung — Adresse, Bestellnummer und das große Bild
              // stehen dort. Bei zwanzig Bestellungen wäre alles inline genau
              // die Wand, die der Verkaufen-Reiter am 16.08. war.
              <PressFeedback kind="card"
                key={order.id}
                style={[styles.card]}
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
                        <Text numberOfLines={2} style={styles.orderItem}>
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
              </PressFeedback>
            );
          })}
        </>
      ) : null}

      {expiredCarts.length > 0 ? (
        <View style={styles.expiredSection}>
          <PressFeedback
            style={[styles.expiredToggle]}
            onPress={() => setExpiredExpanded((expanded) => !expanded)}
            accessibilityRole="button"
            accessibilityState={{ expanded: expiredExpanded }}
            accessibilityLabel={`Abgelaufene Pakete, ${expiredCarts.length}`}
          >
            <Package size={20} color={ui.textMuted} />
            <View style={styles.linkCopy}>
              <Text style={styles.linkLabel}>Abgelaufene Pakete ({expiredCarts.length})</Text>
              <Text style={styles.linkHint}>Zahlungsfenster geschlossen</Text>
            </View>
            {expiredExpanded ? <ChevronDown size={18} color={ui.textMuted} /> : <ChevronRight size={18} color={ui.textMuted} />}
          </PressFeedback>
          {expiredExpanded ? expiredCarts.map(renderCart) : null}
        </View>
      ) : null}

      <Text accessibilityRole="header" style={styles.sectionLabel}>Für dich</Text>
      <View style={styles.linkGroup}>
        <PressFeedback
          style={[styles.linkRow]}
          onPress={() => router.push('/rewards')}
          accessibilityRole="button"
          accessibilityLabel={openCredits > 0 ? `Einladen und Belohnungen, ${openCredits} Mal Gratis-Versand` : 'Einladen und Belohnungen'}
        >
          <Gift size={21} color={ui.brand} />
          <View style={styles.linkCopy}>
            <Text style={styles.linkLabel}>Einladen & Belohnungen</Text>
            {openCredits > 0 ? (
              <Text style={styles.creditText}>{openCredits}× Gratis-Versand verfügbar</Text>
            ) : (
              <Text style={styles.linkHint}>Berkat mit Freunden teilen</Text>
            )}
          </View>
          <ChevronRight size={18} color={ui.textMuted} />
        </PressFeedback>
        <PressFeedback
          style={[styles.linkRow, styles.linkRowLast]}
          onPress={() => router.push('/notification-settings')}
          accessibilityRole="button"
          accessibilityLabel="Benachrichtigungen einstellen"
        >
          <Bell size={21} color={ui.brand} />
          <View style={styles.linkCopy}>
            <Text style={styles.linkLabel}>Benachrichtigungen</Text>
            <Text style={styles.linkHint}>Du entscheidest, was ankommt</Text>
          </View>
          <ChevronRight size={18} color={ui.textMuted} />
        </PressFeedback>
      </View>

      {/* ⚠️ Eigene Gruppe, eigene Überschrift. Anbieterangaben und Versand
          sind Verkäufer-EINSTELLUNGEN — man rührt sie einmal an und danach
          selten. Sie in derselben Kette wie „Nachrichten" zu führen hiess,
          täglich Gebrauchtes und einmalig Eingerichtetes gleich laut zu
          machen. */}
      <Text accessibilityRole="header" style={styles.sectionLabel}>Verkaufen & Versand</Text>
      <View style={styles.linkGroup}>

      {/* ── ⚠️ GELD EMPFANGEN — steht ganz oben, und zwar mit Grund.
          Ohne verbundenes Stripe-Konto kann ein Verkäufer nichts verkaufen:
          An seinen Artikeln steht „Nachricht schreiben" statt „Kaufen"
          (`checkout_enabled`, gepflegt vom Trigger aus `20260827100000`).
          Das ist die einzige Einstellung dieser Gruppe, ohne die der ganze
          Rest folgenlos bleibt — Impressum und Versandsätze sind wertlos,
          solange niemand bezahlen kann.

          Der Zustand steht ausgeschrieben da statt als Haken: „Stripe prüft"
          und „bereit" sind zwei verschiedene Dinge, und wer das verwechselt,
          sendet einen Abend lang, ohne dass jemand kaufen kann. ─────────── */}
      <PressFeedback
        style={[styles.linkRow]}
        disabled={stripeStarting}
        accessibilityState={{ disabled: stripeStarting, busy: stripeStarting }}
        onPress={() => {
          void startStripeConnect().catch((e) =>
            Alert.alert('Das hat nicht geklappt', errText(e)),
          );
        }}
        accessibilityRole="button"
        accessibilityLabel={`Geld empfangen — ${stripeConnectLabel(stripeState).text}`}
      >
        <Wallet size={21} color={ui.brand} />
        <View style={styles.linkCopy}>
          <Text style={styles.linkLabel}>Geld empfangen</Text>
          {stripeStarting ? (
          <ActivityIndicator size="small" color={ui.textMuted} />
        ) : (
          <Text
            style={[
              styles.linkWarn,
              stripeConnectLabel(stripeState).tone === 'ok' && { color: ui.success },
              stripeConnectLabel(stripeState).tone === 'muted' && { color: ui.textMuted },
            ]}
          >
            {stripeConnectLabel(stripeState).text}
          </Text>
        )}
        </View>
        <ChevronRight size={18} color={ui.textMuted} />
      </PressFeedback>


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
      <PressFeedback
        style={[styles.linkRow]}
        onPress={() => router.push('/seller-details')}
        accessibilityRole="button"
        accessibilityLabel={
          sellerMissing.length > 0
            ? `Anbieterangaben, unvollständig: es fehlen ${sellerMissing.join(', ')}`
            : 'Anbieterangaben'
        }
      >
        <FileText size={21} color={ui.brand} />
        <View style={styles.linkCopy}>
          <Text style={styles.linkLabel}>Anbieterangaben</Text>
          {sellerMissing.length > 0 ? (
            <Text style={styles.linkWarn}>Angaben vervollständigen</Text>
          ) : (
            <Text style={styles.linkHint}>Verkäuferprofil und Kontaktdaten</Text>
          )}
        </View>
        <ChevronRight size={18} color={ui.textMuted} />
      </PressFeedback>

      {/* ── Versand und Urlaub. Beide beantworten dieselbe Frage — wie kommt
          meine Ware zum Käufer, und kommt sie gerade überhaupt — und stehen
          deshalb auf EINEM Bildschirm.

          Der Urlaubs-Zustand steht als Zeile und nicht nur dort drin: Ein
          ausgeblendetes Regal ist der eine Zustand, den man nicht vergessen
          darf. Gedämpft, nicht rot — Rot ist in Berkat die laufende Uhr, und
          ein Urlaub ist keine Frist. ──────────────────────────────────── */}
      <PressFeedback
        style={[
          styles.linkRow,
          styles.linkRowLast,
        ]}
        onPress={() => router.push('/shipping')}
        accessibilityRole="button"
        accessibilityLabel={sellerAway ? 'Versand — du bist gerade im Urlaub' : 'Versand'}
      >
        <Truck size={21} color={ui.brand} />
        <View style={styles.linkCopy}>
          <Text style={styles.linkLabel}>Versand</Text>
          <Text style={styles.linkHint}>{sellerAway ? 'Du bist gerade im Urlaub' : 'Versandkosten und Urlaub'}</Text>
        </View>
        <ChevronRight size={18} color={ui.textMuted} />
      </PressFeedback>
      </View>

      <PressFeedback
        style={styles.signOut}
        onPress={() => void supabase.auth.signOut()}
        accessibilityRole="button"
      >
        <Text style={styles.signOutText}>Abmelden</Text>
      </PressFeedback>

      {/* ⚠️ Apple 5.1.1(v): Wer in der App ein Konto anlegen kann, muss es dort
          auch löschen können — und DSGVO Art. 17 verlangt die Löschung an sich.
          Berkat hatte bis zum 21.08.2026 nur „Abmelden"; beim Store-Release
          wäre das ein sicherer Ablehnungsgrund gewesen.

          Bewusst als schlichte Textzeile und nicht als Knopf: Der Weg muss
          ERREICHBAR sein, nicht einladend. Was dahinter passiert, erklärt der
          eigene Bildschirm — in einem Dialog ließe sich die Frage „ist mein Kauf
          dann weg?" nicht beantworten. */}
      <PressFeedback
        style={styles.deleteRow}
        onPress={() => router.push('/delete-account')}
        accessibilityRole="button"
        accessibilityLabel="Konto löschen"
      >
        <Text style={styles.deleteText}>Konto löschen</Text>
      </PressFeedback>

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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm },

  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: ui.text, marginBottom: space.lg },
  gateTitle: { fontSize: 22, fontWeight: '700', color: ui.text, marginTop: space.sm },
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
    padding: space.lg,
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    marginBottom: space.md,
  },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: ui.text },
  profileHint: { fontSize: 13, lineHeight: 19, color: ui.textMuted, marginTop: 4 },
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
  wozText: { flexShrink: 1, fontSize: 11, lineHeight: 16, fontWeight: '700', color: ui.successInk },

  sectionLabel: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: ui.text, marginTop: space.md, marginBottom: space.md },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.md },
  quickAction: {
    flex: 1,
    minWidth: 136,
    padding: space.lg,
    gap: 3,
    borderRadius: radius.lg,
    backgroundColor: ui.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
  },
  quickHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  quickIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: ui.bg, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: ui.text },
  expiredSection: { marginTop: space.xs, marginBottom: space.md },
  expiredToggle: { minHeight: 64, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  emptyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, backgroundColor: ui.card, borderRadius: radius.lg, marginBottom: space.md },
  emptyIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: ui.bg, alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { flex: 1, minWidth: 0, gap: 5 },
  stateTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.text },
  loadState: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg, marginBottom: space.md },
  retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, marginTop: space.xs, backgroundColor: ui.bg, borderRadius: radius.sm },
  retryText: { color: ui.brand, fontSize: 14, lineHeight: 20, fontWeight: '700' },

  /* ── ⚠️ AUS SECHS KARTEN WURDE EINE LISTE (26.08.2026) ──────────────────
     Hier stand `backgroundColor` + `borderRadius` + `marginBottom: space.lg`
     an JEDER Zeile — sechs freischwebende Karten mit grossen Lücken
     dazwischen. Am Gerät gemeldet: „ich finde diese seite nicht schön".

     Der Fehler war nicht die einzelne Zeile, sondern dass es **sechs Objekte
     waren statt einer Liste**. Jede Lücke kostete Höhe, ohne etwas zu sagen —
     und „Nachrichten" (täglich) sah aus wie „Anbieterangaben" (einmal).

     Jetzt trägt die GRUPPE die Fläche, die Zeile nur eine Haarlinie — das
     Muster der iOS-Einstellungen. Zwei Gruppen statt einer Kette: was man
     täglich braucht, und was Verkäufer-Einstellung ist. */
  linkGroup: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: space.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  /* Die letzte Zeile einer Gruppe trägt keine Linie — sonst läge sie auf der
     abgerundeten Kante und sähe aus wie ein Fehler. */
  linkRowLast: { borderBottomWidth: 0 },
  linkCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 3 },
  linkLabel: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.text },
  linkHint: { fontSize: 12, lineHeight: 18, color: ui.textMuted },
  linkWarn: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: ui.live },
  linkBadge: {
    minWidth: 20,
    minHeight: 24,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBadgeText: { fontSize: 11, fontWeight: '800', color: ui.goldInk },
  creditText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: ui.success },

  reviewDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  strikeCard: { borderColor: ui.live },
  strikeTitle: { fontSize: 15, fontWeight: '700', color: ui.live },
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
  cartItems: { gap: space.xs, marginTop: space.xs },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cartItemTitle: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.text },
  cartItemPrice: { fontSize: 14, fontWeight: '700', color: ui.text },
  cartThumb: {
    /* 4:5 wie jede Karte in dieser App — ein Quadrat schneidet hochkant
       fotografierte Ware oben und unten ab. */
    width: 48,
    height: 60,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cartMoreText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: ui.textMuted, paddingVertical: space.xs },
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
  orderItem: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19, color: ui.text },
  cardBody: { flexShrink: 1, fontSize: 13, color: ui.textMuted, lineHeight: 20 },
  payButton: {
    marginTop: space.sm,
    minHeight: 50,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonBusy: { opacity: 0.6 },
  // ⚠️ Nicht bloss blasser, sondern GRAU. Ein abgeschwächtes Gold sieht aus
  // wie „lädt noch"; der Knopf ist aber endgültig tot, und das darf man ihm
  // ansehen, bevor man ihn antippt.
  payButtonDead: { backgroundColor: ui.sunken, opacity: 1 },
  payButtonText: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.goldInk, textAlign: 'center' },
  payHint: { fontSize: 12, lineHeight: 18, color: ui.textMuted, textAlign: 'center' },
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
    minHeight: 50,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: ui.goldInk },
  // Textzeile, kein Knopf, und gedämpft statt rot: Rot wäre in Berkat die
  // laufende Uhr, und ein Dauer-Alarmzeichen im Konto-Reiter wäre eine Drohung.
  // Der Ernst gehört auf den Bildschirm dahinter, nicht auf den Weg dorthin.
  deleteRow: { marginTop: space.sm, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: space.sm },
  deleteText: { fontSize: 13, color: ui.textMuted, textDecorationLine: 'underline' },
  // Leiser als alles andere auf dem Bildschirm: Die Zeile ist eine Auskunft für
  // den Fall, dass jemand fragt — nicht etwas, das man beim Scrollen liest.
  buildLine: { marginTop: space.sm, fontSize: 11, color: ui.textMuted, textAlign: 'center' },
  signOut: {
    marginTop: space.lg,
    minHeight: 50,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: ui.text },
});
