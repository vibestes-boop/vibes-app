/**
 * components/live/LivePollOverlay.tsx
 *
 * v1.22.0 — Zeigt eine aktive Live-Poll als Overlay über dem Stream.
 *
 * Vor Abstimmung: 2-4 Buttons, einer pro Option.
 * Nach Abstimmung: Balken-Diagramm mit Prozent + eigene Auswahl hervorgehoben.
 *
 * Host-only: zusätzlicher "Schließen"-Button, damit er die Poll beenden kann.
 *
 * v1.22.0: Optional frei verschiebbar via DraggableOverlay-Wrapper.
 *   Host: draggable={true} + onPositionChange → broadcastet Position
 *   Viewer: remotePosition → folgt sanft der Position die Host festgelegt hat
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Dimensions, View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { BarChart3, X as XIcon, Move } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { LivePoll } from '@/lib/useLivePolls';
import { pollPercentage } from '@/lib/useLivePolls';
import { DraggableOverlay, type DraggablePosition } from './DraggableOverlay';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// v1.22.0 (UX): Kompakte Breite — nimmt nur so viel Platz wie nötig.
// Vorher: 360px → fast gesamte Screen-Breite mit Riesenlücken in den Bars.
const POLL_CARD_WIDTH = Math.min(SCREEN_W - 60, 260);
/** Default-Position des Poll-Overlays (erste Stream-Session, vor Persistenz). */
const DEFAULT_POLL_POSITION: DraggablePosition = {
  x: 12,
  y: Math.round(SCREEN_H * 0.22),
};

// ─── Option Row (Vote-Modus) ────────────────────────────────────────────────

function VoteOption({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.voteRow,
        { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={styles.voteLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ─── Option Row (Result-Modus) ──────────────────────────────────────────────

function ResultBar({
  label,
  percent,
  isMyVote,
  isLeading,
}: {
  label: string;
  percent: number;
  isMyVote: boolean;
  isLeading: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent / 100,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, percent]);

  const widthInterp = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const fillColor = isMyVote
    ? 'rgba(139,92,246,0.55)'
    : isLeading
      ? 'rgba(34,197,94,0.35)'
      : 'rgba(255,255,255,0.16)';

  return (
    <View style={styles.resultRow}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.resultFill, { width: widthInterp, backgroundColor: fillColor }]}
      />
      <View style={styles.resultContent}>
        <Text style={styles.resultLabel} numberOfLines={1}>
          {isMyVote ? '✓ ' : ''}{label}
        </Text>
        <Text style={styles.resultPercent}>{percent}%</Text>
      </View>
    </View>
  );
}

// ─── Public Component ───────────────────────────────────────────────────────

interface Props {
  poll:       LivePoll;
  myVote:     number | null;
  onVote:     (optionIndex: number) => void;
  isVoting:   boolean;
  /** Host darf die Poll schließen. */
  isHost?:    boolean;
  onClose?:   () => void;
  /**
   * Wenn true, kann das Overlay mit dem Finger verschoben werden.
   * Typisch: Host-Seite. Viewer-Seite lässt diese Prop weg.
   */
  draggable?: boolean;
  /**
   * Viewer-Seite: die vom Host per Broadcast geschickte Position.
   * Overlay fliegt sanft (220ms) zu dieser Position.
   */
  remotePosition?: DraggablePosition | null;
  /**
   * Host-Seite: Callback beim Finger-Loslassen mit finaler (x,y).
   * Hier typischerweise `broadcastPosition(pos)` aufrufen.
   */
  onPositionChange?: (pos: DraggablePosition) => void;
  /**
   * Optional: Storage-Key für AsyncStorage-Persistenz
   * (z.B. `poll-${userId}`) — Host sieht Overlay beim nächsten Stream
   * wieder an derselben Stelle.
   */
  storageKey?: string;
}

export function LivePollOverlay({
  poll, myVote, onVote, isVoting,
  isHost, onClose,
  draggable, remotePosition, onPositionChange, storageKey,
}: Props) {
  const leadingIdx = useMemo<number | null>(() => {
    if (poll.totalVotes === 0) return null;
    let best = -1;
    let bestCount = -1;
    for (const [idxStr, cnt] of Object.entries(poll.tallies)) {
      if (cnt > bestCount) {
        bestCount = cnt;
        best = parseInt(idxStr, 10);
      }
    }
    return best >= 0 ? best : null;
  }, [poll.tallies, poll.totalVotes]);

  const showResults = myVote !== null || isHost;

  // Ob das Overlay frei bewegbar gerendert wird (Host draggable, Viewer folgt)
  const isDraggableMode = draggable || remotePosition != null;

  const card = (
    <View style={styles.card}>
      <View style={styles.header}>
        <BarChart3 size={14} color="#a78bfa" strokeWidth={2.4} />
        <Text style={styles.title}>Umfrage</Text>
        {/* Drag-Indikator für Host, sobald draggable aktiv */}
        {draggable && (
          <View style={styles.dragHint}>
            <Move size={11} color="rgba(255,255,255,0.55)" strokeWidth={2.2} />
          </View>
        )}
        {isHost && onClose && (
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <XIcon size={14} color="rgba(255,255,255,0.7)" strokeWidth={2.4} />
          </Pressable>
        )}
      </View>

      <Text style={styles.question} numberOfLines={2}>
        {poll.question}
      </Text>

      <View style={{ gap: 5 }}>
        {poll.options.map((label, idx) =>
          showResults ? (
            <ResultBar
              key={idx}
              label={label}
              percent={pollPercentage(poll, idx)}
              isMyVote={myVote === idx}
              isLeading={leadingIdx === idx}
            />
          ) : (
            <VoteOption
              key={idx}
              label={label}
              onPress={() => onVote(idx)}
              disabled={isVoting}
            />
          ),
        )}
      </View>

      <Text style={styles.footer}>
        {poll.totalVotes === 0
          ? 'Noch keine Stimmen'
          : `${poll.totalVotes} ${poll.totalVotes === 1 ? 'Stimme' : 'Stimmen'}`}
      </Text>
    </View>
  );

  // Legacy-Modus (kein Drag/Remote) → in-flow, alte Positionierung.
  // Card nicht auf Full-Width strecken — nur so breit wie nötig.
  if (!isDraggableMode) {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.legacyCardWrap}>{card}</View>
      </View>
    );
  }

  // Drag-Modus: fixed width + absolute via DraggableOverlay
  return (
    <DraggableOverlay
      draggable={!!draggable}
      defaultPosition={DEFAULT_POLL_POSITION}
      remotePosition={remotePosition ?? null}
      onRelease={onPositionChange}
      storageKey={storageKey}
    >
      <View style={styles.draggableCardWrap}>
        {card}
      </View>
    </DraggableOverlay>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 6,
    // Card linksbündig — nicht auf Full-Width strecken
    alignItems: 'flex-start',
  },
  legacyCardWrap: {
    width: POLL_CARD_WIDTH,
  },
  draggableCardWrap: {
    width: POLL_CARD_WIDTH,
  },
  dragHint: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  card: {
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  title: {
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    color: '#e2e8f0',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  question: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 7,
    lineHeight: 16,
  },
  voteRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  voteLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  resultRow: {
    height: 26,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  resultFill: {
    left: 0,
  },
  resultContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  resultLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  resultPercent: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginLeft: 6,
  },
  footer: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },
});
