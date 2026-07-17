/**
 * app/women-only/index.tsx — Women-Only Zone Hub
 *
 * Drei Zustände:
 *   1. Nicht verifiziert → ruhiger Gate-Screen mit „Zugang beantragen"
 *   2. Antrag pending    → Wartehinweis (Freigabe durch Admin)
 *   3. Verifiziert       → WOZ-Feed mit allen Women-Only Posts
 *
 * Design-Sprache: Theme-Flächen, EIN Akzent (colors.accent.rose, sparsam),
 * monochrome Lucide-Icons — keine Gradients, keine Emoji-Icons.
 */

import { WomenOnlyVerificationSheet } from '@/components/women-only/WomenOnlyVerificationSheet';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/useTheme';
import { useWomenOnly } from '@/lib/useWomenOnly';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Clock,
  Flower2,
  Lock,
  Radio,
  ShieldCheck,
  ShoppingBag,
  Users,
  Video,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48) / 2;

// ─── WOZ-Posts Hook ───────────────────────────────────────────────────────────

type WOZPost = {
  id: string;
  media_url: string | null;
  media_type: string;
  caption: string | null;
  author_id: string;
  profiles: { username: string; avatar_url: string | null } | null;
  created_at: string;
};

function useWOZFeed() {
  return useQuery<WOZPost[]>({
    queryKey: ['woz-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, media_url, media_type, caption, author_id, created_at, profiles(username, avatar_url)')
        .eq('women_only', true)
        .not('media_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as WOZPost[];
    },
    staleTime: 1000 * 60 * 3,
  });
}

// ─── Haupt-Screen ─────────────────────────────────────────────────────────────

export default function WomenOnlyScreen() {
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { canAccessWomenOnly, status, refreshStatus } = useWomenOnly();
  const [showVerifySheet, setShowVerifySheet] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header — ruhige Theme-Bar wie überall in der App */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            backgroundColor: colors.bg.primary,
            borderBottomColor: colors.border.subtle,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={16}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Flower2 size={17} color={colors.accent.rose} strokeWidth={2} />
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>{t('woz.title')}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {canAccessWomenOnly ? (
        <VerifiedContent colors={colors} insets={insets} />
      ) : (
        <GateContent
          pending={status === 'pending'}
          onJoin={() => setShowVerifySheet(true)}
        />
      )}

      <WomenOnlyVerificationSheet
        visible={showVerifySheet}
        onClose={() => {
          setShowVerifySheet(false);
          // Antrags-Status im Hub nachziehen (eigene Hook-Instanz)
          void refreshStatus();
        }}
      />
    </View>
  );
}

// ─── Inhalts-Ansicht für verifizierte Nutzerinnen ─────────────────────────────

function VerifiedContent({ colors, insets }: { colors: any; insets: any }) {
  const router = useRouter();
  const { t } = useI18n();
  const { data: posts = [], isLoading, refetch, isRefetching } = useWOZFeed();

  const renderPost = useCallback(({ item }: { item: WOZPost }) => (
    <Pressable
      style={[styles.card, { backgroundColor: colors.bg.elevated }]}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } } as any)}
      accessibilityRole="button"
      accessibilityLabel={item.caption ?? 'Women-Only Post'}
    >
      {item.media_url && (
        <Image
          source={{ uri: item.media_url }}
          style={styles.cardImage}
          contentFit="cover"
        />
      )}
      {/* Lesbarkeits-Scrim unten (Medien-Fläche = fest hell-auf-dunkel) */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.cardGradient}
      />
      {item.media_type === 'video' && (
        <View style={styles.videoIcon}>
          <Video size={12} color="#fff" fill="#fff" strokeWidth={0} />
        </View>
      )}
      <View style={styles.cardAuthor}>
        {item.profiles?.avatar_url ? (
          <Image
            source={{ uri: item.profiles.avatar_url }}
            style={styles.cardAvatar}
            contentFit="cover"
          />
        ) : null}
        <Text style={styles.cardUsername} numberOfLines={1}>
          @{item.profiles?.username ?? '…'}
        </Text>
      </View>
    </Pressable>
  ), [router, colors]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text.muted} size="large" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        {/* Schutz-Banner auch im Leerzustand — zeigt: du BIST in der Zone */}
        <View
          style={[
            styles.verifiedBanner,
            { backgroundColor: `${colors.accent.rose}14`, borderColor: `${colors.accent.rose}33` },
          ]}
        >
          <ShieldCheck size={16} color={colors.accent.rose} strokeWidth={2} />
          <Text style={[styles.verifiedBannerText, { color: colors.accent.rose }]}>
            {t('woz.verifiedBadge')}
          </Text>
        </View>

        <View style={styles.center}>
          <Flower2 size={34} color={colors.accent.rose} strokeWidth={1.6} style={{ marginBottom: 14 }} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>{t('woz.emptyTitle')}</Text>
          <Text style={[styles.emptySub, { color: colors.text.muted }]}>{t('woz.emptySub')}</Text>
          <Pressable
            onPress={() => router.push('/create/camera' as any)}
            style={[styles.emptyCta, { backgroundColor: colors.text.primary }]}
            accessibilityRole="button"
          >
            <Text style={[styles.emptyCtaText, { color: colors.bg.primary }]}>{t('woz.emptyCta')}</Text>
          </Pressable>
          <Text style={[styles.emptyHint, { color: colors.text.muted }]}>{t('woz.emptyHint')}</Text>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      numColumns={2}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 0 }}
      columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
      renderItem={renderPost}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.text.muted}
        />
      }
      ListHeaderComponent={() => (
        <View
          style={[
            styles.verifiedBanner,
            { backgroundColor: `${colors.accent.rose}14`, borderColor: `${colors.accent.rose}33` },
          ]}
        >
          <ShieldCheck size={16} color={colors.accent.rose} strokeWidth={2} />
          <Text style={[styles.verifiedBannerText, { color: colors.accent.rose }]}>
            {t('woz.verifiedBadge')}
          </Text>
        </View>
      )}
    />
  );
}

