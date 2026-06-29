'use client';

import { useEffect } from 'react';
import { claimPendingReferral } from '@/app/actions/referral';

// Im Root-Layout gemountet: holt eine offene Referral-Attribution nach, sobald
// ein User eingeloggt ist (z.B. direkt nach Signup über einen Invite-Link).
// Idempotent + günstig (no-op ohne Cookie) → unkritisch auf jeder Seite.
export function ReferralClaimer() {
  useEffect(() => {
    // Nur wenn ein Referral-Cookie gesetzt ist → keine Server-Action für alle.
    if (!document.cookie.includes('serlo_ref=')) return;
    claimPendingReferral().catch(() => { /* still ignorieren */ });
  }, []);
  return null;
}
