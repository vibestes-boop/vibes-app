'use client';

/**
 * live-duet-invite-modal.tsx
 *
 * v1.w.UI.187 — Web-Parität zu DuettInviteModal.tsx (mobile).
 *
 * Wird gezeigt wenn der Host einen Viewer zum Duett einlädt
 * (direction === 'host-to-viewer').  Modal erscheint unten zentriert
 * als Sheet, zeigt Absender-Avatar + Name, Layout-Chip, 30s-Countdown
 * sowie Ablehnen / Annehmen Buttons.
 */

import { useState, useEffect, useCallback } from 'react';
import { Rows2, Columns2, PictureInPicture2, Swords, X, Check, Loader2 } from 'lucide-react';
import Image from 'next/image';
import type { DuetInvite, DuetLayout } from './use-duet-invite-inbox';
import { secsLeft, layoutLabel } from './use-duet-invite-inbox';

// ─── LayoutIcon ───────────────────────────────────────────────────────────────

function LayoutIcon({ layout }: { layout: DuetLayout }) {
  const cls = 'h-3.5 w-3.5';
  switch (layout) {
    case 'top-bottom':   return <Rows2 className={cls} />;
    case 'side-by-side': return <Columns2 className={cls} />;
    case 'pip':          return <PictureInPicture2 className={cls} />;
    case 'battle':       return <Swords className={cls} />;
    default:             return <Columns2 className={cls} />;
  }
}

// ─── CircularCountdown ────────────────────────────────────────────────────────

function CircularCountdown({ total, current }: { total: number; current: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const progress = total > 0 ? current / total : 0;
  const dashOffset = circ * (1 - progress);

  return (
    <svg width="44" height="44" className="absolute right-3 top-3">
      <circle
        cx="22" cy="22" r={r}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="3"
      />
      <circle
        cx="22" cy="22" r={r}
        fill="none"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="3"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.9s linear' }}
      />
      <text x="22" y="27" textAnchor="middle" fill="white" fontSize="12" fontWeight="600">
        {current}
      </text>
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  invite:      DuetInvite;
  isResponding:boolean;
  onAccept:    (inviteId: string) => void;
  onDecline:   (inviteId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LiveDuetInviteModal({ invite, isResponding, onAccept, onDecline }: Props) {
  const TOTAL_SECS = 30;
  const [seconds, setSeconds] = useState(() => Math.min(TOTAL_SECS, secsLeft(invite)));

  // Tick every second, auto-decline when expired
  useEffect(() => {
    setSeconds(Math.min(TOTAL_SECS, secsLeft(invite)));
    const interval = setInterval(() => {
      const left = secsLeft(invite);
      setSeconds(Math.min(TOTAL_SECS, left));
      if (left <= 0) {
        clearInterval(interval);
        onDecline(invite.id);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [invite, onDecline]);

  const handleAccept  = useCallback(() => onAccept(invite.id),  [invite.id, onAccept]);
  const handleDecline = useCallback(() => onDecline(invite.id), [invite.id, onDecline]);

  // Sender info: for host-to-viewer, sender is the host
  const senderName   = invite.direction === 'host-to-viewer' ? invite.hostUsername   : invite.inviteeUsername;
  const senderAvatar = invite.direction === 'host-to-viewer' ? invite.hostAvatarUrl  : invite.inviteeAvatarUrl;
  const headline     = invite.direction === 'host-to-viewer' ? 'Einladung zum Duett' : 'Duett-Anfrage';
  const subline      = invite.direction === 'host-to-viewer'
    ? `@${senderName ?? '…'} lädt dich zum Duett ein`
    : `@${senderName ?? '…'} will in dein Duett einsteigen`;

  return (
    /* Backdrop */
    <div
      className="pointer-events-auto absolute inset-0 z-[200] flex items-end justify-center"
      onClick={handleDecline}
    >
      {/* Sheet */}
      <div
        className="relative mb-4 w-[min(340px,calc(100%-24px))] animate-in slide-in-from-bottom-4 overflow-hidden rounded-2xl bg-[#1a1a2e]/95 p-4 shadow-elevation-4 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Countdown ring */}
        <CircularCountdown total={TOTAL_SECS} current={seconds} />

        {/* Close / Decline X */}
        <button
          type="button"
          onClick={handleDecline}
          className="absolute left-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20"
          aria-label="Ablehnen"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Header: avatar + text */}
        <div className="mt-2 flex items-center gap-3 px-1">
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-white/10">
            {senderAvatar ? (
              <Image src={senderAvatar} alt={senderName ?? ''} fill sizes="48px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base font-semibold text-white">
                {(senderName?.[0] ?? '?').toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{headline}</p>
            <p className="truncate text-xs text-white/70">{subline}</p>
          </div>
        </div>

        {/* Layout chip */}
        <div className="mt-3 flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80">
            <LayoutIcon layout={invite.layout} />
            {layoutLabel(invite.layout)}
          </div>
          {invite.layout === 'battle' && invite.battleDuration && (
            <div className="inline-flex items-center rounded-full bg-orange-500/20 px-2.5 py-1 text-[11px] font-medium text-orange-300">
              {invite.battleDuration / 60} Min
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleDecline}
            disabled={isResponding}
            className="flex-1 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            Ablehnen
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={isResponding}
            className="flex-1 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isResponding ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                …
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Beitreten
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
