'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { X, CalendarClock, Loader2 } from 'lucide-react';
import { cancelScheduledPost, reschedulePost } from '@/app/actions/posts';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ScheduleDialog } from './schedule-dialog';

export function ScheduledRowActions({ scheduledId, currentPublishAt }: { scheduledId: string; currentPublishAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<'reschedule' | 'cancel' | null>(null);
  const [newDate, setNewDate] = useState(() => new Date(currentPublishAt));
  const [error, setError] = useState<string | null>(null);
  const rescheduleTrigger = useRef<HTMLButtonElement>(null);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);

  const run = (operation: () => ReturnType<typeof cancelScheduledPost>) => {
    if (pending.current) return;
    pending.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await operation();
        if (!result.ok) { setError(result.error); return; }
        setMode(null);
        router.refresh();
      } catch {
        setError('Die Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.');
      } finally {
        pending.current = false;
      }
    });
  };
  const feedback = error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null;

  return <div className="flex items-center gap-2">
    <button ref={rescheduleTrigger} type="button" disabled={isPending} onClick={() => { setError(null); setNewDate(new Date(currentPublishAt)); setMode('reschedule'); }} aria-label="Umplanen"
      className="grid h-11 w-11 place-items-center rounded-full border text-muted-foreground hover:bg-muted disabled:opacity-50"><CalendarClock size={18} /></button>
    <button ref={cancelTrigger} type="button" disabled={isPending} onClick={() => { setError(null); setMode('cancel'); }} aria-label="Planung abbrechen"
      className="grid h-11 w-11 place-items-center rounded-full border text-muted-foreground hover:bg-muted disabled:opacity-50"><X size={18} /></button>
    {mode === 'reschedule' && <ScheduleDialog returnFocusRef={rescheduleTrigger} value={newDate} onChange={setNewDate} onClose={() => setMode(null)}
      title="Beitrag umplanen" confirmLabel="Speichern" busy={isPending} feedback={feedback}
      onConfirm={date => run(() => reschedulePost(scheduledId, date.toISOString()))} />}
    {mode === 'cancel' && <Dialog open onOpenChange={open => { if (!open) setMode(null); }}>
      <DialogContent className="w-[calc(100%_-_2rem)] max-w-md rounded-3xl sm:rounded-3xl" onCloseAutoFocus={event => { event.preventDefault(); cancelTrigger.current?.focus(); }}>
        <DialogTitle className="pr-10">Planung abbrechen?</DialogTitle>
        <DialogDescription>Dieser Beitrag wird dann nicht automatisch veröffentlicht.</DialogDescription>
        {feedback}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setMode(null)} className="min-h-11 flex-1 rounded-xl border px-3 text-sm">Beitrag behalten</button>
          <button type="button" disabled={isPending} onClick={() => run(() => cancelScheduledPost(scheduledId))}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {isPending && <Loader2 size={16} className="animate-spin" />}Planung abbrechen
          </button>
        </div>
      </DialogContent>
    </Dialog>}
  </div>;
}
