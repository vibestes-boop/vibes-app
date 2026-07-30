import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';

export const metadata: Metadata = {
  title: 'Konto löschen — Serlo',
  description:
    'So löschst du dein Serlo-Konto und alle zugehörigen Daten — direkt in der App oder per E-Mail, auch wenn du die App bereits deinstalliert hast.',
  robots: { index: true, follow: true },
};

// /konto-loeschen — öffentlich erreichbare Löschanfrage.
// Google Play verlangt für Apps mit Konten NEBEN der In-App-Löschung eine
// Webseite, die auch Menschen erreichen, die die App schon deinstalliert haben.
// Apple verlangt die In-App-Variante (existiert: Einstellungen → Konto löschen).
// Der Link wird in der Play Console unter „Datenlöschung" hinterlegt.

const EFFECTIVE_DATE = '30. Juli 2026';
const CONTACT = 'brandwerkx@gmail.com';

export default function DeleteAccountPage() {
  return (
    <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl px-4 py-12 prose-headings:scroll-mt-20">
      <header className="not-prose mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Dein Konto
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Konto löschen</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stand: <time dateTime="2026-07-30">{EFFECTIVE_DATE}</time>
        </p>
      </header>

      <p>
        Du entscheidest über deine Daten. Dein Serlo-Konto kannst du jederzeit
        selbst löschen — es braucht keinen Grund und keine Rückfrage.
      </p>

      <section>
        <h2>Der schnellste Weg: in der App</h2>
        <p>
          Wenn Serlo noch auf deinem Gerät installiert ist, geht es in wenigen
          Sekunden:
        </p>
        <ol>
          <li>Öffne Serlo und gehe auf dein Profil.</li>
          <li>
            Tippe oben rechts auf <strong>Einstellungen</strong>.
          </li>
          <li>
            Scrolle nach unten zu <strong>Konto löschen</strong> und bestätige.
          </li>
        </ol>
        <p>
          Dasselbe findest du im Browser unter{' '}
          <Link href={'/settings' as Route}>Einstellungen</Link>, wenn du
          angemeldet bist.
        </p>
      </section>

      <section>
        <h2>App schon deinstalliert? Schreib uns</h2>
        <p>
          Auch ohne App löschen wir dein Konto. Schick eine E-Mail an{' '}
          <a href={`mailto:${CONTACT}?subject=Konto%20l%C3%B6schen`}>{CONTACT}</a>{' '}
          mit dem Betreff <em>Konto löschen</em> und nenne die E-Mail-Adresse
          oder den Nutzernamen deines Kontos.
        </p>
        <p>
          Wir melden uns innerhalb von 7 Tagen und löschen spätestens 30 Tage
          nach deiner Anfrage. Zur Sicherheit fragen wir vorher nach, ob die
          Anfrage wirklich von dir kommt — sonst könnte jemand anderes dein
          Konto löschen lassen.
        </p>
      </section>

      <section>
        <h2>Was gelöscht wird</h2>
        <p>Mit dem Konto verschwinden sofort und endgültig:</p>
        <ul>
          <li>dein Profil samt Name, Profilbild, Beschreibung und Teip</li>
          <li>alle Beiträge, Videos, Bilder, Stories und Highlights</li>
          <li>deine Kommentare, Likes und gespeicherten Inhalte</li>
          <li>deine Direktnachrichten und Konversationen</li>
          <li>deine Clan-Mitgliedschaften, Follower und Gefolgten</li>
          <li>deine Live-Aufzeichnungen und Chat-Beiträge</li>
          <li>dein Coin- und Diamanten-Guthaben (ohne Auszahlung)</li>
          <li>deine Anmeldedaten und Push-Registrierungen</li>
        </ul>
      </section>

      <section>
        <h2>Was wir behalten müssen — und wie lange</h2>
        <p>
          Ein paar Daten dürfen wir nicht sofort löschen, weil das Gesetz es
          verlangt. Sie werden von deinem Konto getrennt und nicht mehr für dich
          verwendet:
        </p>
        <ul>
          <li>
            <strong>Rechnungs- und Bestelldaten</strong> zu tatsächlich
            getätigten Käufen: 10 Jahre (§ 147 AO, § 257 HGB — steuerliche
            Aufbewahrungspflicht).
          </li>
          <li>
            <strong>Nachweise zu Meldungen und Sperren</strong>, falls dein
            Konto an einem Moderationsfall beteiligt war: bis zu 12 Monate, um
            wiederholte Verstöße erkennen und Betroffene schützen zu können.
          </li>
        </ul>
        <p>
          Nachrichten, die du anderen geschickt hast, bleiben in deren Postfach
          sichtbar — so wie eine verschickte SMS. Dein Absendername wird dabei
          anonymisiert.
        </p>
      </section>

      <section>
        <h2>Wichtig zu wissen</h2>
        <p>
          Die Löschung ist <strong>endgültig</strong>. Es gibt keinen
          Papierkorb und keine Wiederherstellung — auch nicht, wenn du dich
          später mit derselben E-Mail-Adresse neu anmeldest.
        </p>
        <p>
          Wenn du ein Guthaben hast oder eine Bestellung noch offen ist,
          kläre das bitte vorher. Mit der Löschung verfällt beides.
        </p>
      </section>

      <section>
        <h2>Nur Daten löschen, aber das Konto behalten?</h2>
        <p>
          Auch das geht. Einzelne Beiträge, Nachrichten und Kommentare kannst du
          jederzeit selbst entfernen. Für alles Weitere — etwa eine Auskunft
          über deine gespeicherten Daten oder deren Berichtigung — schreib uns
          an <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Deine Rechte nach der
          DSGVO stehen in der{' '}
          <Link href={'/privacy' as Route}>Datenschutzerklärung</Link>.
        </p>
      </section>

      <section className="not-prose mt-10 rounded-xl border border-border bg-muted/40 p-5 text-sm">
        <p className="font-medium">Verantwortlich</p>
        <p className="mt-1 text-muted-foreground">
          Zaur Hatuev · Serlo — Kontakt:{' '}
          <a className="underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          <br />
          Vollständige Angaben im{' '}
          <Link className="underline" href={'/imprint' as Route}>
            Impressum
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
