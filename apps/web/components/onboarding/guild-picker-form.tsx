'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Check, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { setOnboardingGuild } from '@/app/actions/auth';
import type { GuildWithMeta } from '@/lib/data/guilds';

// -----------------------------------------------------------------------------
// GuildPickerForm — Onboarding Schritt 2: Guild/Pod auswählen (v1.w.UI.232)
//
// Parity mit native (onboarding)/guild.tsx.
// Zeigt alle 5 Pods als Radio-Karten. Bestätigen → setOnboardingGuild() →
// Weiter zu /onboarding/interests.
// -----------------------------------------------------------------------------

export function GuildPickerForm({ guilds, next }: { guilds: GuildWithMeta[]; next: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!selected) return;
    startTransition(async () => {
      const res = await setOnboardingGuild(selected);
      if (!res.ok) {
        toast.error(res.error ?? 'Fehler beim Speichern.');
        return;
      }
      router.push(`/onboarding/interests?next=${encodeURIComponent(next)}` as Route);
    });
  };

  return (
    <div className="space-y-4">
      {/* Guild cards */}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {guilds.map((guild) => {
          const isSelected = selected === guild.id;

          return (
            <li key={guild.id}>
              <button
                type="button"
                onClick={() => setSelected(guild.id)}
                className={[
                  'group w-full rounded-xl border p-4 text-left transition-colors duration-150',
                  isSelected
                    ? 'border-foreground bg-muted'
                    : 'border-border bg-transparent hover:bg-muted/60',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">
                      {guild.name}
                    </p>
                    {guild.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {guild.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {guild.member_count.toLocaleString('de-DE')} Mitglieder
                    </p>
                    {guild.vibe_tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {guild.vibe_tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Checkmark */}
                  <div
                    className={[
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isSelected
                        ? 'border-foreground bg-foreground'
                        : 'border-border bg-transparent',
                    ].join(' ')}
                  >
                    {isSelected && <Check className="h-3 w-3 text-background" strokeWidth={3} />}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* CTA */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!selected || isPending}
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
          router.push(`/onboarding/interests?next=${encodeURIComponent(next)}` as Route)
        }
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Überspringen
      </button>
    </div>
  );
}
