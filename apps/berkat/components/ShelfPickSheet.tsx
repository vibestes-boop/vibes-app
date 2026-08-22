// „Aus dem Regal holen" — der eine Zettel für beide Ziele.
//
// Bis zum 21.08.2026 musste ein Verkäufer, der zwanzig Artikel im Regal hatte,
// sie für seine Sendung ein zweites Mal eintippen: Titel, Startpreis, Bild.
// Dabei liegen Regal und Show in derselben Tabelle, und die Preise passen schon
// (`20260821160000` erklärt, warum — `start_price_cents` steht seit dem 15.08.
// auf 100, genau für diesen Fall).
//
// ⚠️ EIN TIPP VERSCHIEBT SOFORT, ohne Rückfrage. Das ist Absicht und der
// Gegenpol zu `discard_prepared_auction`, das nachfragt: Dort wird gelöscht,
// hier nur umgeräumt. Der Artikel ist nach dem Tipp in der Show und lässt sich
// von dort mit zwei Tipps zurückholen — eine Rückfrage bei jedem Artikel würde
// bei zwölf Artikeln zwölfmal stören, ohne etwas zu schützen.
//
// Die Zeile verschwindet danach aus der Liste, weil sie das Regal verlassen hat
// (`status` ist nicht mehr `listed`). Das IST die Rückmeldung — ein zusätzlicher
// Erfolgs-Hinweis wäre die Bestätigung von etwas, das man gerade sieht.

import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Package } from 'lucide-react-native';

import { formatEuro } from '../lib/useAuction';
import { useSellerListings } from '../lib/useListings';
import { shelfBridgeErrorText, useShelfBridge } from '../lib/useShelfBridge';
import { radius, space, ui } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Wessen Regal — immer das eigene. */
  sellerId: string | null | undefined;
  /**
   * Genau EINES von beiden. Die RPC lehnt beides und keines ab
   * (`target_required`); hier steht es im Typ, damit es gar nicht erst
   * vorkommt.
   */
  target: { sessionId: string } | { planId: string };
  /** Für den Kopf: „in deine Sendung" oder „für Samstag 20:00". */
  targetLabel: string;
};

export function ShelfPickSheet({ visible, onClose, sellerId, target, targetLabel }: Props) {
  const insets = useSafeAreaInsets();
  const { data: listings, isLoading } = useSellerListings(sellerId ?? undefined);
  const { toShow } = useShelfBridge();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const move = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setNotice(null);
    try {
      await toShow.mutateAsync({
        id,
        sessionId: 'sessionId' in target ? target.sessionId : undefined,
        planId: 'planId' in target ? target.planId : undefined,
      });
    } catch (e) {
      setNotice(shelfBridgeErrorText(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom || space.md }]}>
          <View style={s.grabber} />
          <View style={s.head}>
            <View style={s.headText}>
              <Text style={s.title}>Aus dem Regal holen</Text>
              <Text style={s.sub}>{targetLabel}</Text>
            </View>
            {/* „Fertig" statt ✕ — aus demselben Grund wie im Vorbereiten-Blatt:
                Jeder Tipp auf eine Zeile hat den Artikel bereits verschoben.
                Ein ✕ würde behaupten, man könne das hier noch verwerfen. */}
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fertig">
              <Text style={s.done}>Fertig</Text>
            </Pressable>
          </View>

          {notice ? (
            <Pressable style={s.notice} onPress={() => setNotice(null)}>
              <Text style={s.noticeText}>{notice}</Text>
            </Pressable>
          ) : null}

          {isLoading ? (
            <View style={s.center}>
              <ActivityIndicator color={ui.textMuted} />
            </View>
          ) : !listings || listings.length === 0 ? (
            <View style={s.center}>
              <Package size={26} color={ui.textMuted} />
              {/* Warm und handlungsleitend statt „Keine Artikel" — dieselbe
                  Regel wie überall sonst (Design-Gesetz 2). */}
              <Text style={s.emptyTitle}>Dein Regal ist noch leer</Text>
              <Text style={s.emptyText}>
                Alles, was du dauerhaft anbietest, kannst du hier mit einem Tipp in die Sendung
                holen.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: space.lg }}>
              {listings.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => void move(item.id)}
                  disabled={!!busyId}
                  style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} in die Sendung holen`}
                >
                  <View style={s.thumb}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} />
                    ) : null}
                  </View>
                  <View style={s.rowText}>
                    <Text numberOfLines={1} style={s.rowTitle}>
                      {item.title}
                    </Text>
                    {/* Der Festpreis wird in der Show zum Sofortkauf, gestartet
                        wird bei 1 €. Das hier zu sagen nimmt die Angst, mit dem
                        Umzug einen Preis zu verlieren. */}
                    <Text style={s.rowMeta}>
                      startet bei 1 € · sofort {formatEuro(item.buy_now_cents)}
                    </Text>
                  </View>
                  {busyId === item.id ? (
                    <ActivityIndicator color={ui.textMuted} />
                  ) : (
                    <Text style={s.rowAction}>Holen</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: ui.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    maxHeight: '76%',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: ui.line,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  headText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '700', color: ui.text },
  sub: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
  done: { fontSize: 16, fontWeight: '600', color: ui.brand },

  notice: {
    backgroundColor: ui.sunken,
    borderRadius: radius.sm,
    padding: space.sm,
    marginBottom: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text },

  center: { alignItems: 'center', gap: 6, paddingVertical: space.xl },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: ui.text, marginTop: space.xs },
  emptyText: { fontSize: 13, color: ui.textMuted, textAlign: 'center', paddingHorizontal: space.lg },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  rowPressed: { opacity: 0.6 },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: ui.sunken, overflow: 'hidden' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: ui.text },
  rowMeta: { fontSize: 11, color: ui.textMuted, marginTop: 1 },
  rowAction: { fontSize: 13, fontWeight: '700', color: ui.brand },
});
