# Serlo — Zugriffs- & Konten-Karte

> Interne Ops-Doku. Zweck: Überblick, **welche Dienste** das Projekt nutzt, **wer** Zugang hat und **wo** die Zugangsdaten liegen — für Team-Onboarding, Sicherheit und den Notfall.
> Stand: Juli 2026

> ⚠️ **Diese Datei enthält KEINE Passwörter, Keys oder Tokens — und darf das nie.** Sie sagt nur, *wo* die Geheimnisse liegen (Dashboard, `.env`, Secret-Store), nicht *wie* sie lauten. Echte Werte gehören in einen Passwort-Manager bzw. in die jeweiligen Dashboards, nie in getrackte Dateien.

---

## 1. Dienste-Übersicht

| Dienst | Zweck | Konto / Inhaber | Wo die Zugangsdaten liegen | Kritikalität |
|---|---|---|---|---|
| **GitHub** | Code-Repo `vibestes-boop/vibes-app` | GitHub-Konto | PAT in `.env.local` (`GITHUB_TOKEN`, läuft 26.07.2026) · Repo-Secrets (Telegram) | Hoch |
| **Supabase** | Backend: DB, Auth, Realtime, Storage, Edge Functions (Projekt `llymwqfgujwkoxzqxrlm`) | Org `vibestes@gmail.com` | Anon-/Service-Keys + alle Edge-Function-Secrets im Supabase-Dashboard · App-`.env` | Kritisch |
| **Vercel** | Web-Hosting + Deploy (`serlo-web.vercel.app`) | Vercel-Konto | Env-Vars (u. a. Sentry-DSN) im Vercel-Dashboard | Hoch |
| **Apple Developer / App Store Connect** | iOS-Vertrieb, Zertifikate (Team `Z56MCG424R`, App-ID `6760790424`) | Apple-ID | Signing-Zertifikate + ASC-API-Key (auf EAS gespeichert) | Kritisch |
| **EAS / Expo** | App-Builds + OTA-Updates (Konto `zaurhat`, Projekt `vibes` `02ab536a-…`) | Expo-Konto | Signing-Credentials + ASC-API-Key auf EAS-Servern | Hoch |
| **Cloudflare R2** | Medien-Speicher (Bilder/Videos) | Cloudflare-Konto | R2-Keys als Supabase-Edge-Secrets (`R2_*`) | Hoch |
| **Bunny CDN** | Video-Transcode/HLS + Auslieferung | Bunny-Konto | API-Key | Mittel |
| **LiveKit Cloud** | Live-Streaming (WebRTC) | LiveKit-Konto | `LIVEKIT_URL/API_KEY/SECRET` als Edge-Secrets | Hoch |
| **Stripe** | Web-Zahlungen, physische Ware (Hauptkonto `brandwerkx`, **Test-Modus**) | Stripe-Konto brandwerkx | Keys + Webhook-Secret als Edge-Secrets | Kritisch |
| **RevenueCat** | App-IAP (Coins) | RevenueCat-Konto | API + Webhook-Secret | Mittel (in v1 versteckt) |
| **Sentry** | Fehler/Crash-Monitoring (Org `brandwerkx`, Projekt `javascript-react`) | Sentry-Konto | DSN + Auth-Token (in Vercel + App) | Mittel |
| **OpenAI** | KI-Bildgenerierung | OpenAI-Konto | API-Key als Edge-Secret | Niedrig |
| **UptimeRobot** | Verfügbarkeits-Monitore (3 Stück) | UptimeRobot-Konto | — (nur Monitor-Config) | Niedrig |
| **Telegram (Alert-Bot)** | CI-/Build-Alarme aufs Handy | eigener Bot | Bot-Token + Chat-ID als GitHub-Repo-Secrets | Niedrig |
| **Google Cloud / OAuth** | „Login mit Google", `google-services.json` (Android) | Google-Konto | OAuth-Client-Secrets in Google Cloud Console | Mittel |
| **Domain / DNS** | aktuell nur `serlo-web.vercel.app` (keine eigene Domain) | — | — | Offen |

---

## 2. Wer hat heute Zugang

**Heute: alles Zaur.** Das ist der Bus-Faktor 1 — der größte operative Risikofaktor des Projekts. Wenn Zaur ausfällt, kommt niemand an Backend, Zahlungen, Builds oder Domains.

Beim Team-Aufbau diese Matrix pflegen (Zugriffsstufe pro Person und Dienst eintragen: `voll` / `lesen` / `kein`):

| Person | GitHub | Supabase | Stripe | EAS/Apple | Vercel | Monitoring |
|---|---|---|---|---|---|---|
| Zaur (Gründer) | voll | voll | voll | voll | voll | voll |
| _2. Entwickler_ | voll | voll* | kein | voll | voll | voll |
| _Community-Lead_ | kein | Mod-Tools* | kein | kein | kein | lesen |
| _…_ | | | | | | |

\* Least Privilege: Entwickler brauchen keinen Stripe-**Live**-Zugang; Community/Moderation braucht nur Moderations-Werkzeuge, nicht die volle DB.

---

## 3. Zugriffs-Hygiene (Empfehlungen)

- **Passwort-Manager** für alle Zugänge (1Password / Bitwarden) — heute liegt zu viel verstreut in `.env`-Dateien und Köpfen.
- **2-Faktor-Authentifizierung überall** aktivieren, besonders Apple, GitHub, Supabase, Stripe, Google.
- **Least Privilege:** neue Leute bekommen nur, was sie brauchen. Kein Stripe-Live für Entwickler, keine Voll-DB für Nicht-Technik.
- **Secrets nie in getrackte Dateien** — nur `.env.local` (gitignored) bzw. Dashboards. Der GitHub-PAT ist schon einmal per Screenshot durchgesickert → bei jedem Verdacht **rotieren**.
- **Offboarding-Prozess:** scheidet jemand aus, sofort Zugänge entziehen **und** die Keys rotieren, die er gesehen hat.
- **Backups:** Supabase-DB-Backup-Strategie festlegen und testen (Wiederherstellung üben, nicht nur einrichten).

---

## 4. Notfall / „Break-Glass"

Falls jemand das Projekt übernehmen muss — die Master-Konten, an denen alles hängt:

- **Google-Konto `vibestes@gmail.com`** → steuert Supabase-Org (Backend/DB) und ist der Ausgangspunkt für EAS/Expo.
- **Apple-ID (Team `Z56MCG424R`)** → iOS-Vertrieb, Zertifikate, App Store Connect.
- **`brandwerkx`-Konten** → Stripe (Geld) und Sentry (Monitoring).
- **GitHub `vibestes-boop`** → Code + CI.

Empfehlung: Zugangsdaten dieser Master-Konten + Wiederherstellungs-Codes an einem sicheren, für eine Vertrauensperson erreichbaren Ort hinterlegen (versiegelt/Passwort-Manager-Notfallzugang). Ohne das ist das Projekt bei Ausfall nicht übernehmbar.
