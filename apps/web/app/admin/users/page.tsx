import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminRoleStatus, getAdminUsersPageSnapshot } from '@/app/actions/admin';
import { AdminUsersClient } from './admin-users-client';

// -----------------------------------------------------------------------------
// /admin/users — Nutzerverwaltung (Server Shell)
//
// v1.w.UI.215: Parity mit app/admin/users.tsx.
// Lädt initiale Liste (leere Query → alle) server-seitig,
// dann übernimmt die Client-Komponente für Live-Suche + Aktionen.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Admin — Nutzerverwaltung',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const roles = await getAdminRoleStatus();
  if (!roles.can_admin) redirect('/admin');

  const snapshot = await getAdminUsersPageSnapshot();
  return <AdminUsersClient initialSnapshot={snapshot} />;
}
