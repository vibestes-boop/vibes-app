'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { signInWithOAuth } from '@/app/actions/auth';
import { useI18n } from '@/lib/i18n/client';

// Google "G" SVG logo (official brand colors). Inlined so no external asset fetch.
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
      <path d="M17.05 12.536c-.025-2.73 2.23-4.041 2.333-4.106-1.27-1.86-3.248-2.115-3.952-2.144-1.68-.171-3.28 1.002-4.131 1.002-.863 0-2.175-.979-3.574-.953-1.836.027-3.53 1.077-4.478 2.724-1.907 3.328-.486 8.259 1.369 10.96.906 1.323 1.985 2.808 3.4 2.754 1.365-.055 1.881-.886 3.532-.886 1.64 0 2.12.886 3.575.86 1.476-.027 2.411-1.346 3.313-2.68 1.043-1.537 1.473-3.025 1.495-3.101-.033-.014-2.867-1.098-2.882-4.43zM14.49 4.624c.746-.911 1.251-2.168 1.112-3.426-1.075.045-2.381.718-3.154 1.613-.693.796-1.302 2.083-1.14 3.31 1.203.093 2.432-.612 3.182-1.497z" />
    </svg>
  );
}

export function OAuthButtons({ next = '/' }: { next?: string }) {
  const { t } = useI18n();
  const [isGooglePending, startGoogle] = useTransition();
  const [isApplePending, startApple] = useTransition();

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isGooglePending || isApplePending}
        onClick={() => startGoogle(() => signInWithOAuth('google', next))}
      >
        <GoogleLogo />
        <span>{t('auth.continueWithGoogle')}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isGooglePending || isApplePending}
        onClick={() => startApple(() => signInWithOAuth('apple', next))}
      >
        <AppleLogo />
        <span>{t('auth.continueWithApple')}</span>
      </Button>
    </div>
  );
}
