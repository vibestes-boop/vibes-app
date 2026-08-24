#!/usr/bin/env node
/**
 * seed-berkat-shop.mjs — Testware ins Berkat-Regal legen
 *
 * WOZU
 * Berkats Flächen ließen sich bis zum 18.08.2026 nicht beurteilen, weil zwei
 * Artikel darin lagen: Ein Raster mit zwei Karten sagt nichts über ein Raster,
 * die Suche im Regal erscheint erst ab acht Artikeln, und die Kategorie-Leiste
 * war überall leer. Dieses Skript legt genug Ware an, dass jede Fläche etwas
 * zu zeigen hat.
 *
 * ⚠️ ES SCHREIBT IN DIE PRODUKTIV-DATENBANK. Sie ist dieselbe wie Serlos.
 * Alles, was hier entsteht, trägt `SEED_TAG` in der Beschreibung und lässt sich
 * damit vollständig wieder entfernen:
 *
 *   node scripts/seed-berkat-shop.mjs --remove
 *
 * VERWENDUNG
 *   SERVICE_ROLE_KEY=sb_secret_… node scripts/seed-berkat-shop.mjs
 *   SERVICE_ROLE_KEY=sb_secret_… node scripts/seed-berkat-shop.mjs --remove
 *
 * Der Schlüssel steht im Supabase-Dashboard unter Project Settings → API und
 * wird bewusst NICHT in einer Datei abgelegt: Das Repo ist öffentlich.
 *
 * WARUM DIREKT IN DIE TABELLE UND NICHT ÜBER `create_standing_listing`
 * Die RPC hängt an `auth.uid()` — mit dem Service-Role-Key gibt es keine
 * Sitzung und damit keine `auth.uid()`. Das Skript bildet deshalb nach, was sie
 * tut: `berkat_sellers`-Zeile sicherstellen, `seller_kind` mitschreiben,
 * `status = 'listed'`, `session_id = NULL`.
 *
 * WARUM FREMDE VERKÄUFER
 * Gehört die Ware dem Konto, mit dem man die App ansieht, steht überall „Deins"
 * — Kaufknopf, Merken-Herz und Preisvorschlag erscheinen dann nie (Übergabe,
 * Abschnitt 26). Das Skript verteilt die Artikel deshalb auf ANDERE bestehende
 * Profile und lässt das eigene Konto aus.
 *
 * BILDER
 * Direkte Unsplash-URLs, keine Kopie nach R2. Für Testware ist das richtig: Es
 * spart den Upload-Weg, und beim Aufräumen bleibt nichts liegen. Für echte
 * Angebote wäre es falsch — die gehören nach R2, weil sie sonst von einer
 * fremden Domain abhängen.
 */

const SUPABASE_URL = 'https://llymwqfgujwkoxzqxrlm.supabase.co';
const KEY = process.env.SERVICE_ROLE_KEY;

/** Steht in jeder erzeugten Beschreibung und ist der Griff zum Aufräumen. */
const SEED_TAG = '[testware]';

if (!KEY) {
  console.error(
    '\n❌ SERVICE_ROLE_KEY fehlt.\n\n' +
      '   SERVICE_ROLE_KEY=DEIN_KEY node scripts/seed-berkat-shop.mjs\n\n' +
      '   Der Schlüssel steht im Supabase-Dashboard:\n' +
      '   Project Settings → API Keys → „secret" → Reveal (sb_secret_…)\n',
  );
  process.exit(1);
}

