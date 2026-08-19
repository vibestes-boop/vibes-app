// Aktivität — Whatnots vierter Reiter.
//
// Unterschied zur Glocke oben rechts: Dort steht, was Berkat GESCHICKT hat.
// Hier steht, was PASSIERT ist — auch das, wofür es keinen Push gibt, weil es
// niemanden wecken muss: dass ein Verkäufer, dem man folgt, gerade sendet, dass
// jemand etwas ins Regal gelegt hat, dass eine Einladung sich gelohnt hat.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Gavel,
  Gift,
  PartyPopper,
  Radio,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from 'lucide-react-native';

import { useSession } from '../../lib/session';
import { useActivity, type ActivityItem, type ActivityKind } from '../../lib/useActivity';
import { formatEuro, useProfiles } from '../../lib/useAuction';
import { useMyBids } from '../../lib/useMyBids';
import { Avatar } from '../../components/Avatar';
import { BerkatMark } from '../../components/BerkatMark';
import { radius, space, ui } from '../../theme/tokens';

/** Symbol und Farbe je Art. Gold ist der Kauf, Rot die laufende Uhr. */
function look(kind: ActivityKind): { Icon: typeof Gavel; tint: string } {
  switch (kind) {
    case 'won':
      return { Icon: PartyPopper, tint: ui.gold };
    case 'outbid':
      return { Icon: TrendingUp, tint: ui.live };
    case 'seller_live':
      return { Icon: Radio, tint: ui.live };
    case 'new_listing':
      return { Icon: ShoppingBag, tint: ui.brand };
    case 'reward_credit':
      return { Icon: Gift, tint: ui.success };
    case 'reward_perk':
      return { Icon: Sparkles, tint: ui.success };
    default:
      return { Icon: Gavel, tint: ui.textMuted };
  }
}

function whenLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  // Negativ heißt: liegt in der Zukunft. Das kommt bei „überboten" vor, weil
  // dort das Ende der Auktion als Zeit dient — dann ist die Restzeit die
  // Auskunft, nicht das Alter.
  if (diff < 0) {
    const min = Math.ceil(-diff / 60_000);
    return min < 60 ? `noch ${min} Min` : `noch ${Math.ceil(min / 60)} Std`;
  }
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Std`;
  if (std < 48) return 'gestern';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const { data: items = [], isLoading, refetch } = useActivity(userId);
  // Wo ich gerade mitbiete — eigener Takt, eigene Quelle. Läuft nichts, ist
  // die Liste leer und der Kopf rendert nicht.
  const { bids, outbid, refetch: refetchBids } = useMyBids(userId);

  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([refetch(), refetchBids()]);
    } finally {
      setPulling(false);
    }
  }, [refetch, refetchBids]);

  // Reiter bleiben aufgebaut — ohne das stünde beim Zurückwechseln der Stand
  // von vorhin da (HANDOFF 3).
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchBids();
    }, [refetch, refetchBids]),
  );

  const userIds = useMemo(() => items.map((i) => i.userId), [items]);
  const profiles = useProfiles(userIds);

  if (!userId) {
    return (
      <View style={[styles.screen, styles.gate, { paddingTop: insets.top }]}>
        <BerkatMark size={40} color={ui.brand} />
        <Text style={styles.emptyTitle}>Noch nicht angemeldet</Text>
        <Text style={styles.emptyBody}>
          Hier steht, was bei deinen Verkäufern passiert und wo du gerade mitbietest.
        </Text>
        <Pressable style={styles.primary} onPress={() => router.push('/login')}>
          <Text style={styles.primaryText}>Anmelden</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Aktivität</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item: ActivityItem) => item.key}
        // ⚠️ `emptyWrap` zentriert den Leerzustand über die ganze Höhe. Das
        // darf nur greifen, wenn WIRKLICH nichts da ist — steht oben die
        // Gebots-Liste, wäre sie sonst mittig im Nichts.
        contentContainerStyle={
          items.length === 0 && bids.length === 0
            ? styles.emptyWrap
            : { paddingBottom: insets.bottom + space.xl }
        }
        // ── Wo ich gerade mitbiete. Steht ÜBER dem Ereignis-Strom, weil es
        //    das Einzige hier ist, das eine Handlung verlangen kann: Eine
        //    Auktion läuft ab, ein Strom nicht.
        //
        //    Der Leerzustand dieses Bildschirms versprach seit dem 16.08.
        //    „und wo du gerade mitbietest" — die Absicht war da, die Liste
        //    fehlte (siebte Whatnot-Analyse).
        ListHeaderComponent={
          bids.length === 0 ? null : (
            <View style={styles.bidsBlock}>
              <Text style={styles.bidsLabel}>
                {outbid > 0
                  ? outbid === 1
                    ? 'Du wurdest überboten'
                    : `Du wurdest ${outbid}× überboten`
                  : 'Du bietest gerade mit'}
              </Text>
              {bids.map((bid) => (
                <Pressable
                  key={bid.auctionId}
                  style={({ pressed }) => [styles.bidRow, pressed && { opacity: 0.7 }]}
                  // Zum Live-Raum, nicht zum Artikel: Wer überboten wurde, will
                  // dorthin, wo er wieder bieten kann.
                  onPress={() =>
                    bid.sessionId ? router.push(`/live/${bid.sessionId}`) : undefined
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${bid.title}, ${
                    bid.leading ? 'du führst' : 'überboten'
                  }, aktuell ${formatEuro(bid.currentCents)}`}
                >
                  {bid.imageUrl ? (
                    <Image source={{ uri: bid.imageUrl }} style={styles.bidThumb} contentFit="cover" />
                  ) : (
                    <View style={styles.bidThumb} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.bidTitleRow}>
                      {/* Der Zustand zuerst, nicht der Titel: „Überboten" ist
                          die Auskunft, der Artikelname nur die Zuordnung. */}
                      <Text
                        style={[styles.bidState, bid.leading ? styles.bidLeading : styles.bidOutbid]}
                      >
                        {bid.leading ? 'Du führst' : 'Überboten'}
                      </Text>
                      {bid.status === 'scheduled' ? (
                        <Text style={styles.bidSoon}>startet noch</Text>
                      ) : null}
                    </View>
                    <Text numberOfLines={1} style={styles.bidTitle}>
                      {bid.title}
                    </Text>
                    <Text style={styles.bidMeta}>
                      Aktuell {formatEuro(bid.currentCents)}
                      {/* Das eigene Maximum steht nur da, wenn es eines gibt —
                          wer von Hand bietet, hat keines, und eine leere
                          Angabe wäre eine Frage statt einer Auskunft. */}
                      {bid.maxCents != null ? ` · dein Maximum ${formatEuro(bid.maxCents)}` : ''}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={ui.textMuted} />
                </Pressable>
              ))}
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <BerkatMark size={38} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Noch ruhig hier</Text>
              <Text style={styles.emptyBody}>
                Folge einem Verkäufer, dann steht hier, wann er sendet und was er Neues anbietet.
                Und sobald du mitbietest, siehst du hier sofort, wenn dich jemand überholt.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const { Icon, tint } = look(item.kind);
          const who = item.userId ? profiles[item.userId] : null;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push(item.target as never)}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}${item.body ? `, ${item.body}` : ''}`}
            >
              {/* Reihenfolge der Vorlieben: erst der ARTIKEL, dann der Mensch,
                  dann das Symbol.
                  Bei einem Zuschlag oder einem neuen Regal-Artikel erkennt man
                  die Sache am Foto — der Verkäufer steht ohnehin als Name
                  darunter. Bei „sendet gerade" gibt es kein Artikelbild, dann
                  ist der Avatar richtig: Dort IST der Mensch das Ereignis.
                  Belohnungen kommen von Berkat, nicht von jemandem — die
                  behalten das Symbol. */}
              {item.imageUrl ? (
                <View style={styles.thumb}>
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                  />
                </View>
              ) : who ? (
                <Avatar uri={who.avatarUrl} name={who.username} size={38} />
              ) : (
                <View style={[styles.iconWrap, { backgroundColor: `${tint}22` }]}>
                  <Icon size={19} color={tint} />
                </View>
              )}

              <View style={styles.body}>
                <View style={styles.titleRow}>
                  {/* Das Symbol wandert in die Titelzeile, sobald links ein
                      Bild oder ein Gesicht steht — sonst fehlte die Auskunft,
                      um welche Art Ereignis es geht. */}
                  {who || item.imageUrl ? <Icon size={13} color={tint} /> : null}
                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {item.title}
                  </Text>
                </View>
                {item.body ? (
                  <Text numberOfLines={2} style={styles.rowBody}>
                    {item.body}
                  </Text>
                ) : null}
                <Text style={styles.rowMeta}>
                  {who?.username ? `${who.username} · ` : ''}
                  {whenLabel(item.at)}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Wo ich mitbiete. Eigener Block über dem Strom, mit Trennlinie
  // darunter: Er gehört nicht zu den Ereignissen, er ist ein Zustand.
  bidsBlock: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
    gap: space.sm,
  },
  bidsLabel: { fontSize: 12, fontWeight: '700', color: ui.textMuted },
  bidRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bidThumb: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: ui.sunken },
  bidTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bidState: { fontSize: 12, fontWeight: '700' },
  // Grün heißt „alles gut, nichts zu tun". Rot ist in Berkat die laufende Uhr
  // und die Dringlichkeit — überboten zu sein ist genau das.
  bidLeading: { color: ui.success },
  bidOutbid: { color: ui.live },
  bidSoon: { fontSize: 11, color: ui.textMuted },
  bidTitle: { fontSize: 14, fontWeight: '600', color: ui.text, marginTop: 1 },
  bidMeta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },

  screen: { flex: 1, backgroundColor: ui.bg },
  gate: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },

  header: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.md },
  title: { fontSize: 26, fontWeight: '700', color: ui.text, letterSpacing: -0.4 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  rowPressed: { backgroundColor: ui.card },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Eckig, nicht rund: Ein Avatar ist ein Kreis, eine Ware ist es nicht.
  // Der Formunterschied trägt die Bedeutung, ohne dass ein Wort nötig wäre.
  thumb: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rowTitle: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: ui.text },
  rowBody: { fontSize: 14, color: ui.text, lineHeight: 19 },
  rowMeta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },

  emptyWrap: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: ui.text, marginTop: space.sm },
  emptyBody: { fontSize: 14, color: ui.textMuted, textAlign: 'center', lineHeight: 20 },

  primary: {
    marginTop: space.md,
    height: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: ui.goldInk },
});
