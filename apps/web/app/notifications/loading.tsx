import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/notifications` Loading-State.
 *
 * Header + list of notification rows.
 * Each row: avatar circle | two text lines | timestamp stub.
 * Alternating widths give the impression of varied notification text.
 */
export default function NotificationsLoading() {
  const widths = ['w-2/3', 'w-3/4', 'w-1/2', 'w-3/5', 'w-4/5', 'w-2/3', 'w-1/2', 'w-3/4'];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-7 w-52" />
      </div>

      {/* Notification rows */}
      <ul className="divide-y divide-border">
        {widths.map((w, i) => (
          <li key={i} className="flex items-start gap-3 py-4">
            <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className={`h-4 ${w}`} />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-3 w-10 flex-shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}
