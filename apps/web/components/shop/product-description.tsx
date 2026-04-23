'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// ProductDescription (C6) — ersetzt das alte `<details><summary>`-Pattern.
// Warum nicht mehr <details>?
//   • `details` ist nativ, aber nicht animierbar (kein smooth-expand in Browsern
//     ohne content-visibility; Safari spring-snaps).
//   • Wir wollen einen TikTok/Instagram-artigen „mehr anzeigen…"-Fade: Text
//     hat eine Collapsed-Höhe mit weichem Gradient-Mask am unteren Rand, der
//     beim Ausklappen sanft wegblendet.
//
// Implementierung:
//   • Collapsed-Höhe = konst. CSS `max-height`. Expanded = gemessene Inhalts-
//     Höhe via `scrollHeight`, damit die Animation eine Ziel-Höhe hat (die
//     `transition` auf `max-height:auto` funktioniert in CSS nicht).
//   • Gradient-Mask via `mask-image: linear-gradient(...)` im Collapsed-State.
//     Expanded entfernt die Mask, damit der Text am unteren Rand nicht aus-
//     blendet.
//   • Wenn der Content ohnehin unter die Collapsed-Höhe passt, wird der
//     „Mehr"-Button versteckt (kein sinnloses Click-Target).
// -----------------------------------------------------------------------------

const COLLAPSED_MAX_PX = 128; // entspricht ~7 Zeilen bei text-sm/leading-relaxed

export function ProductDescription({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // -----------------------------------------------------------------------------
  // Measure: after first layout, check if the content overflows. Wenn ja,
  // speichern wir die volle Höhe für die Expand-Animation. useLayoutEffect
  // statt useEffect, damit der Toggle-Button nicht erst nach einem zweiten
  // Frame aufpoppt (sichtbares Flackern).
  // -----------------------------------------------------------------------------
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const full = el.scrollHeight;
    setMeasuredHeight(full);
    setNeedsToggle(full > COLLAPSED_MAX_PX + 4); // +4 tolerance für Sub-Pixel-Rounding
  }, [text]);

  return (
    <div
      className={cn(
        'rounded-xl bg-muted/40 p-4 text-sm ring-1 ring-black/5 dark:ring-white/10',
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Beschreibung</h3>
        {needsToggle && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-black/5 transition-colors duration-fast ease-out-expo hover:bg-background dark:bg-background/50 dark:ring-white/10 dark:hover:bg-background/80"
            aria-expanded={expanded}
          >
            {expanded ? 'Weniger' : 'Mehr'}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform duration-base ease-out-expo',
                expanded && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
        )}
      </div>

      <div
        className={cn(
          'relative overflow-hidden transition-[max-height] duration-base ease-out-expo',
          // Gradient-Fade nur wenn wir wirklich collapsen müssen und NICHT
          // expanded sind. Im expanded-State rutscht der Text bis zum Rand.
          needsToggle &&
            !expanded &&
            '[mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_60%,transparent_100%)]',
        )}
        style={{
          maxHeight: needsToggle
            ? expanded
              ? measuredHeight ?? undefined
              : COLLAPSED_MAX_PX
            : undefined,
        }}
      >
        <div ref={contentRef}>
          <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{text}</p>
        </div>
      </div>
    </div>
  );
}
