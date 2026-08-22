// Welcher Stand läuft hier gerade?
//
// ⚠️ WARUM ES DIESE ZEILE GIBT
// Am 22.08.2026 blieb ein Fund offen, den niemand entscheiden konnte: Ein Tipp
// auf die Streit-Meldung in der Glocke führte ins Konto statt zu den
// Bestellungen. Im Code ist ein Auseinanderlaufen ausgeschlossen — Symbol,
// Titel und Ziel kommen aus DERSELBEN Kennung (`present()` und
// `notificationTarget()` schalten beide auf `item.type`). Es blieb genau eine
// Erklärung übrig: Auf dem Telefon lief ein älteres Bündel. Belegen ließ sich
// das nicht, weil die App nirgends sagt, welches.
//
// ⚠️ UND DAS IST DER NORMALFALL, NICHT DIE AUSNAHME
// `expo-updates` startet IMMER aus dem Zwischenspeicher: `app.json` setzt kein
// `fallbackToCacheTimeout`, die Voreinstellung ist 0, und die erzeugte
// `Expo.plist` trägt entsprechend `EXUpdatesLaunchWaitMs = 0`. Eine neue
// Fassung wird im Hintergrund geladen und erst beim NÄCHSTEN Start in Betrieb
// genommen. Wer an einem Nachmittag fünfzehn Mal veröffentlicht, prüft am
// Gerät also fast immer den VORLETZTEN Stand — und hält den Rückstand für
// einen Fehler.
//
// Die Regel daraus: Nach `eas update` die App zweimal schließen und öffnen.
// Der erste Start lädt, der zweite führt aus. Diese Zeile sagt, ob es geklappt
// hat.

// Beide sind native Module. Ein statischer Import würde die Datei in Expo Go
// beim Laden töten — dieselbe Bauform wie `lib/livekit.ts` und `lib/usePush.ts`.
let Updates: typeof import('expo-updates') | null = null;
let Constants: typeof import('expo-constants').default | null = null;
try {
  Updates = require('expo-updates');
} catch {
  Updates = null;
}
try {
  Constants = require('expo-constants').default;
} catch {
  Constants = null;
}

/** „22.08. 15:12" — Tag und Uhrzeit reichen, das Jahr sagt nichts. */
function stamp(d: Date): string {
  const day = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}

/**
 * Eine Zeile für den Fuß des Konto-Reiters.
 *
 * `Berkat 1.0.0 (1) · Stand 22.08. 15:12 · 56f80d93`
 *
 * Die acht Zeichen am Ende sind der Anfang der Gruppen-Kennung — genau das,
 * was `npx eas update:list --branch production` in der Spalte „Group ID"
 * ausgibt. Damit ist eine Meldung vom Gerät ohne Rückfrage einer
 * Veröffentlichung zuzuordnen.
 *
 * Drei Sonderfälle, jeder mit eigenem Wort:
 * - **Entwicklung** — Metro. `Updates` liefert hier nichts Verwertbares, und
 *   „Werksstand" wäre schlicht falsch.
 * - **Werksstand** — das im Build eingebackene Bündel, es lief noch kein OTA.
 * - **kein OTA-Stand** — Updates ist an, meldet aber keinen Zeitpunkt. Das ist
 *   kein erwarteter Zustand; die Zeile behauptet dann lieber nichts.
 */
export function buildLabel(): string {
  const version = Constants?.expoConfig?.version ?? '?';
  const build =
    Constants?.expoConfig?.ios?.buildNumber ?? Constants?.expoConfig?.android?.versionCode;
  const head = build ? `Berkat ${version} (${build})` : `Berkat ${version}`;

  if (__DEV__) return `${head} · Entwicklung`;
  if (!Updates) return head;
  if (Updates.isEmbeddedLaunch) return `${head} · Werksstand`;
  if (!Updates.createdAt) return `${head} · kein OTA-Stand`;

  const id = Updates.updateId ? ` · ${Updates.updateId.slice(0, 8)}` : '';
  return `${head} · Stand ${stamp(Updates.createdAt)}${id}`;
}
