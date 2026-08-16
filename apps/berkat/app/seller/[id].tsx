// Die öffentliche Seite eines Verkäufers.
//
// Berkat hatte bis hierhin keine. Der Live-Raum zeigt einen Namen und eine
// Zahl — wer mehr wissen will, hatte keinen Ort dafür. Genau das ist beim
// ersten fremden Verkäufer der Unterschied zwischen „kauf ich" und „lieber
// nicht".
//
// Sie liegt auf der hellen Fläche (`ui`), nicht auf der Bühne: Man kommt zwar
// aus dem Live-Raum hierher, aber das hier ist Stöbern, kein Zuschauen.

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Radio, Star, Tag, Truck } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { useFollow } from '../../lib/useFollow';
import { formatEuro } from '../../lib/useAuction';
import { formatRating, formatShipTime, useSellerStats } from '../../lib/useSellerStats';
import { useVouchActions, useVouches, vouchErrorText } from '../../lib/useVouch';
import { Avatar } from '../../components/Avatar';
import { VouchPanel } from '../../components/VouchPanel';
import { StandingShelf } from '../../components/StandingShelf';
import {
  standingErrorText,
  useStandingActions,
  useStandingListings,
} from '../../lib/useStanding';
import { BerkatMark } from '../../components/BerkatMark';
import { radius, space, ui } from '../../theme/tokens';

type SellerProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  const { data: profile, isLoading } = useSellerProfile(id);
  const { data: stats } = useSellerStats(id);
  const { data: liveShow, refetch: refetchLive } = useSellerLiveShow(id);
  const { data: items = [], refetch: refetchItems } = useSellerSoldItems(id);
  const { data: vouches = [] } = useVouches(id, myUserId);
  const vouch = useVouchActions(id, myUserId);
  const [vouchNotice, setVouchNotice] = useState<string | null>(null);

  const { data: standing = [] } = useStandingListings(id);
  const standingActions = useStandingActions(id, myUserId);
  const [standingBusyId, setStandingBusyId] = useState<string | null>(null);
  const follow = useFollow(id, myUserId);

  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([refetchLive(), refetchItems()]);
    } finally {
      setPulling(false);
    }
  }, [refetchLive, refetchItems]);

  // Dieselbe Falle wie überall in Berkat: Stack-Bildschirme bleiben aufgebaut.
  // Wer den Verkäufer verlässt, live geht und zurückkommt, sähe sonst den alten
  // Stand.
  useFocusEffect(
    useCallback(() => {
      void refetchLive();
    }, [refetchLive]),
  );

  const name = profile?.username ?? 'Verkäufer';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {isLoading ? '' : name}
        </Text>
        <View style={styles.back} />
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
          data={padToGrid(items, 3)}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={{ gap: space.xs }}
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
              <View style={styles.identity}>
                <Avatar uri={profile.avatar_url} name={profile.username} size={64} />
                <View style={styles.identityText}>
                  <Text numberOfLines={1} style={styles.name}>
                    {name}
                  </Text>
                  {profile.bio ? (
                    <Text numberOfLines={2} style={styles.bio}>
                      {profile.bio}
                    </Text>
                  ) : null}
                </View>
              </View>

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

              {/* Ware vor Beleg: „Jetzt kaufbar" steht über „Zuletzt verkauft"
                  und über den Bürgen. Wer auf ein Profil kommt, während niemand
                  sendet, soll etwas TUN können. */}
              <StandingShelf
                listings={standing}
                isOwner={myUserId === id}
                signedIn={Boolean(myUserId)}
                busyId={standingBusyId}
                onBuy={(item) => {
                  setStandingBusyId(item.id);
                  void standingActions.buy
                    .mutateAsync(item.id)
                    .then(() =>
                      setVouchNotice('Im Paket. 🎉 Bezahlen kannst du unter „Konto".'),
                    )
                    .catch((e: unknown) =>
                      setVouchNotice(
                        standingErrorText(e instanceof Error ? e.message : String(e)),
                      ),
                    )
                    .finally(() => setStandingBusyId(null));
                }}
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

              {/* Steht ABSICHTLICH unter den Kacheln: Erst die Institution
                  (Sterne, Versandzeit, Zuschläge), dann die Menschen. Wer die
                  Zahlen nicht überzeugend findet, liest hier weiter — und für
                  diese Community ist das der Teil, der entscheidet. */}
              <VouchPanel
                vouches={vouches}
                isSelf={myUserId === id}
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

              <Text style={styles.section}>
                {items.length > 0 ? 'Zuletzt verkauft' : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <BerkatMark size={36} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Noch nichts verkauft</Text>
              <Text style={styles.emptyBody}>
                {name} hat hier noch keine Auktion abgeschlossen. Schau bei der nächsten Show
                vorbei.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  identityText: { flex: 1, minWidth: 0 },
  name: { fontSize: 22, fontWeight: '700', color: ui.text },
  bio: { fontSize: 13, color: ui.textMuted, marginTop: 3, lineHeight: 18 },

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

  cell: { flex: 1 },
  thumb: {
    aspectRatio: 1,
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
