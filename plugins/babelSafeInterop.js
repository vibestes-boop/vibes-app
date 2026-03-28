/**
 * babelSafeInterop.js — Babel Plugin (Final Version)
 *
 * Fügt am Anfang JEDES App-Moduls (nicht node_modules) ein globales
 * Object.defineProperty-Guard ein, das verhindert dass _interopNamespace
 * einen TypeError wirft wenn 'default' ein non-configurable getter ist.
 *
 * Technisch: Wir überschreiben Object.defineProperty kurz vor dem Aufruf
 * von _interopNamespace um 'default'-Setzer-Fehler zu schlucken.
 *
 * Einfachere Lösung: Wir fügen eine einmalige globale Polyfill-Funktion ein
 * die Object.prototype.__defineSetter__ NICHT patcht (zu invasiv), sondern
 * stattdessen den ErrorHandler patcht der bei TypeError aufgerufen wird.
 *
 * ACHTESTE EINFACHSTE LÖSUNG: Metro customSerializer in metro.config.js nutzen
 * der den Bundle-String direkt patcht. Dieser Plugin ist ein No-Op Placeholder.
 */
'use strict';

module.exports = function babelSafeInterop() {
  // No-op: Die eigentliche Lösung ist der Metro customSerializer Patch.
  // Diese Datei wird von babel.config.js referenziert aber ist inaktiv.
  return {
    name: 'safe-interop-noop',
    visitor: {},
  };
};
