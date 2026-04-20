/**
 * lib/useDuett.ts
 *
 * v1.19.0 — Duett-System (TikTok-style).
 *
 * DB-gestützter Invite-Flow für 1-zu-1-Duette zusätzlich zum bestehenden
 * Broadcast-Layer aus `useCoHost.ts`. Beide Welten ergänzen sich:
 *
 *   • DB (`live_duet_invites`)  — persistent, atomar, RLS-geschützt.
 *     Genutzt für gezielte Einladungen (Host → User) und persistente
 *     Beitrittsanfragen (User → Host) plus History (`live_duet_history`).
 *
 *   • Broadcast (`co-host-*`)   — flüchtig, niedrige Latenz.
 *     Bleibt aktiv für Layout-Switches, Mute, Kick. Nach Accept eines
 *     DB-Invites löst der Client den existierenden Co-Host Flow aus
 *     (LiveKit-Token holen + Tracks publishen).
 *
 * Drei Hook-Familien:
 *
 *   useDuettInviter(sessionId)
 *      → Host- oder Viewer-seitig: Invite verschicken (an Viewer bzw. Host)
 *      → Eigene ausgehende pending Invites verfolgen + zurückziehen
 *
 *   useDuettInbox()
 *      → Empfänger-seitig: kommende Invites in Realtime
 *      → Accept/Decline RPCs
 *
 *   useDuettHistory(userId, limit)
 *      → Profil/Studio: Liste vergangener Duette (als Host ODER Gast)
 */

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';
import type { DuetLayout } from './useCoHost';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DuetDirection = 'host-to-viewer' | 'viewer-to-host';
export type DuetInviteStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

export interface DuetInvite {
  id:             string;
  sessionId:      string;
  hostId:         string;
  inviteeId:      string;
  direction:      DuetDirection;
  layout:         DuetLayout;
  battleDuration: number | null;
  message:        string | null;
  status:         DuetInviteStatus;
  declineReason:  string | null;
  createdAt:      string;
  expiresAt:      string;
  respondedAt:    string | null;
  // Profile-Daten (nur via Join → optional)
  hostUsername:    string | null;
  hostAvatarUrl:   string | null;
  inviteeUsername: string | null;
  inviteeAvatarUrl:string | null;
}

interface RawInvite {
  id:               string;
  session_id:       string;
  host_id:          string;
  invitee_id:       string;
  direction:        DuetDirection;
  layout:           DuetLayout;
  battle_duration:  number | null;
  message:          string | null;
  status:           DuetInviteStatus;
  decline_reason:   string | null;
  created_at:       string;
  expires_at:       string;
  responded_at:     string | null;
  host?:    { username: string | null; avatar_url: string | null } | null;
  invitee?: { username: string | null; avatar_url: string | null } | null;
}

function mapInvite(r: RawInvite): DuetInvite {
  return {
    id:               r.id,
    sessionId:        r.session_id,
    hostId:           r.host_id,
    inviteeId:        r.invitee_id,
    direction:        r.direction,
    layout:           r.layout,
    battleDuration:   r.battle_duration,
    message:          r.message,
    status:           r.status,
    declineReason:    r.decline_reason,
    createdAt:        r.created_at,
    expiresAt:        r.expires_at,
    respondedAt:      r.responded_at,
    hostUsername:     r.host?.username     ?? null,
    hostAvatarUrl:    r.host?.avatar_url   ?? null,
    inviteeUsername:  r.invitee?.username  ?? null,
    inviteeAvatarUrl: r.invitee?.avatar_url?? null,
  };
}

const SELECT_INVITE_WITH_PROFILES =
  'id, session_id, host_id, invitee_id, direction, layout, battle_duration, ' +
  'message, status, decline_reason, created_at, expires_at, responded_at, ' +
  'host:host_id(username, avatar_url), invitee:invitee_id(username, avatar_url)';

export interface DuetHistoryEntry {
  id:              string;
  sessionId:       string;
  hostId:          string;
  guestId:         string;
  initiatedBy:     'host' | 'guest';
  layout:          DuetLayout;
  startedAt:       string;
  endedAt:         string | null;
  durationSecs:    number | null;
  giftCoinsTotal: number;
  endReason:       string | null;
  hostUsername:    string | null;
  hostAvatarUrl:   string | null;
  guestUsername:   string | null;
  guestAvatarUrl:  string | null;
}

interface RawHistory {
  id:                string;
  session_id:        string;
  host_id:           string;
  guest_id:          string;
  initiated_by:      'host' | 'guest';
  layout:            DuetLayout;
  started_at:        string;
  ended_at:          string | null;
  duration_secs:     number | null;
  gift_coins_total:  number;
  end_reason:        string | null;
  host?:  { username: string | null; avatar_url: string | null } | null;
  guest?: { username: string | null; avatar_url: string | null } | null;
}

