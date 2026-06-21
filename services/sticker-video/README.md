# sticker-video — Render-Dienst (Foto + animierte Sticker → MP4)

Kleiner Node-Dienst, der ein **Basis-Bild** (Foto + Filter + Text) plus eine Liste
**animierter GIPHY-GIF-Sticker** entgegennimmt und mit **ffmpeg** ein kurzes **MP4**
rendert: Foto statisch, Sticker animiert obendrauf. Damit behalten Sticker im
geposteten Beitrag ihre Animation (TikTok-Lösung).

Die App ruft diesen Dienst beim Posten auf, bekommt das MP4 zurück und lädt es als
ganz normalen **Video-Post** hoch.

## API

`POST /render` — `multipart/form-data`
- `base` → JPEG-Datei (das gerenderte Basis-Bild in Screen-Auflösung)
- `meta` → JSON-String:
  ```json
  {
    "durationSec": 4,
    "stickers": [
      { "url": "https://media.giphy.com/.../giphy.gif", "x": 120, "y": 400, "w": 180, "h": 180 }
    ]
  }
  ```
  `x,y,w,h` in **Pixeln des Basis-Bildes**.
- Header `x-render-secret: <SECRET>` (nur wenn `RENDER_SECRET` gesetzt)
- → `200 video/mp4` (Binärstream)

`GET /health` → `{ "ok": true }`

## Env
| Variable | |
|---|---|
| `PORT` | default `8080` |
| `RENDER_SECRET` | optionales Shared-Secret; wenn gesetzt, muss der Header `x-render-secret` passen |

## Lokal testen
```bash
cd services/sticker-video
npm install
node server.js
# in anderem Terminal:
curl -s -o out.mp4 -X POST http://localhost:8080/render \
  -F base=@/pfad/zu/base.jpg \
  -F 'meta={"durationSec":4,"stickers":[{"url":"https://media.giphy.com/media/xxx/giphy.gif","x":100,"y":300,"w":180,"h":180}]}'
open out.mp4   # macOS
```
(ffmpeg muss lokal installiert sein: `brew install ffmpeg`)

## Deployen

### Railway (am einfachsten)
1. railway.app → **New Project → Deploy from GitHub repo** → dieses Repo, Root-Verzeichnis `services/sticker-video`.
   (Railway erkennt das Dockerfile automatisch.)
2. **Variables** setzen: `RENDER_SECRET` = ein langes Zufalls-Token (selbst ausdenken).
3. Nach dem Deploy gibt Railway eine **öffentliche URL** (z.B. `https://sticker-video-production.up.railway.app`).
4. **Diese URL + das RENDER_SECRET an Claude geben** → dann wird die App angebunden (Stufe 2).

### Fly.io (Alternative)
```bash
cd services/sticker-video
fly launch --no-deploy        # erzeugt fly.toml, App-Name wählen
fly secrets set RENDER_SECRET=<dein-token>
fly deploy
```

### Health-Check nach Deploy
```bash
curl https://<deine-url>/health   # → {"ok":true}
```

## Hinweise
- Render dauert je nach Stickergröße ~2–6 s. Die App zeigt solange den Upload-Spinner.
- Ressourcen: 0.5–1 vCPU / 512 MB–1 GB reichen für einzelne Renders. libx264 `veryfast`.
- Kosten: nur Hosting (kein Pro-Render-Preis). Railway/Fly Free/Hobby reicht zum Start.
