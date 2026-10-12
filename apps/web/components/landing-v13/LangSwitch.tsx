'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { setLocale } from '@/app/actions/locale';
import { LANGS, type Lang } from './i18n';

// Sprachumschalter der Landing. Setzt wie der Umschalter im Avatar-Menü das
// Locale-Cookie der Web-App und lädt die Seite mit den neuen Texten neu.
export function LangSwitch({ lang, label, className = 'nav-lang' }: { lang: Lang; label: string; className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <nav className={className} aria-label={label}>
      {LANGS.map((l) => {
        const on = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-current={on ? 'true' : undefined}
            className={on ? 'is-on' : undefined}
            disabled={pending}
            onClick={() => {
              if (on) return;
              startTransition(async () => {
                await setLocale(l.code, pathname);
                router.refresh();
              });
            }}
          >
            {l.label}
          </button>
        );
      })}
    </nav>
  );
}
