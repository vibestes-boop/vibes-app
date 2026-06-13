import type { Route } from 'next';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminReports, getAdminRoleStatus, getModerationHealth } from '@/app/actions/admin';
import { AdminReportsClient } from './admin-reports-client';

// -----------------------------------------------------------------------------
// /admin/reports — Meldungs-Queue (Server Shell)
// v1.w.UI.215
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Admin — Meldungen',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const roles = await getAdminRoleStatus();
  if (!roles.can_moderate) redirect('/admin' as Route);

  const [reports, health] = await Promise.all([
    getAdminReports('pending'),
    getModerationHealth(),
  ]);
  return <AdminReportsClient initialReports={reports} initialStatus="pending" health={health} />;
}
