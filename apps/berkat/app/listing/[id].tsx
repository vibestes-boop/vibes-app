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

import { useCallback, useMemo, useState, useEffect } from 'react';
import { ListingGallery } from '../../components/ListingGallery';
import { ShelfRail } from '../../components/ShelfRail';
import { ShareSheet } from '../../components/ShareSheet';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useListingDetail } from '../../lib/useListingDetail';
import { ListingLoading, ListingPreviewStatus } from '../../components/ListingLoading';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  BellRing,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Heart,
  MessageSquareWarning,
  Package,
  ShieldCheck,
  Share2,
  Star,
  Truck,
  X,
} from 'lucide-react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { ActionButton } from '../../components/ActionButton';
import { PurchaseStatusCard } from '../../components/PurchaseStatusCard';
import { useSession } from '../../lib/session';
import { markListingSeen } from '../../lib/useListingViews';
import { errText } from '../../lib/errorText';
import { goBack } from '../../lib/nav';
import { listingLink } from '../../lib/links';
import {
  formatEuro,
  useProfiles,
} from '../../lib/useAuction';
import {
  conditionLabel,
  missingBusinessFields,
  sellerKindNote,
  useBerkatSeller,
} from '../../lib/useBerkatSeller';
import {
  listingImages,
  listingPrice,
  useSellerListings,
} from '../../lib/useListings';
import { useSavedIds, useToggleSaved } from '../../lib/useSaved';
import {
  offerErrorText,
  useOfferActions,
  useOffersForListing,
  type Offer,
} from '../../lib/useOffers';
import { AgeGateSheet } from '../../components/AgeGateSheet';
import {
  ageGateError,
  ageGateReason,
  useBirthDateState,
  useSetBirthDate,
} from '../../lib/useAgeGate';
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
import { radius, space, ui } from '../../theme/tokens';
import { useReducedMotion } from '../../lib/useReducedMotion';

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

/**
 * „seit Aug. 2026" — das Signal, das ein Verkaeufer OHNE einen einzigen Verkauf
 * schon hat.
 *
 * ⚠️ Warum das dazukam (21.09.2026): Bei einem neuen Verkaeufer stand in der
 * Zeile ausschliesslich „Noch keine Bewertung". Das ist ehrlich und war das
 * EINZIGE, was dort stand — eine Seite, die ueber Geld entscheidet, gab dem
 * Kaeufer damit genau null Anhaltspunkte. Kleinanzeigen zeigt „Aktiv seit
 * 27.11.18" an derselben Stelle und aus demselben Grund.
 *
 * Monat und Jahr, kein Tag: Der Tag ist keine Auskunft, und ein volles Datum
 * neben Sternen und Zuschlaegen macht die Zeile unlesbar.
 */
function sellerSince(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return `seit ${then.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}`;
}

/**
 * Die kurze Kennung eines Angebots.
 *
 * ⚠️ Berkats Kennungen sind UUIDs — sechsunddreissig Zeichen, die niemand
 * vorliest und niemand abtippt. Kleinanzeigen hat dafuer eine zehnstellige
 * Nummer; sie steht am Seitenende und ist das, was man nennt, wenn man ueber
 * ein bestimmtes Angebot spricht (Meldung, Nachricht, Streitfall).
 *
 * Die ersten acht Hex-Stellen sind vier Milliarden Moeglichkeiten — fuer
 * „welches Angebot meinst du" reicht das, und sie sind aus der vollen Kennung
 * ableitbar, also keine zweite Wahrheit.
 */
