import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Download, FileText, Clock, ShieldCheck, AlertTriangle, UserCog } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';

import { DataExportButton } from '@/components/settings/data-export-button';
import { DeleteAccountCard } from '@/components/settings/delete-account-card';
import { PrivateAccountToggle } from '@/components/settings/private-account-toggle';

// -----------------------------------------------------------------------------
// /settings/privacy — Konto-Sichtbarkeit + DSGVO-Panel.
//
// Sektionen:
//   0. Konto-Sichtbarkeit (privat/öffentlich) — v1.w.UI.149
//   1. Cookie-Einstellungen → öffnet den Consent-Banner erneut
//   2. Daten-Export (JSON-Download)
//   3. Konto-Löschung (Danger-Zone mit Tipp-Bestätigung)
// -----------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Privatsphäre — Serlo',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function PrivacyPage() {
  // Lade is_private-Status des eingeloggten Users für den Toggle.
  // Kein hard-error wenn nicht eingeloggt — Settings-Layout sollte redirecten.
  const user = await getUser();
  let isPrivate = false;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('is_private')
      .eq('id', user.id)
      .maybeSingle();
    isPrivate = (data as { is_private?: boolean | null } | null)?.is_private ?? false;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight lg:text-3xl">
          <ShieldCheck className="h-6 w-6" />
          Privatsphäre &amp; Daten
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deine Daten, deine Kontrolle. Export, Löschung und Cookie-Einstellungen.
        </p>
      </header>

      {/* ─── Konto-Sichtbarkeit ──────────────────────────────────────────── */}
      {user && (
        <section className="mb-8 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <UserCog className="h-4 w-4" />
            Konto-Sichtbarkeit
          </h2>
          <PrivateAccountToggle initialIsPrivate={isPrivate} />
          <p className="mt-3 text-xs text-muted-foreground">
            Du kannst diese Einstellung jederzeit ändern. Beim Wechsel von privat auf öffentlich
            werden alle ausstehenden Follower-Anfragen automatisch angenommen.
          </p>
        </section>
      )}

      {/* ─── Rechtliche Hinweise (Links) ─────────────────────────────────── */}
      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4" />
          Rechtstexte
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href={'/privacy' as Route} className="text-primary hover:underline">
              Datenschutzerklärung
            </Link>
            <span className="ml-2 text-muted-foreground">
              — was wir warum speichern, Auftragsverarbeiter, Speicherdauern.
            </span>
          </li>
          <li>
            <Link href={'/terms' as Route} className="text-primary hover:underline">
              AGB
            </Link>
            <span className="ml-2 text-muted-foreground">— Nutzungsbedingungen.</span>
          </li>
          <li>
            <Link href={'/imprint' as Route} className="text-primary hover:underline">
              Impressum
            </Link>
            <span className="ml-2 text-muted-foreground">
              — Anbieterkennzeichnung nach § 5 DDG.
            </span>
          </li>
        </ul>
      </section>

      {/* ─── Daten-Export ────────────────────────────────────────────────── */}
      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
          <Download className="h-4 w-4" />
          Datenkopie herunterladen
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Wir sammeln alle zu deinem Account gespeicherten Daten (Profil, Posts,
          Kommentare, Likes, Follows, Nachrichten, Stories, Pod-Mitgliedschaften,
          Live-Sessions, Coin-Käufe, Shop-Produkte, Bestellungen) und stellen sie
          dir als JSON-Datei zum Download bereit. Gemäß Art. 15 &amp; 20 DSGVO.
        </p>
        <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            Generierung dauert meist &lt;5 Sekunden. Die Datei enthält nur Rohdaten
            aus deinem eigenen Account — keine fremden Nachrichten oder privaten
            Chats anderer User.
          </span>
        </div>
        <div className="mt-4">
          <DataExportButton />
        </div>
      </section>

      {/* ─── Danger-Zone: Account löschen ─────────────────────────────────── */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Konto dauerhaft löschen
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Beim Löschen werden dein Profil, alle Posts, Kommentare, Likes, Follows,
          Nachrichten, Stories und Shop-Daten unwiderruflich entfernt. Coins,
          Diamanten-Guthaben und offene Bestellungen verfallen. Veröffentlichte
          Nachrichten in Gruppen-Chats bleiben ggf. anonymisiert erhalten, wenn
          andere Teilnehmer sie zitiert haben.
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          Empfehlung: Exportiere vorher deine Daten.
        </p>
        <DeleteAccountCard />
      </section>
    </div>
  );
}
