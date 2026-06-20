'use client';

import { useEffect, useState } from 'react';
import { Eye, Gem, Users, UserPlus, Heart, MessageCircle, Share2 } from 'lucide-react';

// -----------------------------------------------------------------------------
// RealtimeStatsClient — zeigt Live-Metriken wenn der User gerade streamt.
// Pollt alle 15 Sekunden /api/live/[id]/stats (falls vorhanden), sonst
// zeigt es den initial viewer count mit Timestamp.
// -----------------------------------------------------------------------------

interface Props {
  sessionId: string;
  initialViewerCount: number;
}

export function RealtimeStatsClient({ sessionId, initialViewerCount }: Props) {
  const [viewers, setViewers] = useState(initialViewerCount);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [elapsed, setElapsed] = useState(0); // Sekunden seit Mount

  // Ticker für elapsed time
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Polling — viewer count alle 15s via /api/feed/live-count
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/live/${sessionId}/viewers`, { cache: 'no-store' });
        if (res.ok) {
          const { count } = (await res.json()) as { count: number };
          setViewers(count);
          setLastUpdate(new Date());
        }
      } catch {
        // silent
      }
    };
    const t = setInterval(() => void poll(), 15_000);
    return () => clearInterval(t);
  }, [sessionId]);

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h} Std. ${m % 60} Min.`;
    return `${m} Min. ${secs % 60} Sek.`;
  };

  const metrics = [
    { label: 'Gesamtaufrufe',              icon: Eye,           value: viewers },
    { label: 'Einnahmen',                  icon: Gem,           value: 0, isEuro: true },
    { label: 'Schenkende',                 icon: Users,         value: 0 },
    { label: 'Neue Follower*innen',        icon: UserPlus,      value: 0 },
    { label: 'Likes',                      icon: Heart,         value: 0 },
    { label: 'Zuschauer*innen live',       icon: Users,         value: viewers, highlight: true },
    { label: 'Kommentare',                 icon: MessageCircle, value: 0 },
    { label: 'Geteilt',                    icon: Share2,        value: 0 },
  ];

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <p className="text-base font-semibold">Übersicht</p>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">Dauer: {formatElapsed(elapsed)}</p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          Letzte Aktualisierung: {lastUpdate.toLocaleTimeString('de-DE')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
        {metrics.map(({ label, icon: Icon, value, highlight, isEuro }) => (
          <div key={label} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </div>
            <span className={highlight ? 'text-xl font-bold text-red-500' : 'text-xl font-semibold'}>
              {isEuro
                ? `${(value * 0.02).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                : value.toLocaleString('de-DE')}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
