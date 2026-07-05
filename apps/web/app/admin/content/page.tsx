import type { Metadata } from 'next';
import { getAdminCommandCenterSnapshot } from '@/app/actions/admin';
import { TopContentPanel } from '@/app/admin/command-center/top-content-panel';
import { Panel, StatCard, ActivityList } from '@/components/admin/section-ui';

export const metadata: Metadata = { title: 'Admin — Inhalte', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminContentPage() {
  const snapshot = await getAdminCommandCenterSnapshot();

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-foreground">Inhalte</h1>
        <p className="text-xs text-muted-foreground">Top-Inhalte und aktuelle Aktivität auf der Plattform.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Posts gesamt" value={snapshot.admin_stats.total_posts} />
        <StatCard label="Aktive Lives" value={snapshot.admin_stats.active_lives} />
        <StatCard label="Neue Nutzer (7d)" value={snapshot.admin_stats.new_users_7d} />
        <StatCard label="Offene Reports" value={snapshot.admin_stats.pending_reports} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Top-Inhalte">
          <TopContentPanel posts={snapshot.top_content} reels={snapshot.top_reels} stories={snapshot.top_stories} />
        </Panel>
        <Panel title="Aktuelle Aktivität">
          <ActivityList items={snapshot.activity} />
        </Panel>
      </div>
    </div>
  );
}