function shortListingId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export default function ListingScreen() {
  const reducedMotion = useReducedMotion();
  // ⚠️ `?edit=1` seit dem 21.09.2026: Aus dem eigenen Regal fuehrt „Bearbeiten"
  // direkt ins Formular. Vorher waren es vier Tipps bis zur Preisaenderung
  // (Zeile → Artikelseite → Bearbeiten → Feld) — und genau die Preisaenderung
  // ist der haeufigste Handgriff am eigenen Angebot.
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const sessionLoading = useSession((s) => s.loading);
  // Vor den frühen returns, wie jeder Hook hier — Rules of Hooks. Gebraucht
  // erst weit unten im Bearbeiten-Blatt (Frauen-Only-Schalter).
  const canWomenOnly = useSession((s) => Boolean(s.profile?.women_only_verified));

  const focused = useIsFocused();
  const { data: listing, isPreview, isLoading, isError, isFetching, refetch } = useListingDetail(id, focused);
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
  const [editOpen, setEditOpen] = useState(edit === '1');
  const [shareOpen, setShareOpen] = useState(false);
  /** Die Rechtsfolge unter der Anbieterkennzeichnung — zu, bis jemand fragt. */
  const [legalOpen, setLegalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const { fontScale } = useWindowDimensions();

  // Merken. Das Set kommt aus einer eigenen Mini-Abfrage (useSavedIds), damit
  // jede Fläche dieselbe Wahrheit liest; der Toggle setzt beide Schlüssel zurück.
  const { data: savedIds } = useSavedIds(myUserId);
  const toggleSaved = useToggleSaved(myUserId);
  const isSaved = Boolean(id && savedIds?.has(id));

  // „Mehr von diesem Verkäufer" — dieselbe Abfrage wie das Profil-Regal, der
  // aktuelle Artikel wird nur herausgefiltert.
  const { data: sellerListings = [] } = useSellerListings(sellerId, focused);
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
      if (id) void refetch({ cancelRefetch: false });
    }, [id, refetch]),
  );

  /**
   * Den Aufruf festhalten — genau einmal je Mensch und Angebot.
   *
   * ⚠️ `useEffect` mit `[id]`, NICHT `useFocusEffect`: Sonst zählte jede
   * Rückkehr aus dem Profil oder aus der Galerie erneut. Die RPC schluckt
   * Wiederholungen zwar (Primärschlüssel je Paar), aber eine Anfrage, die
   * nichts tun kann, muss man nicht schicken.
   *
   * Eigene Aufrufe und Nicht-Angemeldete weist die RPC selbst ab — die Grenze
   * steht im Server, nicht hier. Ein Client entscheidet nicht, was gezählt wird.
   */
  useEffect(() => { markListingSeen(id); }, [id]);

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

  /**
   * Die Altersschranke — dieselbe wie im Live-Raum, Begründung dort und in
   * `lib/useAgeGate.ts`. Hier ist die Fläche hell (`ui`), nicht die Bühne.
   */
  const { data: ageState } = useBirthDateState(myUserId);
  const setBirthDate = useSetBirthDate(myUserId);
  const [ageOpen, setAgeOpen] = useState(false);
  const [ageNotice, setAgeNotice] = useState<string | null>(null);

  const passAgeGate = useCallback(() => {
    if (ageState === 'adult' || ageState === undefined) return true;
    setAgeNotice(null);
    setAgeOpen(true);
    return false;
  }, [ageState]);
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
    // Ein Sofortkauf schreibt dieselbe `live_bids`-Zeile wie ein Gebot und
    // läuft damit in denselben Riegel (Migration `20260825120000`). Vorher
    // fragen statt hinterher absagen.
    if (!passAgeGate()) return;
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
      const msg = errText(err);
      // Das Netz — für den Fall, dass der Zustand hier noch nicht geladen war.
      if (ageGateReason(msg)) {
        setAgeNotice(null);
        setAgeOpen(true);
        return;
      }
      setNotice({ text: standingErrorText(msg) });
    } finally {
      setBusy(false);
    }
  }, [actions.buy, listing, needsLogin, passAgeGate]);

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
      setNotice({ text: standingErrorText(errText(err)) });
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
        setNotice({ text: offerErrorText(errText(err)) });
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
      // Eine eingelöste Zusage ist ein Kauf — derselbe Weg, derselbe Riegel.
      if (!passAgeGate()) return;
      setOfferBusy(true);
      setNotice(null);
      try {
        await actions.buy.mutateAsync({ id: listing.id, offerId: offer.id });
        celebrate();
        setNotice({ text: 'Im Paket. 🎉', cta: 'cart' });
      } catch (err) {
        const msg = errText(err);
        if (ageGateReason(msg)) {
          setAgeNotice(null);
          setAgeOpen(true);
          return;
        }
        setNotice({ text: standingErrorText(msg) });
      } finally {
        setOfferBusy(false);
      }
    },
    [actions.buy, listing, needsLogin, passAgeGate],
  );

  /**
   * Der Satz, der mitgeteilt wird.
   *
   * ⚠️ Bei Show-Ware gehört der Termin MIT hinein — er ist der eigentliche
   * Zweck des Teilens („komm Freitag dazu"), und ohne ihn stünde dort ein
   * Startpreis, den der Empfänger für den Preis hält.
   */
  const shareText = useMemo(() => {
    if (!listing) return '';
    const p = listingPrice(listing);
    const when = listing.show ? ` · live ${formatSlot(listing.show.scheduled_at)}` : '';
    return `${listing.title} · ${p.from ? 'ab ' : ''}${formatEuro(p.cents)}${when}`;
  }, [listing]);

  /**
   * ⚠️ SEIT DEM 21.09.2026 BERKATS EIGENES BLATT.
   *
   * Hier stand `Share.share({ message: … })` — also das iOS-System-Fenster,
   * und der Link als Teil des Fliesstextes. Beides hatte Zaur am 17.09. am
   * LIVE-Teilen beanstandet („das teilen hat einen bild aber wenn man teilen
   * drückt kommt eine iphone fenster von unten hoch"); der Live-Raum bekam
   * daraufhin `ShareSheet`, die Artikelseite nicht. Dieselbe Geste, zwei
   * verschiedene Antworten — und auf der Artikelseite die schlechtere.
   *
   * Der Link führt weiter auf die Web-Seite (`/listing?id=…`) mit dem
   * „In Berkat öffnen"-Knopf: So funktioniert er auch bei Empfängern ohne App
   * — also bei genau denen, für die man teilt.
   */
  const onShare = useCallback(() => {
    if (!listing) return;
    setShareOpen(true);
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

  // Merken und Teilen bleiben auch bei verkauften Angeboten erreichbar.
  const header = <ScreenHeader title="Angebot" actionsWidth={88} onBack={() => goBack('/shop')} right={<>
      <Pressable
        hitSlop={8}
        style={[styles.back, (!listing || isPreview) && styles.off]}
        onPress={onToggleSaved}
        disabled={!listing || isPreview}
        accessibilityRole="button"
        accessibilityState={{ selected: isSaved, disabled: !listing || isPreview }}
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
        style={[styles.back, !listing && styles.off]}
        onPress={onShare}
        disabled={!listing}
        accessibilityRole="button"
        accessibilityState={{ disabled: !listing }}
        accessibilityLabel="Angebot teilen"
      >
        <Share2 size={20} color={ui.text} />
      </Pressable>
    </>} />;

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <ListingLoading />
      </View>
    );
  }

  if (isError && !listing) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {header}
        <ScrollView key={`load-error-${fontScale}`} contentContainerStyle={[styles.loadError, { paddingBottom: insets.bottom + space.xl }]}>
          <BerkatMark size={38} color={ui.brand} />
          <Text style={styles.emptyTitle}>Angebot gerade nicht erreichbar</Text>
          <Text style={styles.emptyBody}>
            Wir konnten die Details nicht laden. Versuch es bitte noch einmal.
          </Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => void refetch({ cancelRefetch: false })}
            disabled={isFetching}
            accessibilityRole="button"
            accessibilityState={{ disabled: isFetching, busy: isFetching }}
          >
            <Text style={styles.emptyBtnText}>{isFetching ? 'Wird geladen …' : 'Erneut laden'}</Text>
          </Pressable>
        </ScrollView>
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
        <View key={`empty-${fontScale}`} style={styles.center}>
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
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
        {isError && !isPreview ? (
          <View key={`refresh-error-${fontScale}`} style={styles.refreshError}>
            <Text style={styles.emptyBody}>
              Aktualisieren hat nicht geklappt. Du siehst den zuletzt geladenen Stand.
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => void refetch({ cancelRefetch: false })}
              disabled={isFetching}
              accessibilityRole="button"
              accessibilityState={{ disabled: isFetching, busy: isFetching }}
            >
              <Text style={styles.emptyBtnText}>{isFetching ? 'Wird geladen …' : 'Erneut laden'}</Text>
            </Pressable>
          </View>
        ) : null}
        <ListingGallery key={id} images={images} womenOnly={Boolean(listing.women_only)} active={focused} />

        <View style={styles.body}>
          <Text key={`title-${fontScale}`} style={styles.title}>{listing.title}</Text>
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
          <View key={`priceRow-${fontScale}`} style={styles.priceRow}>
            <Text style={styles.price}>
              {upcoming
                ? `ab ${formatEuro(listing.start_price_cents)}`
                : formatEuro(listing.status === 'sold' ? listing.current_bid_cents ?? listing.buy_now_cents : listing.buy_now_cents)}
            </Text>
            {!gone ? <Text style={styles.priceAdd}>{ship || 'zzgl. Versand'}</Text> : null}
          </View>

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
            <View key={`chips-${fontScale}`} style={styles.chips}>
              {meta.map((text) => (
                <View key={text} style={styles.chip}>
                  <Text style={styles.chipText}>{text}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text key={`when-${fontScale}`} style={styles.when}>{listedWhen(listing.created_at)}</Text>

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
              key={`legal-${fontScale}`}
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

          {/* ── SO LÄUFT DER KAUF (21.09.2026) ──────────────────────────────
              Zaur hat die Kleinanzeigen-Artikelseite danebengelegt und
              gefragt, was uns fehlt. Das hier war die grösste Lücke: Berkat
              sagte dem Käufer VOR dem Kauf **kein einziges Wort** darüber, wie
              bezahlt wird und was passiert, wenn nichts ankommt. Stripe, der
              Bestellstatus und das Streitfall-Verfahren gibt es alle — der
              Käufer erfuhr davon erst danach. Bei einer Plattform, die niemand
              kennt, ist genau das die Frage, die den Kauf entscheidet.

              ⚠️ DAS WORT „KÄUFERSCHUTZ" FEHLT HIER MIT ABSICHT.
              `STRATEGIE-VERKAEUFER-UND-GELD.md` Abschnitt 8 hält Fassung A
              fest: kein Versprechen über die gesetzliche Pflicht hinaus,
              solange Zaur Verkäufer und Betreiber zugleich ist. Eine Zusage
              wäre dann keine Garantie gegen einen Dritten, sondern seine
              eigene — und `useDispute.ts` sagt denselben Satz aus der anderen
              Richtung: Der Weg verspricht einen **Vorgang**, kein Geld. Wer
              hier „Geld zurück" hinschreibt, ändert eine Rechtsfrage und nicht
              einen Text.

              Kleinanzeigen zeigt an dieser Stelle einen grünen Kasten mit
              Apple Pay, Visa, Mastercard und Klarna. Wir zeigen, was wahr ist.

              Nur bei `canCheckout`: Ohne Kasse führt der Weg über „Nachricht",
              und dann wäre jede Zeile über Zahlung eine Lüge.

              ⚠️ Und nur bei `!mine`. „Berkat sieht DEINE Kartendaten nie"
              steht sonst auf dem eigenen Angebot — gesagt zu dem Menschen,
              der das Geld bekommt. Im Simulator am 21.09. gesehen, bevor es
              jemand anderes lesen musste. ─────────────────────────────────── */}
          {canCheckout && !mine && !gone && !upcoming ? (
            <View key={`how-${fontScale}`} style={styles.howBlock}>
              <View style={styles.howRow}>
                <ShieldCheck size={16} color={ui.brand} />
                <Text style={styles.howText}>
                  Zahlung über Stripe — Karte oder Apple Pay. Berkat sieht deine Kartendaten nie.
                </Text>
              </View>
              {/* ⚠️ HIER STAND EINE VERSAND-ZEILE, UND SIE MUSSTE WEG.
                  „Kommt in dasselbe Paket — du zahlst nur einmal Versand"
                  steht bereits unter der Verkaeuferkarte, dort sogar mit dem
                  echten Satz („ab 4,90 €"). Im Simulator standen beide Saetze
                  auf EINEM Bildschirm. Zweimal dieselbe Auskunft ist genau
                  das, was ich heute aus dem Regal und dem Formular entfernt
                  habe. Dieser Block beantwortet zwei Fragen, die sonst
                  NIRGENDS beantwortet werden: wie bezahlt wird, und was
                  passiert, wenn nichts kommt. */}
              <View style={styles.howRow}>
                <MessageSquareWarning size={16} color={ui.brand} />
                <Text style={styles.howText}>
                  Kam nichts an oder war es anders als beschrieben? Du meldest es aus deiner
                  Bestellung heraus — der Fall bekommt eine Nummer, und der Verkäufer muss antworten.
                </Text>
              </View>
            </View>
          ) : null}

          {/* ── Der Verkäufer. Das war bis heute das ZIEL jedes Tipps auf ein
              Angebot; jetzt ist es eine Zeile auf der Seite, die man
              eigentlich sehen wollte. ────────────────────────────────────── */}
          <Pressable
            key={`seller-${fontScale}`}
            style={({ pressed }) => [styles.sellerRow, pressed && styles.pressed]}
            onPress={() => sellerId && router.push(`/seller/${sellerId}`)}
            accessibilityRole="button"
            accessibilityLabel={`Profil von ${seller?.username ?? 'Verkäufer'} ansehen`}
          >
            <Avatar uri={seller?.avatarUrl} name={seller?.username} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={fontScale > 1.5 ? undefined : 1} style={styles.sellerName}>
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
                {/* ⚠️ NUR WENN ES SONST NICHTS GIBT.
                    Das ist der Rueckfall, nicht die Regel: Wer Sterne,
                    Zuschlaege und ein Versandtempo hat, hat die Frage „kann
                    ich dem trauen" schon beantwortet — „seit Aug. 2026" haengt
                    dann nur hinten dran und schob die Zeile im Simulator in
                    einen zweiten Umbruch. Wer NICHTS hat, bei dem ist es die
                    einzige Antwort, die es gibt. */}
                {stats?.rating == null && sellerSince(sellerRow?.created_at) ? (
                  <Text style={styles.sellerStatText}>· {sellerSince(sellerRow?.created_at)}</Text>
                ) : null}
              </View>
              {/* Die Bürgen — für diese Community das eigentliche Signal
                  (HANDOFF 15: „Vertrauen ist personal, nicht institutionell").
                  Dieselbe Zeile wie im Verkäufer-Sheet des Live-Raums. */}
              {vouchLine ? (
                <Text numberOfLines={fontScale > 1.5 ? undefined : 1} style={styles.vouchLine}>
                  {vouchLine}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={18} color={ui.textMuted} />
          </Pressable>

          {listing.description ? (
            <View key={`description-${fontScale}`} style={styles.block}>
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
          {!isPreview && !gone && !upcoming && listing.buy_now_cents !== null ? (
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


          {/* ── Versand. Der Satz stand bisher nur im Live-Raum und im Regal,
              also überall außer dort, wo jemand gerade kauft. ─────────────── */}
          {!gone ? <View key={`shipRow-${fontScale}`} style={styles.shipRow}>
            <Package size={15} color={ui.textMuted} />
            <Text style={styles.shipText}>
              {ship ? `${ship}. ` : ''}
              Kommt in dasselbe Paket wie deine Zuschläge — du zahlst nur einmal Versand.
            </Text>
          </View> : null}

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
          {/* ⚠️ WISCHREIHE STATT RASTER (21.09.2026).
              Hier stand ein zweispaltiges Raster mit Karten in voller Groesse —
              bei vier Artikeln ueber einen ganzen Bildschirm, fuer etwas, das
              man im Vorbeigehen ansieht. Dieselbe Reihe wie auf der
              Startseite (`ShelfRail`), dieselbe schmale Karte (`tile`). */}
          {moreFromSeller.length > 0 ? (
            <ShelfRail
              title={`Mehr von ${seller?.username ?? 'diesem Verkäufer'}`}
              items={moreFromSeller}
              renderCard={(item) => (
                <ListingCard
                  listing={item}
                  layout="tile"
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
              )}
            />
          ) : null}

          {/* ── Melden — leise, am Ende, wie bei Kleinanzeigen. `user_reports`
              meldet Menschen; das Angebot steht in der Notiz. Nicht am eigenen
              Artikel: sich selbst melden ist keine Handlung. ─────────────── */}
          {!isPreview && !mine ? (
            <Pressable
              style={styles.reportLink}
              onPress={() => (needsLogin() ? null : setReportOpen(true))}
              accessibilityRole="button"
              accessibilityLabel="Angebot melden"
            >
              <Text style={styles.reportLinkText}>Angebot melden</Text>
            </Pressable>
          ) : null}

          {/* Ganz am Ende, leise — wie bei Kleinanzeigen. Man braucht sie nur,
              wenn man ueber DIESES Angebot spricht: in einer Meldung, in einer
              Nachricht, in einem Streitfall. */}
          {!isPreview ? (
            <Text key={`ref-${fontScale}`} style={styles.listingRef} selectable>
              Angebot {shortListingId(id)}
            </Text>
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
              onPress={() => router.push('/purchases')}
              accessibilityRole="button"
              accessibilityLabel="Zum Sammelkorb"
            >
              <Text style={styles.noticeBtnText}>Zum Sammelkorb</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* ── Die Leiste. EIN Weg, und er steht immer an derselben Stelle. ──── */}
      <View key={`bar-${fontScale}`} style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]}>
        {isPreview ? <ListingPreviewStatus loading={isFetching} failed={isError}
          onRetry={() => void refetch({ cancelRefetch: false })} /> : gone ? (
          // Ein verkaufter oder zurückgezogener Artikel bleibt lesbar (die
          // Lese-Policy filtert nicht auf den Status). Das ist Absicht: Wer aus
          // einer Nachricht auf etwas kommt, das vor zehn Minuten weg ging,
          // soll das erfahren — und nicht auf einer Fehlerseite landen.
          listing.status === 'sold' && Boolean(myUserId) && listing.winner_id === myUserId ? (
            <PurchaseStatusCard auctionId={id} userId={myUserId} />
          ) : (
            <View style={styles.goneBar}>
              <Text style={styles.goneText}>
                {listing.status === 'sold' ? 'Schon verkauft' : 'Zurückgezogen'}
              </Text>
            </View>
          )
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
                          errText(error),
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
          <ActionButton label="Nachricht schreiben" onPress={onContact} />
        )}
      </View>

      {/* Das Teilen-Blatt. Hell, weil die Artikelseite hell ist — die dunkle
          Fassung gehört der Bühne des Live-Raums. */}
      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        link={listingLink(id)}
        text={shareText}
        surface="page"
        title="Angebot teilen"
        subject="Angebot auf Berkat"
      />

      {/* ── Bearbeiten: DASSELBE Formular wie das Anlegen, vorbefüllt.
          Eine zweite Abschrift wäre der Karten-Fehler von HANDOFF 21 noch
          einmal. `pageSheet` statt Vollbild: Man soll sehen, dass man über
          seinem Angebot arbeitet. ─────────────────────────────────────────── */}
      <Modal
        visible={editOpen}
        animationType={reducedMotion ? 'none' : 'slide'}
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
                      text: standingErrorText(errText(e)),
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
        animationType={reducedMotion ? 'none' : 'fade'}
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

      {/* Hier hell (`ui`) — die Artikelseite sitzt auf Sand, nicht auf der
          Bühne. Dieselbe Komponente, andere Fläche; siehe ihren Kopf. */}
      <AgeGateSheet
        visible={ageOpen}
        surface="ui"
        state={ageState ?? 'missing'}
        busy={setBirthDate.isPending}
        notice={ageNotice}
        onClose={() => setAgeOpen(false)}
        onSubmit={(iso) => {
          setAgeNotice(null);
          setBirthDate
            .mutateAsync(iso)
            .then((next) => {
              if (next === 'adult') {
                setAgeOpen(false);
                setNotice({ text: 'Alles klar — jetzt kannst du kaufen. 🙂' });
              }
            })
            .catch((e: unknown) =>
              setAgeNotice(ageGateError(errText(e))),
            );
        }}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  loadError: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  refreshError: { margin: space.lg, padding: space.md, borderRadius: radius.md, backgroundColor: ui.card, alignItems: 'center', gap: space.sm },

  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },

  body: { padding: space.lg, gap: space.md },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.sm },
  price: { fontSize: 28, fontWeight: '700', color: ui.text },
  // Klein und gedämpft: Es ist eine Einschränkung, keine zweite Zahl.
  priceAdd: { fontSize: 13, color: ui.textMuted },
  title: { fontSize: 24, fontWeight: '600', color: ui.text, lineHeight: 31 },

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
  legalText: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: ui.text },
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
  sellerName: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: ui.text },
  sellerStats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 2 },
  sellerStatText: { fontSize: 12, color: ui.textMuted },

  shipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  shipText: { flex: 1, flexShrink: 1, fontSize: 13, color: ui.textMuted, lineHeight: 20 },

  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ui.line,
    backgroundColor: ui.card,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  off: { opacity: 0.45 },
  buy: {
    minHeight: 52,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
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
  ghost: {
    minHeight: 52,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
  goneBar: {
    minHeight: 52,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
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
    minHeight: 52,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
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

  sellerStatIconPair: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  /* Hellgrün wie im Verkäufer-Sheet: Eine Bürgschaft ist kein Kaufknopf. */
  vouchLine: { fontSize: 12, color: ui.success, marginTop: 3, fontWeight: '600' },

  moreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.xs },
  moreCell: { width: '47%' },

  reportLink: { alignSelf: 'center', paddingVertical: space.sm, marginTop: space.sm },
  /* Klein, grau, mittig — eine Kennung ist kein Inhalt. `selectable`, damit
     man sie in eine Nachricht kopieren kann; genau dafuer gibt es sie. */
  /* Ruhig, nicht gruen: Kleinanzeigens Kasten ist ein Werbeelement fuer ein
     bezahltes Extra (1,40 €). Unserer ist eine Auskunft — er soll gelesen und
     nicht angepriesen werden. Dieselbe Flaeche wie die uebrigen Bloecke. */
  howBlock: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.md,
    marginTop: space.md,
    gap: space.sm,
  },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  howText: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 18, color: ui.textMuted },
  listingRef: { fontSize: 11, lineHeight: 16, color: ui.textMuted, textAlign: 'center', marginTop: space.md },
  reportLinkText: { fontSize: 13, fontWeight: '600', color: ui.textMuted },

  ownRow: { flexDirection: 'row', gap: space.sm },
  editBtn: {
    flex: 1,
    minHeight: 52,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
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

  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text, marginTop: space.sm, textAlign: 'center' },
  emptyBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.xl,
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: space.md,
    minHeight: 48,
    paddingVertical: space.sm,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: ui.text },
});
