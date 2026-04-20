# OAuth Provider Setup — Google + Apple

Diese Anleitung aktiviert Google- und Apple-Login für die Serlo-Web-App. Magic-Link funktioniert ohne diese Schritte — OAuth ist optional, aber empfohlen weil es die Conversion-Rate signifikant hebt (keine Email-Warterei für den User).

**Wichtig:** Dieselben Provider-Configs kannst du gleichzeitig für die Native-App nutzen. Das Supabase-Projekt ist geteilt, also muss jeder Provider nur **einmal** konfiguriert werden.

---

## 1. Google OAuth

### Schritt 1 — Google Cloud Console
1. Öffne https://console.cloud.google.com → dein Google-Projekt (oder neues erstellen, z.B. "Serlo Auth")
2. **APIs & Services → Credentials**
3. **+ CREATE CREDENTIALS** → **OAuth client ID**
4. Falls nach Consent Screen gefragt: erst **Configure Consent Screen** — Typ "External", App Name "Serlo", User Support Email eintragen, Scope `email` + `profile` + `openid` hinzufügen
5. Zurück zu Credentials → **OAuth client ID**:
   - Application type: **Web application**
   - Name: "Serlo Web"
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (Dev)
     - `https://serlo.app` (später, wenn Domain steht)
   - **Authorized redirect URIs**:
     - `https://llymwqfgujwkoxzqxrlm.supabase.co/auth/v1/callback`
     - (Das ist die Callback-URL die Supabase selbst handhabt — **nicht** unsere `/auth/callback`-Route)
6. Nach Erstellen: Client-ID + Client-Secret kopieren

### Schritt 2 — Supabase Dashboard
1. https://supabase.com/dashboard/project/llymwqfgujwkoxzqxrlm/auth/providers
2. **Google** aufklappen → Enable
3. Client ID + Client Secret aus Schritt 1 einfügen
4. **Save**

Testen: Im Browser auf http://localhost:3000/login → "Mit Google weiter" klicken → Google-Auth-Flow öffnet sich. Nach Erfolg Redirect zu `/auth/callback` → dann zu `/onboarding` (falls erster Login) oder `/` (falls Profil schon existiert).

---

## 2. Apple Sign-In

Etwas aufwändiger — braucht Apple Developer Account ($99/Jahr).

### Schritt 1 — Apple Developer Portal
1. https://developer.apple.com/account/resources/identifiers/list
2. **Identifiers → + (Add)** → Services IDs → Continue
3. Description: "Serlo Web Auth", Identifier: `app.serlo.web.auth` (oder ähnlich, muss global eindeutig sein)
4. Aktivieren: **Sign In with Apple** → Configure:
   - Primary App ID: `app.serlo` (die Native-App-ID)
   - Domains: `supabase.co` (Wildcard), oder konkret `llymwqfgujwkoxzqxrlm.supabase.co`
   - Return URLs: `https://llymwqfgujwkoxzqxrlm.supabase.co/auth/v1/callback`
5. Save.

### Schritt 2 — Private Key erstellen
1. **Keys → + (Add Key)**
2. Name: "Serlo Auth Key"
3. **Sign In with Apple** aktivieren → Configure → Primary App ID: `app.serlo`
4. Continue → Register
5. **⚠ Key-File (.p8) herunterladen** — nur einmal möglich, sicher ablegen
6. Key ID (10 Zeichen) notieren

### Schritt 3 — Client Secret generieren
Apple verwendet einen JWT als Client Secret, den du aus dem .p8-File generierst. Supabase hat dafür einen eingebauten Generator:

1. https://supabase.com/dashboard/project/llymwqfgujwkoxzqxrlm/auth/providers
2. **Apple** aufklappen → Enable
3. Services ID: das was du in Schritt 1 erstellt hast (z.B. `app.serlo.web.auth`)
4. **Generate Apple Secret** klicken → Felder befüllen:
   - Team ID: dein Apple Team ID (im Developer Portal unter Membership)
   - Key ID: aus Schritt 2
   - Private Key: Inhalt des .p8-Files (komplett einfügen, inkl. `-----BEGIN PRIVATE KEY-----`)
5. Das generierte Secret in das "Secret Key" Feld einfügen
6. **Save**

Testen: `/login` → "Mit Apple weiter" → Apple-Popup → nach Zustimmung Redirect durch den Flow.

---

## 3. Redirect URL für Production

Wenn du später auf `serlo.app` deployst:

1. Google Cloud Console: neue Authorized JavaScript origin + Redirect URI hinzufügen (siehe oben)
2. Apple Developer Portal: neue Return URL in der Services ID ergänzen
3. Supabase: unter **Auth → URL Configuration** die neue Site URL eintragen: `https://serlo.app`
4. Additional Redirect URLs: sowohl `http://localhost:3000/**` als auch `https://serlo.app/**`

---

## 4. Troubleshooting

**"redirect_uri_mismatch"** → Authorized Redirect URIs in Google/Apple Console und Supabase Auth URL Configuration müssen exakt übereinstimmen (inkl. `https://` und Trailing-Slash).

**Apple: "invalid_client"** → meist abgelaufener Client-Secret-JWT. Apple-Secrets laufen alle 6 Monate ab. In Supabase-Dashboard neu generieren.

**"Email not verified"** bei Google → Im Google Consent Screen unter "Scopes" sicherstellen dass `email` dabei ist.

**User landet immer auf /onboarding** → Erwartetes Verhalten bei Erstregistrierung, bis Username gesetzt ist. Nach Username-Claim leitet die `/auth/callback`-Route direkt zum ursprünglichen `?next=...` Ziel.
