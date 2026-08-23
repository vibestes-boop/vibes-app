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
import { LinearGradient } from 'expo-linear-gradient';
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
  ShieldCheck,
  Star,
  Tag,
  Truck,
} from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { useSavedIds, useToggleSaved } from '../../lib/useSaved';
import { useFollow, useFollowCounts } from '../../lib/useFollow';
import { formatEuro } from '../../lib/useAuction';
import { formatRating, formatShipTime, useSellerStats } from '../../lib/useSellerStats';
import { useBerkatSeller } from '../../lib/useBerkatSeller';
import { useVouchActions, useVouches, vouchErrorText, vouchSummary } from '../../lib/useVouch';
import { profileEditErrorText, useUpdateProfile } from '../../lib/useProfileEdit';
import { pickAndUpload } from '../../lib/uploadImage';
import { REPORT_REASONS, useMyBlocks, useSellerActions } from '../../lib/useSellerActions';
import { reviewWhen, useSellerReviews, type SellerReview } from '../../lib/useSellerReviews';
import { showWhen, useSellerShows } from '../../lib/useSellerShows';
import { SITE_URL } from '../../lib/links';
import { goBack } from '../../lib/nav';
import { usePreparedByPlan } from '../../lib/usePrepared';
import {
  HIGHLIGHT_ITEMS_MAX,
  highlightErrorText,
  useCreateHighlight,
  useHighlights,
  useMyStoryArchive,
  type HighlightItem,
} from '../../lib/useHighlights';
import { Avatar } from '../../components/Avatar';
import { HighlightRail } from '../../components/HighlightRail';
import { HighlightSheet } from '../../components/HighlightSheet';
import { LineupPreview } from '../../components/LineupPreview';
import { ProfileEditSheet } from '../../components/ProfileEditSheet';
import { RatingStars } from '../../components/RatingStars';
import { VouchPanel } from '../../components/VouchPanel';
import { StandingShelf } from '../../components/StandingShelf';
import { standingErrorText, useStandingActions } from '../../lib/useStanding';
import { useSellerListings } from '../../lib/useListings';
import { BerkatMark } from '../../components/BerkatMark';
import { radius, ratio, space, stage, ui } from '../../theme/tokens';

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
 * Kopfbild und Avatar (23.08.2026 — vorher 116 und 64).
 *
 * Whatnots Profil lässt den Banner randlos bis unter die Statusleiste laufen
 * (~250 pt) und legt einen großen Avatar darüber. Berkats Kachel mit Rand und
 * Ecken war daneben eine Beilage. Die Zahlen hier sind bewusst kleiner als
 * Whatnots: Deren Banner trägt Logo, Claim UND Social-Handles, Berkats trägt
 * ein Foto — 180 pt reichen dafür, 250 wären eine leere Fläche.
 *
 * ⚠️ `BANNER_H` ist die SICHTBARE Höhe unter der Statusleiste. Die tatsächliche
 * Höhe ist `insets.top + BANNER_H`, sonst frisst die Statusleiste oben ein
 * Stück des Bildes.
 */
/**
 * Kopfbild und Avatar — am 23.08.2026 an Whatnots **App** nachgemessen.
 *
 * ⚠️ Die Web-Fassung von Whatnot ist ANDERS gebaut als ihre App, und der
 * Unterschied ist genau der Punkt: Im Web steht der Name neben dem Avatar
 * UNTER dem Banner, in der App liegen Avatar, Name und Untertitel IM Banner.
 * Wer die Web-Seite misst und danach baut, verschenkt rund hundert Punkte —
 * genau das ist am 23.08. zweimal passiert.
 *
 * Whatnots App, Bildschirm-Koordinaten: Banner endet bei 214, Avatar 128–199,
 * Name 142–162, Kennzahlen ab 214. Bei `insets.top = 62` sind das
 * `BANNER_H = 152` sichtbare Punkte.
 *
 * ⚠️ 152 ist KÜRZER als die 180 aus dem ersten Entwurf. „Höher" aus dem
 * Bauplan (Übergabe 75) meinte den Vergleich zur alten 116er-Kachel — gegen
 * Whatnot gemessen war der erste Entwurf bereits zu hoch, und jeder Punkt
 * Bannerhöhe schiebt alles darunter mit.
 */
