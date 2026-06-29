'use client';

import { useEffect } from 'react';
import { claimReferral } from '@/app/actions/referral';

// Auf dem Invite-Landing (/i/[code]) beim Mount aufrufen: setzt den Referral-
// Cookie (ausgeloggt) bzw. attribuiert sofort (eingeloggt). Fire-and-forget.
export function ClaimOnMount({ code }: { code: string }) {
  useEffect(() => {
    claimReferral(code).catch(() => { /* still ignorieren */ });
  }, [code]);
  return null;
}
