import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung — Serlo',
  description:
    'Informationen zur Verarbeitung personenbezogener Daten auf der Serlo-Plattform gemäß DSGVO.',
  robots: { index: true, follow: true },
};

// -----------------------------------------------------------------------------
// /privacy — Datenschutzerklärung nach DSGVO / BDSG.
//
// Deckt ab: Kontakt, Kategorien personenbezogener Daten, Zwecke, Rechts-
// grundlagen, Empfänger, Speicherdauer, Betroffenenrechte, Dritt-Dienste
// (Supabase, Stripe, Cloudflare R2, LiveKit, Sentry, PostHog).
//
// ⚠️ Disclaimer: Boilerplate-Starter. Vor Launch anwaltlich + DPO prüfen.
// -----------------------------------------------------------------------------

const EFFECTIVE_DATE = '20. April 2026';

export default function PrivacyPage() {
  return (
    <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl px-4 py-12 prose-headings:scroll-mt-20">
      <header className="not-prose mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Rechtliches
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Datenschutzerklärung</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stand: <time dateTime="2026-04-20">{EFFECTIVE_DATE}</time>
        </p>
      </header>

      <section>
        <h2>1. Verantwortlicher</h2>
        <p>
          Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist
          der Betreiber der Serlo-Plattform. Die vollständigen Kontaktdaten
          entnehmen Sie bitte unserem{' '}
          <Link href={'/imprint' as Route}>Impressum</Link>.
        </p>
      </section>

      <section>
        <h2>2. Kategorien personenbezogener Daten</h2>
        <p>Wir verarbeiten insbesondere folgende Datenkategorien:</p>
        <ul>
          <li>
            <strong>Account-Daten:</strong> E-Mail-Adresse, Username, Anzeige-
            name, Passwort-Hash, optionales Profilbild.
          </li>
          <li>
            <strong>Inhalte:</strong> hochgeladene Videos, Bilder, Stories,
            Kommentare, Nachrichten, Reaktionen.
          </li>
          <li>
            <strong>Nutzungsdaten:</strong> aufgerufene Seiten, Watch-Time,
            Interaktionen, Device-Informationen, IP-Adresse (gekürzt).
          </li>
          <li>
            <strong>Zahlungs-Daten:</strong> wir selbst speichern keine
            Kartendaten. Stripe verarbeitet diese als eigenständiger
            Verantwortlicher nach PCI-DSS. Wir erhalten nur eine Stripe-
            Customer-ID und Metadaten zum Kauf (Betrag, Produkt, Zeitstempel).
          </li>
          <li>
            <strong>Live-Streaming-Daten:</strong> für die Dauer eines Streams
            werden Video- und Audiospuren über LiveKit verarbeitet. Replays
            werden optional auf Cloudflare R2 gespeichert.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Zwecke und Rechtsgrundlagen</h2>
        <ul>
          <li>
            <strong>Bereitstellung der Plattform</strong> (Art. 6 Abs. 1 lit. b
            DSGVO) — Erfüllung des Nutzungsvertrags.
          </li>
          <li>
            <strong>Sicherheit und Missbrauchserkennung</strong> (Art. 6 Abs. 1
            lit. f DSGVO) — berechtigtes Interesse an Systemstabilität.
          </li>
          <li>
            <strong>Personalisierung des Feeds</strong> (Art. 6 Abs. 1 lit. b /
            f DSGVO) — Vertragsleistung + berechtigtes Interesse an relevantem
            Content.
          </li>
          <li>
            <strong>Analytics und Produktverbesserung</strong> (Art. 6 Abs. 1
            lit. a DSGVO) — nur nach Einwilligung über den Cookie-Banner.
          </li>
          <li>
            <strong>Zahlungsabwicklung</strong> (Art. 6 Abs. 1 lit. b DSGVO).
          </li>
          <li>
            <strong>Gesetzliche Aufbewahrungspflichten</strong> (Art. 6 Abs. 1
            lit. c DSGVO) — z.B. Rechnungsdaten 10 Jahre nach HGB/AO.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Empfänger und Auftragsverarbeiter</h2>
        <p>
          Wir nutzen folgende Dienstleister als Auftragsverarbeiter nach Art. 28
          DSGVO. Entsprechende Verträge sind abgeschlossen:
        </p>
        <dl>
          <dt>
            <strong>Supabase</strong> (Datenbank, Auth, Storage)
          </dt>
          <dd>Hosting in der EU (Frankfurt). Vertrag nach Art. 28.</dd>

          <dt>
            <strong>LiveKit Cloud</strong> (Video-Streaming)
          </dt>
          <dd>
            Anbieter in den USA. Übermittlung auf Basis von
            Standardvertragsklauseln (SCC) nach Art. 46 DSGVO.
          </dd>

          <dt>
            <strong>Cloudflare R2</strong> (Media-Storage, CDN)
          </dt>
          <dd>
            Hauptsächlich EU-Edges. USA-Transit möglich, SCC abgeschlossen.
          </dd>

          <dt>
            <strong>Stripe Payments Europe Ltd.</strong>
          </dt>
          <dd>
            Zahlungsabwicklung. Eigenverantwortlich nach PCI-DSS. Sitz Dublin,
            IE.
          </dd>

          <dt>
            <strong>Sentry</strong> (Fehler-Monitoring)
          </dt>
          <dd>
            Datenverarbeitung auf EU-Region. Stack-Traces und
            Device-Informationen — keine Inhaltsdaten.
          </dd>

          <dt>
            <strong>PostHog</strong> (Produkt-Analytics)
          </dt>
          <dd>
            EU-Region (<code>eu.i.posthog.com</code>). Nur nach Cookie-
            Einwilligung aktiv.
          </dd>

          <dt>
            <strong>Resend</strong> (Transaktions-E-Mails)
          </dt>
          <dd>Versand von Login- und Benachrichtigungs-Mails.</dd>
        </dl>
      </section>

      <section>
        <h2>5. Speicherdauer</h2>
        <ul>
          <li>
            <strong>Account-Daten:</strong> für die Dauer des bestehenden
            Nutzungsverhältnisses, bei Löschung sofortige Anonymisierung.
          </li>
          <li>
            <strong>Stories:</strong> automatisches Ablaufdatum nach 24
            Stunden. Danach werden Rohinhalte innerhalb von 7 Tagen endgültig
            aus dem Storage entfernt.
          </li>
          <li>
            <strong>Server-Logs:</strong> 30 Tage, dann automatisiert gelöscht.
          </li>
          <li>
            <strong>Zahlungs-Belege:</strong> 10 Jahre, gesetzliche
            Aufbewahrungsfrist.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Ihre Rechte</h2>
        <p>
          Sie haben jederzeit die folgenden Rechte gegenüber uns als
          Verantwortlichem:
        </p>
        <ul>
          <li>Auskunft nach Art. 15 DSGVO</li>
          <li>Berichtigung nach Art. 16 DSGVO</li>
          <li>Löschung nach Art. 17 DSGVO</li>
          <li>Einschränkung nach Art. 18 DSGVO</li>
          <li>Datenübertragbarkeit nach Art. 20 DSGVO</li>
          <li>Widerspruch nach Art. 21 DSGVO</li>
          <li>
            Widerruf einer Einwilligung nach Art. 7 Abs. 3 DSGVO — jederzeit
            mit Wirkung für die Zukunft.
          </li>
          <li>
            Beschwerde bei einer Aufsichtsbehörde, z.B. dem Bayerischen
            Landesamt für Datenschutzaufsicht.
          </li>
        </ul>
        <p>
          Datenexport und Kontolöschung können Sie direkt über{' '}
          <Link href={'/settings' as Route}>die Einstellungen → Konto &
          Datenschutz</Link> anstoßen.
        </p>
      </section>

      <section>
        <h2>7. Cookies und Tracking</h2>
        <p>
          Wir verwenden technisch notwendige Cookies zur Aufrechterhaltung der
          Session und zur CSRF-Prävention. Optionale Cookies für Analytics oder
          Marketing werden nur nach Ihrer aktiven Einwilligung im Cookie-Banner
          gesetzt. Ihre Wahl können Sie jederzeit über den &bdquo;Cookie-
          Einstellungen&quot;-Link im Footer ändern.
        </p>
      </section>

      <section>
        <h2>8. Minderjährigenschutz</h2>
        <p>
          Unsere Plattform richtet sich an Personen ab 13 Jahren. Nutzer unter
          16 Jahren benötigen nach Art. 8 DSGVO die Einwilligung der
          Erziehungsberechtigten zur Verarbeitung ihrer Daten. Wir bemühen uns
          um Altersverifizierung durch Selbstauskunft und verhaltensbasierte
          Heuristiken und reagieren auf Hinweise umgehend.
        </p>
      </section>

      <section>
        <h2>9. Änderungen dieser Erklärung</h2>
        <p>
          Wir passen diese Datenschutzerklärung an, wenn sich unsere
          Verarbeitungen ändern oder die Rechtslage dies erfordert. Die jeweils
          aktuelle Version finden Sie unter dieser Adresse. Wesentliche
          Änderungen werden Ihnen gesondert mitgeteilt.
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
            <Link href={'/imprint' as Route} className="text-primary hover:underline">
              Impressum →
            </Link>
          </li>
        </ul>
      </section>
    </article>
  );
}
