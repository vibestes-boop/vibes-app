// Aktivität — Whatnots vierter Reiter.
//
// Unterschied zur Glocke oben rechts: Dort steht, was Berkat GESCHICKT hat.
// Hier steht, was PASSIERT ist — auch das, wofür es keinen Push gibt, weil es
// niemanden wecken muss: dass ein Verkäufer, dem man folgt, gerade sendet, dass
// jemand etwas ins Regal gelegt hat, dass eine Einladung sich gelohnt hat.
//
// ── ⚠️ VOM STROM ZUM REGISTER (24.08.2026) ──────────────────────────────────
//
// Bis dahin war dieser Bildschirm EIN Strom mit zwei Zustands-Blöcken obendrauf.
// Zaur hat Whatnots Aktivitäts-Reiter danebengelegt, und der ist etwas anderes:
// vier Register (Purchases · Bids · Offers · Saved), keine Chronik.
//
// Der Unterschied ist nicht Geschmack. Ein Strom beantwortet „was ist
// passiert?", ein Register „wo stehe ich?". Die Fragen eines Käufers sind
// Zustands-Fragen — führe ich noch, wartet mein Vorschlag, wo war noch dieses
// eine Angebot — und ein Strom beantwortet die schlecht, weil die Antwort
// wegscrollt.
//
// Vier Reiter statt Whatnots vieren, mit einer Abweichung:
//
//   Neues        der bisherige Strom. Bleibt, weil er Dinge trägt, die Whatnot
//                gar nicht hat („Verkäufer sendet gerade") und die wirklich
//                Ereignisse sind.
//   Gebote       `useMyBids`
//   Vorschläge   `useMyOpenOffers`
//   Gemerkt      `SavedList` — dieselbe Liste wie unter `/saved`
//
// ⚠️ „Käufe" fehlt mit Absicht. Whatnot hat den Reiter, bei uns steckt das
// Gegenstück im Konto unter „Deine Pakete" — und dort hängt nicht nur die
// Bestellliste, sondern der ganze Sammelkorb mit `useCheckoutCart` und
// `useShippingLookup`. Das ist der Geld-Pfad. Ihn für eine Umsortierung
// anzufassen wäre der falsche Handel; das gehört in einen eigenen Schritt mit
// eigener Prüfung.
//
// ⚠️ Und der Strom bleibt der Vorgabe-Reiter, obwohl „Gebote" das Dringendste
// enthält. Grund: `outbid` und `won` sind ohnehin Ereignis-Arten im Strom — wer
// überboten wurde, sieht es also weiterhin sofort beim Öffnen, ohne einen
// Reiter suchen zu müssen. Ein leerer Vorgabe-Reiter wäre der schlechtere Tausch.

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { useMyOpenOffers } from '../../lib/useOffers';
import { Avatar } from '../../components/Avatar';
import { SavedList } from '../../components/SavedList';
import { BerkatMark } from '../../components/BerkatMark';
import { radius, space, ui } from '../../theme/tokens';

type TabKey = 'neues' | 'gebote' | 'vorschlaege' | 'gemerkt';

/**
 * Die Reiter. Reihenfolge ist Absicht: erst das Neue (Vorgabe), dann das, was
 * auf mich wartet, dann das, was ich mir aufgehoben habe.
 */
