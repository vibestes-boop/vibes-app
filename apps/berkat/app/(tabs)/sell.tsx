// Verkaufen — die Werkbank des Gastgebers.
//
// Bewusst kein Dashboard: eine Spalte, von oben nach unten in der Reihenfolge,
// in der man sie während einer laufenden Show braucht. Wer live ist, hat eine
// Hand frei und keine Zeit zu suchen.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Gift, ImagePlus, Pencil, Plus, Radio, Trash2, X } from 'lucide-react-native';
import { useSession } from '../../lib/session';
import { useLivePlayer } from '../../lib/livePlayer';
import { pickAndUpload, type ImageKind } from '../../lib/uploadImage';
import {
  formatCountdown,
  formatEuro,
  useCountdown,
  useLiveAuctions,
  useServerClock,
  useSettleOnZero,
  useUsernames,
  type Auction,
} from '../../lib/useAuction';
import {
  centsToEuroInput,
  euroToCents,
  studioErrorText,
  useCreateShow,
  useEndShow,
  useMyActiveShow,
  useSetShowCover,
  useStudioActions,
} from '../../lib/useStudio';
import { orderErrorText, useMarkShipped, useSellerOrders } from '../../lib/useSellerOrders';
import { useReceivedTips } from '../../lib/useTip';
import {
  linkShowToPlan,
  matchingPlan,
  scheduleErrorText,
  useMyPlannedShows,
  usePlanShow,
} from '../../lib/useSchedule';
import { BerkatMark } from '../../components/BerkatMark';
import { SchedulePlanner } from '../../components/SchedulePlanner';
import { SellerOrders } from '../../components/SellerOrders';
import { StandingComposer } from '../../components/StandingComposer';
import { StandingShelf } from '../../components/StandingShelf';
import {
  standingErrorText,
  useStandingActions,
  useStandingListings,
} from '../../lib/useStanding';
import { ui, radius, space } from '../../theme/tokens';

const DURATIONS = [20, 30, 60];

