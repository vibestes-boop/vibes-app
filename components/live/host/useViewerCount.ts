import { useContext, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { RoomContext } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';

export function useViewerCount(sessionId: string) {
  const room = useContext(RoomContext);
  const [viewerCount, setViewerCount] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);

  useEffect(() => {
    if (!room) return;

    const update = () => {
      // Co-Hosts (Publisher mit Kamera) nicht als Zuschauer zählen
      let count = 0;
      for (const [, participant] of room.remoteParticipants) {
        const hasCameraTrack = participant.getTrackPublication(Track.Source.Camera);
        if (!hasCameraTrack) count++;
      }
      setViewerCount(count);
      setPeakViewers((prev) => Math.max(prev, count));
    };

    update();

    room.on(RoomEvent.ParticipantConnected, update);
    room.on(RoomEvent.ParticipantDisconnected, update);
    return () => {
      room.off(RoomEvent.ParticipantConnected, update);
      room.off(RoomEvent.ParticipantDisconnected, update);
    };
  }, [room]);

  // Sync count back to DB every 5s + Heartbeat alle 60s
  const lastSyncedRef = useRef<{ count: number; peak: number; lastHeartbeat: number }>({ count: -1, peak: -1, lastHeartbeat: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const needsHeartbeat = now - lastSyncedRef.current.lastHeartbeat > 60_000;
      if (
        lastSyncedRef.current.count === viewerCount &&
        lastSyncedRef.current.peak  === peakViewers &&
        !needsHeartbeat
      ) return;
      lastSyncedRef.current = { count: viewerCount, peak: peakViewers, lastHeartbeat: needsHeartbeat ? now : lastSyncedRef.current.lastHeartbeat };
      supabase
        .from('live_sessions')
        .update({ viewer_count: viewerCount, peak_viewers: peakViewers, updated_at: new Date().toISOString() })
        .eq('id', sessionId)
        .then();
    }, 5000);
    return () => clearInterval(interval);
  }, [viewerCount, peakViewers, sessionId]);

  return { viewerCount, peakViewers };
}
