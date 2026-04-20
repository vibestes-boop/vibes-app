/**
 * shared/types/index.ts
 *
 * Zentrale TypeScript-Interfaces. Platform-agnostisch.
 * Beide Apps importieren hier die "Wahrheit" über Datenstrukturen.
 *
 * Eventuell später durch generierte `supabase/database.types.ts` ergänzt
 * (via `supabase gen types typescript --project-id … > shared/supabase/database.types.ts`).
 */

export * from './profile';
export * from './live';
export * from './gift';
export * from './shop';
export * from './poll';
export * from './post';
