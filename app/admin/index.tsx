/**
 * app/admin/index.tsx — Admin-Dashboard
 *
 * Übersicht aller wichtigen Plattform-Metriken:
 * Nutzer, Posts, Bestellungen, Umsatz, offene Reports
 */

import {
  View, Text, StyleSheet, Pressable,
  ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Users, FileText, ShoppingBag, Flag,
  TrendingUp, Shield, ChevronRight, Zap,
  Package, LogOut, Settings,
} from 'lucide-react-native';
import { useAdminStats } from '@/lib/useAdmin';
import { useTheme } from '@/lib/useTheme';
import { useAuthStore } from '@/lib/authStore';

// ─── Stats-Karte ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  onPress,
  colors,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  onPress?: () => void;
  colors: any;
}) {
  return (
    <Pressable
      style={[sc.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={label}
    >
      <View style={[sc.iconWrap, { backgroundColor: accent ? `${accent}20` : colors.bg.primary }]}>
        <Icon size={20} color={accent ?? colors.text.muted} strokeWidth={1.8} />
      </View>
      <Text style={[sc.value, { color: colors.text.primary }]}>{value}</Text>
      <Text style={[sc.label, { color: colors.text.muted }]}>{label}</Text>
      {sub && <Text style={[sc.sub, { color: accent ?? colors.text.muted }]}>{sub}</Text>}
      {onPress && <ChevronRight size={14} color={colors.text.muted} strokeWidth={2} style={sc.arrow} />}
    </Pressable>
  );
}

// ─── Navigations-Zeile ────────────────────────────────────────────────────────

function NavRow({
  icon: Icon,
  label,
  sub,
  badge,
  onPress,
  colors,
}: {
  icon: any;
  label: string;
  sub?: string;
  badge?: number;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      style={[nr.row, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[nr.iconWrap, { backgroundColor: colors.bg.primary }]}>
        <Icon size={18} color={colors.text.primary} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[nr.label, { color: colors.text.primary }]}>{label}</Text>
        {sub && <Text style={[nr.sub, { color: colors.text.muted }]}>{sub}</Text>}
      </View>
      {badge != null && badge > 0 && (
        <View style={nr.badge}>
          <Text style={nr.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <ChevronRight size={16} color={colors.text.muted} strokeWidth={2} />
    </Pressable>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuthStore();

  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = useAdminStats();

  const fmtNum = (n?: number) => {
    if (n == null) return '–';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <LinearGradient
        colors={[colors.bg.elevated, colors.bg.primary]}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={s.headerLeft}>
          <View style={[s.shieldBadge, { backgroundColor: colors.text.primary }]}>
            <Shield size={16} color={colors.bg.primary} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={[s.headerTitle, { color: colors.text.primary }]}>Admin Panel</Text>
            <Text style={[s.headerSub, { color: colors.text.muted }]}>@{profile?.username}</Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.back()}
          style={[s.backBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
          accessibilityLabel="Schließen"
        >
          <LogOut size={16} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.accent.primary}
          />
        }
      >
        {/* ── Statistiken ── */}
        <View>
          <Text style={[s.sectionTitle, { color: colors.text.primary }]}>Überblick</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.accent.primary} style={{ marginTop: 16 }} />
          ) : (
            <View style={s.statsGrid}>
              <StatCard
                icon={Users}
                label="Nutzer gesamt"
                value={fmtNum(stats?.total_users)}
                sub={`+${fmtNum(stats?.new_users_7d)} diese Woche`}
                accent="#6366F1"
                onPress={() => router.push('/admin/users' as any)}
                colors={colors}
              />
              <StatCard
                icon={FileText}
                label="Posts"
                value={fmtNum(stats?.total_posts)}
                colors={colors}
              />
              <StatCard
                icon={ShoppingBag}
                label="Bestellungen"
                value={fmtNum(stats?.total_orders)}
                onPress={() => router.push('/admin/orders' as any)}
                accent="#10B981"
                colors={colors}
              />
              <StatCard
                icon={TrendingUp}
                label="Umsatz (Coins)"
                value={fmtNum(stats?.total_revenue)}
                accent="#F59E0B"
                colors={colors}
              />
              <StatCard
                icon={Zap}
                label="Aktive Lives"
                value={fmtNum(stats?.active_lives)}
                accent="#EF4444"
                colors={colors}
              />
              <StatCard
                icon={Flag}
                label="Offene Reports"
                value={fmtNum(stats?.pending_reports)}
                onPress={() => router.push('/admin/reports' as any)}
                accent={stats?.pending_reports ? '#EF4444' : undefined}
                colors={colors}
              />
            </View>
          )}
        </View>

        {/* ── Navigation ── */}
        <View style={{ gap: 10 }}>
          <Text style={[s.sectionTitle, { color: colors.text.primary }]}>Bereiche</Text>

          <NavRow
            icon={Users}
            label="Nutzerverwaltung"
            sub="Suchen, sperren, verifizieren, Admin-Rechte"
            onPress={() => router.push('/admin/users' as any)}
            colors={colors}
          />
          <NavRow
            icon={Flag}
            label="Content Reports"
            sub="Gemeldete Posts, Nutzer & Lives"
            badge={stats?.pending_reports}
            onPress={() => router.push('/admin/reports' as any)}
            colors={colors}
          />
          <NavRow
            icon={Package}
            label="Shop-Bestellungen"
            sub="Alle Transaktionen überwachen"
            onPress={() => router.push('/admin/orders' as any)}
            colors={colors}
          />
          <NavRow
            icon={TrendingUp}
            label="Auszahlungen"
            sub="Diamond-Guthaben der Seller"
            onPress={() => router.push('/admin/payouts' as any)}
            colors={colors}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shieldBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 12 },
  backBtn: {
    width: 36, height: 36, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

const sc = StyleSheet.create({
  card: {
    width: '47%', borderRadius: 16, borderWidth: 1,
    padding: 14, gap: 6, position: 'relative',
  },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 24, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600' },
  sub:   { fontSize: 10 },
  arrow: { position: 'absolute', top: 14, right: 14 },
});

const nr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '700' },
  sub:   { fontSize: 12, marginTop: 1 },
  badge: { backgroundColor: '#EF4444', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
