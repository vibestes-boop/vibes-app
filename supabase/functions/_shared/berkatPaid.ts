/**
 * supabase/functions/_shared/berkatPaid.ts
 *
 * Die eine Tür, durch die eine Berkat-Zahlung „bezahlt" wird.
 *
 * ── WARUM DIESE DATEI EXISTIERT ─────────────────────────────────────────────
 *
 * Seit Verkäufer ihr eigenes Stripe-Konto verbinden (Übergabe 96/99), entsteht
 * die Zahlung auf IHREM Konto. Stripe meldet das an einen eigenen
 * Connect-Endpunkt — und solange der nicht eingerichtet ist, erfährt Berkat
 * nichts davon. Das Geld liegt beim Verkäufer, die Bestellung steht weiter auf
 * `payment_requested`, und nach 48 Stunden darf der Verkäufer den Käufer als
 * Nichtzahler melden. Für jemanden, der bezahlt hat.
 *
 * Deshalb gibt es seit dem 10.09.2026 zwei weitere Wege, auf denen Berkat es
 * erfahren kann (beide in `berkat-confirm-payment`):
 *
 *   1. Der Käufer kommt aus der Kasse zurück → die App fragt einmal nach.
 *   2. Ein Nachtdienst sieht alle 15 Minuten nach, was liegen geblieben ist.
 *
 * ⚠️ **Alle drei Wege müssen durch dieselbe Tür.** Ein zweiter Ort, der
 * eigenständig „bezahlt" schreiben darf, ist eine zweite Wahrheit über Geld —
 * und zwei Wahrheiten über Geld widersprechen sich irgendwann. Deshalb liegen
 * die Handler hier und nicht mehr im Webhook: Webhook, Rückkehr und
 * Nachtdienst rufen buchstäblich dieselbe Funktion auf.
 *
 * Verschoben wurde der Code unverändert aus `stripe-webhook/index.ts`. Wer
 * etwas an der Bestätigung ändert, ändert es hier — und es gilt sofort für
 * alle drei.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Ist diese Sitzung wirklich bezahlt?
 *
 * Der Riegel aus dem Security-Review vom 02.07.2026 (Fund #2): Bei
 * SEPA-Lastschrift und Klarna feuert `checkout.session.completed` SOFORT mit
 * `payment_status: 'unpaid'` — das Geld ist da noch nicht eingezogen. Wer hier
 * durchwinkt, markiert Ware als bezahlt, bevor bezahlt wurde; scheitert der
 * Einzug später, bleibt die Bestellung fälschlich auf `paid`.
 *
 * ⚠️ Dieselbe Prüfung gilt für den Nachfrage-Weg. Eine abgerufene Sitzung sieht
 * genauso aus wie eine zugestellte — und trüge ohne diesen Riegel dieselbe
 * Lüge. Deshalb steht die Regel hier und nicht im Webhook.
 *
 * Fehlt das Feld ganz, gilt die Sitzung als bezahlt: So verhielt sich der
 * Webhook seit jeher, und Karten/Apple/Google Pay liefern ohnehin immer 'paid'.
 */
export function isSettled(paymentStatus: string | null | undefined): boolean {
  if (!paymentStatus) return true;
  return paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
}

/**
 * Trinkgeld bestätigen (Berkat).
 *
 * Bewusst schmal: Es gibt nichts zu versenden, nichts gutzuschreiben und keine
 * Adresse zu übernehmen. Die Zeile wechselt von 'pending' auf 'paid', mehr
 * nicht.
 *
 * Idempotent über den Zustand: Stripe stellt Ereignisse mehrfach zu, und der
 * UPDATE filtert deshalb auf `status = 'pending'`. Ein zweites Ereignis trifft
 * dann null Zeilen statt einen zweiten Eintrag zu erzeugen. Genau diese
 * Eigenschaft trägt jetzt auch die Nachfrage: Kommt der Käufer zurück UND
 * meldet Stripe gleichzeitig, gewinnt einer von beiden und der andere trifft
 * ins Leere. Kein Doppel-Trinkgeld.
 */
export async function handleBerkatTipPaid(admin: SupabaseClient, obj: unknown) {
  const session = obj as {
    id: string;
    metadata?: Record<string, string>;
  };

  const tipId = session.metadata?.tip_id;
  if (!tipId) {
    console.error('[berkatPaid] berkat_tip ohne tip_id', session.id);
    return;
  }

  const { data: updated, error } = await admin
    .from('berkat_tips')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', tipId)
    .eq('status', 'pending')
    .select('id, recipient_id, amount_cents');

  if (error) {
    console.error('[berkatPaid] berkat_tip update fehlgeschlagen', error.message);
    return;
  }
  if (!updated || updated.length === 0) {
    // Kein Fehler: entweder schon bestätigt (Doppel-Zustellung) oder storniert.
    console.log(`[berkatPaid] berkat_tip ${tipId} war nicht mehr pending`);
    return;
  }

  console.log(`[berkatPaid] Trinkgeld ${tipId} bestätigt (${updated[0].amount_cents} Cent)`);
}

