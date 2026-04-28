import { Skeleton } from '@/components/ui/skeleton';

// Loading skeleton for /onboarding/follow — shown while getSuggestedFollows
// fetches the initial 12 account suggestions.

export default function OnboardingFollowLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 space-y-2 text-center">
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="mx-auto h-4 w-72" />
      </div>

      {/* Account cards grid — mirrors the 3-col layout of FollowStep */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center"
          >
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="w-full space-y-1.5">
              <Skeleton className="mx-auto h-3.5 w-24" />
              <Skeleton className="mx-auto h-3 w-16" />
              <Skeleton className="mx-auto h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>

      {/* Continue button */}
      <div className="mt-6 flex justify-center">
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
    </div>
  );
}
