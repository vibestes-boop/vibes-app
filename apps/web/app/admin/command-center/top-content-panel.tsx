'use client';

import { useState } from 'react';
import type { CommandTopContentItem } from '@/app/actions/admin';
import { cn } from '@/lib/utils';

type TopContentMode = 'posts' | 'reels' | 'stories';

const TABS: Array<{ mode: TopContentMode; label: string }> = [
  { mode: 'posts', label: 'Top Posts' },
  { mode: 'reels', label: 'Top Reels' },
  { mode: 'stories', label: 'Top Stories' },
];

export function TopContentPanel({
  posts,
  reels,
  stories,
}: {
  posts: CommandTopContentItem[];
  reels: CommandTopContentItem[];
  stories: CommandTopContentItem[];
}) {
  const [selectedMode, setSelectedMode] = useState<TopContentMode>('posts');
  const items = selectedMode === 'reels' ? reels : selectedMode === 'stories' ? stories : posts;

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 flex items-center gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => setSelectedMode(tab.mode)}
            className={cn(
              'rounded-md px-2 py-1 text-[10px] font-bold transition-colors',
              selectedMode === tab.mode
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
            )}
            aria-pressed={selectedMode === tab.mode}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-slate-200 px-3 text-center text-[11px] text-slate-500">
          Top Inhalte fuer diesen Bereich noch nicht verfuegbar.
        </div>
      ) : (
        <table className="w-full min-w-0 table-fixed text-left text-[9px]">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="w-5 pb-1.5 font-semibold">#</th>
              <th className="pb-1.5 font-semibold">Inhalt</th>
              <th className="w-12 pb-1.5 text-right font-semibold">Likes</th>
              <th className="w-12 pb-1.5 text-right font-semibold">Komm.</th>
              <th className="w-12 pb-1.5 text-right font-semibold">Eng.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-1 align-middle font-bold tabular-nums text-slate-400">{index + 1}</td>
                <td className="min-w-0 py-1.5 pr-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-slate-100">
                      {item.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                          {index + 1}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold leading-4 text-slate-800">{item.title}</div>
                      <div className="truncate text-[9px] leading-3 text-slate-500">
                        {item.author_username ? `von @${item.author_username}` : formatDate(item.created_at)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-1.5 text-right align-middle font-semibold tabular-nums text-slate-700">{formatCompactNumber(item.likes)}</td>
                <td className="py-1.5 text-right align-middle font-semibold tabular-nums text-slate-700">{formatCompactNumber(item.comments)}</td>
                <td className="py-1.5 text-right align-middle font-semibold tabular-nums text-slate-700">
                  {item.engagement_rate === null ? '-' : `${Math.round(item.engagement_rate * 100)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
