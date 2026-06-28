// -----------------------------------------------------------------------------
// Sendungsverfolgung — baut aus Carrier + Nummer einen Deep-Link zur
// Tracking-Seite des Versanddienstes (DE-Markt). Unbekannter/leerer Carrier →
// null (die UI zeigt dann nur die kopierbare Nummer).
// -----------------------------------------------------------------------------

export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined): string | null {
  if (!number) return null;
  const n = encodeURIComponent(number.trim());
  const c = (carrier ?? '').toLowerCase();

  if (c.includes('dhl') && c.includes('express')) {
    return `https://www.dhl.com/de-de/home/tracking/tracking-express.html?submit=1&tracking-id=${n}`;
  }
  if (c.includes('dhl')) {
    return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${n}`;
  }
  if (c.includes('hermes')) {
    return `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsinformation/#${n}`;
  }
  if (c.includes('dpd')) {
    return `https://www.dpd.com/de/de/empfangen/sendungsverfolgung-und-live-tracking/?parcelNumber=${n}`;
  }
  if (c.includes('gls')) {
    return `https://gls-group.com/DE/de/paketverfolgung?match=${n}`;
  }
  if (c.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${n}`;
  }
  if (c.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
  }
  if (c.includes('post') || c.includes('dpag') || c.includes('einschreiben')) {
    return `https://www.deutschepost.de/sendung/simpleQuery.html?form.sendungsnummer=${n}`;
  }
  return null;
}
