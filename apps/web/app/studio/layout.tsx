import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Route } from 'next';
import { getUser, getProfile } from '@/lib/auth/session';
import { StudioSubNav } from '@/components/studio/studio-sub-nav';

// -----------------------------------------------------------------------------
// /studio — Layout für den Creator-Studio-Namespace.
//
// Layout-Strategie:
// - SSR Auth-Gate: Creator-Studio ist nicht public. Ohne Session Redirect zum
//   Login mit `next=/studio` damit man nach Login am richtigen Ort landet.
// - v1.w.UI.163: is_creator-Gate — wer kein Creator ist, sieht /creator/activate.
//   /creator/activate liegt AUSSERHALB des studio/-Verzeichnisses → kein
//   Redirect-Loop möglich.
// - Sticky Sub-Nav (horizontal scrollend auf Mobile, fest auf Desktop). Auf
//   Desktop > lg wird die Nav zu einem linken Rail-Menü — Dashboards nutzen
//   den Platz besser als ein Center-geschwurbeltes 4xl-Layout.
// - Kein SiteHeader-Override (der Site-Header kommt aus dem Root-Layout und
//   bleibt darüber). Die Sub-Nav ist klar als Studio-Navigation erkennbar.
//
// WICHTIG: Die STUDIO_NAV-Definition liegt im Client-Component `StudioSubNav`
// selbst — NICHT hier im Server-Layout. Next.js 15 blockt Lucide-Icon-Props
// (React-Elemente mit $$typeof) beim Server→Client-Prop-Crossing.
// -----------------------------------------------------------------------------

export default async function StudioLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user) redirect('/login?next=/studio' as Route);

  // v1.w.UI.163: Creator-Gate. getProfile() is cached per-request, no extra DB hit.
  const profile = await getProfile();
  const isCreator = profile && (profile as unknown as { is_creator?: boolean }).is_creator;
  if (!isCreator) {
    redirect('/creator/activate' as Route);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-20 pt-4 lg:grid lg:grid-cols-[220px_1fr] lg:gap-6 lg:px-6 lg:pt-6">
      {/* Sub-Nav — horizontal scrollend auf Mobile, fest links auf Desktop */}
      <aside className="mb-4 lg:mb-0">
        <StudioSubNav />
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