// ─── Gate-Screen (nicht verifiziert / Antrag pending) ────────────────────────

function GateContent({ pending, onJoin }: { pending: boolean; onJoin: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const FEATURES = [
    { Icon: Lock, text: t('woz.featPrivacy') },
    { Icon: Radio, text: t('woz.featShare') },
    { Icon: Users, text: t('woz.featFeed') },
    { Icon: ShoppingBag, text: t('woz.featShop') },
  ];

  return (
    <View style={styles.gateRoot}>
      {/* Hero — ein einziges Rose-Moment, sonst Ruhe */}
      <View style={styles.gateHero}>
        <View style={[styles.gateIconCircle, { backgroundColor: `${colors.accent.rose}14` }]}>
          <Flower2 size={30} color={colors.accent.rose} strokeWidth={1.8} />
        </View>
        <Text style={[styles.gateTitle, { color: colors.text.primary }]}>{t('woz.gateTitle')}</Text>
        <Text style={[styles.gateSub, { color: colors.text.secondary }]}>{t('woz.gateSub')}</Text>
      </View>

      {/* Features — monochrome Icons, Theme-Text */}
      <View style={styles.featureList}>
        {FEATURES.map(({ Icon, text }) => (
          <View key={text} style={styles.featureRow}>
            <View style={[styles.featureIconWrap, { backgroundColor: colors.bg.secondary }]}>
              <Icon size={16} color={colors.text.primary} strokeWidth={2} />
            </View>
            <Text style={[styles.featureText, { color: colors.text.secondary }]}>{text}</Text>
          </View>
        ))}
      </View>

      {/* Prüf-Hinweis */}
      <View
        style={[
          styles.infoBox,
          { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle },
        ]}
      >
        <Lock size={14} color={colors.text.muted} strokeWidth={2} />
        <Text style={[styles.infoText, { color: colors.text.muted }]}>{t('woz.reviewNote')}</Text>
      </View>

      {/* CTA bzw. Pending-Hinweis */}
      {pending ? (
        <View
          style={[
            styles.pendingBox,
            { backgroundColor: `${colors.accent.rose}14`, borderColor: `${colors.accent.rose}33` },
          ]}
        >
          <Clock size={16} color={colors.accent.rose} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.pendingTitle, { color: colors.accent.rose }]}>{t('woz.pendingTitle')}</Text>
            <Text style={[styles.pendingSub, { color: colors.text.secondary }]}>{t('woz.pendingSub')}</Text>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={onJoin}
          style={[styles.joinBtn, { backgroundColor: colors.text.primary }]}
          accessibilityRole="button"
        >
          <Text style={[styles.joinBtnText, { color: colors.bg.primary }]}>{t('woz.join')}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.3 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  emptyTitle: { fontSize: 19, fontWeight: '600', marginBottom: 8 },
  emptyCta: {
    marginTop: 20, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 28,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  emptyHint: { fontSize: 12, marginTop: 12, textAlign: 'center', lineHeight: 17 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Grid Cards
  card: {
    width: CARD_W, height: CARD_W * 1.35,
    borderRadius: 14, overflow: 'hidden',
    position: 'relative',
  },
  cardImage: { ...StyleSheet.absoluteFillObject },
  cardGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
  },
  videoIcon: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6, padding: 4,
  },
  cardAuthor: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  cardAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  cardUsername: { color: '#fff', fontSize: 10, fontWeight: '600', maxWidth: CARD_W - 48 },

  verifiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16,
  },
  verifiedBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },

  // Gate
  gateRoot: { flex: 1, padding: 24 },
  gateHero: { alignItems: 'center', paddingVertical: 28, marginBottom: 20 },
  gateIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  gateTitle: {
    fontSize: 26, fontWeight: '700', letterSpacing: -0.5,
    textAlign: 'center', marginBottom: 8,
  },
  gateSub: { fontSize: 14, textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },

  featureList: { gap: 12, marginBottom: 22 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { flex: 1, fontSize: 14, lineHeight: 20 },

  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    borderRadius: 12, borderWidth: 1,
    padding: 14, marginBottom: 22,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },

  pendingBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  pendingTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  pendingSub: { fontSize: 13, lineHeight: 19 },

  joinBtn: {
    borderRadius: 16, paddingVertical: 16, alignItems: 'center',
  },
  joinBtnText: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
});
