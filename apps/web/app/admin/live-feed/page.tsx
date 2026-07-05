import type { Metadata } from 'next';
import { getAdminCommandCenterSnapshot } from '@/app/actions/admin';
import { Panel, StatCard, ActivityList, QueueList } from '@/components/admin/section-ui';
import { AutoRefresh } from '@/components/admin/auto-refresh';

export const metadata: Metadata = { title: 'Admin — Live Feed', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminLiveFeedPage() {
  const snapshot = await getAdminCommandCenterSnapshot();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-foreground">Live Feed</h1>
          <p className="text-xs text-muted-foreground">Aktivität in Echtzeit und offene Moderation.</p>
        </div>
        <AutoRefresh intervalMs={20000} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Aktive Lives" value={snapshot.admin_stats.active_lives} />
        <StatCard label="Posts gesamt" value={snapshot.admin_stats.total_posts} />
        <StatCard label="Offene Reports" value={snapshot.admin_stats.pending_reports} />
        <StatCard label="Neue Nutzer (7d)" value={snapshot.admin_stats.new_users_7d} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="Live-Aktivität">
          <ActivityList items={snapshot.activity} />
        </Panel>
        <Panel title="Moderations-Warteschlange">
          <QueueList rows={snapshot.moderation_queue} />
        </Panel>
      </div>
    </div>
  );
}
