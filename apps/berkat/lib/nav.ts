// Zurück — auch dann, wenn es kein Zurück gibt.
//
// DER FEHLER, DEN DAS BEHEBT (16.08.2026, am Gerät gemeldet)
// Auf dem Meldungs-Bildschirm tat der Zurück-Pfeil nichts, und im Entwicklungs-
// lauf stand die Warnung:
//
//     The action 'GO_BACK' was not handled by any navigator.
//
// `router.back()` setzt voraus, dass ein Eintrag im Verlauf liegt. Das ist in
// dieser App nicht garantiert, und zwar aus einem strukturellen Grund: Ein Tipp
// auf eine Meldung springt teilweise auf REITER-Routen (`/(tabs)/account`,
// `/(tabs)/sell`). Expo Router legt dafür keinen neuen Eintrag an, sondern
// wechselt zum bereits vorhandenen Reiter-Bildschirm — der Stapel darüber
// verschwindet dabei. Wer danach die Meldungen erneut öffnet, steht auf dem
// untersten Eintrag, und `back()` hat kein Ziel.
//
// Dasselbe gilt für jeden Direktlink (`berkat://tip/<id>`, später ein Push, der
// eine Seite kalt öffnet) und für einen App-Neustart auf einer tiefen Route.
//
// Deshalb: nachfragen, und sonst auf einen sinnvollen Ort ZURÜCKSETZEN statt zu
// pushen — ein `push` würde den Verlauf weiter aufblähen, bis „zurück" durch
// zehn Bildschirme führt, die man nie besucht hat.

import { router } from 'expo-router';

/**
 * @param fallback Wohin, wenn es keinen Verlauf gibt. Der jeweils
 *   nächstliegende Ort, nicht pauschal die Startseite — wer aus den
 *   Bestellungen kommt, will in den Verkaufen-Reiter, nicht in den Feed.
 */
export function goBack(fallback: string = '/(tabs)/'): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback as never);
}
