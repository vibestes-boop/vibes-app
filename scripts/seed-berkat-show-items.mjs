#!/usr/bin/env node
/**
 * seed-berkat-show-items.mjs — einen kommenden Abend samt Aufgebot anlegen
 *
 * WOZU
 * Seit dem 25.08.2026 ist Show-Ware im Regal, in der Suche und in den
 * Kategorien auffindbar (Übergabe, Abschnitt 88). Prüfen liess sich das an
 * dem Tag nicht: In der Datenbank lagen **null** vorbereitete Artikel und
 * genau ein Berkat-Termin, und der hing seit dem 20.08. auf `live`.
 *
 * Das Skript stellt beides her — einen Termin in der nahen Zukunft und fünf
 * Artikel, die für ihn bereitliegen.
 *
 * ⚠️ ES SCHREIBT IN DIE PRODUKTIV-DATENBANK. Sie ist dieselbe wie Serlos.
 *
 * VERWENDUNG
 *   SERVICE_ROLE_KEY=sb_secret_… node scripts/seed-berkat-show-items.mjs
 *   SERVICE_ROLE_KEY=sb_secret_… node scripts/seed-berkat-show-items.mjs --remove
 *
 * Der Schlüssel steht im Supabase-Dashboard unter Project Settings → API und
 * wird bewusst NICHT in einer Datei abgelegt: Das Repo ist öffentlich.
 *
 * ── ⚠️ DER GRIFF ZUM AUFRÄUMEN ───────────────────────────────────────────────
 *
 * Beide Seiten tragen `[testware] [show]` im Text — die Artikel in der
 * Beschreibung, der Termin im Titel. Der Zusatz `[show]` ist der eigene Griff;
 * `[testware]` steht mit drin, damit `seed-berkat-shop.mjs --remove` diese
 * Zeilen ebenfalls findet und niemand zwei Aufräum-Befehle im Kopf behalten
 * muss.
 *
 * ⚠️ Der Termin wird ZUERST entfernt, die Artikel danach — nicht andersherum.
 * `live_auctions.planned_for` ist `ON DELETE SET NULL` (`20260819110000`):
 * Wer den Termin löscht, verliert damit die einzige Verbindung zu seinen
 * Artikeln, und sie lägen als Waisen in der Datenbank. Das Skript sammelt die
 * Artikel-IDs deshalb VOR dem Löschen des Termins ein.
 *
 * ── WARUM EIN FREMDES KONTO ──────────────────────────────────────────────────
 *
 * Dieselbe Begründung wie im Regal-Seed: Gehört die Ware dem Konto, mit dem man
 * die App ansieht, steht überall „Deins" — und die Glocke („Sag mir Bescheid,
 * wenn der drankommt") erscheint dann nie. Sie ist auf dieser Fläche der
 * einzige Weg, also genau das, was zu prüfen ist.
 *
 * Vorgabe ist das erste Profil, das NICHT `zaur` heisst. Anders wählen:
 *
 *   HOST_USERNAME=berkattest SERVICE_ROLE_KEY=… node scripts/seed-berkat-show-items.mjs
 *
 * ── WARUM DIE HÄLFTE OHNE SOFORTKAUF-PREIS ──────────────────────────────────
 *
 * `buy_now_cents` ist bei Show-Ware NULLBAR (`20260813150000`), und
 * `prepare_live_auction` verlangt ihn nicht. Genau daran hing der Typfehler,
 * den der 25.08. aufgedeckt hat: `Listing.buy_now_cents` behauptete `number`.
 * Eine Testware, in der jeder Artikel einen Sofortkauf-Preis trägt, hätte den
 * Fall nie erzeugt — also trägt hier die Hälfte keinen.
 */

const SUPABASE_URL = 'https://llymwqfgujwkoxzqxrlm.supabase.co';
const KEY = process.env.SERVICE_ROLE_KEY;

/** Steht im Titel des Termins und in jeder Beschreibung. Der Aufräum-Griff. */
const SEED_TAG = '[testware] [show]';

