/**
 * app/settings/muted-live-hosts.tsx
 *
 * v1.17.0 — Go-Live Push-Preferences.
 *
 * Liste aller Hosts, deren Go-Live Pushes der User stumm geschaltet hat.
 * Tippen auf "Aufheben" entfernt den Mute → User bekommt wieder Pushes.
 *
 * Zum Stummschalten selbst gibt es drei Einstiegspunkte:
 *   1) Glocken-Toggle auf dem Profil eines Creators (UserProfileContent)
 *   2) Long-Press auf eine Live-Notification
 *   3) Swipe → Stummschalten innerhalb dieser Liste ist nicht vorgesehen
 *      (Liste dient nur zum Überblick und Wiederaktivieren)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, BellOff, Undo2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/lib/useTheme';
import { useMutedLiveHosts, useToggleMuteHost, type MutedHost } from '@/lib/useMutedLiveHosts';

// ─── Row ────────────────────────────────────────────────────────────

function MutedRow({
  host,
  colors,
  onUnmute,
  onPressUser,
  isBusy,
}: {
  host: MutedHost;
  colors: any;
  onUnmute: () => void;
  onPressUser: () => void;
  isBusy: boolean;
}) {
  const name = host.username ?? 'Unbekannt';
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle },
      ]}
    >
      <Pressable
        onPress={onPressUser}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}
      >
        {host.avatarUrl ? (
          <Image
            source={{ uri: host.avatarUrl }}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg.secondary }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: colors.bg.secondary,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
              {name[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={1}>
            @{name}
          </Text>
          <Text style={[styles.sub, { color: colors.text.muted }]}>
            Live-Pushes stummgeschaltet
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={onUnmute}
        disabled={isBusy}
        style={({ pressed }) => [
          styles.unmuteBtn,
          { backgroundColor: colors.accent.primary, opacity: isBusy || pressed ? 0.7 : 1 },
        ]}
      >
        {isBusy ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Undo2 size={14} color="#fff" strokeWidth={2.2} />
            <Text style={styles.unmuteText}>Aufheben</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────

export default function MutedLiveHostsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const { data: mutedHosts, isLoading } = useMutedLiveHosts();
  const toggle = useToggleMuteHost();

  const handleUnmute = (hostId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle.mutate({ hostId, mute: false });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={16}>
          <ArrowLeft size={22} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          Live-Benachrichtigungen
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.text.primary} />
        </View>
      ) : !mutedHosts || mutedHosts.length === 0 ? (
        <View style={styles.empty}>
          <BellOff size={40} color={colors.icon.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
            Niemand ist stummgeschaltet
          </Text>
          <Text style={[styles.emptySub, { color: colors.text.muted }]}>
            Tippe auf die Glocke in einem Profil, um Live-Pushes dieser Person
            zu stummschalten — du folgst ihnen weiterhin ganz normal.
          </Text>
        </View>
      ) : (
        <FlatList
          data={mutedHosts}
          keyExtractor={(item) => item.hostId}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <MutedRow
              host={item}
              colors={colors}
              onUnmute={() => handleUnmute(item.hostId)}
              onPressUser={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/user/[id]', params: { id: item.hostId } });
              }}
              isBusy={toggle.isPending && toggle.variables?.hostId === item.hostId}
            />
          )}
          ListHeaderComponent={
            <Text style={[styles.desc, { color: colors.text.muted }]}>
              Diese Creator bekommen einen Push von dir nicht, wenn sie live gehen.
              Du folgst ihnen weiterhin ganz normal.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  desc: { fontSize: 12, lineHeight: 18, marginBottom: 16, paddingHorizontal: 4 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  name: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 2 },

  unmuteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
  },
  unmuteText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
