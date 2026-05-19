'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { createClient } from '@/lib/supabase/client';

function getSafeNext(value: string | null, fallback: string) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

function getHashParams() {
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash);
}

export function HashSessionRescue() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function rescueHashSession() {
      const hashParams = getHashParams();
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (!accessToken || !refreshToken) return;

      const authType = hashParams.get('type');
      const url = new URL(window.location.href);
      const fallback = authType === 'invite' ? '/onboarding' : '/';
      const next = authType === 'recovery'
        ? '/auth/reset-password'
        : getSafeNext(url.searchParams.get('next'), fallback);

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!cancelled && !error) {
        router.replace(next);
      }
    }

    void rescueHashSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
