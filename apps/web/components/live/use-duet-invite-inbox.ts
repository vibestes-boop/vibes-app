'use client';

/**
 * use-duet-invite-inbox.ts
 *
 * v1.w.UI.187 — Web-Parität zum mobilen `useDuettInbox` aus lib/useDuett.ts.
 *
 * Subscribed via Supabase Realtime auf `live_duet_invites` (INSERT + UPDATE)
 * gefiltert nach `invitee_id = viewerId`.  Zeigt immer das zeitlich erste
 * pending Invite (topInvite) an — das ist alles, was die Modal-UI braucht.
 *
 * Accept / Decline rufen die Server-Action `respondDuetInvite` auf, die
 * wiederum die RPC `respond_duet_invite` triggert.  Nach erfolgreicher
 * Annahme wird der Viewer automatisch als CoHost eingetragen; der
 * LiveCoHostWatcher auf der Viewer-Seite löst dann das router.refresh() aus,
 * sodass die Duett-Ansicht aktiviert wird.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { respondDuetInvite, type RespondDuetInviteResult } from '@/app/actions/live';

// ─── Typen ───────────────────────────────────────────────────────────────────

export type DuetDirection = 'host-to-viewer' | 'viewer-to-host';
export type DuetLayout    = 'top-bottom' | 'side-by-side' | 'pip' | 'battle';

export interface DuetInvite {
  id:               string;
  sessionId:        string;
  hostId:           string;
  inviteeId:        string;
  direction:        DuetDirection;
  layout:           DuetLayout;
  battleDuration:   number | null;
  status:           'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  expiresAt:        string;
  createdAt:        string;
  // Joined profile data
  hostUsername:     string | null;
  hostAvatarUrl:    string | null;
  inviteeUsername:  string | null;
  inviteeAvatarUrl: string | null;
}

interface RawInviteRow {
  id:               string;
  session_id:       string;
  host_id:          string;
  invitee_id:       string;
  direction:        DuetDirection;
  layout:           DuetLayout;
  battle_duration:  number | null;
  status:           'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  expires_at:       string;
  created_at:       string;
  host?:    { username: string | null; avatar_url: string | null } | null;
  invitee?: { username: string | null; avatar_url: string | null } | null;
}

function mapRow(r: RawInviteRow): DuetInvite {
  return {
    id:               r.id,
    sessionId:        r.session_id,
    hostId:           r.host_id,
    inviteeId:        r.invitee_id,
    direction:        r.direction,
    layout:           r.layout,
    battleDuration:   r.battle_duration,
    status:           r.status,
    expiresAt:        r.expires_at,
    createdAt:        r.created_at,
    hostUsername:     r.host?.username    ?? null,
    hostAvatarUrl:    r.host?.avatar_url  ?? null,
    inviteeUsername:  r.invitee?.username   ?? null,
    inviteeAvatarUrl: r.invitee?.avatar_url ?? null,
  };
}

const SELECT_COLS =
  'id, session_id, host_id, invitee_id, direction, layout, battle_duration, status, expires_at, created_at, ' +
  'host:profiles!host_id(username, avatar_url), ' +
  'invitee:profiles!invitee_id(username, avatar_url)';

export function secsLeft(invite: DuetInvite): number {
  return Math.max(0, Math.floor((new Date(invite.expiresAt).getTime() - Date.now()) / 1000));
}

export function layoutLabel(layout: DuetLayout): string {
  switch (layout) {
    case 'top-bottom':   return 'Oben / Unten';
    case 'side-by-side': return 'Nebeneinander';
    case 'pip':          return 'Bild-im-Bild';
    case 'battle':       return '⚔️ Battle';
    default:             return layout;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseDuetInviteInboxOptions {
  /** Session-ID des aktuell betrachteten Streams — filtert irrelevante Invites heraus. */
  sessionId: string;
  /** Viewer-UserId (null → nicht eingeloggt, Hook inaktiv). */
  viewerId:  string | null;
}

export interface UseDuetInviteInboxReturn {
  topInvite:    DuetInvite | null;
  isResponding: boolean;
  acceptInvite: (inviteId: string) => Promise<RespondDuetInviteResult | null>;
  declineInvite:(inviteId: string) => Promise<void>;
  dismiss:      (inviteId: string) => void;
}

