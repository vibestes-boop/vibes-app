/**
 * lib/useCoHost.ts
 *
 * LiveKit Duet / Co-Host Signaling via Supabase Broadcast.
 *
 * Kein neues DB-Schema nötig — alles über Broadcast-Events (wie Reaktionen).
 *
 * Broadcast-Protokoll:
 *   "co-host-request"         Viewer → Host:   { userId, username, avatarUrl }
 *   "co-host-accepted"        Host → Viewer:   { userId, layout, battleDuration? }
 *   "co-host-rejected"        Host → Viewer:   { userId, reason? }
 *   "co-host-ended"           Host → alle:     { userId } — Duet beendet
 *   "co-host-left"            Viewer → alle:   { userId } — Viewer hat Duet verlassen
 *   "co-host-layout-changed"  Host → alle:     { layout, battleDuration? } — Runtime-Switch (Phase 1.1)
 *   "co-host-muted"           Host → Co-Host:  { userId, audio?, video? } — Mute (Phase 1.2)
 *   "co-host-kicked"          Host → Co-Host:  { userId, reason, blocked } — Kick mit Grund (Phase 1.3)
 *
 * Phase 3 (Multi-Guest):
 *   Die tatsächlich-aktiven Co-Hosts einer Session werden aus der DB-Tabelle
 *   `live_cohosts` gelesen (Hook: `useLiveCoHosts`). Broadcast-Events bleiben
 *   als Soft-Signaling-Layer für schnelles UI-Feedback erhalten.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';

// ─── Broadcast-Helfer ─────────────────────────────────────────────────────────
// Fix #3: `channel.send()` kann still fehlschlagen wenn der Channel noch nicht
// im SUBSCRIBED-State ist (Race beim Mount/Reconnect). Wir prüfen das Resultat
// und retrien einmal — das verhindert, dass z.B. ein `co-host-accepted` im Nichts
// verpufft und der Viewer ewig in `requesting` hängt.
async function sendWithRetry(
  channel: ReturnType<typeof supabase.channel> | null,
  event: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (!channel) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Supabase Realtime: 'ok' | 'timed out' | 'error'
      const res: unknown = await channel.send({ type: 'broadcast', event, payload });
      if (res === 'ok') return true;
      __DEV__ && console.warn(`[CoHost] broadcast '${event}' returned:`, res, 'attempt', attempt + 1);
    } catch (err) {
      __DEV__ && console.warn(`[CoHost] broadcast '${event}' threw:`, err);
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// ─── Typen ────────────────────────────────────────────────────────────────────

/**
 * DuetLayout: bestimmt wie die beiden Video-Streams angezeigt werden.
 *   'top-bottom'   — vertikal geteilt (Standard)
 *   'side-by-side' — horizontal geteilt (50/50 nebeneinander)
 *   'pip'          — Host Vollbild + Gast als kleines draggable Fenster
 *   'battle'       — Side-by-Side + animierter Score-Balken + Countdown
 */
/**
 * DuetLayout-Varianten:
 *   1-zu-1:  'top-bottom', 'side-by-side', 'pip', 'battle'
 *   Multi:   'grid-2x2' (bis 4 Guests), 'grid-3x3' (bis 8 Guests) — Phase 3
 */
export type DuetLayout =
  | 'top-bottom'
  | 'side-by-side'
  | 'pip'
  | 'battle'
  | 'grid-2x2'
  | 'grid-3x3';

export interface CoHostRequest {
  userId: string;
  username: string;
  avatarUrl: string | null;
  requestedAt: number;
}

export type CoHostStatus =
  | 'idle'         // Kein Duet
  | 'requesting'   // Anfrage gesendet, warte auf Host-Antwort
  | 'accepted'     // Host hat angenommen → publishe Kamera/Mikro
  | 'rejected'     // Host hat abgelehnt
  | 'active';      // Duet läuft (Kamera + Mikro aktiv publiziert)

