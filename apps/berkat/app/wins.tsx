// „Deine Zuschläge" — wer hat bei mir was gewonnen, und hat er bezahlt?
//
// ⚠️ WARUM ES DIESEN BILDSCHIRM GEBEN MUSS
// Alles nach der Auktion hängt bei Berkat an `product_orders`: Bestellliste,
// Versand, Bewertung, Streitfall. Eine Bestellung entsteht aber nur mit
// Kassen-Freigabe — und die bleibt für fremde Verkäufer aus (ZAG). Für sie
// stand nach dem Zuschlag bisher **nichts**: kein Korb, keine Bestellung, keine
// Liste. Der Abend war vorbei, jemand hatte gewonnen, und der Verkäufer hatte
// keinen Ort, an dem stand, wer.
//
// Hier ist er. Und zugleich der einzige sinnvolle Ort für „hat nicht bezahlt" —
// ein Melde-Knopf ohne eine Liste, in der er sitzt, wäre keiner.

import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronLeft, MessageCircle, ShieldAlert, Undo2 } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { errText } from '../lib/errorText';
import { formatEuro } from '../lib/useAuction';
import {
  canReport,
  reportableIn,
  useSellerWins,
  type SellerWin,
} from '../lib/useSellerWins';
import { unpaidErrorText, useUnpaidActions } from '../lib/useUnpaidStrikes';
import { Avatar } from '../components/Avatar';
import { BerkatMark } from '../components/BerkatMark';
import { radius, space, ui } from '../theme/tokens';

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function WinsScreen() {
  // Kein Statusleisten-Hook: Berkat hat zwei feste Flächen und setzt die Leiste
  // global im Root-Layout (Übergabe 4). Das ist Serlos Problem, nicht unseres.
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const { rows, buyers, isLoading, refetch } = useSellerWins(myUserId);
  const { report, withdraw } = useUnpaidActions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const run = useCallback(
    async (win: SellerWin, action: () => Promise<unknown>) => {
      setBusyId(win.auctionId);
      setNotice(null);
      try {
        await action();
      } catch (e: unknown) {
        setNotice(unpaidErrorText(errText(e)));
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/sell')} style={s.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Deine Zuschläge</Text>
          {rows.length > 0 ? (
            <Text style={s.sub}>{rows.length === 1 ? '1 Zuschlag' : `${rows.length} Zuschläge`}</Text>
          ) : null}
        </View>
        <View style={s.back} />
      </View>

      {notice ? <Text style={s.notice}>{notice}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(w) => w.auctionId}
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
          gap: space.sm,
        }}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginTop: space.xl }} color={ui.textMuted} />
          ) : (
            <View style={s.empty}>
              <BerkatMark size={36} color={ui.sunken} />
              <Text style={s.emptyTitle}>Noch kein Zuschlag</Text>
              <Text style={s.emptyBody}>
                Sobald jemand einen deiner Artikel gewinnt, steht er hier — mit Namen, damit du
                weißt, wem du schreiben musst.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const buyer = buyers[item.buyerId];
          const busy = busyId === item.auctionId;
          const wait = reportableIn(item);
          return (
            <View style={s.row}>
              <View style={s.thumb}>
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                  />
                ) : null}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={2} style={s.rowTitle}>
                  {item.title}
                </Text>
                <Text style={s.price}>
                  {formatEuro(item.priceCents)}
                  <Text style={s.meta}>{`  ·  ${when(item.settledAt)}`}</Text>
                </Text>

                <Pressable
                  style={s.buyerRow}
                  onPress={() => router.push(`/seller/${item.buyerId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Profil von ${buyer?.username ?? 'Käufer'}`}
                >
                  <Avatar uri={buyer?.avatarUrl} name={buyer?.username} size={20} />
                  <Text numberOfLines={1} style={s.buyer}>
                    {buyer?.username ?? 'Käufer'}
                  </Text>
                </Pressable>

                {/* ⚠️ Der Zustand steht VOR den Knöpfen. Wer schon gemeldet hat,
                    soll das lesen und nicht erst am grauen Knopf merken. */}
                {item.paid ? (
                  <Text style={s.paid}>Bezahlt</Text>
                ) : item.reported ? (
                  <Text style={s.reported}>Als „nicht bezahlt" gemeldet</Text>
                ) : null}

                <View style={s.actions}>
                  {/* Schreiben steht ZUERST und immer. Bei Direktzahlung ist
                      das der eigentliche Weg — die Meldung ist das, was danach
                      kommt, wenn niemand antwortet. */}
                  {/* Die Route nimmt die NUTZER-Kennung, nicht die einer
                      Unterhaltung — den Faden legt der Bildschirm selbst an,
                      wenn es noch keinen gibt (wie auf der Artikelseite).
                      `listing` geht mit, damit die Artikelkarte im Verlauf
                      steht und der Käufer weiss, worum es geht. */}
                  <Pressable
                    style={s.ghost}
                    onPress={() =>
                      router.push(
                        `/messages/${item.buyerId}?listing=${item.auctionId}&draft=${encodeURIComponent(
                          `Hallo! Es geht um „${item.title}" — magst du kurz Bescheid geben?`,
                        )}`,
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${buyer?.username ?? 'Käufer'} schreiben`}
                  >
                    <MessageCircle size={15} color={ui.text} />
                    <Text style={s.ghostText}>Schreiben</Text>
                  </Pressable>

                  {item.reported ? (
                    <Pressable
                      style={s.ghost}
                      disabled={busy}
                      onPress={() => void run(item, () => withdraw.mutateAsync(item.auctionId))}
                      accessibilityRole="button"
                      accessibilityLabel="Meldung zurücknehmen"
                    >
                      {busy ? (
                        <ActivityIndicator color={ui.textMuted} />
                      ) : (
                        <>
                          <Undo2 size={15} color={ui.text} />
                          <Text style={s.ghostText}>Zurücknehmen</Text>
                        </>
                      )}
                    </Pressable>
                  ) : item.paid ? null : (
                    /* ⚠️ Grau statt versteckt, solange die Frist läuft — mit
                       der Restzeit daneben. Ein Knopf, der einfach fehlt,
                       lässt den Verkäufer suchen; einer ohne Begründung lässt
                       ihn tippen und scheitern. */
                    <Pressable
                      style={[s.ghost, !canReport(item) && s.off]}
                      disabled={busy || !canReport(item)}
                      onPress={() =>
                        void run(item, () => report.mutateAsync({ auctionId: item.auctionId }))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        canReport(item)
                          ? 'Als nicht bezahlt melden'
                          : `Melden möglich in ${wait ?? 'Kürze'}`
                      }
                    >
                      {busy ? (
                        <ActivityIndicator color={ui.textMuted} />
                      ) : (
                        <>
                          <ShieldAlert size={15} color={ui.live} />
                          <Text style={[s.ghostText, { color: ui.live }]}>
                            {wait ? `Nicht bezahlt · ${wait}` : 'Nicht bezahlt'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: ui.text },
  sub: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  notice: {
    marginHorizontal: space.md,
    marginBottom: space.sm,
    fontSize: 13,
    color: ui.live,
  },
  row: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    padding: space.sm,
  },
  thumb: {
    width: 64,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: ui.text },
  price: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: 2 },
  meta: { fontSize: 12, fontWeight: '500', color: ui.textMuted },
  buyerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs },
  buyer: { fontSize: 13, fontWeight: '600', color: ui.text, flexShrink: 1 },
  paid: { fontSize: 12, fontWeight: '700', color: ui.success, marginTop: space.xs },
  reported: { fontSize: 12, fontWeight: '700', color: ui.live, marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.lineStrong,
  },
  ghostText: { fontSize: 13, fontWeight: '600', color: ui.text },
  off: { opacity: 0.4 },
  empty: { alignItems: 'center', gap: space.sm, marginTop: space.xl * 2, paddingHorizontal: space.lg },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text },
  emptyBody: { fontSize: 13, color: ui.textMuted, textAlign: 'center', lineHeight: 19 },
});