export function useDuetInviteInbox({
  sessionId,
  viewerId,
}: UseDuetInviteInboxOptions): UseDuetInviteInboxReturn {
  const [invites, setInvites]       = useState<DuetInvite[]>([]);
  const [isResponding, setRespond]  = useState(false);
  const dismissedRef                = useRef<Set<string>>(new Set());

  // ── Initialer Fetch: offene host-to-viewer Invites für diese Session ────────
  useEffect(() => {
    if (!viewerId || !sessionId) return;

    const supabase = createClient();
    supabase
      .from('live_duet_invites')
      .select(SELECT_COLS)
      .eq('status', 'pending')
      .eq('direction', 'host-to-viewer')
      .eq('invitee_id', viewerId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        const now = Date.now();
        const mapped = (data as unknown as RawInviteRow[])
          .map(mapRow)
          .filter((inv) => new Date(inv.expiresAt).getTime() > now)
          .filter((inv) => !dismissedRef.current.has(inv.id));
        setInvites(mapped);
      });
  }, [viewerId, sessionId]);

  // ── Realtime: neue INSERT für mich in dieser Session ───────────────────────
  useEffect(() => {
    if (!viewerId || !sessionId) return;

    const supabase = createClient();
    const ch = supabase
      .channel(`duet-inbox-${viewerId}-${sessionId}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event:  'INSERT',
          schema: 'public',
          table:  'live_duet_invites',
          filter: `invitee_id=eq.${viewerId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const raw = payload.new as unknown as RawInviteRow;
          if (
            raw.session_id !== sessionId ||
            raw.direction  !== 'host-to-viewer' ||
            raw.status     !== 'pending' ||
            dismissedRef.current.has(raw.id)
          ) return;

          // Profile-Daten nachladen (INSERT-Payload enthält keine Joins)
          const supabaseInner = createClient();
          supabaseInner
            .from('live_duet_invites')
            .select(SELECT_COLS)
            .eq('id', raw.id)
            .single()
            .then(({ data }) => {
              if (!data) return;
              const invite = mapRow(data as unknown as RawInviteRow);
              if (new Date(invite.expiresAt).getTime() <= Date.now()) return;
              setInvites((prev) => {
                if (prev.some((i) => i.id === invite.id)) return prev;
                return [...prev, invite];
              });
            });
        },
      )
      // UPDATE (z.B. status → expired/cancelled): Invite aus Liste entfernen
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'live_duet_invites',
          filter: `invitee_id=eq.${viewerId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as { id: string; status: string };
          if (updated.status !== 'pending') {
            setInvites((prev) => prev.filter((i) => i.id !== updated.id));
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [viewerId, sessionId]);

  // ── Auto-Dismiss bei Ablauf ─────────────────────────────────────────────────
  useEffect(() => {
    if (invites.length === 0) return;
    const timers = invites.map((inv) => {
      const ms = Math.max(0, new Date(inv.expiresAt).getTime() - Date.now());
      return setTimeout(() => {
        dismissedRef.current.add(inv.id);
        setInvites((prev) => prev.filter((i) => i.id !== inv.id));
      }, ms + 300);
    });
    return () => timers.forEach(clearTimeout);
  }, [invites]);

  // ── Erstes nicht-dismissed Invite als Top-Invite ───────────────────────────
  const topInvite = invites[0] ?? null;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const acceptInvite = useCallback(
    async (inviteId: string): Promise<RespondDuetInviteResult | null> => {
      setRespond(true);
      try {
        const res = await respondDuetInvite(inviteId, true);
        if (res.ok) {
          dismissedRef.current.add(inviteId);
          setInvites((prev) => prev.filter((i) => i.id !== inviteId));
          return res.data;
        }
        return null;
      } finally {
        setRespond(false);
      }
    },
    [],
  );

  const declineInvite = useCallback(async (inviteId: string) => {
    setRespond(true);
    try {
      await respondDuetInvite(inviteId, false);
    } finally {
      setRespond(false);
      dismissedRef.current.add(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    }
  }, []);

  const dismiss = useCallback((inviteId: string) => {
    dismissedRef.current.add(inviteId);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }, []);

  return { topInvite, isResponding, acceptInvite, declineInvite, dismiss };
}
