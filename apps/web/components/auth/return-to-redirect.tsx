'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getSafeReturnPath } from '@/lib/auth/return-path';

type Props = { destination?: '/login' | '/creator/activate' };

function Redirect({ destination = '/login' }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const query = params?.toString();
  const next = getSafeReturnPath(`${pathname ?? '/'}${query ? `?${query}` : ''}`);
  const href = `${destination}?next=${encodeURIComponent(next)}` as Route;

  useEffect(() => { router.replace(href); }, [href, router]);

  return (
    <main className="mx-auto max-w-lg px-6 py-20 text-center">
      <p role="status">Du wirst weitergeleitet…</p>
      <Link href={href} className="mt-4 inline-block underline underline-offset-4">
        {destination === '/login' ? 'Zur Anmeldung' : 'Creator-Konto aktivieren'}
      </Link>
    </main>
  );
}

/** Render only after a server-side guard has denied access to the page. */
export function ReturnToRedirect(props: Props) {
  return <Suspense fallback={<p role="status">Weiterleitung…</p>}><Redirect {...props} /></Suspense>;
}
