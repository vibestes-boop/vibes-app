/**
 * check-bunny-status.mjs — Read-only-Diagnose: Transcode-Status der Bunny-Videos.
 *
 * Liest alle Posts mit bunny_video_id (Service-Role) und fragt für jedes bei
 * Bunny den Encode-Status ab. Zeigt: status (4=Finished, 5=Error), encodeProgress,
 * Auflösung, verfügbare Renditionen, MP4-Fallback. Damit sieht man, ob ein
 * Transcode kaputt/unvollständig ist (Ursache für Schwarz/Grün-Glitch).
 *
 *   node scripts/check-bunny-status.mjs   (Keys aus apps/web/.env.local)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env', '.env.local', 'apps/web/.env.local']) loadEnv(path.join(ROOT, f));

const KEY = env('BUNNY_STREAM_API_KEY');
const LIB = env('BUNNY_LIBRARY_ID') || '685822';
const SUPABASE_URL = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE = env('SUPABASE_SERVICE_ROLE_KEY');
if (!KEY || !SUPABASE_URL || !SERVICE_ROLE) { console.error('Fehlt: BUNNY_STREAM_API_KEY / SUPABASE_URL / SERVICE_ROLE'); process.exit(1); }

const STATUS = { 0: 'Created', 1: 'Uploaded', 2: 'Processing', 3: 'Transcoding', 4: 'Finished', 5: 'Error', 6: 'UploadFailed' };
const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
// ALLE Video-Posts (auch ohne Bunny) — damit man sieht, welche HLS haben und welche nicht.
const { data, error } = await sb.from('posts').select('id, caption, media_type, bunny_video_id, bunny_status').eq('media_type', 'video').order('created_at', { ascending: false }).limit(50);
if (error) { console.error('DB:', error.message); process.exit(1); }
console.log(`${data.length} Video-Post(s):\n`);

for (const p of data) {
  const cap = (p.caption ?? '').replace(/\s+/g, ' ').slice(0, 20);
  if (!p.bunny_video_id) { console.log(`post ${p.id.slice(0, 8)}  "${cap}"  → KEIN bunny_video_id (spielt R2)`); continue; }
  const r = await fetch(`https://video.bunnycdn.com/library/${LIB}/videos/${p.bunny_video_id}`, { headers: { AccessKey: KEY, Accept: 'application/json' } });
  if (!r.ok) { console.log(`post ${p.id.slice(0, 8)}  "${cap}"  guid ${p.bunny_video_id.slice(0, 8)}  → HTTP ${r.status}`); continue; }
  const d = await r.json();
  const res = Array.isArray(d.availableResolutions) ? d.availableResolutions.join(',') : (d.availableResolutions ?? '-');
  console.log(`post ${p.id.slice(0, 8)}  "${cap}"  status=${d.status}(${STATUS[d.status] ?? '?'}) ${d.encodeProgress}%  ${d.width}x${d.height} ${d.length}s  res=[${res}]  db=${p.bunny_status}`);
}

function env(...names) { for (const n of names) { const v = process.env[n]; if (v) return v.trim(); } return ''; }
function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) { let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; }
    }
  } catch { /* optional */ }
}
