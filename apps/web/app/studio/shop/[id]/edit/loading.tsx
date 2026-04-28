import { Skeleton } from '@/components/ui/skeleton';

export default function EditProductLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <Skeleton className="mb-6 h-5 w-32" />
      <Skeleton className="mb-8 h-8 w-52" />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
