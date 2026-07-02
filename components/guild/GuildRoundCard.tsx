import { RollupNumber } from '@/components/ui/RollupNumber';
import { useTheme } from '@/lib/useTheme';
import type { ActivePreorderRound } from '@/lib/useShop';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CheckCircle2, ChevronRight, ShoppingBag } from 'lucide-react-native';
import { StyleSheet, Text, View, Pressable } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Guild-Commerce (#3): „Jetzt aktiv"-Karte für die offene Sammelbestellungs-
// Runde. Der Grund, heute in die Guild zu schauen — Fortschritt (RollupNumber,
// Design-Gesetz #1), Mitbesteller (Social Proof) und ehrliche Deadline (Zaurs
// realer Bestell-Samstag, kein Fake-FOMO).
//
// Tap → Produktseite; der Kauf-Flow bleibt komplett dort (Buy-Bar).
// ─────────────────────────────────────────────────────────────────────────────

/** „bis Sa., 05.07." — kompakte deutsche Deadline. Vergangen → „endet gleich". */
function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (d.getTime() <= Date.now()) return 'endet gleich';
  return `bis ${d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}`;
}

export function GuildRoundCard({ round }: { round: ActivePreorderRound }) {
  const { colors } = useTheme();
  const router = useRouter();

  const progress = Math.min(1, round.target_qty > 0 ? round.reserved_qty / round.target_qty : 0);
  const goalReached = round.reserved_qty >= round.target_qty;
  const others = Math.max(0, round.participant_count - 1);
  const firstName = round.participants[0]?.username;

  // Social-Proof-Zeile: „@ahmed + 11 sind dabei" / „3 sind dabei" / Einladung
  const proofLabel = round.participant_count === 0
    ? 'Sei die/der Erste 🌸'
    : firstName
      ? `@${firstName}${others > 0 ? ` + ${others}` : ''} ${round.participant_count === 1 ? 'ist' : 'sind'} dabei`
      : `${round.participant_count} sind dabei`;

  return (
    <Pressable
      onPress={() => {
        impactAsync(ImpactFeedbackStyle.Light);
        router.push({ pathname: '/shop/[id]', params: { id: round.product_id } });
      }}
      style={[s.card, { backgroundColor: colors.bg.secondary, borderColor: goalReached ? 'rgba(251,191,36,0.5)' : colors.border.default }]}
      accessibilityRole="button"
      accessibilityLabel={`Sammelbestellung: ${round.title}, ${round.reserved_qty} von ${round.target_qty}`}
    >
      {/* Kopf: Cover + Titel + Deadline */}
      <View style={s.topRow}>
        {round.product?.cover_url ? (
          <Image source={{ uri: round.product.cover_url }} style={s.thumb} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View style={[s.thumb, s.thumbFallback, { backgroundColor: colors.bg.elevated }]}>
            <ShoppingBag size={16} color={colors.text.muted} strokeWidth={2} />
          </View>
        )}
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[s.title, { color: colors.text.primary }]} numberOfLines={1}>{round.title}</Text>
          <Text style={[s.deadline, { color: colors.text.muted }]}>
            {goalReached ? 'Ziel erreicht 🎉' : `Sammelbestellung · ${formatDeadline(round.closes_at)}`}
          </Text>
        </View>
        <ChevronRight size={16} color={colors.icon.muted} strokeWidth={2.2} />
      </View>

      {/* Fortschritt: Balken + Rollup-Zähler */}
      <View style={s.progressRow}>
        <View style={[s.track, { backgroundColor: colors.bg.subtle }]}>
          <View
            style={[
              s.fill,
              { width: `${Math.max(progress * 100, round.reserved_qty > 0 ? 4 : 0)}%` },
              { backgroundColor: goalReached ? '#FBBF24' : colors.accent.secondary },
            ]}
          />
        </View>
        <View style={s.countWrap}>
          <RollupNumber value={round.reserved_qty} style={[s.count, { color: colors.text.primary }]} />
          <Text style={[s.countTotal, { color: colors.text.muted }]}> / {round.target_qty}</Text>
        </View>
      </View>

      {/* Fuß: Mitbesteller-Avatare + CTA */}
      <View style={s.bottomRow}>
        <View style={s.proofWrap}>
          {round.participants.slice(0, 3).map((p, i) =>
            p.avatar_url ? (
              <Image
                key={`${p.username ?? i}`}
                source={{ uri: p.avatar_url }}
                style={[s.avatar, { marginLeft: i === 0 ? 0 : -8, borderColor: colors.bg.secondary }]}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                key={`${p.username ?? i}`}
                style={[s.avatar, s.avatarFallback, { marginLeft: i === 0 ? 0 : -8, borderColor: colors.bg.secondary, backgroundColor: colors.bg.elevated }]}
              >
                <Text style={[s.avatarInitial, { color: colors.text.muted }]}>
                  {(p.username?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            ),
          )}
          <Text style={[s.proofText, { color: colors.text.muted }]} numberOfLines={1}>{proofLabel}</Text>
        </View>

        {round.me_joined ? (
          <View style={[s.cta, s.ctaJoined]}>
            <CheckCircle2 size={13} color="#22C55E" strokeWidth={2.6} />
            <Text style={[s.ctaText, { color: '#22C55E' }]}>Dabei</Text>
          </View>
        ) : (
          <View style={[s.cta, { backgroundColor: colors.text.primary }]}>
            <Text style={[s.ctaText, { color: colors.bg.primary }]}>Mitbestellen</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  deadline: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  countWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  count: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  countTotal: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  proofWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 10,
    fontWeight: '700',
  },
  proofText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  ctaJoined: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  ctaText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
