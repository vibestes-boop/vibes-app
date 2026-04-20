import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn/ui Standard-Helper: merged Tailwind-Classes intelligent.
 * Konflikte werden automatisch aufgelöst (`px-2 px-4` → `px-4`).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
