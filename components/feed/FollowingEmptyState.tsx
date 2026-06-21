/**
 * FollowingEmptyState
 *
 * Angezeigt wenn "Folge ich"-Feed leer ist.
 * Zeigt User-Empfehlungen mit Follow-Buttons direkt —
 * sodass der User ohne Tab-Wechsel jemanden folgen kann.
 *
 * ⚠️ Der Feed-Hintergrund ist IMMER schwarz (#000, TikTok-Stil — siehe
 * feedStyles.container) unabhängig vom App-Theme. Darum nutzt dieser
 * Empty-State eine FESTE Hell-auf-Dunkel-Palette (FEED) statt useTheme():
 * im Light Mode war der Titel sonst dunkel auf Schwarz → unlesbar, und der
 * Explore-Button verschwand komplett. Werte spiegeln die Feed-Overlay-
 * Konvention (#FFFFFF / rgba(255,255,255,…)).
 */
import { useDiscoverPeople,type DiscoverUser } from '@/lib/useDiscoverPeople';
import { useFollow } from '@/lib/useFollow';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CheckCircle2,Compass,UserPlus,Users } from 'lucide-react-native';
import { useCallback } from 'react';
import {
ActivityIndicator,
Pressable,
StyleSheet,
Text,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Feste Palette für den immer-schwarzen Feed-Hintergrund (theme-unabhängig).
const FEED = {
  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.75)',
  textMuted:     'rgba(255,255,255,0.55)',
  surface:       'rgba(255,255,255,0.08)',
  surfaceStrong: 'rgba(255,255,255,0.14)',
  border:        'rgba(255,255,255,0.12)',
  borderStrong:  'rgba(255,255,255,0.22)',
  ctaBg:         '#FFFFFF',
  ctaText:       '#0A0A0A',
  icon:          'rgba(255,255,255,0.85)',
} as const;

// ── Einzelne User-Karte ───────────────────────────────────────────────────────
function SuggestedUserCard({ user }: { user: DiscoverUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isFollowing, toggle, isLoading } = useFollow(user.id);

  const initials = user.username.slice(0, 2).toUpperCase();

  const handleFollow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle();
    // Nach Folgen den Feed refreshen
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['following-feed'] });
    }, 800);
  }, [toggle, queryClient]);

  const reasonLabel: Record<DiscoverUser['reason'], string> = {
    guild:     'Gleiche Guild',
    interests: 'Ähnliche Interessen',
    new:       'Neu bei Vibes',
  };

  return (
    <View style={[card.wrap, { backgroundColor: FEED.surface, borderColor: FEED.border }]}>
      {/* Avatar */}
      <Pressable
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
        style={card.avatar}
      >
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, card.avatarFallback, { backgroundColor: FEED.surfaceStrong }]}>
            <Text style={[card.avatarInitials, { color: FEED.textSecondary }]}>{initials}</Text>
          </View>
        )}
      </Pressable>

      {/* Info */}
      <Pressable
        style={card.info}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
      >
        <Text style={[card.username, { color: FEED.textPrimary }]} numberOfLines={1}>
          @{user.username}
        </Text>
        <View style={[card.reasonPill, { backgroundColor: FEED.surfaceStrong }]}>
          <Text style={[card.reasonText, { color: FEED.textMuted }]}>
            {reasonLabel[user.reason]}
          </Text>
        </View>
      </Pressable>

      {/* Follow Button */}
      <Pressable
        onPress={handleFollow}
        disabled={isLoading}
        style={[
          card.followBtn,
          isFollowing
            ? { backgroundColor: FEED.surfaceStrong, borderWidth: 1, borderColor: FEED.borderStrong }
            : { backgroundColor: FEED.ctaBg },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isFollowing ? FEED.textPrimary : FEED.ctaText} />
        ) : isFollowing ? (
          <>
            <CheckCircle2 size={12} color={FEED.textSecondary} strokeWidth={2.5} />
            <Text style={[card.followBtnText, { color: FEED.textSecondary, fontSize: 11 }]}>Folgst du</Text>
          </>
        ) : (
          <>
            <UserPlus size={12} color={FEED.ctaText} strokeWidth={2.5} />
            <Text style={[card.followBtnText, { color: FEED.ctaText }]}>Folgen</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
interface Props {
  onExplore: () => void;
}

export function FollowingEmptyState({ onExplore }: Props) {
  const { data: suggestions = [], isLoading } = useDiscoverPeople();
  const insets = useSafeAreaInsets();

  return (
    // paddingTop räumt unter die absolute Feed-Kopfleiste (Toggle bei insets.top, 52px hoch)
    <View style={[s.root, { backgroundColor: 'transparent', paddingTop: insets.top + 64 }]}>
      {/* ── Illustration + Title ─── */}
      <View style={s.hero}>
        <View style={[s.iconRing, { backgroundColor: FEED.surface, borderColor: FEED.border }]}>
          <Users size={32} color={FEED.icon} strokeWidth={1.5} />
        </View>
        <Text style={[s.title, { color: FEED.textPrimary }]}>Folge interessanten Leuten</Text>
        <Text style={[s.sub, { color: FEED.textMuted }]}>
          Ihre neuesten Posts erscheinen{'\n'}hier chronologisch — kein Algorithmus.
        </Text>
      </View>

      {/* ── User-Empfehlungen ─────── */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: FEED.textMuted }]}>
          Empfehlungen für dich
        </Text>

        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={FEED.textMuted} />
          </View>
        ) : suggestions.length === 0 ? (
          <Text style={[s.noSuggestions, { color: FEED.textMuted }]}>
            Keine Empfehlungen verfügbar — schau im Explore-Tab vorbei.
          </Text>
        ) : (
          // Karten fließen inline — der äußere ScrollView (Feed) scrollt; keine
          // innere maxHeight-Begrenzung mehr (vorher nur ~2 User sichtbar).
          <View style={{ gap: 8 }}>
            {suggestions.slice(0, 6).map((u) => (
              <SuggestedUserCard key={u.id} user={u} />
            ))}
          </View>
        )}
      </View>

      {/* ── Explore CTA ──────────── */}
      <Pressable
        onPress={onExplore}
        style={[s.exploreBtn, { borderColor: FEED.borderStrong }]}
      >
        <Compass size={16} color={FEED.textSecondary} strokeWidth={2} />
        <Text style={[s.exploreBtnText, { color: FEED.textSecondary }]}>Mehr im Explore-Tab entdecken</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  iconRing: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 20, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center',
  },
  sub: {
    fontSize: 14, lineHeight: 20, textAlign: 'center',
  },
  section: { gap: 12 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase',
  },
  loadingWrap: { paddingVertical: 24, alignItems: 'center' },
  noSuggestions: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  exploreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, marginTop: 16,
  },
  exploreBtnText: { fontSize: 14, fontWeight: '600' },
});

const card = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14,
    borderWidth: 1, gap: 10,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
  },
  avatarFallback: {
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 16, fontWeight: '700' },
  info: { flex: 1, gap: 4 },
  username: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  reasonPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  reasonText: { fontSize: 11, fontWeight: '500' },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    minWidth: 80, justifyContent: 'center',
  },
  followBtnText: { fontSize: 12, fontWeight: '700' },
});
