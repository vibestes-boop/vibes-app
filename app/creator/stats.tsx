/**
 * app/creator/stats.tsx
 * Creator Dashboard — monochrome, premium, kein Vibecodet
 */
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, TrendingUp, Users, Heart, Eye, Coins, ShoppingBag, Video, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useMyOrders } from '@/lib/useShop';

// ─── Daten ────────────────────────────────────────────────────────────────────
interface CreatorStats {
  totalFollowers:  number;
  newFollowers7d:  number;
  totalLikes:      number;
  totalPosts:      number;
  totalLiveSessions: number;
  totalLiveViews:  number;
  totalLiveLikes:  number;
}

function useCreatorStats(userId: string | null) {
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const [
          { count: followers },
          { count: newFollowers },
          { data: posts },
          { data: liveSessions },
        ] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
          supabase.from('follows').select('*', { count: 'exact', head: true })
            .eq('following_id', userId)
            .gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString()),
          supabase.from('posts').select('like_count').eq('user_id', userId),
          supabase.from('live_sessions')
            .select('peak_viewers, like_count')
            .eq('host_id', userId)
            .eq('status', 'ended'),
        ]);

        setStats({
          totalFollowers:    followers ?? 0,
          newFollowers7d:    newFollowers ?? 0,
          totalLikes:        (posts ?? []).reduce((s, p) => s + (p.like_count ?? 0), 0),
          totalPosts:        posts?.length ?? 0,
          totalLiveSessions: liveSessions?.length ?? 0,
          totalLiveViews:    (liveSessions ?? []).reduce((s, l) => s + (l.peak_viewers ?? 0), 0),
          totalLiveLikes:    (liveSessions ?? []).reduce((s, l) => s + (l.like_count ?? 0), 0),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  return { stats, loading };
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Einzelne Stat-Zeile ──────────────────────────────────────────────────────
function StatRow({
  icon: Icon,
  label,
  value,
  sub,
  last = false,
}: {
  icon: any; label: string; value: string; sub?: string; last?: boolean;
}) {
  return (
    <View style={[css.statRow, !last && css.statRowBorder]}>
      <View style={css.statIcon}>
        <Icon size={18} color="rgba(255,255,255,0.55)" strokeWidth={1.6} />
      </View>
      <Text style={css.statLabel}>{label}</Text>
      <View style={css.statRight}>
        <Text style={css.statValue}>{value}</Text>
        {sub ? <Text style={css.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ─── Top Produkte ─────────────────────────────────────────────────────────────
function TopProducts({ userId }: { userId: string }) {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('products')
      .select('id, title, cover_url, price_coins, total_sales')
      .eq('creator_id', userId)
      .order('total_sales', { ascending: false })
      .limit(3)
      .then(({ data }) => setProducts(data ?? []));
  }, [userId]);

  if (!products.length) return null;

  return (
    <View style={css.card}>
      <Text style={css.cardTitle}>Top Produkte</Text>
      {products.map((p, i) => (
        <View key={p.id} style={[css.productRow, i < products.length - 1 && css.productRowBorder]}>
          <Text style={css.productRank}>{i + 1}</Text>
          {p.cover_url
            ? <Image source={{ uri: p.cover_url }} style={css.productImg} contentFit="cover" />
            : <View style={[css.productImg, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
          }
          <View style={{ flex: 1 }}>
            <Text style={css.productName} numberOfLines={1}>{p.title}</Text>
            <Text style={css.productMeta}>{p.total_sales ?? 0} Verkäufe</Text>
          </View>
          <Text style={css.productCoins}>{p.price_coins} ¢</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CreatorStatsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const { stats, loading } = useCreatorStats(profile?.id ?? null);
  const { data: sellerOrders = [] } = useMyOrders('seller');

  const revenue = sellerOrders.filter(o => o.status === 'completed').reduce((s, o) => s + o.total_coins, 0);
  const sales   = sellerOrders.filter(o => o.status === 'completed').length;

  if (loading) {
    return (
      <View style={[css.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="rgba(255,255,255,0.5)" />
      </View>
    );
  }

  return (
    <View style={css.root}>

      {/* Header */}
      <View style={[css.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={css.back}>
          <ArrowLeft size={22} color="#fff" />
        </Pressable>
        <Text style={css.headerTitle}>Dashboard</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 12 }}
      >

        {/* Profil */}
        <View style={css.profileRow}>
          {profile?.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={css.avatar} contentFit="cover" />
            : <View style={[css.avatar, css.avatarFallback]}>
                <Text style={css.avatarInitial}>{profile?.username?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
          }
          <View>
            <Text style={css.username}>@{profile?.username ?? '–'}</Text>
            <Text style={css.creatorLabel}>Creator Account</Text>
          </View>
        </View>

        {/* Einnahmen-Kachel */}
        <View style={css.revCard}>
          <View>
            <Text style={css.revLabel}>Shop Einnahmen</Text>
            <Text style={css.revValue}>{revenue.toLocaleString()} <Text style={css.revSuffix}>Coins</Text></Text>
          </View>
          <Pressable
            style={css.revLink}
            onPress={() => router.push('/shop/orders' as any)}
          >
            <Text style={css.revLinkText}>{sales} Verkäufe</Text>
            <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        {/* Audience */}
        <View style={css.card}>
          <Text style={css.cardTitle}>Audience</Text>
          <StatRow
            icon={Users}
            label="Follower"
            value={fmt(stats?.totalFollowers ?? 0)}
            sub={stats?.newFollowers7d ? `+${stats.newFollowers7d} diese Woche` : undefined}
          />
          <StatRow
            icon={Heart}
            label="Likes gesamt"
            value={fmt(stats?.totalLikes ?? 0)}
          />
          <StatRow
            icon={TrendingUp}
            label="Posts"
            value={fmt(stats?.totalPosts ?? 0)}
            last
          />
        </View>

        {/* Live — nur anzeigen wenn mindestens 1 Session */}
        {(stats?.totalLiveSessions ?? 0) > 0 && (
          <View style={css.card}>
            <Text style={css.cardTitle}>Live</Text>
            <StatRow
              icon={Video}
              label="Live Sessions"
              value={fmt(stats?.totalLiveSessions ?? 0)}
            />
            <StatRow
              icon={Eye}
              label="Peak Viewers"
              value={fmt(stats?.totalLiveViews ?? 0)}
            />
            <StatRow
              icon={Heart}
              label="Live Likes"
              value={fmt(stats?.totalLiveLikes ?? 0)}
              last
            />
          </View>
        )}

        {/* Top Produkte */}
        {profile?.id && <TopProducts userId={profile.id} />}

        {/* Bestellungen CTA */}
        <Pressable
          style={({ pressed }) => [css.ordersBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.push('/shop/orders' as any)}
        >
          <ShoppingBag size={16} color="rgba(255,255,255,0.7)" />
          <Text style={css.ordersBtnText}>Bestellungen & Verkäufe</Text>
          <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
        </Pressable>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const css = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050508' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.1 },

  // Profil
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  username: { color: '#fff', fontSize: 15, fontWeight: '600' },
  creatorLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 1 },

  // Einnahmen
  revCard: {
    backgroundColor: '#fff',
    borderRadius: 16, padding: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  revLabel: { color: 'rgba(0,0,0,0.45)', fontSize: 11, fontWeight: '600', marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' },
  revValue: { color: '#000', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  revSuffix: { fontSize: 14, fontWeight: '500', color: 'rgba(0,0,0,0.4)' },
  revLink: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  revLinkText: { color: 'rgba(0,0,0,0.55)', fontSize: 12, fontWeight: '600' },

  // Karte
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  cardTitle: {
    color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '700',
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10,
  },

  // Stat-Zeile
  statRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13,
  },
  statRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  statIcon: { width: 24, alignItems: 'center' },
  statLabel: { flex: 1, color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  statRight: { alignItems: 'flex-end' },
  statValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  statSub: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 1 },

  // Top Produkte
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  productRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)' },
  productRank: { color: 'rgba(255,255,255,0.2)', fontSize: 13, fontWeight: '700', width: 16, textAlign: 'center' },
  productImg: { width: 36, height: 36, borderRadius: 8 },
  productName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  productMeta: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 1 },
  productCoins: { color: 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: '500' },

  // CTA
  ordersBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ordersBtnText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },
});
