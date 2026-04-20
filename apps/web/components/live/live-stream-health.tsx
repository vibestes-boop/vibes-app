'use client';

import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  Room,
  Track,
  LocalVideoTrack,
  LocalAudioTrack,
  ConnectionQuality,
  type LocalTrackPublication,
} from 'livekit-client';
import { Activity, Wifi, WifiOff } from 'lucide-react';

// -----------------------------------------------------------------------------
// LiveStreamHealth — zeigt Bitrate / FPS / Connection-Quality.
//
// Polling (2s) statt Event-Listening, weil `webrtc.getStats()` asynchron ist
// und wir nur alle paar Sekunden refreshen wollen — Sub-Second-Updates wären
// nur unnötiger UI-Jitter.
//
// Metriken:
//  • videoBitrateKbps  — Up-bitrate des Kamera-Tracks (Sender-Stats)
//  • fps               — FPS des Kamera-Tracks
//  • audioBitrateKbps  — Up-bitrate des Mic-Tracks
//  • quality           — LiveKit ConnectionQuality (Excellent/Good/Poor)
// -----------------------------------------------------------------------------

interface HealthStats {
  videoBitrateKbps: number;
  fps: number;
  audioBitrateKbps: number;
  quality: ConnectionQuality;
}

const EMPTY_STATS: HealthStats = {
  videoBitrateKbps: 0,
  fps: 0,
  audioBitrateKbps: 0,
  quality: ConnectionQuality.Unknown,
};

export interface LiveStreamHealthProps {
  room: MutableRefObject<Room | null>;
  phase: 'connecting' | 'live' | 'error' | 'ending' | 'ended';
}

export function LiveStreamHealth({ room, phase }: LiveStreamHealthProps) {
  const [stats, setStats] = useState<HealthStats>(EMPTY_STATS);
  const prevBytesRef = useRef<{ video: number; audio: number; ts: number } | null>(null);

  useEffect(() => {
    if (phase !== 'live') {
      setStats(EMPTY_STATS);
      prevBytesRef.current = null;
      return;
    }

    async function sample() {
      const r = room.current;
      if (!r) return;

      const camPub = Array.from(r.localParticipant.trackPublications.values()).find(
        (p) => p.source === Track.Source.Camera,
      ) as LocalTrackPublication | undefined;
      const micPub = Array.from(r.localParticipant.trackPublications.values()).find(
        (p) => p.source === Track.Source.Microphone,
      ) as LocalTrackPublication | undefined;

      let videoBytes = 0;
      let videoFps = 0;
      let audioBytes = 0;

      if (camPub?.track) {
        try {
          const report = await (camPub.track as LocalVideoTrack).getRTCStatsReport();
          if (report) {
            report.forEach((stat: unknown) => {
              const s = stat as {
                type?: string;
                kind?: string;
                mediaType?: string;
                bytesSent?: number;
                framesPerSecond?: number;
              };
              if (s.type === 'outbound-rtp' && (s.kind === 'video' || s.mediaType === 'video')) {
                videoBytes += s.bytesSent ?? 0;
                videoFps = Math.max(videoFps, s.framesPerSecond ?? 0);
              }
            });
          }
        } catch {
          // getRTCStatsReport kann fehlen wenn Publish gerade startet
        }
      }

      if (micPub?.track) {
        try {
          const report = await (micPub.track as LocalAudioTrack).getRTCStatsReport();
          if (report) {
            report.forEach((stat: unknown) => {
              const s = stat as {
                type?: string;
                kind?: string;
                mediaType?: string;
                bytesSent?: number;
              };
              if (s.type === 'outbound-rtp' && (s.kind === 'audio' || s.mediaType === 'audio')) {
                audioBytes += s.bytesSent ?? 0;
              }
            });
          }
        } catch {
          // siehe oben
        }
      }

      const now = performance.now();
      const prev = prevBytesRef.current;
      prevBytesRef.current = { video: videoBytes, audio: audioBytes, ts: now };

      if (!prev) return;

      const deltaSec = (now - prev.ts) / 1000;
      if (deltaSec <= 0) return;

      const videoBitrateKbps = Math.max(
        0,
        Math.round(((videoBytes - prev.video) * 8) / 1000 / deltaSec),
      );
      const audioBitrateKbps = Math.max(
        0,
        Math.round(((audioBytes - prev.audio) * 8) / 1000 / deltaSec),
      );

      setStats({
        videoBitrateKbps,
        fps: Math.round(videoFps),
        audioBitrateKbps,
        quality: r.localParticipant.connectionQuality,
      });
    }

    const id = window.setInterval(() => {
      void sample();
    }, 2000);
    void sample(); // Initial
    return () => window.clearInterval(id);
  }, [phase, room]);

  const qualityLabel =
    stats.quality === ConnectionQuality.Excellent
      ? 'Exzellent'
      : stats.quality === ConnectionQuality.Good
        ? 'Gut'
        : stats.quality === ConnectionQuality.Poor
          ? 'Schlecht'
          : stats.quality === ConnectionQuality.Lost
            ? 'Verloren'
            : '–';

  const qualityColor =
    stats.quality === ConnectionQuality.Excellent
      ? 'text-green-500'
      : stats.quality === ConnectionQuality.Good
        ? 'text-green-400'
        : stats.quality === ConnectionQuality.Poor
          ? 'text-orange-500'
          : stats.quality === ConnectionQuality.Lost
            ? 'text-red-500'
            : 'text-muted-foreground';

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        Health
      </h3>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Metric label="Video" value={`${stats.videoBitrateKbps} kbps`} />
        <Metric label="FPS" value={`${stats.fps}`} />
        <Metric label="Audio" value={`${stats.audioBitrateKbps} kbps`} />
        <Metric
          label="Netz"
          value={
            <span className={`inline-flex items-center gap-1 ${qualityColor}`}>
              {stats.quality === ConnectionQuality.Lost ? (
                <WifiOff className="h-3.5 w-3.5" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
              )}
              {qualityLabel}
            </span>
          }
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}
