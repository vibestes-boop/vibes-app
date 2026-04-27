import { Skeleton } from '@/components/ui/skeleton';

// Message thread skeleton — chat bubbles + input bar
export default function MessageThreadLoading() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-hidden px-4 py-4">
        {/* Incoming */}
        <div className="flex items-end gap-2">
          <Skeleton className="h-7 w-7 flex-shrink-0 rounded-full" />
          <Skeleton className="h-10 w-48 rounded-2xl rounded-bl-sm" />
        </div>
        {/* Outgoing */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-40 rounded-2xl rounded-br-sm" />
        </div>
        {/* Incoming long */}
        <div className="flex items-end gap-2">
          <Skeleton className="h-7 w-7 flex-shrink-0 rounded-full" />
          <Skeleton className="h-16 w-64 rounded-2xl rounded-bl-sm" />
        </div>
        {/* Outgoing */}
        <div className="flex justify-end">
          <Skeleton className="h-10 w-56 rounded-2xl rounded-br-sm" />
        </div>
        {/* Incoming */}
        <div className="flex items-end gap-2">
          <Skeleton className="h-7 w-7 flex-shrink-0 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-2xl rounded-bl-sm" />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t px-4 py-3">
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}
