import fs from 'fs';
import path from 'path';
import { PROFILE_SELECT } from '../profileSelect';

// Seit 20260814240000 hat `profiles` Spaltenrechte statt eines Tabellenrechts.
// `select()` ohne Liste, `select('*')` und `select=*` verlangen das Recht auf
// JEDE Spalte und scheitern mit 42501 — bei update().select() wird dabei das
// ganze Update zurückgerollt (so ging am 14.10.2026 das Profil-Speichern kaputt).

const ROOT = path.resolve(__dirname, '../..');
const SCAN_DIRS = ['app', 'lib', 'components', 'apps/web/app', 'apps/web/lib', 'apps/web/components'];
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

function starSelectsOnProfiles(file: string): string[] {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const lineOf = (index: number) => src.slice(0, index).split('\n').length;
  const hits: string[] = [];
  for (const from of src.matchAll(/\.from\(\s*['"`]profiles['"`]\s*\)/g)) {
    const start = from.index! + from[0].length;
    let chain = src.slice(start, start + 2000);
    const nextFrom = chain.search(/\.from\(/);
    if (nextFrom >= 0) chain = chain.slice(0, nextFrom);
    const select = chain.match(/\.select\(\s*(\)|['"`]\s*\*)/);
    if (select) hits.push(`${file}:${lineOf(start + select.index!)}`);
  }
  for (const rest of src.matchAll(/profiles\?[^'"`\n]*select=\*/g)) hits.push(`${file}:${lineOf(rest.index!)}`);
  return hits;
}

// Für `authenticated` lesbare Spalten, in Migrationsreihenfolge aus den
// GRANT/REVOKE-Zeilen nachgerechnet — so bleibt der Test an der Datenbank.
function readableForAuthenticated(): Set<string> {
  const dir = path.join(ROOT, 'supabase/migrations');
  const cols = new Set<string>();
  const re = /(GRANT|REVOKE)\s+SELECT\s*\(([^)]*)\)\s*ON\s+(?:TABLE\s+)?public\.profiles\s+(?:TO|FROM)\s+([^;]+);/gi;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/--.*$/gm, '');
    for (const [, verb, list, roles] of sql.matchAll(re)) {
      if (!/\bauthenticated\b/.test(roles)) continue;
      for (const col of list.split(',').map((c) => c.trim()).filter(Boolean)) {
        if (verb.toUpperCase() === 'GRANT') cols.add(col);
        else cols.delete(col);
      }
    }
  }
  return cols;
}

it('never reads profiles with select() / select("*") / select=*', () => {
  const hits = SCAN_DIRS.flatMap(sourceFiles).flatMap(starSelectsOnProfiles);
  expect(hits).toEqual([]);
});

it('PROFILE_SELECT only names columns authenticated may read', () => {
  const readable = readableForAuthenticated();
  expect(readable.has('username')).toBe(true);
  expect(readable.has('push_token')).toBe(false);
  const denied = PROFILE_SELECT.split(',').filter((col) => !readable.has(col));
  expect(denied).toEqual([]);
});
