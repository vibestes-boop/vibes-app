// Der Live-Auktions-Raum.
//
// Header and compact auction dock frame the video. The composer owns the bottom
// edge; comments, camera tools and secondary actions cannot displace it.
//
// Das Video selbst wird hier NICHT verbunden: die Verbindung hängt im
// Wurzel-Layout (components/LiveStage) und überlebt deshalb das Verkleinern.
// Hier wird nur ihr Bild gezeigt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Keyboard,
  Share,
  ScrollView,
  useWindowDimensions,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  Platform,
} from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

import { useIsFocused } from '@react-navigation/native';
import { LiveRoomLayout } from '../../components/LiveRoomLayout';
import { LiveChatPanel, LiveComposer, LiveChatHistory } from '../../components/LiveChatPanel';
import { StageSheet } from '../../components/StageSheet';
import { StageFeedback } from '../../components/StageFeedback';
import { useLiveSession } from '../../lib/useLiveSession';
import { useLiveChatDraft } from '../../lib/useLiveChatDraft';
import { goBack } from '../../lib/nav';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Heart,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Package,
  Share2,
  ShoppingBag,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';

import { PressFeedback } from '../../components/PressFeedback';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { errText } from '../../lib/errorText';
import { sendLiveComment, useLiveChat } from '../../lib/useLiveChat';
import { studioErrorText, useStudioActions } from '../../lib/useStudio';
import { useFollow } from '../../lib/useFollow';
import { useSellerStats } from '../../lib/useSellerStats';
import { useMyBlocks, useSellerActions, type ReportReason } from '../../lib/useSellerActions';
import { SellerSheet } from '../../components/SellerSheet';
import {
  giveawayErrorText,
  useGiveawayActions,
  useLiveGiveaway,
  useMyGiveawayEntry,
} from '../../lib/useGiveaway';
import { useLivePlayer } from '../../lib/livePlayer';
import { showLink } from '../../lib/links';
import { useLiveReactions } from '../../lib/useReactions';
import { liveKitAvailable } from '../../lib/livekit';
import { liveAccessErrorText, toLiveAccessError, useLiveAccess } from '../../lib/useLiveVideo';
import { stage, radius, space } from '../../theme/tokens';
import { useCheckoutCart } from '../../lib/useCheckout';
import { shippingHint, useShippingFrom } from '../../lib/useShipping';
import { useBerkatSeller } from '../../lib/useBerkatSeller';
import { useVouches, vouchSummary, vouchSummaryShort } from '../../lib/useVouch';
import {
  bidErrorText,
  formatCartWindow,
  formatEuro,
  nextMinBid,
  useCart,
  useCountdown,
  useLiveAuctions,
  useMyMaxBid,
  usePlaceBid,
  useProfiles,
  useServerClock,
  useSetMaxBid,
  useSettleOnZero,
} from '../../lib/useAuction';
import { AuctionPanel } from '../../components/AuctionPanel';
import { LiveSellerHeader } from '../../components/LiveSellerHeader';
import { FloatingHearts, TapHearts } from '../../components/FloatingHearts';
import { GiveawayCard } from '../../components/GiveawayCard';
import { MaxBidSheet } from '../../components/MaxBidSheet';
import { AgeGateSheet } from '../../components/AgeGateSheet';
import {
  ageGateError,
  ageGateReason,
  useBirthDateState,
  useSetBirthDate,
} from '../../lib/useAgeGate';
import { ShowItemsSheet } from '../../components/ShowItemsSheet';
import { ViewersSheet } from '../../components/ViewersSheet';
import { useLiveViewers } from '../../lib/useLiveViewers';
import { EarningsSheet } from '../../components/EarningsSheet';
import { useShowEarnings } from '../../lib/useShowEarnings';

const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

/* ⚠️ DER SCHATTEN ERSETZT DEN KREIS — er schmückt ihn nicht.
   Bis zum 21.08.2026 saß jedes Symbol der rechten Leiste auf einer schwarzen
   Scheibe (`rgba(0,0,0,0.35)`). Die war nicht Geschmack, sondern Lesbarkeit:
   Ohne Fläche steht ein weißes Symbol auf dem nackten Video — und das Video
   kontrolliert niemand. Hält der Verkäufer eine weiße Abaya vor eine weiße
   Wand, ist die halbe Bedienung unsichtbar (Abschnitt 8: „lesbar auf dem einen
   Bild, unsichtbar auf dem nächsten").

   Whatnot löst dasselbe Problem ohne Scheibe: größeres Symbol, harter
   Schlagschatten. Das ist genau der Mittelweg, der in Abschnitt 58 notiert und
   damals nicht gebaut wurde — die Scheibe fällt weg, die Lesbarkeit bleibt.

   Gezeichnet wird deshalb ZWEIMAL: eine schwarze Kopie einen Punkt tiefer,
   darüber das eigentliche Symbol. Ein View-Schatten (`shadowColor`) wäre
   kürzer, käme aber auf Android nicht an — dort verlangt `elevation` eine
   Hintergrundfläche, und genau die soll weg. */
const RAIL_ICON = 26;
const RAIL_SHADOW = 'rgba(0,0,0,0.6)';

function RailIcon({ icon: Icon, color, fill }: { icon: LucideIcon; color: string; fill?: string }) {
  return (
    <View style={styles.railIcon}>
      <View style={styles.railIconShadow} pointerEvents="none">
        <Icon size={RAIL_ICON} color={RAIL_SHADOW} fill={fill ? RAIL_SHADOW : 'none'} />
      </View>
      <Icon size={RAIL_ICON} color={color} fill={fill ?? 'none'} />
    </View>
  );
}

type StageModule = {
  useStageReady: () => boolean;
  useStageConnectionState: () => string;
  StageVideo: (props: { hostIdentity: string; style: ViewStyle }) => React.ReactNode;
  HostControls: (props: Record<string, never>) => React.ReactNode;
  GoLiveGate: (props: { onGoLive: (facing: 'environment' | 'user') => void; onClose: () => void }) => React.ReactNode;
};

