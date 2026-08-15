// Die Kasse öffnen — als Blatt über der App, nicht in Safari.
//
// Vorher liefen Sammelkorb und Trinkgeld über `Linking.openURL`: Berkat
// verschwand, Safari kam nach vorn, und der Weg zurück war der App-Umschalter.
// Der alte Kommentar in `useCheckout` hielt das offen fest — „Zurück in die App
// kommt man von Hand."
//
// Das ist die teuerste Sekunde, die Berkat hat. Wer hier steht, hat gerade vor
// Publikum eine Auktion gewonnen; ihn in diesem Moment aus der App zu schicken,
// ist der Punkt, an dem Geld liegen bleibt.
//
// `openBrowserAsync` legt Stripes Seite als eigenes Blatt ÜBER die App
// (SFSafariViewController auf iOS, Custom Tab auf Android). Der Nutzer bleibt in
// Berkat, tippt am Ende „Fertig" und steht wieder genau dort, wo er war.
//
// **Bewusst nicht `openAuthSessionAsync`.** Das benutzt
// ASWebAuthenticationSession, und die stellt beim ersten Mal einen System-Dialog
// davor: „‚Berkat' möchte sich bei ‚stripe.com' anmelden." Vor einer Zahlung ist
// das das falsche Wort zur falschen Zeit — es klingt nach Datenweitergabe, wo
// gerade Vertrauen gebraucht wird. Der Komfort, dass sich das Blatt bei der
// Rückleitung von selbst schließt, ist diesen Dialog nicht wert.

import { Linking } from 'react-native';
import type { QueryClient } from '@tanstack/react-query';
// Nur der Typ — `import type` verschwindet beim Übersetzen und lädt zur
// Laufzeit nichts. Das Modul selbst kommt unten per `require`.
import type * as WebBrowserModule from 'expo-web-browser';
import { ui } from '../theme/tokens';

/**
 * `expo-web-browser` ist ein NATIVES Modul und steckt erst ab dem nächsten
 * Build in der App. Ein statischer Import würde auf einem älteren Build schon
 * beim Laden dieser Datei werfen — und damit den Konto-Tab und den Live-Raum
 * mitreißen, weil beide sie über die Kasse einbinden.
 *
 * Dieselbe Vorsicht wie bei LiveKit in `lib/livekit.ts`: bedingt laden, Fehler
 * abfangen, ohne das Modul weiterarbeiten. Wer diesen Stand ohne neuen Build
 * aus Metro zieht, bekommt dann einfach wieder Safari statt eines weißen
 * Bildschirms.
 *
 * `undefined` heißt „noch nicht versucht", `null` heißt „gibt es hier nicht".
 */
let cachedBrowser: typeof WebBrowserModule | null | undefined;

function loadWebBrowser(): typeof WebBrowserModule | null {
  if (cachedBrowser !== undefined) return cachedBrowser;
  try {
    cachedBrowser = require('expo-web-browser') as typeof WebBrowserModule;
  } catch {
    if (__DEV__) {
      console.warn('[Berkat] expo-web-browser fehlt im Build — Kasse öffnet in Safari.');
    }
    cachedBrowser = null;
  }
  return cachedBrowser;
}

/**
 * Öffnet die Bezahlseite und kehrt erst zurück, wenn das Blatt wieder zu ist.
 *
 * Der Rückgabewert sagt bewusst NICHT, ob bezahlt wurde — das weiß nur der
 * Stripe-Webhook. „Blatt zu" heißt hier ausschließlich: Der Nutzer ist wieder
 * bei uns.
 */
export async function openPaymentPage(url: string): Promise<void> {
  const browser = loadWebBrowser();
  if (!browser) {
    await Linking.openURL(url);
    return;
  }

  try {
    await browser.openBrowserAsync(url, {
      // „Fertig" statt „Schließen" — das Blatt endet mit einem Ergebnis, nicht
      // mit einem Abbruch.
      dismissButtonStyle: 'done',
      // Die Leiste darf beim Scrollen NICHT einklappen: In ihr sitzt der
      // einzige Weg zurück. Ein langes Stripe-Formular hätte sie sonst
      // weggescrollt, und der Nutzer säße ohne sichtbaren Ausgang in der Kasse.
      enableBarCollapsing: false,
      // Android zeigt damit den Titel und die Adresse — bei einer Zahlung ist
      // das sichtbare „stripe.com" ein Vertrauenssignal, kein Ballast.
      showTitle: true,
      toolbarColor: ui.card,
      controlsColor: ui.brand,
    });
  } catch {
    // Ein zweites Blatt lässt sich nicht öffnen, solange eines steht
    // (`openBrowserAsync` wirft dann). Lieber der alte Weg als gar keine Kasse.
    await Linking.openURL(url);
  }
}

/**
 * Nachladen, nachdem die Kasse zu ist.
 *
 * Bestätigt wird die Zahlung ausschließlich vom Stripe-Webhook — zwischen
 * „Blatt zu" und „Korb bezahlt" liegt also ein Serverweg. Ein einzelnes
 * Nachladen direkt nach dem Schließen träfe fast immer noch den Stand von
 * vorher: Der Käufer hätte bezahlt und sähe sein Paket weiter als offen — der
 * schlimmste Moment für einen falschen Stand.
 *
 * Deshalb dreimal mit wachsendem Abstand. Nur der erste Ruf wird abgewartet,
 * damit der Knopf nicht sekundenlang blockiert bleibt; die beiden späteren
 * laufen nach und korrigieren still.
 */
export async function refetchAfterPayment(queryClient: QueryClient): Promise<void> {
  const invalidate = () => {
    for (const key of [['berkat', 'my-carts'], ['berkat', 'cart'], ['berkat', 'my-orders']]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  invalidate();
  for (const delay of [1_500, 4_000]) {
    setTimeout(invalidate, delay);
  }
}