if (!KEY) {
  console.error(
    '\n❌ SERVICE_ROLE_KEY fehlt.\n\n' +
      '   SERVICE_ROLE_KEY=DEIN_KEY node scripts/seed-berkat-show-items.mjs\n\n' +
      '   Der Schlüssel steht im Supabase-Dashboard:\n' +
      '   Project Settings → API Keys → „secret" → Reveal (sb_secret_…)\n',
  );
  process.exit(1);
}

// ⚠️ Header vertragen nur ASCII — wer die Beispielzeile mit dem „…" kopiert,
// bekommt sonst „Cannot convert argument to a ByteString". Dieselbe Prüfung
// wie im Regal-Seed, aus demselben Anlass.
const badChar = [...KEY].find((ch) => ch.charCodeAt(0) > 127);
if (badChar) {
  console.error(
    `\n❌ Der Schlüssel enthält ein Zeichen, das dort nicht hingehört: „${badChar}"\n\n` +
      '   Sieht so aus, als wäre die Beispielzeile kopiert worden, ohne den\n' +
      '   Platzhalter zu ersetzen.\n',
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

/**
 * Was bei einem abgelehnten Schlüssel wirklich zu tun ist.
 *
 * ⚠️ Hier stand zuerst „Ist es der service_role-Schlüssel? Der anon-Schlüssel
 * steht im Dashboard direkt darüber." Am 25.08.2026 hat genau dieser Satz in
 * die falsche Richtung geschickt: Der eingefügte Schlüssel WAR ein
 * service_role-Schlüssel — nur ein **Legacy-JWT**, und die sind für dieses
 * Projekt abgeschaltet.
 *
 * Berkats Supabase-Projekt ist auf die neuen API-Schlüssel umgestellt; die
 * eigene `.env` trägt einen `sb_publishable_…` mit 46 Zeichen. Ein `eyJ…` mit
 * gut zweihundert Zeichen ist deshalb IMMER der alte Weg, egal welche Rolle
 * darin steht — und die Meldung darf nicht nach der Rolle fragen, sondern muss
 * die Bauart nennen.
 *
 * Dieselbe Lehre wie in der Übergabe unter „Eine Fehlermeldung für alles ist
 * keine Fehlermeldung": Ein Hinweis, der zum falschen Ort führt, kostet mehr
 * Zeit als gar keiner.
 */
function diagnose() {
  if (KEY.startsWith('eyJ')) {
    return (
      '   ⚠️ Das ist ein LEGACY-JWT (erkennbar am „eyJ…" und der Länge).\n' +
      '      Dieses Projekt benutzt die NEUEN API-Schlüssel — der anon-Schlüssel\n' +
      '      in apps/berkat/.env heisst „sb_publishable_…". Die alten JWTs sind\n' +
      '      damit abgeschaltet, egal ob anon oder service_role drinsteht.\n\n' +
      '   Gebraucht wird der hier:\n' +
      '      Supabase → Project Settings → API Keys → Abschnitt „secret" → Reveal\n' +
      '      Er beginnt mit „sb_secret_".\n\n' +
      '   ⚠️ NICHT aus dem Abschnitt „Legacy API keys" darunter — von dort\n' +
      '      stammt der, der gerade abgelehnt wurde.'
    );
  }
  if (KEY.startsWith('sb_publishable_')) {
    return (
      '   ⚠️ Das ist der ÖFFENTLICHE Schlüssel (`sb_publishable_…`) — derselbe,\n' +
      '      der in apps/berkat/.env steht. Er umgeht RLS nicht.\n\n' +
      '   Gebraucht wird „sb_secret_…":\n' +
      '      Supabase → Project Settings → API Keys → Abschnitt „secret" → Reveal'
    );
  }
  return (
    '   Prüf zwei Dinge:\n' +
    '   1. Ist es der „sb_secret_…"-Schlüssel? Nur der umgeht RLS.\n' +
    '      Supabase → Project Settings → API Keys → „secret" → Reveal\n' +
    '   2. Ist er vollständig? Beim Kopieren gehen gern Zeichen verloren.'
  );
}

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Der Schlüssel wurde abgelehnt (${res.status}).\n\n` +
          `   Er ist ${KEY.length} Zeichen lang und beginnt mit „${KEY.slice(0, 11)}…".\n\n` +
          diagnose(),
      );
    }
    throw new Error(`${res.status} ${path}\n${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const U = (id) => `https://images.unsplash.com/photo-${id}?w=900&h=1125&fit=crop&q=80`;

// ── Das Aufgebot ────────────────────────────────────────────────────────────
// Fünf Artikel, bewusst uneinheitlich:
//
//   • `buy` gesetzt oder nicht → prüft „ab 1 €" gegen den Sofortkauf-Fall
//   • Startpreise von 1 € bis 20 € → prüft, dass „Günstigste" nach dem
//     WIRKSAMEN Preis sortiert und nicht nach einer 0
//   • zwei mit Grösse, drei ohne → prüft die Meta-Zeile bei Show-Ware
//
// ⚠️ `buy` muss ÜBER `start` liegen, sonst greift der CHECK aus
// `20260813150000` (`buy_now_cents IS NULL OR buy_now_cents > start_price_cents`).
const ITEMS = [
  {
    t: 'Abaya bestickt, dunkelblau',
    start: 100,
    buy: 8900,
    c: 'abaya',
    k: 'neu-mit-etikett',
    s: 'M',
    img: '1591369822096-ffd140ec948f',
  },
  {
    t: 'Teeservice, 6 Gläser mit Untersetzern',
    start: 500,
    buy: null,
    c: 'geschirr',
    k: 'gut',
    s: null,
    img: '1556910103-1c02745aae4d',
  },
  {
    t: 'Silberarmband, punziert 925',
    start: 2000,
    buy: null,
    // Ein BLATT, nicht die Oberkategorie: Der Filter im Regal rollt auf die
    // Eltern hoch (`parentOf` in `shop.tsx`), also prüft ein Kind beide Ebenen
    // auf einmal. Ein Artikel direkt auf `schmuck` hätte nur die eine geprüft.
    c: 'armbaender',
    k: 'sehr-gut',
    s: null,
    img: '1611591437281-460bfbe1220a',
  },
  {
    t: 'Lederjacke braun, weich gefüttert',
    start: 100,
    buy: 12000,
    c: 'herrenmode',
    k: 'gut',
    s: 'L',
    img: '1520975954732-35dd22299614',
  },
  {
    t: 'Gebetsteppich, handgeknüpft',
    start: 1000,
    buy: null,
    c: 'gebetsteppiche',
    k: 'neu',
    s: null,
    img: '1584285405429-136bf988919c',
  },
];

async function main() {
  // ── Wer sendet ────────────────────────────────────────────────────────────
  const wanted = process.env.HOST_USERNAME;
  const profiles = await rest(
    'profiles?select=id,username&username=not.is.null&order=created_at.desc&limit=20',
  );
  if (!profiles?.length) throw new Error('Keine Profile gefunden.');

  const host = wanted
    ? profiles.find((p) => p.username === wanted)
    : profiles.find((p) => p.username !== 'zaur');
  if (!host) {
    throw new Error(
      wanted
        ? `Kein Profil mit dem Benutzernamen „${wanted}" gefunden.`
        : 'Kein fremdes Profil gefunden — es gibt nur „zaur".',
    );
  }

  // ── Aufräumen ─────────────────────────────────────────────────────────────
  if (REMOVE) {
    // ⚠️ ERST die Artikel einsammeln, DANN den Termin löschen. `planned_for`
    // ist ON DELETE SET NULL — nach dem Löschen des Termins wäre die
    // Verbindung weg und die Artikel unauffindbar. Der Beschreibungs-Griff
    // trägt zwar auch allein, aber sich darauf zu verlassen hiesse, die
    // Reihenfolge dem Zufall zu überlassen.
    const items = await rest(
      `live_auctions?select=id&description=ilike.*${encodeURIComponent('[show]')}*`,
    );
    const plans = await rest(
      `scheduled_lives?select=id&title=ilike.*${encodeURIComponent('[show]')}*`,
    );

    if (items?.length) {
      await rest(`live_auctions?id=in.(${items.map((i) => i.id).join(',')})`, {
        method: 'DELETE',
      });
    }
    if (plans?.length) {
      await rest(`scheduled_lives?id=in.(${plans.map((p) => p.id).join(',')})`, {
        method: 'DELETE',
      });
    }

    // Kontrolle am Ende, wie im Regal-Seed: Ein Aufräumen, das schweigend
    // unvollständig bleibt, ist schlimmer als keines.
    const leftItems = await rest(
      `live_auctions?select=id&description=ilike.*${encodeURIComponent('[show]')}*`,
    );
    const leftPlans = await rest(
      `scheduled_lives?select=id&title=ilike.*${encodeURIComponent('[show]')}*`,
    );
    if (leftItems?.length || leftPlans?.length) {
      console.error(
        `\n⚠️ Es bleiben ${leftItems?.length ?? 0} Artikel und ${leftPlans?.length ?? 0} Termine übrig.\n`,
      );
    } else {
      console.log(
        `🧹 ${items?.length ?? 0} Artikel und ${plans?.length ?? 0} Termine entfernt, keiner übrig.`,
      );
    }
    return;
  }

  // ── Der Termin ────────────────────────────────────────────────────────────
  // Zwei Tage voraus: nah genug, dass `formatSlot` einen Wochentag zeigt
  // („Do 20:00") statt eines nackten Datums — und damit genau die Fassung
  // prüft, die auf der Karte steht. Ein Termin in zwei Wochen hätte den
  // häufigsten Fall nicht getestet.
  const when = new Date(Date.now() + 2 * 86_400_000);
  when.setHours(20, 0, 0, 0);

  const [plan] = await rest('scheduled_lives', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      host_id: host.id,
      title: `Probe-Sendung ${SEED_TAG}`,
      scheduled_at: when.toISOString(),
      status: 'scheduled',
      // ⚠️ Ohne den App-Stempel stünde der Termin in SERLOS „Demnächst"-Liste.
      // Fünf geteilte Tabellen brauchten an einem Tag genau diese Spalte
      // (Übergabe, Abschnitt 82, Lehre 1) — `scheduled_lives` ist eine davon.
      app: 'berkat',
      women_only: false,
    }),
  });

  // ── Das Aufgebot ──────────────────────────────────────────────────────────
  // Direkt in die Tabelle statt über `prepare_live_auction`: Die RPC hängt an
  // `auth.uid()`, und mit dem Service-Role-Schlüssel gibt es keine Sitzung.
  // Das Skript bildet nach, was sie tut — dieselbe Begründung wie im
  // Regal-Seed.
  const rows = ITEMS.map((item, n) => ({
    session_id: null,
    planned_for: plan.id,
    seller_id: host.id,
    title: item.t,
    image_url: U(item.img),
    image_urls: [U(item.img)],
    start_price_cents: item.start,
    min_increment_cents: 100,
    buy_now_cents: item.buy,
    status: 'scheduled',
    sort_index: n,
    women_only: false,
    category: item.c,
    condition: item.k,
    size: item.s,
    postal_code: '60313',
    city: 'Frankfurt am Main',
    seller_kind: 'private',
    description: `Kommt in der Sendung dran. ${SEED_TAG}`,
  }));

  const made = await rest('live_auctions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });

  console.log(`✅ Termin „${plan.title}" für ${when.toLocaleString('de-DE')}`);
  console.log(`   Verkäufer: ${host.username}`);
  console.log(`   ${made.length} Artikel vorbereitet, davon ${ITEMS.filter((i) => !i.buy).length} ohne Sofortkauf-Preis.`);
  console.log('\n   Zu sehen: Startseite → „Alle Angebote" — die Karten mit Datum.');
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
