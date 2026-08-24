// Die Artikelseite — ein Angebot, ein Bildschirm.
//
// WARUM SIE FEHLTE UND WAS DAS KOSTETE
// Bis zum 17.08.2026 führte jeder Tipp auf ein Angebot auf `/seller/<id>`, also
// aufs Profil des Verkäufers. Man tippte auf „Silberring" und landete auf einer
// Seite voller anderer Produkte — genau der Fehler, der in HANDOFF 13 schon
// einmal beschrieben ist („man tippte auf ‚Fahrrad · Morgen 18:00' und landete
// auf einer Seite voller Produkte; das Einzige, wofür man gekommen war, war das
// Einzige, was nicht zu sehen war").
//
// Drei Dinge hingen daran:
//
//  1. Die BESCHREIBUNG war unsichtbar. Sie steht seit 20260816210000 in der
//     Datenbank, der Composer hat ein Feld dafür, die Abfrage holte sie — und
//     kein Bildschirm zeigte sie an. Bei einem Dauerangebot ist sie die einzige
//     Beschreibung, die es je geben wird: In einer Show erzählt der Verkäufer,
//     hier steht nur, was er getippt hat.
//
//  2. Die RECHTSFOLGE der Anbieterkennzeichnung stand nirgends. `sellerKindNote()`
//     existierte fertig in `useBerkatSeller.ts` und hatte keinen einzigen
//     Aufrufer; die Karten zeigten „Privatverkauf" als bloßes Etikett. Art. 246d
//     § 1 EGBGB verlangt aber, dass der Käufer VOR seiner Vertragserklärung
//     erfährt, was daraus folgt.
//
//  3. Der KAUF lag im Stöber-Raster. Am 16.08.2026 bekam schon das Gebot eine
//     Ziehbahn statt eines Tippers — „ein Bildschirm, auf dem Tippen die normale
//     Geste ist, darf keinen Kauf mit demselben Tippen auslösen". Ein Sofortkauf
//     schließt den Vertrag sofort und war trotzdem ein goldener Knopf zwischen
//     Stöber-Karten, ohne Beschreibung, ohne Versandkosten, ohne Rechtsfolge.
//
// Diese Seite ist die Antwort auf alle drei: Sie zeigt, was es zu wissen gibt,
// und trägt als einzige Fläche den Kaufknopf. Damit ist der Ort der
// Vertragserklärung genau der Ort, an dem die Pflichtangabe steht.
//
// Seit dem Vollausbau (17.08.2026 abends) außerdem: Bild-Galerie (alle Fotos,
// nicht nur das Cover), Teilen (die Website hat jetzt `/listing`), Merken-Herz,
// Bearbeiten für den Besitzer, „Angebot melden" und „Mehr von diesem Verkäufer".
// Zaur: „Dass es keine angebotenen Produkte gibt, ist kein Grund, die App nicht
// vollständig zu bauen."

import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  BellRing,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Lock,
  MessageCircle,
  Package,
  Share2,
  Star,
  Truck,
  X,
} from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { goBack } from '../../lib/nav';
import { listingLink } from '../../lib/links';
import { formatEuro, useProfiles } from '../../lib/useAuction';
import {
  conditionLabel,
  missingBusinessFields,
  sellerKindNote,
  useBerkatSeller,
} from '../../lib/useBerkatSeller';
import {
  listingImages,
  listingPrice,
  useListing,
  useSellerListings,
} from '../../lib/useListings';
import { useSavedIds, useToggleSaved } from '../../lib/useSaved';
import {
  offerErrorText,
  useOfferActions,
  useOffersForListing,
  type Offer,
} from '../../lib/useOffers';
import {
  reminderErrorText,
  useMyReminder,
  useReminderActions,
} from '../../lib/useReminders';
import { formatSlot } from '../../lib/useSchedule';
import { REPORT_REASONS, useSellerActions } from '../../lib/useSellerActions';
import { formatRating, formatShipTime, useSellerStats } from '../../lib/useSellerStats';
import { shippingHint, useShippingFrom } from '../../lib/useShipping';
import { standingErrorText, useStandingActions } from '../../lib/useStanding';
import { useVouches, vouchSummary } from '../../lib/useVouch';
import { Avatar } from '../../components/Avatar';
import { BerkatMark } from '../../components/BerkatMark';
import { ListingCard } from '../../components/ListingCard';
import { OfferPanel } from '../../components/OfferPanel';
import { StandingComposer } from '../../components/StandingComposer';
import { useSetShippingTier } from '../../lib/useShippingTier';
import { radius, ratio, space, ui } from '../../theme/tokens';

/** Ein Hinweis, der einen Weg mitbringen kann statt nur einen Rat. */
type Notice = { text: string; cta?: 'cart' };

/**
 * Erfolgs-Haptik für den einzigen Kaufweg der App.
 *
 * ⚠️ Geladen wie LiveKit und `expo-web-browser`: **bedingt per `require` in
 * `try/catch`.** `expo-haptics` steht zwar in der `package.json`, wurde aber
 * bis zum 17.08.2026 nirgends importiert — ob das native Gegenstück in einem
 * gegebenen Build tatsächlich verlinkt ist, weiß niemand. Ein statischer Import
 * würde beim Laden der Datei werfen und den ganzen Bildschirm mitreißen; ohne
 * das Modul fällt hier schlicht die Vibration weg.
 */
function celebrate(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const H = require('expo-haptics');
    void H.notificationAsync?.(H.NotificationFeedbackType?.Success);
  } catch {
    // Kein Haptik-Modul im Build — der Kauf hat trotzdem geklappt.
  }
}

/**
 * „Eingestellt heute" ist eine Auskunft, „Eingestellt am 17.08.26" nicht.
 *
 * Gerechnet wird in KALENDERTAGEN, nicht in Millisekunden — `(a - b) / 86_400_000`
 * beantwortet „wie viele 24-Stunden-Blöcke liegen dazwischen", nicht „welcher
 * Tag ist das". Ein Artikel von gestern 23:00 wäre um 08:00 morgens sonst
 * „heute". Dieselbe Unterscheidung wie bei den Show-Zeiten (HANDOFF 18).
 */
