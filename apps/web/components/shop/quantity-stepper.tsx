'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// QuantityStepper — [−] NN [+]-Pill für die Buy-Bar.
// Max: stock===-1 → 99, sonst stock.
// -----------------------------------------------------------------------------

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  className?: string;
}) {
  const canDec = value > min && !disabled;
  const canInc = value < max && !disabled;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0 rounded-full border bg-card text-sm',
        disabled && 'opacity-50',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => canDec && onChange(value - 1)}
        disabled={!canDec}
        className="flex h-10 w-10 items-center justify-center rounded-l-full transition-colors hover:bg-muted disabled:cursor-not-allowed"
        aria-label="Menge verringern"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span
        className="flex h-10 min-w-[2.5rem] items-center justify-center px-2 font-medium tabular-nums"
        aria-live="polite"
      >
        {value.toString().padStart(2, '0')}
      </span>
      <button
        type="button"
        onClick={() => canInc && onChange(value + 1)}
        disabled={!canInc}
        className="flex h-10 w-10 items-center justify-center rounded-r-full transition-colors hover:bg-muted disabled:cursor-not-allowed"
        aria-label="Menge erhöhen"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