function mapHistory(r: RawHistory): DuetHistoryEntry {
  return {
    id:              r.id,
    sessionId:       r.session_id,
    hostId:          r.host_id,
    guestId:         r.guest_id,
    initiatedBy:     r.initiated_by,
    layout:          r.layout,
    startedAt:       r.started_at,
    endedAt:         r.ended_at,
    durationSecs:    r.duration_secs,
    giftCoinsTotal:  r.gift_coins_total ?? 0,
    endReason:       r.end_reason,
    hostUsername:    r.host?.username    ?? null,
    hostAvatarUrl:   r.host?.avatar_url  ?? null,
    guestUsername:   r.guest?.username   ?? null,
    guestAvatarUrl:  r.guest?.avatar_url ?? null,
  };
}

// ─── Sender-seitig: Invite verschicken & verwalten ─────────────────────────

export interface CreateDuetInviteArgs {
  sessionId:       string;
  inviteeId:       string;
  layout?:         DuetLayout;
  battleDuration?: number;
  message?:        string;
}

/**
 * Hook für die Seite, die einen Invite ABschickt.
 *
 *   • Host nutzt das im LiveUserSheet → "Zum Duett einladen".
 *   • Viewer nutzt das beim "Beitritts-Anfrage senden"-Button.
 *
 * Die zugrundeliegende RPC `create_duet_invite` ermittelt die Richtung
 * automatisch aus `auth.uid()` — also kein Direction-Flag im Client.
 */
export function useDuettInviter(sessionId: string | null | undefined) {
  const profileId = useAuthStore((s) => s.profile?.id) ?? null;
  const qc = useQueryClient();

  // ── Eigene ausgehende pending Invites in dieser Session ──────────────
  const outgoingQuery = useQuery<DuetInvite[]>({
    queryKey:  ['duet-outgoing', sessionId, profileId],
    enabled:   !!sessionId && !!profileId,
    staleTime: 5_000,
    queryFn: async () => {
      if (!sessionId || !profileId) return [];
      // Richtungs-bewusster Filter: nur Invites, die ICH abgeschickt habe.
      //   host-to-viewer  → ich bin host_id  (Host hat den Invite verschickt)
      //   viewer-to-host  → ich bin invitee_id  (Viewer hat Anfrage geschickt)
      // Ohne direction-Guard würden hier auch eingehende Invites erscheinen.
      const { data, error } = await supabase
        .from('live_duet_invites')
        .select(SELECT_INVITE_WITH_PROFILES)
        .eq('session_id', sessionId)
        .eq('status', 'pending')
        .or(
          `and(direction.eq.host-to-viewer,host_id.eq.${profileId}),` +
          `and(direction.eq.viewer-to-host,invitee_id.eq.${profileId})`,
        )
        .order('created_at', { ascending: false });

      if (error) {
        __DEV__ && console.warn('[useDuettInviter] outgoing fetch:', error.message);
        return [];
      }
      return (data ?? []).map((r) => mapInvite(r as unknown as RawInvite));
    },
  });

  // ── Realtime: bei Änderungen an pending Invites neu laden ───────────
  useEffect(() => {
    if (!sessionId || !profileId) return;
    const ch = supabase
      .channel(`duet-invites-session-${sessionId}-${profileId}`)
      .on(
        'postgres_changes' as never,
        {
          event:  '*',
          schema: 'public',
          table:  'live_duet_invites',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          // Nur outgoing refetchen — duet-incoming hat einen eigenen
          // Realtime-Channel in useDuettInbox (gefiltert nach invitee_id
          // bzw. host_id = me). Cross-invalidation von hier wäre doppelt
          // und triggert auch unnötige Re-Fetches, wenn der User gar
          // nicht die Inbox geöffnet hat.
          qc.invalidateQueries({ queryKey: ['duet-outgoing', sessionId, profileId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, profileId, qc]);

  // ── Mutation: Invite erstellen ───────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (args: CreateDuetInviteArgs) => {
      const { data, error } = await supabase.rpc('create_duet_invite', {
        p_session_id:      args.sessionId,
        p_invitee_id:      args.inviteeId,
        p_layout:          args.layout ?? 'side-by-side',
        p_battle_duration: args.layout === 'battle' ? (args.battleDuration ?? 60) : null,
        p_message:         args.message ?? null,
      });
      if (error) throw error;
      return data as string; // invite_id
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ['duet-outgoing', vars.sessionId, profileId] });
    },
  });

  // ── Mutation: Eigenen Invite abbrechen ───────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.rpc('cancel_duet_invite', {
        p_invite_id: inviteId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duet-outgoing', sessionId, profileId] });
    },
  });

  // ── Client-seitiges Auto-Expiry: alle 10s rufen wir die Helper-RPC ──
  // Damit hängende Invites nicht ewig in der UI als "läuft" angezeigt werden,
  // selbst wenn die anderen Clients gerade offline sind.
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        await supabase.rpc('expire_duet_invites');
        // Re-fetch geschieht automatisch über den postgres_changes-Channel.
      } catch (err) {
        __DEV__ && console.warn('[useDuettInviter] expire:', err);
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Helper: hat dieser User bereits einen pending Invite?
  const hasPendingInviteFor = useCallback(
    (otherUserId: string): boolean => {
      return (outgoingQuery.data ?? []).some(
        (inv) =>
          inv.status === 'pending' &&
          (inv.inviteeId === otherUserId || inv.hostId === otherUserId),
      );
    },
    [outgoingQuery.data],
  );

  return {
    pendingOutgoing:    outgoingQuery.data ?? [],
    isLoading:          outgoingQuery.isLoading,
    inviteUser:         createMutation.mutateAsync,
    isInviting:         createMutation.isPending,
    inviteError:        createMutation.error,
    cancelInvite:       cancelMutation.mutateAsync,
    isCancelling:       cancelMutation.isPending,
    hasPendingInviteFor,
  };
}