export default function SellScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myUserId = useSession((s) => s.userId);
  // Frauen-Only darf nur setzen, wer freigegeben ist — der Server prüft es
  // ein zweites Mal, das hier blendet den Schalter nur aus.
  const myProfile = useSession((s) => s.profile);

  const { serverNow } = useServerClock();
  const { data: show, isLoading } = useMyActiveShow(myUserId);
  const createShow = useCreateShow(myUserId);
  const endShow = useEndShow(myUserId);
  const setCover = useSetShowCover(myUserId);

  const { auctions, active, upcoming } = useLiveAuctions(show?.id);
  const { startAuction, cancelAuction, createAuction, updateAuction } = useStudioActions(show?.id);
  const secondsLeft = useCountdown(active?.ends_at ?? null, serverNow);
  // Der Gastgeber schaut garantiert zu — er ist der verlässlichste Auslöser für
  // den Zuschlag. Ohne das bleibt ein Artikel bis zum Cron-Lauf hängen.
  useSettleOnZero(active, secondsLeft);

  const sold = useMemo(() => auctions.filter((a) => a.status === 'sold'), [auctions]);
  const winnerNames = useUsernames(sold.map((a) => a.winner_id));

  const [showTitle, setShowTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [startPrice, setStartPrice] = useState('1');
  const [increment, setIncrement] = useState('1');
  const [buyNow, setBuyNow] = useState('');

  // Gesetzt, während dasselbe Formular einen bestehenden Artikel ändert statt
  // einen neuen anzulegen. Ein zweites Formular wäre dieselbe Maske doppelt.
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);

  const { data: plannedShows = [] } = useMyPlannedShows(myUserId);
  const { plan: planShow, cancel: cancelPlan } = usePlanShow(myUserId);

  const { data: standing = [] } = useStandingListings(myUserId ?? undefined);
  const standingActions = useStandingActions(myUserId ?? undefined, myUserId);
  const [standingBusyId, setStandingBusyId] = useState<string | null>(null);

  const { data: orders = [] } = useSellerOrders(myUserId);
  const { data: tips = [] } = useReceivedTips(myUserId);
  const tipperNames = useUsernames(tips.map((t) => t.sender_id));
  const markShipped = useMarkShipped(myUserId);
  const [shippingId, setShippingId] = useState<string | null>(null);

  const shipOrder = async (orderId: string, carrier: string, tracking: string) => {
    setShippingId(orderId);
    try {
      setNotice(null);
      await markShipped(orderId, carrier, tracking);
    } catch (error) {
      setNotice(orderErrorText(error instanceof Error ? error.message : String(error)));
    } finally {
      setShippingId(null);
    }
  };

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [articleUrl, setArticleUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<ImageKind | null>(null);

  /** Bild wählen und hochladen. Abbrechen ist kein Fehler, nur ein Nein. */
  const chooseImage = async (kind: ImageKind, apply: (url: string) => void) => {
    setUploading(kind);
    try {
      const url = await pickAndUpload(kind);
      if (url) apply(url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Das Bild kam nicht durch.');
    } finally {
      setUploading(null);
    }
  };

  const run = async (action: () => Promise<unknown>) => {
    try {
      setNotice(null);
      await action();
    } catch (error) {
      setNotice(studioErrorText(error instanceof Error ? error.message : String(error)));
    }
  };

  /**
   * Zurück auf „neuer Artikel". Start und Schritt bleiben absichtlich stehen —
   * wer zehn Schals ab 1 € auflegt, will sie nicht zehnmal neu eintippen.
   */
  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBuyNow('');
    setArticleUrl(null);
  };

  const beginEdit = (item: Auction) => {
    setEditingId(item.id);
    setTitle(item.title);
    setStartPrice(centsToEuroInput(item.start_price_cents));
    setIncrement(centsToEuroInput(item.min_increment_cents));
    setBuyNow(item.buy_now_cents ? centsToEuroInput(item.buy_now_cents) : '');
    setArticleUrl(item.image_url);
    setNotice(null);
    // Das Formular steht unter der Liste. Ohne den Sprung sähe der Griff zum
    // Stift aus, als wäre nichts passiert.
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ y: Math.max(0, formY.current - space.md), animated: true }),
    );
  };

  // Verlässt der Artikel die Warteschlange, während man ihn ändert — weil der
  // Gastgeber ihn aus dem Raum heraus gestartet hat —, hat das Formular kein
  // Ziel mehr. Der Server würde ablehnen; das hier verhindert, dass man erst
  // tippt und dann die Absage liest.
  //
  // Der Effekt hängt am Wahrheitswert, nicht an `upcoming`: die Liste ist ein
  // frisches Array pro Render, und der Vergleich liefe sonst jedes Mal mit.
  const editingStillQueued = editingId === null || upcoming.some((item) => item.id === editingId);
  useEffect(() => {
    if (!editingStillQueued) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingStillQueued]);

  const submitItem = () => {
    if (!show) return;
    const startCents = euroToCents(startPrice);
    const stepCents = euroToCents(increment);
    const buyNowCents = buyNow.trim() ? euroToCents(buyNow) : null;

    if (!title.trim()) return setNotice('Der Artikel braucht einen Namen.');
    if (!startCents || startCents <= 0) return setNotice('Startpreis prüfen.');
    if (!stepCents || stepCents <= 0) return setNotice('Mindestschritt prüfen.');
    if (buyNow.trim() && !buyNowCents) return setNotice('Sofortkaufpreis prüfen.');

    void run(async () => {
      if (editingId) {
        await updateAuction({
          auctionId: editingId,
          title: title.trim(),
          startPriceCents: startCents,
          minIncrementCents: stepCents,
          buyNowCents,
          imageUrl: articleUrl,
        });
      } else {
        await createAuction({
          sessionId: show.id,
          title: title.trim(),
          startPriceCents: startCents,
          minIncrementCents: stepCents,
          buyNowCents,
          imageUrl: articleUrl,
        });
      }
      resetForm();
    });
  };

  if (!myUserId) {
    return (
      <View style={[styles.screen, styles.center, { padding: space.xl }]}>
        <BerkatMark size={40} color={ui.brand} />
        <Text style={styles.gateTitle}>Erst anmelden</Text>
        <Text style={styles.gateBody}>
          Zum Verkaufen brauchst du ein Konto. Deins von Serlo gilt hier auch.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.primaryButtonText}>Anmelden</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={ui.brand} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.headerTitle}>Verkaufen</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        {!show ? (
          <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mach die Show auf</Text>
            <Text style={styles.cardBody}>
              Gib ihr einen Namen, den man im Feed erkennt — zum Beispiel „Parfüm ab 1 €".
            </Text>
            <TextInput
              value={showTitle}
              onChangeText={setShowTitle}
              placeholder="Parfüm ab 1 €"
              placeholderTextColor={ui.textMuted}
              style={styles.input}
            />

            {/* Das Cover ist das, was im Feed über deine Show entscheidet —
                deshalb steht es hier groß und nicht als Nebensache. */}
            <Pressable
              style={styles.coverPicker}
              onPress={() => void chooseImage('cover', setCoverUrl)}
              disabled={uploading !== null}
              accessibilityRole="button"
              accessibilityLabel="Cover auswählen"
            >
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : null}
              {uploading === 'cover' ? (
                <ActivityIndicator color={ui.brand} />
              ) : coverUrl ? (
                <View style={styles.coverChange}>
                  <Text style={styles.coverChangeText}>Cover ändern</Text>
                </View>
              ) : (
                <>
                  <ImagePlus size={22} color={ui.textMuted} />
                  <Text style={styles.coverHint}>Cover wählen</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.primaryButton, createShow.isPending && styles.buttonBusy]}
              disabled={createShow.isPending || uploading !== null}
              // Wer „Show starten" drückt, will senden — nicht auf einen zweiten
              // Knopf schauen. Im Raum wartet die Kamera-Vorschau, erst danach
              // geht wirklich etwas nach draußen.
              onPress={() =>
                void run(async () => {
                  const sessionId = await createShow.mutateAsync({
                    title: showTitle,
                    thumbnailUrl: coverUrl,
                  });
                  // Steht für jetzt ein angekündigter Termin an, gehört er mit
                  // dieser Show zusammen — sonst bliebe die Ankündigung auf
                  // „geplant" stehen, liefe irgendwann in `expired`, und wer sie
                  // auf der Startseite antippt, käme nirgendwo hin, obwohl die
                  // Show längst läuft. Bewusst ohne `await`-Abbruch: Die Show ist
                  // an dieser Stelle schon gestartet, und ein misslungenes
                  // Verknüpfen darf den Gastgeber nicht aus seiner eigenen
                  // Sendung werfen.
                  const due = matchingPlan(plannedShows, Date.now());
                  if (due) await linkShowToPlan(due.id, sessionId);

                  // Zurücksetzen, damit nach dem Beenden nicht der alte Name
                  // und das alte Cover in der leeren Maske stehen.
                  setShowTitle('');
                  setCoverUrl(null);
                  router.push(`/live/${sessionId}`);
                })
              }
            >
              <Radio size={17} color={ui.goldInk} />
              <Text style={styles.primaryButtonText}>Show starten</Text>
            </Pressable>
          </View>

          <SchedulePlanner
            plans={plannedShows}
            busy={planShow.isPending || cancelPlan.isPending}
            onPlan={(input) =>
              void planShow
                .mutateAsync(input)
                .then(({ created, total }) =>
                  setNotice(
                    created === total
                      ? created === 1
                        ? 'Eingetragen — deine Follower bekommen eine Erinnerung. 🎉'
                        : `${created} Termine eingetragen — deine Follower bekommen jedes Mal eine Erinnerung. 🎉`
                      : // Ehrlich statt hübsch: Wenn nur ein Teil durchkam, muss
                        // der Verkäufer das wissen, sonst verlässt er sich auf
                        // Termine, die es nicht gibt.
                        `${created} von ${total} Terminen eingetragen — der Rest hat nicht geklappt.`,
                  ),
                )
                .catch((error: unknown) =>
                  setNotice(
                    scheduleErrorText(error instanceof Error ? error.message : String(error)),
                  ),
                )
            }
            onCancel={(planId) =>
              void cancelPlan
                .mutateAsync(planId)
                .then(() => setNotice('Termin abgesagt.'))
                .catch(() => setNotice('Der Termin ließ sich nicht absagen.'))
            }
          />
          </>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.showRow}>
                <Pressable
                  style={styles.showCover}
                  onPress={() =>
                    void chooseImage('cover', (url) =>
                      run(() => setCover.mutateAsync({ sessionId: show.id, url })),
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Cover ändern"
                >
                  {show.thumbnail_url ? (
                    <Image
                      source={{ uri: show.thumbnail_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : null}
                  {uploading === 'cover' ? (
                    <ActivityIndicator color={ui.brand} />
                  ) : !show.thumbnail_url ? (
                    <ImagePlus size={18} color={ui.textMuted} />
                  ) : null}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{show.title ?? 'Berkat-Show'}</Text>
                  <Text style={styles.cardMeta}>{show.viewer_count ?? 0} schauen zu</Text>
                </View>
                <View style={styles.livePill}>
                  <Text style={styles.livePillText}>live</Text>
                </View>
              </View>
              <View style={styles.showActions}>
                <Pressable style={styles.ghostButton} onPress={() => router.push(`/live/${show.id}`)}>
                  <Text style={styles.ghostButtonText}>Zum Raum</Text>
                </Pressable>
                <Pressable
                  style={styles.dangerButton}
                  onPress={() =>
                    void run(async () => {
                      await endShow.mutateAsync(show.id);
                      // Sonst bliebe die beendete Show als kleines Fenster
                      // stehen und zeigte ein Video, das es nicht mehr gibt.
                      if (useLivePlayer.getState().session?.id === show.id) {
                        useLivePlayer.getState().close();
                      }
                    })
                  }
                >
                  <Text style={styles.dangerButtonText}>Show beenden</Text>
                </Pressable>
              </View>
            </View>

            {active ? (
              <View style={[styles.card, styles.cardRunning]}>
                <Text style={styles.sectionLabel}>Läuft gerade</Text>
                <Text style={styles.cardTitle}>{active.title}</Text>
                <Text style={styles.cardMeta}>
                  {active.current_bid_cents == null
                    ? `Noch kein Gebot · startet bei ${formatEuro(active.start_price_cents)}`
                    : `${formatEuro(active.current_bid_cents)} · ${active.bid_count} Gebote`}
                </Text>
                <Text style={styles.countdown}>{formatCountdown(secondsLeft)}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionLabel}>Aufgelegt ({upcoming.length})</Text>
            {upcoming.length === 0 ? (
              <Text style={styles.emptyLine}>
                Noch nichts aufgelegt. Trag unten den ersten Artikel ein.
              </Text>
            ) : (
              upcoming.map((item) => (
                <View
                  key={item.id}
                  style={[styles.itemRow, editingId === item.id && styles.itemRowEditing]}
                >
                  <View style={styles.itemThumb}>
                    {item.image_url ? (
                      <Image
                        source={{ uri: item.image_url }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.itemTitle}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemMeta}>
                      ab {formatEuro(item.start_price_cents)} · Schritt{' '}
                      {formatEuro(item.min_increment_cents)}
                      {item.buy_now_cents ? ` · sofort ${formatEuro(item.buy_now_cents)}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => beginEdit(item)}
                    hitSlop={8}
                    accessibilityLabel={`${item.title} ändern`}
                  >
                    <Pencil
                      size={17}
                      color={editingId === item.id ? ui.brand : ui.textMuted}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => void run(() => cancelAuction(item.id))}
                    hitSlop={8}
                    accessibilityLabel={`${item.title} entfernen`}
                  >
                    <Trash2 size={17} color={ui.textMuted} />
                  </Pressable>
                  <Pressable
                    style={[styles.startButton, Boolean(active) && styles.startButtonDisabled]}
                    disabled={Boolean(active)}
                    onPress={() => void run(() => startAuction(item.id, duration))}
                  >
                    <Text style={styles.startButtonText}>Starten</Text>
                  </Pressable>
                </View>
              ))
            )}

            <View style={styles.durationRow}>
              <Text style={styles.durationLabel}>Dauer</Text>
              {DURATIONS.map((seconds) => (
                <Pressable
                  key={seconds}
                  onPress={() => setDuration(seconds)}
                  style={[styles.durationChip, duration === seconds && styles.durationChipActive]}
                >
                  <Text
                    style={[
                      styles.durationChipText,
                      duration === seconds && styles.durationChipTextActive,
                    ]}
                  >
                    {seconds} s
                  </Text>
                </Pressable>
              ))}
            </View>

            {sold.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Verkauft ({sold.length})</Text>
                {sold.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={styles.itemTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemMeta}>
                        an {item.winner_id ? winnerNames[item.winner_id] ?? '…' : '—'}
                      </Text>
                    </View>
                    <Text style={styles.soldPrice}>{formatEuro(item.current_bid_cents)}</Text>
                  </View>
                ))}
              </>
            ) : null}

            <View
              style={[styles.card, { marginTop: space.lg }, editingId && styles.cardEditing]}
              onLayout={(event) => {
                formY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.cardTitle}>
                {editingId ? 'Artikel ändern' : 'Artikel auflegen'}
              </Text>
              <View style={styles.articleRow}>
                <Pressable
                  style={styles.articleThumb}
                  onPress={() => void chooseImage('article', setArticleUrl)}
                  disabled={uploading !== null}
                  accessibilityRole="button"
                  accessibilityLabel="Bild des Artikels wählen"
                >
                  {articleUrl ? (
                    <Image
                      source={{ uri: articleUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : null}
                  {uploading === 'article' ? (
                    <ActivityIndicator color={ui.brand} />
                  ) : !articleUrl ? (
                    <ImagePlus size={20} color={ui.textMuted} />
                  ) : null}

                  {/* Antippen wechselt das Bild, das Kreuz nimmt es ganz weg.
                      Ohne das ließ sich ein einmal gewähltes Bild nur noch
                      ersetzen — die RPC konnte es längst, es fehlte der Knopf. */}
                  {articleUrl && uploading === null ? (
                    <Pressable
                      onPress={() => setArticleUrl(null)}
                      hitSlop={10}
                      style={styles.thumbClear}
                      accessibilityRole="button"
                      accessibilityLabel="Bild entfernen"
                    >
                      <X size={13} color={ui.card} />
                    </Pressable>
                  ) : null}
                </Pressable>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Seidenschal, handbestickt"
                  placeholderTextColor={ui.textMuted}
                  style={[styles.input, { flex: 1 }]}
                  multiline
                />
              </View>
              <View style={styles.priceRow}>
                <View style={styles.priceField}>
                  <Text style={styles.fieldLabel}>Startpreis</Text>
                  <TextInput
                    value={startPrice}
                    onChangeText={setStartPrice}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={ui.textMuted}
                    style={styles.input}
                  />
                </View>
                <View style={styles.priceField}>
                  <Text style={styles.fieldLabel}>Schritt</Text>
                  <TextInput
                    value={increment}
                    onChangeText={setIncrement}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={ui.textMuted}
                    style={styles.input}
                  />
                </View>
                <View style={styles.priceField}>
                  <Text style={styles.fieldLabel}>Sofort</Text>
                  <TextInput
                    value={buyNow}
                    onChangeText={setBuyNow}
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={ui.textMuted}
                    style={styles.input}
                  />
                </View>
              </View>
              {editingId ? (
                <View style={styles.editActions}>
                  <Pressable style={styles.ghostButton} onPress={resetForm}>
                    <Text style={styles.ghostButtonText}>Abbrechen</Text>
                  </Pressable>
                  <Pressable style={[styles.primaryButton, { flex: 1 }]} onPress={submitItem}>
                    <Check size={17} color={ui.goldInk} />
                    <Text style={styles.primaryButtonText}>Speichern</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.primaryButton} onPress={submitItem}>
                  <Plus size={17} color={ui.goldInk} />
                  <Text style={styles.primaryButtonText}>Auflegen</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Außerhalb der Show-Bedingung: Bestellungen wollen bearbeitet werden,
            auch wenn gerade keine Show läuft — meistens sogar dann. */}
        {/* Unabhängig davon, ob gerade gesendet wird — das ist der Zweck. */}
        <StandingComposer
          busy={standingActions.create.isPending}
          canWomenOnly={Boolean(myProfile?.women_only_verified)}
          onCreate={(input) =>
            void standingActions.create
              .mutateAsync(input)
              .then(() => setNotice('Liegt im Regal — ab jetzt kaufbar. 🎉'))
              .catch((e: unknown) =>
                setNotice(standingErrorText(e instanceof Error ? e.message : String(e))),
              )
          }
        />

        <StandingShelf
          listings={standing}
          isOwner
          signedIn
          busyId={standingBusyId}
          onBuy={() => {}}
          onCancel={(item) => {
            setStandingBusyId(item.id);
            void standingActions.cancel
              .mutateAsync(item.id)
              .then(() => setNotice('Zurückgezogen.'))
              .catch((e: unknown) =>
                setNotice(standingErrorText(e instanceof Error ? e.message : String(e))),
              )
              .finally(() => setStandingBusyId(null));
          }}
        />

        <SellerOrders orders={orders} busyId={shippingId} onShip={shipOrder} />

        {/* Trinkgeld kommt ohne Bestellung an. Ohne diese Liste wüsste ein
            Verkäufer nie, dass ihm jemand etwas dagelassen hat — und ein Danke,
            das niemand sieht, ist keins. */}
        {tips.length > 0 ? (
          <View style={{ marginTop: space.lg }}>
            <Text style={styles.sectionLabel}>Trinkgeld</Text>
            {tips.map((tip) => (
              <View key={tip.id} style={styles.tipRow}>
                <Gift size={17} color={ui.gold} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tipFrom}>{tipperNames[tip.sender_id] ?? '…'}</Text>
                  {tip.message ? (
                    <Text numberOfLines={2} style={styles.tipMessage}>
                      „{tip.message}"
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.tipAmount}>{formatEuro(tip.amount_cents)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm },
  header: { paddingHorizontal: space.md, paddingBottom: space.sm },
  headerTitle: { fontSize: 26, fontWeight: '700', color: ui.text },

  gateTitle: { fontSize: 18, fontWeight: '700', color: ui.text, marginTop: space.sm },
  gateBody: {
    fontSize: 14,
    color: ui.textMuted,
    textAlign: 'center',
    marginBottom: space.md,
    lineHeight: 20,
  },

  card: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
    gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
  },
  cardRunning: { borderWidth: 1.5, borderColor: ui.gold },
  /** Zeigt, dass hier gerade korrigiert und nicht neu angelegt wird. */
  cardEditing: { borderWidth: 1.5, borderColor: ui.brand },
  editActions: { flexDirection: 'row', gap: space.sm },
  cardTitle: { fontSize: 17, fontWeight: '700', color: ui.text },
  cardBody: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },
  cardMeta: { fontSize: 12, color: ui.textMuted },
  countdown: { fontSize: 30, fontWeight: '700', color: ui.text },

  showRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  showCover: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPicker: {
    height: 140,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coverHint: { fontSize: 13, fontWeight: '600', color: ui.textMuted },
  coverChange: {
    position: 'absolute',
    bottom: space.sm,
    right: space.sm,
    backgroundColor: 'rgba(20,36,30,0.72)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  coverChangeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  articleRow: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
  articleThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    borderStyle: 'dashed',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbClear: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(20,36,30,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemThumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  showActions: { flexDirection: 'row', gap: space.sm },
  livePill: {
    backgroundColor: ui.live,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  livePillText: { fontSize: 11, fontWeight: '700', color: ui.liveInk },

  input: {
    backgroundColor: ui.bg,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.lineStrong,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    fontSize: 15,
    color: ui.text,
  },
  fieldLabel: { fontSize: 11, color: ui.textMuted, marginBottom: 4 },
  priceRow: { flexDirection: 'row', gap: space.sm },
  priceField: { flex: 1 },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ui.gold,
    borderRadius: radius.pill,
    height: 50,
    paddingHorizontal: space.xl,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: ui.goldInk },
  buttonBusy: { opacity: 0.6 },

  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    marginBottom: space.sm,
  },
  tipFrom: { fontSize: 14, fontWeight: '600', color: ui.text },
  tipMessage: { fontSize: 12, color: ui.textMuted, marginTop: 2, lineHeight: 17 },
  tipAmount: { fontSize: 16, fontWeight: '700', color: ui.gold },
  ghostButton: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: { fontSize: 14, fontWeight: '700', color: ui.text },
  dangerButton: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.live,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: { fontSize: 14, fontWeight: '700', color: ui.live },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ui.textMuted,
    marginBottom: space.sm,
    marginTop: space.xs,
  },
  emptyLine: { fontSize: 13, color: ui.textMuted, marginBottom: space.md },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  /** Der Artikel, der gerade im Formular unten liegt. */
  itemRowEditing: { backgroundColor: ui.sunken, borderRadius: radius.sm, paddingHorizontal: space.sm },
  itemTitle: { fontSize: 15, fontWeight: '600', color: ui.text },
  itemMeta: { fontSize: 12, color: ui.textMuted },
  soldPrice: { fontSize: 15, fontWeight: '700', color: ui.text },
  startButton: {
    backgroundColor: ui.gold,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 9,
  },
  startButtonDisabled: { opacity: 0.35 },
  startButtonText: { fontSize: 13, fontWeight: '700', color: ui.goldInk },

  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  durationLabel: { fontSize: 12, color: ui.textMuted, marginRight: space.xs },
  durationChip: {
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
  },
  durationChipActive: { backgroundColor: ui.brand },
  durationChipText: { fontSize: 13, fontWeight: '600', color: ui.text },
  durationChipTextActive: { color: ui.card },

  notice: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.live,
    padding: space.md,
    marginBottom: space.md,
  },
  noticeText: { fontSize: 13, color: ui.text },
});
