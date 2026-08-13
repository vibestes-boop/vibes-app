# berkat-web

Vier statische Seiten. Kein Bauwerkzeug, kein Framework, keine Abhängigkeiten —
was hier liegt, wird genau so ausgeliefert.

| Datei | Adresse | Wofür |
|---|---|---|
| `index.html` | `/` | Was Berkat ist. Später der Platz für Impressum, Widerruf, Datenschutz |
| `bezahlt.html` | `/bezahlt` | Stripe schickt den Käufer nach erfolgreicher Zahlung hierher |
| `abgebrochen.html` | `/abgebrochen` | Dasselbe, wenn er die Kasse verlässt |
| `live.html` | `/live/<id>` | Landeseite fürs Teilen. Liest die Show-Kennung aus dem Pfad und bietet `berkat://live/<id>` an |

`_redirects` schreibt jeden `/live/*`-Pfad auf `live.html` um, mit Status 200 —
die Adresse muss stehen bleiben, sonst wäre die Kennung weg.

## Warum eine eigene Seite

Zwei Gründe, beide handfest:

1. **Der Teilen-Link zeigte ins Leere.** `apps/berkat/app/live/[id].tsx` teilt
   `https://berkat.app/live/<id>`. Die Domain hatte keinen A-Eintrag — jede
   geteilte Show war ein toter Link.
2. **Nach dem Bezahlen stand die falsche Marke in der Adresszeile.** Berkat-Käufer
   landeten auf `serlo.ch/shop/success`, der Bestätigung des Parfüm-Verkaufs.

## Veröffentlichen

Die Domain liegt bereits auf Cloudflare-Nameservern.

```bash
npx wrangler pages deploy /Users/zaurhatuev/vibes-app/apps/berkat-web --project-name berkat
```

Danach im Cloudflare-Dashboard unter *Workers & Pages → berkat → Custom domains*
sowohl `berkat.app` als auch `www.berkat.app` verbinden. **Der Apex ist der
wichtige** — dorthin zeigen die Teilen-Links.

## Erst danach die Bezahl-Seite umstellen

`create-checkout-session` schickt Berkat-Bestellungen nur dann auf diese Seite,
wenn die beiden Variablen gesetzt sind. Ohne sie bleibt alles wie bisher. Das ist
Absicht: Eine tote Seite direkt nach dem Bezahlen wäre schlimmer als eine mit der
falschen Marke.

```bash
supabase secrets set BERKAT_SUCCESS_URL=https://berkat.app/bezahlt BERKAT_CANCEL_URL=https://berkat.app/abgebrochen
```

```bash
supabase functions deploy create-checkout-session
```

Kein `--no-verify-jwt` — diese Function liest das Konto des Anrufers und braucht
die Prüfung. Nur die Webhooks (`stripe-webhook`, `revenuecat-webhook`) dürfen ohne.

## Später: Links direkt in der App öffnen

Sobald Berkat im Store ist, machen zwei Dateien aus den Links echte App-Links —
Antippen öffnet dann die App statt des Browsers:

- `.well-known/apple-app-site-association` (braucht die Team-ID, Bundle
  `com.berkat.app`)
- `.well-known/assetlinks.json` (braucht den Signatur-Fingerabdruck, Paket
  `app.berkat.market`)

Beides erfordert zusätzlich einen neuen Build mit `associatedDomains`.

## Örtlich ansehen

```bash
python3 -m http.server 4610 --directory /Users/zaurhatuev/vibes-app/apps/berkat-web
```

Die `_redirects` greifen dabei nicht — `/live/<id>` gibt es nur nach dem
Veröffentlichen, örtlich `live.html` direkt aufrufen.
