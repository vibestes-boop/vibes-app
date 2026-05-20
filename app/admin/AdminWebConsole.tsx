import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/lib/useTheme';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ExternalLink,
  Flag,
  LayoutDashboard,
  Shield,
  Users,
  WalletCards,
} from 'lucide-react-native';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const WEB_ADMIN_BASE = process.env.EXPO_PUBLIC_WEB_ADMIN_URL ?? 'https://serlo-web.vercel.app/admin';

type WebAdminPath = '/command-center' | '/reports' | '/users' | '/payouts';

const LINKS: {
  label: string;
  sub: string;
  path: WebAdminPath;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}[] = [
  {
    label: 'Command Center',
    sub: 'Health, Kosten, Product, Release und Push/Feed',
    path: '/command-center',
    icon: LayoutDashboard,
  },
  {
    label: 'Moderation',
    sub: 'Reports, SLA und Enforcement',
    path: '/reports',
    icon: Flag,
  },
  {
    label: 'Nutzerverwaltung',
    sub: 'Admin-only Rollen, Sperren und Verifizierung',
    path: '/users',
    icon: Users,
  },
  {
    label: 'Creator Ops',
    sub: 'Seller-Guthaben und Auszahlungen',
    path: '/payouts',
    icon: WalletCards,
  },
];

export function AdminWebConsole({
  title = 'Admin Companion',
  subtitle = 'Die zentrale Admin-Konsole läuft im Web Command Center.',
  primaryPath = '/command-center',
}: {
  title?: string;
  subtitle?: string;
  primaryPath?: WebAdminPath;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuthStore();

  function openPath(path: WebAdminPath) {
    const url = `${WEB_ADMIN_BASE.replace(/\/+$/, '')}${path}`;
    Linking.openURL(url).catch(() => undefined);
  }

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={[s.iconBtn, { borderColor: colors.border.subtle }]}>
          <ArrowLeft size={18} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: colors.text.primary }]}>{title}</Text>
          <Text style={[s.headerSub, { color: colors.text.muted }]}>@{profile?.username ?? 'admin'}</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 36, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.hero, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <View style={[s.heroIcon, { backgroundColor: colors.text.primary }]}>
            <Shield size={20} color={colors.bg.primary} strokeWidth={2.4} />
          </View>
          <Text style={[s.heroTitle, { color: colors.text.primary }]}>{subtitle}</Text>
          <Text style={[s.heroText, { color: colors.text.muted }]}>
            Native bleibt bewusst ein schlanker Companion. Kritische Admin- und Moderationslogik liegt zentral im Web.
          </Text>
          <Pressable
            style={[s.primaryBtn, { backgroundColor: colors.text.primary }]}
            onPress={() => openPath(primaryPath)}
            accessibilityRole="link"
          >
            <Text style={[s.primaryText, { color: colors.bg.primary }]}>Zentrale Konsole öffnen</Text>
            <ExternalLink size={15} color={colors.bg.primary} strokeWidth={2.2} />
          </Pressable>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={[s.sectionTitle, { color: colors.text.primary }]}>Web-Admin Bereiche</Text>
          {LINKS.map(({ label, sub, path, icon: Icon }) => (
            <Pressable
              key={path}
              style={[s.row, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
              onPress={() => openPath(path)}
              accessibilityRole="link"
              accessibilityLabel={label}
            >
              <View style={[s.rowIcon, { backgroundColor: colors.bg.primary }]}>
                <Icon size={18} color={colors.text.primary} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: colors.text.primary }]}>{label}</Text>
                <Text style={[s.rowSub, { color: colors.text.muted }]}>{sub}</Text>
              </View>
              <ExternalLink size={16} color={colors.text.muted} strokeWidth={2} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 11, marginTop: 1 },
  hero: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  heroIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 20, fontWeight: '800', lineHeight: 25 },
  heroText: { fontSize: 13, lineHeight: 19 },
  primaryBtn: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontSize: 14, fontWeight: '800' },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    minHeight: 74,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
});
