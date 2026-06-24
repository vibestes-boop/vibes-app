import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn/ui Standard-Helper: merged Tailwind-Classes intelligent.
 * Konflikte werden automatisch aufgelöst (`px-2 px-4` → `px-4`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatiert einen Euro-Betrag deutsch: ganze Beträge ohne Nachkommastellen
 * (12 €), krumme mit zweien (7,90 €). `null`/ungültig → null.
 */
export function formatEur(value: number | null | undefined): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const hasFraction = Math.round(n * 100) % 100 !== 0;
  return (
    n.toLocaleString('de-DE', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    }) + ' €'
  );
}
