// Fehlerüberwachung.
//
// Berkat hatte bis zum 15.08.2026 **keine**. Serlo meldet seit Monaten an
// Sentry, Berkat an niemanden — eine App, die Geld bewegt, meldete keinen
// einzigen Absturz. Wenn bei einem Verkäufer die Kasse hängt, erfährt man es
// nur, wenn er anruft. Genau das ist in Phase 0 nicht bezahlbar: Fünf Händler,
// die man mühsam überzeugt hat, ruft man kein zweites Mal an.
//
// ── Zwei Entscheidungen ─────────────────────────────────────────────────────
//
// **Dasselbe Sentry-Projekt wie Serlo, getrennt über `environment` und einen
// Tag.** Ein eigenes Projekt wäre sauberer, braucht aber einen Sentry-Zugang —
// und derselbe fehlende Zugang hat heute schon beim Stripe-Konto einen halben
// Nachmittag gekostet. Die DSN steht in Serlos `eas.json` und ist damit ohne
// Anmeldung verfügbar. Sobald ein eigenes Projekt existiert, ist es eine
// Umgebungsvariable.
//
// **Geladen wird bedingt.** `@sentry/react-native` ist ein NATIVES Modul und
// steckt erst ab dem nächsten Build in der App. Ein statischer Import würde auf
// jedem älteren Build schon beim Laden dieser Datei werfen — dieselbe Falle wie
// bei LiveKit und bei `expo-web-browser`. Ohne das Modul meldet Berkat einfach
// nichts, statt abzustürzen.

type SentryModule = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, hint?: Record<string, unknown>) => void;
  captureMessage: (message: string, hint?: Record<string, unknown>) => void;
  setTag: (key: string, value: string) => void;
};

let cached: SentryModule | null | undefined;

function load(): SentryModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('@sentry/react-native') as SentryModule;
  } catch {
    cached = null;
  }
  return cached;
}

let initialised = false;

/**
 * Einmal beim Start, VOR jedem Rendern und vor LiveKits `registerGlobals()` —
 * sonst laufen Abstürze aus der Video-Schicht an der Meldung vorbei.
 *
 * ⚠️ **Wird beim IMPORT dieser Datei ausgeführt, nicht per Aufruf.** Das ist
 * kein Stilbruch, sondern die einzige Möglichkeit: `lib/livekit` meldet LiveKit
 * als Nebenwirkung seines eigenen Imports an, und ES-Importe laufen alle, bevor
 * die erste Zeile im Rumpf des Wurzel-Layouts ausgeführt wird. Ein Aufruf dort
 * käme also immer zu spät. Entscheidend ist stattdessen, dass `report` im
 * Wurzel-Layout VOR `livekit` importiert wird — Module werden in der
 * Reihenfolge ihrer Imports ausgewertet.
 */
export function initErrorReporting(): void {
  if (initialised) return;
  initialised = true;
  const sentry = load();
  if (!sentry) return;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
  if (!dsn) return;

  // ⚠️ Auch der AUFRUF muss abgesichert sein, nicht nur das Laden. Das JS-Paket
  // lässt sich einbinden, während das native Gegenstück im Build fehlt — dann
  // wirft erst `init()`, und zwar beim Start, vor jedem Rendern. Ein Absturz
  // ausgerechnet in der Fehlerüberwachung wäre schwer zu belachen.
  try {
    sentry.init({
    dsn,
    // Berkat und Serlo teilen sich das Projekt — ohne eigene Umgebung wären die
    // Meldungen nicht auseinanderzuhalten und Serlos Alarme voller Berkat-Lärm.
    environment: __DEV__ ? 'berkat-development' : 'berkat',
    // Im Entwicklungslauf steht jeder Fehler ohnehin in Metro. Was hier
    // ankommen soll, sind Fehler auf fremden Geräten.
    enabled: !__DEV__,
    tracesSampleRate: 0.15,
      debug: false,
    });
    sentry.setTag('app', 'berkat');
  } catch {
    cached = null;  // einmal gescheitert, nie wieder versuchen
  }
}

/**
 * Ein Problem melden, das die App **abgefangen** hat.
 *
 * Der eigentliche Wert liegt hier, nicht bei den Abstürzen: Eine Kasse, die
 * sich nicht öffnet, stürzt nicht ab — sie zeigt eine freundliche Meldung, und
 * der Käufer geht. Ohne diese Zeile wäre das unsichtbar.
 *
 * `where` ist bewusst ein kurzer, stabiler Bezeichner („kasse.sammelkorb"),
 * damit sich in Sentry danach gruppieren lässt.
 */
export function reportProblem(
  where: string,
  details: Record<string, string | number | null | undefined>,
): void {
  const sentry = load();
  if (!sentry) return;
  try {
    sentry.captureMessage(`berkat:${where}`, {
      level: 'error',
      tags: { app: 'berkat', where },
    // Keine Beträge, keine Adressen, keine Nutzer-IDs — nur was zum Finden des
    // Fehlers nötig ist. Was hier landet, verlässt das eigene Haus.
      extra: details,
    });
  } catch { /* Melden darf den Fehlerpfad nicht verschlimmern */ }
}

/** Eine geworfene Ausnahme melden, mit demselben Bezeichner-Schema. */
export function reportError(where: string, error: unknown): void {
  const sentry = load();
  if (!sentry) return;
  try {
    sentry.captureException(error, { tags: { app: 'berkat', where } });
  } catch { /* siehe oben */ }
}

// Läuft beim Import. Siehe die Begründung an `initErrorReporting`.
initErrorReporting();