// Bedingt geladen: in Expo Go fehlen die nativen LiveKit-Module, und schon das
// Laden der Datei würde die App killen. `liveKitAvailable` ist eine
// Modul-Konstante — der Hook-Aufruf unten bleibt damit über die Laufzeit stabil.
const Stage = liveKitAvailable ? (require('../../components/LiveStage') as StageModule) : null;
const useStageReady = Stage?.useStageReady ?? (() => false);
const useStageConnectionState = Stage?.useStageConnectionState ?? (() => 'disconnected');
const StageVideo = Stage?.StageVideo ?? null;
const HostControls = Stage?.HostControls ?? null;
const GoLiveGate = Stage?.GoLiveGate ?? null;

/** 1240 Herzen sind „1,2k" — die genaue Zahl interessiert ab hier niemanden. */
function formatCount(value: number): string {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(1).replace('.', ',').replace(',0', '')}k`;
}

/** Echte Zahl statt Sternchen: erteilte Zuschläge dieses Verkäufers. */
function useSellerSoldCount(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'seller-sold', sellerId],
    enabled: Boolean(sellerId),
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('live_auctions')
        .select('id', { count: 'exact', head: true })
        .eq('seller_id', sellerId!)
        .eq('status', 'sold');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export default function LiveAuctionRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSession(s => s.userId);
  return <LiveAuctionRoomScreen key={`${id}:${userId ?? 'guest'}`} />;
}

function LiveAuctionRoomScreen() {
  const focused = useIsFocused();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(44);
  const { fontScale } = useWindowDimensions();
  const myUserId = useSession((s) => s.userId);

  const { serverNow } = useServerClock();
  const roomQuery = useLiveSession(id, myUserId, focused);
  const { data: session, isLoading } = roomQuery;
  const { auctions, active, upcoming, error: auctionsError, isLoading: auctionsLoading, isFetching: auctionsFetching, refetch: retryAuctions } = useLiveAuctions(id);
  const secondsLeft = useCountdown(active?.ends_at ?? null, serverNow);
  useSettleOnZero(active, secondsLeft);

  const { data: soldCount } = useSellerSoldCount(session?.host_id);
  const { data: cart } = useCart(myUserId, session?.host_id);
  // ⚠️ Ohne Stufe, also mit der teuersten. Show-Artikel entstehen über
  // `create_live_auction` und tragen heute keine `shipping_tier` — der Satz
  // „ab 4,90 €" ist damit die WAHRE Untergrenze. Wer dem Live-Studio eine
  // Stufenwahl gibt, reicht sie hier durch; vorher wäre jede kleinere Zahl
  // ein Versprechen, das die Kasse nicht hält.
  const { data: shippingFrom } = useShippingFrom(session?.host_id);
  // ⚠️ Ohne Kassen-Freigabe kann der Zuschlag nicht über Berkat bezahlt
  // werden (ZAG, `20260823120000`). Der Riegel steht serverseitig an der
  // Kasse — hier steht nur die Auskunft, VOR dem Gebot. Ohne sie erführe der
  // Käufer es erst, nachdem er gewonnen hat.
  const { data: hostSeller } = useBerkatSeller(session?.host_id);
  const hostTakesPayment = hostSeller?.checkout_enabled === true;
  const { data: vouches = [] } = useVouches(session?.host_id, myUserId);
  // Kurzfassung für den Kopf; die lange bleibt dem Sheet vorbehalten.
  const vouchShort = vouchSummaryShort(vouches);
  const chatQuery = useLiveChat(id, myUserId, focused && session?.status === 'active');
  const comments = chatQuery.data ?? [];
  const placeBid = usePlaceBid();
  const follow = useFollow(session?.host_id, myUserId);
  const { startAuction } = useStudioActions(id);
  const hearts = useLiveReactions(id, myUserId, session?.like_count ?? 0);

  const isHost = Boolean(myUserId && session?.host_id === myUserId);
  const connected = useLivePlayer((s) => s.connected);
  const stageReady = useStageReady();
  const connectionState = useStageConnectionState();
  const access = useLiveAccess(
    session?.room_name,
    isHost,
    Boolean(Stage) && session?.status === 'active' && connected,
  );

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const afterMoreClose = useRef<(() => void) | null>(null);
  const moreAction = (action: () => void) => { afterMoreClose.current = action; setMoreOpen(false); };
  const finishMoreClose = () => { const action = afterMoreClose.current; afterMoreClose.current = null; action?.(); };
  const [paying, setPaying] = useState(false);

  // Bezahlen am Ende der Show — dort, wo der Käufer gerade steht.
  //
  // Vorher führte der Weg von hier aus: Raum verlassen → Reiter „Konto"
  // finden → bezahlen. Der Bildschirm sagte das sogar wörtlich („wartet unter
  // Konto"), was für einen Menschen, der eben vor Publikum gewonnen hat, eine
  // Hausaufgabe statt eines Abschlusses ist.
  //
  // Bewusst NUR hier und ausdrücklich NICHT neben der laufenden Auktion:
  // `checkout_auction_cart` friert den Korb ein (`checkout_pending`, siehe
  // Übergabe Abschnitt 4 „Der Korb friert beim Gang zur Kasse ein"). Jeder
  // weitere Zuschlag landet danach in einem NEUEN Korb — wer mitten in der
  // Show bezahlt, zahlt beim nächsten Gewinn ein zweites Mal Versand. Der
  // Sammelkorb ist das, was eine 5-€-Auktion überhaupt erst wirtschaftlich
  // macht; ein Knopf, der ihn mittendrin zerschneidet, gehört nicht in eine
  // laufende Show. Ist die Show vorbei, kommt aus ihr auch nichts mehr nach.
  const checkout = useCheckoutCart();
  const payCart = useCallback(
    async (cartId: string) => {
      setPaying(true);
      setNotice(null);
      const result = await checkout(cartId);
      setPaying(false);
      if (!result.ok) setNotice(result.message);
    },
    [checkout],
  );
  const [duration, setDuration] = useState(30);
  const [startBusy, setStartBusy] = useState(false);
  const sendComment = useCallback((text: string) => id && myUserId ? sendLiveComment(id, myUserId, text) : Promise.resolve(false), [id, myUserId]);
  const chatDraft = useLiveChatDraft(sendComment);
  const { draft, setDraft } = chatDraft;
  const [chatHidden, setChatHidden] = useState(false);
  const [maxOpen, setMaxOpen] = useState(false);

  /**
   * ── Die Altersschranke ──────────────────────────────────────────────────
   *
   * Ein Gebot ist eine bindende Willenserklärung; die eines Minderjährigen ist
   * ohne die Eltern schwebend unwirksam (§§ 106-108 BGB, siehe
   * `lib/useAgeGate.ts`). Der Riegel selbst hängt an `live_bids` — hier steht
   * nur die Frage davor.
   *
   * ⚠️ ZWEIMAL abgefangen, und das ist Absicht:
   *
   *   VORHER   — wenn der Zustand schon bekannt ist, spart es einen Rundweg
   *              mitten in einer laufenden Uhr.
   *   NACHHER  — an der Antwort des Servers, für alles, was das Vorher nicht
   *              kennt (frisch angemeldet, Zwischenspeicher leer, ein Weg, den
   *              jemand später hinzufügt).
   *
   * Nur das Erste zu bauen hiesse, sich auf einen Client zu verlassen; nur das
   * Zweite hiesse, jedem Neuen sein erstes Gebot zu verbrennen.
   */
  const { data: ageState } = useBirthDateState(myUserId);
  const setBirthDate = useSetBirthDate(myUserId);
  const [ageOpen, setAgeOpen] = useState(false);
  const [ageNotice, setAgeNotice] = useState<string | null>(null);

  /** `true` = der Weg ist frei. `false` = das Blatt ist auf, hier ist Schluss. */
  const passAgeGate = useCallback(() => {
    if (ageState === 'adult') return true;
    // `undefined` heisst „noch nicht geladen", nicht „nicht volljährig" — in
    // dem Fall darf der Server entscheiden, und das Netz unten fängt es.
    if (ageState === undefined) return true;
    setAgeNotice(null);
    setAgeOpen(true);
    return false;
  }, [ageState]);
  const [sellerOpen, setSellerOpen] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [earningsOpen, setEarningsOpen] = useState(false);

  // Wer ist der Mensch da vorne? Die Zahlen holt das Sheet erst, wenn es
  // gebraucht wird — sonst zahlte jeder Zuschauer drei Abfragen für einen
  // Bildschirm, den die meisten nie öffnen.
  const { data: sellerStats } = useSellerStats(sellerOpen ? session?.host_id : undefined);
  // Läuft nur, solange das Blatt offen ist — und dann mit Takt. Die Begründung
  // für den Takt steht in `useLiveViewers`: In einem Raum, der offen bleibt,
  // löst sonst nichts ein Nachladen aus.
  const {
    data: viewers,
    isLoading: viewersLoading,
    error: viewersError,
  } = useLiveViewers(id, viewersOpen && isHost);
  // ⚠️ Anders als die Zuschauerliste läuft das hier, solange der Gastgeber im
  // Raum ist — nicht nur bei offenem Blatt. Der Grund ist die Beschriftung in
  // der Leiste: Sie IST die Zahl, und eine Zahl, die erst nach dem Öffnen
  // stimmt, wäre keine. Kostenlos ist das trotzdem: Nachgeladen wird über das
  // Realtime-Abo bei `sold`, nicht über einen Takt (siehe `useShowEarnings`).
  const {
    data: earnings,
    isLoading: earningsLoading,
    error: earningsError,
  } = useShowEarnings(id, isHost, earningsOpen);
  const { data: blocked } = useMyBlocks(myUserId);
  const { block, unblock, report } = useSellerActions(myUserId);
  const chatInputRef = useRef<TextInput>(null);

  const { data: myMax } = useMyMaxBid(active?.id, myUserId);
  const setMaxBid = useSetMaxBid();

  const giveaway = useLiveGiveaway(id);
  const { data: enteredGiveaway } = useMyGiveawayEntry(giveaway?.id, myUserId);
  const { createGiveaway, enterGiveaway, drawGiveaway, busy: giveawayBusy } =
    useGiveawayActions(id);

  const runGiveaway = useCallback(async (action: () => Promise<unknown>) => {
    try {
      setNotice(null);
      await action();
    } catch (error) {
      setNotice(giveawayErrorText(errText(error)));
    }
  }, []);

  const submitMaxBid = useCallback(
    async (maxCents: number) => {
      if (!active || auctionsError || roomQuery.isError) return;
      setBusy(true);
      const outcome = await setMaxBid(active.id, maxCents);
      setBusy(false);
      setMaxOpen(false);
      if (!outcome.ok) {
        // ⚠️ Auch hier. Ein Maximum ist ein Gebot auf Vorrat — es schreibt
        // dieselbe `live_bids`-Zeile und läuft in denselben Riegel.
        if (ageGateReason(outcome.reason)) {
          setAgeNotice(null);
          setAgeOpen(true);
          return;
        }
        setNotice(bidErrorText(outcome.reason));
      }
    },
    [active, setMaxBid, auctionsError, roomQuery.isError],
  );

  // Zuschauer zählen — über dieselbe RPC wie Serlo, die doppelte Eintritte
  // desselben Kontos abfängt. Der Gastgeber zählt bewusst nicht mit: sonst
  // stünde in einer leeren Show immer "1".
  //
  // Das `.then()` ist PFLICHT, nicht Kosmetik: `supabase.rpc()` liefert einen
  // faulen Erzeuger, der die Anfrage erst beim Abwarten losschickt. Ein blankes
  // `void supabase.rpc(…)` baut ihn nur und wirft ihn weg — es geht nie etwas
  // raus, und zwar völlig lautlos. Genau so zählte die Zuschauerzahl bis zum
  // 14.08. nie, obwohl der Code richtig aussah.
  useEffect(() => {
    if (!id || !myUserId || !session || session.status !== 'active' || isHost) return;
    void supabase.rpc('join_live_session', { p_session_id: id }).then(({ error }) => {
      if (error && __DEV__) console.warn('[Berkat] Eintritt nicht gezählt:', error.message);
    });
    return () => {
      // Beim Verkleinern bleibt man Zuschauer — die Show läuft ja weiter.
      if (!useLivePlayer.getState().minimized) {
        void supabase.rpc('leave_live_session', { p_session_id: id }).then(({ error }) => {
          if (error && __DEV__) console.warn('[Berkat] Austritt nicht gezählt:', error.message);
        });
      }
    };
  }, [id, myUserId, isHost, session?.id, session?.status]);

  // Restore only this confirmed, visible room. A failing deep link must not change another mini-player.
  useEffect(() => {
    if (focused && session?.id === id && session?.status === 'active') useLivePlayer.getState().restore();
  }, [focused, id, session?.id, session?.status]);

  // Show im Player anmelden, damit sie das Verkleinern überlebt.
  useEffect(() => {
    if (!session || session.status !== 'active') return;
    useLivePlayer.getState().open({
      id: session.id,
      title: session.title,
      thumbnailUrl: session.thumbnail_url,
      roomName: session.room_name,
      hostId: session.host_id,
      isHost: Boolean(myUserId && session.host_id === myUserId),
    });
  }, [session, myUserId]);

  const minimize = useCallback(() => {
    Keyboard.dismiss();
    useLivePlayer.getState().minimize();
    goBack('/(tabs)/');
  }, []);

  /** Endgültig raus — im Gegensatz zum Verkleinern bleibt nichts zurück. */
  const leaveRoom = useCallback(() => {
    Keyboard.dismiss();
    if (useLivePlayer.getState().session?.id === id) useLivePlayer.getState().close();
    goBack('/(tabs)/');
  }, [id]);

  // Endet die Show, während man zusieht, muss auch das kleine Fenster weg.
  // Sonst schwebt weiter ein „live"-Fenster über den Reitern, hinter dem nichts
  // mehr sendet — genau das war am 14.08. zu sehen.
  useEffect(() => {
    if (session && session.status !== 'active' && useLivePlayer.getState().session?.id === session.id) {
      useLivePlayer.getState().close();
    }
  }, [session]);

  const startItem = useCallback(
    async (auctionId: string) => {
      if (auctionsError || roomQuery.isError || startBusy) return;
      setStartBusy(true);
      try {
        await startAuction(auctionId, duration);
        setItemsOpen(false);
        setNotice(null);
      } catch (error) {
        setNotice(studioErrorText(errText(error)));
      } finally {
        setStartBusy(false);
      }
    },
    [startAuction, duration, auctionsError, roomQuery.isError, startBusy],
  );

  const chatUserIds = useMemo(() => comments.map((c) => c.user_id), [comments]);
  const profiles = useProfiles([
    session?.host_id,
    active?.current_bidder_id,
    giveaway?.winner_id,
    ...chatUserIds,
  ]);

  const onBid = useCallback(
    async (amountCents: number) => {
      if (!active || auctionsError || roomQuery.isError) return;
      if (!myUserId) {
        router.push('/login');
        return;
      }
      if (!passAgeGate()) return;
      setBusy(true);
      const outcome = await placeBid(active.id, amountCents);
      setBusy(false);
      if (!outcome.ok) {
        // Das Netz: Sagt der Server „zu jung" oder „noch nichts gesagt", ist
        // das keine Fehlermeldung, sondern eine Frage — also aufmachen statt
        // abweisen.
        if (ageGateReason(outcome.reason)) {
          setAgeNotice(null);
          setAgeOpen(true);
          return;
        }
        setNotice(bidErrorText(outcome.reason));
        return;
      }
      setNotice(outcome.extended ? 'Verlängert — jemand hat kurz vor Schluss geboten' : null);
    },
    [active, myUserId, passAgeGate, placeBid, router, auctionsError, roomQuery.isError],
  );

  // Ein leichter Stups, nicht die Erfolgs-Haptik: Applaus ist kein Höhepunkt,
  // und wer zwanzigmal klatscht, soll das Gerät nicht zwanzigmal feiern hören.
  //
  // Mit Punkt fliegt das Herz am Finger los, ohne am Herz-Knopf.
  const sendHeart = useCallback(
    (x?: number, y?: number) => {
      // Wer beim Tippen danebenlangt, will die Tastatur weghaben. Der
      // angefangene Text bleibt stehen, das Feld behält ihn.
      Keyboard.dismiss();
      if (!myUserId) {
        router.push('/login');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      hearts.react(x != null && y != null ? { x, y } : undefined);
    },
    [myUserId, router, hearts],
  );

  const chatSendDisabled = chatDraft.busy || !draft.trim() || chatQuery.isError || chatQuery.isPending || roomQuery.isError || session?.status !== 'active';
  const sendChat = useCallback(() => {
    if (chatSendDisabled) return;
    if (!myUserId) { router.push('/login'); return; }
    void chatDraft.submit();
  }, [chatSendDisabled, myUserId, router, chatDraft.submit]);

  // ── Was man mit dem Verkäufer tun kann ────────────────────────────────────
  // Alle sechs Wege laufen über das Sheet; hier steht nur, wohin sie führen.

  const hostName = profiles[session?.host_id ?? '']?.username;

  // ⚠️ Als LINK teilen, nicht als Text mit Link darin (14.09.2026, aus der
  // ersten echten Show gemeldet). iOS zeigt für Text ein nacktes „A"; für
  // einen Link holt es Titel und Bild von der Seite (`og:image` auf
  // `live.html`) und zeigt eine Karte — wie bei Whatnot. Deshalb steht die
  // Adresse auf iOS in `url`, und die Nachricht enthält sie NICHT noch einmal,
  // sonst stünde sie in iMessage doppelt. Android kennt nur `message`; dort
  // gehört der Link in den Text.
  //
  // Steht bewusst HINTER `hostName`: Der Block lag vorher weiter oben, wo es
  // weder `profiles` noch `hostName` gab — deshalb hieß es „Schau dir das an"
  // statt „zaur ist gerade live".
  const shareShow = useCallback(() => {
    if (!id) return;
    const link = showLink(id);
    const who = hostName ? `${hostName} ist gerade live bei Berkat` : 'Gerade live bei Berkat';
    void Share.share(
      Platform.OS === 'ios' ? { url: link, message: who } : { message: `${who}: ${link}` },
      { subject: 'Live bei Berkat', dialogTitle: 'Show teilen' },
    );
  }, [id, hostName]);

  /**
   * `@name ` ins Chat-Feld schreiben und das offene Blatt schließen.
   *
   * Seit dem 16.08.2026 allgemein statt nur für den Gastgeber: Dieselbe Geste
   * bedient das Verkäufer-Sheet und die Zuschauerliste. Wer zweimal denselben
   * Namen anhängt, bekommt ihn nur einmal — sonst steht `@amir32 @amir32` da.
   */
  const mentionUser = useCallback((username: string | null | undefined) => {
    if (!username) return;
    setSellerOpen(false);
    setViewersOpen(false);
    setChatHidden(false);
    setDraft((current) => {
      const tag = `@${username} `;
      if (current.includes(tag.trim())) return current;
      return current ? `${current.trimEnd()} ${tag}` : tag;
    });
    // Erst schließen lassen, dann Fokus — sonst nimmt das Modal ihn wieder weg.
    setTimeout(() => chatInputRef.current?.focus(), 250);
  }, []);

  const mentionHost = useCallback(() => mentionUser(hostName), [mentionUser, hostName]);

  const requireLogin = useCallback(() => {
    if (myUserId) return false;
    setSellerOpen(false);
    router.push('/login');
    return true;
  }, [myUserId, router]);

  const openSellerProfile = useCallback(() => {
    if (!session?.host_id) return;
    setSellerOpen(false);
    router.push(`/seller/${session.host_id}`);
  }, [router, session?.host_id]);

  const openConversation = useCallback(() => {
    if (!session?.host_id || requireLogin()) return;
    setSellerOpen(false);
    router.push(`/messages/${session.host_id}`);
  }, [router, session?.host_id, requireLogin]);

  const openTip = useCallback(() => {
    if (!session?.host_id || requireLogin()) return;
    setSellerOpen(false);
    // Die Show wandert mit: Später lässt sich damit beantworten, welcher Abend
    // was eingebracht hat, ohne dass wir die Zuordnung nachträglich raten.
    router.push(`/tip/${session.host_id}?session=${id}`);
  }, [router, session?.host_id, requireLogin, id]);

  const blockHost = useCallback(async () => {
    if (!session?.host_id || requireLogin()) return;
    const res = await block(session.host_id);
    setSellerOpen(false);
    setNotice(res.ok ? `${hostName ?? 'Verkäufer'} ist gesperrt.` : res.message);
  }, [block, session?.host_id, hostName, requireLogin]);

  const unblockHost = useCallback(async () => {
    if (!session?.host_id) return;
    const res = await unblock(session.host_id);
    setSellerOpen(false);
    setNotice(res.ok ? 'Sperre aufgehoben.' : res.message);
  }, [unblock, session?.host_id]);

  const reportHost = useCallback(
    async (reason: ReportReason) => {
      if (!session?.host_id || requireLogin()) return;
      const res = await report(session.host_id, reason);
      setSellerOpen(false);
      setNotice(
        res.ok ? 'Danke — wir schauen uns das an. 🙏' : res.message,
      );
    },
    [report, session?.host_id, requireLogin],
  );

  if (isLoading || (roomQuery.isError && !session)) {
    return <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }}>
      <StatusBar style="light" />
      <StageFeedback title={isLoading ? 'Show wird geladen' : 'Show gerade nicht erreichbar'}
        body={isLoading ? 'Einen Moment …' : 'Bitte versuche es erneut. Deine Verbindung kann gerade unterbrochen sein.'} loading={isLoading}
        action={isLoading ? undefined : { label: 'Erneut laden', onPress: () => void roomQuery.refetch({ cancelRefetch: false }), busy: roomQuery.isFetching }}
        secondary={{ label: 'Zurück', onPress: leaveRoom }} />
    </ScrollView>;
  }

  // Die Show ist zu Ende — als eigener Zustand, nicht als leerer Raum.
  //
  // Vorher blieb hier alles stehen: Chat, Leiste, Sammelkorb-Leiste. Nur das
  // Video fehlte, weil die Verbindung an `status === 'active'` hängt. Der
  // Zuschauer sah eine dunkelgrüne Fläche und wartete auf etwas, das nicht mehr
  // kommt. Der Hinweis auf das Paket steht bewusst dabei: Wer gerade etwas
  // gewonnen hat, soll wissen, wo es liegt.
  if (session && session.status !== 'active') {
    // Als eigene Bindung, nicht als `cart && …` im JSX: TypeScript verengt
    // `cart` sonst innerhalb der Zweige nicht, und der Betrag am Knopf wäre
    // ohne Ausrufezeichen nicht zu haben.
    const wonCart = cart && cart.itemCount > 0 ? cart : null;
    return (
      <ScrollView key={fontScale} style={styles.screen} contentContainerStyle={[styles.center, { flexGrow: 1, padding: space.xl, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}>
        <StatusBar style="light" />
        <Text style={styles.emptyTitle}>Die Show ist zu Ende</Text>
        <Text style={styles.emptyBody}>
          {wonCart
            ? `Du hast ${wonCart.itemCount} Artikel gewonnen — alles zusammen in einem Paket. 🎉`
            : 'Danke fürs Zuschauen — schau, wer gerade sonst live ist.'}
        </Text>

        {wonCart ? (
          <>
            <PressFeedback
              style={[styles.payNow, paying && styles.payNowBusy]}
              disabled={paying}
              onPress={() => void payCart(wonCart.id)}
              accessibilityRole="button"
              accessibilityLabel={`${formatEuro(wonCart.totalCents)} bezahlen`}
            >
              {paying ? (
                <ActivityIndicator color={stage.goldInk} />
              ) : (
                <>
                  <Package size={18} color={stage.goldInk} />
                  <Text style={styles.payNowText}>
                    {formatEuro(wonCart.totalCents)} bezahlen
                  </Text>
                </>
              )}
            </PressFeedback>
            <Text style={styles.payNowHint}>
              {notice ??
                [shippingHint(shippingFrom), 'Adresse gibst du auf der Bezahlseite ein.']
                  .filter(Boolean)
                  .join(' · ')}
            </Text>
          </>
        ) : null}

        <PressFeedback style={styles.backButton} onPress={leaveRoom} accessibilityRole="button">
          {/* „Später" statt „Zurück", solange etwas offen ist: Der Korb bleibt
              24 Stunden stehen, und wer jetzt nicht zahlt, hat nichts verloren.
              „Zurück" würde daneben wie Abbrechen aussehen. */}
          <Text style={styles.backButtonText}>{wonCart ? 'Später' : 'Zurück'}</Text>
        </PressFeedback>
      </ScrollView>
    );
  }

  if (!session) {
    return <ScrollView style={styles.screen} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.lg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }}>
      <StatusBar style="light" />
      <StageFeedback title="Diese Show ist nicht verfügbar" body="Kehre zur Übersicht zurück und entdecke weitere Shows."
        secondary={{ label: 'Zurück', onPress: leaveRoom }} />
    </ScrollView>;
  }

  const roomNotice = roomQuery.isError ? <StageFeedback title="Show konnte nicht aktualisiert werden" body="Du siehst den zuletzt geladenen Stand."
    action={{ label: 'Erneut laden', onPress: () => void roomQuery.refetch({ cancelRefetch: false }), busy: roomQuery.isFetching }} />
    : access.error ? <StageFeedback title="Video gerade nicht erreichbar" body={liveAccessErrorText(toLiveAccessError(access.error))}
      action={{ label: 'Erneut verbinden', onPress: () => void access.refetch({ cancelRefetch: false }), busy: access.isFetching }} />
    : !Stage ? <StageFeedback title="Video gerade nicht verfügbar" body="Schließe die App und öffne sie erneut."
      secondary={{ label: 'Show verlassen', onPress: leaveRoom }} />
    : connected && access.isPending && session.room_name ? <StageFeedback title="Video wird verbunden" loading />
    : stageReady && (connectionState === 'connecting' || connectionState === 'reconnecting' || connectionState === 'signalReconnecting') ? <StageFeedback
      title={connectionState === 'connecting' ? 'Video wird verbunden' : 'Verbindung wird wiederhergestellt'} loading />
    : stageReady && connectionState === 'disconnected' ? <StageFeedback title="Videoverbindung unterbrochen" body="Verlasse die Show und öffne sie erneut."
      secondary={{ label: 'Show verlassen', onPress: leaveRoom }} />
    : chatQuery.isPending ? <StageFeedback title="Chat wird geladen" loading />
    : chatQuery.isError ? <StageFeedback title="Chat gerade nicht erreichbar" body="Dein Text bleibt erhalten. Lade den Chat erneut."
      action={{ label: 'Chat laden', onPress: () => void chatQuery.refetch({ cancelRefetch: false }), busy: chatQuery.isFetching }} />
    : chatDraft.error ? <StageFeedback title="Kommentar nicht bestätigt" body={chatDraft.error}
      action={{ label: 'Verstanden', onPress: chatDraft.clearError }} />
    : notice ? <StageFeedback title={notice} action={{ label: 'Schließen', onPress: () => setNotice(null) }} /> : null;

  const host = profiles[session.host_id];
  const leaderId = active?.status === 'sold' ? active.winner_id : active?.current_bidder_id;
  const leader = leaderId ? profiles[leaderId] ?? null : null;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      {/* Das Cover liegt immer darunter: solange die Verbindung steht, sieht
          man etwas statt einer schwarzen Fläche. */}
      {session.thumbnail_url ? (
        <Image source={{ uri: session.thumbnail_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}

      {stageReady && StageVideo ? (
        <StageVideo hostIdentity={session.host_id} style={FILL} />
      ) : null}

      {/* Tippen aufs Bild schickt ein Herz, wie bei TikTok und Whatnot.
          Die Fläche liegt bewusst GANZ UNTEN im Stapel, direkt über dem Video:
          Wer einen Knopf trifft, bedient den Knopf — hier landet nur, was
          daneben geht. Möglich macht das `box-none` auf den Ebenen darüber,
          die bloß anordnen und selbst nichts bedienen. */}
      <View
        style={FILL}
        onStartShouldSetResponder={() => true}
        onResponderRelease={(event) =>
          Keyboard.isVisible() ? Keyboard.dismiss() : sendHeart(event.nativeEvent.pageX, event.nativeEvent.pageY)
        }
      />

      <LinearGradient
        colors={['rgba(11,21,18,0.8)', 'rgba(11,21,18,0)']}
        style={[styles.topScrim, { height: insets.top + Math.max(84, headerHeight + space.md) }]}
        pointerEvents="none"
      />
      {/* `box-none` von hier abwärts durch alle reinen Anordnungs-Ebenen:
          Kopfzeile, Mitte und die Spalte selbst sollen keine Berührung
          schlucken, die nicht auf einem ihrer Knöpfe landet. Sonst wäre der
          größte Teil des Bildes tot. */}
      <LiveRoomLayout
        onHeaderLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
        header={<>
        <LiveSellerHeader name={host?.username} avatarUrl={host?.avatarUrl} vouch={vouchShort} soldCount={soldCount}
          viewerCount={session.viewer_count ?? 0} isHost={isHost} follow={follow}
          onSeller={() => { Keyboard.dismiss(); setSellerOpen(true); }} onViewers={() => { Keyboard.dismiss(); setViewersOpen(true); }} onMinimize={minimize} />
          {isHost && HostControls && stageReady ? <HostControls /> : null}
          {roomNotice ? <View style={{ padding: space.md }}>{roomNotice}</View> : null}
        </>}
        banner={<>


        {session.women_only ? (
          <View style={styles.wozBadge}>
            <Lock size={10} color={stage.successInk} />
            <Text style={styles.wozText}>Frauen-Only</Text>
          </View>
        ) : null}

        {giveaway ? (
          <View style={styles.giveawayWrap}>
            <GiveawayCard
              giveaway={giveaway}
              isHost={isHost}
              entered={Boolean(enteredGiveaway)}
              winnerName={giveaway.winner_id ? profiles[giveaway.winner_id]?.username ?? null : null}
              busy={giveawayBusy}
              onEnter={() => void runGiveaway(() => enterGiveaway(giveaway.id))}
              onDraw={() => void runGiveaway(() => drawGiveaway(giveaway.id))}
            />
          </View>
        ) : null}

        </>}
        chat={compact => <LiveChatPanel comments={comments.filter(comment => !blocked?.has(comment.user_id))} profiles={profiles}
          hidden={chatHidden} onHiddenChange={setChatHidden} compact={compact} />}
        composer={<LiveComposer inputRef={chatInputRef} draft={draft} onChangeText={setDraft}
          onSend={sendChat} sending={chatDraft.busy} sendDisabled={chatSendDisabled} />}
        rail={<>
            <PressFeedback
              style={styles.railItem}
              // Ohne Klammer bekäme `sendHeart` das Berührungs-Ereignis als
              // ersten Wert übergeben und hielte es für eine X-Koordinate.
              onPress={() => sendHeart()}
              accessibilityRole="button"
              accessibilityLabel="Herz senden"
            >
              <RailIcon icon={Heart} color={stage.live} fill={stage.live} />
              <Text key={`rail-label-${fontScale}`} style={styles.railLabel}>{formatCount(hearts.likes)}</Text>
            </PressFeedback>
            <PressFeedback
              style={styles.railItem}
              onPress={() => { Keyboard.dismiss(); setItemsOpen(true); }}
              accessibilityRole="button"
            >
              <View>
                <RailIcon icon={ShoppingBag} color={stage.text} />
                {auctions.length > 0 ? (
                  <View style={styles.railBadge}>
                    <Text key={`rail-count-${fontScale}`} style={styles.railBadgeText}>{auctions.length}</Text>
                  </View>
                ) : null}
              </View>
              <Text key={`rail-label-${fontScale}`} style={styles.railLabel}>Shop</Text>
            </PressFeedback>

            <PressFeedback style={styles.railItem} onPress={() => { Keyboard.dismiss(); setMoreOpen(true); }} accessibilityRole="button" accessibilityLabel="Weitere Show-Aktionen">
              <RailIcon icon={MoreHorizontal} color={stage.text} /><Text key={`rail-label-${fontScale}`} style={styles.railLabel}>Mehr</Text>
            </PressFeedback>
        </>}
        effects={<FloatingHearts reactions={hearts.reactions} />}
        auction={compact => <>
          {auctionsLoading ? <StageFeedback title="Artikel werden geladen" loading /> : auctionsError ? <StageFeedback title="Artikel gerade nicht erreichbar" body="Lade die Auktion erneut, bevor du bietest." action={{ label: 'Erneut laden', onPress: () => void retryAuctions({ cancelRefetch: false }), busy: auctionsFetching }} /> : <>
          <AuctionPanel
            compact={compact}
            isHost={isHost}
            onOpenItems={() => { Keyboard.dismiss(); setItemsOpen(true); }}
            auction={active}
            upcoming={upcoming}
            secondsLeft={secondsLeft}
            myUserId={myUserId}
            leader={leader}
            shippingFromCents={shippingFrom}
            sellerTakesPayment={hostTakesPayment}
            busy={busy || Boolean(auctionsError) || roomQuery.isError}
            cartLabel={
              cart && cart.itemCount > 0
                ? `${cart.itemCount} Artikel · 1 Paket · ${formatCartWindow(cart.closes_at, serverNow)}`
                : null
            }
            onBid={onBid}
            onStartNext={
              isHost && !active && upcoming.length > 0
                ? () => void startItem(upcoming[0].id)
                : undefined
            }
            startBusy={startBusy || Boolean(auctionsError) || roomQuery.isError}
            onMaxBid={!isHost && active && !auctionsError && !roomQuery.isError ? () => setMaxOpen(true) : undefined}
            myMaxCents={myMax ?? null}
          />
          </>}        </>}
      />

      {/* Über allem, weil der Punkt in Bildschirmkoordinaten kommt und sonst
          an der Innenkante der Spalte hängen bliebe. */}
      <TapHearts reactions={hearts.reactions} />

      <StageSheet visible={moreOpen} title="Show-Aktionen" onClose={() => setMoreOpen(false)} onDismiss={finishMoreClose}>
        <PressFeedback style={styles.moreItem} onPress={() => moreAction(shareShow)} accessibilityRole="button">
          <Share2 size={22} color={stage.text} /><Text key={`share-${fontScale}`} style={styles.moreLabel}>Show teilen</Text>
        </PressFeedback>
        {isHost ? <PressFeedback style={styles.moreItem} onPress={() => moreAction(() => setEarningsOpen(true))} accessibilityRole="button">
          <TrendingUp size={22} color={stage.text} /><Text key={`earnings-${fontScale}`} style={styles.moreLabel}>Umsatz & Zuschläge</Text>
        </PressFeedback> : null}
        <PressFeedback style={styles.moreItem} onPress={() => moreAction(() => setHistoryOpen(true))} accessibilityRole="button">
          <MessageSquare size={22} color={stage.text} /><Text key={`history-${fontScale}`} style={styles.moreLabel}>Chatverlauf öffnen</Text>
        </PressFeedback>
        <PressFeedback style={styles.moreItem} onPress={() => moreAction(() => setChatHidden(hidden => !hidden))} accessibilityRole="button" accessibilityState={{ selected: !chatHidden }}>
          <Text key={`visibility-${fontScale}`} style={styles.moreLabel}>{chatHidden ? 'Kommentare einblenden' : 'Kommentare ausblenden'}</Text>
        </PressFeedback>
      </StageSheet>
      <LiveChatHistory visible={historyOpen} onClose={() => setHistoryOpen(false)}
        comments={comments.filter(comment => !blocked?.has(comment.user_id))} profiles={profiles} />

      <ShowItemsSheet
        visible={itemsOpen}
        auctions={auctions}
        onClose={() => setItemsOpen(false)}
        isHost={isHost}
        duration={duration}
        onDuration={setDuration}
        onStart={(auctionId) => void startItem(auctionId)}
        blocked={Boolean(active) || startBusy || Boolean(auctionsError) || roomQuery.isError}
        onCreateGiveaway={
          isHost ? (title) => void runGiveaway(() => createGiveaway(title)) : undefined
        }
        giveawayOpen={giveaway?.status === 'open'}
        // Nur für den Gastgeber: Regal → laufende Sendung und zurück
        // (`20260821160000`). Ohne die Bedingung stünde der Knopf auch beim
        // Zuschauer, und `sellerId` wäre der fremde Gastgeber.
        sessionId={isHost ? id : undefined}
        hostId={isHost ? myUserId : null}
      />

      {active ? (
        <MaxBidSheet
          visible={maxOpen}
          minCents={nextMinBid(active)}
          currentMaxCents={myMax ?? null}
          busy={busy}
          onClose={() => setMaxOpen(false)}
          onSubmit={(cents) => void submitMaxBid(cents)}
        />
      ) : null}

      {/* ⚠️ `surface="stage"` — der Live-Raum ist Berkats einzige dunkle
          Fläche. Ein helles Blatt mitten in einer laufenden Sendung wäre ein
          Blitz (Übergabe 4, „zwei feste Flächen"). */}
      <AgeGateSheet
        visible={ageOpen}
        surface="stage"
        state={ageState ?? 'missing'}
        busy={setBirthDate.isPending}
        notice={ageNotice}
        onClose={() => setAgeOpen(false)}
        onSubmit={(iso) => {
          setAgeNotice(null);
          setBirthDate
            .mutateAsync(iso)
            .then((next) => {
              // Bei `minor` bleibt das Blatt offen und schlägt selbst in die
              // Absage um — wer gerade erfahren hat, dass er nicht mitbieten
              // darf, soll das lesen und nicht ein zuklappendes Blatt sehen.
              if (next === 'adult') {
                setAgeOpen(false);
                setNotice('Alles klar — jetzt kannst du bieten. 🙂');
              }
            })
            .catch((e: unknown) =>
              setAgeNotice(ageGateError(errText(e))),
            );
        }}
      />

      <ViewersSheet
        visible={viewersOpen}
        viewers={viewers ?? []}
        loading={viewersLoading}
        error={viewersError}
        onClose={() => setViewersOpen(false)}
        onMention={mentionUser}
        onOpenProfile={(userId) => {
          setViewersOpen(false);
          router.push(`/seller/${userId}`);
        }}
      />

      <EarningsSheet
        visible={earningsOpen}
        data={earnings}
        loading={earningsLoading}
        error={earningsError}
        onClose={() => setEarningsOpen(false)}
        onOpenProfile={(userId) => {
          setEarningsOpen(false);
          router.push(`/seller/${userId}`);
        }}
      />

      <SellerSheet
        visible={sellerOpen}
        sellerId={session.host_id}
        username={host?.username}
        avatarUrl={host?.avatarUrl}
        stats={sellerStats}
        isBlocked={Boolean(blocked?.has(session.host_id))}
        isSelf={isHost}
        vouchLine={vouchSummary(vouches)}
        follow={follow}
        onClose={() => setSellerOpen(false)}
        onTip={openTip}
        onProfile={openSellerProfile}
        onMessage={openConversation}
        onMention={mentionHost}
        onBlock={() => void blockHost()}
        onUnblock={() => void unblockHost()}
        onReport={(reason) => void reportHost(reason)}
      />

      {/* Ganz zuletzt, damit die Vorschau alles überdeckt: Wer die Kamera noch
          ausrichtet, soll nicht schon die Auktion bedienen können. */}
      {GoLiveGate && isHost && !connected ? (
        <GoLiveGate onGoLive={(facing) => useLivePlayer.getState().goLive(facing)} onClose={() => {
          useLivePlayer.getState().close();
          goBack('/(tabs)/sell');
        }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stage.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0 },
  moreItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: stage.line },
  moreLabel: { flex: 1, fontSize: 16, lineHeight: 23, color: stage.text },

  wozBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 3,
    marginTop: space.xs,
    marginRight: space.md,
    backgroundColor: stage.success,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  wozText: { fontSize: 10, fontWeight: '700', color: stage.successInk },
  giveawayWrap: { alignSelf: 'flex-end', marginTop: space.sm, marginRight: space.md },

  railItem: { minWidth: 44, minHeight: 44, alignItems: 'center', gap: 2 },
  railIcon: {
    width: RAIL_ICON,
    height: RAIL_ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Die schwarze Kopie liegt deckungsgleich darunter und ist um einen Punkt
  // nach unten versetzt — mehr wäre ein sichtbarer Doppelkontur-Effekt.
  railIconShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: 1.5 }],
  },
  // ⚠️ Der Textschatten gehört zur Lesbarkeit, nicht zur Optik — siehe den
  // Block über `RailIcon`. Ohne ihn verschwindet die Beschriftung auf einem
  // hellen Bild genauso wie das Symbol.
  railLabel: {
    fontSize: 11,
    color: stage.text,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  railBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: stage.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railBadgeText: { fontSize: 10, fontWeight: '700', color: stage.goldInk },

  emptyTitle: { fontSize: 17, fontWeight: '700', color: stage.text },
  emptyBody: {
    fontSize: 14,
    color: stage.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
  },
  // Gold ist auf der Bühne der Kauf — Gebot, Preis, Zuschlag-Weg. Der letzte
  // Schritt dieses Wegs trägt deshalb dieselbe Farbe wie der erste.
  payNow: {
    marginTop: space.lg,
    minHeight: 52,
    minWidth: 220,
    borderRadius: radius.pill,
    backgroundColor: stage.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: space.xl,
  },
  payNowBusy: { opacity: 0.6 },
  payNowText: { fontSize: 17, fontWeight: '700', color: stage.goldInk },
  payNowHint: {
    fontSize: 12,
    color: stage.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
  },

  backButton: {
    marginTop: space.lg,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: stage.lineStrong,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  backButtonText: { fontSize: 15, fontWeight: '700', color: stage.text },
});