/**
 * Produkt-Bestellung bezahlt (echte Ware, z. B. Parfüm, oder ein
 * Berkat-Sammelkorb).
 *
 * Claim-before-update: nur 'payment_requested' → 'paid' (idempotent gegen
 * Retries). Speichert die von Stripe Checkout eingesammelte Versandadresse.
 */
export async function handleProductOrderPaid(admin: SupabaseClient, obj: unknown) {
  const session = obj as {
    id: string;
    client_reference_id?: string;
    payment_intent?: string;
    metadata?: Record<string, string>;
    shipping_details?: { name?: string; address?: Record<string, string> };
    customer_details?: { name?: string; address?: Record<string, string> };
    // Der tatsächlich gezahlte Versand. Stripe rechnet ihn aus der vom Käufer
    // gewählten `shipping_option` und meldet ihn hier zurück — er steht NICHT in
    // `amount_eur`, weil Ware und Versand bei Stripe Connect getrennt verrechnet
    // werden. Fehlt das Feld (Serlo-Produktkauf ohne Versandoptionen), bleibt es
    // bei 0.
    total_details?: { amount_shipping?: number };
  };

  const orderId = session.client_reference_id ?? session.metadata?.order_id;
  if (!orderId) {
    console.warn('[berkatPaid] product_order without order_id');
    return;
  }

  const ship = session.shipping_details ?? session.customer_details;
  const addr = ship?.address ?? {};
  const street = [addr.line1, addr.line2].filter(Boolean).join(', ') || null;

  const { data: claimed, error: claimErr } = await admin
    .from('product_orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent: session.payment_intent ?? null,
      shipping_cents: session.total_details?.amount_shipping ?? 0,
      ship_name: ship?.name ?? null,
      ship_street: street,
      ship_zip: addr.postal_code ?? null,
      ship_city: addr.city ?? null,
      ship_country: addr.country ?? null,
    })
    .eq('id', orderId)
    .eq('status', 'payment_requested')
    // `cart_id` unterscheidet die Herkunft: gesetzt = Berkat-Sammelkorb,
    // NULL = Serlo-Produktkauf. Dieselbe Weiche wie in create-checkout-session.
    // `title` kommt seit dem 16.08.2026 mit — siehe die Meldung unten.
    .select('id, buyer_id, seller_id, product_id, quantity, cart_id, title');

  if (claimErr) {
    console.error('[berkatPaid] product claim failed', claimErr);
    throw new Error(`product_claim_failed: ${claimErr.message}`);
  }

  if (!claimed || claimed.length === 0) {
    console.log(`[berkatPaid] product order ${orderId} already paid/not payable — skip`);
    return;
  }

  const row = claimed[0];
  // Verkauf zählen (products.sold_count) — sonst bleibt das Parfüm auf „0× verkauft".
  if (row?.product_id) {
    try {
      await admin.rpc('bump_product_sold_count', {
        p_product_id: row.product_id,
        p_qty: row.quantity ?? 1,
      });
    } catch (e) {
      console.warn('[berkatPaid] sold_count bump failed (non-fatal):', e);
    }
  }

  // Verkäufer informieren: bezahlt → bitte versenden.
  //
  // `app` entscheidet, auf welchem Gerät die Meldung landet. Ohne die Spalte
  // greift der Default 'serlo' — bei einem Berkat-Verkauf also die falsche App.
  // Heute rettet das noch der Rückfall in send_push_to_user (kein Gerät der
  // Ziel-App → alle Geräte des Nutzers), aber sobald ein Verkäufer BEIDE Apps
  // installiert hat, käme die Berkat-Verkaufsmeldung in Serlo an.
  await admin.from('notifications').insert({
    recipient_id: row.seller_id,
    sender_id: row.buyer_id,
    type: 'order_paid',
    // Ohne Emoji. Am 16.08.2026 kam das frühere „… versenden 📦" in der App als
    // Ersatzzeichen an (Kästchen mit Fragezeichen) — dasselbe Muster, das in
    // diesem Projekt schon einmal Mojibake in die Produktiv-Datenbank
    // geschrieben hat. In der Meldungsliste trägt ohnehin das Symbol daneben
    // die Bedeutung; der Satz braucht das Zeichen nicht.
    comment_text: 'Eine Bestellung wurde bezahlt — bitte versenden',
    // Welcher Artikel — sonst stehen bei vier offenen Bestellungen vier
    // wortgleiche Zeilen untereinander, und der Verkäufer weiß nicht, welche
    // gemeint ist. Am 16.08.2026 im Simulator genau so gesehen.
    //
    // NUR für Berkat gesetzt: `product_name` in Serlos Meldungsliste zu füllen
    // wäre eine Verhaltensänderung an einem laufenden Produkt — dieselbe Linie,
    // aus der `notify_order_shipped` auf Berkat begrenzt wurde. Bei einer
    // Berkat-Bestellung ist `title` entweder der Artikelname oder „3 Artikel
    // aus der Live-Show" (gesetzt in `checkout_auction_cart`); beides sagt
    // mehr als gar nichts.
    product_name: row.cart_id ? row.title ?? null : null,
    app: row.cart_id ? 'berkat' : 'serlo',
  });
}
