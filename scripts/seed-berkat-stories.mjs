#!/usr/bin/env node
/**
 * seed-berkat-stories.mjs — Stories in Berkats Ring legen
 *
 * WOZU
 * Am 24.08.2026 stand der komplette Story-Bau ungeprüft da: Ring, Betrachter,
 * Fortschrittsbalken, Weiterblättern und der Gesehen-Zustand waren NIE gelaufen,
 * weil im Datenstand keine einzige Story existierte. Gesehen war nur der
 * Leerfall — und der beweist genau nichts (Übergabe, Abschnitt 81).
 *
 * Dieses Skript legt so viele Stories an, dass jede dieser Flächen etwas zu
 * zeigen hat: mehrere Verkäufer im Ring (sonst ist die Reihenfolge nicht
 * prüfbar), mehrere Bilder je Verkäufer (sonst gibt es nur EINEN Balken und
 * kein Weiterblättern), und alle jünger als 24 Stunden (sonst filtert der Hook
 * sie weg, bevor irgendetwas zu sehen ist).
 *
 * ⚠️ ES SCHREIBT IN DIE PRODUKTIV-DATENBANK. Sie ist dieselbe wie Serlos.
 *
 *   node scripts/seed-berkat-stories.mjs
 *   node scripts/seed-berkat-stories.mjs --remove
 *
 * VERWENDUNG
 *   SERVICE_ROLE_KEY=sb_secret_… node scripts/seed-berkat-stories.mjs
 *
 * Der Schlüssel steht im Supabase-Dashboard unter Project Settings → API und
 * wird bewusst NICHT in einer Datei abgelegt: Das Repo ist öffentlich.
 *
 * ── ⚠️ WAS DER GRIFF ZUM AUFRÄUMEN IST ───────────────────────────────────────
 *
 * `stories` hat kein Textfeld — es gibt also kein `[testware]` wie im Regal
 * (`seed-berkat-shop.mjs`). Der Griff ist stattdessen die HERKUNFT des Bildes:
 * Eine echte Story liegt IMMER auf R2 (`pickAndUpload` lädt dorthin hoch), eine
 * geseedete IMMER auf `images.unsplash.com`. Zusammen mit `app = 'berkat'` ist
 * das eine Bedingung, die eine echte Zeile nicht erfüllen kann.
 *
 * ⚠️ Beides muss stimmen, nicht eines: Ohne den App-Stempel träfe das Aufräumen
 * auch Serlos Bestand.
 *
 * ── WARUM FREMDE VERKÄUFER ───────────────────────────────────────────────────
 *
 * Dieselbe Begründung wie beim Regal: Die eigene Scheibe im Ring hat ihren
 * eigenen Zustand („Deine Story", kein Marken-Ring, Löschen erlaubt). Wer nur
 * eigene Stories hat, sieht nie, was ein Besucher sieht — und genau darum geht
 * es bei dieser Funktion. Die eigene legt man in zwei Sekunden über das „+" an.
 */

const SUPABASE_URL = 'https://llymwqfgujwkoxzqxrlm.supabase.co';
const KEY = process.env.SERVICE_ROLE_KEY;

if (!KEY) {
  console.error(
    '\n❌ SERVICE_ROLE_KEY fehlt.\n\n' +
      '   SERVICE_ROLE_KEY=DEIN_KEY node scripts/seed-berkat-stories.mjs\n\n' +
      '   Der Schlüssel steht im Supabase-Dashboard:\n' +
      '   Project Settings → API Keys → „secret" → Reveal (sb_secret_…)\n',
  );
  process.exit(1);
}

