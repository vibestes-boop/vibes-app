// „Jetzt kaufbar" — der Laden eines Verkäufers zwischen den Shows.
//
// Steht bewusst ÜBER „Zuletzt verkauft": Das eine ist Ware, das andere ein
// Beleg. Wer auf ein Profil kommt, während niemand sendet, soll etwas tun
// können und nicht nur Vergangenheit lesen.
//
// Der Kauf landet im selben Sammelkorb wie ein Zuschlag aus der Show. Deshalb
// steht unter dem Knopf auch derselbe Satz — wer heute Abend noch etwas
// ersteigert, zahlt trotzdem nur einmal Versand.

import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock, ShoppingBag } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { formatEuro } from '../lib/useAuction';
import type { StandingListing } from '../lib/useStanding';

type Props = {
  listings: StandingListing[];
  /** Der Betrachter ist der Verkäufer — dann Zurückziehen statt Kaufen. */
  isOwner: boolean;
  signedIn: boolean;
  busyId: string | null;
  onBuy: (listing: StandingListing) => void;
  onCancel: (listing: StandingListing) => void;
};

export function StandingShelf({
  listings,
  isOwner,
  signedIn,
  busyId,
  onBuy,
  onCancel,
}: Props) {
  if (listings.length === 0) return null;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <ShoppingBag size={16} color={ui.text} />
        <Text style={s.title}>Jetzt kaufbar</Text>
        <Text style={s.count}>{listings.length}</Text>
      </View>

      {listings.map((item) => {
        const busy = busyId === item.id;
        return (
          <View key={item.id} style={s.row}>
            <View style={s.thumb}>
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={120}
                />
              ) : null}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.titleRow}>
                <Text numberOfLines={2} style={s.itemTitle}>
                  {item.title}
                </Text>
                {item.women_only ? <Lock size={12} color={ui.success} /> : null}
              </View>
              <Text style={s.price}>{formatEuro(item.buy_now_cents)}</Text>
            </View>

            {isOwner ? (
              <Pressable
                style={s.ghost}
                disabled={busy}
                onPress={() => onCancel(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} zurückziehen`}
              >
                {busy ? (
                  <ActivityIndicator color={ui.textMuted} />
                ) : (
                  <Text style={s.ghostText}>Zurückziehen</Text>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[s.buy, (busy || !signedIn) && s.buyOff]}
                disabled={busy || !signedIn}
                onPress={() => onBuy(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} für ${formatEuro(item.buy_now_cents)} kaufen`}
              >
                {busy ? (
                  <ActivityIndicator color={ui.goldInk} />
                ) : (
                  <Text style={s.buyText}>Kaufen</Text>
                )}
              </Pressable>
            )}
          </View>
        );
      })}

      {/* Derselbe Satz wie im Live-Raum, und er stimmt aus demselben Grund:
          Ein Kauf hier landet im gleichen Paket wie ein Zuschlag heute Abend. */}
      <Text style={s.hint}>
        {isOwner
          ? 'Diese Artikel bleiben kaufbar, auch wenn du nicht sendest.'
          : 'Kommt in dasselbe Paket wie deine Zuschläge — du zahlst nur einmal Versand.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.lg,
    marginTop: space.md,
    gap: space.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: ui.text },
  count: { fontSize: 12, fontWeight: '700', color: ui.textMuted },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitle: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: ui.text },
  price: { fontSize: 15, fontWeight: '700', color: ui.text, marginTop: 2 },

  buy: {
    minWidth: 84,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyOff: { opacity: 0.45 },
  buyText: { fontSize: 14, fontWeight: '700', color: ui.goldInk },

  ghost: {
    minWidth: 84,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { fontSize: 12, fontWeight: '600', color: ui.textMuted },

  hint: { fontSize: 11, color: ui.textMuted, marginTop: space.xs, lineHeight: 16 },
});
