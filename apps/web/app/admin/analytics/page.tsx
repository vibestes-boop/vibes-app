import type { Metadata } from 'next';
import { getAdminCommandCenterSnapshot } from '@/app/actions/admin';
import { GrowthPanel } from '@/app/admin/command-center/growth-panel';
import { TopContentPanel } from '@/app/admin/command-center/top-content-panel';
import { Panel, StatCard } from '@/components/admin/section-ui';

export const metadata: Metadata = { title: 'Admin — Analytics', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function AdminAnalyticsPage() {
  const snapshot = await getAdminCommandCenterSnapshot();

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-foreground">Analytics</h1>
        <p className="text-xs text-muted-foreground">Wachstum, Engagement und Top-Inhalte der Plattform.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {snapshot.platform_metrics.map((metric) => (
          <StatCard key={metric.key} label={metric.label} value={metric.value || '—'} sub={metric.sublabel} />
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="Nutzerwachstum">
          <GrowthPanel series={snapshot.growth_series} />
        </Panel>
        <Panel title="Top-Inhalte">
          <TopContentPanel posts={snapshot.top_content} reels={snapshot.top_reels} stories={snapshot.top_stories} />
        </Panel>
      </div>
    </div>
  );
}
