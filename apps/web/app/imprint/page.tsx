import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';

export const metadata: Metadata = {
  title: 'Impressum — Serlo',
  description:
    'Gesetzlich vorgeschriebene Anbieterkennzeichnung nach § 5 DDG (ehem. § 5 TMG).',
  robots: { index: true, follow: true },
};

// -----------------------------------------------------------------------------
// /imprint — Impressum nach § 5 DDG (Digitale-Dienste-Gesetz, ab 2024 Nach-
// folger des TMG) + § 18 MStV (Rundfunkstaatsvertrag für journalistisch-
// redaktionelle Inhalte).
//
// ⚠️ PLACEHOLDER — Zaur muss vor Launch echte Anschrift / Vertretungsberechtigte /
// USt-ID / Registernummer eintragen. Die Felder sind als TODO-Kommentare
// markiert.
// -----------------------------------------------------------------------------

export default function ImprintPage() {
  return (
    <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl px-4 py-12 prose-headings:scroll-mt-20">
      <header className="not-prose mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Rechtliches
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Impressum</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Angaben gemäß § 5 DDG
        </p>
      </header>

      <section>
        <h2>Anbieter</h2>
        <p>
          {/* TODO: Vollständige Anschrift vor Go-Live eintragen */}
          Serlo<br />
          [Firmierung]<br />
          [Straße Hausnummer]<br />
          [PLZ Ort]<br />
          Deutschland
        </p>
      </section>

      <section>
        <h2>Vertretungsberechtigte</h2>
        <p>
          {/* TODO: Geschäftsführung eintragen */}
          [Vor- und Nachname der Geschäftsführung]
        </p>
      </section>

      <section>
        <h2>Kontakt</h2>
        <dl>
          <dt>E-Mail</dt>
          <dd>
            <a href="mailto:hallo@serlo.app">hallo@serlo.app</a>
          </dd>
          <dt>Support</dt>
          <dd>
            <a href="mailto:support@serlo.app">support@serlo.app</a>
          </dd>
          <dt>Datenschutz</dt>
          <dd>
            <a href="mailto:datenschutz@serlo.app">datenschutz@serlo.app</a>
          </dd>
        </dl>
      </section>

      <section>
        <h2>Registereintrag und Umsatzsteuer</h2>
        <p>
          {/* TODO: Handelsregister + USt-ID eintragen falls GmbH/UG */}
          Handelsregister: [HRB-Nummer], [Amtsgericht]<br />
          Umsatzsteuer-ID nach § 27a UStG: [DE XXXXXXXXX]
        </p>
      </section>

      <section>
        <h2>Redaktionell Verantwortlich nach § 18 Abs. 2 MStV</h2>
        <p>
          {/* TODO: Redaktionell Verantwortliche Person */}
          [Vor- und Nachname]<br />
          [Anschrift — kann mit Anbieter-Anschrift identisch sein]
        </p>
      </section>

      <section>
        <h2>EU-Streitschlichtung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-
          Streitbeilegung (OS) bereit:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr"
            rel="noopener noreferrer"
            target="_blank"
          >
            ec.europa.eu/consumers/odr
          </a>
          . Unsere E-Mail-Adresse finden Sie oben im Impressum.
        </p>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
          vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>

      <section>
        <h2>Haftung für Inhalte</h2>
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte
          auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
          Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht
          verpflichtet, übermittelte oder gespeicherte fremde Informationen
          zu überwachen oder nach Umständen zu forschen, die auf eine
          rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung
          oder Sperrung der Nutzung von Informationen nach den allgemeinen
          Gesetzen bleiben hiervon unberührt.
        </p>
      </section>

      <section>
        <h2>Haftung für Links</h2>
        <p>
          Unser Angebot enthält Links zu externen Websites Dritter, auf deren
          Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
          fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
          verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
          der Seiten verantwortlich.
        </p>
      </section>

      <section>
        <h2>Urheberrecht</h2>
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
          Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
          Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
          Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
          jeweiligen Autors bzw. Erstellers.
        </p>
      </section>

      <hr className="my-10" />

      <section className="not-prose rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <p className="font-semibold">Weiterführend</p>
        <ul className="mt-2 space-y-1">
          <li>
            <Link href={'/terms' as Route} className="text-primary hover:underline">
              Allgemeine Geschäftsbedingungen →
            </Link>
          </li>
          <li>
            <Link href={'/privacy' as Route} className="text-primary hover:underline">
              Datenschutzerklärung →
            </Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
