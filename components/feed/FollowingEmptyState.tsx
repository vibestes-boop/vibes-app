/**
 * FollowingEmptyState
 *
 * Angezeigt wenn "Folge ich"-Feed leer ist.
 * Zeigt User-Empfehlungen mit Follow-Buttons direkt — 
 * sodass der User ohne Tab-Wechsel jemanden folgen kann.
 */
import { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { UserPlus, Users, Compass, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useDiscoverPeople, type DiscoverUser } from '@/lib/useDiscoverPeople';
import { useFollow } from '@/lib/useFollow';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/lib/useTheme';

// ── Einzelne User-Karte ───────────────────────────────────────────────────────
function SuggestedUserCard({ user }: { user: DiscoverUser }) {
  const router = useRouter();
  const { colors } = useTheme();
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
    <View style={[card.wrap, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}>
      {/* Avatar */}
      <Pressable
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
        style={card.avatar}
      >
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, card.avatarFallback, { backgroundColor: colors.bg.subtle }]}>
            <Text style={[card.avatarInitials, { color: colors.text.secondary }]}>{initials}</Text>
          </View>
        )}
      </Pressable>

      {/* Info */}
      <Pressable
        style={card.info}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
      >
        <Text style={[card.username, { color: colors.text.primary }]} numberOfLines={1}>
          @{user.username}
        </Text>
        <View style={[card.reasonPill, { backgroundColor: colors.bg.subtle }]}>
          <Text style={[card.reasonText, { color: colors.text.muted }]}>
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
            ? { backgroundColor: colors.bg.subtle, borderWidth: 1, borderColor: colors.border.strong }
            : { backgroundColor: colors.text.primary },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isFollowing ? colors.text.primary : colors.bg.primary} />
        ) : isFollowing ? (
          <>
            <CheckCircle2 size={12} color={colors.text.secondary} strokeWidth={2.5} />
            <Text style={[card.followBtnText, { color: colors.text.secondary, fontSize: 11 }]}>Folgst du</Text>
          </>
        ) : (
          <>
            <UserPlus size={12} color={colors.bg.primary} strokeWidth={2.5} />
            <Text style={[card.followBtnText, { color: colors.bg.primary }]}>Folgen</Text>
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
  const { colors } = useTheme();
  const { data: suggestions = [], isLoading } = useDiscoverPeople();

  return (
    <View style={[s.root, { backgroundColor: 'transparent' }]}>
      {/* ── Illustration + Title ─── */}
      <View style={s.hero}>
        <View style={[s.iconRing, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}>
          <Users size={32} color={colors.icon.default} strokeWidth={1.5} />
        </View>
        <Text style={[s.title, { color: colors.text.primary }]}>Folge interessanten Leuten</Text>
        <Text style={[s.sub, { color: colors.text.muted }]}>
          Ihre neuesten Posts erscheinen{'\n'}hier chronologisch — kein Algorithmus.
        </Text>
      </View>

      {/* ── User-Empfehlungen ─────── */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: colors.text.muted }]}>
          Empfehlungen für dich
        </Text>

        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={colors.icon.muted} />
          </View>
        ) : suggestions.length === 0 ? (
          <Text style={[s.noSuggestions, { color: colors.text.muted }]}>
            Keine Empfehlungen verfügbar — schau im Explore-Tab vorbei.
          </Text>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 340 }}
            contentContainerStyle={{ gap: 8 }}
          >
            {suggestions.slice(0, 6).map((u) => (
              <SuggestedUserCard key={u.id} user={u} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Explore CTA ──────────── */}
      <Pressable
        onPress={onExplore}
        style={[s.exploreBtn, { borderColor: colors.border.strong }]}
      >
        <Compass size={16} color={colors.text.secondary} strokeWidth={2} />
        <Text style={[s.exploreBtnText, { color: colors.text.secondary }]}>Mehr im Explore-Tab entdecken</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
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