const TABS: { key: TabKey; label: string }[] = [
  { key: 'neues', label: 'Neues' },
  { key: 'gebote', label: 'Gebote' },
  { key: 'vorschlaege', label: 'Vorschläge' },
  { key: 'gemerkt', label: 'Gemerkt' },
];

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
  // Dasselbe für Preisvorschläge: „ich habe etwas laufen und warte". Bis zum
  // 24.08.2026 hatte nur das Gebot hier einen Platz — der Vorschlag nicht,
  // obwohl er dieselbe Frage stellt. Begründung in `useMyOpenOffers`.
  const { data: myOffers = [], refetch: refetchOffers } = useMyOpenOffers(userId);

  // Ein Gegenvorschlag ist der dringende Fall: Dort liegt der Ball beim Käufer.
  const counteredCount = useMemo(
    () => myOffers.filter((o) => o.status === 'countered').length,
    [myOffers],
  );

  const [tab, setTab] = useState<TabKey>('neues');
  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([refetch(), refetchBids(), refetchOffers()]);
    } finally {
      setPulling(false);
    }
  }, [refetch, refetchBids, refetchOffers]);

  // Reiter bleiben aufgebaut — ohne das stünde beim Zurückwechseln der Stand
  // von vorhin da (HANDOFF 3).
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchBids();
      void refetchOffers();
    }, [refetch, refetchBids, refetchOffers]),
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

      {/* Unterstrichene Textreiter statt Pillen — dieselbe Sprache wie Whatnot,
          und sie kostet keine Höhe. Bei vier Wörtern reicht die Breite ohne
          Scrollen; kommt ein fünftes dazu, muss das hier eine ScrollView werden. */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              style={styles.tab}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              <View style={[styles.tabRule, active && styles.tabRuleActive]} />
            </Pressable>
          );
        })}
      </View>

      {tab !== 'neues' ? null : (
      <FlatList
        data={items}
        keyExtractor={(item: ActivityItem) => item.key}
        // ⚠️ `emptyWrap` zentriert den Leerzustand über die ganze Höhe. Das
        // darf nur greifen, wenn WIRKLICH nichts da ist — steht oben die
        // Gebots-Liste, wäre sie sonst mittig im Nichts.
        // ⚠️ Hier stand bis zum Register-Umbau zusätzlich `&& bids.length === 0
        // && myOffers.length === 0` — die Blöcke lagen ja über dem Strom und der
        // zentrierte Leerzustand hätte sie sonst mittig ins Nichts geschoben. Seit
        // beide eigene Reiter haben, geht es nur noch um den Strom selbst.
        contentContainerStyle={
          items.length === 0
            ? styles.emptyWrap
            : { paddingBottom: insets.bottom + space.xl }
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
      )}

      {tab !== 'gebote' ? null : (
        <ScrollView
          contentContainerStyle={
            bids.length === 0
              ? styles.emptyWrap
              : { paddingTop: space.sm, paddingBottom: insets.bottom + space.xl }
          }
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
          }
        >
          {bids.length === 0 ? (
            <View style={styles.empty}>
              <BerkatMark size={38} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Du bietest gerade nirgends mit</Text>
              <Text style={styles.emptyBody}>
                Sobald du in einer Show mitbietest, steht hier, ob du noch führst — auch wenn du
                die App längst zugemacht hast.
              </Text>
            </View>
          ) : (
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
          )}
        </ScrollView>
      )}

      {tab !== 'vorschlaege' ? null : (
        <ScrollView
          contentContainerStyle={
            myOffers.length === 0
              ? styles.emptyWrap
              : { paddingTop: space.sm, paddingBottom: insets.bottom + space.xl }
          }
          refreshControl={
            <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
          }
        >
          {myOffers.length === 0 ? (
            <View style={styles.empty}>
              <BerkatMark size={38} color={ui.sunken} />
              <Text style={styles.emptyTitle}>Kein Vorschlag offen</Text>
              <Text style={styles.emptyBody}>
                Bei Artikeln im Regal kannst du einen Preis vorschlagen. Solange der Verkäufer
                nicht geantwortet hat, findest du ihn hier wieder.
              </Text>
            </View>
          ) : (
            <View style={styles.bidsBlock}>
                            <Text style={styles.bidsLabel}>
                              {counteredCount > 0
                                ? counteredCount === 1
                                  ? 'Ein Gegenvorschlag wartet auf dich'
                                  : `${counteredCount} Gegenvorschläge warten auf dich`
                                : myOffers.length === 1
                                  ? 'Dein Vorschlag läuft'
                                  : 'Deine Vorschläge laufen'}
                            </Text>
                            {myOffers.map((offer) => (
                              <Pressable
                                key={offer.id}
                                style={({ pressed }) => [styles.bidRow, pressed && { opacity: 0.7 }]}
                                onPress={() => router.push(`/listing/${offer.auction_id}`)}
                                accessibilityRole="button"
                                accessibilityLabel={`${offer.title}, ${
                                  offer.status === 'countered' ? 'Gegenvorschlag' : 'wartet auf Antwort'
                                }, dein Vorschlag ${formatEuro(offer.amount_cents)}`}
                              >
                                {offer.image_url ? (
                                  <Image source={{ uri: offer.image_url }} style={styles.bidThumb} contentFit="cover" />
                                ) : (
                                  <View style={styles.bidThumb} />
                                )}
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <View style={styles.bidTitleRow}>
                                    {/* Der Zustand zuerst, wie bei den Geboten. Rot nur beim
                                        Gegenvorschlag — dort liegt der Ball beim Käufer.
                                        Warten ist weder gut noch dringend, also gedämpft;
                                        Grün hiesse „alles gut", und das weiss hier niemand. */}
                                    <Text
                                      style={[
                                        styles.bidState,
                                        offer.status === 'countered' ? styles.bidOutbid : styles.offerWaiting,
                                      ]}
                                    >
                                      {offer.status === 'countered' ? 'Gegenvorschlag' : 'Wartet auf Antwort'}
                                    </Text>
                                  </View>
                                  <Text numberOfLines={1} style={styles.bidTitle}>
                                    {offer.title}
                                  </Text>
                                  <Text style={styles.bidMeta}>
                                    Dein Vorschlag {formatEuro(offer.amount_cents)}
                                    {offer.status === 'countered' && offer.counter_cents != null
                                      ? ` · Gegenvorschlag ${formatEuro(offer.counter_cents)}`
                                      : ''}
                                  </Text>
                                </View>
                                <ChevronRight size={18} color={ui.textMuted} />
                              </Pressable>
                            ))}
                          </View>
          )}
        </ScrollView>
      )}

      {tab !== 'gemerkt' ? null : (
        <SavedList userId={userId} bottomInset={insets.bottom} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Die Reiter. Unterstrich statt Pille: Er trägt die Auswahl, ohne eine
  // Fläche zu belegen — bei vier Wörtern nebeneinander zählt jeder Punkt.
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: space.xs, gap: space.xs },
  tabLabel: { fontSize: 14, fontWeight: '600', color: ui.textMuted },
  tabLabelActive: { color: ui.text, fontWeight: '700' },
  // Der Strich liegt IMMER da, nur durchsichtig — sonst springt die Zeile um
  // zwei Punkte, sobald man den Reiter wechselt.
  tabRule: { height: 2, alignSelf: 'stretch', backgroundColor: 'transparent', borderRadius: 1 },
  tabRuleActive: { backgroundColor: ui.text },

  // ── Gebote und Vorschläge. Bis zum Register-Umbau ein Block ÜBER dem Strom,
  // mit Trennlinie darunter — die trennte ihn von den Ereignissen. Seit beide
  // eigene Reiter haben, ist unter dem Block nichts mehr, und die Linie wäre
  // ein Strich ins Leere.
  bidsBlock: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
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
  // Warten ist kein Zustand, der eine Farbe verdient — weder Entwarnung noch Alarm.
  offerWaiting: { color: ui.textMuted },
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
