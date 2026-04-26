'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import {
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  Gift,
  Radio,
  Users,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { markAllNotificationsRead } from '@/app/actions/notifications';
import type { Notification, NotificationType } from '@/lib/data/notifications';

// -----------------------------------------------------------------------------
// NotificationList — Client-Component für /notifications
//
// Verantwortlichkeiten:
//  1. Beim Mount: alle ungelesenen als gelesen markieren (einmalig)
//  2. Rendering der Notification-Rows mit Avatar, Icon, Text, Zeitstempel
//  3. Link zum jeweiligen Deep-Target (Post, Profil, Live-Session)
// -----------------------------------------------------------------------------

// ── Icon + Farbe pro Notification-Typ ────────────────────────────────────────

type NotifMeta = {
  icon: typeof Heart;
  color: string; // Tailwind text-color
  bg: string;    // Tailwind bg-color (Badge-Hintergrund)
};

const TYPE_META: Record<NotificationType, NotifMeta> = {
  like:        { icon: Heart,         color: 'text-red-500',    bg: 'bg-red-500/10' },
  comment:     { icon: MessageCircle, color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  follow:      { icon: UserPlus,      color: 'text-green-500',  bg: 'bg-green-500/10' },
  mention:     { icon: AtSign,        color: 'text-violet-500', bg: 'bg-violet-500/10' },
  dm:          { icon: MessageCircle, color: 'text-blue-400',   bg: 'bg-blue-400/10' },
  gift:        { icon: Gift,          color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  live:        { icon: Radio,         color: 'text-rose-500',   bg: 'bg-rose-500/10' },
  live_invite: { icon: Users,         color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
};

// ── Notification-Text pro Typ ─────────────────────────────────────────────────

function notifText(n: Notification): string {
  const name = n.sender?.display_name || n.sender?.username || 'Jemand';
  switch (n.type) {
    case 'like':
      return `${name} hat deinen Post geliked.`;
    case 'comment':
      return n.comment_text
        ? `${name} hat kommentiert: „${n.comment_text}"`
        : `${name} hat deinen Post kommentiert.`;
    case 'follow':
      return `${name} folgt dir jetzt.`;
    case 'mention':
      return n.comment_text
        ? `${name} hat dich erwähnt: „${n.comment_text}"`
        : `${name} hat dich erwähnt.`;
    case 'dm':
      return `${name} hat dir eine Nachricht geschickt.`;
    case 'gift':
      return n.gift_emoji && n.gift_name
        ? `${name} hat dir ${n.gift_emoji} ${n.gift_name} gesendet.`
        : `${name} hat dir ein Geschenk gesendet.`;
    case 'live':
      return `${name} ist jetzt live.`;
    case 'live_invite':
      return `${name} hat dich zum Duett eingeladen.`;
    default:
      return `Neue Aktivität von ${name}.`;
  }
}

// ── Deep-Link pro Typ ─────────────────────────────────────────────────────────

function notifHref(n: Notification): Route {
  switch (n.type) {
    case 'like':
    case 'comment':
    case 'mention':
      return n.post_id ? (`/p/${n.post_id}` as Route) : ('/' as Route);
    case 'follow':
      return n.sender?.username
        ? (`/u/${n.sender.username}` as Route)
        : ('/' as Route);
    case 'dm':
      return '/messages' as Route;
    case 'gift':
    case 'live':
    case 'live_invite':
      return n.session_id ? (`/live/${n.session_id}` as Route) : ('/' as Route);
    default:
      return '/' as Route;
  }
}

// ── Relative Zeitanzeige ──────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}T`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// ── Initialen-Fallback ────────────────────────────────────────────────────────

function initials(n: Notification['sender']): string {
  const name = n?.display_name || n?.username || '?';
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  // Beim Mount alle als gelesen markieren — einmalig, fire-and-forget.
  useEffect(() => {
    const hasUnread = notifications.some((n) => !n.read);
    if (hasUnread) {
      markAllNotificationsRead().catch(() => {
        // silent — Badge wird spätestens beim nächsten Navigation-Render aktuell
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
        <Bell className="h-10 w-10 opacity-30" />
        <p className="text-sm">Noch keine Benachrichtigungen.</p>
        <p className="text-xs opacity-70">
          Wenn jemand deinen Post liked oder dir folgt, erscheint es hier.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border/50">
      {notifications.map((n) => {
        const meta = TYPE_META[n.type] ?? TYPE_META.like;
        const Icon = meta.icon;
        const href = notifHref(n);

        return (
          <li key={n.id}>
            <Link
              href={href}
              className={cn(
                'flex items-start gap-3 px-2 py-3.5 transition-colors hover:bg-muted/60 rounded-xl',
                !n.read && 'bg-primary/5',
              )}
            >
              {/* Avatar + Typ-Icon-Badge */}
              <div className="relative shrink-0">
                {n.sender?.avatar_url ? (
                  <Image
                    src={n.sender.avatar_url}
                    alt={n.sender.display_name || n.sender.username || ''}
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {initials(n.sender)}
                  </div>
                )}
                {/* Typ-Icon-Badge unten rechts */}
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background',
                    meta.bg,
                  )}
                >
                  <Icon className={cn('h-2.5 w-2.5', meta.color)} strokeWidth={2.5} />
                </span>
              </div>

              {/* Text + Timestamp */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm leading-snug text-foreground',
                    !n.read && 'font-medium',
                  )}
                >
                  {notifText(n)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatRelative(n.created_at)}
                </p>
              </div>

              {/* Unread-Dot */}
              {!n.read && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