// ─── Viewer-seitig: Duet anfragen ─────────────────────────────────────────────

export function useCoHostViewer(
  sessionId: string | null,
  roomName: string | null,
) {
  const { profile } = useAuthStore();
  const [status, setStatus] = useState<CoHostStatus>('idle');
  // Layout wird vom Host bestimmt und per Broadcast übertragen
  const [layout, setLayout] = useState<DuetLayout>('top-bottom');
  // Battle-Dauer in Sekunden (nur relevant wenn layout === 'battle')
  const [battleDuration, setBattleDuration] = useState(60);
  // Phase 1.2: Mute-State vom Host gesetzt — Co-Host bekommt Mute-Request vom Host.
  // `null` = Host hat nichts expliziert gesetzt (→ Client-Standard).
  const [forceMutedAudio, setForceMutedAudio] = useState<boolean | null>(null);
  const [forceMutedVideo, setForceMutedVideo] = useState<boolean | null>(null);
  // Phase 1.3: Kick-Info (Grund + blocked-Flag) — UI kann dem User anzeigen
  // "Du wurdest vom Host entfernt. Grund: …"
  const [kickInfo, setKickInfo] = useState<{ reason: string; blocked: boolean } | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // BUG 2 Fix: Timer-Ref für den 30s-Timeout — damit er beim Unmount oder leaveCoHost gecleant werden kann
  const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Broadcast Channel aufbauen: lauscht auf Accept/Reject vom Host
  // Fix #2: Deps präzisiert auf [sessionId, profile?.id]. Vorher triggerte jeder
  // profile-Object-Re-Reference (z.B. durch Supabase Realtime-Updates an der
  // profiles-Row wie coin_balance, avatar_url) einen Channel-Resubscribe mit
  // einem ~300ms Race-Fenster, in dem Broadcasts verloren gingen.
  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (!sessionId || !profileId) return;

    const channel = supabase
      .channel(`co-host-signals-${sessionId}`)
      .on('broadcast', { event: 'co-host-accepted' }, (payload) => {
        const data = payload.payload as { userId: string; layout?: DuetLayout; battleDuration?: number };
        if (data.userId !== profileId) return; // nicht für mich
        // Layout + Battle-Dauer vom Host übernehmen
        setLayout(data.layout ?? 'top-bottom');
        if (data.battleDuration) setBattleDuration(data.battleDuration);
        setStatus('accepted');
      })
      .on('broadcast', { event: 'co-host-rejected' }, (payload) => {
        const { userId, reason } = payload.payload as { userId: string; reason?: string };
        if (userId !== profileId) return;
        setStatus('rejected');
        // Phase 1.3: wenn ein Grund dabei ist (z.B. "Du bist blockiert"), anzeigen
        if (reason) {
          setKickInfo({ reason, blocked: true });
          setTimeout(() => setKickInfo(null), 10_000);
        }
        // Nach 3s wieder auf idle zurücksetzen
        setTimeout(() => setStatus('idle'), 3000);
      })
      .on('broadcast', { event: 'co-host-ended' }, () => {
        // Host hat Duet beendet
        setStatus('idle');
        setLayout('top-bottom');
        setBattleDuration(60);
      })
      .on('broadcast', { event: 'co-host-layout-changed' }, (payload) => {
        // Phase 1.1: Host hat das Layout live geändert — sowohl aktiver Co-Host
        // als auch normale Viewer sollen das neue Layout sofort sehen.
        const data = payload.payload as { layout: DuetLayout; battleDuration?: number };
        setLayout(data.layout);
        if (typeof data.battleDuration === 'number') {
          setBattleDuration(data.battleDuration);
        }
      })
      .on('broadcast', { event: 'co-host-muted' }, (payload) => {
        // Phase 1.2: Host fordert Mute/Unmute eines spezifischen Co-Hosts an.
        // Nur relevant wenn ich der adressierte User bin.
        const data = payload.payload as {
          userId: string;
          audio?: boolean;
          video?: boolean;
        };
        if (data.userId !== profileId) return;
        if (typeof data.audio === 'boolean') setForceMutedAudio(data.audio);
        if (typeof data.video === 'boolean') setForceMutedVideo(data.video);
      })
      .on('broadcast', { event: 'co-host-kicked' }, (payload) => {
        // Phase 1.3: Host hat mich aus dem Duet geworfen mit optionalem Grund.
        // Lokaler State zurücksetzen; UI zeigt kickInfo in einem Alert.
        const data = payload.payload as {
          userId: string;
          reason: string;
          blocked: boolean;
        };
        if (data.userId !== profileId) return;
        setKickInfo({ reason: data.reason, blocked: data.blocked });
        setStatus('rejected');
        setLayout('top-bottom');
        setForceMutedAudio(null);
        setForceMutedVideo(null);
        // Nach 10s Info wieder ausblenden (User hat Alert gesehen)
        setTimeout(() => {
          setKickInfo(null);
          setStatus((prev) => (prev === 'rejected' ? 'idle' : prev));
        }, 10_000);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      // BUG 2 Fix: Timeout beim Unmount cleanen
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, profileId]);

  // Anfrage senden
  // Fix #3: async + Retry. Schlägt der Send fehl, setzen wir Status sofort
  // wieder auf 'idle' — sonst bliebe der User ewig im "warte auf Host"-State.
  const requestJoin = useCallback(async () => {
    if (!sessionId || !profile || status !== 'idle') return;
    setStatus('requesting');

    const ok = await sendWithRetry(channelRef.current, 'co-host-request', {
      userId: profile.id,
      username: profile.username,
      avatarUrl: profile.avatar_url ?? null,
      requestedAt: Date.now(),
    });

    if (!ok) {
      __DEV__ && console.warn('[CoHost] request broadcast konnte nicht zugestellt werden');
      setStatus('idle');
      return;
    }

    // BUG 2 Fix: Timer-Ref spichern → sauber cleanen beim Unmount oder leaveCoHost
    if (requestTimeoutRef.current) clearTimeout(requestTimeoutRef.current);
    requestTimeoutRef.current = setTimeout(() => {
      requestTimeoutRef.current = null;
      setStatus((prev) => (prev === 'requesting' ? 'idle' : prev));
    }, 30_000);
  }, [sessionId, profile, status]);

  // Duet verlassen (Viewer verlässt aktiv)
  // Fix #3: async — Host erfährt sonst nie vom Leave wenn der Send still fehlschlägt.
  const leaveCoHost = useCallback(async () => {
    if (!profile) return;
    // BUG 2 Fix: ausstehenden Anfrage-Timeout löschen
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
    // Lokaler State sofort zurücksetzen (UX muss nicht auf Netz warten)
    setStatus('idle');
    setLayout('top-bottom');
    // Best-Effort Broadcast — Host hat zusätzlich ParticipantDisconnected als Fallback
    await sendWithRetry(channelRef.current, 'co-host-left', {
      userId: profile.id,
    });
  }, [profile]);

  // Wenn Status 'accepted' → zu 'active' wechseln (nach Track-Publish)
  const markActive = useCallback(() => setStatus('active'), []);

  // Phase 1.3: Kick-Info explizit dismissen (nach Anzeige in Alert)
  const dismissKickInfo = useCallback(() => setKickInfo(null), []);

  // v1.19 Duett: Viewer hat DB-Invite (host-to-viewer) angenommen → direkt in
  // 'accepted'-Status springen (wie wenn ein co-host-accepted Broadcast
  // angekommen wäre). Der Publish-Flow im UI reagiert dann wie gewohnt.
  //
  // Zusätzlich: 30s Timeout-Fallback (parallel zu requestJoin), damit der
  // Viewer nicht ewig in 'accepted' hängt, falls der anschließende Publish
  // hakt (z.B. LiveKit-Token-Fetch oder Track-Publish timeouts ohne Fehler).
  // Wenn markActive rechtzeitig kommt, ist status bereits 'active' und der
  // Guard `prev === 'accepted'` lässt den Timeout harmlos verpuffen.
  const acceptFromInvite = useCallback(
    (inviteLayout: DuetLayout, inviteBattleDuration?: number) => {
      // Ausstehenden Request-Timeout löschen (falls aktiv)
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
        requestTimeoutRef.current = null;
      }
      setLayout(inviteLayout);
      if (typeof inviteBattleDuration === 'number') {
        setBattleDuration(inviteBattleDuration);
      }
      setStatus('accepted');
      // Safety-net: wenn nach 30s kein markActive() aufgerufen wurde, zurück
      // auf idle, damit der User die Session verlassen / neu anfragen kann.
      requestTimeoutRef.current = setTimeout(() => {
        requestTimeoutRef.current = null;
        setStatus((prev) => (prev === 'accepted' ? 'idle' : prev));
      }, 30_000);
    },
    [],
  );

  return {
    status,
    layout,
    battleDuration,
    forceMutedAudio,
    forceMutedVideo,
    kickInfo,
    requestJoin,
    leaveCoHost,
    markActive,
    dismissKickInfo,
    acceptFromInvite,
  };
}

