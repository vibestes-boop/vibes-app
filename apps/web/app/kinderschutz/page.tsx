import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';

export const metadata: Metadata = {
  title: 'Kinderschutz-Standards — Serlo',
  description:
    'Serlos Standards gegen sexuellen Missbrauch und die Ausbeutung von Kindern (CSAE): Regeln, Meldewege, Bearbeitung und Ansprechpartner.',
  robots: { index: true, follow: true },
};

// /kinderschutz — Child Safety Standards (CSAE).
// Google Play verlangt von Social-Apps eine ÖFFENTLICH veröffentlichte
// Kinderschutz-Richtlinie, deren URL in der Play Console hinterlegt wird,
// plus einen benannten Ansprechpartner. Diese Seite ist dieser Nachweis.

const EFFECTIVE_DATE = '30. Juli 2026';
const CONTACT = 'brandwerkx@gmail.com';

export default function ChildSafetyPage() {
  return (
    <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl px-4 py-12 prose-headings:scroll-mt-20">
      <header className="not-prose mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Sicherheit
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Kinderschutz-Standards</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stand: <time dateTime="2026-07-30">{EFFECTIVE_DATE}</time>
        </p>
      </header>

      <p>
        Serlo ist eine Community-App mit Videos, Live-Streams und Nachrichten.
        Wo Menschen miteinander reden, muss klar sein, was nicht verhandelbar
        ist. Diese Seite beschreibt unsere Standards gegen sexuellen Missbrauch
        und die Ausbeutung von Kindern (englisch <em>CSAE</em>: child sexual
        abuse and exploitation) und wie wir sie durchsetzen.
      </p>

      <section>
        <h2>Null Toleranz</h2>
        <p>
          Auf Serlo sind verboten und führen ohne Vorwarnung zur dauerhaften
          Sperre:
        </p>
        <ul>
          <li>
            jede Darstellung von sexuellem Missbrauch Minderjähriger, in Bild,
            Video, Ton, Text, Zeichnung oder computergeneriert
          </li>
          <li>
            die Anbahnung sexueller Kontakte zu Minderjährigen („Grooming“),
            auch in Privatnachrichten
          </li>
          <li>
            Sexualisierung Minderjähriger jeder Art — auch ohne Nacktheit,
            etwa durch Kommentare, Posen, Hashtags oder Zusammenstellungen
          </li>
          <li>
            das Anbieten, Erbitten, Tauschen oder Verlinken solcher Inhalte
          </li>
          <li>
            Erpressung mit intimen Aufnahmen („Sextortion“) und die Weitergabe
            intimer Aufnahmen ohne Einwilligung
          </li>
          <li>
            Menschenhandel und jede Form der Ausbeutung Minderjähriger
          </li>
        </ul>
        <p>
          Das gilt für Beiträge, Kommentare, Live-Streams, Direktnachrichten,
          Profilangaben, Nutzernamen und hochgeladene Dateien gleichermaßen.
        </p>
      </section>

      <section>
        <h2>Mindestalter</h2>
        <p>
          Serlo ist ab 17 Jahren freigegeben. Wer jünger ist, darf kein Konto
          anlegen. Erfahren wir, dass ein Konto einem Kind gehört, sperren wir
          es und löschen die zugehörigen Daten.
        </p>
      </section>

      <section>
        <h2>Wie du etwas meldest</h2>
        <p>
          Jeder Inhalt und jedes Profil lässt sich direkt in der App melden — du
          brauchst dafür keinen Kontakt zu uns:
        </p>
        <ul>
          <li>
            <strong>Beitrag oder Kommentar:</strong> Drei-Punkte-Menü →{' '}
            <em>Melden</em>
          </li>
          <li>
            <strong>Profil:</strong> Profil öffnen → Drei-Punkte-Menü →{' '}
            <em>Melden</em> oder <em>Blockieren</em>
          </li>
          <li>
            <strong>Live-Stream:</strong> Melde-Symbol im Stream
          </li>
          <li>
            <strong>Direktnachricht:</strong> Konversation → <em>Melden</em>
          </li>
        </ul>
        <p>
          Dringende Fälle erreichen uns außerdem jederzeit unter{' '}
          <a
            href={`mailto:${CONTACT}?subject=Kinderschutz%20%E2%80%94%20dringend`}
          >
            {CONTACT}
          </a>
          . Schreib „Kinderschutz“ in den Betreff — solche E-Mails werden
          vorgezogen.
        </p>
      </section>

      <section>
        <h2>Was nach einer Meldung passiert</h2>
        <ol>
          <li>
            <strong>Sofortmaßnahme:</strong> Gemeldete Inhalte dieser Kategorie
            werden umgehend verborgen, solange die Prüfung läuft.
          </li>
          <li>
            <strong>Prüfung innerhalb von 24 Stunden</strong> durch unser
            Moderationsteam.
          </li>
          <li>
            <strong>Durchsetzung:</strong> Bestätigt sich der Verdacht, löschen
            wir den Inhalt, sperren das Konto dauerhaft und sichern die
            Beweismittel.
          </li>
          <li>
            <strong>Meldung an die Behörden:</strong> Wir melden Fälle den
            zuständigen Stellen — in Deutschland dem Bundeskriminalamt, in der
            Schweiz fedpol — und arbeiten mit Strafverfolgungsbehörden zusammen.
          </li>
          <li>
            <strong>Rückmeldung:</strong> Wer gemeldet hat, erfährt, dass der
            Fall bearbeitet wurde.
          </li>
        </ol>
      </section>

      <section>
        <h2>Was wir vorbeugend tun</h2>
        <ul>
          <li>
            Alle Inhalte durchlaufen eine automatische Prüfung vor der
            Veröffentlichung; auffälliges Material wird zur manuellen Sichtung
            zurückgehalten.
          </li>
          <li>
            Der Live-Chat filtert Sprache in Deutsch, Russisch, Englisch und
            Tschetschenisch; Hosts und Moderatoren können sofort stummschalten
            und ausschließen.
          </li>
          <li>
            Blockieren wirkt beidseitig und trennt Follower, Nachrichten und
            Sichtbarkeit vollständig.
          </li>
          <li>
            Konten mit bestätigten Verstößen werden dauerhaft gesperrt; wir
            erkennen und blockieren Neuanmeldungen derselben Person.
          </li>
        </ul>
      </section>

      <section>
        <h2>Rechtlicher Rahmen</h2>
        <p>
          Wir halten die anwendbaren Gesetze zum Schutz von Kindern ein,
          insbesondere §§ 184b, 184c StGB (Deutschland), Art. 197 StGB
          (Schweiz), die EU-Verordnung 2021/1232 sowie den Digital Services Act.
          Diese Standards gelten weltweit für alle Serlo-Nutzerinnen und
          -Nutzer.
        </p>
      </section>

      <section className="not-prose mt-10 rounded-xl border border-border bg-muted/40 p-5 text-sm">
        <p className="font-medium">Ansprechpartner für Kinderschutz (CSAE)</p>
        <p className="mt-1 text-muted-foreground">
          Zaur Hatuev · Serlo —{' '}
          <a className="underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          <br />
          Vollständige Angaben im{' '}
          <Link className="underline" href={'/imprint' as Route}>
            Impressum
          </Link>
          . Siehe auch unsere{' '}
          <Link className="underline" href={'/terms' as Route}>
            Nutzungsbedingungen
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
