import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getUser } from '@/lib/auth/session';
import { getNotifications } from '@/lib/data/notifications';
import { NotificationList } from '@/components/notifications/notification-list';

// -----------------------------------------------------------------------------
// /notifications — Aktivitäts-Feed (v1.w.UI.38)
//
// SSR: Notifications werden server-seitig geladen (frischester Stand beim
// ersten Render). Client-Component `NotificationList` markiert beim Mount
// alle ungelesen als gelesen (einmalig via Server Action).
//
// Nur für eingeloggte Nutzer — Redirect zu /login sonst.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Benachrichtigungen — Serlo',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/notifications');

  const notifications = await getNotifications();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      <header className="mb-6 flex items-center gap-2">
        <Bell className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Benachrichtigungen</h1>
      </header>
      <NotificationList notifications={notifications} />
    </div>
  );
}
