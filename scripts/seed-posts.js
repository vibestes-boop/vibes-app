#!/usr/bin/env node
/**
 * seed-posts.js — Bilder als Posts in die Serlo-App hochladen
 * 
 * Verwendung:
 *   SERVICE_ROLE_KEY=sb_secret_xxx node seed-posts.js
 *
 * Bilder aus: ~/Downloads/bilder/
 * Postet als: amir (ID: 754c8a04-8180-4349-95ad-0a874270fd43)
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Konfiguration ──────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://llymwqfgujwkoxzqxrlm.supabase.co';
const SERVICE_ROLE_KEY  = process.env.SERVICE_ROLE_KEY;
const AUTHOR_ID         = '754c8a04-8180-4349-95ad-0a874270fd43'; // amir
const BILDER_DIR        = path.join(os.homedir(), 'Downloads', 'bilder');
const PUBLIC_R2_URL     = 'https://pub-35c122d523ba4396b15392ace804c19b.r2.dev';

// Captions für die Posts (werden der Reihe nach zugewiesen)
const CAPTIONS = [
  'Schöner Moment. 🌿',
  'Ein Blick der bleibt.',
  'Natur pur. 🌲',
  '',  // kein Caption
  'Wolf 🐺',
  'Gedanken im Fluss.',
  '',
  'Klar und ruhig. 🌸',
  null,
];

// ─────────────────────────────────────────────────────────────────────────────

if (!SERVICE_ROLE_KEY) {
  console.error('\n❌ Bitte SERVICE_ROLE_KEY setzen:\n   SERVICE_ROLE_KEY=sb_secret_... node seed-posts.js\n');
  process.exit(1);
}

const SUPPORTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov'];

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
  };
  return map[ext] || 'image/jpeg';
}

async function signR2(key, contentType) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/r2-sign`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ key, contentType }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`r2-sign Fehler (${res.status}): ${txt}`);
  }
  return res.json(); // { uploadUrl, publicUrl }
}

async function uploadToR2(uploadUrl, fileBuffer, contentType) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: fileBuffer,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`R2 Upload Fehler (${res.status}): ${txt}`);
  }
}

async function insertPost(mediaUrl, mediaType, caption) {
  const isVideo = mediaType.startsWith('video');
  const body = {
    author_id:  AUTHOR_ID,
    media_url:  mediaUrl,
    media_type: isVideo ? 'video' : 'image',
    caption:    caption || null,
    tags:       [],
    view_count: 0,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey':        SERVICE_ROLE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Post Insert Fehler (${res.status}): ${txt}`);
  }
  return res.json();
}

async function main() {
  console.log(`\n🚀 Starte Upload aus: ${BILDER_DIR}\n`);

  if (!fs.existsSync(BILDER_DIR)) {
    console.error(`❌ Ordner nicht gefunden: ${BILDER_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(BILDER_DIR)
    .filter(f => SUPPORTED_EXTS.includes(path.extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.error('❌ Keine Bilder/Videos gefunden.');
    process.exit(1);
  }

  console.log(`📁 ${files.length} Datei(en) gefunden:\n`);
  files.forEach(f => console.log(`   • ${f}`));
  console.log('');

  let ok = 0, fail = 0;

  for (let i = 0; i < files.length; i++) {
    const file     = files[i];
    const filePath = path.join(BILDER_DIR, file);
    const mimeType = getMimeType(filePath);
    const ext      = path.extname(file).toLowerCase().replace('.', '');
    const isVideo  = mimeType.startsWith('video');
    const folder   = isVideo ? 'videos' : 'images';
    const key      = `posts/${folder}/${AUTHOR_ID}/${Date.now()}-${i}.${ext}`;
    const caption  = CAPTIONS[i % CAPTIONS.length];

    process.stdout.write(`[${i + 1}/${files.length}] ${file} ... `);

    try {
      // 1. Presigned URL holen
      const { uploadUrl, publicUrl } = await signR2(key, mimeType);

      // 2. Datei einlesen
      const fileBuffer = fs.readFileSync(filePath);

      // 3. Zu R2 hochladen
      await uploadToR2(uploadUrl, fileBuffer, mimeType);

      // 4. Post in DB anlegen
      const mediaUrl = publicUrl || `${PUBLIC_R2_URL}/${key}`;
      await insertPost(mediaUrl, mimeType, caption);

      console.log('✅');
      ok++;

      // Kurze Pause zwischen Uploads
      await new Promise(r => setTimeout(r, 300));

    } catch (err) {
      console.log(`❌ ${err.message}`);
      fail++;
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`✅ Erfolgreich: ${ok}  ❌ Fehler: ${fail}`);
  console.log(`\nFeed neu laden in der App um Posts zu sehen!\n`);
}

main().catch(err => {
  console.error('\n💥 Unerwarteter Fehler:', err.message);
  process.exit(1);
});
