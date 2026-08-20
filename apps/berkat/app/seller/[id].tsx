// Die öffentliche Seite eines Verkäufers.
//
// Berkat hatte bis hierhin keine. Der Live-Raum zeigt einen Namen und eine
// Zahl — wer mehr wissen will, hatte keinen Ort dafür. Genau das ist beim
// ersten fremden Verkäufer der Unterschied zwischen „kauf ich" und „lieber
// nicht".
//
// Sie liegt auf der hellen Fläche (`ui`), nicht auf der Bühne: Man kommt zwar
// aus dem Live-Raum hierher, aber das hier ist Stöbern, kein Zuschauen.

import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Ban,
  CalendarClock,
  ChevronLeft,
  Coins,
  Flag,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Radio,
  Share2,
  Star,
  Tag,
  Truck,
} from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { useFollow, useFollowCounts } from '../../lib/useFollow';
import { formatEuro } from '../../lib/useAuction';
import { formatRating, formatShipTime, useSellerStats } from '../../lib/useSellerStats';
import { useBerkatSeller } from '../../lib/useBerkatSeller';
import { useVouchActions, useVouches, vouchErrorText } from '../../lib/useVouch';
import { profileEditErrorText, useUpdateProfile } from '../../lib/useProfileEdit';
import { pickAndUpload } from '../../lib/uploadImage';
import { REPORT_REASONS, useMyBlocks, useSellerActions } from '../../lib/useSellerActions';
import { reviewWhen, useSellerReviews, type SellerReview } from '../../lib/useSellerReviews';
import { showWhen, useSellerShows } from '../../lib/useSellerShows';
import { SITE_URL } from '../../lib/links';
import { goBack } from '../../lib/nav';
import { usePreparedByPlan } from '../../lib/usePrepared';
import { Avatar } from '../../components/Avatar';
import { LineupPreview } from '../../components/LineupPreview';
import { ProfileEditSheet } from '../../components/ProfileEditSheet';
import { RatingStars } from '../../components/RatingStars';
import { VouchPanel } from '../../components/VouchPanel';
import { StandingShelf } from '../../components/StandingShelf';
import { standingErrorText, useStandingActions } from '../../lib/useStanding';
import { useSellerListings } from '../../lib/useListings';
import { BerkatMark } from '../../components/BerkatMark';
import { radius, ratio, space, ui } from '../../theme/tokens';

type SellerProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
};

type SoldItem = {
  id: string;
  title: string;
  image_url: string | null;
  current_bid_cents: number | null;
  settled_at: string | null;
};

// Dieselbe Falle wie im Show-Raster der Startseite, nur bei drei Spalten statt
// zwei: Jede Zelle hat `flex: 1`, also zieht sich die letzte Reihe auf volle
// Breite, wenn sie nicht voll ist — bei einem einzigen Artikel füllt der das
// ganze Bild. Platzhalter besetzen die freien Spalten.
//
// `spacer: true` statt eines Vergleichs auf der id: TypeScript reduziert das
// Literal in der Vereinigung zu `string`, die id taugt dann nicht mehr zur
// Unterscheidung.
const SPACER_ID = '__spacer__';
type Spacer = { id: string; spacer: true };
type GridItem = SoldItem | Spacer;

/**
 * Die Reiter nach Whatnot-Vorbild.
 *
 * „Clips" fehlt bewusst: Whatnot hat einen vierten Reiter dafür, Berkat hat
 * weder Replay noch Clip-Marker (beides existiert in Serlo, wurde für Berkat
 * aber nie angeschlossen). Ein Reiter, der nur erklären kann, dass es ihn nicht
 * gibt, ist keiner.
 */
type ProfileTab = 'shop' | 'reviews' | 'shows';

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'shop', label: 'Shop' },
  { key: 'reviews', label: 'Bewertungen' },
  // Nicht „Live-Shows": Der Reiter zeigt ZUERST die angekündigten Termine und
  // erst darunter die gelaufenen Sendungen. „Live-Shows" las sich wie ein
  // Archiv — wer wissen wollte, wann der Verkäufer wiederkommt, tippte dort
  // zuletzt.
  { key: 'shows', label: 'Termine & Shows' },
];

/** Angekündigte und vergangene Sendungen in einer Liste. */
type ShowRow = {
  id: string;
  kind: 'announced' | 'past';
  sessionId: string | null;
  /**
   * Die `scheduled_lives`-ID — nur bei `announced`.
   *
   * Steht neben `id`, weil die dort ein Anzeige-Schlüssel ist (`a-…`/`p-…`,
   * damit Ankündigung und Sendung sich in EINER Liste nicht überschneiden). Für
   * die Zuordnung der vorbereiteten Artikel braucht es die echte ID.
   */
  planId: string | null;
  title: string | null;
  /**
   * Das Cover der gelaufenen Show.
   *
   * `useSellerShows` holte es von Anfang an mit — dieser Typ trug es nur nicht,
   * also landete es nie in der Liste. Eine vergangene Show stand damit als
   * grauer Kreis mit Funkturm-Symbol da, obwohl das Bild vorlag. Eine
   * ANGEKÜNDIGTE hat keines: `scheduled_lives` trägt kein Cover, das entsteht
   * erst beim Starten.
   */
  thumbnail: string | null;
  when: string;
  women_only: boolean;
};

/**
 * Was die eine Liste je nach Reiter trägt.
 *
 * Die Annotation ist Pflicht, nicht Kosmetik: Ohne sie leitet TypeScript aus
 * dem Ternär eine Vereinigung von ARRAYS ab (`A[] | B[] | C[]`), und FlatList
 * verlangt ein Array einer Vereinigung (`(A|B|C)[]`). Unterschieden werden die
 * drei danach über je ein Merkmal, das nur einer von ihnen hat: `kind` bei der
 * Show, `comment` bei der Bewertung, `spacer` beim Platzhalter.
 */
