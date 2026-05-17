import type { Metadata } from 'next';
import { getAdminReports, getModerationHealth } from '@/app/actions/admin';
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
  const [reports, health] = await Promise.all([
    getAdminReports('pending'),
    getModerationHealth(),
  ]);
  return <AdminReportsClient initialReports={reports} initialStatus="pending" health={health} />;
}
