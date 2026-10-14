'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function timeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Shared by first-time scheduling and rescheduling existing posts. */
export function ScheduleDialog({ value, onChange, onClose, onConfirm, busy, feedback, title = 'Zeitpunkt wählen', confirmLabel = 'Planen', returnFocusRef }: {
  value: Date;
  onChange: (value: Date) => void;
  onClose: () => void;
  onConfirm: (value: Date) => void;
  busy: boolean;
  feedback?: ReactNode;
  title?: string;
  confirmLabel?: string;
  returnFocusRef?: RefObject<HTMLElement>;
}) {
  const id = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      const height = viewport?.height ?? window.innerHeight;
      contentRef.current?.style.setProperty('--dialog-viewport-height', `${height}px`);
      contentRef.current?.style.setProperty('--dialog-top', `${(viewport?.offsetTop ?? 0) + height / 2}px`);
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  const opener = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);
  const [date, setDate] = useState(() => dateInput(value));
  const [time, setTime] = useState(() => timeInput(value));
  const selected = date && time ? new Date(`${date}T${time}:00`) : null;
  const now = new Date();
  const maximum = new Date(now);
  maximum.setDate(maximum.getDate() + 60);
  const valid = selected !== null && Number.isFinite(selected.getTime()) && dateInput(selected) === date && timeInput(selected) === time;
  const error = !valid ? 'Bitte Datum und Uhrzeit vollständig auswählen.'
    : selected.getTime() <= now.getTime() + 60_000 ? 'Wähle einen Zeitpunkt mindestens eine Minute in der Zukunft.'
    : selected.getTime() >= maximum.getTime() ? 'Du kannst Beiträge bis zu 60 Tage im Voraus planen.' : null;
  const presets = [
    { label: 'In 1h', date: new Date(now.getTime() + 60 * 60_000) },
    { label: 'In 3h', date: new Date(now.getTime() + 180 * 60_000) },
    { label: 'Morgen 09:00', date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9) },
    { label: 'Morgen 18:00', date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 18) },
  ];
  const pick = (next: Date) => {
    setDate(dateInput(next));
    setTime(timeInput(next));
    onChange(next);
  };

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent ref={contentRef} className="transition-none top-[var(--dialog-top,50%)] max-h-[calc(var(--dialog-viewport-height,100dvh)_-_2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl p-5 sm:rounded-3xl"
      onCloseAutoFocus={event => { event.preventDefault(); (returnFocusRef?.current ?? opener.current)?.focus(); }}>
      <div className="pr-10">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="mt-2">Datum und Uhrzeit gelten in deiner lokalen Zeitzone.</DialogDescription>
      </div>
      <div className="rounded-2xl border bg-muted/50 p-4 text-center">
        <p className="text-lg font-semibold tabular-nums">{valid ? selected.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Zeitpunkt auswählen'}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map(preset => <button key={preset.label} type="button" disabled={busy} onClick={() => pick(preset.date)} className="min-h-11 rounded-full border px-3 text-xs hover:bg-muted disabled:opacity-50">{preset.label}</button>)}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${id}-date`} className="mb-1 block text-xs text-muted-foreground">Datum</label>
          <input id={`${id}-date`} type="date" value={date} min={dateInput(now)} max={dateInput(maximum)} disabled={busy}
            onChange={event => setDate(event.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-validation` : undefined}
            className="h-12 w-full min-w-0 rounded-xl border bg-background px-2 text-base" />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-time`} className="mb-1 block text-xs text-muted-foreground">Uhrzeit</label>
          <input id={`${id}-time`} type="time" value={time} disabled={busy} onChange={event => setTime(event.target.value)}
            aria-invalid={!!error} aria-describedby={error ? `${id}-validation` : undefined} className="h-12 w-full min-w-0 rounded-xl border bg-background px-2 text-base" />
        </div>
      </div>
      {error && <p id={`${id}-validation`} role="status" className="text-sm text-destructive">{error}</p>}
      {feedback}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border text-sm hover:bg-muted">Abbrechen</button>
        <button type="button" disabled={!!error || busy} onClick={() => { if (!error && selected) { onChange(selected); onConfirm(selected); } }}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}{confirmLabel}
        </button>
      </div>
    </DialogContent>
  </Dialog>;
}
