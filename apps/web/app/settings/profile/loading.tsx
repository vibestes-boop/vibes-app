import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsProfileLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      {/* Avatar section */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      {/* Form fields */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-28 rounded-lg" />
    </div>
  );
}