// ⚠️ Der Schlüssel geht in einen HTTP-Header, und Header vertragen nur ASCII.
// Wer die Beispielzeile kopiert, ohne den Platzhalter zu ersetzen, schickt ein
// „…" (U+2026) mit und bekommt sonst nur „Cannot convert argument to a
// ByteString" — eine Meldung, die nicht sagt, was zu tun ist.
const badChar = [...KEY].find((ch) => ch.charCodeAt(0) > 127);
if (badChar) {
  console.error(
    `\n❌ Der Schlüssel enthält ein Zeichen, das dort nicht hingehört: „${badChar}"\n\n` +
      '   SERVICE_ROLE_KEY=sb_secret_AbC123… node scripts/seed-berkat-stories.mjs\n' +
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
    // ⚠️ Die Unterscheidung ist die BAUART, nicht die Rolle. Am 25.08.2026
    // schickte der alte Text („Ist es der service_role-Schlüssel?") in die
    // falsche Richtung: Der eingefügte Schlüssel war einer — nur ein
    // Legacy-JWT, und die sind für dieses Projekt abgeschaltet.
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

/** Hochkant, wie eine Story aussieht. 9:16 statt der 4:5 aus dem Regal. */
const U = (id) => `https://images.unsplash.com/photo-${id}?w=1080&h=1920&fit=crop&q=80`;

/**
 * Was gezeigt wird.
 *
 * Bewusst UNGLEICH verteilt: ein Verkäufer mit drei Bildern, einer mit zweien,
 * einer mit einem. Drei Bilder prüfen den Fortschrittsbalken und das
 * Weiterblättern, EIN Bild prüft den Sonderfall, bei dem „weiter" sofort
 * schliessen muss — und der ist der wahrscheinlichere Fehler.
 *
 * `hAlt` ist das Alter in Stunden. Alles muss unter 24 bleiben, sonst filtert
 * `useBerkatStories` es weg und der Ring ist wieder leer. 20 ist der Prüfstein
 * dafür, dass der Rand hält, ohne dass die Zeile vor dem Ansehen abläuft.
 */
const SETS = [
  { hAlt: [2.0, 1.6, 1.2], img: ['1728487235101-664d87965931', '1772474500365-c2c520545f44', '1752794673269-dc356838c5fd'] },
  { hAlt: [5.0, 4.4], img: ['1523293182086-7651a899d37f', '1594035910387-fea47794261f'] },
  { hAlt: [20.0], img: ['1600814832809-579119f47045'] },
];

async function main() {
  // Dieselbe Auswahl wie im Regal-Skript: die zuletzt angelegten Profile mit
  // Benutzernamen. Damit gehören Stories und Ware denselben Leuten — ein Ring,
  // dessen Scheiben auf leere Profile führen, sieht kaputter aus als keiner.
  const profiles = await rest(
    'profiles?select=id,username&username=not.is.null&order=created_at.desc&limit=6',
  );
  if (!profiles?.length) throw new Error('Keine Profile gefunden.');

  if (REMOVE) {
    // ⚠️ In einer SCHLEIFE mit Kontrolle am Ende — dieselbe Lehre wie im
    // Regal-Skript, wo am 18.08.2026 genau ein Artikel von 36 stehen blieb und
    // niemand es merkte. Ein Aufräumen, das schweigend unvollständig bleibt,
    // ist schlimmer als keines: Man glaubt, die Datenbank sei sauber.
    //
    // ⚠️ BEIDE Bedingungen. `app=eq.berkat` allein träfe echte Berkat-Stories,
    // `media_url` allein träfe Serlos Bestand.
    // `*` ist PostgRESTs Platzhalter (wird zu `%`); der Punkt ist bei `like`
    // ein gewöhnliches Zeichen. Bewusst ohne `https://` im Muster — ein `//`
    // im Abfragewert ist eine Fehlerquelle, die nichts einbringt.
    const filter = 'app=eq.berkat&media_url=like.*images.unsplash.com*';
    const find = () => rest(`stories?${filter}&select=id`);

    let total = 0;
    for (let round = 1; round <= 20; round++) {
      const left = await find();
      if (!left?.length) break;
      const ids = left.map((r) => r.id);
      await rest(`stories?id=in.(${ids.join(',')})`, { method: 'DELETE' });
      total += ids.length;
      console.log(`   Runde ${round}: ${ids.length} entfernt`);
    }

    const leftover = await find();
    if (leftover?.length) {
      console.error(
        `\n⚠️ ${total} entfernt, aber ${leftover.length} bleiben übrig.\n` +
          '   Bitte melden — dann ist es kein Zufall, sondern ein Muster.\n',
      );
    } else {
      console.log(`🧹 ${total} Test-Stories entfernt, keine übrig.`);
      console.log('   Die Sicht-Vermerke gehen per ON DELETE CASCADE mit.');
    }
    return;
  }

  const rows = [];
  SETS.forEach((set, i) => {
    const seller = profiles[i % profiles.length];
    set.img.forEach((id, n) => {
      const url = U(id);
      rows.push({
        user_id: seller.id,
        media_url: url,
        // Bei einem Bild ist das Vorschaubild das Bild selbst. Für Videos wäre
        // das falsch (expo-image kann keine .mp4 zeichnen) — hier gibt es keine.
        thumbnail_url: url,
        media_type: 'image',
        archived: false,
        // ⚠️ Ohne diesen Stempel landet die Story in SERLOS Feed. Er ist der
        // ganze Grund, warum `20260823210000` VOR der ersten Zeile Oberfläche
        // kam (Übergabe, Abschnitt 81).
        app: 'berkat',
        created_at: new Date(Date.now() - set.hAlt[n] * 3600 * 1000).toISOString(),
      });
    });
  });

  const made = await rest('stories', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });

  const names = SETS.map((_, i) => profiles[i % profiles.length].username);
  console.log(`✅ ${made.length} Stories angelegt.`);
  console.log(`   Verkäufer: ${names.join(', ')}`);
  console.log(`   Bilder je Verkäufer: ${SETS.map((s) => s.img.length).join(', ')}`);
  console.log('');
  console.log('   ⚠️ Sie laufen nach 24 Stunden aus dem Ring — dann neu laufen lassen.');
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
