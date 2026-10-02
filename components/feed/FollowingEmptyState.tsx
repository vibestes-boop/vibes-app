import { GlassSurface } from '@/components/ui/GlassSurface';
import { useI18n } from '@/lib/i18n';
/** Empty following feed: profile suggestions use the selected app theme. */
import { useTheme } from '@/lib/useTheme';
import { useDiscoverPeople,type DiscoverUser } from '@/lib/useDiscoverPeople';
import { useFollow } from '@/lib/useFollow';
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

// ── Einzelne User-Karte ───────────────────────────────────────────────────────
function SuggestedUserCard({ user }: { user: DiscoverUser }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const router = useRouter();
  const { isFollowing, toggle, isLoading } = useFollow(user.id);

  const initials = user.username.slice(0, 2).toUpperCase();

  const handleFollow = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle();
  }, [toggle]);

  const reasonLabel: Record<DiscoverUser['reason'], string> = {
    guild:     t('nativeUi.sameGroup'),
    interests: t('nativeUi.sameInterests'),
    new:       t('nativeUi.newHere'),
  };

  return (
    <GlassSurface material="solid" radius={24} style={card.wrap}>
      {/* Avatar */}
      <Pressable
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
        style={card.avatar}
      >
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, card.avatarFallback, { backgroundColor: colors.bg.input }]}>
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
        <View style={[card.reasonPill, { backgroundColor: colors.bg.input }]}>
          <Text style={[card.reasonText, { color: colors.text.muted }]}>
            {reasonLabel[user.reason]}
          </Text>
        </View>
      </Pressable>

      {/* Follow Button */}
      <Pressable
        onPress={handleFollow}
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoading, busy: isLoading }}
        disabled={isLoading}
        style={[
          card.followBtn,
          isFollowing
            ? { backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.strong }
            : { backgroundColor: colors.accent.solid },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isFollowing ? colors.text.primary : colors.text.onAccent} />
        ) : isFollowing ? (
          <>
            <CheckCircle2 size={12} color={colors.text.secondary} strokeWidth={2.5} />
            <Text style={[card.followBtnText, { color: colors.text.secondary, fontSize: 11 }]}>{t('explore.following')}</Text>
          </>
        ) : (
          <>
            <UserPlus size={12} color={colors.text.onAccent} strokeWidth={2.5} />
            <Text style={[card.followBtnText, { color: colors.text.onAccent }]}>{t('explore.follow')}</Text>
          </>
        )}
      </Pressable>
    </GlassSurface>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
interface Props {
  onExplore: () => void;
}

export function FollowingEmptyState({ onExplore }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const { data: suggestions = [], isLoading } = useDiscoverPeople();

  return (
    // The parent scroll viewport begins below the fixed feed header.
    <View style={s.root}>
      {/* ── Illustration + Title ─── */}
      <View style={s.hero}>
        <GlassSurface radius={24} style={s.iconRing}>
          <Users size={32} color={colors.accent.primary} strokeWidth={1.5} />
        </GlassSurface>
        <Text style={[s.title, { color: colors.text.primary }]}>{t('inbox.followTitle')}</Text>
        <Text style={[s.sub, { color: colors.text.muted }]}>
          {t('inbox.followBody')}
        </Text>
      </View>

      {/* ── User-Empfehlungen ─────── */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: colors.text.muted }]}>
          {t('nativeUi.people')}
        </Text>

        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={colors.text.muted} />
          </View>
        ) : suggestions.length === 0 ? (
          <Text style={[s.noSuggestions, { color: colors.text.muted }]}>
            {t('inbox.followEmpty')}
          </Text>
        ) : (
          // Karten fließen inline — der äußere ScrollView (Feed) scrollt; keine
          // innere maxHeight-Begrenzung mehr (vorher nur ~2 User sichtbar).
          <View style={{ gap: 12 }}>
            {suggestions.slice(0, 6).map((u) => (
              <SuggestedUserCard key={u.id} user={u} />
            ))}
          </View>
        )}
      </View>

      {/* ── Explore CTA ──────────── */}
      <Pressable
        accessibilityRole="button"
        onPress={onExplore}
        style={[s.exploreBtn, { borderColor: colors.border.strong }]}
      >
        <Compass size={16} color={colors.text.secondary} strokeWidth={2} />
        <Text style={[s.exploreBtnText, { color: colors.text.secondary }]}>{t('tabs.explore')}</Text>
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
    width: 64, height: 64, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24, fontWeight: '600', letterSpacing: -0.7, textAlign: 'center',
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
    minHeight: 44, borderWidth: 1, marginTop: 16,
  },
  exploreBtnText: { fontSize: 14, fontWeight: '600' },
});

const card = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 24,
    gap: 10,
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
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    minHeight: 44, minWidth: 88, justifyContent: 'center',
  },
  followBtnText: { fontSize: 12, fontWeight: '700' },
});
