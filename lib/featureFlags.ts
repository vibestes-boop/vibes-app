/**
 * lib/featureFlags.ts — App-weite Feature-Schalter
 *
 * Reine JS-Konstanten: Umschalten = 1-Zeilen-Änderung + OTA-Update
 * (EAS_BUILD=1 npx eas update …), KEIN neuer Native-Build nötig.
 *
 * COIN_SHOP_ENABLED — Coin-Kauf in der App (RevenueCat IAP).
 *   false seit 2026-07-03 (App-Store-v1-Vorbereitung): Die IAP-Produkte sind
 *   in App Store Connect noch nicht eingereicht („Could not check"). Ein
 *   erreichbarer Coin-Shop mit fehlschlagenden Käufen = sichere Apple-
 *   Ablehnung (Guideline 2.1, App-Vollständigkeit). Also: alle Kauf-Einstiege
 *   versteckt, bis der Coin-Launch ansteht (RevenueCat-Checkliste: ASC-
 *   Verbindung, Produkte „Ready to Submit", RC-Webhook + Auth-Header,
 *   ENABLE_RECEIPT_VERIFY).
 *
 *   Was das Flag bewusst NICHT versteckt: Coin-/Diamant-Salden und das
 *   Gift-System selbst — Guthaben ansehen und ausgeben ist Apple-konform,
 *   nur der KAUF-Weg muss weg. Web-Coin-Kauf (Stripe) ist unberührt.
 */
export const COIN_SHOP_ENABLED = false;
