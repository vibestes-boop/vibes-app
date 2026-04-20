/**
 * cohost-blocks.tsx
 *
 * Phase 5b — Settings-Screen für persistente Co-Host Blocks.
 *
 * Zeigt alle User, die der aktuelle Host vom Co-Host-Beitritt gesperrt hat
 * (Tabelle `live_cohost_blocks`). Der Host kann hier:
 *   - Blocks einsehen (Username, Avatar, Grund, Ablaufdatum)
 *   - Einzelne User entblocken (RPC `unblock_cohost`)
 *
 * Unterschied zu `blocked-users.tsx`: Dieser Screen verwaltet NUR die
 * Co-Host-spezifische Blocklist. Ein User auf dieser Liste kann die Live
 * weiter als Viewer anschauen, aber NICHT mehr als Co-Host beitreten.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ShieldOff, UserX, Info } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/lib/useTheme';

// ─── Typen ───────────────────────────────────────────────────────────────
interface CoHostBlock {
  blocked_user_id: string;
  created_at: string;
  expires_at: string | null;
  reason: string | null;
  profile: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

// ─── Query ───────────────────────────────────────────────────────────────
// Liest alle aktiven (nicht-expired) Blocks für den aktuellen Host.
function useCoHostBlocks() {
  const hostId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: ['cohost-blocks', hostId],
    enabled: !!hostId,
    queryFn: async (): Promise<CoHostBlock[]> => {
      const { data, error } = await supabase
        .from('live_cohost_blocks')
        .select(`
          blocked_user_id,
          created_at,
          expires_at,
          reason,
          profile:profiles!live_cohost_blocks_blocked_user_id_fkey (
            id,
            username,
            avatar_url
          )
        `)
        .eq('host_id', hostId!)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) {
        __DEV__ && console.warn('[CoHostBlocks] query failed:', error);
        throw error;
      }
      // Supabase gibt den Join als Array zurück — wir normalisieren auf {} | null.
      return (data ?? []).map((row: any) => ({
        blocked_user_id: row.blocked_user_id,
        created_at:      row.created_at,
        expires_at:      row.expires_at,
        reason:          row.reason,
        profile: Array.isArray(row.profile)
          ? (row.profile[0] ?? null)
          : (row.profile ?? null),
      }));
    },
  });
}

// ─── Helper ──────────────────────────────────────────────────────────────
function formatRelativeAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1)  return 'vor wenigen Minuten';
  if (hours < 24) return `vor ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days} d`;
  const months = Math.floor(days / 30);
  return `vor ${months} mo`;
}

function formatExpires(iso: string | null): string | null {
  if (!iso) return null; // permanent
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'läuft in <1h ab';
  if (hours < 24) return `läuft in ${hours} h ab`;
  const days = Math.floor(hours / 24);
  return `läuft in ${days} d ab`;
}

// ─── Row ─────────────────────────────────────────────────────────────────
function CoHostBlockRow({ block, onUnblocked }: { block: CoHostBlock; onUnblocked: () => void }) {
  const [unblocking, setUnblocking] = useState(false);
  const { colors } = useTheme();
  const username = block.profile?.username ?? 'Unbekannt';
  const avatarUrl = block.profile?.avatar_url ?? null;
  const initial = username[0]?.toUpperCase() ?? '?';
  const expiresText = formatExpires(block.expires_at);

  const handleUnblock = useCallback(() => {
    Alert.alert(
      `@${username} entblocken?`,
      'Der User kann dann wieder als Co-Host zu deinen Lives beitreten.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entblocken',
          onPress: async () => {
            setUnblocking(true);
            try {
              const { error } = await supabase.rpc('unblock_cohost', {
                p_user_id: block.blocked_user_id,
              });
              if (error) throw error;
              onUnblocked();
            } catch (err) {
              __DEV__ && console.warn('[CoHostBlocks] unblock failed:', err);
              Alert.alert('Fehler', 'Entblocken fehlgeschlagen. Bitte erneut versuchen.');
            } finally {
              setUnblocking(false);
            }
          },
        },
      ]
    );
  }, [username, block.blocked_user_id, onUnblocked]);

  return (
    <View style={[styles.row, { borderBottomColor: colors.border.subtle }]}>
      <View style={styles.avatarWrap}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.bg.elevated }]}>
            <Text style={[styles.avatarInitial, { color: colors.text.muted }]}>{initial}</Text>
          </View>
        )}
        <View style={[styles.blockBadge, { borderColor: colors.bg.secondary }]}>
          <UserX size={10} color="#fff" strokeWidth={2.5} />
        </View>
      </View>

      <View style={styles.info}>
        <Text style={[styles.username, { color: colors.text.primary }]} numberOfLines={1}>
          @{username}
        </Text>
        <Text style={styles.metaLine} numberOfLines={1}>
          {block.reason ? `${block.reason} · ` : ''}
          {formatRelativeAge(block.created_at)}
          {expiresText ? ` · ${expiresText}` : ' · permanent'}
        </Text>
      </View>

      <Pressable
        onPress={handleUnblock}
        disabled={unblocking}
        style={styles.unblockBtn}
        accessibilityRole="button"
        accessibilityLabel={`${username} entblocken`}
        hitSlop={8}
      >
        {unblocking ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.unblockText}>Entblocken</Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────
export default function CoHostBlocksScreen() {
  const insets = useSafeAreaInsets();
  const { data: blocks = [], isLoading, refetch } = useCoHostBlocks();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const hostId = useAuthStore((s) => s.profile?.id);

  const handleUnblocked = useCallback(() => {
    // Optimistisches Entfernen aus Cache + Background-Refetch als Bestätigung.
    queryClient.setQueryData<CoHostBlock[]>(
      ['cohost-blocks', hostId],
      (old) => (old ?? []).filter((b) => true), // no-op guard; refetch überschreibt
    );
    refetch();
  }, [queryClient, hostId, refetch]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.subtle, backgroundColor: colors.bg.secondary }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.bg.elevated }]}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          hitSlop={12}
        >
          <ArrowLeft size={20} color={colors.text.secondary} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Co-Host Blocks</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Info-Banner */}
      <View style={[styles.banner, { backgroundColor: colors.bg.secondary, borderBottomColor: colors.border.subtle }]}>
        <Info size={14} color={colors.icon.muted} strokeWidth={2} />
        <Text style={[styles.bannerText, { color: colors.text.muted }]}>
          Geblockte User können deine Live weiter anschauen, aber nicht mehr als Co-Host beitreten.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text.primary} size="large" />
        </View>
      ) : blocks.length === 0 ? (
        <View style={styles.center}>
          <ShieldOff size={48} color={colors.icon.muted} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Keine Co-Host Blocks</Text>
          <Text style={[styles.emptySubtitle, { color: colors.text.muted }]}>
            Beim Rauswerfen eines Co-Hosts mit Grund landet er automatisch hier.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blocks}
          keyExtractor={(item) => item.blocked_user_id}
          renderItem={({ item }) => <CoHostBlockRow block={item} onUnblocked={handleUnblocked} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border.subtle }]} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  backBtn: {
    width:          44,
    height:         44,
    borderRadius:   22,
    alignItems:     'center',
    justifyContent: 'center',
  },
  banner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth: 1,
  },
  bannerText: { fontSize: 12, flex: 1, lineHeight: 16 },
  center: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               12,
    paddingHorizontal: 32,
  },
  emptyTitle:    { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               12,
  },
  avatarWrap:      { position: 'relative' },
  avatar:          { width: 48, height: 48, borderRadius: 24 },
  avatarFallback:  { alignItems: 'center', justifyContent: 'center' },
  avatarInitial:   { fontSize: 20, fontWeight: '700' },
  blockBadge: {
    position:        'absolute',
    bottom:          -2,
    right:           -2,
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: '#EF4444',
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     2,
  },
  info:       { flex: 1, gap: 2 },
  username:   { fontSize: 15, fontWeight: '600' },
  metaLine:   { color: '#EF4444', fontSize: 11, fontWeight: '500' },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      16,
    borderWidth:       1.5,
    borderColor:       'rgba(255,255,255,0.25)',
    backgroundColor:   'rgba(29,185,84,0.08)',
    minWidth:          90,
    alignItems:        'center',
  },
  unblockText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  separator:   { height: 1, marginLeft: 76 },
});
