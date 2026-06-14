#!/usr/bin/env node
/**
 * scripts/schema-drift-check.mjs
 *
 * Findet Code-Spaltenreferenzen, die in der Live-DB NICHT existieren — die
 * Klasse von Bugs, bei der eine ganze Supabase-Query still scheitert (z. B.
 * `.order('follower_count')` auf `profiles`, das diese Spalte nicht hat).
 *
 * Quelle der Wahrheit: supabase/schema_live.sql (pg_dump --schema-only).
 * Neu erzeugen: pg_dump "<uri>" --schema=public --schema-only --no-owner \
 *               --no-privileges -f supabase/schema_live.sql
 *
 * Heuristik: pro Datei wird die zuletzt gesehene `.from('table')` als Kontext
 * geführt; `.order/.eq/.neq/.gt/.lt/.gte/.lte/.contains('col', …)` werden gegen
 * die echten Spalten dieser Tabelle geprüft. Views/RPCs werden übersprungen
 * (deren Spalten lassen sich aus dem Dump nicht zuverlässig ableiten).
 *
 * Exit 1 wenn Treffer → CI-tauglich. Lauf: `node scripts/schema-drift-check.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DUMP = path.join(ROOT, 'supabase/schema_live.sql');

if (!fs.existsSync(DUMP)) {
  console.error(`✗ ${path.relative(ROOT, DUMP)} fehlt — erst pg_dump ausführen (siehe Datei-Header).`);
  process.exit(2);
}

// --- Schema parsen: Basis-Tabellen → Spalten-Set, + View-Namen ---
const sql = fs.readFileSync(DUMP, 'utf8');
const tableCols = new Map();
const tableRe = /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?([a-z_0-9]+)"?\s*\(([\s\S]*?)\n\);/gi;
let t;
while ((t = tableRe.exec(sql))) {
  const cols = new Set();
  for (let line of t[2].split('\n')) {
    line = line.trim().replace(/,$/, '');
    if (!line) continue;
    const first = line.split(/\s+/)[0].replace(/"/g, '');
    if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE|LIKE)$/i.test(first)) continue;
    cols.add(first);
  }
  tableCols.set(t[1], cols);
}
const viewNames = new Set(
  [...sql.matchAll(/CREATE (?:OR REPLACE )?(?:MATERIALIZED )?VIEW (?:public\.)?"?([a-z_0-9]+)"?/gi)].map((m) => m[1]),
);

// --- Code scannen ---
const SCAN_DIRS = ['app', 'lib', 'components', 'apps/web/app', 'apps/web/lib', 'apps/web/components'];
const FILTER_RE = /\.(order|eq|neq|gt|gte|lt|lte|contains)\(\s*['"]([a-z_0-9]+)['"]/g;
const FROM_RE = /\.from\(\s*['"]([a-z_0-9]+)['"]\s*\)/;

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.next') walk(p, acc); }
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const findings = [];
for (const d of SCAN_DIRS) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs, [])) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    let ctx = null; // aktuelle from()-Tabelle
    lines.forEach((line, i) => {
      const fm = line.match(FROM_RE);
      if (fm) ctx = fm[1];
      let m;
      FILTER_RE.lastIndex = 0;
      while ((m = FILTER_RE.exec(line))) {
        const col = m[2];
        if (!ctx) continue;
        if (viewNames.has(ctx)) continue;        // View → Spalten nicht prüfbar
        const cols = tableCols.get(ctx);
        if (!cols) continue;                      // unbekannte Relation (RPC-Result etc.)
        if (!cols.has(col)) {
          findings.push({ file: path.relative(ROOT, file), line: i + 1, table: ctx, col, op: m[1] });
        }
      }
    });
  }
}

if (findings.length === 0) {
  console.log(`✅ Kein Schema-Drift gefunden (${tableCols.size} Tabellen, ${viewNames.size} Views geprüft).`);
  process.exit(0);
}
console.log(`⚠️  ${findings.length} mögliche Drift-Referenz(en) — Spalte existiert nicht auf der Tabelle:\n`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  .${f.op}('${f.col}')  auf  ${f.table}`);
}
console.log('\n(Heuristik: from()-Kontext nächstgelegen. Bei Misch-Queries ggf. Fehlalarm — manuell prüfen.)');
process.exit(1);
