/**
 * components/profile/BattleHistoryList.tsx
 *
 * v1.17.0 — Battle-History Tab auf dem Profil.
 *
 * Zeigt die letzten Battles des Users als Liste mit:
 *   • Opponent-Avatar + Username
 *   • Score (eigene : gegnerisch)
 *   • W / L / D Badge mit Farbe
 *   • Dauer + relatives Datum
 *   • Klick → Opponent-Profil
 *
 * Daten-Quelle: useBattleHistory(userId) aus lib/useBattleStats.ts.
 * Wird nur gerendert, wenn totalBattles > 0 (Tab wird sonst gar nicht gezeigt).
 */

import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Swords, Trophy, X as XIcon, Minus } from 'lucide-react-native';

import { useTheme } from '@/lib/useTheme';
import { useBattleHistory, type BattleHistoryEntry } from '@/lib/useBattleStats';

// ─── Helper ─────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'gerade eben';
  if (m < 60) return `vor ${m} Min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std`;
  const days = Math.floor(h / 24);
  if (days < 7)   return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  if (days < 30)  return `vor ${Math.floor(days / 7)} Wo`;
  if (days < 365) return `vor ${Math.floor(days / 30)} Mon`;
  return `vor ${Math.floor(days / 365)} J`;
}

function fmtDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

// ─── Item ──────────────────────────────────────────────────────────

function BattleRow({ entry, colors }: { entry: BattleHistoryEntry; colors: any }) {
  const isWin  = entry.result === 'win';
  const isLoss = entry.result === 'loss';

  const resultColor =
    isWin  ? '#22C55E'
    : isLoss ? '#EF4444'
    : colors.text.muted;

  const resultBg =
    isWin  ? 'rgba(34,197,94,0.12)'
    : isLoss ? 'rgba(239,68,68,0.12)'
    : 'rgba(148,163,184,0.12)';

  const resultLabel = isWin ? 'W' : isLoss ? 'L' : 'D';
  const ResultIcon  = isWin ? Trophy : isLoss ? XIcon : Minus;

  const avatar = entry.opponentAvatar;
  const name   = entry.opponentUsername ?? 'Unbekannt';

  const onPressUser = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/user/[id]', params: { id: entry.opponentId } });
  };

  return (
    <Pressable
      onPress={onPressUser}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bg.elevated,
          borderRadius: 14,
          padding: 12,
          marginHorizontal: 16,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: colors.border.default,
          gap: 12,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {/* Result-Badge */}
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: resultBg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: resultColor,
        }}
      >
        <ResultIcon size={18} color={resultColor} strokeWidth={2.2} />
      </View>

      {/* Opponent Avatar + Name + Score */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {avatar ? (
          <Image
            source={{ uri: avatar }}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.secondary }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: colors.bg.secondary,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 13 }}>
              {name[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{ color: colors.text.primary, fontSize: 14, fontWeight: '600' }}
            numberOfLines={1}
          >
            vs. @{name}
          </Text>
          <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 2 }}>
            {fmtDuration(entry.durationSecs)}  ·  {relTime(entry.endedAt)}
          </Text>
        </View>
      </View>

      {/* Score */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            color: resultColor,
            fontSize: 16,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
          }}
        >
          {entry.myScore} : {entry.opponentScore}
        </Text>
        <Text
          style={{
            color: resultColor,
            fontSize: 10,
            fontWeight: '700',
            marginTop: 2,
            letterSpacing: 1,
          }}
        >
          {resultLabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Public Component ──────────────────────────────────────────────

export function BattleHistoryList({ userId }: { userId: string | null | undefined }) {
  const { colors } = useTheme();
  const { data: history, isLoading } = useBattleHistory(userId ?? null, 30);

  if (isLoading) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator color={colors.text.primary} />
      </View>
    );
  }

  if (!history || history.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center', paddingHorizontal: 32 }}>
        <Swords size={40} color={colors.icon.muted} />
        <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '600', marginTop: 12 }}>
          Noch keine Battles
        </Text>
        <Text style={{ color: colors.text.muted, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
          Starte im Live-Stream einen Battle gegen einen Co-Host.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingTop: 8 }}>
      {history.map((entry) => (
        <BattleRow key={entry.id} entry={entry} colors={colors} />
      ))}
    </View>
  );
}
