import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';

export const metadata: Metadata = {
  title: 'Allgemeine Geschäftsbedingungen — Serlo',
  description:
    'AGB der Serlo-Plattform. Nutzungsbedingungen für Creator, Viewer und Händler.',
  robots: { index: true, follow: true },
};

// -----------------------------------------------------------------------------
// /terms — Allgemeine Geschäftsbedingungen (AGB).
//
// Statisch, prerender-friendly. Stand-Datum inline, Änderungshistorie als
// kleine Tabelle unten. Kein Client-JS nötig.
//
// ⚠️ Disclaimer: Dieser Text ist ein Boilerplate-Starting-Point. Vor Public-
// Launch MUSS dieser von einem Anwalt mit Plattform-Erfahrung geprüft werden
// (DE: speziell TMG / TDDDG / Plattform-Regulierung / DSA).
// -----------------------------------------------------------------------------

const EFFECTIVE_DATE = '20. April 2026';

export default function TermsPage() {
  return (
    <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl px-4 py-12 prose-headings:scroll-mt-20">
      <header className="not-prose mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Rechtliches
        </p>
        <h1 className="mt-1 text-3xl font-semibold">
          Allgemeine Geschäftsbedingungen
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stand: <time dateTime="2026-04-20">{EFFECTIVE_DATE}</time>
        </p>
      </header>

      <section>
        <h2>§ 1 Geltungsbereich</h2>
        <p>
          Diese Allgemeinen Geschäftsbedingungen (nachfolgend &bdquo;AGB&quot;) regeln das
          Vertragsverhältnis zwischen der Serlo-Plattform (nachfolgend
          &bdquo;Serlo&quot; oder &bdquo;Anbieter&quot;) und den Nutzerinnen und Nutzern
          (nachfolgend &bdquo;Nutzer&quot;) der über <code>serlo.app</code> und zugehörige
          Subdomains bereitgestellten Web- und Mobil-Dienste. Abweichende
          Bedingungen des Nutzers werden nicht anerkannt, es sei denn, der
          Anbieter stimmt ihrer Geltung ausdrücklich schriftlich zu.
        </p>
      </section>

      <section>
        <h2>§ 2 Leistungsbeschreibung</h2>
        <p>
          Serlo stellt eine Social-Media-Plattform bereit, die folgende
          Kern-Funktionalitäten umfasst: Video-Feed mit For-You- und Following-
          Algorithmus, Stories mit 24-Stunden-Sichtbarkeit, Live-Streaming,
          Direktnachrichten, Pods (Community-Gruppen), In-App-Marktplatz (Shop),
          virtuelle Währung (&bdquo;Borz-Coins&quot;) und Geschenksystem.
        </p>
        <p>
          Serlo behält sich vor, einzelne Funktionen zu ändern, zu erweitern
          oder einzustellen, sofern der wesentliche Leistungsumfang erhalten
          bleibt.
        </p>
      </section>

      <section>
        <h2>§ 3 Registrierung und Nutzerkonto</h2>
        <ol>
          <li>
            Die Nutzung der Plattform ist überwiegend kostenlos und setzt die
            Registrierung eines Nutzerkontos voraus. Nutzer müssen mindestens
            13 Jahre alt sein. Für Nutzer unter 18 Jahren ist das
            Einverständnis eines Erziehungsberechtigten erforderlich.
          </li>
          <li>
            Die bei der Registrierung angegebenen Daten müssen wahrheitsgemäß
            und vollständig sein. Mehrfachregistrierungen desselben Nutzers
            sind nicht gestattet.
          </li>
          <li>
            Zugangsdaten sind geheim zu halten. Bei Verdacht auf Missbrauch
            ist Serlo unverzüglich zu informieren.
          </li>
        </ol>
      </section>

      <section>
        <h2>§ 4 Pflichten des Nutzers und Inhalte</h2>
        <ol>
          <li>
            Nutzer verpflichten sich, keine rechtswidrigen, beleidigenden,
            diskriminierenden, gewaltverherrlichenden, pornografischen oder
            urheberrechtsverletzenden Inhalte hochzuladen oder zu teilen.
          </li>
          <li>
            An eigenen Inhalten räumt der Nutzer Serlo ein weltweites, nicht-
            exklusives, gebührenfreies, unterlizenzierbares Nutzungsrecht ein,
            ausschließlich zum Zweck des Betriebs, der Darstellung und der
            Bewerbung der Plattform. Dieses Recht endet mit Löschung des
            jeweiligen Inhalts, bleibt jedoch für bereits angefertigte Backup-
            Kopien und berechtigte Weiterleitungen an Dritte (z.B. Shares) in
            zumutbarem Umfang bestehen.
          </li>
          <li>
            Serlo ist berechtigt, Inhalte zu moderieren, zu kennzeichnen oder
            zu entfernen, sofern sie gegen diese AGB, die Community-Richtlinien
            oder geltendes Recht verstoßen.
          </li>
        </ol>
      </section>

      <section>
        <h2>§ 5 Borz-Coins und digitale Geschenke</h2>
        <ol>
          <li>
            Borz-Coins sind eine plattform-interne virtuelle Währung ohne
            gesetzlichen Auszahlungs-Anspruch. Der Erwerb erfolgt über die
            jeweilige App-Store-Abrechnung oder über Stripe auf der Web-
            Version.
          </li>
          <li>
            Gekaufte Coins werden dem Guthaben nach erfolgreicher
            Zahlungsbestätigung gutgeschrieben. Ein Widerrufsrecht besteht
            nach § 356 Abs. 5 BGB nicht, sobald Coins zur sofortigen
            Ausführung einer Leistung genutzt wurden.
          </li>
          <li>
            Geschenke an Creator werden nach Abzug einer Plattform-Gebühr von
            30% dem Creator-Guthaben gutgeschrieben und sind nach den
            Auszahlungsbedingungen des Creator-Programms auszahlbar.
          </li>
        </ol>
      </section>

      <section>
        <h2>§ 6 Shop und Kaufverträge</h2>
        <p>
          Kaufverträge im Shop-Bereich werden ausschließlich zwischen Käufer
          und dem jeweiligen Händler (&bdquo;Seller&quot;) geschlossen. Serlo tritt
          lediglich als technischer Vermittler auf und ist nicht Vertragspartei.
          Ausnahmen bilden First-Party-Angebote von Serlo selbst, die als
          solche gekennzeichnet sind.
        </p>
      </section>

      <section>
        <h2>§ 7 Haftung</h2>
        <p>
          Serlo haftet uneingeschränkt für Vorsatz und grobe Fahrlässigkeit
          sowie für Schäden an Leben, Körper und Gesundheit. Im Übrigen ist
          die Haftung auf den bei Vertragsschluss vorhersehbaren, vertrags-
          typischen Schaden begrenzt. Für nutzergenerierte Inhalte haftet
          Serlo nach Maßgabe der §§ 7 ff. TMG bzw. des Digital Services Act
          (DSA).
        </p>
      </section>

      <section>
        <h2>§ 8 Kündigung und Sperrung</h2>
        <p>
          Nutzer können ihr Konto jederzeit über <Link
            href={'/settings' as Route}
          >die Einstellungen</Link> löschen. Serlo behält sich vor, Konten
          bei schwerwiegenden Verstößen gegen diese AGB mit sofortiger Wirkung
          zu sperren oder zu löschen.
        </p>
      </section>

      <section>
        <h2>§ 9 Änderungen dieser AGB</h2>
        <p>
          Änderungen dieser AGB werden den Nutzern mindestens 30 Tage vor
          Inkrafttreten per E-Mail oder über eine In-App-Benachrichtigung
          mitgeteilt. Widerspricht der Nutzer innerhalb dieser Frist nicht,
          gilt die Änderung als akzeptiert.
        </p>
      </section>

      <section>
        <h2>§ 10 Schlussbestimmungen</h2>
        <ol>
          <li>
            Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Für
            Verbraucher bleibt der Schutz zwingender Vorschriften des
            Aufenthaltsstaats unberührt.
          </li>
          <li>
            Die EU-Kommission stellt eine Plattform zur Online-Streitbeilegung
            bereit: <a href="https://ec.europa.eu/consumers/odr" rel="noopener noreferrer">
              ec.europa.eu/consumers/odr
            </a>. Serlo ist nicht verpflichtet und nicht bereit, an
            Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
            teilzunehmen.
          </li>
          <li>
            Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt
            die Wirksamkeit der übrigen Bestimmungen unberührt.
          </li>
        </ol>
      </section>

      <hr className="my-10" />

      <section className="not-prose rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <p className="font-semibold">Weiterführend</p>
        <ul className="mt-2 space-y-1">
          <li>
            <Link href={'/privacy' as Route} className="text-primary hover:underline">
              Datenschutzerklärung →
            </Link>
          </li>
          <li>
            <Link href={'/imprint' as Route} className="text-primary hover:underline">
              Impressum →
            </Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
