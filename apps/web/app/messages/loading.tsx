import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/messages` Loading-State.
 *
 * Two-Pane-Layout: Konversations-Liste links (fixed-width, scrollable),
 * Thread-Area rechts (Empty-State-Placeholder). 60×60 Avatare matchen die
 * aktuelle Message-Conversation-Row-Height aus v1.26.9.
 */
export default function MessagesLoading() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-56px)] w-full max-w-6xl">
      {/* Left: Conversation-Liste */}
      <aside className="flex w-full flex-col border-r border-border md:w-80 lg:w-96">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        <div className="flex flex-col gap-1 px-2 py-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Skeleton className="h-[60px] w-[60px] shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right: Empty-State */}
      <section className="hidden flex-1 flex-col items-center justify-center gap-3 md:flex">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
      </section>
    </div>
  );
}
