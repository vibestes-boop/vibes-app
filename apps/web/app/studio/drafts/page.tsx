import { redirect } from 'next/navigation';

// -----------------------------------------------------------------------------
// /studio/drafts — Alias auf `/create/drafts` (die Drafts-Liste lebt im
// Create-Flow, weil sie dieselbe Resume-Logik benutzt wie `?draftId=…`).
//
// Wir halten den Studio-Pfad als stable Entry-Point für Creator — so bricht
// kein Dashboard-Link wenn wir später die Routen-Struktur umziehen.
// -----------------------------------------------------------------------------

export const dynamic = 'force-dynamic';

export default function StudioDraftsAliasPage() {
  redirect('/create/drafts');
}
