import { Skeleton } from '@/components/ui/skeleton';

// Skeleton for /u/[username]/followers
export default function FollowersLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-6">
      {/* Back + heading */}
      <div className="mb-5 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-40" />
      </div>

      {/* User list */}
      <ul className="divide-y divide-border">
        {Array.from({ length: 10 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-11 w-11 flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
