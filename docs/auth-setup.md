# Auth-Setup — E-Mail (Resend) + Google-Login

> Stand 22. Juni 2026. Begleitet `lib/useGoogleSignIn.ts` (Code liegt bereit, hinter
> `ENABLE_GOOGLE_LOGIN=false` gated). Google-Login wird erst mit dem nächsten
> EAS-Build live (native Dep `expo-web-browser` + Flag auf `true`).

## Ausgangslage (warum überhaupt)
- **Mobile** kann aktuell nur **E-Mail/Passwort + Apple Sign-In**. Google fehlt.
- **E-Mail-Registrierung ist kaputt** (SMTP/Resend nicht konfiguriert) → echte User
  können sich per E-Mail-Link nicht registrieren.
- Folge: **iOS** = nur Apple; **Android** = aktuell **kein funktionierender Signup-Weg**.
  Da die Zielgruppe stark auf Android ist, ist das vor einem breiteren Launch ein Show-Stopper.
- **Web** kann Google bereits (`apps/web/components/auth/oauth-buttons.tsx`).

Supabase-Projekt-Ref: `llymwqfgujwkoxzqxrlm`

---

## 1. E-Mail fixen mit Resend (dringend · KEIN Build · reine Config)
1. **Domain nötig** (DNS-Zugriff für SPF/DKIM). `serlo-web.vercel.app` reicht nicht.
   Wenn `serlo.ch` noch nicht verfügbar ist, ist das der Blocker. Test-Notlösung:
   Resends `onboarding@resend.dev` (nur an die eigene Adresse).
2. resend.com → Domain hinzufügen → angezeigte DNS-Records setzen → verifizieren → **API-Key** erstellen.
3. Supabase → **Project Settings → Authentication → SMTP Settings** → *Enable Custom SMTP*:
   - Host `smtp.resend.com` · Port `465` · User `resend` · Passwort = **Resend-API-Key**
   - Sender `noreply@<deine-domain>` · Name „Serlo"
4. Register mit E-Mail testen → Bestätigungsmail muss ankommen.

## 2. Google-Cloud-OAuth-Client
1. console.cloud.google.com → Projekt anlegen/wählen.
2. **OAuth consent screen** → *External* → App-Name „Serlo", Support-Mail,
   Scopes `email` + `profile` (im Test-Modus Testnutzer hinzufügen).
3. **Credentials → Create Credentials → OAuth client ID → Typ „Web application"**
   (Web, nicht iOS/Android — Supabase übernimmt den Redirect):
   - **Authorized redirect URI:** `https://llymwqfgujwkoxzqxrlm.supabase.co/auth/v1/callback`
4. **Client-ID + Client-Secret** kopieren.

> Nur ein **Web**-Client nötig (kein nativer iOS/Android-Client), weil der
> Supabase-Redirect-Flow genutzt wird → deutlich simpler.

## 3. Supabase-Provider
1. Supabase → **Authentication → Providers → Google** → *Enable* → Client-ID + Secret → Save.
2. **Authentication → URL Configuration → Redirect URLs** → `vibes://login-callback` hinzufügen.

## 4. Anschalten + Build (wenn 1–3 stehen)
1. `lib/useGoogleSignIn.ts`: `ENABLE_GOOGLE_LOGIN = true`.
2. `app.json`: version + iOS `buildNumber` + Android `versionCode` hochzählen.
3. `npx eas build --platform ios --profile production` (+ android) → `npx eas submit`.
4. Google-Button ist live auf iOS **und Android**.

---

## Technische Notizen (für den nächsten Entwickler)
- **Flow:** `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:'vibes://login-callback', skipBrowserRedirect:true }})` → In-App-Browser (`expo-web-browser` `openAuthSessionAsync`) → Redirect liefert Tokens im URL-**Fragment** (`#access_token=…&refresh_token=…`) → `setSession` → `onAuthStateChange` navigiert.
- **Implicit-Flow** bewusst gewählt (kein globaler `flowType:'pkce'`-Wechsel am Supabase-Client → kein Risiko für E-Mail-/Magic-Link-Flows).
- **OTA-Sicherheit:** `expo-web-browser` wird lazy via `require()` **innerhalb** von `googleSignIn()` geladen + Button gated → auf Build 285 (ohne native Dep) wird das Modul nie berührt, kein Crash.
- **Scheme:** `vibes` (`app.json`) — daher Redirect `vibes://login-callback`.