function listedWhen(iso: string): string {
  const then = new Date(iso);
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (days <= 0) return 'heute eingestellt';
  if (days === 1) return 'gestern eingestellt';
  if (days < 7) return `vor ${days} Tagen eingestellt`;
  if (days < 14) return 'vor einer Woche eingestellt';
  if (days < 60) return `vor ${Math.round(days / 7)} Wochen eingestellt`;
  return `eingestellt am ${then.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })}`;
}

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const sessionLoading = useSession((s) => s.loading);
  // Vor den frühen returns, wie jeder Hook hier — Rules of Hooks. Gebraucht
  // erst weit unten im Bearbeiten-Blatt (Frauen-Only-Schalter).
  const canWomenOnly = useSession((s) => Boolean(s.profile?.women_only_verified));

  const { data: listing, isLoading, refetch } = useListing(id);
  const sellerId = listing?.seller_id;

  const profiles = useProfiles([sellerId]);
  const seller = sellerId ? profiles[sellerId] : undefined;
  const { data: stats } = useSellerStats(sellerId);
  const { data: sellerRow, isLoading: sellerLoading } = useBerkatSeller(sellerId);
  // ⚠️ MIT der Stufe des Artikels. Ohne sie zeigte die Seite den billigsten
  // Satz überhaupt (1,19 € Brief), und die Kasse verlangte 4,90 € — zwei
  // Wahrheiten über denselben Preis, und die teurere gewinnt beim Bezahlen.
  const { data: shipFrom } = useShippingFrom(sellerId, listing?.shipping_tier);

  const actions = useStandingActions(sellerId, myUserId);
  const setTier = useSetShippingTier();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  /** Die Rechtsfolge unter der Anbieterkennzeichnung — zu, bis jemand fragt. */
  const [legalOpen, setLegalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Galerie: EIN aktiver Index, gesetzt am ENDE der Scroll-Animation — nicht
  // per onScroll. Das ist die Serlo-Lehre v1.26.8: Wer bei jedem Frame setzt,
  // lässt die Punkte beim Blättern hin- und herspringen.
  const { width: screenWidth } = useWindowDimensions();
  const [imageIndex, setImageIndex] = useState(0);
  const onGalleryEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const w = e.nativeEvent.layoutMeasurement.width || 1;
      setImageIndex(Math.round(e.nativeEvent.contentOffset.x / w));
    },
    [],
  );

  // Merken. Das Set kommt aus einer eigenen Mini-Abfrage (useSavedIds), damit
  // jede Fläche dieselbe Wahrheit liest; der Toggle setzt beide Schlüssel zurück.
  const { data: savedIds } = useSavedIds(myUserId);
  const toggleSaved = useToggleSaved(myUserId);
  const isSaved = Boolean(id && savedIds?.has(id));

  // „Mehr von diesem Verkäufer" — dieselbe Abfrage wie das Profil-Regal, der
  // aktuelle Artikel wird nur herausgefiltert.
  const { data: sellerListings = [] } = useSellerListings(sellerId);
  const moreFromSeller = useMemo(
    () => sellerListings.filter((l) => l.id !== id).slice(0, 6),
    [sellerListings, id],
  );

  // Bürgen — dieselbe Zeile wie im Verkäufer-Sheet des Live-Raums.
  const { data: vouches = [] } = useVouches(sellerId, myUserId);
  const vouchLine = vouchSummary(vouches);

  const sellerActions = useSellerActions(myUserId);

  // Preisvorschläge. Die RLS gibt dem Käufer genau seinen, dem Verkäufer alle —
  // eine Abfrage, zwei Sichten, keine Fallunterscheidung hier.
  const { data: offers = [] } = useOffersForListing(id, myUserId);
  const offerActions = useOfferActions(id, myUserId);
  const [offerBusy, setOfferBusy] = useState(false);

  // Dieselbe Falle wie überall: Stack-Bildschirme bleiben aufgebaut. Wer von
  // hier auf das Profil geht, den Artikel dort zurückzieht und zurückkommt,
  // sähe sonst weiter einen Kaufknopf für etwas, das es nicht mehr gibt.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const mine = Boolean(myUserId && listing && myUserId === listing.seller_id);
  /**
   * Für einen Abend vorbereitet — der Artikel ist da, aber noch nicht dran.
   *
   * ⚠️ Seit dem 25.08.2026 kommt man hier überhaupt erst an: Vorher war
   * Show-Ware in keiner Stöber-Abfrage, diese Seite also nur über einen
   * direkten Link erreichbar.
   */
  const upcoming = Boolean(listing && listing.status === 'scheduled');
  const showSlot = listing?.show?.scheduled_at ?? null;
  /**
   * ⚠️ HIER STAND `status !== 'listed'`, UND DAS WAR EINE ZEITBOMBE.
   *
   * Mit `scheduled` in der Stöber-Liste hätte dieselbe Zeile jeden für Freitag
   * vorbereiteten Artikel als **„Zurückgezogen"** ausgezeichnet, den Kaufweg
   * ausgeblendet und den Verkäufer-Block gesperrt — bei einem Artikel, der
   * gerade beworben wird. Dieselbe Negation, dieselbe Ursache und dieselbe
   * Reparatur wie in `ListingCard`: Was weg ist, wird beim Namen genannt.
   */
  const gone = Boolean(
    listing && (listing.status === 'sold' || listing.status === 'cancelled'),
  );

  /**
   * Die Glocke — der Kaufweg für einen Artikel, den man noch nicht kaufen kann.
   *
   * Kein neuer Mechanismus: `berkat_auction_reminders` gibt es seit dem
   * 19.08.2026 (Abschnitt 51), und `start_live_auction` verbraucht die Zeile
   * beim Auktionsstart. Sie war bisher nur an EINER Stelle erreichbar — im
   * Aufgebot am Termin (`LineupPreview`). Wer über die Suche hierherkommt,
   * hätte sonst gelesen, dass es den Artikel gibt, und wäre ohne Weg gegangen.
   *
   * ⚠️ Die Bedingung sitzt im ersten Parameter, nicht in einem `if`: Hooks
   * dürfen nicht bedingt aufgerufen werden, und `useMyReminder` schaltet sich
   * bei `undefined` selbst ab.
   */
  const { data: reminderOn } = useMyReminder(upcoming ? id : undefined, myUserId);
  const { toggle: toggleReminder } = useReminderActions(myUserId);
  const [reminderNotice, setReminderNotice] = useState<string | null>(null);
  /** Steuert NUR den Rechtstext — nicht den Weg. Siehe `canCheckout`. */
  const isPrivate = listing?.seller_kind === 'private';

  /**
   * ⚠️ Der Kaufweg hängt an `checkout_enabled`, NICHT an `seller_kind`.
   *
   * Bis zum 17.08.2026 entschied die Oberfläche „privat → Nachricht, sonst
   * Kaufen", der Server aber an `berkat_sellers.checkout_enabled`
   * (`buy_now_live_auction`, Wächter 2). Das sind zwei verschiedene Spalten für
   * dieselbe Frage, und sie liefen zwangsläufig auseinander:
   *
   *   • `set_berkat_seller_kind` fasst `checkout_enabled` ausdrücklich nicht an
   *   • jede neu entstandene Zeile trägt die Vorgabe `false`
   *
   * Ein gewerblicher Verkäufer hatte damit per Konstruktion `kind = 'business'`
   * UND `checkout_enabled = false` — die App zeigte ihm einen goldenen
   * Kaufknopf, den der Server garantiert mit `contact_seller` verweigert. Und
   * ein Angebot mit `seller_kind = NULL` bekam ihn ebenfalls: `isPrivate` ist
   * eine zweiwertige Prüfung auf einer dreiwertigen Spalte.
   *
   * Jetzt gilt: `checkout_enabled` entscheidet den Knopf, `seller_kind` den
   * Text. Wer das wieder zusammenlegt, baut die Sackgasse zurück.
   */
  const canCheckout = sellerRow?.checkout_enabled === true;

  const missing = useMemo(() => missingBusinessFields(sellerRow ?? null), [sellerRow]);

  /**
   * Der Gast-Zweig.
   *
   * ⚠️ `session.loading` muss mit: Beim Kaltstart steht `userId` kurz auf
   * `null`, obwohl eine Sitzung existiert. Ohne die Abfrage schickte ein
   * schneller Tipp einen Angemeldeten auf die Anmeldeseite — auf dem Kaufweg
   * ist das teurer als anderswo.
   */
  const needsLogin = useCallback((): boolean => {
    if (sessionLoading) return true;
    if (!myUserId) {
      router.push('/login');
      return true;
    }
    return false;
  }, [myUserId, sessionLoading]);

  const onBuy = useCallback(async () => {
    if (!listing || needsLogin()) return;
    setBusy(true);
    setNotice(null);
    try {
      await actions.buy.mutateAsync({ id: listing.id });
      // Design-Gesetz 1: Ein Kauf ist ein Peak. Auge und Hand zusammen — und
      // danach ein WEG, keine Wegbeschreibung. Vorher endete der teuerste
      // Moment der App in einem Satz („Bezahlen kannst du unter ‚Konto'"), und
      // der Käufer musste zweimal zurück und einen Reiter suchen.
      celebrate();
      setNotice({ text: 'Im Paket. 🎉', cta: 'cart' });
    } catch (err) {
      setNotice({ text: standingErrorText(err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  }, [actions.buy, listing, needsLogin]);

  // ⚠️ Der Artikel geht MIT (`20260822140000`). Vorher stand sein Titel nur im
  // Entwurfstext — und mehr kam beim Verkäufer nicht an: kein Bild, kein Preis,
  // kein Weg zum Angebot. Bei dreißig Angeboten, von denen mehrere ähnlich
  // heißen, ist ein Titel im Fließtext keine Auskunft.
  const onContact = useCallback(() => {
    if (!listing || needsLogin()) return;
    router.push(
      `/messages/${listing.seller_id}?draft=${encodeURIComponent(
        `Hallo! Ist „${listing.title}" noch da?`,
      )}&listing=${listing.id}`,
    );
  }, [listing, needsLogin]);

  const onCancel = useCallback(async () => {
    if (!listing) return;
    setBusy(true);
    setNotice(null);
    try {
      await actions.cancel.mutateAsync(listing.id);
      setNotice({ text: 'Zurückgezogen.' });
    } catch (err) {
      setNotice({ text: standingErrorText(err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  }, [actions.cancel, listing]);

  /**
   * Ein Ruf für alle vier Vorschlag-Aktionen — sie teilen Anmeldung,
   * Sperr-Zustand und Fehlerbehandlung. Die Meldung nutzt denselben
   * Hinweis-Kasten wie der Kauf.
   */
  const runOffer = useCallback(
    async (fn: () => Promise<unknown>, okText: string) => {
      if (needsLogin()) return;
      setOfferBusy(true);
      setNotice(null);
      try {
        await fn();
        setNotice({ text: okText });
      } catch (err) {
        setNotice({ text: offerErrorText(err instanceof Error ? err.message : String(err)) });
      } finally {
        setOfferBusy(false);
      }
    },
    [needsLogin],
  );

  /**
   * Eine angenommene Zusage einlösen. Derselbe Kaufweg wie sonst — die RPC
   * bekommt nur zusätzlich die Vorschlag-Kennung und rechnet dann mit dem
   * vereinbarten statt dem Listenpreis.
   */
  const onBuyAccepted = useCallback(
    async (offer: Offer) => {
      if (!listing || needsLogin()) return;
      setOfferBusy(true);
      setNotice(null);
      try {
        await actions.buy.mutateAsync({ id: listing.id, offerId: offer.id });
        celebrate();
        setNotice({ text: 'Im Paket. 🎉', cta: 'cart' });
      } catch (err) {
        setNotice({ text: standingErrorText(err instanceof Error ? err.message : String(err)) });
      } finally {
        setOfferBusy(false);
      }
    },
    [actions.buy, listing, needsLogin],
  );

  const onShare = useCallback(() => {
    if (!listing) return;
    // `Share` ist Kern-React-Native, kein natives Zusatzmodul — kein Build.
    // Der Link führt auf die Web-Seite (`/listing?id=…`), und die trägt den
    // „In Berkat öffnen"-Knopf. So funktioniert er auch bei Empfängern ohne App
    // — also bei genau denen, für die man teilt.
    // ⚠️ Bei Show-Ware gehört der Termin MIT in die geteilte Nachricht — sie
    // ist der eigentliche Zweck des Teilens („komm Freitag dazu"), und ohne
    // ihn stünde dort ein Startpreis, den der Empfänger für den Preis hält.
    const p = listingPrice(listing);
    const when = listing.show ? ` · live ${formatSlot(listing.show.scheduled_at)}` : '';
    void Share.share({
      message: `${listing.title} · ${p.from ? 'ab ' : ''}${formatEuro(p.cents)}${when}\n${listingLink(listing.id)}`,
    }).catch(() => {
      // Abgebrochenes Teilen ist kein Fehler.
    });
  }, [listing]);

  const onToggleSaved = useCallback(() => {
    if (!listing || needsLogin()) return;
    toggleSaved.mutate({ auctionId: listing.id, saved: isSaved });
  }, [listing, needsLogin, toggleSaved, isSaved]);

  const onReport = useCallback(
    async (reason: (typeof REPORT_REASONS)[number]['key']) => {
      if (!listing || needsLogin()) return;
      setReportOpen(false);
      // `user_reports` meldet MENSCHEN — das Angebot steht in der Notiz. Eine
      // eigene Angebots-Melde-Tabelle wäre eine zweite Königin für denselben
      // Posteingang; wer prüft, will ohnehin den Verkäufer sehen.
      const result = await sellerActions.report(
        listing.seller_id,
        reason,
        `Angebot: „${listing.title}" (${listing.id})`,
      );
      setNotice({
        text: result.ok ? 'Danke — wir schauen uns das an.' : result.message,
      });
    },
    [listing, needsLogin, sellerActions],
  );

  // Rechts zwei Knöpfe, links deshalb ein unsichtbarer Zwilling — sonst rutscht
  // der Titel aus der Mitte. Teilen und Merken stehen im Kopf, weil beides
  // AUCH für einen verkauften Artikel sinnvoll bleibt, wenn die Leiste unten
  // längst „Schon verkauft" sagt.
  const header = (
    <View style={styles.header}>
      <Pressable hitSlop={10} onPress={() => goBack('/shop')} style={styles.back}>
        <ChevronLeft size={24} color={ui.text} />
      </Pressable>
      <View style={styles.back} />
      <Text style={styles.headerTitle}>Angebot</Text>
      <Pressable
        hitSlop={8}
        style={styles.back}
        onPress={onToggleSaved}
        accessibilityRole="button"
        accessibilityState={{ selected: isSaved }}
        accessibilityLabel={isSaved ? 'Nicht mehr merken' : 'Merken'}
      >
        <Heart
          size={21}
          color={isSaved ? ui.success : ui.text}
          fill={isSaved ? ui.success : 'transparent'}
        />
      </Pressable>
      <Pressable
        hitSlop={8}
        style={styles.back}
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel="Angebot teilen"
      >
        <Share2 size={20} color={ui.text} />
      </Pressable>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={ui.brand} />
        </View>
      </View>
    );
  }

  // `null` heißt: gibt es nicht — oder es ist ein Frauen-Only-Artikel, für den
  // dem Betrachter der Zugang fehlt. Beides bekommt bewusst DENSELBEN Text,
  // damit die Existenz eines geschützten Artikels nicht über die Antwort
  // durchsickert. Dieselbe Sprache spricht `buy_now_live_auction` seit
  // 20260816210000 serverseitig.
  if (!listing) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          <BerkatMark size={38} color={ui.sunken} />
          <Text style={styles.emptyTitle}>Dieses Angebot gibt es nicht mehr</Text>
          <Text style={styles.emptyBody}>
            Vielleicht wurde es verkauft oder zurückgezogen. Unter „Kategorien" liegt, was
            gerade sonst noch da ist.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.replace('/shop')}>
            <Text style={styles.emptyBtnText}>Alle Angebote ansehen</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const images = listingImages(listing);

  // Größe zuerst — bei Kleidung und Schuhen ist sie die Frage, die vor allen
  // anderen beantwortet werden muss. Dieselbe Reihenfolge wie in `listingMeta`,
  // damit Karte und Artikelseite dieselbe Auskunft in derselben Ordnung geben.
  const meta = [
    listing.size ? `Gr. ${listing.size}` : null,
    conditionLabel(listing.condition),
    [listing.postal_code, listing.city].filter(Boolean).join(' ') || null,
  ].filter(Boolean) as string[];

  const kindNote = sellerKindNote(listing.seller_kind);
  const ship = shippingHint(shipFrom);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}

      <ScrollView
        contentContainerStyle={{
          // Die Leiste unten verdeckt NICHTS: Sie ist ein normales
          // Flex-Geschwister im Wurzel-View, keine schwebende Ebene, und die
          // ScrollView schrumpft von selbst auf den Rest. Sie trägt auch die
          // Sicherheitszone selbst — hier wäre `insets.bottom` doppelt.
          //
          // Das Polster ist nur ein sauberer Abschluss. Absolut liegt einzig
          // der Hinweis-Kasten, und der ist flüchtig und wegtippbar.
          paddingBottom: space.xl,
        }}
      >
        {/* ── Die Galerie. Hochkant (`ratio.card`) und volle Breite: Hier wird
            gestöbert, und auf einer Stöber-Fläche IST das Bild der Inhalt
            (HANDOFF 18). Geblättert wird seitenweise, der Punkt-Index folgt am
            ENDE der Animation (onMomentumScrollEnd, Serlo-Lehre v1.26.8).

            ⚠️ Die Höhe der EINZELBILDER muss der Höhe der Fläche folgen. Beim
            Umstellen auf Hochformat am 18.08.2026 stand hier weiter
            `height: screenWidth` — die Fläche war 4:5 hoch, die Bilder darin
            quadratisch, und unter jedem Foto klaffte ein sandfarbener
            Streifen. ──────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {images.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onGalleryEnd}
            >
              {images.map((url) => (
                <Image
                  key={url}
                  source={{ uri: url }}
                  style={{ width: screenWidth, height: screenWidth / ratio.card }}
                  contentFit="cover"
                  transition={160}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.heroEmpty}>
              <BerkatMark size={44} color={ui.lineStrong} />
            </View>
          )}
          {listing.women_only ? (
            <View style={styles.heroLock}>
              <Lock size={12} color={ui.successInk} />
              <Text style={styles.heroLockText}>Frauen-Only</Text>
            </View>
          ) : null}
          {/* Punkte nur, wenn es etwas zu blättern gibt — ein einzelner Punkt
              wäre ein Versprechen ohne Inhalt. Auf `ui.overlay`, weil darunter
              ein fremdes Foto liegt (Bestandsliste an `ui.overlay`). */}
          {images.length > 1 ? (
            <View style={styles.dots}>
              {images.map((url, i) => (
                <View key={url} style={[styles.dot, i === imageIndex && styles.dotOn]} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {/* ── Preis vor Titel. Bei einem Festpreis ist die Zahl die Frage,
              die zuerst beantwortet werden muss. ─────────────────────────── */}
          {/* ⚠️ „zzgl. Versand" GEHÖRT AN DEN PREIS, nicht hinter den Knopf.
              Der Versandsatz stand bisher unter dem Kaufknopf — gut formuliert
              („Kommt in dasselbe Paket, du zahlst nur einmal Versand"), aber zu
              spät: Man liest die Zahl, entscheidet, und erfährt erst danach,
              dass mehr kommt.
              Whatnot setzt „+ shipping + taxes" direkt neben den Preis
              (Analyse 13). Der ausführliche Satz bleibt unten stehen, wo er
              erklärt; hier steht nur die Warnung, dass die Zahl nicht die
              ganze ist. */}
          {/* ⚠️ Bei Show-Ware ist die grosse Zahl der STARTPREIS, nicht der
              Kaufpreis. Sie unverändert stehen zu lassen wäre die teuerste
              Zeile dieses Bildschirms: „1 €" gross oben, und darunter eine
              Auktion, die bei 80 € endet. */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {upcoming
                ? `ab ${formatEuro(listing.start_price_cents)}`
                : formatEuro(listing.buy_now_cents)}
            </Text>
            <Text style={styles.priceAdd}>zzgl. Versand</Text>
          </View>
          <Text style={styles.title}>{listing.title}</Text>

          {/* Der Termin direkt unter dem Titel — vor Zustand, Ort und
              Beschreibung. Er ist bei diesem Artikel die Bedingung für alles
              Weitere: Wer Freitag nicht kann, muss den Rest nicht lesen. */}
          {upcoming ? (
            <View style={styles.showNote}>
              <CalendarClock size={16} color={ui.live} />
              <Text style={styles.showNoteText}>
                {showSlot
                  ? `Wird versteigert — ${formatSlot(showSlot)} live`
                  : 'Wird in einer kommenden Sendung versteigert'}
              </Text>
            </View>
          ) : null}

          {meta.length ? (
            <View style={styles.chips}>
              {meta.map((text) => (
                <View key={text} style={styles.chip}>
                  <Text style={styles.chipText}>{text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.when}>{listedWhen(listing.created_at)}</Text>

          {/* ── Die Pflichtangabe nach Art. 246d § 1 EGBGB, mit Rechtsfolge.
              Steht ÜBER der Beschreibung und damit vor allem, was zum Kauf
              überredet — sie ist keine Fußnote.

              Berkat formuliert dabei ausdrücklich KEINEN Gewährleistungs-
              ausschluss: Ein von der Plattform gestellter Standardsatz wäre
              eine AGB nach §§ 305 ff. BGB, auch zwischen Privatleuten, und
              nach § 309 Nr. 7 BGB unwirksam — der Privatverkäufer stünde
              schlechter da als ohne unsere „Hilfe". Wir kennzeichnen nur, WER
              verkauft, und sagen, was daraus folgt.

              ⚠️ SEIT 18.08.2026 EINE ZEILE STATT EINES KASTENS.
              Zaurs Einwand: „Leute wollen beim Kaufen genießen, sie kommen
              nicht, um eingeschüchtert zu werden." Richtig — und die Pflicht
              betrifft, DASS die Angabe vor der Vertragserklärung dasteht,
              nicht wie laut. Die Rechtsfolge liegt deshalb hinter einem Tipp:
              sichtbar für jeden, der sie sucht, ohne den Weg zur Ware zu
              verstellen.

              Die Zeile selbst bleibt IMMER sichtbar. Sie ganz hinter den Tipp
              zu legen wäre der Fehler, den Abschnitt 3 schon einmal
              beschreibt — bei dieser Angabe ist Berkat bereits einmal
              danebengelegen. ──────────────────────────────────────────────── */}
          {kindNote ? (
            <Pressable
              style={styles.legalRow}
              onPress={() => setLegalOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: legalOpen }}
              accessibilityLabel={`${kindNote} — was das bedeutet`}
            >
              <View style={styles.legalHead}>
                <Text style={styles.legalText}>{kindNote}</Text>
                <ChevronDown
                  size={15}
                  color={ui.textMuted}
                  style={legalOpen ? styles.chevOpen : undefined}
                />
              </View>
              {legalOpen ? (
                <Text style={styles.legalSub}>
                  {isPrivate
                    ? 'Ein Privatverkauf zwischen zwei Menschen. Was der Verkäufer zum Zustand schreibt, gilt — Rückgabe ist Verhandlungssache.'
                    : 'Gewerblicher Verkauf. 14 Tage Widerrufsrecht und gesetzliche Gewährleistung.'}
                </Text>
              ) : null}
            </Pressable>
          ) : null}

          {/* ── Die Beschreibung. Bis heute unsichtbar. ──────────────────── */}
          {listing.description ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Beschreibung</Text>
              <Text style={styles.description}>{listing.description}</Text>
            </View>
          ) : null}

          {/* ── Preisvorschläge. Steht ÜBER der Verkäuferkarte und unter der
              Beschreibung: Wer handeln will, hat den Artikel gelesen und noch
              nicht auf den Menschen geschaut. Der Kaufknopf unten bleibt
              unberührt — beides sind Wege zum selben Artikel, und keiner
              verdrängt den anderen. ──────────────────────────────────────── */}
          {/* ⚠️ Bei Show-Ware gar nicht erst rendern, und zwar nicht aus
              Geschmack: `prepare_live_auction` setzt `accepts_offers` nie, die
              Spalte steht also ab Werk auf `false`, und `make_berkat_offer`
              lehnt jeden Vorschlag darauf ab. Das Blatt hätte einen
              Bezugspreis gebraucht, den es dort nicht gibt — und hätte einen
              Weg gezeigt, den der Server garantiert verweigert. Genau die
              Sackgasse, die auf diesem Bildschirm schon einmal stand (der
              goldene Kaufknopf ohne Kassen-Freigabe, 17.08.2026). */}
          {/* ⚠️ Und ohne Preis erst recht nicht: Ein Preisvorschlag misst sich
              am Listenpreis (`OfferPanel` lässt nur Beträge DARUNTER zu). Fehlt
              der, gäbe es keine Obergrenze — der Vorschlag wäre eine Zahl ohne
              Bezug. Preislose Regal-Zeilen entstehen seit `20260824180000`
              beim Freigeben vorbereiteter Ware; siehe Übergabe 88, Nachtrag. */}
          {!gone && !upcoming && listing.buy_now_cents !== null ? (
            <OfferPanel
              offers={offers}
              isSeller={mine}
              myUserId={myUserId}
              priceCents={listing.buy_now_cents}
              open={listing.accepts_offers}
              busy={offerBusy}
              onMake={(amount) =>
                void runOffer(
                  () => offerActions.make.mutateAsync(amount),
                  'Vorschlag ist raus. 🤝',
                )
              }
              onRespond={(offerId, action, counterCents) =>
                void runOffer(
                  () => offerActions.respond.mutateAsync({ offerId, action, counterCents }),
                  action === 'accept'
                    ? 'Angenommen — der Käufer kann jetzt zu diesem Preis kaufen.'
                    : action === 'counter'
                      ? 'Gegenvorschlag ist raus.'
                      : 'Abgelehnt.',
                )
              }
              onWithdraw={(offerId) =>
                void runOffer(
                  () => offerActions.withdraw.mutateAsync(offerId),
                  'Zurückgezogen.',
                )
              }
              onBuyAccepted={(offer) => void onBuyAccepted(offer)}
            />
          ) : null}

          {/* ── Der Verkäufer. Das war bis heute das ZIEL jedes Tipps auf ein
              Angebot; jetzt ist es eine Zeile auf der Seite, die man
              eigentlich sehen wollte. ────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [styles.sellerRow, pressed && styles.pressed]}
            onPress={() => sellerId && router.push(`/seller/${sellerId}`)}
            accessibilityRole="button"
            accessibilityLabel={`Profil von ${seller?.username ?? 'Verkäufer'} ansehen`}
          >
            <Avatar uri={seller?.avatarUrl} name={seller?.username} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.sellerName}>
                {seller?.username ?? '…'}
              </Text>
              <View style={styles.sellerStats}>
                {/* Kein erfundener Wert: Ohne Bewertung steht dort, dass es
                    keine gibt. „5,0" ohne eine einzige Bewertung behauptet
                    Vertrauen, das niemand vergeben hat (HANDOFF 10). */}
                {stats?.rating != null ? (
                  <>
                    <Star size={12} color={ui.gold} fill={ui.gold} />
                    <Text style={styles.sellerStatText}>
                      {formatRating(stats.rating)} · {stats.ratingCount}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.sellerStatText}>Noch keine Bewertung</Text>
                )}
                {stats?.sold ? (
                  <Text style={styles.sellerStatText}>· {stats.sold} Zuschläge</Text>
                ) : null}
                {/* Versandtempo — dieselbe Zahl wie die Kachel auf dem Profil.
                    Nur wenn es Versände gab; ein erfundenes „—" wäre Lärm. */}
                {stats?.shipHours != null ? (
                  <View style={styles.sellerStatIconPair}>
                    <Truck size={11} color={ui.textMuted} />
                    <Text style={styles.sellerStatText}>{formatShipTime(stats.shipHours)}</Text>
                  </View>
                ) : null}
              </View>
              {/* Die Bürgen — für diese Community das eigentliche Signal
                  (HANDOFF 15: „Vertrauen ist personal, nicht institutionell").
                  Dieselbe Zeile wie im Verkäufer-Sheet des Live-Raums. */}
              {vouchLine ? (
                <Text numberOfLines={1} style={styles.vouchLine}>
                  {vouchLine}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={18} color={ui.textMuted} />
          </Pressable>

          {/* ── Versand. Der Satz stand bisher nur im Live-Raum und im Regal,
              also überall außer dort, wo jemand gerade kauft. ─────────────── */}
          <View style={styles.shipRow}>
            <Package size={15} color={ui.textMuted} />
            <Text style={styles.shipText}>
              {ship ? `${ship}. ` : ''}
              Kommt in dasselbe Paket wie deine Zuschläge — du zahlst nur einmal Versand.
            </Text>
          </View>

          {/* ── Anbieterangaben eines gewerblichen Verkäufers — NUR NOCH FÜR
              IHN SELBST (seit 18.08.2026).

              Vorher stand hier für JEDEN Betrachter entweder der volle
              Impressumsblock oder, wenn er fehlte, ein roter Satz: „Dieser
              Verkäufer hat seine Anbieterangaben noch nicht vollständig
              hinterlegt." Beides war am falschen Ort:

              • Der rote Satz warnt den KÄUFER vor einem Mangel, den er weder
                verursacht hat noch beheben kann. Er sät Misstrauen gegen den
                Verkäufer — und in Wahrheit fehlt bis heute das Formular, mit
                dem der Verkäufer die Angaben überhaupt eintragen könnte
                (Abschnitt 33, „die Sackgasse"). Wir warnten also vor unserer
                eigenen Lücke.
              • Der volle Block macht die Kaufseite behördlich. § 5 DDG
                verlangt „leicht erkennbar, unmittelbar erreichbar und ständig
                verfügbar" — ein Tipp auf den Verkäufer erfüllt das. Auf jeder
                Artikelseite ausbreiten verlangt es nicht.

              Für den Verkäufer selbst bleibt der Hinweis stehen: Dort ist er
              handlungsleitend statt beunruhigend. Der Impressumsblock für
              Käufer liegt jetzt auf dem Verkäufer-Profil. ────────────────── */}
          {listing.seller_kind === 'business' && mine ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Deine Anbieterangaben</Text>
              {/* ⚠️ DREI Zustände, nicht zwei. `missingBusinessFields` gibt für
                  „ich weiß nichts" (`null`) dasselbe leere Array zurück wie für
                  „alles da" — wer nur auf `missing.length` prüft, dreht
                  „keine Daten" in „vollständig" um und zeigt die Überschrift
                  über einem leeren `join('\n')`. Ausgerechnet bei einer
                  Pflichtangabe die falsche Richtung.

                  `sellerRow` ist dabei zwangsläufig eine Weile `undefined`: Der
                  Hook wird erst aktiv, wenn `sellerId` aus dem geladenen
                  Angebot vorliegt — also NACH der eigenen `isLoading`-Schranke
                  dieses Bildschirms. */}
              {sellerLoading ? (
                <ActivityIndicator style={{ alignSelf: 'flex-start' }} color={ui.textMuted} />
              ) : !sellerRow || missing.length ? (
                // Nur noch der eine Zweig: Der Block rendert seit dem
                // 18.08.2026 ausschließlich für den Verkäufer selbst, die
                // Käufer-Fassung des Satzes gibt es nicht mehr.
                <Text style={styles.legalWarn}>
                  {`Unvollständig — es fehlen: ${
                    missing.length ? missing.join(', ') : 'alle Angaben'
                  }. Trag sie im Konto nach, sie stehen an jedem deiner Angebote.`}
                </Text>
              ) : (
                <Text style={styles.imprint}>
                  {[
                    sellerRow?.legal_name,
                    sellerRow?.street,
                    [sellerRow?.postal_code, sellerRow?.city].filter(Boolean).join(' '),
                    sellerRow?.country,
                    sellerRow?.contact_email,
                    sellerRow?.vat_id ? `USt-IdNr. ${sellerRow.vat_id}` : null,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </Text>
              )}
            </View>
          ) : null}

          {/* ── Mehr von diesem Verkäufer. Dieselbe Abfrage wie das
              Profil-Regal — wer hier steht, hat schon Interesse an genau
              diesem Menschen, und alles von ihm kommt in DASSELBE Paket. ── */}
          {moreFromSeller.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Mehr von {seller?.username ?? 'diesem Verkäufer'}</Text>
              <View style={styles.moreGrid}>
                {moreFromSeller.map((item) => (
                  <View key={item.id} style={styles.moreCell}>
                    <ListingCard
                      listing={item}
                      mine={mine}
                      saved={savedIds?.has(item.id)}
                      onToggleSaved={
                        mine
                          ? undefined
                          : () => {
                              if (needsLogin()) return;
                              toggleSaved.mutate({
                                auctionId: item.id,
                                saved: Boolean(savedIds?.has(item.id)),
                              });
                            }
                      }
                      onPress={() => router.push(`/listing/${item.id}`)}
                    />
                  </View>
                ))}
                {moreFromSeller.length % 2 === 1 ? <View style={styles.moreCell} /> : null}
              </View>
            </View>
          ) : null}

          {/* ── Melden — leise, am Ende, wie bei Kleinanzeigen. `user_reports`
              meldet Menschen; das Angebot steht in der Notiz. Nicht am eigenen
              Artikel: sich selbst melden ist keine Handlung. ─────────────── */}
          {!mine ? (
            <Pressable
              style={styles.reportLink}
              onPress={() => (needsLogin() ? null : setReportOpen(true))}
              accessibilityRole="button"
              accessibilityLabel="Angebot melden"
            >
              <Text style={styles.reportLinkText}>Angebot melden</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {notice ? (
        <View style={[styles.notice, { bottom: insets.bottom + 88 }]}>
          <Pressable onPress={() => setNotice(null)} accessibilityRole="button">
            <Text style={styles.noticeText}>{notice.text}</Text>
          </Pressable>
          {/* Ein Weg, keine Wegbeschreibung. Bewusst „Zum Sammelkorb" und
              NICHT „Bezahlen": `checkout_auction_cart` friert den Korb ein,
              jeder weitere Kauf beim selben Verkäufer landet danach in einem
              NEUEN Korb — der Käufer zahlte zweimal Versand. Dieselbe
              Begründung wie im Live-Raum (Übergabe Abschnitt 11); auf einem
              Marktplatz stöbert man weiter, die Lage ist die einer laufenden
              Show, nicht die an ihrem Ende. */}
          {notice.cta === 'cart' ? (
            <Pressable
              style={styles.noticeBtn}
              onPress={() => router.push('/(tabs)/account')}
              accessibilityRole="button"
              accessibilityLabel="Zum Sammelkorb"
            >
              <Text style={styles.noticeBtnText}>Zum Sammelkorb</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── Die Leiste. EIN Weg, und er steht immer an derselben Stelle. ──── */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]}>
        {gone ? (
          // Ein verkaufter oder zurückgezogener Artikel bleibt lesbar (die
          // Lese-Policy filtert nicht auf den Status). Das ist Absicht: Wer aus
          // einer Nachricht auf etwas kommt, das vor zehn Minuten weg ging,
          // soll das erfahren — und nicht auf einer Fehlerseite landen.
          <View style={styles.goneBar}>
            <Text style={styles.goneText}>
              {listing.status === 'sold' ? 'Schon verkauft' : 'Zurückgezogen'}
            </Text>
          </View>
        ) : upcoming ? (
          // ── Show-Ware. Hier steht KEIN Kaufknopf, und das ist der Kern.
          //
          // ⚠️ Ein Sofortkauf würde den Abend aushöhlen: Der Artikel ist
          // angekündigt, Leute kommen seinetwegen — wer ihn vorher wegkaufen
          // kann, nimmt der Auktion ihre Bedeutung. Das ist wörtlich dieselbe
          // Begründung, mit der am 22.08.2026 der Preisvorschlag auf die Zeit
          // VOR dem Start begrenzt wurde: „Die Glaubwürdigkeit der Auktion IST
          // das Produkt."
          //
          // Der Weg ist stattdessen die Glocke — die leiseste Zusage, die es
          // gibt, und laut `useReminders.ts` das Signal mit der höchsten
          // Kaufabsicht.
          mine ? (
            // Am eigenen Artikel gibt es nichts vorzumerken, und Bearbeiten/
            // Zurückziehen greifen hier nicht: Beide arbeiten auf Regal-Ware.
            // Verwaltet wird Show-Ware im Vorbereiten-Blatt am Termin.
            <View style={styles.goneBar}>
              <Text style={styles.goneText}>
                {showSlot ? `Liegt bereit für ${formatSlot(showSlot)}` : 'Liegt für einen Abend bereit'}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Pressable
                style={[styles.remind, Boolean(reminderOn) && styles.remindOn]}
                disabled={toggleReminder.isPending}
                onPress={() => {
                  if (!myUserId) {
                    router.push('/login');
                    return;
                  }
                  void toggleReminder
                    .mutateAsync({ auctionId: id, on: !reminderOn })
                    .then(() => setReminderNotice(null))
                    .catch((error: unknown) =>
                      setReminderNotice(
                        reminderErrorText(
                          error instanceof Error ? error.message : String(error),
                        ),
                      ),
                    );
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: Boolean(reminderOn) }}
                accessibilityLabel={
                  reminderOn
                    ? 'Nicht mehr benachrichtigen'
                    : 'Benachrichtige mich, wenn der Artikel drankommt'
                }
              >
                {reminderOn ? (
                  <BellRing size={17} color={ui.success} />
                ) : (
                  <Bell size={17} color={ui.text} />
                )}
                <Text
                  style={[styles.remindText, Boolean(reminderOn) && styles.remindTextOn]}
                >
                  {reminderOn ? 'Wir sagen dir Bescheid' : 'Sag mir Bescheid, wenn der drankommt'}
                </Text>
              </Pressable>
              {reminderNotice ? (
                <Text style={styles.remindNotice}>{reminderNotice}</Text>
              ) : null}
            </View>
          )
        ) : mine ? (
          // Der eigene Artikel: Bearbeiten ist der häufige Handgriff (Preis
          // senken!), Zurückziehen der seltene. Deshalb trägt Bearbeiten die
          // Kontur und steht zuerst.
          <View style={styles.ownRow}>
            <Pressable
              style={[styles.editBtn, busy && styles.off]}
              disabled={busy}
              onPress={() => setEditOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Angebot bearbeiten"
            >
              <Text style={styles.editBtnText}>Bearbeiten</Text>
            </Pressable>
            <Pressable
              style={[styles.ghost, styles.ownGhost, busy && styles.off]}
              disabled={busy}
              onPress={() => void onCancel()}
              accessibilityRole="button"
              accessibilityLabel="Angebot zurückziehen"
            >
              {busy ? (
                <ActivityIndicator color={ui.textMuted} />
              ) : (
                <Text style={styles.ghostText}>Zurückziehen</Text>
              )}
            </Pressable>
          </View>
        ) : sellerLoading ? (
          // Solange die Kassen-Freigabe unbekannt ist, steht hier KEIN
          // beschrifteter Knopf. Ein Etikett, das eine Zehntelsekunde später von
          // „Nachricht" auf „Kaufen" springt, ist auf einem Geldweg schlimmer
          // als eine kurze Wartefläche.
          <View style={styles.waiting}>
            <ActivityIndicator color={ui.textMuted} />
          </View>
        ) : canCheckout && listing.buy_now_cents !== null ? (
          // ⚠️ `buy_now_cents !== null` gehört in dieselbe Bedingung wie die
          // Kassen-Freigabe, und aus demselben Grund: Ohne Preis stünde hier
          // „Kaufen · —" — ein goldener Knopf über einem Gedankenstrich, der in
          // einen Kauf ohne Betrag führt. Das ist die dritte Auflage derselben
          // Sackgasse (17.08. der Knopf ohne Freigabe, 25.08. das Vorschlags-
          // Blatt ohne Bezugspreis). Wer keinen Preis hat, bekommt den
          // Nachricht-Zweig darunter — der trägt genau hier.
          <Pressable
            style={[styles.buy, busy && styles.off]}
            disabled={busy}
            onPress={() => void onBuy()}
            accessibilityRole="button"
            accessibilityLabel={`${listing.title} für ${formatEuro(
              listing.buy_now_cents,
            )} kaufen`}
          >
            {busy ? (
              <ActivityIndicator color={ui.goldInk} />
            ) : (
              <Text style={styles.buyText}>
                Kaufen · {formatEuro(listing.buy_now_cents)}
              </Text>
            )}
          </Pressable>
        ) : (
          // Kontakt statt Kasse: Wer keine Kassen-Freigabe hat, kann über die
          // Plattform gar kein Geld bekommen — läuft es über das Konto des
          // Betreibers, ist das nach ZAG erlaubnispflichtig. Der Knopf ist
          // bewusst nicht gold: Gold ist in Berkat der Kaufweg.
          //
          // ⚠️ Nicht deaktivieren, wenn niemand angemeldet ist. Ein grauer
          // Knopf ohne Text ist eine Sackgasse — `onContact` schickt zur
          // Anmeldung, so wie es der Live-Raum und die Trinkgeld-Seite auch tun.
          <Pressable
            style={styles.contact}
            onPress={onContact}
            accessibilityRole="button"
            accessibilityLabel={`${listing.title} — Verkäufer anschreiben`}
          >
            <MessageCircle size={17} color={ui.bg} />
            <Text style={styles.contactText}>Nachricht schreiben</Text>
          </Pressable>
        )}
      </View>

      {/* ── Bearbeiten: DASSELBE Formular wie das Anlegen, vorbefüllt.
          Eine zweite Abschrift wäre der Karten-Fehler von HANDOFF 21 noch
          einmal. `pageSheet` statt Vollbild: Man soll sehen, dass man über
          seinem Angebot arbeitet. ─────────────────────────────────────────── */}
      <Modal
        visible={editOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={styles.editSheet}>
          <View style={styles.editHead}>
            <Text style={styles.editTitle}>Angebot bearbeiten</Text>
            <Pressable
              hitSlop={10}
              onPress={() => setEditOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <X size={22} color={ui.text} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: space.md, paddingBottom: space.xl * 2 }}
            keyboardShouldPersistTaps="handled"
          >
            <StandingComposer
              mode="edit"
              busy={actions.update.isPending}
              canWomenOnly={canWomenOnly}
              initial={{
                title: listing.title,
                // `?? undefined` statt `?? 0`: Ein Preisfeld, das mit 0,00 €
                // vorbelegt ist, sieht aus wie eine Angabe. Leer ist die
                // Wahrheit — und das Bearbeiten ist Vollersatz, eine erfundene
                // Null würde beim Speichern zur echten.
                priceCents: listing.buy_now_cents ?? undefined,
                womenOnly: listing.women_only,
                acceptsOffers: listing.accepts_offers,
                category: listing.category,
                imageUrls: images,
                description: listing.description,
                condition: listing.condition,
                // ⚠️ Pflicht, nicht Zugabe: Das Bearbeiten ist VOLLERSATZ. Ein
                // Feld, das hier fehlt, kommt als `null` am Server an und wird
                // gelöscht — ohne dass der Verkäufer es angefasst hätte.
                size: listing.size,
                // Hier gilt der Satz darüber NICHT ganz: `shipping_tier` wird
                // von `update_standing_listing` gar nicht angefasst, sondern
                // von `set_listing_shipping_tier` (eigene RPC, damit die
                // Signatur unter der laufenden App gleich bleibt). Vorbefüllt
                // wird sie trotzdem — sonst zeigte das Blatt „nicht angegeben"
                // an einem Artikel, der eine Stufe hat.
                shippingTier: listing.shipping_tier,
                postalCode: listing.postal_code,
                city: listing.city,
              }}
              submitLabel="Speichern"
              onSubmit={(input) => {
                setEditOpen(false);
                void actions.update
                  .mutateAsync({ id: listing.id, ...input })
                  // ⚠️ Zweiter Ruf, weil `update_standing_listing` die Stufe
                  // nicht kennt — sie hat eine eigene RPC, damit die Signatur
                  // unter der ausgelieferten App gleich bleibt (Übergabe 63).
                  // Nur wenn sie sich geändert hat: sonst schriebe jedes
                  // Speichern denselben Wert noch einmal.
                  .then(async () => {
                    if (input.shippingTier !== listing.shipping_tier) {
                      await setTier
                        .mutateAsync({
                          auctionId: listing.id,
                          tier: (input.shippingTier ?? null) as 1 | 2 | 3 | 4 | null,
                        })
                        .catch(() => {
                          /* Der Rest ist gespeichert; die Stufe bleibt, wie sie war. */
                        });
                    }
                  })
                  .then(() => setNotice({ text: 'Gespeichert.' }))
                  .catch((e: unknown) =>
                    setNotice({
                      text: standingErrorText(e instanceof Error ? e.message : String(e)),
                    }),
                  );
              }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Melden: dieselben Gründe wie im Verkäufer-Sheet. ──────────────── */}
      <Modal
        visible={reportOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReportOpen(false)}
      >
        <Pressable style={styles.reportBackdrop} onPress={() => setReportOpen(false)}>
          <Pressable style={styles.reportSheet} onPress={() => {}}>
            <Text style={styles.reportTitle}>Was stimmt hier nicht?</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable
                key={r.key}
                style={styles.reportRow}
                onPress={() => void onReport(r.key)}
                accessibilityRole="button"
                accessibilityLabel={r.label}
              >
                <Text style={styles.reportRowText}>{r.label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.reportCancel}
              onPress={() => setReportOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.reportCancelText}>Abbrechen</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },
  pressed: { opacity: 0.7 },

  hero: { width: '100%', aspectRatio: ratio.card, backgroundColor: ui.sunken },
  heroEmpty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  heroLock: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ui.success,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroLockText: { fontSize: 11, fontWeight: '700', color: ui.successInk },

  body: { padding: space.lg, gap: space.md },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  price: { fontSize: 28, fontWeight: '700', color: ui.text },
  // Klein und gedämpft: Es ist eine Einschränkung, keine zweite Zahl.
  priceAdd: { fontSize: 13, color: ui.textMuted },
  title: { fontSize: 18, fontWeight: '600', color: ui.text, marginTop: -space.sm, lineHeight: 24 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    backgroundColor: ui.sunken,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: ui.text },
  when: { fontSize: 12, color: ui.textMuted, marginTop: -space.sm },

  // Eine Zeile, kein Kasten: Die Pflichtangabe steht da, ohne den Weg zur
  // Ware zu verstellen. Die Trennlinien halten sie als eigene Aussage lesbar,
  // ohne sie zu umrahmen.
  legalRow: {
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    gap: 4,
  },
  legalHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevOpen: { transform: [{ rotate: '180deg' }] },
  legalText: { fontSize: 13, fontWeight: '700', color: ui.text },
  legalSub: { fontSize: 12, color: ui.textMuted, lineHeight: 17 },
  legalWarn: { fontSize: 12, color: ui.live, lineHeight: 17 },

  block: { gap: 5 },
  blockLabel: { fontSize: 12, fontWeight: '700', color: ui.textMuted },
  description: { fontSize: 15, color: ui.text, lineHeight: 22 },
  imprint: { fontSize: 12, color: ui.textMuted, lineHeight: 18 },

  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
  },
  sellerName: { fontSize: 15, fontWeight: '700', color: ui.text },
  sellerStats: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  sellerStatText: { fontSize: 12, color: ui.textMuted },

  shipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  shipText: { flex: 1, fontSize: 12, color: ui.textMuted, lineHeight: 17 },

  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
    backgroundColor: ui.card,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  off: { opacity: 0.45 },
  buy: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyText: { fontSize: 16, fontWeight: '700', color: ui.goldInk },
  // ⚠️ GEFÜLLT, nicht umrandet — seit dem 22.08.2026 (Analyse 14).
  //
  // Vorher: weiße Pille mit dünnem Rand. Gold gehört zu Recht dem Kaufweg
  // (Abschnitt 20), und das bleibt so — aber *ungefüllt* ist in dieser App die
  // Form für „zweitrangig" (Abmelden, „Alle Angebote ansehen"). Hier ist es die
  // EINZIGE Handlung der Seite, und bei 30 von 32 Angeboten die einzige
  // überhaupt, weil ohne Kassen-Freigabe kein Kaufknopf erscheint.
  //
  // Markengrün ist der Mittelweg: gefüllt wie ein Knopf, aber nicht der Kauf.
  // Dieselbe Fläche trägt schon die aktive Sortier-Kachel im Kategorien-Reiter,
  // es ist also keine neue Sprache. Whatnots Handlungsknopf ist ausnahmslos
  // gefüllt — auch der graue (Analyse 4).
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: ui.brand,
  },
  contactText: { fontSize: 15, fontWeight: '700', color: ui.bg },
  ghost: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
  goneBar: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goneText: { fontSize: 14, fontWeight: '700', color: ui.textMuted },
  waiting: { height: 52, alignItems: 'center', justifyContent: 'center' },

  /* ── Show-Ware ─────────────────────────────────────────────────────────────
     ⚠️ Die Glocke trägt bewusst NICHT Bernstein, obwohl sie hier der einzige
     Weg ist und `tokens.ts` die Kauffarbe für genau solche Bildschirme
     vorsieht. Eine Vormerkung ist keine Kauferklärung — sie verpflichtet zu
     nichts. Ihr das Gewicht des Kaufknopfs zu geben hiesse, jemandem eine
     Entscheidung zu suggerieren, die er gar nicht trifft. Kontur statt
     Fläche, und gefüllt erst, wenn sie AN ist. */
  showNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.sm,
  },
  showNoteText: { fontSize: 14, fontWeight: '700', color: ui.live, flexShrink: 1 },
  remind: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.lineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  remindOn: { borderColor: ui.success, backgroundColor: ui.sunken },
  remindText: { fontSize: 15, fontWeight: '700', color: ui.text },
  remindTextOn: { color: ui.success },
  remindNotice: {
    fontSize: 12,
    color: ui.live,
    marginTop: space.xs,
    textAlign: 'center',
  },

  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space.md,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  /* Die Punkte liegen auf einem fremden Foto — deshalb `ui.overlay` als
     Grundton (Bestandsliste an `ui.overlay` in tokens.ts) und der aktive in
     Marken-Dunkelgrün, das auf der milchigen Fläche sicher trägt. */
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ui.overlay },
  dotOn: { backgroundColor: ui.brand },

  sellerStatIconPair: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  /* Hellgrün wie im Verkäufer-Sheet: Eine Bürgschaft ist kein Kaufknopf. */
  vouchLine: { fontSize: 12, color: ui.success, marginTop: 3, fontWeight: '600' },

  moreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xs },
  moreCell: { width: '47%' },

  reportLink: { alignSelf: 'center', paddingVertical: space.sm, marginTop: space.sm },
  reportLinkText: { fontSize: 13, fontWeight: '600', color: ui.textMuted },

  ownRow: { flexDirection: 'row', gap: space.sm },
  editBtn: {
    flex: 1,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: { fontSize: 15, fontWeight: '700', color: ui.text },
  ownGhost: { flex: 1, minWidth: 0 },

  editSheet: { flex: 1, backgroundColor: ui.bg },
  editHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  editTitle: { fontSize: 17, fontWeight: '700', color: ui.text },

  reportBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,21,18,0.45)',
    justifyContent: 'flex-end',
  },
  reportSheet: {
    backgroundColor: ui.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: space.xl,
    gap: 2,
  },
  reportTitle: { fontSize: 16, fontWeight: '700', color: ui.text, marginBottom: space.sm },
  reportRow: { paddingVertical: space.md },
  reportRowText: { fontSize: 15, color: ui.text },
  reportCancel: { paddingVertical: space.md, alignItems: 'center', marginTop: space.xs },
  reportCancelText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },

  notice: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    padding: space.md,
    gap: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text, lineHeight: 19 },
  noticeBtn: {
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBtnText: { fontSize: 13, fontWeight: '700', color: ui.text },

  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text, marginTop: space.sm },
  emptyBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.xl,
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: space.md,
    height: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: ui.text },
});
