import { Skeleton } from '@/components/ui/skeleton';

export default function PrivacySettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <Skeleton className="mb-8 h-8 w-48" />

      {/* Cookie section */}
      <div className="mb-6 rounded-xl border p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Data export section */}
      <div className="mb-6 rounded-xl border p-5 space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 p-5 space-y-3">
        <Skeleton className="h-5 w-40 bg-destructive/20" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-10 w-48 rounded-lg bg-destructive/20" />
      </div>
    </div>
  );
}
