import type { Metadata } from 'next';
import { Flower2 } from 'lucide-react';

import { getWomenOnlyRequests } from '@/app/actions/admin';
import { WozReviewList } from '@/components/admin/woz-review-list';

export const metadata: Metadata = {
  title: 'Admin — Women-Only Zone',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function AdminWomenOnlyPage() {
  const [pending, approved] = await Promise.all([
    getWomenOnlyRequests('pending'),
    getWomenOnlyRequests('approved'),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Flower2 className="mt-0.5 h-5 w-5 text-rose-500" />
        <div>
          <h1 className="text-lg font-bold text-foreground">Women-Only Zone</h1>
          <p className="text-xs text-muted-foreground">
            Beitritte prüfen und freigeben. Jeder Beitritt wird geprüft — Zugang gibt es erst nach Freigabe.
          </p>
        </div>
      </div>

      <WozReviewList pending={pending} approved={approved} />
    </div>
  );
}
