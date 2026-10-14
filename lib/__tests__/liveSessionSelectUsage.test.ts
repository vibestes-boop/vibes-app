import fs from 'fs';
import path from 'path';
import { LIVE_SESSION_SELECT } from '../liveSessionSelect';

// Seit 20260814260000 hat `live_sessions` Spaltenrechte statt eines Tabellenrechts
// (die OBS-Zugangsdaten ingress_* sind gesperrt). `select()` ohne Liste,
// `select('*')`, `select('*, profiles!host_id(…)')` und `select=*` verlangen das
// Recht auf JEDE Spalte und scheitern mit 42501 — so waren Live-Liste und
// Zuschauer-Ansicht der App ab dem 14.08.2026 kaputt (gefunden am 14.10.2026).

const ROOT = path.resolve(__dirname, '../..');
const SCAN_DIRS = [
  'app', 'lib', 'components', 'services', 'shared', 'src',
  'apps/web/app', 'apps/web/lib', 'apps/web/components', 'apps/web/hooks', 'apps/web/providers',
];
const SKIP = /node_modules|__tests__|\.next/;

function sourceFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (SKIP.test(rel)) return [];
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

function starSelectsOnLiveSessions(file: string): string[] {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const lineOf = (index: number) => src.slice(0, index).split('\n').length;
  const hits: string[] = [];
  for (const from of src.matchAll(/\.from\(\s*['"`]live_sessions['"`]\s*\)/g)) {
    const start = from.index! + from[0].length;
    let chain = src.slice(start, start + 2000);
    const nextFrom = chain.search(/\.from\(/);
    if (nextFrom >= 0) chain = chain.slice(0, nextFrom);
    const select = chain.match(/\.select\(\s*(\)|['"`]\s*\*)/);
    if (select) hits.push(`${file}:${lineOf(start + select.index!)}`);
  }
  for (const rest of src.matchAll(/live_sessions\?[^'"`\n]*select=\*/g)) hits.push(`${file}:${lineOf(rest.index!)}`);
  // Eingebettet in die Abfrage einer anderen Tabelle: `live_sessions(*)`, `x:live_sessions!fk(*)`
  for (const embed of src.matchAll(/live_sessions(?:![\w]+)?\s*\(\s*\*/g)) hits.push(`${file}:${lineOf(embed.index!)}`);
  return hits;
}

// Ob `authenticated` eine Spalte lesen darf, in Migrationsreihenfolge aus den
// GRANT/REVOKE-Zeilen nachgerechnet, nach Postgres' Regeln (im Wegwerf-Postgres
// geprüft): Ein Tabellenrecht deckt jede Spalte, und ein Spalten-REVOKE ändert
// daran nichts — deshalb blieb ingress_stream_key nach 20260425170000 lesbar.
// Ein Tabellen-REVOKE löscht auch alle Spaltenrechte. Ausgangslage: Supabase
// gibt neue Tabellen in `public` per Default-Privileges an anon/authenticated.
function readableForAuthenticated(): (column: string) => boolean {
  const dir = path.join(ROOT, 'supabase/migrations');
  let table = true;
  const columns = new Set<string>();
  const re = /(GRANT|REVOKE)\s+([^;]*?)\s+ON\s+(?:TABLE\s+)?(?:"?public"?\.)?"?live_sessions"?\s+(?:TO|FROM)\s+([^;]+);/gi;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/--.*$/gm, '');
    for (const [, verb, privileges, roles] of sql.matchAll(re)) {
      if (!/\bauthenticated\b/.test(roles)) continue;
      const grant = verb.toUpperCase() === 'GRANT';
      for (const item of privileges.match(/[^,(]+(?:\([^)]*\))?/g) ?? []) {
        const select = item.trim().match(/^(?:SELECT|ALL(?:\s+PRIVILEGES)?)\s*(?:\(([^)]*)\))?$/i);
        if (!select) continue;
        if (select[1] === undefined) {
          table = grant;
          if (!grant) columns.clear();
          continue;
        }
        for (const col of select[1].split(',').map((c) => c.trim()).filter(Boolean)) {
          if (grant) columns.add(col);
          else columns.delete(col);
        }
      }
    }
  }
  return (column) => table || columns.has(column);
}

it('never reads live_sessions with select() / select("*…") / select=* / live_sessions(*)', () => {
  const hits = SCAN_DIRS.flatMap(sourceFiles).flatMap(starSelectsOnLiveSessions);
  expect(hits).toEqual([]);
});

it('LIVE_SESSION_SELECT only names columns authenticated may read', () => {
  const canRead = readableForAuthenticated();
  expect(canRead('title')).toBe(true);
  expect(canRead('app')).toBe(true);
  expect(canRead('ingress_stream_key')).toBe(false);
  const denied = LIVE_SESSION_SELECT.split(',').filter((col) => !canRead(col));
  expect(denied).toEqual([]);
});
