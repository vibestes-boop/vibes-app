import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';

export const metadata: Metadata = {
  title: 'Widerrufsbelehrung — Serlo',
  description:
    'Widerrufsbelehrung für Verbraucher beim Kauf physischer Waren im Serlo-Shop, inklusive Muster-Widerrufsformular.',
  robots: { index: true, follow: true },
};

// /widerruf — Widerrufsbelehrung für Fernabsatz-Käufe physischer Waren
// (gesetzliches Muster, Anlage 1 + 2 zu Art. 246a EGBGB).

const EFFECTIVE_DATE = '8. Juli 2026';

export default function WithdrawalPage() {
  return (
    <article className="prose prose-slate dark:prose-invert mx-auto max-w-3xl px-4 py-12 prose-headings:scroll-mt-20">
      <header className="not-prose mb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Rechtliches
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Widerrufsbelehrung</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stand: <time dateTime="2026-07-08">{EFFECTIVE_DATE}</time>
        </p>
      </header>

      <section>
        <h2>Geltungsbereich</h2>
        <p>
          Diese Widerrufsbelehrung gilt für Verbraucher im Sinne des § 13 BGB
          beim Kauf physischer Waren über den Serlo-Shop, sofern Zaur Hatuev,
          handelnd unter Serlo, dein Vertragspartner ist (als solche
          gekennzeichnete Erstanbieter-Angebote). Schließt du künftig einen
          Kaufvertrag mit einem anderen auf Serlo tätigen Verkäufer, informiert
          dich dieser Verkäufer über dein Widerrufsrecht.
        </p>
        <p>
          Für digitale Inhalte wie Serlo Coins gilt: Das Widerrufsrecht
          erlischt nach § 356 Abs. 5 BGB, sobald mit der Ausführung begonnen
          wurde und du dem ausdrücklich zugestimmt hast (siehe{' '}
          <Link href={'/terms' as Route}>AGB § 5</Link>).
        </p>
      </section>

      <section>
        <h2>Widerrufsrecht</h2>
        <p>
          Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen
          diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn
          Tage ab dem Tag, an dem du oder ein von dir benannter Dritter, der
          nicht der Beförderer ist, die Waren in Besitz genommen hast bzw.
          hat. Hast du mehrere Waren im Rahmen einer einheitlichen Bestellung
          bestellt, die getrennt geliefert werden, beginnt die Frist mit der
          Inbesitznahme der letzten Ware.
        </p>
        <p>
          Um dein Widerrufsrecht auszuüben, musst du uns
        </p>
        <p>
          Zaur Hatuev, handelnd unter Serlo<br />
          Steiner Ring 64<br />
          82538 Geretsried, Deutschland<br />
          E-Mail:{' '}
          <a href="mailto:brandwerkx@gmail.com">brandwerkx@gmail.com</a>
        </p>
        <p>
          mittels einer eindeutigen Erklärung (z.&nbsp;B. ein mit der Post
          versandter Brief oder eine E-Mail) über deinen Entschluss, diesen
          Vertrag zu widerrufen, informieren. Du kannst dafür das beigefügte
          Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben
          ist.
        </p>
        <p>
          Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung
          über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist
          absendest.
        </p>
      </section>

      <section>
        <h2>Folgen des Widerrufs</h2>
        <p>
          Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die
          wir von dir erhalten haben, einschließlich der Lieferkosten (mit
          Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass du
          eine andere Art der Lieferung als die von uns angebotene, günstigste
          Standardlieferung gewählt hast), unverzüglich und spätestens binnen
          vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über
          deinen Widerruf dieses Vertrags bei uns eingegangen ist. Für diese
          Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der
          ursprünglichen Transaktion eingesetzt hast, es sei denn, mit dir
          wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden
          dir wegen dieser Rückzahlung Entgelte berechnet.
        </p>
        <p>
          Wir können die Rückzahlung verweigern, bis wir die Waren wieder
          zurückerhalten haben oder bis du den Nachweis erbracht hast, dass du
          die Waren zurückgesandt hast, je nachdem, welches der frühere
          Zeitpunkt ist.
        </p>
        <p>
          Du hast die Waren unverzüglich und in jedem Fall spätestens binnen
          vierzehn Tagen ab dem Tag, an dem du uns über den Widerruf dieses
          Vertrags unterrichtest, an die oben genannte Adresse zurückzusenden
          oder zu übergeben. Die Frist ist gewahrt, wenn du die Waren vor
          Ablauf der Frist von vierzehn Tagen absendest. Du trägst die
          unmittelbaren Kosten der Rücksendung der Waren.
        </p>
        <p>
          Du musst für einen etwaigen Wertverlust der Waren nur aufkommen,
          wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit,
          Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang
          mit ihnen zurückzuführen ist.
        </p>
      </section>

      <section>
        <h2>Ausschluss und Erlöschen des Widerrufsrechts</h2>
        <p>Das Widerrufsrecht besteht nicht bzw. erlischt bei Verträgen</p>
        <ol>
          <li>
            zur Lieferung versiegelter Waren, die aus Gründen des
            Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet
            sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde
            (§ 312g Abs. 2 Nr. 3 BGB) — das betrifft insbesondere{' '}
            <strong>geöffnete oder entsiegelte Parfüms und Kosmetik</strong>;
          </li>
          <li>
            zur Lieferung von Waren, die nicht vorgefertigt sind und für deren
            Herstellung eine individuelle Auswahl oder Bestimmung durch den
            Verbraucher maßgeblich ist (§ 312g Abs. 2 Nr. 1 BGB);
          </li>
          <li>
            zur Lieferung von Waren, die schnell verderben können oder deren
            Verfallsdatum schnell überschritten würde (§ 312g Abs. 2 Nr. 2
            BGB);
          </li>
          <li>
            zur Lieferung nicht auf einem körperlichen Datenträger
            befindlicher digitaler Inhalte, wenn mit der Ausführung begonnen
            wurde, nachdem du ausdrücklich zugestimmt und deine Kenntnis vom
            Erlöschen des Widerrufsrechts bestätigt hast (§ 356 Abs. 5 BGB).
          </li>
        </ol>
      </section>

      <section>
        <h2>Muster-Widerrufsformular</h2>
        <p>
          Wenn du den Vertrag widerrufen willst, kannst du dieses Formular
          ausfüllen und an uns zurücksenden:
        </p>
        <div className="not-prose rounded-xl border border-border bg-muted/40 p-5 text-sm leading-relaxed">
          <p>
            An:<br />
            Zaur Hatuev, handelnd unter Serlo<br />
            Steiner Ring 64, 82538 Geretsried, Deutschland<br />
            E-Mail: brandwerkx@gmail.com
          </p>
          <p className="mt-4">
            Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*)
            abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) /
            die Erbringung der folgenden Dienstleistung (*):
          </p>
          <p className="mt-4">
            — Bestellt am (*) / erhalten am (*):<br />
            — Name des/der Verbraucher(s):<br />
            — Anschrift des/der Verbraucher(s):<br />
            — Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf
            Papier):<br />
            — Datum:
          </p>
          <p className="mt-4 text-muted-foreground">(*) Unzutreffendes streichen.</p>
        </div>
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
