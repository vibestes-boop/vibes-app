import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { Gift, ShoppingBag, Video, TrendingUp, Diamond } from 'lucide-react';

import { getProfile } from '@/lib/auth/session';
import { CreatorActivateForm } from '@/components/studio/creator-activate-form';

// -----------------------------------------------------------------------------
// /creator/activate — v1.w.UI.163
//
// Einmaliger Onboarding-Screen für User die noch kein Creator-Konto haben.
// Mobile-Parität zu app/creator/activate.tsx.
//
// Nach erfolgter Aktivierung (profiles.is_creator = true) leitet die Page
// sofort auf /studio weiter — der Guard in studio/layout.tsx lässt sie dann
// durch.
//
// Auth-Gate: kein Redirect auf Login hier — die Page zeigt generischen Text.
// Wer auf "Aktivieren" klickt, wird vom Server-Action nach Login weitergesendet.
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Creator werden — Serlo',
  description: 'Aktiviere dein Creator-Konto und monetarisiere deinen Content.',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

// Gleiche Benefit-Liste wie Mobile (creator/activate.tsx)
const BENEFITS = [
  { icon: Gift,        label: 'Gift-Einnahmen',  desc: '70% aller Gifts gehen direkt an dich' },
  { icon: ShoppingBag, label: 'Mini-Shop',        desc: 'Verkaufe Produkte direkt in deinem Profil' },
  { icon: Video,       label: 'Live-Shopping',    desc: 'Präsentiere Produkte live im Stream' },
  { icon: TrendingUp,  label: 'Creator Studio',   desc: 'Vollständiges Analytics-Dashboard' },
  { icon: Diamond,     label: 'Auszahlung',       desc: 'Ab 2.500 💎 (~50€) auszahlbar' },
] as const;

export default async function CreatorActivatePage() {
  const profile = await getProfile();

  // Bereits Creator → sofort ins Studio
  if (profile && (profile as { is_creator?: boolean }).is_creator) {
    redirect('/studio' as Route);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      {/* Hero */}
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <span className="rounded-full bg-primary/10 p-4 text-4xl" aria-hidden>✦</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Creator werden</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Kostenlos · Sofortzugang · Monetarisierung
        </p>
      </div>

      {/* Benefits */}
      <div className="mb-8 space-y-3">
        {BENEFITS.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-4 rounded-xl border border-border bg-card/60 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA form — client component handles the server action + redirect */}
      <CreatorActivateForm />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Mit der Aktivierung stimmst du den{' '}
        <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
          Creator-Nutzungsbedingungen
        </a>{' '}
        zu.
      </p>
    </div>
  );
}
