'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { setOnboardingInterests } from '@/app/actions/auth';

// -----------------------------------------------------------------------------
// InterestsPickerForm — Onboarding Schritt 3: Interessen wählen (v1.w.UI.232)
//
// Parity mit native (onboarding)/interests.tsx.
// Min. 3 Kategorien → preferred_tags in profiles → Feed-Algorithmus.
// Weiter zu /onboarding/follow nach Bestätigung.
// -----------------------------------------------------------------------------

const INTERESTS = [
  'Musik',
  'Sport',
  'Kunst',
  'Tech',
  'Gaming',
  'Reisen',
  'Fitness',
  'Mode',
  'Kochen',
  'Tanz',
  'Comedy',
  'Natur',
  'Bildung',
  'Familie',
  'Autos',
  'Tschetschenien',
];

const MIN_TAGS = 3;

export function InterestsPickerForm({ next }: { next: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size < MIN_TAGS) {
      toast.error(`Bitte wähle mindestens ${MIN_TAGS} Interessen.`);
      return;
    }
    startTransition(async () => {
      const res = await setOnboardingInterests(Array.from(selected));
      if (!res.ok) {
        toast.error(res.error ?? 'Fehler beim Speichern.');
        return;
      }
      router.push(`/onboarding/follow?next=${encodeURIComponent(next)}` as Route);
    });
  };

  const remaining = Math.max(0, MIN_TAGS - selected.size);

  return (
    <div className="space-y-6">
      {/* Tag grid */}
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map((tag) => {
          const isSelected = selected.has(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={[
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-100',
                isSelected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Counter hint */}
      <p className="text-center text-xs text-muted-foreground">
        {selected.size === 0
          ? `Wähl mindestens ${MIN_TAGS} Themen`
          : remaining > 0
            ? `Noch ${remaining} weitere${remaining === 1 ? 's' : ''} wählen`
            : `${selected.size} Themen gewählt ✓`}
      </p>

      {/* CTA */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={selected.size < MIN_TAGS || isPending}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-semibold text-background transition-opacity hover:bg-foreground/90 disabled:opacity-40"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Weiter
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>

      {/* Skip */}
      <button
        type="button"
        onClick={() =>
          router.push(`/onboarding/follow?next=${encodeURIComponent(next)}` as Route)
        }
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Überspringen
      </button>
    </div>
  );
}
