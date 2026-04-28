import { Skeleton } from '@/components/ui/skeleton';
import { Hash } from 'lucide-react';

// Skeleton for /t/[tag] — Hashtag detail page
export default function HashtagLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 lg:px-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Hash className="h-8 w-8 text-muted-foreground/40" strokeWidth={2.5} />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      </header>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 24 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[9/16] w-full rounded-sm" />
        ))}
      </div>
    </main>
  );
}
