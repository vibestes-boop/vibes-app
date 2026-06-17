/**
 * backfill-bunny.mjs — bestehende R2-Videos in Bunny Stream ingesten (HLS/ABR).
 *
 * Wählt Posts (media_type='video', bunny_status IS NULL, öffentliche r2.dev-URL)
 * und lässt Bunny jedes Video aus seiner R2-URL fetchen (Titel "serlo-{postId}"),
 * holt die guid via Titel-Suche und speichert sie (bunny_video_id +
 * bunny_status='pending'). R2 bleibt unberührt — rein additiv, idempotent
 * (Posts mit bunny_status != NULL werden übersprungen).
 *
 * Dry-Run per Default. Erst mit --apply wird wirklich geschrieben/gefetcht.
 * Secrets NICHT committen — inline beim Aufruf setzen:
 *
 *   BUNNY_STREAM_API_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/backfill-bunny.mjs --limit 20           # Vorschau (dry-run)
 *   BUNNY_STREAM_API_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/backfill-bunny.mjs --apply --limit 20   # wirklich ingesten
 *
 * (SUPABASE_URL wird auch aus .env/.env.local gelesen, falls dort vorhanden.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local']) loadEnv(path.join(REPO_ROOT, f));

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args.apply);
const limit = Number.isFinite(+args.limit) && +args.limit > 0 ? Math.floor(+args.limit) : 25;

const SUPABASE_URL     = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE     = env('SUPABASE_SERVICE_ROLE_KEY');
const BUNNY_API_KEY    = env('BUNNY_STREAM_API_KEY');
const BUNNY_LIBRARY_ID = env('BUNNY_LIBRARY_ID') || '685822';

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Fehlt: SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
if (!BUNNY_API_KEY) {
  console.error('Fehlt: BUNNY_STREAM_API_KEY (inline setzen, nicht committen).');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const { data: posts, error } = await sb
  .from('posts')
  .select('id, media_url, created_at')
  .eq('media_type', 'video')
  .is('bunny_status', null)
  .like('media_url', '%.r2.dev/%')
  .order('created_at', { ascending: false })
  .limit(limit);

if (error) { console.error('DB-Fehler:', error.message); process.exit(1); }

console.log(`${posts.length} Video-Post(s) zu ingesten (limit ${limit}). Modus: ${apply ? 'APPLY' : 'DRY-RUN'}`);

let ok = 0, fail = 0;
for (const p of posts) {
  if (!apply) { console.log(`  [dry] ${p.id}  ${p.media_url}`); continue; }
  try {
    const title = `serlo-${p.id}`;
    const fetchRes = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/fetch`,
      {
        method: 'POST',
        headers: { AccessKey: BUNNY_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ url: p.media_url, title }),
      },
    );
    if (!fetchRes.ok) { console.warn(`  ✗ ${p.id} — Bunny fetch ${fetchRes.status}`); fail++; continue; }

    let guid = null;
    const list = await fetch(
      `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos?search=${encodeURIComponent(title)}&itemsPerPage=1&orderBy=date`,
      { headers: { AccessKey: BUNNY_API_KEY, Accept: 'application/json' } },
    );
    if (list.ok) {
      const d = await list.json();
      guid = d.items?.find((v) => v.title === title)?.guid ?? d.items?.[0]?.guid ?? null;
    }

    await sb.from('posts').update({ bunny_video_id: guid, bunny_status: 'pending' }).eq('id', p.id);
    console.log(`  ✓ ${p.id}  guid=${guid ?? '(folgt)'}`);
    ok++;
    await sleep(400); // Bunny-API schonen
  } catch (e) {
    console.warn(`  ✗ ${p.id} — ${e?.message ?? e}`); fail++;
  }
}

console.log(`Fertig. ok=${ok} fail=${fail}${apply ? '' : '  (DRY-RUN — nichts geschrieben; mit --apply ausführen)'}`);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function env(...names) { for (const n of names) { const v = process.env[n]; if (v) return v.trim(); } return ''; }
function parseArgs(a) {
  const o = {};
  for (let i = 0; i < a.length; i++) {
    const t = a[i];
    if (t === '--apply') o.apply = true;
    else if (t === '--limit') o.limit = a[++i];
  }
  return o;
}
function loadEnv(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch { /* Datei optional */ }
}
