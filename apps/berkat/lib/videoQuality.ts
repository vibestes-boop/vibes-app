// Wie gut Berkat sendet — und warum nicht besser.
//
// ⚠️ **Das ist eine Kostenentscheidung, keine Geschmacksfrage.**
//
// LiveKit rechnet die Bandbreite ab, die vom Server zu den Zuschauern geht
// (abwärts; was der Gastgeber hochlädt, ist frei). Sie wächst mit
// Zuschauern × Minuten × Bitrate — und die Bitrate ist der einzige der drei
// Faktoren, den man steuern kann, ohne sich Publikum wegzuwünschen.
//
// Nachgerechnet am 15.08.2026 (siehe STRATEGIE-VERKAEUFER-UND-GELD.md § 6.2):
// Ein Zuschauer verbraucht bei 1,5 Mbit/s rund 11,25 MB pro Minute. Bei
// 100 Zuschauern und 20 Shows im Monat sind das ~2,7 TB und rund **340 €**.
// Mit den Werten hier liegt dieselbe Reichweite bei etwa der Hälfte.
//
// ── Warum 540p und nicht 720p ───────────────────────────────────────────────
// Niemand kauft ein Parfüm wegen der Auflösung. Auf einem Telefon ist der
// Unterschied zwischen 540p und 720p bei einer Hand, die eine Flasche hält,
// kaum zu sehen — der Unterschied auf der Rechnung dagegen sehr.
//
// ── Wann das hier hochgesetzt wird ──────────────────────────────────────────
// Wenn Berkat genug verdient, um die Rechnung zu tragen. Dann diese eine Datei
// ändern, mehr nicht: `h720` wäre 1280×720 bei ~1,7 Mbit/s. Vorher nicht —
// eine hohe Bitrate ist die einzige Ausgabe, die mit dem ERFOLG wächst statt
// mit dem Umsatz.

/**
 * Obergrenze beim Senden. Der Gastgeber lädt einmal hoch (kostenlos), aber
 * mehr als das hier kann kein Zuschauer bekommen — die Grenze deckelt also
 * die abwärtsgerichtete Bandbreite aller Zuschauer zusammen.
 */
export const VIDEO_QUALITY = {
  width: 960,
  height: 540,
  /**
   * 24 statt 30. Eine Auktion ist kein Sport: Es zählt, dass man die Ware
   * erkennt, nicht dass die Bewegung flüssig ist. Tiefer als 24 fängt es an,
   * ruckelig auszusehen, sobald jemand einen Artikel dreht.
   */
  frameRate: 24,
  /** In Bit pro Sekunde. Etwa die Hälfte von LiveKits 720p-Voreinstellung. */
  maxBitrate: 800_000,
} as const;