const BANNER_H = 152;
const AVATAR = 80;

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
  // Die Kurzfassung für die Zeile am Namen — dieselbe Funktion wie auf der
  // Artikelseite, damit „wer bürgt" an beiden Orten gleich klingt.
  const vouchLine = vouchSummary(vouches);
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

  const { data: savedIds } = useSavedIds(myUserId);

  const toggleSaved = useToggleSaved(myUserId);

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
  // Eigener Entwurfs-Zustand wie beim Kopfbild — damit ein Upload das
  // Schließen und Wiederöffnen des Blattes überlebt.
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);

  // ── Highlights ────────────────────────────────────────────────────────────
  //
  // Der dauerhafte Teil der Stories: Was hier steht, bleibt stehen. Für ein
  // frisches Verkäufer-Profil ist das der einzige Weg, heute etwas zu zeigen,
  // ohne täglich zu posten (Übergabe, Abschnitt 81).
  const { data: highlights = [], refetch: refetchHighlights } = useHighlights(id);
  const createHighlight = useCreateHighlight();
  const [highlightOpen, setHighlightOpen] = useState(false);
  // Die Auswahl liegt HIER und nicht im Blatt — dieselbe Begründung wie beim
  // Kopfbild darüber: Der Bild-Wähler blendet die App aus, und ein Blatt, das
  // sich danach neu aufbaut, hätte die schon gewählten Fotos vergessen.
  const [highlightItems, setHighlightItems] = useState<HighlightItem[]>([]);
  const [highlightUploading, setHighlightUploading] = useState(false);
  const [highlightNotice, setHighlightNotice] = useState<string | null>(null);
  // ⚠️ Das Archiv wird NUR geladen, wenn das eigene Blatt offen ist. Sonst
  // kostete jeder Besuch auf einem fremden Profil eine Abfrage nach den eigenen
  // Stories, die dort niemand je zu sehen bekommt.
  const { data: storyArchive = [] } = useMyStoryArchive(highlightOpen && isSelf);

  const pickHighlightPhoto = useCallback(async () => {
    setHighlightNotice(null);
    setHighlightUploading(true);
    try {
      // `cover` = Speicherort (`thumbnails/`), `portrait` = Form. Ein Highlight
      // wird formatfüllend hochkant gezeigt, wie eine Story.
      const url = await pickAndUpload('cover', 'portrait');
      if (!url) return; // abgebrochen — kein Fehler
      setHighlightItems((prev) =>
        prev.length >= HIGHLIGHT_ITEMS_MAX || prev.some((i) => i.media_url === url)
          ? prev
          : [...prev, { media_url: url, media_type: 'image', thumbnail_url: url }],
      );
    } catch (e: unknown) {
      // ⚠️ Die Meldung des Uploads DURCHREICHEN statt zu ersetzen. Sie nennt bei
      // der 8-MB-Grenze die tatsächliche Größe — der Verkäufer weiß dann, dass
      // er ein kleineres Foto nehmen muss, statt es dreimal erneut zu versuchen
      // (Übergabe, Abschnitt 60, Fund 1).
      setHighlightNotice(e instanceof Error ? e.message : 'Das Bild ging nicht durch.');
    } finally {
      setHighlightUploading(false);
    }
  }, []);

  const submitHighlight = useCallback(
    (title: string) => {
      setHighlightNotice(null);
      createHighlight.mutate(
        { title, items: highlightItems },
        {
          onSuccess: () => {
            setHighlightOpen(false);
            setHighlightItems([]);
          },
          onError: (e: unknown) =>
            setHighlightNotice(
              highlightErrorText(e instanceof Error ? e.message : String(e)),
            ),
        },
      );
    },
    [createHighlight, highlightItems],
  );

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
        // Am 24.08.2026 gleich mitgenommen: Wer ein Highlight anlegt und danach
        // zieht, muss es sehen. Genau die Sorte Auslassung, vor der der Absatz
        // darüber warnt.
        refetchHighlights(),
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
      refetchHighlights,
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
    <View style={styles.screen}>
      {isLoading ? (
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator color={ui.brand} />
        </View>
      ) : !profile ? (
        <View style={[styles.center, { paddingTop: insets.top }]}>
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
            <RefreshControl
              refreshing={pulling}
              onRefresh={onPull}
              tintColor={ui.textMuted}
              // Die Liste beginnt seit dem Umbau bei y = 0, also UNTER der
              // Statusleiste. Ohne den Versatz drehte sich der Kreisel dort,
              // wo die Uhrzeit steht.
              progressViewOffset={insets.top}
            />
          }
          ListHeaderComponent={
            <View>
              {/* ── Kopfbild MIT Avatar und Namen darin ─────────────────────
                  Whatnots App legt beides in den Banner; die Kennzahlen
                  beginnen unmittelbar an seiner Unterkante. Das ist der ganze
                  Unterschied zu den zwei Entwürfen davor, die den Namen erst
                  unter und dann neben den Avatar UNTER den Banner stellten —
                  beide Male kostete das die volle Höhe des Identitätsblocks.

                  Ohne eigenes Bild bleibt Berkats Markengrün stehen, nicht
                  Sand. Zwei Gründe, und der zweite wiegt schwerer:

                    1. 152 Punkte nackter Sand sind eine Leere, an der man
                       vorbeiscrollt (am 23.08. am Simulator gesehen). Ein
                       dunkles Markenfeld liest sich als gesetzt.
                    2. ⚠️ Der Name steht jetzt IM Banner und ist deshalb weiß.
                       Auf Sand wäre er unsichtbar. Ein heller Rückfall würde
                       genau den Fehler bauen, den Berkats zwei feste Flächen
                       ausschließen sollen (Abschnitt 4).

                  In Phase 0 ist der Rückfall der REGELFALL, nicht der
                  Sonderfall: Fünf frische Verkäufer haben zuerst kein
                  Kopfbild. ─────────────────────────────────────────────────── */}
              <View style={[styles.banner, { height: insets.top + BANNER_H }]}>
                {profile.banner_url ? (
                  <Image
                    source={{ uri: profile.banner_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={160}
                  />
                ) : null}

                {/* ⚠️ Der Verlauf ist NICHT Zierde, er trägt die Lesbarkeit.
                    Ein Kopfbild ist ein fremdes Foto, das niemand kontrolliert
                    — weißer Text darauf ist auf dem einen Bild lesbar und auf
                    dem nächsten weg. Dieselbe Begründung wie bei `ui.overlay`
                    in `theme/tokens.ts`, nur nach dunkel statt nach hell,
                    weil hier eine ganze Zone abgedunkelt wird und keine Pille.
                    Auf dem Markengrün-Rückfall fällt er nicht auf.

                    ⚠️ DREI Stufen, nicht zwei — und `locations` ist der Punkt.
                    Ein linearer Verlauf von 0 auf 0,82 lässt am Namen nur 0,41
                    übrig; über einem unten HELLEN Foto (Schnee, weiße Wand,
                    Sandstrand) ergibt das **2,37 : 1**, also unlesbar. Die
                    mittlere Stufe zieht die Deckung nach oben, ohne den oberen
                    Bildrand zuzukleistern.

                    Durchgerechnet gegen reines Weiß, dem schlimmsten Fall:
                    Name-Oberkante 4,55 : 1 · Name-Mitte 5,63 : 1 · @-Name
                    7,33 : 1. Wer an diesen Zahlen dreht, rechnet sie nach —
                    das Auge misst 4,5 : 1 nicht. */}
                <LinearGradient
                  colors={['rgba(11,21,18,0)', 'rgba(11,21,18,0.55)', 'rgba(11,21,18,0.95)']}
                  locations={[0, 0.35, 1]}
                  style={styles.bannerScrim}
                  pointerEvents="none"
                />

                <View style={styles.identity}>
                  {/* Heller Ring: Ohne ihn verschwimmt der Avatar-Rückfall
                      (dunkelgrün) auf dem Markengrün-Banner zu einem Loch, und
                      auf einem dunklen Foto täte er dasselbe. */}
                  <View style={styles.avatarRing}>
                    <Avatar uri={profile.avatar_url} name={profile.username} size={AVATAR} />
                  </View>
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
              </View>

              {/* ── Wer bürgt, steht direkt am Namen (23.08.2026) ───────────
                  Bis hierher lag das Bürgen-Feld GANZ UNTEN, unter den drei
                  Kacheln. Damit stand oben, was jede Plattform hat (Sterne,
                  Versandzeit, Zuschläge), und unten das Einzige, was Whatnot
                  strukturell nicht bauen kann. Die Ausgangsanalyse § B5:
                  „Ein 5-Sterne-Durchschnitt bedeutet weniger als ‚mein Cousin
                  kennt ihn.'"

                  Derselbe Fehler wurde am 21.08. im Live-Kopf behoben
                  (Abschnitt 58) — auf dem Profil stand er noch.

                  Hier die LANGE Fassung `vouchSummary()`, nicht die kurze aus
                  dem Live-Kopf: Dort teilt sich die Zeile den Platz mit Name
                  und Zuschauer-Pille, hier hat sie die volle Breite. Das
                  vollständige Feld mit Namen, Gewicht und Sätzen bleibt weiter
                  unten — diese Zeile ist die Auskunft, das Feld ist der Beleg. */}
              {vouchLine ? (
                <View style={styles.vouchLine}>
                  <ShieldCheck size={14} color={ui.success} />
                  <Text numberOfLines={1} style={styles.vouchLineText}>
                    {vouchLine}
                  </Text>
                </View>
              ) : null}

              {/* Die Kacheln direkt danach, VOR Bio und Knöpfe: Erst die
                  Menschen, dann die Institution, dann alles Weitere. */}
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
                  onPress={() => {
                    // ⚠️ BEIDE Entwürfe aus dem gespeicherten Stand befüllen.
                    //
                    // Ohne das startet `bannerDraft` auf `null`, das Blatt zeigt
                    // den leeren Platzhalter — und „Speichern" schreibt
                    // `banner_url: null`, LÖSCHT also das vorhandene Bild. Wer
                    // nur seine Bio ändert, verliert sein Kopfbild.
                    //
                    // Der Fehler lag seit dem 16.08.2026 drin und fiel nie auf,
                    // weil man in derselben Sitzung meist gerade ein Bild
                    // hochgeladen hatte — dann steht der Entwurf ja. Gefunden am
                    // 21.08. beim Einbau des Profilbilds, das denselben Fehler
                    // geerbt hätte.
                    //
                    // Dieselbe Klasse wie „Vollersatz frisst, was das Formular
                    // nicht kennt" (Abschnitt 47): Ein Formular, das ALLE Felder
                    // schickt, muss ALLE Felder auch vorbefüllen.
                    setBannerDraft(profile?.banner_url ?? null);
                    setAvatarDraft(profile?.avatar_url ?? null);
                    setEditing(true);
                  }}
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

              {/* Das vollständige Bürgen-Feld: Namen, Gewicht, Sätze — und der
                  Knopf zum Selbst-Bürgen. Es steht bewusst WEITERHIN hier und
                  nicht oben: Die Zeile am Namen ist die Auskunft („jemand, den
                  du kennst, bürgt"), dieses Feld ist der Beleg dazu. Beides
                  oben wären zweihundert Punkte, bevor irgendjemand die
                  Kennzahlen sieht.

                  Über den Reitern bleibt es aus dem alten Grund: Für diese
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

              {/* ── Highlights, direkt über den Reitern (24.08.2026) ────────
                  Die Stelle ist die Konvention, die jeder kennt — Instagram
                  legt sie genau hier hin, zwischen Identität und Inhalt. Sie
                  ist ausserdem die einzige, die den am 23.08. gemessenen
                  Identitätsblock unangetastet lässt: Banner, Kacheln, Bio und
                  Bürgen-Feld stehen Punkt auf Punkt da, wo sie gegen Whatnots
                  App abgeglichen wurden (Abschnitt 76).

                  ⚠️ Auf einem FREMDEN Profil ohne Highlights rendert die Reihe
                  gar nichts — kein leerer Kasten, keine Überschrift. Dieselbe
                  Regel wie beim Story-Ring: Eine leere Reihe sagt „hier ist
                  nichts", und das ist das Gegenteil dessen, wofür die Funktion
                  gebaut ist. Auf dem eigenen Profil steht dagegen immer die
                  „+"-Scheibe; dort ist sie eine Einladung. ─────────────────── */}
              <HighlightRail
                highlights={highlights}
                isSelf={isSelf}
                onOpen={(highlightId) => router.push(`/highlight/${highlightId}`)}
                onCreate={() => {
                  setHighlightNotice(null);
                  setHighlightItems([]);
                  setHighlightOpen(true);
                }}
              />

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
                // ⚠️ Bis zum 23.08.2026 war dieses Regal die einzige
                // Stöber-Fläche OHNE Merken-Herz — dieselben Artikel tragen
                // eines auf `/shop`, in der Kategorie und auf der Startseite.
                // Ausgerechnet auf dem Weg, den der „Demnächst"-Streifen und
                // die Verkäufer-Suche nehmen, konnte man sich nichts merken.
                savedIds={savedIds}
                onToggleSaved={(auctionId, saved) =>
                  myUserId ? toggleSaved.mutate({ auctionId, saved }) : router.push('/login')
                }
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
                // ⚠️ Die Trennlinie sitzt am BLOCK, nicht an der Zeile.
                // Vorher trug `showRow` den `borderBottom` — und weil die
                // Artikel-Kacheln darunter gerendert werden, verlief die Linie
                // zwischen einer Show und IHREN EIGENEN Artikeln. Optisch
                // gehörten die Kacheln damit zur nächsten Show. Das war der
                // Grund, warum der Abschnitt zerfallen aussah (21.08.2026).
                <View style={styles.showBlock}>
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
                    <View style={styles.showIcon}>
                      {soon ? (
                        <CalendarClock size={17} color={ui.text} />
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

      {/* ── Die Kopfzeile liegt ÜBER der Liste, nicht davor (23.08.2026) ────
          Nur so kann das Kopfbild randlos bis unter die Statusleiste laufen.
          Der Preis dafür sind zwei Dinge, die beide hier gelöst sind:

          1. `pointerEvents="box-none"` — sonst wäre der obere Streifen der
             Seite tot und man käme am Kopfbild vorbei an nichts mehr heran.
             Genau die Falle aus Abschnitt 3 („Eine Ebene ohne `box-none` macht
             das halbe Bild tot").

          2. Der Verlauf. Berkat setzt die Statusleiste global auf `dark`
             (Abschnitt 4), also dunkle Symbole — über einem dunklen Bannerfoto
             unlesbar. Statt diesen Bildschirm zur zweiten Ausnahme neben dem
             Live-Raum zu machen, liegt der Sand als Verlauf über dem oberen
             Rand des Bildes: Die Symbole des Systems bleiben lesbar, und beim
             Scrollen sieht es aus wie das übliche Ausblenden unter einer
             Navigationsleiste.

             ⚠️ Der transparente Endpunkt muss DIESELBE Farbe tragen wie der
             Anfang (`ui.bg` = rgb(250,247,242)), nur mit Alpha 0. Ein
             `'transparent'` interpoliert auf iOS über Schwarz und legt einen
             grauen Schleier über das Bild.

             ⚠️ Der Verlauf deckt NUR die Statusleiste, nicht die Symbolzeile
             darunter. Am 23.08.2026 nachgemessen statt geschätzt: Auf Höhe der
             Symbole (~82 pt) wäre vom Sand nur noch rund ein Viertel übrig —
             über einem dunklen Bannerfoto ergäbe das 1,6:1, also unlesbar. Die
             drei Symbole tragen deshalb ihre eigene Auflage (siehe unten), und
             der Verlauf bleibt kurz genug, um das Foto nicht zu vernebeln. ─── */}
      <View
        style={[styles.header, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={[ui.bg, ui.bgClear]}
          style={[styles.headerScrim, { height: insets.top + 10 }]}
          pointerEvents="none"
        />
        <Pressable
          hitSlop={10}
          onPress={() => goBack('/(tabs)/')}
          style={[styles.headerBtn, styles.headerBtnOnImage]}
        >
          <ChevronLeft size={22} color={ui.text} />
        </Pressable>
        {/* Der Name steht seit dem Umbau groß unter dem Avatar. Ihn hier ein
            zweites Mal zu zeigen, wäre eine Dopplung — die Zeile bleibt leer. */}
        <View style={styles.headerSpacer} />

        <Pressable
          hitSlop={8}
          onPress={() => void shareProfile()}
          style={[styles.headerBtn, styles.headerBtnOnImage]}
          accessibilityRole="button"
          accessibilityLabel="Profil teilen"
        >
          <Share2 size={18} color={ui.text} />
        </Pressable>

        {/* Bei sich selbst gäbe es nichts zu melden und niemanden zu sperren —
            dann bleibt der Platz leer statt ein Menü mit einem toten Eintrag
            zu zeigen. */}
        {isSelf || !myUserId ? null : (
          <Pressable
            hitSlop={8}
            onPress={() => setMenuOpen(true)}
            style={[styles.headerBtn, styles.headerBtnOnImage]}
            accessibilityRole="button"
            accessibilityLabel="Mehr"
          >
            <MoreHorizontal size={20} color={ui.text} />
          </Pressable>
        )}
      </View>

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
        bannerUrl={bannerDraft}
        avatarUrl={avatarDraft}
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
        onPickAvatar={() => {
          setBannerUploading(true);
          // `cover` = Speicherort (`thumbnails/`), weil `r2-sign` nur zwei
          // Präfixe zulässt — `products/images` und `thumbnails` (Abschnitt 4).
          // Ein eigenes `avatars/` würde die Edge Function ablehnen.
          //
          // `square` ist hier die RICHTIGE Form, nicht ein Kompromiss: Der
          // Avatar wird rund gezeichnet, und iOS' Zuschnitt-Rahmen IST
          // quadratisch. Genau der Fall, für den `allowsEditing` gedacht ist.
          void pickAndUpload('cover', 'square')
            .then((url) => {
              if (url) setAvatarDraft(url);
            })
            .catch(() => setVouchNotice('Das Bild ließ sich nicht hochladen.'))
            .finally(() => setBannerUploading(false));
        }}
        onClearAvatar={() => setAvatarDraft(null)}
        onClearBanner={() => setBannerDraft(null)}
        onClose={() => setEditing(false)}
        onSave={(bio, displayName, bannerUrl, avatarUrl) =>
          void updateProfile
            .mutateAsync({ bio, displayName, bannerUrl, avatarUrl })
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

      <HighlightSheet
        visible={highlightOpen}
        archive={storyArchive}
        items={highlightItems}
        onChangeItems={setHighlightItems}
        busy={createHighlight.isPending}
        uploading={highlightUploading}
        notice={highlightNotice}
        onPickPhoto={() => void pickHighlightPhoto()}
        onCreate={submitHighlight}
        onClose={() => setHighlightOpen(false)}
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
  // Liegt seit dem 23.08.2026 ÜBER der Liste — Begründung am Aufrufort.
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  headerScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerSpacer: { flex: 1 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  /* Die dritte registrierte Verwendung von `ui.overlay` — Symbole auf einem
     FREMDEN Bild, das niemand kontrolliert. Eintrag steht in `theme/tokens.ts`.
     Ohne sie wären Zurück, Teilen und Mehr über einem dunklen Bannerfoto
     unsichtbar; ein Verlauf allein reicht auf dieser Höhe nicht (gemessen). */
  headerBtnOnImage: { borderRadius: radius.pill, backgroundColor: ui.overlay },

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
  // Trägt die Trennlinie für Zeile UND Artikel-Kacheln zusammen — siehe die
  // Begründung am Aufrufort.
  showBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  /**
   * ⚠️ KEIN Gold mehr für die angekündigte Show.
   *
   * Bis zum 21.08.2026 war das eine voll gesättigte goldene Scheibe von 38
   * Punkten — auf dem Verkäufer-Profil das Lauteste nach dem Bürgen-Knopf, und
   * der steht direkt darüber. Zwei Goldflächen, von denen nur eine etwas
   * bedeutet.
   *
   * Berkats eigenes Farbgesetz: **Gold trägt den Kauf.** Ein Kalendereintrag
   * ist kein Kauf. Der Unterschied „angekündigt / gelaufen" steht ohnehin im
   * Text daneben und im Symbol — er braucht keine Farbe, und die Betonung
   * übernimmt der Symbolton (kräftig für das, was kommt, gedämpft für das, was
   * war).
   */
  showIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: ui.scrim },
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

  /* Randlos: Die negativen Ränder heben das `paddingHorizontal` des
     `contentContainerStyle` auf. Keine Ecken, kein Rand — das Bild ist die
     Fläche, nicht eine Kachel darauf. Die Höhe kommt vom Aufrufort, weil sie
     die Statusleiste mitträgt.

     `justifyContent: 'flex-end'` schiebt den Identitätsblock an die
     Unterkante; Bild und Verlauf liegen absolut und zählen dabei nicht mit.
     Markengrün als Rückfall — Begründung am Aufrufort. */
  banner: {
    backgroundColor: ui.brand,
    overflow: 'hidden',
    marginHorizontal: -space.md,
    justifyContent: 'flex-end',
    marginBottom: space.md,
  },
  // 62 % — so hoch, dass der Name tief genug im Verlauf sitzt (Rechnung am
  // Aufrufort). Darüber bleibt das Bild frei; dort steht nichts, was Kontrast
  // bräuchte.
  bannerScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  avatarRing: {
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: ui.card,
    padding: 2,
  },
  identityText: { flex: 1, minWidth: 0 },
  /* ⚠️ `stage`-Töne auf der hellen Fläche, und das ist kein Verstoß gegen
     Abschnitt 4, sondern seine Anwendung: Der Banner IST eine dunkle Fläche
     (Foto oder Markengrün), und `stage` ist die Palette für dunkle Flächen.
     Wer hier `ui.text` nähme, schriebe Dunkel auf Dunkel. */
  name: { fontSize: 22, fontWeight: '700', color: stage.text },
  handle: { fontSize: 13, color: stage.textMuted, marginTop: 1 },

  /* Hellgrün wie auf der Artikelseite und im Live-Kopf — dieselbe Auskunft
     sieht überall gleich aus. Bewusst nicht gold: Gold trägt in Berkat den
     Kauf, eine Bürgschaft ist kein Kaufknopf (Abschnitt 15). */
  vouchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: space.md,
  },
  vouchLineText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '600', color: ui.success },

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

  // `marginBottom`, seit die Kacheln vor der Bio stehen statt am Ende.
  tiles: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
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