// ─── Empfänger-seitig: Inbox aller eingehenden Invites ─────────────────────

/**
 * Hook für den Empfänger eines Invites — User-global (nicht Session-gebunden).
 * Wird im Live-Watch- und Live-Host-Screen aufgerufen, damit eingehende
 * Duett-Anfragen in einer modalen Karte angezeigt werden.
 *
 *   Host bekommt:    viewer-to-host Invites zu seinen aktiven Sessions
 *   Viewer bekommt:  host-to-viewer Invites von beliebigen Hosts
 *
 * Filterung erfolgt RLS-seitig (nur own + only pending).
 */
export function useDuettInbox(activeSessionId?: string | null) {
  const profileId = useAuthStore((s) => s.profile?.id) ?? null;
  const qc = useQueryClient();

  const incomingQuery = useQuery<DuetInvite[]>({
    queryKey:  ['duet-incoming', profileId],
    enabled:   !!profileId,
    staleTime: 5_000,
    queryFn: async () => {
      if (!profileId) return [];

      // Bedingung: ich bin der Adressat
      //   host-to-viewer  → invitee_id = ich
      //   viewer-to-host  → host_id    = ich
      const { data, error } = await supabase
        .from('live_duet_invites')
        .select(SELECT_INVITE_WITH_PROFILES)
        .eq('status', 'pending')
        .or(
          `and(direction.eq.host-to-viewer,invitee_id.eq.${profileId}),` +
          `and(direction.eq.viewer-to-host,host_id.eq.${profileId})`,
        )
        .order('created_at', { ascending: false });

      if (error) {
        __DEV__ && console.warn('[useDuettInbox] fetch:', error.message);
        return [];
      }
      // Client-seitig nochmal abgelaufene rausfiltern (wenn das periodische
      // expire_duet_invites noch nicht durchgelaufen ist).
      const now = Date.now();
      return (data ?? [])
        .map((r) => mapInvite(r as unknown as RawInvite))
        .filter((inv) => new Date(inv.expiresAt).getTime() > now);
    },
  });

  // Realtime: globaler Channel für eigene Inbox
  useEffect(() => {
    if (!profileId) return;
    const ch = supabase
      .channel(`duet-inbox-${profileId}`)
      // Inserts/Updates an Invites, in denen ich invitee bin (host-to-viewer)
      .on(
        'postgres_changes' as never,
        {
          event:  '*',
          schema: 'public',
          table:  'live_duet_invites',
          filter: `invitee_id=eq.${profileId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['duet-incoming', profileId] });
        },
      )
      // Inserts/Updates an Invites, in denen ich host bin (viewer-to-host)
      .on(
        'postgres_changes' as never,
        {
          event:  '*',
          schema: 'public',
          table:  'live_duet_invites',
          filter: `host_id=eq.${profileId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['duet-incoming', profileId] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profileId, qc]);

  // ── Auto-Dismiss: ausgelaufene Invites lokal aus der Liste werfen ─
  // expire_duet_invites RPC könnte hängen (z.B. anon offline) — der Client
  // setzt zur Sicherheit einen eigenen Timer pro Invite.
  const dismissedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!incomingQuery.data) return;
    const timeouts = incomingQuery.data
      .filter((inv) => !dismissedRef.current.has(inv.id))
      .map((inv) => {
        const ms = Math.max(0, new Date(inv.expiresAt).getTime() - Date.now());
        return setTimeout(() => {
          dismissedRef.current.add(inv.id);
          qc.invalidateQueries({ queryKey: ['duet-incoming', profileId] });
        }, ms + 250); // +250ms Schonzeit, damit Server zuerst expired
      });
    return () => { timeouts.forEach(clearTimeout); };
  }, [incomingQuery.data, qc, profileId]);

  // Filterung: aktuell-relevante Invites bevorzugt anzeigen.
  // Wenn ein activeSessionId mitgegeben ist (Host im Live oder Viewer im
  // Watch-Screen), zeigen wir Invites zu DIESER Session zuerst — andere
  // bleiben in der Liste, aber nachgelagert.
  const sortedIncoming = useMemo(() => {
    const list = incomingQuery.data ?? [];
    if (!activeSessionId) return list;
    return [...list].sort((a, b) => {
      const aMatch = a.sessionId === activeSessionId ? 0 : 1;
      const bMatch = b.sessionId === activeSessionId ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [incomingQuery.data, activeSessionId]);

  // Top-Invite: das, was die Modal-UI als nächstes zeigen sollte.
  const topInvite = sortedIncoming[0] ?? null;

  // ── Mutations: Accept / Decline ──────────────────────────────────────
  const respondMutation = useMutation({
    mutationFn: async (args: {
      inviteId: string;
      accept:   boolean;
      reason?:  string;
    }) => {
      const { data, error } = await supabase.rpc('respond_duet_invite', {
        p_invite_id: args.inviteId,
        p_accept:    args.accept,
        p_reason:    args.reason ?? null,
      });
      if (error) throw error;
      // RPC returns TABLE — Supabase liefert Array
      const row = Array.isArray(data) ? data[0] : data;
      return row as {
        status:     'accepted' | 'declined';
        session_id: string;
        host_id:    string;
        guest_id:   string;
        layout:     DuetLayout;
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duet-incoming', profileId] });
    },
  });

  const acceptInvite = useCallback(
    (inviteId: string) => respondMutation.mutateAsync({ inviteId, accept: true }),
    [respondMutation],
  );

  const declineInvite = useCallback(
    (inviteId: string, reason?: string) =>
      respondMutation.mutateAsync({ inviteId, accept: false, reason }),
    [respondMutation],
  );

  return {
    incoming:     sortedIncoming,
    topInvite,
    isLoading:    incomingQuery.isLoading,
    acceptInvite,
    declineInvite,
    isResponding: respondMutation.isPending,
    respondError: respondMutation.error,
  };
}

// ─── History: Liste vergangener Duette ─────────────────────────────────────

/**
 * Liste aller Duette eines Users — als Host UND als Gast.
 * Genutzt im Profil-Tab "Duette" und im Creator-Studio.
 */
export function useDuettHistory(userId: string | null | undefined, limit = 30) {
  return useQuery<DuetHistoryEntry[]>({
    queryKey:  ['duet-history', userId, limit],
    enabled:   !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('live_duet_history')
        .select(
          'id, session_id, host_id, guest_id, initiated_by, layout, ' +
          'started_at, ended_at, duration_secs, gift_coins_total, end_reason, ' +
          'host:host_id(username, avatar_url), guest:guest_id(username, avatar_url)',
        )
        .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) {
        __DEV__ && console.warn('[useDuettHistory] fetch:', error.message);
        return [];
      }
      return (data ?? []).map((r) => mapHistory(r as unknown as RawHistory));
    },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Verbleibende Sekunden bis Invite expired.
 * Clamped auf 0, damit Countdown-UIs nie negative Zahlen anzeigen müssen.
 * Abgelaufen / aktiv kann man separat über `new Date(invite.expiresAt) < now`
 * prüfen — dieses Helper ist rein für die Zählerausgabe gedacht.
 */
export function inviteSecondsLeft(invite: DuetInvite): number {
  return Math.max(
    0,
    Math.floor((new Date(invite.expiresAt).getTime() - Date.now()) / 1000),
  );
}

/** Human-readable Layout-Label für UI-Chips. */
export function duetLayoutLabel(layout: DuetLayout): string {
  switch (layout) {
    case 'top-bottom':   return 'Oben/Unten';
    case 'side-by-side': return 'Nebeneinander';
    case 'pip':          return 'Picture-in-Picture';
    case 'battle':       return 'Battle';
    case 'grid-2x2':     return 'Grid 2×2';
    case 'grid-3x3':     return 'Grid 3×3';
  }
}
