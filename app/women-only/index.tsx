/**
 * app/women-only/index.tsx — Women-Only Zone Hub
 *
 * Zwei Zustände:
 *   1. Nicht verifiziert → Premium Onboarding-Screen mit "Beitreten"
 *   2. Verifiziert → WOZ-Feed mit allen Women-Only Posts
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Lock, ShieldCheck, Video } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useWomenOnly } from '@/lib/useWomenOnly';
import { useTheme } from '@/lib/useTheme';
import { WomenOnlyVerificationSheet } from '@/components/women-only/WomenOnlyVerificationSheet';

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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { canAccessWomenOnly } = useWomenOnly();
  const [showVerifySheet, setShowVerifySheet] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <LinearGradient
        colors={['#F43F5E', '#A855F7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={16}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>🌸</Text>
          <Text style={styles.headerTitle}>Women-Only Zone</Text>
        </View>
        <View style={{ width: 38 }} />
      </LinearGradient>

      {canAccessWomenOnly ? (
        <VerifiedContent colors={colors} insets={insets} />
      ) : (
        <GateContent onJoin={() => setShowVerifySheet(true)} />
      )}

      <WomenOnlyVerificationSheet
        visible={showVerifySheet}
        onClose={() => setShowVerifySheet(false)}
      />
    </View>
  );
}

// ─── Inhalts-Ansicht für verifizierte Nutzerinnen ─────────────────────────────

function VerifiedContent({ colors, insets }: { colors: any; insets: any }) {
  const router = useRouter();
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
      {/* Gradient unten */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.cardGradient}
      />
      {/* Video-Icon */}
      {item.media_type === 'video' && (
        <View style={styles.videoIcon}>
          <Video size={12} color="#fff" fill="#fff" strokeWidth={0} />
        </View>
      )}
      {/* Author */}
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
        <ActivityIndicator color="#F43F5E" size="large" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>🌸</Text>
        <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
          Noch keine Posts
        </Text>
        <Text style={[styles.emptySub, { color: colors.text.muted }]}>
          Sei die Erste! Erstelle einen Women-Only Post.
        </Text>
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
          tintColor="#F43F5E"
        />
      }
      ListHeaderComponent={() => (
        <View style={[styles.verifiedBanner, { backgroundColor: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.2)' }]}>
          <ShieldCheck size={16} color="#F43F5E" strokeWidth={2} />
          <Text style={[styles.verifiedBannerText, { color: '#F43F5E' }]}>
            Nur für verifizierte Frauen · RLS-geschützt
          </Text>
        </View>
      )}
    />
  );
}

// ─── Gate-Screen für nicht-verifizierte Nutzerinnen ──────────────────────────

function GateContent({ onJoin }: { onJoin: () => void }) {
  const FEATURES = [
    { icon: '🔒', text: 'Kein Mann sieht jemals deine Women-Only Inhalte' },
    { icon: '👗', text: 'Teile Outfits, Videos und Live-Streams ohne Sorgen' },
    { icon: '🌸', text: 'Exklusiver Community-Feed nur für Frauen' },
    { icon: '🛍️', text: 'Women-Only Shop-Produkte entdecken' },
    { icon: '📡', text: 'Live-Streams die nur verifizierte Frauen sehen' },
    { icon: '✨', text: 'Premium Badge auf deinem Profil' },
  ];

  return (
    <View style={styles.gateRoot}>
      {/* Hero */}
      <LinearGradient
        colors={['rgba(244,63,94,0.12)', 'rgba(168,85,247,0.08)', 'transparent']}
        style={styles.gateHero}
      >
        <Text style={styles.gateEmoji}>🌸</Text>
        <Text style={styles.gateTitle}>Women-Only Zone</Text>
        <Text style={styles.gateSub}>
          Ein geschützter Raum nur für Frauen.{'\n'}
          Technisch gesichert auf Datenbankebene.
        </Text>
      </LinearGradient>

      {/* Features */}
      <View style={styles.featureList}>
        {FEATURES.map((f) => (
          <View key={f.text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Verifikations-Info */}
      <View style={styles.infoBox}>
        <Lock size={14} color="rgba(244,63,94,0.7)" strokeWidth={2} />
        <Text style={styles.infoText}>
          Sofortzugang durch Selbstdeklaration. Keine Upload-Pflicht.
          Falsche Angaben = dauerhafter Account-Ban (AGB §3).
        </Text>
      </View>

      {/* CTA */}
      <Pressable onPress={onJoin} style={styles.joinBtn} accessibilityRole="button">
        <LinearGradient
          colors={['#F43F5E', '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.joinBtnGradient}
        >
          <Text style={styles.joinBtnText}>🌸  Women-Only Zone beitreten</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerEmoji: { fontSize: 18 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  emptyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
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
  verifiedBannerText: { fontSize: 12, fontWeight: '600' },

  // Gate
  gateRoot: { flex: 1, padding: 24 },
  gateHero: {
    alignItems: 'center', paddingVertical: 32,
    borderRadius: 20, marginBottom: 24,
  },
  gateEmoji: { fontSize: 56, marginBottom: 12 },
  gateTitle: {
    fontSize: 28, fontWeight: '900', letterSpacing: -0.5,
    color: '#F43F5E', marginBottom: 8,
  },
  gateSub: {
    fontSize: 14, textAlign: 'center', lineHeight: 22,
    color: 'rgba(244,63,94,0.7)',
  },

  featureList: { gap: 14, marginBottom: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  featureText: { flex: 1, fontSize: 14, lineHeight: 20, color: 'rgba(200,200,210,0.9)' },

  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(244,63,94,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(244,63,94,0.15)',
    padding: 14, marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, color: 'rgba(180,180,190,0.8)' },

  joinBtn: { borderRadius: 18, overflow: 'hidden' },
  joinBtnGradient: { paddingVertical: 18, alignItems: 'center' },
  joinBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
});
