/**
 * Wem gehört dieses Token? — die geprüfte Antwort.
 *
 * ⚠️ ENTSTANDEN AUS EINEM FEHLER, DER ZWEIMAL IM HAUS STAND (23.08.2026).
 *
 * `r2-sign` und `bunny-ingest` hatten beide dieselbe Funktion abgeschrieben:
 * den mittleren Teil des JWT base64-dekodieren und `sub` herauslesen — OHNE
 * die Signatur zu prüfen. Ein JWT ist aber nur deshalb vertrauenswürdig, weil
 * es signiert ist; sein Inhalt allein ist frei erfundener Text:
 *
 *     Authorization: Bearer x.eyJzdWIiOiI8ZnJlbWRlLWlkPiJ9.y
 *
 * Was daran hing:
 *   • `r2-sign`      → presigned PUT-URL im Ordner eines FREMDEN Nutzers.
 *                      Profilbild überschreiben, Artikelfotos ersetzen.
 *   • `bunny-ingest` → Transkodier-Auftrag im Namen eines fremden Autors.
 *                      Der Kommentar dort behauptete sogar ausdrücklich
 *                      „Caller-JWT (sub) muss Autor des Posts sein".
 *
 * Aufgehalten hat das bisher allein das Supabase-Gateway: Beide Functions
 * stehen nicht in `supabase/config.toml`, also gilt `verify_jwt = true`, und
 * ein falsch signiertes Token kommt gar nicht erst an. **Aber sich stillschweigend
 * darauf zu verlassen ist das Muster, das am 22.08. bei `send-push-notification`
 * schiefging** (Übergabe 73: „`verify_jwt = true` ist kein Schutz"). Ein
 * einziges Deployment mit `--no-verify-jwt` — so wie es `stripe-webhook` zu
 * Recht bekommt — reisst das Loch auf, und nichts im Code hätte gewarnt.
 *
 * ⚠️ WER EINE NEUE FUNCTION MIT NUTZER-IDENTITÄT BAUT, nimmt diese hier. Der
 * bequeme Weg (dekodieren statt prüfen) sieht im Code identisch aus und ist es
 * nicht — das ist der Grund, warum er zweimal entstanden ist.
 *
 * Kein neues Secret nötig: `SUPABASE_URL` und `SUPABASE_ANON_KEY` setzt die
 * Plattform ohnehin.
 */

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

// token → { userId, bis }. Bewusst klein und ohne Aufräum-Timer: Eine
// Edge-Function-Instanz lebt Minuten, nicht Tage. Der Zwischenspeicher trägt,
// weil ein Angebot bis zu acht Bilder hat und dann acht Aufrufe in Folge
// kommen — ohne ihn wären das acht Netzwerk-Sprünge für dieselbe Auskunft.
const identityCache = new Map<string, { userId: string; expires: number }>();
const IDENTITY_TTL_MS = 60_000;
const IDENTITY_CACHE_MAX = 256;

function cacheGet(token: string): string | null {
  const hit = identityCache.get(token);
  if (!hit) return null;
  if (hit.expires <= Date.now()) { identityCache.delete(token); return null; }
  return hit.userId;
}

function cacheSet(token: string, userId: string): void {
  // Deckel gegen unbegrenztes Wachsen: ältesten Eintrag verdrängen (FIFO —
  // `Map` hält die Einfügereihenfolge). Dasselbe Muster wie die Combo-Karten
  // in Serlos `useGifts` (v1.27.0, Fund 4).
  if (identityCache.size >= IDENTITY_CACHE_MAX) {
    const oldest = identityCache.keys().next().value;
    if (oldest !== undefined) identityCache.delete(oldest);
  }
  identityCache.set(token, { userId, expires: Date.now() + IDENTITY_TTL_MS });
}

/**
 * Gibt die Nutzer-ID zurück, wenn das mitgeschickte Token gültig ist — sonst
 * `null`. Prüft die Identität bei Supabase Auth, statt dem Token zu glauben.
 *
 * ⚠️ Fail-closed: Fehlt die Umgebung, wird NICHT durchgewinkt. Ein Rückfall
 * auf „dann glauben wir dem Token halt" wäre genau der Fehler zurück, den
 * dieses Modul behebt — lieber ein sichtbarer Ausfall als ein stilles Loch.
 */
export async function getVerifiedUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return null;

  const cached = cacheGet(token);
  if (cached) return cached;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!res.ok) return null;

    const user = await res.json() as { id?: unknown };
    if (typeof user.id !== 'string' || !user.id) return null;

    cacheSet(token, user.id);
    return user.id;
  } catch {
    return null;
  }
}
