import { Skeleton } from '@/components/ui/skeleton';

// Spiegelt CreateEditor: linke Seite Upload-Area, rechte Seite Formular.
export default function CreateLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6">
      <Skeleton className="mb-8 h-8 w-44" />
      <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
        {/* Upload area */}
        <Skeleton className="aspect-[9/16] w-full rounded-2xl" />

        {/* Form fields */}
        <div className="space-y-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
          {/* Toggle rows */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
