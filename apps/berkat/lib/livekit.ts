// LiveKit anmelden — aber so, dass die App ohne es nicht stirbt.
//
// LiveKit bringt native Module mit und läuft deshalb NICHT in Expo Go. Ohne
// diesen Wächter würde die App dort beim Start abstürzen, statt einfach das
// Show-Cover zu zeigen. Ein Absturz beim Öffnen ist der teuerste Fehler, den
// man haben kann — er sieht aus wie „kaputt", nicht wie „hier fehlt was".

// ── DOMException-Ersatz ──────────────────────────────────────────────────────
// Hermes kennt DOMException nicht. `livekit-client` kommt aus der Browser-Welt
// und wirft damit — schon beim Laden des Moduls, also lange bevor irgendein
// Video läuft. Ergebnis auf dem Gerät: „Property 'DOMException' doesn't exist".
//
// Ein Error-Nachbau reicht: die Bibliothek erzeugt und wirft solche Objekte,
// sie liest weder `code` noch die numerischen Konstanten der echten Web-API.
// Muss VOR dem require unten stehen — danach wäre es zu spät.
if (typeof (globalThis as Record<string, unknown>).DOMException === 'undefined') {
  class DOMExceptionShim extends Error {
    constructor(message?: string, name = 'Error') {
      super(message);
      this.name = name;
    }
  }
  (globalThis as Record<string, unknown>).DOMException = DOMExceptionShim;
}

let available = false;
let failure: string | null = null;

try {
  // require statt import: ein fehlendes natives Modul soll hier auffliegen und
  // abgefangen werden, nicht beim Laden des Moduls weiter oben.
  const livekit = require('@livekit/react-native') as { registerGlobals: () => void };
  livekit.registerGlobals();
  available = true;
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  if (__DEV__) {
    console.warn(
      '[Berkat] LiveKit ist nicht verfügbar — läuft die App in Expo Go? ' +
        'Video braucht einen eigenen Dev-Build.',
      error,
    );
  }
}

/** true, sobald die nativen LiveKit-Module da sind (also im Dev-Build). */
export const liveKitAvailable = available;

/**
 * Warum es nicht geladen hat. Wird dem Gastgeber im Raum angezeigt — eine
 * stumme Fehlfunktion kostet mehr Zeit als eine hässliche Meldung.
 */
export const liveKitFailure = failure;
