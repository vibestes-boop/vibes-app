import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// Read-only Star-Rating-Display. Zeigt avg_rating + review_count inline.
// Für Interaktiv-Rating siehe <StarPicker>.
// -----------------------------------------------------------------------------

export function StarDisplay({
  rating,
  count,
  size = 14,
  className,
  showCount = true,
}: {
  rating: number | null;
  count?: number;
  size?: number;
  className?: string;
  showCount?: boolean;
}) {
  const r = rating ?? 0;
  // Runde auf halbe Sterne für eine Anzeige die nicht unehrlich precise wirkt
  const rounded = Math.round(r * 2) / 2;

  return (
    <span className={cn('inline-flex items-center gap-1 text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-0.5" aria-label={`${r.toFixed(1)} von 5 Sternen`}>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = rounded >= i;
          const half = !filled && rounded >= i - 0.5;
          return (
            <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
              <Star size={size} className="text-muted-foreground/40" />
              {(filled || half) && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: half ? size / 2 : size }}
                >
                  <Star size={size} className="fill-amber-400 text-amber-400" />
                </span>
              )}
            </span>
          );
        })}
      </span>
      {showCount && count !== undefined && (
        <span className="text-xs tabular-nums">
          {r > 0 ? r.toFixed(1) : '–'}
          {count > 0 && <span className="text-muted-foreground/70"> ({count})</span>}
        </span>
      )}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Interaktiv — für Review-Form. Controlled input.
// -----------------------------------------------------------------------------

export function StarPicker({
  value,
  onChange,
  size = 28,
  className,
  disabled = false,
}: {
  value: number;
  onChange: (next: number) => void;
  size?: number;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn('inline-flex items-center gap-1', className)} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => {
        const active = value >= i;
        return (
          <button
            key={i}
            type="button"
            onClick={() => !disabled && onChange(i)}
            disabled={disabled}
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} Sterne`}
            className={cn(
              'transition-transform',
              !disabled && 'hover:scale-110 cursor-pointer',
              disabled && 'opacity-50',
            )}
          >
            <Star
              size={size}
              className={cn(
                active ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-muted-foreground/40',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