// ─── Host-seitig: eingehende Requests empfangen ────────────────────────────────

export function useCoHostHost(sessionId: string | null) {
  // Phase 2: Queue statt einzelner Request. `pendingRequest` bleibt als
  // Convenience-Prop (erstes Element) für die bestehende Alert-UI.
  const [pendingRequests, setPendingRequests] = useState<CoHostRequest[]>([]);
  const pendingRequest = pendingRequests[0] ?? null;
  const queueDepth = pendingRequests.length;
  const [activeCoHostId, setActiveCoHostId] = useState<string | null>(null);
  const [activeLayout, setActiveLayout] = useState<DuetLayout>('top-bottom');
  const [activeBattleDuration, setActiveBattleDuration] = useState(60);
  // Phase 1.2: Host-seitiger Mute-State pro aktiver Co-Host-Session.
  // Wird beim Duet-Ende auf false/false zurückgesetzt.
  const [coHostMutedAudio, setCoHostMutedAudio] = useState(false);
  const [coHostMutedVideo, setCoHostMutedVideo] = useState(false);
  // Phase 1.3: Client-seitiger Blocklist für die laufende Session. Gekickte
  // User mit blocked=true dürfen während derselben Session nicht erneut
  // requesten. Ref reicht — Auto-Reject läuft im Broadcast-Handler (ohne Render).
  const blockedUsersRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Ref verhindert Channel-Re-Subscribe wenn activeCoHostId sich ändert
  const activeCoHostIdRef = useRef<string | null>(null);
  // v1.27.3: sessionId als Ref halten, damit muteCoHost-useCallback stabil
  // bleibt und nicht bei jedem Render neu allokiert (wichtig für React.memo
  // in der Host-UI, sonst ständige Re-Renders der Mute-Buttons).
  const sessionIdRef = useRef<string | null>(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Ref immer aktuell halten
  useEffect(() => { activeCoHostIdRef.current = activeCoHostId; }, [activeCoHostId]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`co-host-signals-${sessionId}`)
      .on('broadcast', { event: 'co-host-request' }, (payload) => {
        const req = payload.payload as CoHostRequest;
        // Phase 1.3: Geblockte User sofort auto-rejecten — ohne UI-Prompt.
        if (blockedUsersRef.current.has(req.userId)) {
          channelRef.current?.send({
            type:    'broadcast',
            event:   'co-host-rejected',
            payload: { userId: req.userId, reason: 'Du wurdest vom Host blockiert.' },
          });
          return;
        }
        // Phase 2: Kein Auto-Reject mehr wenn bereits jemand pending oder aktiv.
        // Wir sammeln alle Requests in der Queue. Dedupe: gleicher User nur 1x.
        setPendingRequests((prev) => {
          // Bereits aktiver Co-Host? Ignorieren (kein Re-Request während aktiv).
          if (req.userId === activeCoHostIdRef.current) return prev;
          // Dedupe: User schon in Queue? Einfach Timestamp erneuern (move to end).
          const filtered = prev.filter((r) => r.userId !== req.userId);
          // Max-Queue-Länge: 20 (schutz gegen Spam).
          if (filtered.length >= 20) return filtered;
          return [...filtered, req];
        });
      })
      .on('broadcast', { event: 'co-host-left' }, (payload) => {
        const { userId } = payload.payload as { userId: string };
        if (userId === activeCoHostIdRef.current) {
          setActiveCoHostId(null);
          setActiveLayout('top-bottom');
          setActiveBattleDuration(60);
          // Phase 1.2: Mute-State zurücksetzen (Leeraktion falls nicht gesetzt)
          setCoHostMutedAudio(false);
          setCoHostMutedVideo(false);
        }
        // Phase 2: User hat sein Request zurückgezogen (verlässt die Live).
        // Aus Queue entfernen wenn er drin war.
        setPendingRequests((prev) => prev.filter((r) => r.userId !== userId));
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId]); // activeCoHostId BEWUSST NICHT in Dependencies

  // Request annehmen — mit Wahl des Layouts und optionaler Battle-Dauer
  // Fix #3: async + Retry. Das war der kritischste stille Failure: Host dachte
  // er hat akzeptiert (lokaler State gesetzt), Viewer erfuhr nichts → Duet-Gap.
  const acceptCoHost = useCallback(async (
    userId: string,
    layout: DuetLayout = 'top-bottom',
    battleDuration = 60,
  ): Promise<boolean> => {
    const ok = await sendWithRetry(channelRef.current, 'co-host-accepted', {
      userId,
      layout,
      battleDuration,
    });
    if (!ok) {
      __DEV__ && console.warn('[CoHost] accept broadcast konnte nicht zugestellt werden');
      return false;
    }
    setActiveCoHostId(userId);
    setActiveLayout(layout);
    setActiveBattleDuration(battleDuration);
    // Phase 2: Aus Queue entfernen + alle anderen pending Requests behalten.
    // Sie bleiben in der Queue bis der Host sie bearbeitet oder das Duet endet.
    setPendingRequests((prev) => prev.filter((r) => r.userId !== userId));
    return true;
  }, []);

  // Request ablehnen
  // Fix #3: async — Viewer bleibt sonst im 'requesting' und muss auf den 30s-Timeout warten.
  // Phase 5: optionaler Grund (z.B. "Du bist vom Host blockiert") wird an den
  // Viewer durchgereicht und dort als Alert angezeigt (siehe `co-host-rejected`-Handler).
  const rejectCoHost = useCallback(async (userId: string, reason?: string) => {
    await sendWithRetry(channelRef.current, 'co-host-rejected', {
      userId,
      ...(reason ? { reason } : {}),
    });
    // Phase 2: Nur den abgelehnten User aus der Queue entfernen, Rest bleibt.
    setPendingRequests((prev) => prev.filter((r) => r.userId !== userId));
  }, []);

  // Duet beenden (Host beendet Duet)
  // Fix #3: async — Viewer muss zuverlässig erfahren, dass sein Publisher-Slot weg ist.
  const endCoHost = useCallback(async () => {
    const exId = activeCoHostIdRef.current;
    // Lokal sofort resetten (Host-UX reagiert instant)
    setActiveCoHostId(null);
    setActiveLayout('top-bottom');
    setActiveBattleDuration(60);
    // Phase 1.2: Mute-Flags zurücksetzen, sonst würde ein zukünftiger Co-Host
    // mit altem Mute-Zustand starten.
    setCoHostMutedAudio(false);
    setCoHostMutedVideo(false);
    await sendWithRetry(channelRef.current, 'co-host-ended', { userId: exId });
  }, []); // activeCoHostIdRef ist stabil → keine Dependencies nötig

  // v1.27.3: Host kann Audio/Video des aktiven Co-Hosts separat muten/unmuten —
  // serverseitig durchgesetzt via LiveKit RoomService/MutePublishedTrack.
  //
  // Vorher (Phase 1.2, broadcast-only): Client-Trust. Ein manipulierter CoHost-
  // Client konnte den `co-host-muted`-Broadcast ignorieren und weiter audio/video
  // publishen. Host sah „Mikro aus" in der UI, der Stream hörte weiter den CoHost.
  //
  // Jetzt: Parallel-Flow.
  //   1) Broadcast `co-host-muted` → instant UI-Sync auf dem CoHost-Client
  //      (Mute-Button-State, Mic-Icon). Kann vom CoHost ignoriert werden.
  //   2) Edge Function `livekit-moderate` → LiveKit muted den Track serverseitig.
  //      Durchgesetzt unabhängig vom Client. Das ist die Authority.
  //
  // Failure-Modes:
  //   - Broadcast OK, Edge Function fehlgeschlagen (Netz, LiveKit down):
  //     Trust-Fallback — honest-acting Client mutet eh; manipulierter Client
  //     kommt durch, aber Host sieht in der UI den Error (wird in den Host-UI-
  //     Callern geloggt via __DEV__).
  //   - Broadcast fehlgeschlagen, Edge Function OK:
  //     Track IST gemuted serverseitig. CoHost-UI ist nur „veraltet" — beim
  //     nächsten Track-Subscribe-Event korrigiert sich LiveKit selbst.
  //   - Beide fehlgeschlagen:
  //     `ok = false` zurückgegeben; Host-UI kann Retry anbieten.
  const muteCoHost = useCallback(async (
    opts: { audio?: boolean; video?: boolean },
  ): Promise<boolean> => {
    const uid = activeCoHostIdRef.current;
    if (!uid) return false;

    // Lokal sofort für die Host-UI setzen (Button-Feedback instant)
    if (typeof opts.audio === 'boolean') setCoHostMutedAudio(opts.audio);
    if (typeof opts.video === 'boolean') setCoHostMutedVideo(opts.video);

    const payload: Record<string, unknown> = { userId: uid };
    if (typeof opts.audio === 'boolean') payload.audio = opts.audio;
    if (typeof opts.video === 'boolean') payload.video = opts.video;

    // Parallel: Broadcast (UI-Sync) + Edge Function (Server-Enforcement).
    // Promise.all wartet auf beides, aber beide Fehlermodi werden sauber getrennt.
    const sid = sessionIdRef.current;
    const [broadcastOk, serverOk] = await Promise.all([
      sendWithRetry(channelRef.current, 'co-host-muted', payload),
      sid
        ? supabase.functions
            .invoke('livekit-moderate', {
              body: { sessionId: sid, targetUserId: uid, mute: opts },
            })
            .then((res) => {
              if (res.error) {
                __DEV__ && console.warn('[CoHost] livekit-moderate invoke error:', res.error);
                return false;
              }
              return true;
            })
            .catch((err) => {
              __DEV__ && console.warn('[CoHost] livekit-moderate threw:', err);
              return false;
            })
        : Promise.resolve(false),
    ]);

    if (!broadcastOk) {
      __DEV__ && console.warn('[CoHost] mute broadcast konnte nicht zugestellt werden');
    }
    if (!serverOk) {
      __DEV__ && console.warn('[CoHost] mute server-enforcement fehlgeschlagen — nur Broadcast-Trust aktiv');
    }
    // Erfolg wenn mindestens eine Ebene durchgekommen ist. Wenn beide tot sind,
    // ist das ein harter Netzwerkausfall — Host-UI soll dann Retry anbieten.
    return broadcastOk || serverOk;
  }, []);

  // Phase 1.3: Co-Host rausschmeißen mit optionalem Grund + Block.
  // Unterschied zu `endCoHost`: sendet eigenes Event mit Grund an den Co-Host
  // (→ der sieht einen Alert) und optional blockiert ihn für die restliche Session.
  // Server-Seite: zusätzlich RPC `revoke_cohost` aufrufen (siehe Host-UI).
  const kickCoHost = useCallback(async (
    reason: string,
    blocked: boolean = true,
  ): Promise<boolean> => {
    const uid = activeCoHostIdRef.current;
    if (!uid) return false;

    // Blocklist updaten BEVOR wir senden, sonst könnte ein Re-Request vor dem
    // State-Update durchrutschen.
    if (blocked) {
      blockedUsersRef.current.add(uid);
    }

    // Lokal sofort resetten (gleich wie endCoHost)
    setActiveCoHostId(null);
    setActiveLayout('top-bottom');
    setActiveBattleDuration(60);
    setCoHostMutedAudio(false);
    setCoHostMutedVideo(false);

    // Broadcast mit Grund → Co-Host zeigt Alert
    const ok = await sendWithRetry(channelRef.current, 'co-host-kicked', {
      userId: uid,
      reason,
      blocked,
    });
    // Zusätzlich reguläres "ended" senden, damit alle normalen Viewer ihre
    // Duet-Anzeige zurücksetzen.
    await sendWithRetry(channelRef.current, 'co-host-ended', { userId: uid });
    return ok;
  }, []);

  // Phase 1.3: Manuell entblocken (Host Undo)
  const unblockCoHostUser = useCallback((userId: string) => {
    blockedUsersRef.current.delete(userId);
  }, []);

  // Phase 1.1: Layout zur Laufzeit ändern (ohne Duet beenden zu müssen).
  // Host kann zwischen 'top-bottom', 'side-by-side', 'pip', 'battle' wechseln.
  // Bei Wechsel NACH 'battle' wird optional auch eine neue Dauer gesetzt.
  const changeLayout = useCallback(async (
    layout: DuetLayout,
    battleDuration?: number,
  ): Promise<boolean> => {
    // Nur sinnvoll wenn tatsächlich ein Co-Host aktiv ist
    if (!activeCoHostIdRef.current) return false;

    // Lokal sofort optimistic setzen (Host sieht den Switch instant)
    setActiveLayout(layout);
    if (typeof battleDuration === 'number') {
      setActiveBattleDuration(battleDuration);
    }

    const ok = await sendWithRetry(channelRef.current, 'co-host-layout-changed', {
      layout,
      ...(typeof battleDuration === 'number' ? { battleDuration } : {}),
    });
    if (!ok) {
      __DEV__ && console.warn('[CoHost] layout-change broadcast konnte nicht zugestellt werden');
    }
    return ok;
  }, []);

  // Phase 2: Alle Requests außer einem (per userId) aus der Queue ziehen.
  // Genutzt vom BottomSheet-UI wenn der Host gezielt einen Request wählt.
  const pickFromQueue = useCallback((userId: string): CoHostRequest | null => {
    const req = pendingRequests.find((r) => r.userId === userId) ?? null;
    return req;
  }, [pendingRequests]);

  // Phase 2: Ganze Queue leeren (z.B. bei Live-Ende)
  const clearQueue = useCallback(() => {
    setPendingRequests([]);
  }, []);

  // Back-compat: alte setPendingRequest-API als No-op-kompatibler Wrapper auf
  // shift/clear. Manche Call-Sites rufen `setPendingRequest(null)` — das
  // mappen wir auf "vorderstes Element entfernen".
  const setPendingRequest = useCallback(
    (arg: CoHostRequest | null | ((prev: CoHostRequest | null) => CoHostRequest | null)) => {
      if (typeof arg === 'function') {
        setPendingRequests((prev) => {
          const next = arg(prev[0] ?? null);
          if (next === null) return prev.slice(1);
          // wenn next ein Request-Objekt ist, ersetze das vorderste
          return [next, ...prev.slice(1)];
        });
      } else if (arg === null) {
        setPendingRequests((prev) => prev.slice(1));
      } else {
        setPendingRequests((prev) => [arg, ...prev.slice(1)]);
      }
    },
    [],
  );

  return {
    pendingRequest,
    pendingRequests,
    queueDepth,
    activeCoHostId,
    activeLayout,
    activeBattleDuration,
    coHostMutedAudio,
    coHostMutedVideo,
    acceptCoHost,
    rejectCoHost,
    endCoHost,
    changeLayout,
    muteCoHost,
    kickCoHost,
    unblockCoHostUser,
    pickFromQueue,
    clearQueue,
    setPendingRequest,
  };
}

// ─── Phase 3: Multi-Guest — aktive Co-Hosts pro Session ─────────────────────
//
// Liest die `live_cohosts` Tabelle und hält sie via Supabase Realtime
// (postgres_changes auf dem Table selbst) synchron. Funktioniert für Host
// UND Viewer, damit beide Seiten dieselbe Grid-Ordnung sehen.
//
// Returngröße: 0 (kein Co-Host) bis 8 (Maximum).
// Ordering: nach `slot_index` (0..7) aufsteigend — stabil zwischen Reconnects.

export interface ActiveCoHost {
  userId: string;
  username: string;
  avatarUrl: string | null;
  slotIndex: number;
  approvedAt: string;
}

interface CoHostRow {
  user_id: string;
  slot_index: number;
  approved_at: string;
  revoked_at: string | null;
  profiles: { username: string | null; avatar_url: string | null } | null;
}

export function useLiveCoHosts(sessionId: string | null | undefined): {
  cohosts: ActiveCoHost[];
  loading: boolean;
} {
  const [cohosts, setCohosts] = useState<ActiveCoHost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Stable normaliser — mappt DB-Zeile → UI-Form.
  const toActive = useCallback((row: CoHostRow): ActiveCoHost => ({
    userId:     row.user_id,
    username:   row.profiles?.username   ?? '…',
    avatarUrl:  row.profiles?.avatar_url ?? null,
    slotIndex:  row.slot_index ?? 0,
    approvedAt: row.approved_at,
  }), []);

  // Separater Fetch-Helfer: wird nach jedem postgres_change getriggert, weil
  // INSERT-Payload das `profiles`-Join nicht enthält (Realtime gibt nur Row).
  const fetchCoHosts = useCallback(async (sid: string) => {
    const { data, error } = await supabase
      .from('live_cohosts')
      .select('user_id, slot_index, approved_at, revoked_at, profiles(username, avatar_url)')
      .eq('session_id', sid)
      .is('revoked_at', null)
      .order('slot_index', { ascending: true });

    if (error) {
      __DEV__ && console.warn('[useLiveCoHosts] fetch error:', error);
      return;
    }

    const rows = (data ?? []) as unknown as CoHostRow[];
    setCohosts(rows.map(toActive));
  }, [toActive]);

  useEffect(() => {
    if (!sessionId) {
      setCohosts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      await fetchCoHosts(sessionId);
      if (!cancelled) setLoading(false);
    })();

    // Realtime-Subscription für diese Session.
    // Wir horchen auf INSERT/UPDATE/DELETE und fetchen dann neu — simpler
    // als lokales Merging und vermeidet Drift bei Kapazitäts-Edge-Cases.
    const channel = supabase
      .channel(`live-cohosts-table-${sessionId}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'live_cohosts',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          if (!cancelled) void fetchCoHosts(sessionId);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId, fetchCoHosts]);

  return { cohosts, loading };
}