type TabItem = GridItem | SellerReview | ShowRow;

function padToGrid(items: SoldItem[], columns: number): GridItem[] {
  const rest = items.length % columns;
  if (items.length === 0 || rest === 0) return items;
  const fillers: Spacer[] = Array.from({ length: columns - rest }, (_, i) => ({
    id: `${SPACER_ID}-${i}`,
    spacer: true,
  }));
  return [...items, ...fillers];
}

function useSellerProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'seller-profile', id],
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SellerProfile | null> => {
      // ⚠️ `banner_url` ist erst seit Migration 20260816170000 für Clients
      // lesbar. `profiles` trägt seit dem 14.08. eine ausdrückliche
      // Spaltenliste statt eines Tabellen-SELECT — eine Spalte, die dort fehlt,
      // lässt die GANZE Abfrage mit 42501 scheitern, nicht nur sich selbst.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, banner_url, bio')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return (data as SellerProfile) ?? null;
    },
  });
}

/** Läuft dieser Verkäufer gerade? Dann ist der Weg zurück ins Live einen Knopf wert. */
function useSellerLiveShow(id: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'seller-live', id],
    enabled: Boolean(id),
    refetchInterval: 30_000,
    queryFn: async (): Promise<{ id: string; title: string | null } | null> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, title')
        .eq('host_id', id!)
        .eq('status', 'active')
        .eq('app', 'berkat')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as { id: string; title: string | null }) ?? null;
    },
  });
}

