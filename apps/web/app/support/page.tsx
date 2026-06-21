import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';

export const metadata: Metadata = {
  title: 'Support & Hilfe — Serlo',
  description:
    'Hilfe und Kontakt für die Serlo-App: Konto, Sicherheit (Melden & Blockieren), Account-Löschung, Serlo Coins und technische Fragen.',
  robots: { index: true, follow: true },
};

// /support — öffentliche Support-/Kontaktseite (App-Store Support-URL).

const SUPPORT_EMAIL = 'hallo@serlo.app';

export default function SupportPage() {
  return (
    <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl px-4 py-12 prose-headings:scroll-mt-20">
      <header className="not-prose mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Hilfe
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Support &amp; Kontakt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Wir helfen dir gern weiter. Schreib uns — wir antworten in der Regel
          innerhalb von 2 Werktagen.
        </p>
      </header>

      <section>
        <h2>Kontakt</h2>
        <p>
          E-Mail:{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        <p className="text-sm text-muted-foreground">
          Bitte nenne uns dein <strong>Gerät</strong> (z.&nbsp;B. iPhone 15),
          deine <strong>App-Version</strong> und eine kurze Beschreibung des
          Problems — dann können wir schneller helfen.
        </p>
      </section>

      <section>
        <h2>Häufige Themen</h2>

        <h3>Konto &amp; Login</h3>
        <p>
          Du meldest dich mit E-Mail und Passwort oder über &bdquo;Mit
          Apple&quot; an. Passwort vergessen? Nutze in der App den Link
          &bdquo;Passwort vergessen&quot; auf dem Login-Bildschirm.
        </p>

        <h3>Account löschen</h3>
        <p>
          Du kannst dein Konto jederzeit selbst löschen:{' '}
          <strong>App &rarr; Einstellungen &rarr; &bdquo;Account
          löschen&quot;</strong>. Dein Profil und alle zugehörigen Daten werden
          dauerhaft entfernt.
        </p>

        <h3>Sicherheit: Melden &amp; Blockieren</h3>
        <p>
          Du kannst Beiträge, Kommentare, Profile und Live-Streams melden
          (über das &bdquo;&hellip;&quot;-Menü bzw. langes Drücken &rarr;{' '}
          <strong>Melden</strong>). Nutzer kannst du direkt über ihr Profil{' '}
          <strong>blockieren</strong>; blockierte Nutzer verwaltest du unter
          Einstellungen &rarr; &bdquo;Blockierte Nutzer&quot;. Wir gehen
          Meldungen zu anstößigen Inhalten zeitnah nach.
        </p>

        <h3>Serlo Coins &amp; Käufe</h3>
        <p>
          Serlo Coins sind eine virtuelle Währung für Geschenke und
          Shop-Käufe. Käufe werden über den App&nbsp;Store abgewickelt. Wurden
          gekaufte Coins nicht gutgeschrieben, nutze im Coin-Shop &bdquo;Käufe
          wiederherstellen&quot; oder schreib uns mit dem Kaufbeleg.
        </p>

        <h3>Technische Probleme</h3>
        <p>
          Starte die App neu und stelle sicher, dass du die neueste Version
          installiert hast. Besteht das Problem weiterhin, melde dich bei uns
          mit Gerät, iOS-Version und einer kurzen Beschreibung.
        </p>
      </section>

      <hr className="my-10" />

      <section className="not-prose rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <p className="font-semibold">Rechtliches</p>
        <ul className="mt-2 space-y-1">
          <li>
            <Link href={'/privacy' as Route} className="text-primary hover:underline">
              Datenschutzerklärung &rarr;
            </Link>
          </li>
          <li>
            <Link href={'/terms' as Route} className="text-primary hover:underline">
              Nutzungsbedingungen &rarr;
            </Link>
          </li>
          <li>
            <Link href={'/imprint' as Route} className="text-primary hover:underline">
              Impressum &rarr;
            </Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
