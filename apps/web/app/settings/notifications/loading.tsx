import { Skeleton } from '@/components/ui/skeleton';

export default function NotificationSettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <Skeleton className="mb-8 h-8 w-56" />

      {/* Web push card */}
      <div className="mb-6 rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Notification preferences — toggle rows */}
      <div className="rounded-xl border divide-y divide-border overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3.5">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
