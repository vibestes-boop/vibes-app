/**
 * components/live/CoHostSplitView.tsx
 *
 * TikTok-Style Split-Screen für Duet.
 * Unterstützt zwei Layout-Varianten:
 *   'top-bottom'   — Host oben / Gast unten (vertikal geteilt)
 *   'side-by-side' — Host links / Gast rechts (50/50 horizontal)
 *
 * Für PiP → eigenes PiPWindow.tsx
 */
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { VideoTrack } from '@livekit/react-native';
import type { TrackPublication, Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import type { DuetLayout } from '@/lib/useCoHost';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const HALF_H = Math.floor(SCREEN_H / 2);
const HALF_W = Math.floor(SCREEN_W / 2);

export interface SplitTrackRef {
  participant: Participant;
  publication: TrackPublication;
  source: Track.Source;
}

interface CoHostSplitViewProps {
  /** Layout-Variante */
  layout: DuetLayout;
  /** Der Track des oberen/linken Streams (Remote Co-Host aus Host-Sicht, oder Host aus Viewer-Sicht) */
  topTrackRef: SplitTrackRef | null;
  /** Label für obere/linke Hälfte */
  topLabel: string;
  /** Label für untere/rechte Hälfte */
  bottomLabel: string;
  /** Lokale Video-Komponente (untere / rechte Hälfte) */
  LocalView: React.ComponentType;
}

export function CoHostSplitView({
  layout,
  topTrackRef,
  topLabel,
  bottomLabel,
  LocalView,
}: CoHostSplitViewProps) {
  // 'battle' Layout nutzt dasselbe Row-Flexbox wie Side-by-Side (Bug 3 Fix)
  const isSideBySide = layout === 'side-by-side' || layout === 'battle';

  return (
    <View
      style={[s.container, isSideBySide ? s.rowDirection : s.columnDirection]}
      pointerEvents="box-none"
    >
      {/* ── Erste Hälfte: Remote Video (oben oder links) ─────── */}
      <View
        style={isSideBySide ? s.halfLeft : s.halfTop}
        pointerEvents="none"
      >
        {topTrackRef ? (
          <VideoTrack
            trackRef={topTrackRef as any}
            style={StyleSheet.absoluteFill as any}
            objectFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.placeholderBg]} />
        )}
        <View style={s.labelBadge}>
          <Text style={s.labelText}>{topLabel}</Text>
        </View>
        {/* Trennlinie am Ende der ersten Hälfte */}
        <View style={isSideBySide ? s.dividerVertical : s.dividerHorizontal} />
      </View>

      {/* ── Zweite Hälfte: Lokale Kamera (unten oder rechts) ─── */}
      <View
        style={isSideBySide ? s.halfRight : s.halfBottom}
        pointerEvents="none"
      >
        <LocalView />
        <View style={s.labelBadge}>
          <Text style={s.labelText}>{bottomLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },

  // ── Flex-Richtungen ───────────────────────────────────────
  columnDirection: {
    flexDirection: 'column',
  },
  rowDirection: {
    flexDirection: 'row',
  },

  // ── Top/Bottom Hälften ────────────────────────────────────
  halfTop: {
    width: SCREEN_W,
    height: HALF_H,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  halfBottom: {
    width: SCREEN_W,
    height: SCREEN_H - HALF_H,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  // ── Side-by-Side Hälften ──────────────────────────────────
  halfLeft: {
    width: HALF_W,
    height: SCREEN_H,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  halfRight: {
    width: SCREEN_W - HALF_W,
    height: SCREEN_H,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  // ── Placeholder wenn kein Track ───────────────────────────
  placeholderBg: {
    backgroundColor: '#0d0d1a',
  },

  // ── Trennlinien ───────────────────────────────────────────
  dividerHorizontal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dividerVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // ── Label-Badge ───────────────────────────────────────────
  labelBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  labelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});
