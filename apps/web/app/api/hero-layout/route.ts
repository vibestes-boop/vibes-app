import fs from 'node:fs';
import path from 'node:path';

// DEV-ONLY: speichert das Hero-Layout aus dem Hero-Lab nach
// public/hero/hero-layout.json. In Produktion 404 — das finale Hero liest die
// committete JSON-Datei direkt, diese Route existiert dort nicht sichtbar.

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }
  const body = (await req.json()) as {
    preset?: string;
    sun?: { x?: number; y?: number };
    cloud?: number;
    layers?: unknown[];
  };
  if (!body || !Array.isArray(body.layers) || !body.sun) {
    return Response.json({ error: 'invalid_layout' }, { status: 400 });
  }
  const file = path.join(process.cwd(), 'public', 'hero', 'hero-layout.json');
  fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n', 'utf8');
  return Response.json({ ok: true });
}