// ⚠️ Der Schlüssel geht in einen HTTP-Header, und Header vertragen nur ASCII.
// Wer die Beispielzeile kopiert, ohne den Platzhalter zu ersetzen, schickt ein
// „…" (U+2026) mit und bekommt sonst nur „Cannot convert argument to a
// ByteString … value of 8230" — eine Meldung, die nicht sagt, was zu tun ist.
// Genau die Sorte Fehler, die in der Übergabe unter „Eine Fehlermeldung für
// alles ist keine Fehlermeldung" steht.
const badChar = [...KEY].find((ch) => ch.charCodeAt(0) > 127);
if (badChar) {
  console.error(
    `\n❌ Der Schlüssel enthält ein Zeichen, das dort nicht hingehört: „${badChar}"\n\n` +
      '   Sieht so aus, als wäre die Beispielzeile kopiert worden, ohne den\n' +
      '   Platzhalter zu ersetzen. Es muss der echte Schlüssel dastehen:\n\n' +
      '   SERVICE_ROLE_KEY=sb_secret_AbC123… node scripts/seed-berkat-shop.mjs\n' +
      '                    ^^^^^^^^^^^^^^^^ der echte, aus dem Dashboard\n',
  );
  process.exit(1);
}
if (KEY.length < 30) {
  console.error(
    `\n❌ Der Schlüssel ist mit ${KEY.length} Zeichen zu kurz — das ist keiner.\n` +
      '   Supabase → Project Settings → API Keys → „secret" → Reveal (sb_secret_…)\n',
  );
  process.exit(1);
}

