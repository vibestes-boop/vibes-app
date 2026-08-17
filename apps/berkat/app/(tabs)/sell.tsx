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
import {
  Check,
  ChevronRight,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  Radio,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react-native';
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
import { useOpenOrderCount } from '../../lib/useSellerOrders';
import {
  linkShowToPlan,
  matchingPlan,
  scheduleErrorText,
  useMyPlannedShows,
  usePlanShow,
} from '../../lib/useSchedule';
import { BerkatMark } from '../../components/BerkatMark';
import { SchedulePlanner } from '../../components/SchedulePlanner';
import { CategoryPicker } from '../../components/CategoryPicker';
import { SellerStart, useProfileFilled, type StartStep } from '../../components/SellerStart';
import { useSellerShows } from '../../lib/useSellerShows';
// Nur noch zum Zählen — bearbeitet wird das Regal auf `/shelf`.
import { useSellerListings } from '../../lib/useListings';
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
  const [showCategory, setShowCategory] = useState<string | null>(null);
  const [showCategoryParent, setShowCategoryParent] = useState<string | null>(null);
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

  // Regal und Bestellungen werden hier nur noch GEZÄHLT — bearbeitet werden sie
  // auf `/shelf` und `/orders`. Die Listen selbst zu laden hieße, fünfzig
  // Bestellungen samt Lieferadressen im Speicher zu halten, um zwei Zahlen
  // anzuzeigen.
  const { data: standing = [] } = useSellerListings(myUserId ?? undefined);
  const { data: openOrders = 0 } = useOpenOrderCount(myUserId);

  // ── Die ersten Schritte ───────────────────────────────────────────────────
  // Alle vier Zustände kommen aus Daten, die es ohnehin gibt — keine Tabelle,
  // kein Fortschritts-Feld, nichts zum Zurücksetzen. Damit kann die Liste auch
  // nicht mit der Wirklichkeit auseinanderlaufen.
  const { data: profileFilled = false } = useProfileFilled(myUserId);
  const { past: pastShows } = useSellerShows(myUserId ?? undefined);

  const startSteps = useMemo(
    (): StartStep[] => [
      {
        key: 'profil',
        label: 'Profil ausfüllen',
        hint: 'Ein Foto und ein Satz. Wer dich noch nicht kennt, liest das zuerst.',
        done: profileFilled,
        target: myUserId ? `/seller/${myUserId}` : undefined,
      },
      {
        key: 'termin',
        label: 'Ersten Termin ankündigen',
        // Kein Ziel: Der Planer steht auf diesem Bildschirm gleich darunter.
        hint: 'Gleich hier unten. Deine Follower bekommen 15 Minuten vorher eine Erinnerung.',
        done: plannedShows.length > 0,
      },
      {
        key: 'regal',
        label: 'Etwas ins Regal legen',
        hint: 'Damit man bei dir auch dann etwas kaufen kann, wenn du nicht sendest.',
        done: standing.length > 0,
        target: '/shelf',
      },
      {
        key: 'show',
        label: 'Erste Show machen',
        hint: 'Wenn die drei darüber stehen, lohnt sie sich am meisten.',
        done: (pastShows.data?.length ?? 0) > 0,
      },
    ],
    [profileFilled, plannedShows.length, standing.length, pastShows.data, myUserId],
  );

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [articleUrl, setArticleUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<ImageKind | null>(null);

  /** Bild wählen und hochladen. Abbrechen ist kein Fehler, nur ein Nein. */
  const chooseImage = async (kind: ImageKind, apply: (url: string) => void) => {
    setUploading(kind);
    try {
      // Beide Sorten von hier werden quadratisch gezeichnet: das Show-Cover auf
      // der Startseite und im Kategorien-Reiter, der Artikel in der
      // Warteschlange und im Regal.
      const url = await pickAndUpload(kind, 'square');
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
          {/* Steht GANZ OBEN und nur, solange etwas fehlt. Wer mühsam als
              Verkäufer geworben wurde, sah hier bisher ein Formular und sonst
              nichts — kein Hinweis, was zuerst dran ist. Bei fünf Leuten, die
              man einzeln geholt hat, entscheidet das, ob sie ein zweites Mal
              senden. */}
          <SellerStart
            steps={startSteps}
            onOpen={(target) => router.push(target as never)}
          />

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

            {/* Kategorie der Show. Freiwillig, aber sie entscheidet, ob die
                Sendung im Kategorien-Reiter überhaupt auftaucht — und dort
                sucht, wer den Verkäufer noch nicht kennt. */}
            <CategoryPicker
              value={showCategory}
              onChange={setShowCategory}
              openParent={showCategoryParent}
              onOpenParent={setShowCategoryParent}
            />

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
                    category: showCategory,
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
                  setShowCategory(null);
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
                    {/* Dasselbe Vorschaubild wie in der Warteschlange darüber —
                        ohne es sah eine verkaufte Zeile aus wie ein anderer
                        Artikeltyp. */}
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

        {/* ── Die beiden ruhigen Jobs, je eine Zeile ──────────────────────
            Bis zum 16.08.2026 lagen Regal, Bestellungen und Trinkgeld hier als
            volle Abschnitte untereinander — 977 Zeilen für vier verschiedene
            Aufgaben auf einem Scroll. Sie stehen jetzt UNTER der eigentlichen
            Arbeit und führen auf eigene Bildschirme.

            Warum keine Tabs innerhalb dieses Reiters: Unten liegen schon fünf,
            und die vier Jobs sind keine Geschwister — sobald gesendet wird,
            gibt es nur noch einen. Vor allem aber kann ein Push auf einen
            BILDSCHIRM springen, nicht auf einen Tab-Zustand darin; „Bezahlt —
            bitte packen" landet jetzt direkt bei den Bestellungen. */}
        <View style={styles.jobs}>
          <Pressable
            style={({ pressed }) => [styles.jobRow, pressed && styles.jobRowPressed]}
            onPress={() => router.push('/orders')}
            accessibilityRole="button"
            accessibilityLabel={
              openOrders > 0 ? `Bestellungen, ${openOrders} zu packen` : 'Bestellungen'
            }
          >
            <Package size={19} color={ui.text} />
            <Text style={styles.jobLabel}>Bestellungen</Text>
            {openOrders > 0 ? (
              <View style={styles.jobBadge}>
                <Text style={styles.jobBadgeText}>{openOrders} zu packen</Text>
              </View>
            ) : null}
            <ChevronRight size={18} color={ui.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.jobRow,
              styles.jobRowSplit,
              pressed && styles.jobRowPressed,
            ]}
            onPress={() => router.push('/shelf')}
            accessibilityRole="button"
            accessibilityLabel="Dein Regal"
          >
            <ShoppingBag size={19} color={ui.text} />
            <Text style={styles.jobLabel}>Dein Regal</Text>
            {standing.length > 0 ? (
              <Text style={styles.jobMeta}>{standing.length} kaufbar</Text>
            ) : (
              <Text style={styles.jobMeta}>leer</Text>
            )}
            <ChevronRight size={18} color={ui.textMuted} />
          </Pressable>
        </View>
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

  jobs: {
    marginTop: space.xl,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    overflow: 'hidden',
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 15,
  },
  jobRowSplit: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.line },
  jobRowPressed: { opacity: 0.6 },
  jobLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: ui.text },
  jobMeta: { fontSize: 12, color: ui.textMuted },
  // Gold, nicht Grau: Diese Zahl hat eine Frist, und die Versandzeit steht als
  // Kachel auf dem öffentlichen Profil.
  jobBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
  },
  jobBadgeText: { fontSize: 11, fontWeight: '800', color: ui.goldInk },

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
