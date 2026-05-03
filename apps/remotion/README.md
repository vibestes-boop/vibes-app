# Serlo Remotion — Video Engine

Automatisch generierte Videos für die Serlo-Community. Drei Compositions, alle 9:16 (1080×1920), bereit für TikTok / Instagram Reels / App Store.

## Schnellstart

```bash
cd apps/remotion
npm install

# Visueller Editor im Browser (localhost:3000)
npm run studio
```

## Compositions

### 1. WeeklyTopGifters — Wöchentliches Leaderboard
- **Länge:** 30s
- **Format:** MP4, 9:16
- **Zweck:** Jeden Montag automatisch rendern + auf Social Media posten

```bash
# Mit Mock-Daten
npm run render:gifters

# Mit echten Supabase-Daten (empfohlen)
npx ts-node scripts/render-weekly.ts
```

Output: `out/weekly-top-gifters.mp4`

---

### 2. AppStorePreview — Feature-Showcase
- **Länge:** 30s
- **Format:** MP4, 9:16
- **Zweck:** App Store / Google Play Preview Video

```bash
npm run render:preview
```

Output: `out/app-store-preview.mp4`

---

### 3. LiveStreamIntro — Branded Host-Intro
- **Länge:** 5s
- **Format:** WebM (für OBS) oder MP4
- **Zweck:** Hosts spielen es als Intro ab wenn sie live gehen

```bash
# Standard (Rot)
npm run render:intro

# Personalisiert mit Host-Name
npx remotion render src/index.ts LiveStreamIntro out/intro-aslanbek.webm \
  --props='{"hostName":"@aslanbek_99","primaryColor":"#F5A623"}'

# Gold-Variante (für Top-Hosts)
npx remotion render src/index.ts LiveStreamIntroGold out/intro-gold.mp4
```

Output: `out/live-stream-intro.webm`

---

## Echtdaten aus Supabase

Für das WeeklyTopGifters-Video:

1. `.env`-Datei anlegen:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

2. Zusätzliche Dependencies installieren:
```bash
npm install @supabase/supabase-js ts-node dotenv @remotion/renderer @remotion/bundler
```

3. Rendern:
```bash
npx ts-node scripts/render-weekly.ts
```

Das Skript holt automatisch die Top 5 Gifter der aktuellen ISO-Woche aus der `live_gifts`-Tabelle.

---

## Automatisierung (Cron / GitHub Actions)

Wöchentlich jeden Montag 08:00 Uhr automatisch rendern:

```yaml
# .github/workflows/weekly-video.yml
name: Weekly Top Gifters Video
on:
  schedule:
    - cron: '0 8 * * 1'  # Jeden Montag 08:00 UTC
jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: cd apps/remotion && npm install
      - run: cd apps/remotion && npx ts-node scripts/render-weekly.ts
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      - uses: actions/upload-artifact@v4
        with:
          name: weekly-video
          path: apps/remotion/out/*.mp4
```

---

## OBS Browser-Source Setup (Live Intro)

1. Render als WebM: `npm run render:intro`
2. In OBS: Quellen → + → Browser-Quelle
3. URL: `file:///path/to/out/live-stream-intro.webm`
4. Autoplay: ✅ / Loop: ❌
5. Auflösung: 1080×1920

Oder: Intro-MP4 als "Medienquelle" hinzufügen, bei Stream-Start triggern.
