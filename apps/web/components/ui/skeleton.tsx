import { cn } from '@/lib/utils';

/**
 * Shared Skeleton-Primitive für loading.tsx-Files.
 *
 * Nutzt Tailwind's `animate-pulse` + `bg-muted` als Lichtschicht. Ein reines
 * Server-Component (kein "use client") — wird von Suspense-Boundaries gerendert
 * während eine Page-Hierarchie async-Fetcht. Kein JS im Bundle.
 *
 * Design-Hinweis: Absichtlich KEIN Shimmer-Gradient (war angedacht, aber
 * `animate-pulse` ist optisch ruhiger und spart Keyframe-Arbeit; shadcn/ui
 * macht es genauso). Varianten per `rounded-*`-Utility inline setzen.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}
