import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// EmptyState — einheitliche Empty-View für Listen/Grids/Tabs die grad keinen
// Content haben. Entspricht dem Fix D5 aus UI_AUDIT_WEB.md: Icon-Circle +
// Title + Description + optional CTA, zentriert, ohne harten Chrome-Container.
//
// Varianten:
//   • size='sm'   — kompakt, für In-Grid-Zellen oder kleine Tabs
//   • size='md'   — default, für Seitenbereiche mit klarer Empty-Situation
//   • size='lg'   — großzügig, für eigenständige Screens (Messages-Inbox etc.)
//
//   • bordered    — rendert dashed-border-Wrapper für Fälle wo der Leerraum
//                   eine visuelle Begrenzung braucht (z.B. Profile-Post-Grid
//                   mit nur-wenigen-Reihen-Kontext, wo sonst nichts den
//                   "Tab-Content-Area"-Scope markiert)
//
// Die Icon-Prop nimmt ReactNode statt LucideIcon, damit Callsites sowohl
// Lucide-Components (`<Grid3x3 className="h-8 w-8" />`) als auch Emoji-
// Strings (`<span className="text-5xl">🛒</span>`) übergeben können — die
// bestehenden 12 Inline-Empty-States in der App mischen beide Stile.
// -----------------------------------------------------------------------------

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  cta?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  bordered?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  cta,
  size = 'md',
  bordered = false,
  className,
}: EmptyStateProps) {
  const sizing = {
    sm: {
      wrapperY: 'py-10',
      circle: 'h-14 w-14 p-3',
      title: 'text-base',
      description: 'text-xs',
      gap: 'mt-1',
      ctaGap: 'mt-4',
    },
    md: {
      wrapperY: 'py-16',
      circle: 'h-16 w-16 p-4',
      title: 'text-lg',
      description: 'text-sm',
      gap: 'mt-1.5',
      ctaGap: 'mt-5',
    },
    lg: {
      wrapperY: 'py-20',
      circle: 'h-20 w-20 p-5',
      title: 'text-xl',
      description: 'text-sm',
      gap: 'mt-2',
      ctaGap: 'mt-6',
    },
  }[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        sizing.wrapperY,
        bordered && 'rounded-xl border border-dashed border-border bg-card/30',
        className,
      )}
    >
      <div
        className={cn(
          'mb-4 grid place-items-center rounded-full bg-muted/50 text-muted-foreground',
          sizing.circle,
        )}
      >
        {icon}
      </div>
      <h3 className={cn('font-semibold text-foreground', sizing.title)}>{title}</h3>
      {description && (
        <p
          className={cn(
            'max-w-xs text-muted-foreground',
            sizing.description,
            sizing.gap,
          )}
        >
          {description}
        </p>
      )}
      {cta && <div className={sizing.ctaGap}>{cta}</div>}
    </div>
  );
}
