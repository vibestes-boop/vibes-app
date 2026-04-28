'use client';

import { useState, useTransition } from 'react';
import { Heart, MessageCircle, UserPlus, Mail, Radio, Gift, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { updateNotifPrefs, type NotifPrefs } from '@/app/actions/profile';

// -----------------------------------------------------------------------------
// NotifPrefsCard — v1.w.UI.63
//
// Pro-Kanal Toggle-Kacheln für Notification-Präferenzen.
// Jeder Toggle ruft `updateNotifPrefs` als Server Action auf (optimistisch).
// Rollback bei Fehler — kein Refetch nötig, lokaler State reicht da die Werte
// unabhängig voneinander sind.
//
// Slot-Reihenfolge orientiert sich an Wichtigkeit / Häufigkeit:
//   Likes → Kommentare → Follower → Nachrichten → Live → Geschenke → Bestellungen
// -----------------------------------------------------------------------------

type PrefKey = keyof NotifPrefs;

interface Channel {
  key: PrefKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CHANNELS: Channel[] = [
  {
    key: 'likes',
    label: 'Likes',
    description: 'Jemand liked deinen Post.',
    icon: Heart,
  },
  {
    key: 'comments',
    label: 'Kommentare',
    description: 'Jemand kommentiert deinen Post oder antwortet dir.',
    icon: MessageCircle,
  },
  {
    key: 'follows',
    label: 'Neue Follower',
    description: 'Jemand folgt dir.',
    icon: UserPlus,
  },
  {
    key: 'messages',
    label: 'Nachrichten',
    description: 'Du erhältst eine neue Direktnachricht.',
    icon: Mail,
  },
  {
    key: 'live',
    label: 'Live-Streams',
    description: 'Jemand dem du folgst geht live oder lädt dich ein.',
    icon: Radio,
  },
  {
    key: 'gifts',
    label: 'Geschenke',
    description: 'Jemand schickt dir ein Geschenk im Live.',
    icon: Gift,
  },
  {
    key: 'orders',
    label: 'Shop-Bestellungen',
    description: 'Jemand kauft eines deiner Produkte.',
    icon: ShoppingBag,
  },
];

export function NotifPrefsCard({ initialPrefs }: { initialPrefs: NotifPrefs }) {
  const [prefs, setPrefs] = useState<NotifPrefs>(initialPrefs);
  const [pending, startTransition] = useTransition();

  const toggle = (key: PrefKey) => {
    const previous = prefs[key];
    const next = !previous;

    // Optimistisch updaten
    setPrefs((p) => ({ ...p, [key]: next }));

    startTransition(async () => {
      const res = await updateNotifPrefs({ [key]: next });
      if (!res.ok) {
        // Rollback
        setPrefs((p) => ({ ...p, [key]: previous }));
        toast.error(res.error ?? 'Einstellung konnte nicht gespeichert werden.');
      }
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">Benachrichtigungs-Kanäle</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Steuere für welche Ereignisse du Push-Benachrichtigungen erhältst.
        </p>
      </div>

      <ul className="divide-y divide-border">
        {CHANNELS.map((ch) => {
          const enabled = prefs[ch.key];
          return (
            <li key={ch.key} className="flex items-center gap-4 px-5 py-4">
              {/* Icon */}
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                  enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <ch.icon className="h-4 w-4" />
              </div>

              {/* Label + description */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{ch.label}</div>
                <div className="text-xs text-muted-foreground">{ch.description}</div>
              </div>

              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${ch.label} ${enabled ? 'deaktivieren' : 'aktivieren'}`}
                disabled={pending}
                onClick={() => toggle(ch.key)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  enabled ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                    enabled ? 'translate-x-5' : 'translate-x-0',
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
