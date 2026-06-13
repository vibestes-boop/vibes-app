'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

function getSafeNext(value: string | null, fallback = '/onboarding') {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

function getHashParams() {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash);
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function acceptInvite() {
      const url = new URL(window.location.href);
      const next = getSafeNext(url.searchParams.get('next'));
      const hashParams = getHashParams();
      const authError = hashParams.get('error_description') ?? hashParams.get('error');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (authError) {
        setError(authError);
        return;
      }

      if (!accessToken || !refreshToken) {
        setError('Dieser Einladungslink ist unvollstaendig oder abgelaufen.');
        return;
      }

      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (cancelled) return;

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      router.replace(next as Route);
    }

    void acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="font-serif text-4xl font-medium tracking-tight">Einladung annehmen</h1>
          <p className="text-sm text-muted-foreground">
            Wir melden dich sicher an und leiten dich danach weiter.
          </p>
        </div>

        {error ? (
          <div className="space-y-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-left text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
            <Link
              href="/login"
              className="inline-flex rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Zum Login
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Einladung wird geprueft...</span>
          </div>
        )}
      </div>
    </main>
  );
}
