import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsBlockedLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-4 w-64" />
      <ul className="divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-10 w-10 rounded-full" />
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
