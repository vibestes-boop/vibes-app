'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { X, Ban, CalendarClock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cancelScheduledPost, reschedulePost } from '@/app/actions/posts';

// -----------------------------------------------------------------------------
// ScheduledRowActions — Buttons für aktive geplante Posts: Umplanen +
// Abbrechen. Umplanen öffnet einen kleinen Popover mit Preset-Chips + date-
// /time-Input. Abbrechen ist ein Soft-Confirm via zweiten Klick.
// -----------------------------------------------------------------------------

interface Props {
  scheduledId: string;
  currentPublishAt: string;
}

export function ScheduledRowActions({ scheduledId, currentPublishAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showReschedule, setShowReschedule] = useState(false);
  const [cancelConfirming, setCancelConfirming] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date(currentPublishAt));
  const [err, setErr] = useState<string | null>(null);

  const onCancel = () => {
    if (!cancelConfirming) {
      setCancelConfirming(true);
      setTimeout(() => setCancelConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      const res = await cancelScheduledPost(scheduledId);
      if (res.ok) router.refresh();
      else setErr(res.error);
      setCancelConfirming(false);
    });
  };

  const onConfirmReschedule = () => {
    if (newDate.getTime() < Date.now() + 60_000) {
      setErr('Min. 1 Min. in der Zukunft.');
      return;
    }
    setErr(null);
    startTransition(async () => {
      const res = await reschedulePost(scheduledId, newDate.toISOString());
      if (res.ok) {
        setShowReschedule(false);
        router.refresh();
      } else {
        setErr(res.error);
      }
    });
  };

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setShowReschedule((x) => !x)}
        disabled={isPending}
        className="grid h-9 w-9 place-items-center rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        aria-label="Umplanen"
        title="Umplanen"
      >
        <CalendarClock className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className={cn(
          cancelConfirming
            ? 'inline-flex h-9 items-center gap-1.5 rounded-full bg-red-500 px-3 text-xs font-medium text-white hover:bg-red-600'
            : 'grid h-9 w-9 place-items-center rounded-full border text-muted-foreground hover:bg-muted hover:text-foreground',
          isPending && 'opacity-50',
        )}
        aria-label="Abbrechen"
        title={cancelConfirming ? 'Nochmal klicken zum Abbrechen' : 'Abbrechen'}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : cancelConfirming ? (
          <>
            <Ban className="h-3.5 w-3.5" />
            Abbrechen
          </>
        ) : (
          <X className="h-4 w-4" />
        )}
      </button>

      {showReschedule && (
        <div className="absolute right-0 top-11 z-20 w-72 rounded-xl border bg-background p-3 shadow-lg">
          <div className="mb-2 text-sm font-medium">Umplanen</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={toDateInput(newDate)}
              min={toDateInput(new Date())}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                const next = new Date(newDate);
                next.setFullYear(y, m - 1, d);
                setNewDate(next);
              }}
              className="rounded-lg border bg-background px-2 py-1.5 text-sm"
            />
            <input
              type="time"
              value={toTimeInput(newDate)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                const next = new Date(newDate);
                next.setHours(h, m, 0, 0);
                setNewDate(next);
              }}
              className="rounded-lg border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          {err && <p className="mt-2 text-xs text-red-500">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setShowReschedule(false)}
              className="h-9 flex-1 rounded-lg border text-sm hover:bg-muted"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={onConfirmReschedule}
              disabled={isPending}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toTimeInput(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
