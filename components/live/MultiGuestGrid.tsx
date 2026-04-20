/**
 * components/live/MultiGuestGrid.tsx — Phase 3
 *
 * Rendert bis zu 9 Video-Tiles (Host + max. 8 Co-Hosts) in einem Grid.
 *
 * Design:
 *   - 2×2 Grid:  Host + 3 Co-Hosts   (je 50% Breite, 50% Höhe)
 *   - 3×3 Grid:  Host + bis 8 Co-Hosts (je 33% Breite, 33% Höhe)
 *   - Leere Slots bleiben schwarz — stabile Grid-Ordnung via `slotIndex`.
 *
 * Die Host-Tile wird vom Parent übergeben (als `hostTile` render prop), weil
 * der Host seine eigene Kamera lokal rendert (useLocalCameraTrack), während
 * der Viewer den Host als Remote-Participant empfängt.
 *
 * Für jede Co-Host-Tile greifen wir via `RoomContext` auf den LiveKit-Room
 * zu und suchen den Remote-Participant mit `identity === userId`.
 */

import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { VideoTrack } from '@livekit/react-native';
import { RoomContext } from '@livekit/components-react';
import {
  Track,
  RoomEvent,
  type Participant,
  type TrackPublication,
} from 'livekit-client';
import type { ActiveCoHost } from '@/lib/useCoHost';

// ─── Einzelne Remote-Tile (Co-Host) ────────────────────────────────────
function RemoteTile({ cohost }: { cohost: ActiveCoHost }) {
  const room = useContext(RoomContext);
  const [trackRef, setTrackRef] = useState<{
    participant: Participant;
    publication: TrackPublication;
    source: Track.Source;
  } | null>(null);
  const [micMuted, setMicMuted] = useState(false);

  useEffect(() => {
    if (!room || !cohost.userId) return;

    const syncTrack = () => {
      for (const [, participant] of room.remoteParticipants) {
        if (participant.identity === cohost.userId) {
          // Video
          const pub = participant.getTrackPublication(Track.Source.Camera);
          if (pub && pub.track) {
            setTrackRef({
              participant,
              publication: pub,
              source: Track.Source.Camera,
            });
          } else {
            setTrackRef(null);
          }
          // Audio-Indicator
          const micPub = participant.getTrackPublication(Track.Source.Microphone);
          setMicMuted(!micPub || micPub.isMuted || !micPub.track);
          return;
        }
      }
      setTrackRef(null);
      setMicMuted(true);
    };

    syncTrack();
    const events = [
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
    ] as const;
    events.forEach((ev) => room.on(ev, syncTrack));
    return () => {
      events.forEach((ev) => room.off(ev, syncTrack));
    };
  }, [room, cohost.userId]);

  return (
    <View style={tileStyles.tile}>
      {trackRef ? (
        <VideoTrack
          trackRef={trackRef as any}
          style={StyleSheet.absoluteFill as any}
          objectFit="cover"
        />
      ) : (
        // Fallback: Avatar + Username während Video lädt
        <View style={tileStyles.placeholder}>
          {cohost.avatarUrl ? (
            <Image
              source={{ uri: cohost.avatarUrl }}
              style={tileStyles.avatar}
            />
          ) : (
            <View style={[tileStyles.avatar, { backgroundColor: '#1e1e2e' }]} />
          )}
          <Text style={tileStyles.loadingText}>verbindet…</Text>
        </View>
      )}
      <View style={tileStyles.label}>
        <Text style={tileStyles.labelText} numberOfLines={1}>
          {micMuted ? '🔇 ' : ''}@{cohost.username}
        </Text>
      </View>
    </View>
  );
}

// ─── Grid Container ────────────────────────────────────────────────────
interface Props {
  /** Aktive Co-Hosts (aus useLiveCoHosts), max 8 */
  cohosts: ActiveCoHost[];
  /** Grid-Größe: 2x2 (bis 4 Tiles) oder 3x3 (bis 9 Tiles) */
  mode: 'grid-2x2' | 'grid-3x3';
  /**
   * Host-Tile Render-Prop. Parent entscheidet, ob Host als Local-Camera
   * (host.tsx) oder Remote-Participant (watch/[id].tsx) dargestellt wird.
   */
  hostTile: React.ReactNode;
}

export function MultiGuestGrid({ cohosts, mode, hostTile }: Props) {
  const totalSlots = mode === 'grid-2x2' ? 4 : 9;
  const columns    = mode === 'grid-2x2' ? 2 : 3;

  // Slot-Array bauen: Index 0 = Host, 1..n = Co-Hosts nach slotIndex sortiert.
  const sorted = [...cohosts].sort((a, b) => a.slotIndex - b.slotIndex);
  const limited = sorted.slice(0, totalSlots - 1);

  const tileWidthPct  = `${100 / columns}%`;
  const tileHeightPct = `${100 / columns}%`;

  return (
    <View style={styles.container}>
      {/* Host-Tile */}
      <View style={[styles.tile, { width: tileWidthPct as any, height: tileHeightPct as any }]}>
        {hostTile}
        <View style={[tileStyles.label, tileStyles.hostLabel]}>
          <Text style={tileStyles.labelText}>👑 Host</Text>
        </View>
      </View>

      {/* Co-Host-Tiles */}
      {limited.map((ch) => (
        <View
          key={ch.userId}
          style={[styles.tile, { width: tileWidthPct as any, height: tileHeightPct as any }]}
        >
          <RemoteTile cohost={ch} />
        </View>
      ))}

      {/* Leere Slots auffüllen (für symmetrisches Grid) */}
      {Array.from({ length: Math.max(0, totalSlots - limited.length - 1) }).map((_, i) => (
        <View
          key={`empty-${i}`}
          style={[
            styles.tile,
            styles.emptyTile,
            { width: tileWidthPct as any, height: tileHeightPct as any },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#000',
  },
  tile: {
    backgroundColor: '#0d0d1a',
    borderWidth: 0.5,
    borderColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyTile: {
    backgroundColor: '#0a0a12',
  },
});

const tileStyles = StyleSheet.create({
  tile: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0d1a',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#222',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  label: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: '85%',
  },
  hostLabel: {
    backgroundColor: 'rgba(147,51,234,0.75)', // purple — Host-Badge
  },
  labelText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