const REMOVE = process.argv.includes('--remove');

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    // ⚠️ 401/403 heißt IMMER dasselbe: Der Schlüssel taugt nicht. Die rohe
    // Antwort („Invalid API key. Double check your API key.") sagt nicht, WAS
    // zu prüfen ist.
    //
    // ⚠️ Hier stand bis zum 25.08.2026 „Ist es der service_role-Schlüssel? Der
    // anon-Schlüssel steht im Dashboard direkt darüber." Der Satz hat an dem
    // Tag in die falsche Richtung geschickt: Der eingefügte Schlüssel WAR ein
    // service_role-Schlüssel — nur ein **Legacy-JWT**, und die sind für dieses
    // Projekt abgeschaltet. Das Unterscheidungsmerkmal ist nicht die Rolle,
    // sondern die BAUART: `eyJ…` ist alt, `sb_secret_…` ist der gültige Weg.
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Der Schlüssel wurde abgelehnt (${res.status}).\n\n` +
          `   Er ist ${KEY.length} Zeichen lang und beginnt mit „${KEY.slice(0, 11)}…".\n\n` +
          (KEY.startsWith('eyJ')
            ? '   ⚠️ Das ist ein LEGACY-JWT (erkennbar am „eyJ…").\n' +
              '      Dieses Projekt benutzt die NEUEN API-Schlüssel — die alten JWTs\n' +
              '      sind abgeschaltet, egal ob anon oder service_role drinsteht.\n\n' +
              '   Gebraucht wird „sb_secret_…":\n' +
              '      Supabase → Project Settings → API Keys → „secret" → Reveal\n\n' +
              '   ⚠️ NICHT aus dem Abschnitt „Legacy API keys" darunter.'
            : '   Prüf zwei Dinge:\n' +
              '   1. Ist es der „sb_secret_…"-Schlüssel? Nur der umgeht RLS.\n' +
              '      Supabase → Project Settings → API Keys → „secret" → Reveal\n' +
              '   2. Ist er vollständig? Beim Kopieren gehen gern Zeichen verloren.'),
      );
    }
    throw new Error(`${res.status} ${path}\n${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// ── Die Ware ────────────────────────────────────────────────────────────────
// Titel, Preis und Zustand sind bewusst uneinheitlich: Ein Regal, in dem alles
// 25 € kostet und „Sehr gut" ist, sieht aus wie ein Formular, nicht wie ein
// Basar. Orte sind deutsche Städte mit tschetschenischer Gemeinde.
const U = (id) => `https://images.unsplash.com/photo-${id}?w=900&h=1125&fit=crop&q=80`;

// `s` ist die Größe (Spalte `live_auctions.size`, seit 20260819100000).
//
// ⚠️ Sie stand bis zum 19.08.2026 bei sechs Artikeln IM TITEL („Sneaker weiß,
// Gr. 42"). Genau das war die Notlösung, die die Spalte abschafft — sie ist im
// Titel weder filterbar noch vergleichbar und frisst den Platz, den der Titel
// für die Sache selbst braucht. Die Titel sind deshalb gekürzt; die alten
// stehen in `LEGACY_TITLES`, damit `--remove` auch Zeilen aus früheren Läufen
// findet.
//
// Bewusst gemischt: Zahlen von 28 bis 74, dazu „L" und „One Size". Ein Regal,
// in dem alle Größen zweistellige Zahlen sind, prüft weder die Sortierung im
// Filter noch die Frage, ob eine Zeile mit „One Size" noch passt.
const ITEMS = [
  // ── Mode / Abaya ──────────────────────────────────────────────────────────
  { t: 'Abaya, schwarz mit Stickerei', c: 'abaya', p: 6900, k: 'neu-mit-etikett', o: true, s: '38',
    city: 'Berlin', plz: '13353', img: ['1728487235101-664d87965931', '1760083545495-b297b1690672'],
    d: 'Klassischer Schnitt, weit fallend. Ungetragen, Etikett noch dran.' },
  { t: 'Abaya Dubai-Stil, Sand', c: 'abaya', p: 8500, k: 'neu', o: true, s: '40',
    city: 'Frankfurt', plz: '60313', img: ['1772474500365-c2c520545f44'],
    d: 'Leichter Stoff, für den Sommer. Einmal anprobiert, nie getragen.' },
  { t: 'Jilbab zweiteilig, dunkelblau', c: 'abaya', p: 5400, k: 'sehr-gut', s: '42',
    city: 'Köln', plz: '50823', img: ['1752794673269-dc356838c5fd'],
    d: 'Zweimal getragen, gewaschen. Keine Flecken, keine Fusseln.' },
  { t: 'Hijab-Set, 3 Tücher', c: 'hijab', p: 2400, k: 'neu', o: true, s: 'One Size',
    city: 'Hamburg', plz: '21073', img: ['1772474578035-bebcd90b355d', '1618407960998-7864dd928574'],
    d: 'Drei Farben: Creme, Rosé, Anthrazit. Chiffon, nicht durchsichtig.' },
  { t: 'Kopftuch Seide, handrolliert', c: 'hijab', p: 3900, k: 'neu-mit-etikett', s: 'One Size',
    city: 'München', plz: '80331', img: ['1772474557170-4818d01d7bca'] },
  { t: 'Abendkleid, bodenlang', c: 'abendmode', p: 11900, k: 'sehr-gut', o: true, s: '38',
    city: 'Düsseldorf', plz: '40210', img: ['1724412665971-114bd351a42d'],
    // „Größe 38" stand hier im Fließtext — dieselbe Notlösung wie im Titel,
    // nur eine Zeile tiefer und noch unauffindbarer.
    d: 'Einmal zu einer Hochzeit getragen. Innenfutter tadellos.' },
  { t: 'Wintermantel Wolle, Camel', c: 'jacken', p: 7500, k: 'gut', s: '40',
    city: 'Berlin', plz: '12043', img: ['1736342182213-6c037467cb38'],
    d: 'Zwei Winter getragen. Ein Knopf wurde nachgenäht, sonst top.' },
  { t: 'Herrenhemd Leinen, weiß', c: 'herrenmode', p: 2900, k: 'sehr-gut', s: 'L',
    city: 'Essen', plz: '45127', img: ['1614028609503-590a6a47146a'] },

  // ── Schuhe ────────────────────────────────────────────────────────────────
  { t: 'Sneaker weiß', c: 'herrenschuhe', p: 5900, k: 'gut', o: true, s: '42',
    city: 'Dortmund', plz: '44135', img: ['1560769629-975ec94e6a86', '1605523741177-cd660595c2cf'],
    d: 'Sohle sauber, Obermaterial ohne Risse. Ein kleiner Fleck innen links.' },
  { t: 'Laufschuhe', c: 'damenschuhe', p: 4200, k: 'sehr-gut', s: '39',
    city: 'Hannover', plz: '30159', img: ['1656944227421-416b1d2186c9'] },
  { t: 'Kinderschuhe Leder', c: 'kinderschuhe', p: 1900, k: 'gut', s: '28',
    city: 'Bremen', plz: '28195', img: ['1628413993904-94ecb60f1239'],
    d: 'Ein Winter getragen, Sohle noch gut. Innen leicht abgelaufen.' },
  { t: 'Hausschuhe Filz', c: 'hausschuhe', p: 1500, k: 'neu', s: '40',
    city: 'Leipzig', plz: '04109', img: ['1618677831708-0e7fda3148b4'] },

  // ── Taschen ───────────────────────────────────────────────────────────────
  { t: 'Handtasche Leder, cognac', c: 'handtaschen', p: 8900, k: 'sehr-gut', o: true,
    city: 'Frankfurt', plz: '60594', img: ['1682745230951-8a5aa9a474a0', '1548036328-c9fa89d128fa'],
    d: 'Echtleder, Innenfutter fleckenfrei. Trageriemen ohne Abrieb.' },
  { t: 'Schultertasche schwarz', c: 'handtaschen', p: 3400, k: 'gut',
    city: 'Berlin', plz: '10967', img: ['1575202332411-b01fe9ace7a8'] },
  { t: 'Reisetasche groß, wasserfest', c: 'reisegepaeck', p: 4900, k: 'neu',
    city: 'Duisburg', plz: '47051', img: ['1591348278900-019a8a2a8b1d'] },
  { t: 'Geldbörse Leder, klein', c: 'geldboersen', p: 1800, k: 'neu-mit-etikett', o: true,
    city: 'Nürnberg', plz: '90402', img: ['1559563458-527698bf5295'] },

  // ── Schmuck & Uhren ───────────────────────────────────────────────────────
  { t: 'Ring 585 Gold', c: 'gold', p: 24900, k: 'sehr-gut', s: '54',
    city: 'Düsseldorf', plz: '40213', img: ['1543294001-f7cd5d7fb516', '1611955167811-4711904bb9f8'],
    d: 'Mit Prüfzeichen. Selten getragen, keine Kratzer am Band.' },
  { t: 'Kette Silber 925, 45 cm', c: 'silber', p: 4900, k: 'neu',
    city: 'Stuttgart', plz: '70173', img: ['1589207212797-cfd546dea0fe'] },
  { t: 'Ohrringe, Perle', c: 'ohrringe', p: 2900, k: 'sehr-gut', o: true,
    city: 'Köln', plz: '50667', img: ['1629118639934-2b241503956c'] },
  { t: 'Brautschmuck-Set', c: 'brautschmuck', p: 13900, k: 'neu-mit-etikett',
    city: 'Berlin', plz: '13409', img: ['1705326455036-0fab8ecba04d'],
    d: 'Kette, Ohrringe und Armreif im Set. Originalschachtel dabei.' },
  { t: 'Herrenuhr Automatik', c: 'herrenuhren', p: 18900, k: 'gut', o: true,
    city: 'München', plz: '80639', img: ['1533090368676-1fd25485db88'],
    d: 'Läuft genau. Gehäuse hat feine Gebrauchsspuren, Glas ohne Kratzer.' },
  { t: 'Damenuhr, Roségold', c: 'damenuhren', p: 8900, k: 'sehr-gut',
    city: 'Hamburg', plz: '22767', img: ['1638428299996-d216a4104dc5'] },

  // ── Beauty & Duft ─────────────────────────────────────────────────────────
  { t: 'Oud-Parfüm 50 ml, angebrochen', c: 'oud', p: 6900, k: 'gut', o: true,
    city: 'Berlin', plz: '13347', img: ['1523293182086-7651a899d37f', '1541643600914-78b084683601'],
    d: 'Etwa 80 % voll. Schwerer, holziger Duft — hält den ganzen Tag.' },
  { t: 'Bakhoor-Räucherset', c: 'oud', p: 3400, k: 'neu',
    city: 'Frankfurt', plz: '60388', img: ['1594035910387-fea47794261f'] },
  { t: 'Parfüm Damen 100 ml, neu', c: 'parfuem-damen', p: 7900, k: 'neu-mit-etikett',
    city: 'Wuppertal', plz: '42103', img: ['1458538977777-0549b2370168'] },
  { t: 'Pflegeset Gesicht', c: 'pflege', p: 2400, k: 'neu', o: true,
    city: 'Bochum', plz: '44787', img: ['1587017539504-67cfbddac569'] },

  // ── Haus & Islamica ───────────────────────────────────────────────────────
  { t: 'Gebetsteppich, handgeknüpft', c: 'gebetsteppiche', p: 9900, k: 'sehr-gut', o: true,
    city: 'Berlin', plz: '13355', img: ['1600814832809-579119f47045', '1594847915592-2a7ef568e2b6'],
    d: 'Wolle, dicht geknüpft. Farben unverblasst, Fransen vollständig.' },
  { t: 'Tasbih Holz, 99 Perlen', c: 'tasbih', p: 1600, k: 'neu',
    city: 'Hamburg', plz: '20359', img: ['1600166898405-da9535204843'] },
  { t: 'Wandkalligrafie, gerahmt', c: 'kalligrafie', p: 5900, k: 'neu-mit-etikett',
    city: 'München', plz: '80337', img: ['1589725617374-6d1cd65c8014'] },
  { t: 'Teppich 160×230, Vintage', c: 'teppiche', p: 14900, k: 'gut',
    city: 'Köln', plz: '51063', img: ['1591624298055-3cfb0aa676c5'],
    d: 'Gebraucht gekauft, gereinigt. Eine Ecke leicht abgelaufen — auf dem Foto sichtbar.' },
  { t: 'Teegläser-Set, 6 Stück', c: 'geschirr', p: 2900, k: 'neu', o: true,
    city: 'Essen', plz: '45355', img: ['1649925985887-492ff29e7f08'] },
  { t: 'Raumduft Oud, 200 ml', c: 'duefte-haus', p: 2200, k: 'neu',
    city: 'Dortmund', plz: '44139', img: ['1763120471696-78fd513026a8'] },

  // ── Bücher & Kinder ───────────────────────────────────────────────────────
  { t: 'Quran mit Übersetzung', c: 'quran', p: 3900, k: 'sehr-gut',
    city: 'Berlin', plz: '13351', img: ['1704083753114-303532e8b07e'],
    d: 'Arabisch mit deutscher Übersetzung, Hardcover. Einband ohne Knicke.' },
  { t: 'Kinderbücher, 5er-Paket', c: 'kinderbuecher', p: 1800, k: 'gut', o: true,
    city: 'Hannover', plz: '30419', img: ['1660338183700-12388dc9aa4f'] },
  { t: 'Sprachkurs Arabisch, Buch + CD', c: 'lernen', p: 2900, k: 'gut',
    city: 'Leipzig', plz: '04277', img: ['1710367446263-512c6ececbc7'] },
  { t: 'Babyjacke', c: 'baby', p: 1400, k: 'sehr-gut', s: '74',
    city: 'Bremen', plz: '28209', img: ['1710367446113-d1d3fb053256'] },
];

/**
 * Titel, unter denen dieselben Artikel VOR dem 19.08.2026 angelegt wurden.
 *
 * Sie stehen hier nur fürs Aufräumen. Wer vorher geseedet hat, hat Zeilen mit
 * „Gr. 42" im Titel in der Datenbank; `--remove` findet sie über das
 * `[testware]`-Kennzeichen ohnehin — außer bei genau der Zeile, bei der das
 * Kennzeichen am 18.08.2026 fehlte („Babyjacke, Gr. 74"). Genau für diesen Fall
 * ist die Liste da: Ein Aufräumen, das eine bekannte Zeile stehen lässt, ist
 * schlimmer als keines.
 */
const LEGACY_TITLES = [
  'Sneaker weiß, Gr. 42',
  'Laufschuhe, Gr. 39',
  'Kinderschuhe Leder, Gr. 28',
  'Hausschuhe Filz, Gr. 40',
  'Ring 585 Gold, Gr. 54',
  'Babyjacke, Gr. 74',
];

async function main() {
  // ── Wer verkauft ──────────────────────────────────────────────────────────
  // Profile mit Benutzernamen, absteigend nach Erstellung. Die ersten paar
  // genügen; wichtig ist nur, dass es MEHRERE sind — ein Regal, in dem alles
  // von einer Person kommt, testet die Verkäuferzeile nicht.
  const profiles = await rest(
    'profiles?select=id,username&username=not.is.null&order=created_at.desc&limit=6',
  );
  if (!profiles?.length) throw new Error('Keine Profile gefunden.');

  if (REMOVE) {
    // ⚠️ In einer SCHLEIFE, mit Kontrolle am Ende.
    //
    // Der erste Lauf am 18.08.2026 ließ genau einen von 36 Artikeln stehen —
    // die Ursache blieb offen (vermutlich eine Zeilengrenze der API, die bei
    // `return=representation` zuschlägt). Statt sie zu erraten, löscht das
    // Skript jetzt so lange, bis nichts mehr übrig ist, und SAGT hinterher,
    // wie viele noch da sind. Ein Aufräumen, das schweigend unvollständig
    // bleibt, ist schlimmer als keines: Man glaubt, die Datenbank sei sauber.
    // ZWEI Wege, absichtlich. Am 18.08.2026 blieb ein Artikel stehen, den der
    // Tag-Filter nicht fand — die Beschreibung trug das Kennzeichen also nicht,
    // aus ungeklärtem Grund. Der Titel ist der zweite Griff: Er steht in
    // `ITEMS` und ist damit unabhängig davon, was in der Datenbank gelandet
    // ist. Beides zusammen findet auch die Zeilen, bei denen einer der beiden
    // Wege versagt.
    //
    // ⚠️ `LEGACY_TITLES` muss mit, seit die Größen am 19.08.2026 aus den Titeln
    // gewandert sind: Wer davor geseedet hat, hat „Sneaker weiß, Gr. 42" in der
    // Datenbank — ein Titelvergleich gegen die NEUEN Namen fände ihn nicht.
    // Wer künftig einen Titel ändert, hängt den alten dort an.
    const titles = [...ITEMS.map((i) => i.t), ...LEGACY_TITLES];
    const inList = (vals) =>
      `(${vals.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(',')})`;

    const find = async () => {
      const [byTag, byTitle] = await Promise.all([
        rest(`live_auctions?description=like.*${encodeURIComponent(SEED_TAG)}*&select=id`),
        // `status=eq.listed`: Ein zufällig gleich benannter VERKAUFTER Artikel
        // eines echten Nutzers soll nicht mitgelöscht werden.
        rest(
          `live_auctions?title=in.${encodeURIComponent(inList(titles))}` +
            `&status=eq.listed&select=id`,
        ),
      ]);
      const ids = new Set([...(byTag ?? []), ...(byTitle ?? [])].map((r) => r.id));
      return [...ids].map((id) => ({ id }));
    };

    let total = 0;
    for (let round = 1; round <= 20; round++) {
      const left = await find();
      if (!left?.length) break;
      // Nach id löschen statt nach Muster: eine eindeutige Liste, kein
      // Textvergleich, und damit auch kein Zweifel, was getroffen wurde.
      const ids = left.map((r) => r.id);
      await rest(`live_auctions?id=in.(${ids.join(',')})`, { method: 'DELETE' });
      total += ids.length;
      console.log(`   Runde ${round}: ${ids.length} entfernt`);
    }

    const rest_ = await find();
    if (rest_?.length) {
      console.error(
        `\n⚠️ ${total} entfernt, aber ${rest_.length} bleiben übrig.\n` +
          '   Bitte melden — dann ist es kein Zufall, sondern ein Muster.\n',
      );
    } else {
      console.log(`🧹 ${total} Testartikel entfernt, keiner übrig.`);
    }
    return;
  }

  console.log(`Verkäufer: ${profiles.map((p) => p.username).join(', ')}`);

  // `berkat_sellers` muss je Verkäufer stehen, sonst bleibt `seller_kind` leer
  // und die Anbieterkennzeichnung fehlt am Angebot (Art. 246d § 1 EGBGB).
  // Einer davon wird gewerblich — sonst ist der geschäftliche Zweig der
  // Artikelseite weiterhin ungetestet (Übergabe, Abschnitt 21).
  for (const [i, p] of profiles.entries()) {
    const business = i === 1;
    await rest('berkat_sellers?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id: p.id,
        kind: business ? 'business' : 'private',
        // Ein gewerblicher Verkäufer OHNE Impressum ist ein rechtlich
        // unfertiger Zustand (§ 5 DDG) — als Testdaten hinterlässt man den
        // nicht. Die Angaben stehen seit dem 18.08.2026 auf dem
        // Verkäufer-Profil, nicht mehr an jeder Artikelseite (Abschnitt 34).
        ...(business
          ? {
              legal_name: 'Testhandel Amir e. K.',
              street: 'Musterstraße 12',
              postal_code: '60313',
              city: 'Frankfurt am Main',
              // ⚠️ LÄNDERCODE, nicht der Name. `berkat_sellers` hat
              // `CHECK (country IS NULL OR country IN ('DE','AT','CH'))` —
              // „Deutschland" scheitert dort mit 23514. Am 19.08.2026 genau so
              // passiert; die Spalte heißt `country` und sieht nach Freitext
              // aus, ist aber eine Auswahl aus dreien.
              country: 'DE',
              contact_email: 'kontakt@example.invalid',
              vat_id: 'DE000000000',
            }
          : {}),
      }),
    });
  }
  const kindOf = (i) => (i === 1 ? 'business' : 'private');

  const rows = ITEMS.map((item, n) => {
    const seller = profiles[n % profiles.length];
    const urls = item.img.map(U);
    return {
      session_id: null,
      seller_id: seller.id,
      title: item.t,
      image_url: urls[0],
      image_urls: urls,
      start_price_cents: 100,
      buy_now_cents: item.p,
      status: 'listed',
      women_only: false,
      accepts_offers: Boolean(item.o),
      category: item.c,
      // Der Griff zum Aufräumen steht am Ende, damit er in der App zwar
      // sichtbar, aber nicht das Erste ist, was jemand liest.
      description: `${item.d ? item.d + ' ' : ''}${SEED_TAG}`,
      condition: item.k,
      size: item.s ?? null,
      postal_code: item.plz,
      city: item.city,
      seller_kind: kindOf(n % profiles.length),
    };
  });

  const made = await rest('live_auctions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
  console.log(`✅ ${made.length} Artikel angelegt.`);
  // ⚠️ ABSOLUTER Pfad, aus `process.argv[1]`. Hier stand ein relativer
  // (`node scripts/…`), und der gilt nur im Wurzelverzeichnis — am
  // 25.08.2026 aus `apps/berkat` heraus kopiert und mit
  // MODULE_NOT_FOUND gescheitert. Ein Befehl, den man zum Laufen erst
  // umschreiben muss, ist kein Befehl.
  console.log(`   Entfernen: node ${process.argv[1]} --remove`);
}

main().catch((e) => {
  console.error('\n❌', e.message, '\n');
  process.exit(1);
});
