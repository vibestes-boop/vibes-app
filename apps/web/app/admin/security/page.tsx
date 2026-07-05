import type { Metadata } from 'next';
import { getAdminCommandCenterSnapshot } from '@/app/actions/admin';
import { AreaCard, OverallStatusBadge } from '@/components/admin/section-ui';

export const metadata: Metadata = { title: 'Admin — Sicherheit', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminSecurityPage() {
  const snapshot = await getAdminCommandCenterSnapshot();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Sicherheit &amp; System</h1>
          <p className="text-xs text-muted-foreground">Integrität, Kosten, Moderation und Systemzustand.</p>
        </div>
        <OverallStatusBadge status={snapshot.overall_status} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.areas.map((area) => (
          <AreaCard key={area.key} area={area} />
        ))}
      </div>
    </div>
  );
}
