'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Bell } from 'lucide-react';
import { useNotificationsDrawer } from '@/lib/notifications-drawer-store';
import { getNotifications } from '@/lib/data/notifications';
import { NotificationList } from './notification-list';
import type { Notification } from '@/lib/data/notifications';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/client';

// -----------------------------------------------------------------------------
// NotificationsDrawer — globale Slide-Over von rechts.
//
// Kann von jeder Seite geöffnet werden (FeedSidebar Bell, MobileBottomNav, etc.)
// via `useNotificationsDrawer().openDrawer()`.
//
// Daten werden beim ersten Öffnen geladen (lazy). Backdrop schließt den Drawer.
// ESC-Taste schließt ebenfalls.
// -----------------------------------------------------------------------------

export function NotificationsDrawer({ viewerId }: { viewerId: string | null }) {
  const { t } = useI18n();
  const { open, closeDrawer } = useNotificationsDrawer();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Daten laden sobald der Drawer zum ersten Mal geöffnet wird
  useEffect(() => {
    if (!open || loaded || !viewerId) return;
    setLoading(true);
    // Server Action direkt aufrufen (importiert als 'use server' weiter oben)
    import('@/app/actions/notifications')
      .then(({ getNotificationsClient }) => getNotificationsClient())
      .catch(() => [])
      .then((data) => {
        setNotifications(data ?? []);
        setLoaded(true);
        setLoading(false);
      });
  }, [open, loaded, viewerId]);

  // ESC schließt den Drawer
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeDrawer]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeDrawer}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Drawer Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('notif.title')}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-dvh w-full flex-col border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-out sm:w-[400px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-foreground/70" />
            <h2 className="text-base font-semibold">{t('notif.title')}</h2>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label={t('common.close')}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!viewerId ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t('notif.loginHint')}
            </div>
          ) : loading ? (
            <NotificationsSkeleton />
          ) : (
            <NotificationList
              notifications={notifications}
              viewerId={viewerId}
              initialHasMore={notifications.length >= 40}
            />
          )}
        </div>
      </div>
    </>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
