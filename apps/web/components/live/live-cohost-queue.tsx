'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { createBrowserClient } from '@supabase/ssr';
import { Check, X, UserPlus, UserMinus, Mic, MicOff, VideoOff, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';

function supa() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
import { acceptCoHostRequest, rejectCoHostRequest, kickCoHost, muteCoHost } from '@/app/actions/live-host';
import type { DuetLayout } from '@/app/actions/live-host';
import { setBattleStore, resetBattleStore } from './live-battle-store';

// -----------------------------------------------------------------------------
// LiveCoHostQueue — v1.w.UI.182 (layout picker + battle mode)
//
// Incoming-Requests-Flow:
//   Viewer → sendet Broadcast `cohost-request` auf `co-host-signals-{id}` →
//   Host-UI hier hört mit, zeigt Avatar + Name + Layout-Picker.
//   Host wählt Layout → Accept → acceptCoHostRequest broadcasts co-host-accepted
//   with layout+battleDuration → viewers/host switch into the right mode.
//
// Active-CoHosts:
//   DB-Subscription auf `live_cohosts` → zeigt Kick + Mute-Buttons.
// -----------------------------------------------------------------------------

const LAYOUTS: { value: DuetLayout; emoji: string; label: string }[] = [
  { value: 'side-by-side', emoji: '↔️', label: 'Side' },
  { value: 'top-bottom',   emoji: '↕️', label: 'Stack' },
  { value: 'pip',          emoji: '🎯', label: 'PiP' },
  { value: 'battle',       emoji: '⚔️', label: 'Battle' },
];

const BATTLE_DURATIONS = [
  { label: '1 min',  secs: 60 },
  { label: '3 min',  secs: 180 },
  { label: '5 min',  secs: 300 },
  { label: '10 min', secs: 600 },
];

interface PendingRequest {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  ts: number;
}

interface ActiveCoHost {
  user_id: string;
  slot_index: number;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  accepted_at: string;
  audio_muted: boolean;
  video_muted: boolean;
}

export interface LiveCoHostQueueProps {
  sessionId: string;
  hostId: string;
}

export function LiveCoHostQueue({ sessionId, hostId }: LiveCoHostQueueProps) {
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [active, setActive] = useState<ActiveCoHost[]>([]);

  // -----------------------------------------------------------------------------
  // Broadcast-Subscribe: cohost-request, cohost-cancel, cohost-leave
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = supa();
    const channel = supabase.channel(`co-host-signals-${sessionId}`);

    channel.on('broadcast', { event: 'cohost-request' }, ({ payload }) => {
      const p = payload as {
        user_id: string;
        username?: string | null;
        display_name?: string | null;
        avatar_url?: string | null;
        ts?: number;
      };
      if (!p.user_id || p.user_id === hostId) return;
      setPending((prev) => {
        // Dedup
        if (prev.some((r) => r.user_id === p.user_id)) return prev;
        return [
          ...prev,
          {
            user_id: p.user_id,
            username: p.username ?? null,
            display_name: p.display_name ?? null,
            avatar_url: p.avatar_url ?? null,
            ts: p.ts ?? Date.now(),
          },
        ];
      });
    });

    channel.on('broadcast', { event: 'cohost-cancel' }, ({ payload }) => {
      const p = payload as { user_id: string };
      setPending((prev) => prev.filter((r) => r.user_id !== p.user_id));
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, hostId]);

  // -----------------------------------------------------------------------------
  // Active-CoHosts — DB-Subscription
  // -----------------------------------------------------------------------------
  useEffect(() => {
    const supabase = supa();
    let cancelled = false;

    async function loadActive() {
      // Schema-Drift-Korrektur: `live_cohosts` hat `approved_at`, nicht
      // `accepted_at` (siehe Base-Migration 20260417020000_live_cohosts).
      // Die Spalten `audio_muted` / `video_muted` existieren in der DB
      // gar nicht — bisher war das ein phantom-Schema, der SELECT gab 400
      // zurück und die aktive-CoHost-Liste blieb leer. Mute-Status wird
      // clientseitig initialisiert (false) und nach Server-enforced-Mute-
      // Flow aus v1.27.3 per Broadcast synchronisiert.
      const { data } = await supabase
        .from('live_cohosts')
        .select(
          `user_id, slot_index, approved_at,
           profile:profiles!live_cohosts_user_id_fkey ( username, display_name, avatar_url )`,
        )
        .eq('session_id', sessionId)
        .is('revoked_at', null)
        .order('slot_index', { ascending: true });

      if (cancelled || !data) return;
      setActive(
        data.map((row) => {
          const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
          return {
            user_id: row.user_id as string,
            slot_index: row.slot_index as number,
            accepted_at: row.approved_at as string,
            audio_muted: false,
            video_muted: false,
            username: (profile as { username?: string } | null)?.username ?? null,
            display_name: (profile as { display_name?: string } | null)?.display_name ?? null,
            avatar_url: (profile as { avatar_url?: string } | null)?.avatar_url ?? null,
          };
        }),
      );
    }

    loadActive();

    const channel = supabase
      .channel(`live-cohosts-watch-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_cohosts',
          filter: `session_id=eq.${sessionId}`,
        },
        () => {
          void loadActive();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const takenSlots = new Set(active.map((a) => a.slot_index));
  const nextFreeSlot = [1, 2, 3].find((s) => !takenSlots.has(s)) ?? 1;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        CoHosts
      </h3>

      {/* Pending */}
      {pending.length === 0 && active.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Noch keine Anfragen. Viewer können sich zum Mit-Streamen melden.
        </p>
      )}

      {pending.map((req) => (
        <PendingRow
          key={req.user_id}
          req={req}
          slotIndex={nextFreeSlot}
          onAccept={() => {
            setPending((prev) => prev.filter((r) => r.user_id !== req.user_id));
          }}
          onReject={() => {
            setPending((prev) => prev.filter((r) => r.user_id !== req.user_id));
          }}
          sessionId={sessionId}
          slotsAvailable={takenSlots.size < 3}
        />
      ))}
      {/* When cohost is kicked/revoked, clear battle state */}
      {/* (This is handled by the active cohost list changes below) */}

      {/* Active */}
      {active.map((co) => (
        <ActiveRow key={co.user_id} coHost={co} sessionId={sessionId} />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// PendingRow — Avatar + Name + Accept/Reject
// -----------------------------------------------------------------------------

function PendingRow({
  req,
  slotIndex,
  sessionId,
  slotsAvailable,
  onAccept,
  onReject,
}: {
  req: PendingRequest;
  slotIndex: number;
  sessionId: string;
  slotsAvailable: boolean;
  onAccept: (layout: DuetLayout, battleDuration?: number) => void;
  onReject: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<DuetLayout>('side-by-side');
  const [battleDuration, setBattleDuration] = useState(60);
  const [expanded, setExpanded] = useState(false);

  const label = req.display_name ?? req.username ?? 'Unbekannt';
  const initial = label.slice(0, 1).toUpperCase();

  const doAccept = () => {
    if (!slotsAvailable) { setError('Alle Slots belegt.'); return; }
    startTransition(async () => {
      const r = await acceptCoHostRequest(
        sessionId, req.user_id, slotIndex, layout,
        layout === 'battle' ? battleDuration : undefined,
      );
      if (!r.ok) { setError(r.error); return; }
      // If battle, write to module-level store so LiveBattleBar is shown immediately
      if (layout === 'battle') {
        setBattleStore({ isBattle: true, durationSecs: battleDuration, secondsLeft: battleDuration });
      }
      onAccept(layout, layout === 'battle' ? battleDuration : undefined);
    });
  };

  return (
    <div className="rounded-lg border bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-3">
        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-muted">
          {req.avatar_url ? (
            <Image src={req.avatar_url} alt={label} fill sizes="36px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-sm font-semibold text-primary">
              {initial}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Möchte CoHost werden</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md bg-green-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-600"
        >
          <Check className="h-3.5 w-3.5" />
          Accept
        </button>

        <button
          type="button"
          onClick={() => { startTransition(async () => { const r = await rejectCoHostRequest(sessionId, req.user_id); onReject(); if (!r.ok) setError(r.error); }); }}
          disabled={isPending}
          className="inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* v1.w.UI.182 — Layout picker (shown after clicking Accept) */}
      {expanded && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Layout wählen:</p>
          <div className="flex flex-wrap gap-1.5">
            {LAYOUTS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLayout(l.value)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  layout === l.value
                    ? 'bg-primary text-primary-foreground'
                    : 'border hover:bg-muted'
                }`}
              >
                {l.emoji} {l.label}
              </button>
            ))}
          </div>

          {/* Battle duration picker */}
          {layout === 'battle' && (
            <div className="flex flex-wrap gap-1.5">
              {BATTLE_DURATIONS.map((d) => (
                <button
                  key={d.secs}
                  type="button"
                  onClick={() => setBattleDuration(d.secs)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    battleDuration === d.secs
                      ? 'bg-[#FF2D6D] text-white'
                      : 'border border-[#FF2D6D]/30 text-[#FF2D6D] hover:bg-[#FF2D6D]/10'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={doAccept}
            disabled={isPending}
            className="w-full rounded-md bg-green-500 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50"
          >
            {isPending ? 'Wird akzeptiert…' : `Bestätigen (${LAYOUTS.find(l => l.value === layout)?.emoji} ${layout === 'battle' ? `Battle ${BATTLE_DURATIONS.find(d => d.secs === battleDuration)?.label}` : LAYOUTS.find(l => l.value === layout)?.label})`}
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ActiveRow — aktiver CoHost mit Mute/Kick/Layout-Switch
// -----------------------------------------------------------------------------

const ACTIVE_LAYOUTS: { value: DuetLayout; emoji: string; label: string }[] = [
  { value: 'top-bottom',   emoji: '↕️', label: 'Oben/Unten' },
  { value: 'side-by-side', emoji: '↔️', label: 'Nebeneinander' },
  { value: 'pip',          emoji: '🎯', label: 'Bild-in-Bild' },
  { value: 'battle',       emoji: '⚔️', label: 'Battle' },
];

const ACTIVE_BATTLE_DURATIONS = [
  { label: '1 min', secs: 60 },
  { label: '3 min', secs: 180 },
  { label: '5 min', secs: 300 },
];

function ActiveRow({ coHost, sessionId }: { coHost: ActiveCoHost; sessionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [localMuteAudio, setLocalMuteAudio] = useState(coHost.audio_muted);
  const [localMuteVideo, setLocalMuteVideo] = useState(coHost.video_muted);

  // v1.w.UI.223 — Mid-stream layout switcher
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const [pickedLayout, setPickedLayout]         = useState<DuetLayout>('side-by-side');
  const [pickedBattle, setPickedBattle]         = useState(60);
  const [layoutBusy, setLayoutBusy]             = useState(false);

  const label = coHost.display_name ?? coHost.username ?? 'Unbekannt';
  const initial = label.slice(0, 1).toUpperCase();

  async function handleSwitchLayout() {
    if (layoutBusy) return;
    setLayoutBusy(true);
    try {
      const client = supa();
      const ch = client.channel(`co-host-signals-${sessionId}`);
      await ch.subscribe();
      await ch.send({
        type: 'broadcast',
        event: 'co-host-layout-changed',
        payload: {
          layout: pickedLayout,
          ...(pickedLayout === 'battle' ? { battleDuration: pickedBattle } : {}),
        },
      });
      client.removeChannel(ch);
      setLayoutPickerOpen(false);
    } catch {
      // silent — viewer will miss the switch, host can retry
    } finally {
      setLayoutBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-muted">
          {coHost.avatar_url ? (
            <Image
              src={coHost.avatar_url}
              alt={label}
              fill
              sizes="36px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-sm font-semibold text-primary">
              {initial}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
            {coHost.slot_index}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            <UserPlus className="inline h-3 w-3" /> CoHost · Slot {coHost.slot_index}
          </p>
        </div>

        {/* v1.w.UI.223 — Layout-Switch */}
        <button
          type="button"
          onClick={() => setLayoutPickerOpen((v) => !v)}
          title="Layout wechseln"
          className={cn(
            'inline-flex items-center rounded-md border p-1.5',
            layoutPickerOpen ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
          )}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
        </button>

        {/* Audio-Mute */}
        <button
          type="button"
          onClick={() => {
            const next = !localMuteAudio;
            setLocalMuteAudio(next);
            startTransition(async () => {
              await muteCoHost(sessionId, coHost.user_id, next, localMuteVideo);
            });
          }}
          disabled={isPending}
          title={localMuteAudio ? 'Mic unmuten' : 'Mic muten'}
          className={`inline-flex items-center rounded-md border p-1.5 ${
            localMuteAudio ? 'bg-red-500/10 text-red-500' : 'hover:bg-muted'
          }`}
        >
          {localMuteAudio ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </button>

        {/* Video-Mute */}
        <button
          type="button"
          onClick={() => {
            const next = !localMuteVideo;
            setLocalMuteVideo(next);
            startTransition(async () => {
              await muteCoHost(sessionId, coHost.user_id, localMuteAudio, next);
            });
          }}
          disabled={isPending}
          title={localMuteVideo ? 'Kamera aktivieren' : 'Kamera deaktivieren'}
          className={`inline-flex items-center rounded-md border p-1.5 ${
            localMuteVideo ? 'bg-red-500/10 text-red-500' : 'hover:bg-muted'
          }`}
        >
          <VideoOff className="h-3.5 w-3.5" />
        </button>

        {/* Kick */}
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`${label} von der Bühne entfernen?`)) return;
            startTransition(async () => {
              await kickCoHost(sessionId, coHost.user_id);
            });
          }}
          disabled={isPending}
          title="CoHost entfernen"
          className="inline-flex items-center rounded-md border p-1.5 text-red-500 hover:bg-red-500/10"
        >
          <UserMinus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* v1.w.UI.223 — Inline layout picker */}
      {layoutPickerOpen && (
        <div className="border-t px-3 py-2.5 flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Layout wechseln
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ACTIVE_LAYOUTS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setPickedLayout(l.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                  pickedLayout === l.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                )}
              >
                {l.emoji} {l.label}
              </button>
            ))}
          </div>
          {pickedLayout === 'battle' && (
            <div className="flex gap-1.5">
              {ACTIVE_BATTLE_DURATIONS.map(({ label: bl, secs }) => (
                <button
                  key={secs}
                  type="button"
                  onClick={() => setPickedBattle(secs)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                    pickedBattle === secs
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted',
                  )}
                >
                  {bl}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSwitchLayout}
              disabled={layoutBusy}
              className="flex-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {layoutBusy ? 'Wechselt…' : 'Layout anwenden'}
            </button>
            <button
              type="button"
              onClick={() => setLayoutPickerOpen(false)}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/80"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
