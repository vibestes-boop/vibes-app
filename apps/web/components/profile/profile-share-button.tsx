'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

// -----------------------------------------------------------------------------
// ProfileShareButton — schlanker Single-Button „Teilen" fürs eigene Web-Profil.
// Parität zur Mobile-App (dort eigener Teilen-Button im Header). Nutzt die
// native Web-Share-API, fällt auf Clipboard-Copy zurück (Desktop ohne share).
// -----------------------------------------------------------------------------

export function ProfileShareButton({
  username,
  displayName,
}: {
  username: string;
  displayName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = `${window.location.origin}/u/${username}`;
    const title = `${displayName} (@${username})`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Abgebrochen oder nicht unterstützt → Clipboard-Fallback
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard nicht verfügbar — still scheitern
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onShare} aria-label="Profil teilen">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Link kopiert' : 'Teilen'}
    </Button>
  );
}
