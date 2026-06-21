/**
 * sticker-video render service
 *
 * Nimmt ein Basis-Bild (Foto + Filter + Text, als JPEG hochgeladen) + eine Liste
 * animierter GIPHY-GIF-Sticker (URL + Position/Größe in Basis-Bild-Pixeln) und
 * rendert mit ffmpeg ein kurzes MP4: Foto statisch, Sticker animiert obendrauf.
 *
 * POST /render   (multipart/form-data)
 *   field "base"  → JPEG-Datei (das gerenderte Basis-Bild, Screen-Auflösung)
 *   field "meta"  → JSON-String:
 *      { durationSec?: number,            // 2..10, default 4
 *        stickers: [{ url, x, y, w, h }]  // x,y,w,h in Basis-Bild-Pixeln
 *      }
 *   Header "x-render-secret" (optional, wenn RENDER_SECRET gesetzt)
 *   → 200 video/mp4 (Binärstream)
 *
 * GET /health → { ok: true }
 *
 * ENV:
 *   PORT           (default 8080)
 *   RENDER_SECRET  (optional shared secret; wenn gesetzt, wird Header geprüft)
 */
const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const app = express();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 40 * 1024 * 1024 } });
const SECRET = process.env.RENDER_SECRET || '';
const MAX_STICKERS = 6;

const tmp = (ext) => path.join(os.tmpdir(), crypto.randomUUID() + ext);

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sticker-Download fehlgeschlagen (${res.status})`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { maxBuffer: 64 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error((stderr || err.message).slice(-800)));
      else resolve();
    });
  });
}

app.post('/render', upload.single('base'), async (req, res) => {
  if (SECRET && req.get('x-render-secret') !== SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const cleanup = [];
  const rm = () => cleanup.forEach((p) => { try { fs.existsSync(p) && fs.unlinkSync(p); } catch {} });
  try {
    const basePath = req.file && req.file.path;
    if (!basePath) return res.status(400).json({ error: 'base-Bild fehlt' });
    cleanup.push(basePath);

    let meta = {};
    try { meta = JSON.parse(req.body.meta || '{}'); } catch { return res.status(400).json({ error: 'meta ungültig' }); }
    const stickers = (Array.isArray(meta.stickers) ? meta.stickers : []).slice(0, MAX_STICKERS);
    if (stickers.length === 0) return res.status(400).json({ error: 'keine Sticker übergeben' });
    const dur = Math.min(Math.max(Number(meta.durationSec) || 4, 2), 10);

    // GIFs laden
    const gifPaths = [];
    for (const s of stickers) {
      if (!s || typeof s.url !== 'string' || !/^https?:\/\//.test(s.url)) {
        return res.status(400).json({ error: 'ungültige Sticker-URL' });
      }
      const p = tmp('.gif');
      await download(s.url, p);
      cleanup.push(p);
      gifPaths.push(p);
    }

    const out = tmp('.mp4');
    cleanup.push(out);

    // ffmpeg-Inputs: Basis als Loop-Bild + jeder GIF als Endlos-Loop
    const args = ['-y', '-loop', '1', '-t', String(dur), '-i', basePath];
    gifPaths.forEach((p) => { args.push('-ignore_loop', '0', '-i', p); });

    // filter_complex: jeden Sticker skalieren + nacheinander overlayen
    const filters = [];
    let last = '[0:v]';
    stickers.forEach((s, i) => {
      const w = Math.max(8, Math.round(s.w || 96));
      const h = Math.max(8, Math.round(s.h || 96));
      const x = Math.round(s.x || 0);
      const y = Math.round(s.y || 0);
      filters.push(`[${i + 1}:v]scale=${w}:${h}[s${i}]`);
      const outLabel = i === stickers.length - 1 ? '[v]' : `[t${i}]`;
      filters.push(`${last}[s${i}]overlay=${x}:${y}${outLabel}`);
      last = outLabel;
    });

    args.push(
      '-filter_complex', filters.join(';'),
      '-map', '[v]',
      '-t', String(dur),
      '-r', '24',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      out,
    );

    await runFfmpeg(args);

    res.setHeader('Content-Type', 'video/mp4');
    const stream = fs.createReadStream(out);
    stream.on('close', rm);
    stream.on('error', () => { rm(); if (!res.headersSent) res.status(500).end(); });
    stream.pipe(res);
  } catch (e) {
    rm();
    res.status(500).json({ error: String((e && e.message) || e) });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`sticker-video render service läuft auf :${PORT}`));
