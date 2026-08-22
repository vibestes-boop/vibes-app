// supabase/functions/delete-account/index.ts
//
// Löscht das Konto des aufrufenden Nutzers — über `delete_own_account()`,
// also ANONYMISIEREND.
//
// ⚠️ BIS ZUM 22.08.2026 HAT DIESE FUNCTION HART GELÖSCHT.
//
// Sie rief `DELETE /auth/v1/admin/users/<id>` mit dem Service-Role-Key, und
// ihr eigener Kopf beschrieb das als Feature: „Die profiles-Tabelle hat
// ON DELETE CASCADE → alle Daten werden mitgelöscht."
//
// Die Kette purged aber mehr als die eigenen Daten. An `profiles` hängen mit
// demselben Verhalten unter anderem `product_orders.buyer_id` und
// `.seller_id`, `berkat_tips`, `live_auctions.seller_id`, `live_bids`,
// `auction_carts`. Löscht ein KÄUFER sein Konto, verschwindet damit der
// **Verkaufsbeleg des Verkäufers** — der hat die Ware verschickt und findet
// den Vorgang nicht mehr. Und § 147 AO / § 257 HGB verlangen für Rechnungen
// sechs bis zehn Jahre Aufbewahrung; die DSGVO verlangt das Löschen dieser
// Daten ausdrücklich NICHT (Art. 17 Abs. 3 lit. b).
//
// Genau das wurde am 21.08.2026 mit `20260821140000_account_deletion_anonymises`
// behoben — auf der SQL-Seite. **Diese Function hat den Fix vollständig
// umgangen**, weil sie am RPC vorbei direkt die Admin-API rief. Sie ist der
// Weg, den Serlos ausgelieferte App benutzt (`app/settings.tsx:308`), also
// genau der, der in der Praxis läuft.
//
// Aufgefallen im Sicherheits-Audit vom 22.08.2026 (Übergabe, Abschnitt 73).
//
// ─────────────────────────────────────────────────────────────────────────────
// WAS SICH FÜR DEN AUFRUFER ÄNDERT
//
// Der Endpunkt, die Methode und die Erfolgsantwort (`{"success": true}`)
// bleiben gleich — die ausgelieferte App muss nicht angefasst werden.
//
// NEU ist, dass die Löschung **abgelehnt** werden kann. `delete_own_account()`
// kennt zwei vorübergehende Sperren, und beide sind Absicht:
//   • ein offener Sammelkorb (`open` / `checkout_pending`)
//   • bezahlte, aber unversendete Bestellungen als Verkäufer
// Beide lösen sich von selbst — der Korb läuft in 24 Stunden ab, die
// Bestellung ist nach dem Versand erledigt. Apple 5.1.1(v) erlaubt das:
// Unzulässig wäre eine Löschung, die gar nicht geht oder nur per E-Mail an den
// Support.
//
// Der Fehlercode kommt als `{"error": "<code>", "blocked": true}` mit HTTP 409
// zurück, damit ein Client ihn unterscheiden kann. Ältere Clients zeigen ihn
// als Fehlertext — unschön, aber ehrlich, und besser als eine stille
// Nicht-Löschung.
//
// ⚠️ `delete_own_account()` ist SECURITY DEFINER und arbeitet auf `auth.uid()`.
// Sie MUSS deshalb mit dem JWT DES NUTZERS gerufen werden, nicht mit dem
// Service-Role-Key — mit dem wäre `auth.uid()` NULL und die Antwort
// `not_authenticated`. Das ist der Grund, warum hier der Authorization-Header
// des Aufrufers durchgereicht wird.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Kein Authorization-Header' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;

    // Der Aufruf läuft MIT dem Token des Nutzers — siehe Kopf.
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/delete_own_account`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const text = await res.text();

    if (!res.ok) {
      // Ein 401/403 hier heisst: Der Token taugt nicht. Alles andere ist ein
      // echter Fehler und darf NICHT als Erfolg durchgehen — eine gemeldete,
      // aber nicht erfolgte Löschung ist die schlimmste Antwort von allen.
      return json({ error: `Löschen fehlgeschlagen: ${text}` }, res.status === 401 ? 401 : 500);
    }

    // ⚠️ Die RPC WIRFT nicht, sie ANTWORTET mit {"error": …}. Wer nur auf den
    // HTTP-Status prüft, hält jede abgelehnte Löschung für erfolgreich —
    // dieselbe Falle wie bei `report_order_dispute` (Übergabe, Abschnitt 67).
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (payload && typeof payload === 'object' && 'error' in payload) {
      return json({ error: payload.error, blocked: true }, 409);
    }

    return json({ success: true, ...payload });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return json({ error: message }, 500);
  }
});