/** Was dieser Verkäufer zuletzt verkauft hat — die ehrlichste Auslage. */
function useSellerSoldItems(id: string | undefined) {
  return useQuery({
    queryKey: ['berkat', 'seller-items', id],
    enabled: Boolean(id),
    staleTime: 60_000,
    queryFn: async (): Promise<SoldItem[]> => {
      const { data, error } = await supabase
        .from('live_auctions')
        .select('id, title, image_url, current_bid_cents, settled_at')
        .eq('seller_id', id!)
        .eq('status', 'sold')
        .order('settled_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as SoldItem[];
    },
  });
}

export default function SellerScreen() {
  const { id, tab: wantedTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const isSelf = Boolean(myUserId && id && myUserId === id);

  const { data: profile, isLoading, refetch: refetchProfile } = useSellerProfile(id);
  const { data: stats, refetch: refetchStats } = useSellerStats(id);
  const { data: liveShow, refetch: refetchLive } = useSellerLiveShow(id);
  const { data: items = [], refetch: refetchItems } = useSellerSoldItems(id);
  const { data: vouches = [], refetch: refetchVouches } = useVouches(id, myUserId);
  // Die Anbieterangaben. Nur bei gewerblichen Verkäufern gefüllt; fehlen sie,
  // rendert der Block gar nicht (siehe Kommentar an der Stelle).
  const { data: sellerRow } = useBerkatSeller(id);
  const imprintLines = useMemo(
    () =>
      [
        sellerRow?.legal_name,
        sellerRow?.street,
        [sellerRow?.postal_code, sellerRow?.city].filter(Boolean).join(' ') || null,
        // ⚠️ Der Ländercode wird AUSGESCHRIEBEN. `berkat_sellers.country` ist
        // per CHECK auf 'DE' | 'AT' | 'CH' beschränkt — als Datenwert richtig,
        // als Zeile in einer Anschrift falsch. Am 19.08.2026 am Gerät gesehen:
        // Zwischen „60313 Frankfurt am Main" und der E-Mail stand nackt „DE".
        // Ein Impressum ist eine Anschrift, keine Tabellenzeile.
        sellerRow?.country
          ? ({ DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz' }[sellerRow.country] ??
            sellerRow.country)
          : null,
        sellerRow?.contact_email,
        sellerRow?.vat_id ? `USt-IdNr. ${sellerRow.vat_id}` : null,
      ].filter((v): v is string => Boolean(v)),
    [sellerRow],
  );
  const { data: counts, refetch: refetchCounts } = useFollowCounts(id);
  const vouch = useVouchActions(id, myUserId);
  const [vouchNotice, setVouchNotice] = useState<string | null>(null);

  const { data: standing = [], refetch: refetchStanding } = useSellerListings(id);
  const standingActions = useStandingActions(id, myUserId);
  const [standingBusyId, setStandingBusyId] = useState<string | null>(null);
  const follow = useFollow(id, myUserId);

  const updateProfile = useUpdateProfile(myUserId);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  /**
   * „Shop" ist die richtige Voreinstellung: Sie zeigt, was jemand SOFORT tun
   * kann. Nur wer ausdrücklich wegen eines Termins herkommt, will etwas
   * anderes — und der bringt das per `?tab=` mit.
   *
   * Als Anfangswert, nicht als Effekt: Ein `useEffect`, der den Reiter
   * nachträglich setzt, würde ihn auch dann zurückstellen, wenn der Besucher
   * inzwischen selbst weitergetippt hat.
   */
  const [tab, setTab] = useState<ProfileTab>(() =>
    wantedTab === 'shows' || wantedTab === 'reviews' ? wantedTab : 'shop',
  );
  // Das Banner wird beim Auswählen sofort hochgeladen, aber erst beim
  // Speichern in die Datenbank geschrieben. Deshalb liegt der Zwischenstand
  // hier und nicht im Blatt — ein Blatt, das sich neu aufbaut, verlöre ihn.
  const [bannerDraft, setBannerDraft] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);

  const { data: reviews = [], refetch: refetchReviews } = useSellerReviews(id);
  const { past: pastShows, announced } = useSellerShows(id);
  const sellerActions = useSellerActions(myUserId);
  const { data: blocked } = useMyBlocks(myUserId);
  const isBlocked = Boolean(id && blocked?.has(id));

  /**
   * Teilen.
   *
   * Bewusst OHNE eigene Profil-Adresse: `apps/berkat-web` hat vier statische
   * Seiten, eine für Profile ist nicht dabei. Ein Link auf
   * `…/seller/<id>` liefe ins Leere, und Cloudflare Pages wirft bei einer
   * Umschreib-Regel zusätzlich den Pfad weg (HANDOFF 8). Ein Empfänger, der auf
   * eine 404 klickt, kommt nicht wieder.
   *
   * Deshalb Name plus Startadresse. Sobald die Website eine Profilseite hat,
   * ist es hier eine Zeile.
   */
  const shareProfile = useCallback(async () => {
    try {
      await Share.share({
        message: [
          `${profile?.username ?? 'Dieser Verkäufer'} verkauft bei Berkat — Live-Auktionen, echte Menschen.`,
          SITE_URL,
        ].join('\n\n'),
      });
    } catch {
      // Abbrechen ist kein Fehler.
    }
  }, [profile?.username]);

  // ALLES nachladen, nicht nur live und verkauft.
  //
  // Bis zum 16.08.2026 holte dieser Ruf `refetchLive` und `refetchItems` —
  // Regal, Kacheln, Bürgen und Follower blieben stehen. Dieselbe Familie wie
  // der Fehler, bei dem ein zurückgezogenes Dauerangebot im Kategorien-Reiter
  // hängenblieb: Was auf der Seite steht, muss auch nachladen können.
  const refreshAll = useCallback(
    () =>
      Promise.all([
        refetchLive(),
        refetchItems(),
        refetchStanding(),
        refetchStats(),
        refetchVouches(),
        refetchCounts(),
        refetchProfile(),
        // Am 16.08.2026 nachgetragen — die beiden fehlten, obwohl der Absatz
        // darüber „ALLES nachladen" verspricht. Wer einen Termin ankündigt und
        // danach sein Profil öffnet, sah ihn sonst bis zu einer Minute nicht:
        // Ziehen-zum-Aktualisieren rührte die Show-Abfragen gar nicht an.
        announced.refetch(),
        pastShows.refetch(),
      ]),
    [
      refetchLive,
      refetchItems,
      refetchStanding,
      refetchStats,
      refetchVouches,
      refetchCounts,
      refetchProfile,
      announced.refetch,
      pastShows.refetch,
    ],
  );

  // Angekündigtes zuerst — „wann kommt der wieder" ist die Frage, die den
  // Sendeplan überhaupt wertvoll macht. Vergangenes ist nur Beleg.
  const showRows = useMemo((): ShowRow[] => {
    const soon = (announced.data ?? []).map((s) => ({
      id: `a-${s.id}`,
      kind: 'announced' as const,
      sessionId: null,
      planId: s.id,
      title: s.title,
      thumbnail: null,
      when: showWhen(s.scheduled_at),
      women_only: s.women_only,
    }));
    const done = (pastShows.data ?? []).map((s) => ({
      id: `p-${s.id}`,
      kind: 'past' as const,
      sessionId: s.id,
      planId: null,
      title: s.title,
      thumbnail: s.thumbnail_url,
      // Fällt `started_at` aus (dürfte nicht vorkommen, die Spalte wird beim
      // Anlegen gesetzt), ist `ended_at` die nächstbeste Wahrheit.
      when: s.started_at
        ? showWhen(s.started_at)
        : s.ended_at
          ? showWhen(s.ended_at)
          : '',
      women_only: s.women_only,
    }));
    return [...soon, ...done];
  }, [announced.data, pastShows.data]);

  // Der nächste angekündigte Termin — die Abfrage sortiert bereits aufsteigend
  // und filtert die Vergangenheit weg, der erste Eintrag IST also der nächste.
  const nextPlanned = announced.data?.[0] ?? null;

  // Was für die angekündigten Abende bereitliegt. EINE Abfrage für alle, wie im
  // Verkaufen-Reiter und im „Demnächst"-Streifen — und dieselbe, also denselben
  // Zwischenspeicher, wenn ein Besucher von der Startseite hierherkommt.
  const announcedIds = useMemo(
    () => (announced.data ?? []).map((s) => s.id),
    [announced.data],
  );
  const { byPlan: lineupByPlan } = usePreparedByPlan(announcedIds);

  const listData = useMemo(
    (): TabItem[] =>
      tab === 'shop' ? padToGrid(items, 3) : tab === 'reviews' ? reviews : showRows,
    [tab, items, reviews, showRows],
  );

  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refreshAll();
    } finally {
      setPulling(false);
    }
  }, [refreshAll]);

  // Dieselbe Falle wie überall in Berkat: Stack-Bildschirme bleiben aufgebaut.
  // Wer von hier ins Studio geht, einen Artikel einstellt und zurückkommt, sähe
  // sonst den alten Stand.
  useFocusEffect(
    useCallback(() => {
      void refreshAll();
    }, [refreshAll]),
  );

  const name = profile?.username ?? 'Verkäufer';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {isLoading ? '' : name}
        </Text>

        <Pressable
          hitSlop={8}
          onPress={() => void shareProfile()}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Profil teilen"
        >
          <Share2 size={19} color={ui.text} />
        </Pressable>

        {/* Bei sich selbst gäbe es nichts zu melden und niemanden zu sperren —
            dann bleibt der Platz leer statt ein Menü mit einem toten Eintrag
            zu zeigen. */}
        {isSelf || !myUserId ? (
          <View style={styles.headerBtn} />
        ) : (
          <Pressable
            hitSlop={8}
            onPress={() => setMenuOpen(true)}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Mehr"
          >
            <MoreHorizontal size={21} color={ui.text} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ui.brand} />
        </View>
      ) : !profile ? (
        <View style={styles.center}>
          <BerkatMark size={40} color={ui.sunken} />
          <Text style={styles.emptyTitle}>Diesen Verkäufer gibt es nicht mehr</Text>
        </View>
      ) : (
        <FlatList
          // `key` erzwingt einen Neuaufbau beim Reiterwechsel. FlatList darf
          // `numColumns` zur Laufzeit nicht ändern — ohne den Schlüssel wirft
          // es genau das als Fehler.
          key={tab}
          data={listData}
          keyExtractor={(item) => item.id}
          numColumns={tab === 'shop' ? 3 : 1}
          columnWrapperStyle={tab === 'shop' ? { gap: space.xs } : undefined}
          contentContainerStyle={{
            paddingHorizontal: space.md,
            paddingBottom: insets.bottom + space.xl,
            gap: space.xs,
          }}
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
          }
          ListHeaderComponent={
            <View>
              {/* Das Kopfbild. Ohne eigenes Bild bleibt eine ruhige Fläche aus
                  der Palette — ein Platzhalter-Foto für alle sähe aus wie ein
                  Fehler und wäre für jede zweite Marke das falsche Bild. */}
              <View style={styles.banner}>
                {profile.banner_url ? (
                  <Image
                    source={{ uri: profile.banner_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={160}
                  />
                ) : null}
              </View>

              <View style={styles.identity}>
                <Avatar uri={profile.avatar_url} name={profile.username} size={64} />
                <View style={styles.identityText}>
                  <Text numberOfLines={1} style={styles.name}>
                    {profile.display_name?.trim() || name}
                  </Text>
                  {/* Der @-Name steht klein darunter — aber nur, wenn oben
                      etwas anderes steht. Sonst stünde er zweimal da. */}
                  {profile.display_name?.trim() ? (
                    <Text numberOfLines={1} style={styles.handle}>
                      {name}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Die Bio steht unter der Kopfzeile statt daneben: Bis zu 300
                  Zeichen quetschen sich nicht neben ein 64er-Avatar. Und sie
                  klappt auf — vorher waren zwei Zeilen hart abgeschnitten, ohne
                  jede Möglichkeit, den Rest zu lesen. */}
              {profile.bio ? (
                <Pressable
                  onPress={() => setBioOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: bioOpen }}
                >
                  <Text numberOfLines={bioOpen ? undefined : 2} style={styles.bio}>
                    {profile.bio}
                  </Text>
                  {/* Der Knopf erscheint nur, wenn es wirklich etwas
                      aufzuklappen gibt. Die Länge ist die einzige Auskunft, die
                      hier ohne Messung zu haben ist — ein `onTextLayout` wäre
                      genauer, würde aber bei jedem Render neu messen. */}
                  {profile.bio.length > 110 ? (
                    <Text style={styles.bioMore}>
                      {bioOpen ? 'Weniger anzeigen' : 'Mehr anzeigen'}
                    </Text>
                  ) : null}
                </Pressable>
              ) : null}

              {/* „1584 Follower · 3 Gefolgt" — bei Whatnot die zweitgrößte
                  Zahl auf der Seite. Sie steht hier, weil die drei Kacheln
                  darunter nur ABGESCHLOSSENE Geschäfte messen: Ein Verkäufer,
                  der anfängt, steht dort dreimal auf „—". Das hier ist die
                  einzige Zahl, die vorher schon etwas sagt. */}
              {counts ? (
                <Text style={styles.counts}>
                  <Text style={styles.countsNum}>{counts.followers}</Text> Follower ·{' '}
                  <Text style={styles.countsNum}>{counts.following}</Text> Gefolgt
                </Text>
              ) : null}

              {isSelf ? (
                // Auf dem eigenen Profil ist „Folgen" sinnlos — hier steht der
                // einzige Ort, an dem die Bio je gesetzt werden kann.
                <Pressable
                  onPress={() => setEditing(true)}
                  style={styles.editBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Profil bearbeiten"
                >
                  <Pencil size={16} color={ui.text} />
                  <Text style={styles.editText}>Profil bearbeiten</Text>
                </Pressable>
              ) : (
                <>
                  {follow.canFollow ? (
                    <Pressable
                      onPress={() => follow.toggle()}
                      disabled={follow.busy}
                      style={[styles.followBtn, follow.isFollowing && styles.followBtnActive]}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[styles.followText, follow.isFollowing && styles.followTextActive]}
                      >
                        {follow.isFollowing ? 'Du folgst' : 'Folgen'}
                      </Text>
                    </Pressable>
                  ) : null}

                  {/* Beide Ziele gibt es seit dem 15.08., waren aber NUR aus
                      dem Verkäufer-Sheet im Live-Raum erreichbar — also genau
                      dann nicht, wenn niemand sendet. Whatnot stellt sie aufs
                      Profil, und dort gehören sie hin. */}
                  {myUserId && id ? (
                    <View style={styles.contactRow}>
                      <Pressable
                        style={styles.contactBtn}
                        onPress={() => router.push(`/messages/${id}`)}
                        accessibilityRole="button"
                      >
                        <MessageSquare size={16} color={ui.text} />
                        <Text style={styles.contactText}>Nachricht</Text>
                      </Pressable>
                      <Pressable
                        style={styles.contactBtn}
                        onPress={() => router.push(`/tip/${id}`)}
                        accessibilityRole="button"
                      >
                        <Coins size={16} color={ui.text} />
                        <Text style={styles.contactText}>Trinkgeld</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              )}

              {/* Läuft gerade etwas, ist das der wichtigste Knopf der Seite. */}
              {liveShow ? (
                <Pressable
                  style={styles.liveBanner}
                  onPress={() => router.push(`/live/${liveShow.id}`)}
                  accessibilityRole="button"
                >
                  <View style={styles.liveDot} />
                  <Text numberOfLines={1} style={styles.liveText}>
                    {liveShow.title ?? 'Sendet gerade'}
                  </Text>
                  <Radio size={15} color={ui.liveInk} />
                </Pressable>
              ) : null}

              {/* Dieselbe Fläche, zwei Zustände — wie bei der Live-Vorschau auf
                  den Show-Karten (Abschnitt 8): Sendet er, steht hier der rote
                  Streifen. Sendet er nicht und hat einen Termin angekündigt,
                  steht hier der Termin.

                  Er steht ÜBER den Reitern, weil „wann kommt der wieder?" die
                  Frage ist, die den ganzen Sendeplan wertvoll macht — und weil
                  der Folgen-Knopf direkt darüber die einzige Handlung ist, die
                  daraus etwas macht. Bis zum 16.08.2026 lag die Antwort hinter
                  dem dritten Reiter: Wer auf der Startseite eine Termin-Karte
                  antippte, landete auf einer Seite voller Produkte und sah
                  ausgerechnet das nicht, wofür er gekommen war.

                  Live schlägt Termin. Beides gleichzeitig wäre zwar möglich
                  (heute senden, morgen wieder), aber wer JETZT senden kann,
                  soll nicht auf morgen verwiesen werden. */}
              {!liveShow && nextPlanned ? (
                <Pressable
                  style={styles.soonBanner}
                  onPress={() => setTab('shows')}
                  accessibilityRole="button"
                  accessibilityLabel={`Nächster Termin: ${nextPlanned.title ?? 'Show'} ${showWhen(
                    nextPlanned.scheduled_at,
                  )}. Alle Termine anzeigen.`}
                >
                  <CalendarClock size={15} color={ui.text} />
                  <Text numberOfLines={1} style={styles.soonText}>
                    {nextPlanned.title ?? 'Nächste Show'}
                  </Text>
                  <Text style={styles.soonWhen}>{showWhen(nextPlanned.scheduled_at)}</Text>
                </Pressable>
              ) : null}

              <View style={styles.tiles}>
                <Tile
                  icon={<Star size={17} color={ui.text} />}
                  value={formatRating(stats?.rating ?? null)}
                  label={
                    stats?.ratingCount
                      ? `${stats.ratingCount} ${stats.ratingCount === 1 ? 'Bewertung' : 'Bewertungen'}`
                      : 'Noch keine Bewertung'
                  }
                />
                <Tile
                  icon={<Truck size={17} color={ui.text} />}
                  value={formatShipTime(stats?.shipHours ?? null)}
                  label={stats?.shipSamples ? 'Versandzeit' : 'Noch nichts versendet'}
                />
                <Tile
                  icon={<Tag size={17} color={ui.text} />}
                  value={String(stats?.sold ?? 0)}
                  label={stats?.sold === 1 ? 'Zuschlag' : 'Zuschläge'}
                />
              </View>

              {/* Steht ABSICHTLICH über den Reitern: Erst die Institution
                  (Sterne, Versandzeit, Zuschläge), dann die Menschen. Für diese
                  Community ist das der Teil, der entscheidet — er gehört nicht
                  hinter einen Reiter, den man erst antippen muss. */}
              <VouchPanel
                vouches={vouches}
                isSelf={isSelf}
                myUserId={myUserId}
                busy={vouch.add.isPending || vouch.remove.isPending}
                onVouch={(note) =>
                  void vouch.add
                    .mutateAsync(note)
                    .then(() => setVouchNotice('Danke — dein Name steht jetzt bei ihm. 🤝'))
                    .catch((e: unknown) =>
                      setVouchNotice(
                        vouchErrorText(e instanceof Error ? e.message : String(e)),
                      ),
                    )
                }
                onUnvouch={() =>
                  void vouch.remove
                    .mutateAsync()
                    .then(() => setVouchNotice('Zurückgezogen.'))
                    .catch(() => setVouchNotice('Das hat nicht geklappt.'))
                }
                onOpenProfile={(userId) => router.push(`/seller/${userId}`)}
              />

              {vouchNotice ? (
                <Pressable onPress={() => setVouchNotice(null)}>
                  <Text style={styles.vouchNotice}>{vouchNotice}</Text>
                </Pressable>
              ) : null}

              {/* ── Anbieterangaben eines gewerblichen Verkäufers (seit
                  18.08.2026 HIER statt auf jeder Artikelseite).

                  § 5 DDG verlangt „leicht erkennbar, unmittelbar erreichbar und
                  ständig verfügbar". Das Profil des Verkäufers ist genau das:
                  Von jedem seiner Angebote führt ein Tipp hierher, und die
                  Angaben stehen an EINER Stelle statt an dreißig.

                  Vorher lagen sie auf der Artikelseite — zwischen Beschreibung
                  und Kaufknopf, wo sie die Kaufseite behördlich machten. Zaur:
                  „Leute wollen beim Kaufen genießen, sie kommen nicht, um
                  eingeschüchtert zu werden."

                  ⚠️ Fehlen die Angaben, steht hier NICHTS. Der frühere rote
                  Satz („dieser Verkäufer hat … noch nicht hinterlegt") warnte
                  den Käufer vor einem Mangel, den er nicht beheben kann — und
                  vor allem vor einer Lücke auf UNSERER Seite: Das Formular zum
                  Eintragen fehlt bis heute (Abschnitt 33). Der Hinweis steht
                  jetzt nur noch dort, wo er handlungsleitend ist: an den
                  eigenen Angeboten des Verkäufers. ─────────────────────────── */}
              {sellerRow?.kind === 'business' && imprintLines.length > 0 ? (
                <View style={styles.imprintBlock}>
                  <Text style={styles.imprintLabel}>Anbieterangaben</Text>
                  <Text style={styles.imprintText}>{imprintLines.join('\n')}</Text>
                </View>
              ) : null}

              {/* Die Reiter, nach Whatnot-Vorbild. „Clips" fehlt bewusst:
                  Berkat hat kein Replay und keine Clip-Marker — ein Reiter, der
                  nur erklären kann, dass es ihn nicht gibt, ist keiner. */}
              <View style={styles.tabs}>
                {TABS.map((entry) => {
                  const on = entry.key === tab;
                  return (
                    <Pressable
                      key={entry.key}
                      onPress={() => setTab(entry.key)}
                      style={[styles.tab, on && styles.tabOn]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.tabText, on && styles.tabTextOn]}>
                        {entry.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Ware vor Beleg: „Jetzt kaufbar" steht über „Zuletzt verkauft".
                  Wer auf ein Profil kommt, während niemand sendet, soll etwas
                  TUN können. */}
              {tab !== 'shop' ? null : (
              <StandingShelf
                listings={standing}
                isOwner={isSelf}
                // Auf dem Profil wird gestöbert, nicht verwaltet — hier trägt
                // das Bild. Unter `/shelf` bleibt es die kompakte Liste.
                layout="grid"
                // Nur auf dem eigenen Profil. Bei einem Fremden ist „hat
                // nichts" eine Auskunft, die niemand braucht — da bleibt das
                // Regal unsichtbar.
                emptyText={
                  isSelf
                    ? 'Noch nichts im Regal. Unter „Verkaufen" kannst du Artikel dauerhaft anbieten — die sind rund um die Uhr kaufbar, auch wenn du nicht sendest.'
                    : null
                }
                busyId={standingBusyId}
                // Kaufen und Anschreiben liegen seit dem 17.08.2026 auf der
                // Artikelseite, zu der jede Karte führt. Auf dem Profil wäre
                // beides ein Kaufweg ohne Beschreibung, ohne Versandkosten und
                // ohne die Rechtsfolge der Anbieterkennzeichnung.
                onCancel={(item) => {
                  setStandingBusyId(item.id);
                  void standingActions.cancel
                    .mutateAsync(item.id)
                    .then(() => setVouchNotice('Zurückgezogen.'))
                    .catch((e: unknown) =>
                      setVouchNotice(
                        standingErrorText(e instanceof Error ? e.message : String(e)),
                      ),
                    )
                    .finally(() => setStandingBusyId(null));
                }}
              />
              )}

              {tab === 'shop' && items.length > 0 ? (
                <Text style={styles.section}>Zuletzt verkauft</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <BerkatMark size={36} color={ui.sunken} />
              <Text style={styles.emptyTitle}>
                {tab === 'reviews'
                  ? 'Noch keine Bewertung mit Text'
                  : tab === 'shows'
                    ? 'Noch keine Sendung'
                    : 'Noch nichts verkauft'}
              </Text>
              {/* Auf dem eigenen Profil wäre „Schau bei der nächsten Show
                  vorbei" eine Aufforderung an sich selbst, zuzuschauen. */}
              <Text style={styles.emptyBody}>
                {tab === 'reviews'
                  ? // Die Kachel oben zählt ALLE Bewertungen, diese Liste zeigt
                    // nur die mit Worten. Dass beides auseinandergeht, ist kein
                    // Fehler und wird hier gesagt statt verschwiegen.
                      isSelf
                      ? 'Sterne allein stehen oben in der Kachel. Hier erscheinen sie, sobald jemand auch etwas dazuschreibt.'
                      : `Bewertet wurde ${name} vielleicht schon — geschrieben hat bisher niemand.`
                  : tab === 'shows'
                    ? isSelf
                      ? 'Kündige unter „Verkaufen" einen Termin an, dann steht er hier — und deine Follower bekommen 15 Minuten vorher eine Erinnerung.'
                      : `${name} hat noch keinen Termin angekündigt.`
                    : isSelf
                      ? 'Sobald deine erste Auktion durch ist, steht sie hier — das ist die Auslage, die Fremde als Erstes lesen.'
                      : `${name} hat hier noch keine Auktion abgeschlossen. Schau bei der nächsten Show vorbei.`}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            // ── Live-Shows ────────────────────────────────────────────────
            if ('kind' in item) {
              const soon = item.kind === 'announced';
              const lineup = item.planId ? (lineupByPlan.get(item.planId) ?? []) : [];
              return (
                <View>
                <Pressable
                  style={({ pressed }) => [styles.showRow, pressed && styles.rowPressed]}
                  // Eine vergangene Show hat keinen Raum mehr, in den man gehen
                  // könnte — Berkat hat kein Replay. Deshalb ist nur die
                  // Ankündigung „tot" und die alte Show erst recht: beides
                  // steht als Beleg da, nicht als Knopf.
                  disabled
                >
                  {/* Das Cover, wenn es eines gibt — eine gelaufene Show ist
                      wiedererkennbar an ihrem Bild, nicht an „Berkat-Show".
                      Eine Ankündigung hat keins (es entsteht erst beim
                      Starten), die behält das Kalender-Symbol. */}
                  {item.thumbnail ? (
                    <View style={styles.showThumb}>
                      <Image
                        source={{ uri: item.thumbnail }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={120}
                      />
                    </View>
                  ) : (
                    <View style={[styles.showIcon, soon && styles.showIconSoon]}>
                      {soon ? (
                        <CalendarClock size={17} color={ui.goldInk} />
                      ) : (
                        <Radio size={17} color={ui.textMuted} />
                      )}
                    </View>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={styles.showTitle}>
                      {item.title ?? (soon ? 'Angekündigte Show' : 'Show')}
                    </Text>
                    <Text style={styles.showMeta}>
                      {/* Ohne Zeit kein Trennzeichen — „Gelaufen · " mit
                          nichts dahinter sah nach einem Fehler aus. */}
                      {soon ? 'Angekündigt' : 'Gelaufen'}
                      {item.when ? ` · ${item.when}` : ''}
                    </Text>
                  </View>
                  {item.women_only ? <Lock size={13} color={ui.success} /> : null}
                </Pressable>

                {/* Was an diesem Abend drankommt. Steht UNTER der Zeile und
                    nicht darin: Die Zeile selbst ist bewusst tot (es gibt
                    keinen Raum, in den sie führen könnte), die Kacheln
                    darunter sind es nicht. Ein antippbares Kind in einem
                    deaktivierten Elternteil wäre die fragilere Bauweise. */}
                <LineupPreview items={lineup} when={item.when} />
                </View>
              );
            }

            // ── Bewertungen ───────────────────────────────────────────────
            if ('comment' in item) {
              return (
                <View style={styles.review}>
                  <View style={styles.reviewHead}>
                    <Avatar
                      uri={item.reviewer_avatar}
                      name={item.reviewer_name}
                      size={30}
                    />
                    <Text numberOfLines={1} style={styles.reviewName}>
                      {item.reviewer_name ?? 'Jemand'}
                    </Text>
                    <RatingStars value={item.rating} size={13} readOnly />
                  </View>
                  <Text style={styles.reviewText}>{item.comment}</Text>
                  <Text style={styles.reviewWhen}>{reviewWhen(item.created_at)}</Text>
                </View>
              );
            }

            // ── Shop: zuletzt verkauft ────────────────────────────────────
            // Der Platzhalter hält nur die Spalte offen.
            if ('spacer' in item) return <View style={styles.cell} />;
            return (
            <View style={styles.cell}>
              <View style={styles.thumb}>
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                  />
                ) : null}
                {item.current_bid_cents != null ? (
                  <View style={styles.pricePill}>
                    <Text style={styles.priceText}>{formatEuro(item.current_bid_cents)}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={styles.cellTitle}>
                {item.title}
              </Text>
            </View>
            );
          }}
        />
      )}

      {/* Sperren und Melden. Beides gab es schon im Verkäufer-Sheet des
          Live-Raums (`useSellerActions`) — also genau dann NICHT, wenn niemand
          sendet. Auf dem Profil ist es erreichbar, ohne dass jemand live sein
          muss. Kein RPC, keine Migration: `user_blocks_insert` verlangt
          `blocker_id = auth.uid()`, `user_reports_insert` dasselbe für
          `reporter_id`, die RLS trägt beides. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
        <View style={styles.menuWrap}>
          <View style={styles.menu}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                if (!id) return;
                setMenuOpen(false);
                void (isBlocked
                  ? sellerActions.unblock(id)
                  : sellerActions.block(id)
                ).then((res) =>
                  setVouchNotice(
                    res.ok
                      ? isBlocked
                        ? 'Sperre aufgehoben.'
                        : 'Gesperrt — du siehst seine Nachrichten im Chat nicht mehr.'
                      : res.message,
                  ),
                );
              }}
              accessibilityRole="button"
            >
              <Ban size={18} color={ui.text} />
              <Text style={styles.menuText}>
                {isBlocked ? 'Sperre aufheben' : 'Nutzer sperren'}
              </Text>
            </Pressable>

            <View style={styles.menuSplit} />

            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason.key}
                style={styles.menuRow}
                onPress={() => {
                  if (!id) return;
                  setMenuOpen(false);
                  void sellerActions.report(id, reason.key).then((res) =>
                    setVouchNotice(
                      res.ok ? 'Danke — wir sehen es uns an.' : res.message,
                    ),
                  );
                }}
                accessibilityRole="button"
              >
                <Flag size={18} color={ui.live} />
                <Text style={[styles.menuText, styles.menuTextDanger]}>
                  Melden · {reason.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.menuCancel} onPress={() => setMenuOpen(false)}>
            <Text style={styles.menuCancelText}>Abbrechen</Text>
          </Pressable>
        </View>
      </Modal>

      <ProfileEditSheet
        visible={editing}
        initialBio={profile?.bio ?? null}
        initialDisplayName={profile?.display_name ?? null}
        initialBanner={profile?.banner_url ?? null}
        bannerUrl={bannerDraft}
        uploading={bannerUploading}
        busy={updateProfile.isPending}
        onPickBanner={() => {
          setBannerUploading(true);
          // `cover` = Speicherort (`thumbnails/`), `wide` = Form. Das Banner
          // ist rund 3:1 — ein Zuschnitt-Rahmen hilft ihm nicht, weil iOS nur
          // quadratisch zuschneiden kann. Also volles Bild laden und den
          // Ausschnitt beim Zeichnen wählen.
          void pickAndUpload('cover', 'wide')
            .then((url) => {
              if (url) setBannerDraft(url);
            })
            .catch(() => setVouchNotice('Das Bild ließ sich nicht hochladen.'))
            .finally(() => setBannerUploading(false));
        }}
        onClearBanner={() => setBannerDraft(null)}
        onClose={() => setEditing(false)}
        onSave={(bio, displayName, bannerUrl) =>
          void updateProfile
            .mutateAsync({ bio, displayName, bannerUrl })
            .then(() => {
              setEditing(false);
              setVouchNotice('Gespeichert. 🙂');
            })
            .catch((e: unknown) =>
              setVouchNotice(
                profileEditErrorText(e instanceof Error ? e.message : String(e)),
              ),
            )
        }
      />
    </View>
  );
}

function Tile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.tile}>
      {icon}
      <Text style={styles.tileValue}>{value}</Text>
      <Text numberOfLines={2} style={styles.tileLabel}>
        {label}
      </Text>
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
    paddingBottom: space.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerBtn: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  tabs: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.lg,
    marginBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabOn: { borderBottomColor: ui.brand },
  tabText: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
  tabTextOn: { color: ui.text, fontWeight: '700' },

  rowPressed: { opacity: 0.6 },
  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  showIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showIconSoon: { backgroundColor: ui.gold },
  // Eckig wie überall, wo eine Sache steht und kein Mensch.
  showThumb: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  showTitle: { fontSize: 15, fontWeight: '700', color: ui.text },
  showMeta: { fontSize: 12, color: ui.textMuted, marginTop: 2 },

  review: {
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
    gap: 6,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reviewName: { flex: 1, fontSize: 14, fontWeight: '700', color: ui.text },
  reviewText: { fontSize: 14, color: ui.text, lineHeight: 20 },
  reviewWhen: { fontSize: 11, color: ui.textMuted },

  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,36,30,0.35)' },
  menuWrap: { flex: 1, justifyContent: 'flex-end', padding: space.md, gap: space.sm },
  menu: { backgroundColor: ui.card, borderRadius: radius.lg, overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 15,
  },
  // Abstand zwischen „Sperren" und den Melde-Gründen: Ein Melde-Knopf direkt
  // unter einem Sperr-Knopf wird verrutscht getroffen (dieselbe Regel wie im
  // Verkäufer-Sheet, HANDOFF 10).
  menuSplit: { height: StyleSheet.hairlineWidth, backgroundColor: ui.line, marginVertical: 4 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: ui.text },
  menuTextDanger: { color: ui.live },
  menuCancel: {
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: ui.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCancelText: { fontSize: 15, fontWeight: '700', color: ui.text },

  banner: {
    height: 116,
    borderRadius: radius.md,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
    marginBottom: space.md,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  identityText: { flex: 1, minWidth: 0 },
  name: { fontSize: 22, fontWeight: '700', color: ui.text },
  handle: { fontSize: 13, color: ui.textMuted, marginTop: 1 },
  bio: { fontSize: 13, color: ui.text, marginBottom: 3, lineHeight: 19 },
  bioMore: { fontSize: 12, fontWeight: '700', color: ui.brand, marginBottom: space.sm },

  counts: { fontSize: 13, color: ui.textMuted, marginBottom: space.md },
  countsNum: { fontWeight: '700', color: ui.text },

  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    marginBottom: space.md,
  },
  editText: { fontSize: 15, fontWeight: '700', color: ui.text },

  contactRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: ui.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
  },
  contactText: { fontSize: 14, fontWeight: '600', color: ui.text },

  followBtn: {
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: ui.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  followBtnActive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: ui.lineStrong },
  followText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  followTextActive: { color: ui.text },

  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: ui.live,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    marginBottom: space.md,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ui.liveInk },
  liveText: { flex: 1, fontSize: 14, fontWeight: '700', color: ui.liveInk },

  /* Bewusst NICHT rot und nicht gold: Rot ist in Berkat die laufende Uhr (live,
     überboten), Gold der Kauf. Ein Termin ist beides nicht — er ist eine
     Einladung. Deshalb dieselbe ruhige Fläche und dasselbe Marken-Grün für die
     Zeit wie auf der „Demnächst"-Karte der Startseite: Dieselbe Auskunft soll
     an beiden Orten gleich aussehen. */
  soonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 11,
    marginBottom: space.md,
  },
  soonText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '700', color: ui.text },
  soonWhen: { fontSize: 13, fontWeight: '700', color: ui.brand },

  tiles: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    padding: space.md,
    gap: 3,
  },
  tileValue: { fontSize: 19, fontWeight: '700', color: ui.text, marginTop: 2 },
  tileLabel: { fontSize: 11, color: ui.textMuted, lineHeight: 14 },

  vouchNotice: {
    fontSize: 13,
    color: ui.success,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: space.sm,
  },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: ui.textMuted,
    marginTop: space.lg,
    marginBottom: space.sm,
  },

  // Ruhig gesetzt: Pflichtangaben müssen lesbar sein, nicht laut. Sie stehen
  // am Ende des Kopfes, nach dem, wofür jemand hergekommen ist.
  imprintBlock: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: 3,
  },
  imprintLabel: { fontSize: 11, fontWeight: '700', color: ui.textMuted },
  imprintText: { fontSize: 12, color: ui.textMuted, lineHeight: 18 },

  cell: { flex: 1 },
  thumb: {
    aspectRatio: ratio.card,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  pricePill: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  priceText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  cellTitle: { fontSize: 11, color: ui.textMuted, marginTop: 3 },

  empty: { alignItems: 'center', paddingTop: 40, gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: ui.text },
  emptyBody: {
    fontSize: 13,
    color: ui.textMuted,
    textAlign: 'center',
    paddingHorizontal: space.xl,
    lineHeight: 19,
  },
});
