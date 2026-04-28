import { Skeleton } from '@/components/ui/skeleton';

// Spiegelt HomeFeedShell mit initialTab="following":
// Tab-Leiste oben + drei 9:16-Post-Karten gestapelt.
export default function FollowingLoading() {
  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background">
      {/* Tab bar */}
      <div className="flex shrink-0 justify-center gap-6 px-4 pt-4 pb-3">
        {['Für dich', 'Following'].map((label) => (
          <Skeleton key={label} className="h-5 w-20" />
        ))}
      </div>

      {/* Full-screen video card */}
      <div className="relative flex-1">
        <Skeleton className="absolute inset-0 rounded-none" />
        {/* Bottom overlay */}
        <div className="absolute bottom-8 left-4 right-16 space-y-2">
          <Skeleton className="h-4 w-40 bg-white/20" />
          <Skeleton className="h-3 w-56 bg-white/15" />
          <Skeleton className="h-3 w-32 bg-white/15" />
        </div>
        {/* Right action bar */}
        <div className="absolute right-3 bottom-16 flex flex-col items-center gap-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-full bg-white/20" />
          ))}
        </div>
      </div>
    </div>
  );
}
