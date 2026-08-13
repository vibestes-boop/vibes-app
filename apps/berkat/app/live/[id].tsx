// Der Live-Auktions-Raum.
//
// Aufbau wie bei Whatnot: das Video füllt den Bildschirm, alles andere schwebt
// darüber, zwei Verläufe halten Kopf und Fuß lesbar. Die Maße sind bewusst
// klein gehalten — je weniger Fläche die Bedienung frisst, desto mehr Produkt
// sieht man.
//
// Das Video selbst wird hier NICHT verbunden: die Verbindung hängt im
// Wurzel-Layout (components/LiveStage) und überlebt deshalb das Verkleinern.
// Hier wird nur ihr Bild gezeigt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  ChevronRight,
  Heart,
  Lock,
  MessageSquare,
  Package,
  Share2,
  ShoppingBag,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { sendLiveComment, useLiveChat } from '../../lib/useLiveChat';
import { studioErrorText, useStudioActions } from '../../lib/useStudio';
import { useFollow } from '../../lib/useFollow';
import {
  giveawayErrorText,
  useGiveawayActions,
  useLiveGiveaway,
  useMyGiveawayEntry,
} from '../../lib/useGiveaway';
import { useLivePlayer } from '../../lib/livePlayer';
import { showLink } from '../../lib/links';
import { useLiveReactions } from '../../lib/useReactions';
import { liveKitAvailable, liveKitFailure } from '../../lib/livekit';
import { liveAccessErrorText, toLiveAccessError, useLiveAccess } from '../../lib/useLiveVideo';
import { stage, radius, space } from '../../theme/tokens';
import {
  bidErrorText,
  formatCartWindow,
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
import { Avatar } from '../../components/Avatar';
import { FloatingHearts, TapHearts } from '../../components/FloatingHearts';
import { GiveawayCard } from '../../components/GiveawayCard';
import { MaxBidSheet } from '../../components/MaxBidSheet';
import { ShowItemsSheet } from '../../components/ShowItemsSheet';

const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

type StageModule = {
  useStageReady: () => boolean;
  StageVideo: (props: { hostIdentity: string; style: ViewStyle }) => React.ReactNode;
  HostControls: () => React.ReactNode;
  GoLiveGate: (props: { onGoLive: () => void }) => React.ReactNode;
};

// Bedingt geladen: in Expo Go fehlen die nativen LiveKit-Module, und schon das
// Laden der Datei würde die App killen. `liveKitAvailable` ist eine
// Modul-Konstante — der Hook-Aufruf unten bleibt damit über die Laufzeit stabil.
const Stage = liveKitAvailable ? (require('../../components/LiveStage') as StageModule) : null;
const useStageReady = Stage?.useStageReady ?? (() => false);
const StageVideo = Stage?.StageVideo ?? null;
const HostControls = Stage?.HostControls ?? null;
const GoLiveGate = Stage?.GoLiveGate ?? null;

type LiveSession = {
  id: string;
  host_id: string;
  title: string | null;
  viewer_count: number | null;
  like_count: number | null;
  thumbnail_url: string | null;
  women_only: boolean;
  status: string;
  room_name: string | null;
};

/** 1240 Herzen sind „1,2k" — die genaue Zahl interessiert ab hier niemanden. */
function formatCount(value: number): string {
  if (value < 1000) return String(value);
  return `${(value / 1000).toFixed(1).replace('.', ',').replace(',0', '')}k`;
}

function useLiveSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'session', sessionId],
    enabled: Boolean(sessionId),
    refetchInterval: 15_000,
    queryFn: async (): Promise<LiveSession | null> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select(
          'id, host_id, title, viewer_count, like_count, thumbnail_url, women_only, status, room_name',
        )
        .eq('id', sessionId!)
        .maybeSingle();
      if (error) throw error;
      return (data as LiveSession | null) ?? null;
    },
  });
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { serverNow } = useServerClock();
  const { data: session, isLoading } = useLiveSession(id);
  const { auctions, active, upcoming } = useLiveAuctions(id);
  const secondsLeft = useCountdown(active?.ends_at ?? null, serverNow);
  useSettleOnZero(active, secondsLeft);

  const { data: soldCount } = useSellerSoldCount(session?.host_id);
  const { data: cart } = useCart(myUserId, session?.host_id);
  const comments = useLiveChat(id);
  const placeBid = usePlaceBid();
  const follow = useFollow(session?.host_id, myUserId);
  const { startAuction } = useStudioActions(id);
  const hearts = useLiveReactions(id, myUserId, session?.like_count ?? 0);

  const isHost = Boolean(myUserId && session?.host_id === myUserId);
  const connected = useLivePlayer((s) => s.connected);
  const stageReady = useStageReady();
  const access = useLiveAccess(
    session?.room_name,
    isHost,
    Boolean(Stage) && session?.status === 'active' && connected,
  );

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [duration, setDuration] = useState(30);
  const [startBusy, setStartBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [chatHidden, setChatHidden] = useState(false);
  const [maxOpen, setMaxOpen] = useState(false);

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
      setNotice(giveawayErrorText(error instanceof Error ? error.message : String(error)));
    }
  }, []);

  const submitMaxBid = useCallback(
    async (maxCents: number) => {
      if (!active) return;
      setBusy(true);
      const outcome = await setMaxBid(active.id, maxCents);
      setBusy(false);
      setMaxOpen(false);
      if (!outcome.ok) setNotice(bidErrorText(outcome.reason));
    },
    [active, setMaxBid],
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
    if (!id || !myUserId || isHost) return;
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
  }, [id, myUserId, isHost]);

  // ── Chat nach links wegwischen ────────────────────────────────────────────
  // Damit man das Produkt in Ruhe sehen kann. Der Zug wird erst beansprucht,
  // wenn er deutlich waagerecht ist — sonst würde jedes Antippen des
  // Eingabefelds als Wisch gelten.
  const chatX = useRef(new Animated.Value(0)).current;
  const slideChat = useCallback(
    (hidden: boolean) => {
      setChatHidden(hidden);
      Animated.spring(chatX, {
        toValue: hidden ? -400 : 0,
        useNativeDriver: true,
        friction: 9,
        tension: 70,
      }).start();
    },
    [chatX],
  );

  const chatPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        gesture.dx < -14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_event, gesture) => {
        if (gesture.dx < 0) chatX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx < -70) {
          setChatHidden(true);
          Animated.spring(chatX, {
            toValue: -400,
            useNativeDriver: true,
            friction: 9,
            tension: 70,
          }).start();
        } else {
          Animated.spring(chatX, { toValue: 0, useNativeDriver: true, friction: 9 }).start();
        }
      },
    }),
  ).current;

  // Dieser Bildschirm IST die große Ansicht. Wer hier ankommt, hat die Show
  // nicht mehr klein — egal ob er über das kleine Fenster kam (das räumt selbst
  // auf) oder über eine Karte auf der Startseite (die tut es nicht). Ohne das
  // lief dieselbe Show doppelt: großes Bild und kleines Fenster gleichzeitig.
  //
  // Bewusst nur beim Aufbauen und NICHT in `open()`: Das Verkleinern setzt die
  // Marke und geht zurück, und solange der Bildschirm noch abgebaut wird, könnte
  // ein Datenabruf `open()` erneut auslösen und das kleine Fenster gleich wieder
  // wegräumen.
  useEffect(() => {
    useLivePlayer.getState().restore();
  }, []);

  // Show im Player anmelden, damit sie das Verkleinern überlebt.
  useEffect(() => {
    if (!session) return;
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
    useLivePlayer.getState().minimize();
    router.back();
  }, [router]);

  const shareShow = useCallback(() => {
    if (!id) return;
    void Share.share({ message: `Schau dir das an: ${showLink(id)}` });
  }, [id]);

  const startItem = useCallback(
    async (auctionId: string) => {
      setStartBusy(true);
      try {
        await startAuction(auctionId, duration);
        setItemsOpen(false);
        setNotice(null);
      } catch (error) {
        setNotice(studioErrorText(error instanceof Error ? error.message : String(error)));
      } finally {
        setStartBusy(false);
      }
    },
    [startAuction, duration],
  );

  const chatUserIds = useMemo(() => comments.slice(-5).map((c) => c.user_id), [comments]);
  const profiles = useProfiles([
    session?.host_id,
    active?.current_bidder_id,
    giveaway?.winner_id,
    ...chatUserIds,
  ]);

  const onBid = useCallback(
    async (amountCents: number) => {
      if (!active) return;
      if (!myUserId) {
        router.push('/login');
        return;
      }
      setBusy(true);
      const outcome = await placeBid(active.id, amountCents);
      setBusy(false);
      if (!outcome.ok) {
        setNotice(bidErrorText(outcome.reason));
        return;
      }
      setNotice(outcome.extended ? 'Verlängert — jemand hat kurz vor Schluss geboten' : null);
    },
    [active, myUserId, placeBid, router],
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


  const sendChat = useCallback(async () => {
    if (!id || !draft.trim()) return;
    if (!myUserId) {
      router.push('/login');
      return;
    }
    const text = draft;
    setDraft('');
    const ok = await sendLiveComment(id, myUserId, text);
    if (!ok) {
      setDraft(text);
      setNotice('Die Nachricht kam nicht durch. Versuch es noch einmal.');
    }
  }, [id, draft, myUserId, router]);

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={stage.gold} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.screen, styles.center, { padding: space.xl }]}>
        <Text style={styles.emptyTitle}>Diese Show gibt es nicht mehr</Text>
        <Text style={styles.emptyBody}>
          Vielleicht ist sie zu Ende — schau, wer gerade sonst live ist.
        </Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

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
          sendHeart(event.nativeEvent.pageX, event.nativeEvent.pageY)
        }
      />

      <LinearGradient
        colors={['rgba(11,21,18,0.8)', 'rgba(11,21,18,0)']}
        style={[styles.topScrim, { height: insets.top + 84 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(11,21,18,0)', 'rgba(11,21,18,0.7)', 'rgba(11,21,18,0.96)']}
        locations={[0, 0.45, 1]}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      {/* `box-none` von hier abwärts durch alle reinen Anordnungs-Ebenen:
          Kopfzeile, Mitte und die Spalte selbst sollen keine Berührung
          schlucken, die nicht auf einem ihrer Knöpfe landet. Sonst wäre der
          größte Teil des Bildes tot. */}
      <KeyboardAvoidingView
        style={[styles.column, { paddingTop: insets.top + space.xs }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <View style={styles.header} pointerEvents="box-none">
          <Avatar uri={host?.avatarUrl} name={host?.username} size={32} ring />
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={styles.hostName}>
              {host?.username ?? '…'}
            </Text>
            <View style={styles.trustRow}>
              <Package size={10} color={stage.textMuted} />
              <Text style={styles.trustText}>
                {soldCount != null ? `${soldCount} Zuschläge` : 'Neu hier'}
              </Text>
            </View>
          </View>

          {follow.canFollow ? (
            <Pressable
              onPress={() => follow.toggle()}
              disabled={follow.busy}
              style={[styles.followPill, follow.isFollowing && styles.followPillActive]}
              accessibilityRole="button"
            >
              <Text style={[styles.followText, follow.isFollowing && styles.followTextActive]}>
                {follow.isFollowing ? 'Folgt' : 'Folgen'}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.viewerPill}>
            <View style={styles.liveDot} />
            <Text style={styles.viewerText}>{session.viewer_count ?? 0}</Text>
          </View>

          <Pressable
            onPress={minimize}
            hitSlop={8}
            style={styles.closeButton}
            accessibilityLabel="Show verkleinern"
          >
            <ChevronDown size={18} color={stage.text} />
          </Pressable>
        </View>

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

        <View style={styles.middle} pointerEvents="box-none">
          <Animated.View
            style={[styles.chatColumn, { transform: [{ translateX: chatX }] }]}
            {...chatPan.panHandlers}
          >
            {notice ? (
              <Pressable style={styles.notice} onPress={() => setNotice(null)}>
                <Text style={styles.noticeText}>{notice}</Text>
              </Pressable>
            ) : access.error ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  {liveAccessErrorText(toLiveAccessError(access.error))}
                </Text>
              </View>
            ) : !Stage ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>
                  Video-Modul nicht geladen — läuft die App aus Expo Go statt aus dem Dev-Build?
                  {liveKitFailure ? `\n\nGrund: ${liveKitFailure}` : ''}
                </Text>
              </View>
            ) : null}

            {/* Eigene Fläche NUR um die Kommentare. Die Spalte darüber bleibt
                unangetastet, weil ein Erkenner, der einen Tipp beansprucht,
                bevor das Eingabefeld darunter ihn bekommt, ihm den Fokus
                nimmt — dann ginge die Tastatur nicht mehr auf. So bleibt auch
                der Kommentar-Stapel tippbar, und genau dort liegt beim
                Zuschauen der Daumen.
                Wischt jemand stattdessen, übernimmt der Wisch-Erkenner der
                Spalte die Berührung und das Loslassen fällt hier aus. */}
            <View
              style={styles.chatTapArea}
              onStartShouldSetResponder={() => true}
              onResponderRelease={(event) =>
                sendHeart(event.nativeEvent.pageX, event.nativeEvent.pageY)
              }
            >
              {comments.slice(-5).map((comment) => {
                const author = profiles[comment.user_id];
                return (
                  <View key={comment.id} style={styles.chatLine}>
                    <Avatar uri={author?.avatarUrl} name={author?.username} size={22} />
                    <View style={styles.chatBubble}>
                      <Text style={styles.chatName}>{author?.username ?? '…'}</Text>
                      <Text numberOfLines={2} style={styles.chatText}>
                        {comment.text}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.chatInputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Schreibe etwas …"
                placeholderTextColor={stage.textMuted}
                style={styles.chatInput}
                returnKeyType="send"
                onSubmitEditing={() => void sendChat()}
                maxLength={300}
              />
            </View>
          </Animated.View>

          {/* Holt den weggewischten Chat zurück. */}
          {chatHidden ? (
            <Pressable
              onPress={() => slideChat(false)}
              style={styles.chatHandle}
              accessibilityRole="button"
              accessibilityLabel="Kommentare einblenden"
            >
              <MessageSquare size={15} color={stage.text} />
              <ChevronRight size={13} color={stage.textMuted} />
            </Pressable>
          ) : null}

          <View style={styles.rail}>
            <Pressable
              style={styles.railItem}
              // Ohne Klammer bekäme `sendHeart` das Berührungs-Ereignis als
              // ersten Wert übergeben und hielte es für eine X-Koordinate.
              onPress={() => sendHeart()}
              accessibilityRole="button"
              accessibilityLabel="Herz senden"
            >
              <View style={styles.railButton}>
                <Heart size={17} color={stage.live} fill={stage.live} />
              </View>
              <Text style={styles.railLabel}>{formatCount(hearts.likes)}</Text>
            </Pressable>
            <Pressable style={styles.railItem} onPress={shareShow} accessibilityRole="button">
              <View style={styles.railButton}>
                <Share2 size={17} color={stage.text} />
              </View>
              <Text style={styles.railLabel}>Teilen</Text>
            </Pressable>
            <Pressable
              style={styles.railItem}
              onPress={() => setItemsOpen(true)}
              accessibilityRole="button"
            >
              <View style={styles.railButton}>
                <ShoppingBag size={17} color={stage.text} />
                {auctions.length > 0 ? (
                  <View style={styles.railBadge}>
                    <Text style={styles.railBadgeText}>{auctions.length}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.railLabel}>Shop</Text>
            </Pressable>
          </View>

          {/* Nach der Leiste, damit die Herzen davor fliegen und nicht dahinter.
              Berührungen lässt die Ebene durch, die Knöpfe bleiben bedienbar. */}
          <FloatingHearts reactions={hearts.reactions} />
        </View>

        <View style={{ paddingBottom: insets.bottom || space.xs }}>
          <AuctionPanel
            auction={active}
            upcoming={upcoming}
            secondsLeft={secondsLeft}
            myUserId={myUserId}
            leader={leader}
            busy={busy}
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
            startBusy={startBusy}
            onMaxBid={!isHost && active ? () => setMaxOpen(true) : undefined}
            myMaxCents={myMax ?? null}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Über allem, weil der Punkt in Bildschirmkoordinaten kommt und sonst
          an der Innenkante der Spalte hängen bliebe. */}
      <TapHearts reactions={hearts.reactions} />

      {/* Außerhalb der Spalte, damit die absolute Position sich am Bildschirm
          orientiert und nicht am Innenabstand der Spalte.
          `stageReady` ist Pflicht, nicht Kosmetik: die Hooks darin brauchen den
          LiveKit-Raum-Kontext, und den gibt es erst nach dem Verbinden. Ohne
          diese Bedingung wirft die Komponente, sobald der Gastgeber den Raum
          vor dem „Live gehen" öffnet. */}
      {isHost && HostControls && stageReady ? <HostControls /> : null}

      <ShowItemsSheet
        visible={itemsOpen}
        auctions={auctions}
        onClose={() => setItemsOpen(false)}
        isHost={isHost}
        duration={duration}
        onDuration={setDuration}
        onStart={(auctionId) => void startItem(auctionId)}
        blocked={Boolean(active) || startBusy}
        onCreateGiveaway={
          isHost ? (title) => void runGiveaway(() => createGiveaway(title)) : undefined
        }
        giveawayOpen={giveaway?.status === 'open'}
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

      {/* Ganz zuletzt, damit die Vorschau alles überdeckt: Wer die Kamera noch
          ausrichtet, soll nicht schon die Auktion bedienen können. */}
      {GoLiveGate && isHost && !connected ? (
        <GoLiveGate onGoLive={() => useLivePlayer.getState().goLive()} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stage.ink },
  center: { alignItems: 'center', justifyContent: 'center' },
  column: { flex: 1 },
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0 },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 340 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: space.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  hostName: { fontSize: 14, fontWeight: '700', color: stage.text },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trustText: { fontSize: 11, color: stage.textMuted },

  followPill: {
    backgroundColor: stage.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  followPillActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: stage.lineStrong,
  },
  followText: { fontSize: 12, fontWeight: '700', color: stage.goldInk },
  followTextActive: { color: stage.textMuted },

  viewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: stage.live,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: stage.liveInk },
  viewerText: { fontSize: 12, fontWeight: '700', color: stage.liveInk },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  middle: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  chatColumn: { flex: 1, paddingLeft: space.md, paddingBottom: space.xs, gap: 4 },
  // Trägt den Abstand der Spalte weiter: Durch die Klammer sind die Kommentare
  // ein Kind statt fünf, und der `gap` der Spalte greift zwischen ihnen nicht mehr.
  chatTapArea: { gap: 4 },
  chatLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, maxWidth: '94%' },
  chatBubble: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chatName: { fontSize: 11, color: stage.textMuted },
  chatText: { fontSize: 13, fontWeight: '600', color: stage.text },
  chatInputRow: { marginTop: 2, marginRight: space.sm },
  chatInput: {
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: stage.lineStrong,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: space.md,
    fontSize: 13,
    color: stage.text,
  },
  chatHandle: {
    position: 'absolute',
    left: 0,
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
    paddingLeft: 9,
    paddingRight: 6,
    paddingVertical: 7,
  },

  rail: { paddingRight: space.sm, paddingBottom: space.md, gap: space.md },
  railItem: { alignItems: 'center', gap: 1 },
  railButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  railLabel: { fontSize: 10, color: stage.text, fontWeight: '600' },
  railBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: stage.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railBadgeText: { fontSize: 10, fontWeight: '700', color: stage.goldInk },

  notice: {
    backgroundColor: stage.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: stage.line,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    marginRight: space.md,
    marginBottom: 2,
  },
  noticeText: { fontSize: 12, color: stage.text },

  emptyTitle: { fontSize: 17, fontWeight: '700', color: stage.text },
  emptyBody: {
    fontSize: 14,
    color: stage.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
  },
  backButton: {
    marginTop: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: stage.lineStrong,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  backButtonText: { fontSize: 15, fontWeight: '700', color: stage.text },
});
