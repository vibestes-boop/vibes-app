#!/usr/bin/env node
// Erzeugt supabase/SCHEMA.md aus supabase/schema_live.sql.
//
// CLAUDE.md nennt dieses Skript seit Juni 2026, im Repo lag es nie — deshalb war
// SCHEMA.md nach dem Neu-Abziehen nicht nachziehbar. Am 14.08.2026 nachgebaut.
//
// Voraussetzung: schema_live.sql ist aktuell. Vollständiges Rezept in CLAUDE.md,
// Regel 10 — kurz: `supabase db dump --dry-run` druckt das pg_dump-Skript nur aus,
// natives pg_dump führt es aus. Kein Docker, kein DB-Passwort nötig.
//
// Zwei Schalter sind dabei Pflicht:
//   --keep-comments   sonst fehlen die `-- Name: …`-Kopfzeilen
//   --no-privileges   das Repo ist ÖFFENTLICH. Mit Rechten trägt der Abzug ~1000
//                     GRANT-Zeilen, also die Landkarte „wer darf was aufrufen".
//                     Genau die hätte am 14.08.2026 `credit_coins → anon` verraten.
//
// Das erzeugte /tmp-Skript enthält ein kurzlebiges Passwort — danach löschen,
// nie committen, nie ausgeben.
//
// Aufruf: node supabase/_ops/schema-md.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'schema_live.sql');
const OUT = join(root, 'SCHEMA.md');

// pg_dump lief mit --quote-all-identifiers: Bezeichner sind gequotet, reservierte
// Typwörter (integer, boolean, timestamp with time zone, double precision) nicht.
const TABLE_START = /^CREATE TABLE (?:IF NOT EXISTS )?"public"\."([^"]+)" \($/;
const COLUMN = /^\s{4}"([^"]+)"\s+(.+?),?$/;

// Alles ab diesen Wörtern gehört zum Default/zur Bedingung, nicht mehr zum Typ.
const TYPE_END = /\s+(?:DEFAULT|NOT NULL|NULL|GENERATED|COLLATE|CONSTRAINT|CHECK|REFERENCES|PRIMARY KEY|UNIQUE)\b.*$/;

function normalizeType(raw) {
  let t = raw.replace(TYPE_END, '').trim().replace(/,$/, '');
  t = t.replace(/"/g, '');                              // "text"[] -> text[]
  t = t.replace(/\s+(with|without) time zone$/i, '');   // timestamp with time zone -> timestamp
  t = t.replace(/^double precision$/i, 'double');
  t = t.replace(/^character varying/i, 'varchar');
  return t;
}

const sql = readFileSync(SRC, 'utf8').split('\n');
const tables = new Map();

for (let i = 0; i < sql.length; i++) {
  const start = sql[i].match(TABLE_START);
  if (!start) continue;

  const cols = [];
  for (let j = i + 1; j < sql.length && !sql[j].startsWith(');'); j++) {
    const line = sql[j];
    if (/^\s{4}CONSTRAINT\b/.test(line)) continue;      // Tabellen-Constraints sind keine Spalten
    const col = line.match(COLUMN);
    if (col) cols.push(`${col[1]} ${normalizeType(col[2])}`);
  }
  tables.set(start[1], cols);
}

const names = [...tables.keys()].sort();
const out = [
  '# Live-Datenbankschema (Source of Truth)',
  '',
  '> Auto-generiert aus `supabase/schema_live.sql` (pg_dump der Live-DB `llymwqfgujwkoxzqxrlm`).',
  `> **${names.length} Tabellen.** Vor jeder Code-Spaltenreferenz hier prüfen — verhindert Bugs wie das fehlende \`profiles.follower_count\`.`,
  '> Neu generieren: Abzug erneuern (siehe Kopf von `supabase/_ops/schema-md.mjs`), dann `node supabase/_ops/schema-md.mjs`.',
  '',
];

for (const name of names) {
  const cols = tables.get(name);
  out.push(`### ${name} (${cols.length})`);
  for (const c of cols) out.push(`- \`${c}\``);
  out.push('');
}

writeFileSync(OUT, out.join('\n'));
console.log(`SCHEMA.md geschrieben: ${names.length} Tabellen, ${[...tables.values()].reduce((n, c) => n + c.length, 0)} Spalten.`);
