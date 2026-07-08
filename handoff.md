# Handoff — Serlo/Vibes (Stand 8. Juli 2026 · Session 10)

> 📍 **Dieses Dokument: `/Users/zaurhatuev/vibes-app/handoff.md`**
> Arbeite NUR in diesem Repo: **`/Users/zaurhatuev/vibes-app`** (Branch `main`).
> ⚠️ NICHT die Quarantäne-Kopie `/Users/zaurhatuev/Desktop/vibes-app` — NIEMALS lesen/bauen/pushen.
>
> Übergabe für den Wechsel in einen neuen Chat. Gedächtnis-Dateien
> (`~/.claude/.../memory/`) laden automatisch — dieses Doku ergänzt sie mit Session-Detail.
> **Strategie/Finanz-Plan liegt im Brain** (gbrain): `decisions/2026-06-27-serlo-finanz-architektur`,
> `decisions/2026-06-27-serlo-monetarisierung-roadmap`, `decisions/2026-06-28-serlo-finanz-backlog`
> (Restposten + Einnahmequellen 4-8: was geht / blockiert / Schritte), `outputs/2026-06-27-serlo-geld-premortem`.

---

## 🚀 Neue Sitzung — Start hier

- **Stand:** Session 10 (7.–8. Juli) = **3 App-Store-Ablehnungen durchgearbeitet → Build 291 hochgeladen** (alle 5 Apple-Punkte gefixt), **echte Block-Durchsetzung** (Server-Trigger), **Konto-Löschung repariert** (war komplett kaputt: Function nie deployt + FK-Konflikte), **Push-Token-Fix** (alter Account bekam nach Wechsel weiter Pushes), **Web-OAuth-PKCE-Fix**, **serlo.ch verbunden**, und ein **großer i18n-Russisch-Sprint** (kompletter öffentlicher Web-Kern de+ru). Alles committed + gepusht + verifiziert. Letzter Commit **`6a84b26`**.
- **🔴 UNMITTELBAR OFFEN (hier weitermachen):**
  1. **ASC-Resubmit prüfen/machen:** Build **291** ist hochgeladen + Antwort an Apple gepostet. In ASC auf der Versionsseite sicherstellen, dass **Build 291** (nicht 287/289) angehängt ist → **„Erneut zur App-Prüfung übermitteln"**. Details zu allen 5 Fix-Punkten in §1.0.3-A.
  2. **serlo.ch fertig verdrahten:** (a) Supabase → Auth → URL Configuration → Redirect-URLs `https://www.serlo.ch/**` + `https://serlo.ch/**` ergänzen (sonst bricht Login auf der neuen Domain). (b) `WEB_BASE` in `lib/webLinks.ts` + ~13 Web-Stellen von `serlo-web.vercel.app` auf `https://www.serlo.ch` umstellen (Share-Links) + OTA. Aktuell: www = primär, Apex = 308-Redirect, SSL ✓.
  3. **i18n-Russisch fortsetzen (optional):** Rest = Shop-Listen-Details (Filter-Sidebar), Messages-/Studio-/Live-Tiefe, `components/layout/more-menu.tsx`; später ru-Keys nach ce/en spiegeln. Methode + Stand in §1.0.3-D.
  4. **Impressum-Entscheidung (Zaur):** Name + ladungsfähige Adresse sind Pflicht (§5 DDG, Einzelunternehmer). Optionen: brandwerkx-Marke + brandwerkx.de ERGÄNZEN (Name bleibt) oder Geschäftsadresse mieten (Privatadresse raus). Bis Entscheidung: Impressum/Datenschutz NICHT anfassen.
- **⚠️ OTA-Falle (weiter gültig):** OTA greift erst beim **2. Kaltstart**. `EAS_BUILD=1` zwingend.
- **⚠️ Apple-Review-Learnings (Session 10):** (1) Purpose-Strings brauchen KONKRETES Beispiel („zum Beispiel um …"). (2) „Blockieren" muss WIRKLICH durchgesetzt sein — Apple testet es. (3) IAPs nur einreichen, wenn in der App auffindbar (Coin-Shop ist per Flag versteckt → IAPs aus Submission entfernt). (4) Apple-Provider in Supabase aktivieren nicht vergessen (Client-ID = Bundle-ID `com.vibesapp.vibes`, kein Secret nötig für native).
- **Realer Kontext:** Parfüm läuft offline, 80 Flaschen in Lieferung. Premortem: erst validieren, dann bauen.
- **Git-Push:** via PAT aus `.env.local` (§4). Immer mit `git ls-remote` verifizieren.

---

## 0. Schnell-Status

| Bereich | Stand |
|---|---|
| **Repo / Branch** | `/Users/zaurhatuev/vibes-app` · `main` · Working Tree **sauber** |
| **Letzter Commit** | `6a84b26` — i18n Notification-Texte + Landing. **Alle Session-10-Commits gepusht & verifiziert.** |
| **Web (apps/web)** | Vercel auf Push zu `main`. **Live: `https://www.serlo.ch`** (Apex 308→www, SSL ✓) + weiterhin `serlo-web.vercel.app`. ⚠️ Code-Links (`WEB_BASE`) zeigen noch auf vercel.app → Umstellung offen (Start-hier #2). Sentry-Web aktiv + **Build bricht bei Sentry-Ausfall nicht mehr ab** (errorHandler in next.config.mjs). |
| **App-Build** | v1.30.0 / iOS-**Build 291** — **in ASC hochgeladen, Resubmit ggf. noch auszulösen** (Start-hier #1). Enthält: Location-Key raus, neue Kamera/Foto-Purpose-Strings, Block-Client-Filter, Logout-Fix. Runtime 1.30.0. |
| **Letzter OTA** | Commit `3302dbf`-Reihe (Block-Filter, Logout-Fix, Konto-Lösch-Fehlerbehandlung, Push-Token-Cleanup) — alle Runtime 1.30.0, greifen beim 2. Kaltstart. |
| **Edge Functions deployed** | Wie Session 9 **plus**: `send-push-notification` (kennt `support_new`), **`delete-account` (war NIE deployt → 404 → jetzt live!)**. Deploy: `npx supabase functions deploy <name> --project-ref llymwqfgujwkoxzqxrlm`. |
| **DB-Migrationen** | ✅ **ALLE ausgeführt** (Zaur). Neu Session 10: `20260705150000_support_new_admin_notification`, `20260707000000_block_enforcement`, `20260707120000_fix_account_deletion_fks`, `20260707140000_push_token_single_owner`. **Keine offene Migration.** |
| **GERADE FERTIG (Session 10)** | **App-Store-Fix-Marathon → Build 291** (§1.0.3-A) · **Block-Durchsetzung echt** (§1.0.3-B) · **Konto-Löschung + Push-Token + Web-OAuth repariert** (§1.0.3-B/C) · **serlo.ch live** (§1.0.3-C) · **i18n-Russisch: kompletter öffentlicher Web-Kern** (§1.0.3-D) · Admin-Gegen-Loop `support_new` · Video-Spinner-Fix `/p`. |
| **🔴 NÄCHSTE AUFGABE** | **(1)** ASC: Build 291 anhängen + erneut einreichen. **(2)** serlo.ch: Supabase-Redirects + WEB_BASE. **(3)** i18n-Rest / ce+en-Nachzug. **(4)** Impressum-Entscheidung. |
| **Monitoring** | Unverändert bewacht (UptimeRobot, Sentry App+Web, Telegram-CI, Stripe-Mails). CI-Baseline **0**; Root-tsc jetzt komplett 0 (alte rose-Fehler weg). |
| **Admin** | Zaur (`username='zaur'`, `is_admin=true`, `zaurhatu@gmail.com`, id `46c70dfb…`). ⚠️ `auth.uid()` im SQL-Editor NULL. |

⚠️ **Quarantäne:** `/Users/zaurhatuev/Desktop/vibes-app` — NIEMALS bauen/deployen/pushen.

---

## 1.0.3 🆕 Session 10 (7.–8. Juli) — App-Store-Fix-Marathon · Block/Löschung/Push repariert · serlo.ch · i18n-Russisch

> Alles committed + gepusht + verifiziert (`6a84b26`), mehrere OTAs raus (Runtime 1.30.0),
> 4 Migrationen ausgeführt, 2 Edge-Functions deployt.

### A) App-Store: 3 Ablehnungen → Build 291 (alle 5 Punkte gefixt)
- **Reject 1 (Build 287):** 5.1.1 Location-Purpose-String („von Bibliothek referenziert, nicht genutzt" = rot) + 1.2 UGC. Fix: `NSLocationWhenInUseUsageDescription` KOMPLETT entfernt (App nutzt keinen Standort) → Build 288. UGC (EULA vor Register + Melden + Blockieren) existierte — Nachweis per **Screen-Recording** (Register-EULA-Text zeigen reicht, KEIN Checkbox nötig) + engl. Review-Notes; Video an Apples Nachricht angehängt.
- **Dabei entdeckt: Blockieren war NICHT durchgesetzt** (nur `user_blocks`-Insert, nichts las ihn) → komplette Durchsetzung gebaut (→ B) → **Build 289** statt 288 eingereicht.
- **Reject 2 (Build 289):** (a) **2.1(a) Apple-Sign-In kaputt** — Ursache NICHT App-Code, sondern **Supabase: Apple-Provider war nicht aktiviert**. Fix: Dashboard → Auth → Providers → Apple AN + Client-ID `com.vibesapp.vibes` (= Bundle-ID; kein Secret für native nötig). (b) **5.1.1 Kamera/Foto-Strings zu vage** → neue Texte MIT Beispiel („… zum Beispiel um ein kurzes Video aufzunehmen und in deinem Feed zu posten") in `app.json` infoPlist **UND** in den Plugins (react-native-vision-camera, expo-media-library — Plugins überschreiben infoPlist beim Prebuild!) + `NSPhotoLibraryAddUsageDescription` ergänzt → Build 290. (c) **2.1(b) IAP nicht auffindbar** (Coin-Shop per Flag versteckt) → Zaur hat die 4 Coin-IAPs aus ASC **gelöscht** (v1 ohne IAP, kein Paid Apps Agreement nötig).
- **Bonus-Bug beim Testen: Logout hing ewig im „wird geladen…"-Screen.** Ursache: `authStore.signOut` setzte `initialized:false`, aber nichts setzte es je wieder true (getSession-Effekt nur beim Mount, onAuthStateChange ohne). Fix: initialized beim Logout auf true lassen → AuthGuard leitet zu /login. → **Build 291** (hochgeladen + Auto-Submit, Antwort an Apple gepostet).
- **⚠️ STATUS: In ASC prüfen, dass die Version Build 291 trägt, dann „Erneut zur App-Prüfung übermitteln".** Die Übermittlungs-Detailseite zeigt so lange „Abgelehnt" (alter 289-Status), bis neu eingereicht ist.

### B) Sicherheits-/Integritäts-Fixes (Migrationen ✅ ausgeführt)
- **Block-Durchsetzung** (`20260707000000_block_enforcement`): `users_blocked(a,b)`-Helper + `get_blocked_user_ids()` (SECURITY DEFINER, beide Richtungen trotz RLS); `block_user()` löscht bestehende gegenseitige Follows; BEFORE-INSERT-**Trigger** auf `follows`/`conversations`/`messages`/`comments` (Exception `'blocked'`). Client (OTA + Binary 291): `getBlockedIdSet()` (60s-Cache in `lib/useBlock.ts`) blendet geblockte Autoren in Feed (`usePosts`), Kommentaren (`useComments`) und Konversationsliste (`useMessages`) beidseitig aus — Feed-v5-RPC bewusst NICHT angefasst. Block/Unblock invalidiert Caches.
- **Konto-Löschung war komplett kaputt** — 3 Ursachen: (1) Edge-Function `delete-account` war **NIE deployt** (App bekam 404, `catch{}` verschluckte ihn und loggte trotzdem aus → „gelöscht" gelogen, Auth-User blieb). → **deployt**. (2) FK-Konflikte brachen den Cascade: `orders.buyer_id`/`seller_id` (SET NULL auf NOT-NULL!) + `live_moderators.user_id`/`granted_by` + `live_reports.reporter_id` (NO ACTION) → `20260707120000_fix_account_deletion_fks` stellt alle 5 auf CASCADE (voller Audit aller profiles-FKs gemacht — nur diese 5 waren betroffen). (3) App zeigt jetzt echte Fehler und loggt nur bei Erfolg aus (settings.tsx, OTA). **Getestet: funktioniert**; Geister-Accounts lassen sich jetzt auch in Supabase manuell löschen.
- **Push-Token-Leck** (`20260707140000_push_token_single_owner`): Account A bekam nach Wechsel auf B weiter Pushes (Token blieb bei A in `profiles.push_token` + `push_tokens`). Trigger erzwingen **„ein Token = ein User"** (Zuweisung entfernt ihn bei allen anderen); `authStore.signOut` löscht eigene Registrierung (OTA). Getestet ✓.
- **Admin-Gegen-Loop** (`20260705150000_support_new_admin_notification`): `create_support_thread` pingt alle `is_admin`-Profile mit neuem Typ `support_new` (+ Push, kein Pref-Gate). `send-push-notification` neu deployt; App/Web-Renderer + Deep-Link → `/admin/support`.

### C) Web-Fixes + serlo.ch
- **OAuth-PKCE-Login gefixt** (`oauth-buttons.tsx`): „PKCE code verifier not found" — OAuth wurde in einer **Server-Action** gestartet, der Verifier-Cookie ging beim Provider-Redirect verloren. Jetzt client-seitig via Browser-Client → Google/Apple-Web-Login funktioniert. (Magic-Link cross-device bleibt bekannte Grenze — same-browser ok.)
- **Profil-Menü blieb nach Web-Konto-Löschung sichtbar** (`app/actions/gdpr.ts`): `signOut()` (global) scheiterte am toten Token → Cookies blieben. Fix: `signOut({ scope: 'local' })`.
- **Video-Spinner-Fix** (`components/video/video-player.tsx`): `/p`-Video hing ewig im Lade-Spinner (State verließ `loading` nur via onPlaying — feuert bei autoPlay=false nie). Neuer `ready`-State via onLoadedMetadata/onCanPlay.
- **Sentry-Build-Guard** (`next.config.mjs` errorHandler): Sentry-504 beim Source-Map-Upload riss vorher den ganzen Vercel-Deploy ab → loggt jetzt nur noch.
- **serlo.ch verbunden:** Vercel-Projekt `serlo-web` → Domains: `serlo.ch` (308→www) + **`www.serlo.ch` = primär**, SSL ✓. IONOS-DNS: A `@`→`216.198.79.1`, AAAA gelöscht, CNAME `www`→`959bb6a28b278edb.vercel-dns-017.com`. Mail-Records (MX/SPF/DKIM) unangetastet. **OFFEN:** Supabase-Redirect-URLs + `WEB_BASE`-Umstellung (Start-hier #2).
- **Impressum-Recht (kein Rechtsrat, aber klar):** §5 DDG verlangt echten Namen + ladungsfähige Anschrift (Einzelunternehmer). „brandwerkx" darf ERGÄNZEN, nicht ersetzen; Adresse nur durch gemietete Geschäftsadresse ersetzbar. Zaur entscheidet.

### D) i18n-Russisch-Sprint — kompletter öffentlicher Web-Kern de+ru
- **Infra zuerst** (`lib/i18n/translate.ts` + messages/index + server/client): `DeepPartial<Messages>` + **Deutsch-Fallback im Resolver** — ru/ce/en dürfen partiell sein, fehlende Keys zeigen Deutsch statt roher Key-Strings. Deutsch bleibt strikt (Source of Truth). Locale-Wechsel: Avatar-Menü → Sprache (Cookie `serlo-locale`).
- **Komplett de+ru (alle im Preview verifiziert):** `/shop/[id]` (Shell + BuyBar + Beschreibung + Reviews) · `/p` (100 % inkl. Kommentar-System, Follow-Button, Actions-Bar, Share-Buttons, beide 3-Punkte-Menüs, Datum locale-aware) · `/u` (100 % inkl. Tabs/Sort/Empty-States, Tip-Button „Поддержать", Block-/Melde-Menü, Highlights) · **Cookie-Banner** · **Feed komplett** (feed-card ~46 Strings, feed-list, home-feed-shell, feed-sidebar via labelKey-Pattern, comments-body, post-share-dm-sheet, followed-accounts, voice-reader, story-strip [Server: getT+Props], like-button, comment-panel/-sheet, admin-nav-link) · **Explore-Details** (Sort-Pills, Trends-Empty, WOZ, Discover-Badges) · **Notification-Drawer + alle ~30 Notification-Texte** (notifText(n, t)) · **Landing-Page** („Эфиры. Магазин. Комьюнити.").
- **Muster für Fortsetzung:** Modul-Konstanten → `labelKey: TranslationKey` + `t()` am Renderpunkt; Server-Komponenten → `getT()` (Sub-Komponenten kriegen Labels als Props); Client → `useI18n()`; Melde-Gründe via `t(\`ns.reason_${value}\` as TranslationKey)`; useCallback-deps um `t` ergänzen. Neue Keys IMMER de (strikt) + ru; ce/en fallen zurück.
- **Bugfix nebenbei:** Profil-Melde-Dialog-Submit war TOT (`onClick={void handleReport}` ≡ undefined) → gefixt (auch UGC-relevant).
- **OFFEN:** Shop-Listen-Details (Filter-Sidebar `/shop`), Messages-/Studio-/Live-Tiefe, `components/layout/more-menu.tsx`; ru-Keys später nach ce/en spiegeln. Metadata/OG bleibt bewusst de (Crawler senden keinen Locale-Cookie).
- **Verifikations-Grenze:** Feed/Notifications sind login-only → headless nicht prüfbar; Zaur prüft eingeloggt (Sprache: Русский). Öffentliche Flächen wurden per Preview + Screenshot verifiziert.

---

## 1.0.4 🆕 Session 9 (5. Juli) — App-Store-Einreichung · Admin-Command-Center-Ausbau · In-App-Support

> Alles committed + gepusht + verifiziert, viele OTAs raus (Runtime 1.30.0).
> Commit-Kette grob: `07fba46 → 2462477` auf `main`.

### A) App-Store Build 287 gebaut + eingereicht (Zaurs Hauptziel — durch!)
- `app.json` buildNumber 286 → **287** (Version 1.30.0 gelassen; runtimeVersion `appVersion` → OTA-Runtime bleibt 1.30.0). `eas build --platform ios --profile production --auto-submit` von `main`. Signing + ASC-API-Key lagen auf EAS. Build fertig, Auto-Submit lief.
- **ASC-Screenshots via PIL gerahmt**: WhatsApp-Rohbilder (1206×2622 = iPhone 16 Pro) auf 1320×2868 (6,9") + 1284×2778 (6,5") Leinwand mit Caption gerahmt — Skript + Assets in `~/Downloads/serlo-store/` (`frame.py`, `out/`, `out65/`). Home/Clan/Shop/Profil + 2 Live-Mockups. Ton „schlicht & ehrlich" (Zaur-Wahl), neutraler Dark-BG (kein Lila).
- Review-Notes (Demo-Account `brandwerkx+applereview@gmail.com`), Privacy-Labels, 17+ — Zaur ausgefüllt → **eingereicht 5.7. 2:12, „Warten auf Prüfung"**.

### B) Editor-Glas + Profil-Tabs + Swipe-Fixes (Mobile, OTA'd)
- **Editor-Bottom-Sheets** (Filter/Anpassen/Drehen/Sticker/Kürzen/Details) auf theme-aware Glas via geteilter Quelle `components/create/editor/sharedStyles.tsx` (`GlassSheet` + `useEditorSheet()`, Primär-CTA Marken-Lila `accent.secondary`, Innen-Inhalt mit-konvertiert wg. Light-Mode). Werkzeug-Rail/Crop/Cover bleiben bare. Memory `vibes-create-glass-surface` aktualisiert.
- **Profil-Tabs icon-only** (`UserProfileContent.tsx`, alle Profile — ProfileListHeader war schon icon-only).
- **Home-Profil-Swipe-Fix** (`app/(tabs)/index.tsx`): `!profilePanelRef.current`-Guard in `swipePan` — auf offenem Profil öffnet Links-Wisch nicht erneut. **Clan-Detail-Profil-Swipe** neu gebaut (`app/guild-post/[id].tsx`, Parität mit Home).

### C) Admin-Löschen fremder Posts + der metadata-Bug (Mobile+Web)
- Löschen war autor-gebunden (`delete_post` + RLS). Neue RPC **`admin_remove_post(post_id, grund)`** (is_admin-gated, protokolliert, schließt offene Meldungen). UI: „Entfernen (Admin)" im PostShareModal (Mobile), Feed-Karten-More-Menü + Post-Detail-Menü (`post-viewer-menu.tsx`, Web).
- **🔴 Wichtiger Bug**: `admin_audit_log` hat Spalte **`metadata`**, nicht `details`. `admin_remove_post` UND `admin_enforce_content_report` schrieben nach `details` → Laufzeitfehler rollte alles zurück → **Löschen/Enforce/Nutzer-Aktionen waren still blockiert**. Fix: `20260705130000_admin_audit_metadata_fix` (beide RPCs auf `metadata`). Merke: neue audit-log-Inserts IMMER `metadata`.

### D) Command-Center-Ausbau (`/admin/command-center`)
- **Erkenntnis**: Panel war viel vollständiger als gedacht — Reports-Enforce (Post entfernen/Profil sperren/beschränken/Shadowban/Live-Mute) und Nutzer-Aktionen (Bann/Verify/Admin/Restrict) waren **schon gebaut**, nur durch den metadata-Bug blockiert.
- **4 Daten-Bugs** (`app/actions/admin.ts`): Live-Aktivität zeigte nie Kommentare (`comments.content` → echte Spalte `text`); Report-Kategorien passten nicht (Taxonomie an echte Gründe spam/harassment/inappropriate/fake/other); `not_interested` verschmutzte Moderations-Queue/Kategorien/Meldungen (in Readern + `getAdminReports` gefiltert); Release-Kachel fake-grün → ehrlich.
- **4 tote Sidebar-Platzhalter** (zeigten aufs Dashboard) als **echte Seiten** gebaut: `/admin/{live-feed,content,analytics,security}` auf Basis des Snapshots + geteilte `components/admin/section-ui.tsx`. Nav umgehängt, „Einstellungen"→„Übersicht".
- **Inhalte-Seite aktionsfähig**: `getAdminContentPosts` + `ContentModerationTable` (neueste Posts, Thumbnail, „Entfernen (Admin)" pro Post). **Live-Feed Auto-Refresh** (`AutoRefresh`, 20s).

### E) In-App-Support-Kanal + Antwort-Benachrichtigung (Kern: „keine Rückmeldung" lösen)
- Vorher: Support nur als statische Web-Kontaktseite, **kein** Support-View in der App, und `admin_reply_support_thread` benachrichtigte den Nutzer NICHT.
- **DB** (`20260705140000_support_reply_notification`): `admin_reply_support_thread` erzeugt jetzt `support_reply`-Notification an den Nutzer (defensiv; Push via `trg_push_notification`); Typ im CHECK; neue RPC `add_user_support_message`. `create_support_thread` (Mai-Migration) wiederverwendet.
- **Mobile**: `lib/useSupport.ts`, `app/support.tsx` (Chat-Ansicht + Start-Form), Settings-„Hilfe & Support" auf In-App, Notification-Renderer + Push-Deep-Link + Typ-Union. **Edge** `send-push-notification` kennt `support_reply` (immer zustellen, kein Pref-Gate) — **neu deployt**. **Web**: Notification-Typ-Union + Renderer + Deep-Link.
- **Offen**: Admin-Gegen-Loop (Benachrichtigung bei NEUER Anfrage). Support-Thread-Ansicht ist Web-admin + Mobile-User; Web-User-View bleibt statische Kontaktseite.

### F) Team-Doku + R2-Verifikation
- **`docs/PROJECT_BRIEFING.md`** (+ druckfertige `docs/Serlo-Team-Briefing.pdf`, Diagramme als self-contained SVGs in `docs/briefing-assets/`, Build via `build.py` + Chrome-Print): Überblick/Architektur/Finanzen/Sicherheit/Monitoring/Team(Rollen×Phasen ~3-4→6-8→10-14)/Marketing/Wachstum/kritische Lücken + Glossar. **`docs/ACCESS_MAP.md`**: Dienste, Zugriffs-Matrix, Break-Glass — KEINE Secrets.
- **R2-Cleanup verifiziert**: Löschen gibt Speicher frei (Queue `deleted:49`, 0 pending/error; Cron `r2-delete-queue` alle 5 Min). Kein Müll.

---

## 1.0.5 🆕 Session 8 (4. Juli) — UI/UX-Politur · Video · Feed-v5 · Create-Redesign · Crash-Fix

> Alles committed + gepusht + verifiziert, viele OTAs raus (Runtime 1.30.0).
> Commit-Kette grob: `14e6026 → ce18a8f` auf `main`.

### A) Post-Overlay-Buttons vereinheitlicht + Teilen/Optionen zusammengeführt
- **Einheitlicher bare-Look** auf `user-posts.tsx`, `post/[id].tsx`, `guild-post/[id].tsx`, Feed (`FeedActionButtons.tsx`/`feedStyles.ts`): gefüllte weiße Icons + Schatten, **kein Like-/Bookmark-Quadrat**, Kommentar = gefüllte Blase mit 3 Punkten, Zähler eng am Icon (Box-Höhe 34).
- **Teilen + Drei-Punkte zu EINEM Sheet** (`PostShareModal` ist jetzt das universelle „Teilen + Optionen"-Sheet, owner-aware, mit „Tune my Vibe" + echtem Video-Speichern). Drei-Punkte-Button entfällt; `PostOptionsModal` gelöscht. post/[id] + guild-post nutzen jetzt via `useFollow` das reiche Sheet statt System-Teilen; user-posts eigene Posts → weiterhin `PostManageModal` (Bearbeiten/Löschen/Anpinnen).
- **Overlay-Spalte höher gesetzt** (`+88`/`+92`/`commentBarH+44`) — Teilen klemmte im 28px-Seek-Hitbereich des Ladebalkens → Fehlklicks.
- **Overlay-Icon-Abstand** vertikal erhöht (gap 10→16).

### B) Medien-Darstellung + Video-Verhalten
- **Blur-Fill → Schwarz:** Feed + guild-post + user-posts zeigen abweichende Formate jetzt `contain` auf schwarzem Grund (kein unscharfer Cover-„Spiegelungs"-Rand). Auch der **Create-Editor** (`FilterSheet` SkiaFilteredImage + VideoView) rendert `contain`.
- **Nahtloser Kommentar-Peek in `user-posts`:** Video schrumpft nach oben (~40%) & spielt weiter (sheetProgress+seamlessPeek, wie guild-post) — Kommentare laufen jetzt pro PostCard.
- **Guild-Detail-Layout-Fix:** bottomInfo hatte `bottom:80` UND paddingBottom gestapelt → Inhalt saß zu hoch; jetzt `commentBarH`-basiert.
- **Video-Position:** (1) Feed pausiert beim Profil-Swipe, Resume beim Zurück (`shouldPlayVideo` + `!profilePanel` + extraData). (2) Guild **Karte→Detail spielt nahtlos weiter** — neues `alwaysResume`-Prop in `FeedVideo` (merkt/restauriert Position UNABHÄNGIG von Länge, restartSignal setzt nicht auf 0); nur GuildCard + guild-post setzen es, **Feed bleibt unverändert** (Short-Video-Parity). (3) guild-post pausiert Video, wenn ein Profil darüber geöffnet wird (`useFocusEffect` → `screenFocused`).

### C) Feed-Algorithmus v5 (Migration `20260704100000`, ✅ ausgeführt)
- Fixte drei tote Kreisläufe von v4: **Seen-Filter** las `seen_posts` (nie befüllt!) → jetzt `post_dwell_log` als **weicher Penalty ×0.15**; **`record_skip`** war Positiv-Signal (view_count++) → jetzt echtes Negativ (Dwell ×0.97, kein view_count); **`decay_dwell_scores`** war nie geplant → nächtlich 03:00.
- Neu: **Jitter** (±15% im Sort), **Cold-Start-Boost** (junge Posts <14d, ≤+0.20), **Wilson-Popularity** (Like-Rate statt Roh-Counts), **Tag-Affinität** (`user_tag_affinity`, nächtlich 03:30 aus Likes+Dwell), **Community-Boosts** (Guild +0.05, DM +0.04, Shoppable +0.02). Client (`usePosts.ts`) sendet erste Seite jetzt `include_seen: false`. Memory `vibes-feed-algorithm-v5` teils veraltet → v5 ist neuer Stand.

### D) Entdecken + Shop
- **Entdecken** (`explore.tsx`): Sektionen in `ListHeaderComponent` → durchgehend scrollen (war fixer Kopf + gequetschtes Grid), **Pull-to-Refresh**, **Like-Zahl auf Thumbnails** (like_count/view_count in Query), Sparkles-Icon.
- **Shop** (`shop/index.tsx`): aktive **Sammelbestellungs-Runde** (`GuildRoundCard`) prominent im Kopf, **Merken-Herz** auf jeder Karte (optimistisch, eine `useSavedProducts`-Liste), Pull-to-Refresh sichtbar (`refreshing`-State).

### E) Create/Studio/Live-Redesign — theme-aware Glas
- **Neues geteiltes Modul `components/create/CreateGlass.tsx`** (`GlassPanel` + `useCreateGlass`): frosted glass, **theme-aware** (dark→dunkel, light→hell, Blur+Scrim+Hairline-Border), Marken-Lila-Akzent, konsistente Typo/Chips/Segment/CTA. **Eine Quelle** für Studio, Editor, Live.
- **Studio** (`create/camera.tsx`) + **Live-Setup** (`live/start.tsx`) darauf umgestellt (Panels, Mode-Switcher theme-aware Icons). Kontrast später angehoben (Scrim 0.86, Blur 55, Labels `text.secondary` — waren zu blass/murkig).
- **🔴 Editor (`create/index.tsx` + `editor/*`) noch NICHT umgestellt** — nächster Schritt.

### F) Sonstiges
- **Profil-Teilen:** rohem `serlo://user/<uuid>` → HTTPS `webProfileUrl(username)` = `serlo-web.vercel.app/u/<username>` (unfurlt mit OG-Bild). Memory-Parität mit Post/Produkt.
- **🔴 Prod-Crash-Fix (`98ab7da`):** `Invariant Violation: new NativeEventEmitter() requires a non-null argument` via `get PushNotificationIOS`. Ursache: etwas enumeriert die react-native-Exports (Fehler-Kontext-Capture) → RNs `PushNotificationIOS`-Getter lädt ein Modul, das crasht (natives Push nicht gelinkt, wir nutzen expo-notifications). Fix: Getter früh in `app/_layout.tsx` auf `undefined` + non-enumerable stubben. **Löste auf Zaurs Gerät die expo-updates-Rollbacks aus** (s. Start-hier OTA-Falle).
- **Labels umbenannt** (nur sichtbar, interne Bezeichner/Routen/DB unberührt): **Feed→Home**, **Guild→Clan** (Tab-Label `tabBarStore` + alle sichtbaren Guild-Texte + Post-Badge), **Vibe→Aufnahme** (Create-Modus). Marke „Vibes"/„Vibe" (Post-Begriff) bleibt.
- **Dark Mode Default** (`themeStore.ts`): Standard `'system'`→`'dark'` für alle, Persist-Migration v2 hebt bestehende `'system'`-User auf `'dark'`. Light nur bei aktiver Umstellung.
- **Live-Kamera-Qualität** (`live/host.tsx`): 720p→**1080p-Capture** + 1080p-Top-Simulcast-Layer @ 3.5Mbps + `maintain-resolution`; untere Layer bleiben. Rückkamera-Flip existierte schon (behält 1080p). Braucht starken Host-Upload; Low-Light-Rauschen bleibt.
- **Simulator-Screenshot-Versuch gescheitert:** MLKit-Pods setzen `EXCLUDED_ARCHS[iphonesimulator]=arm64` (nur x86_64-Sim-Binary) → auf Apple-Silicon-Sim nicht baubar. **App-Store-Screenshots vom echten Gerät nehmen** (1320×2868 für 6,9").

---

## 1.1 🆕 Session 7 (2.–3. Juli) — App-Store-Sprint · UI-Politur · Security · Monitoring

> Riesen-Session. Alles committed + gepusht + verifiziert, viele OTAs raus.
> Chronologische Commit-Kette: `08456a2 → 89b0c22` auf `main`.

### A) UI-Politur (alles per OTA, tsc grün)
- **Statusbar-Rollout** (`08456a2`): `useThemedStatusBar` auf ALLE ~30 fehlenden Screens ('auto'/'light'). Abdeckung jetzt vollständig (Memory `vibes-statusbar-theme`). Falle: Route+Embed-Komponenten (z.B. `UserProfileContent`) → Hook in den Route-Wrapper, nicht in die Embed-Komponente.
- **Typo-Entfettung** (`05233e1`): app-weit `fontWeight` 900→700 / 800→600 (238 Stellen). Shop-Konvention aus v1.26.7 überall durchgezogen.
- **Feed-Top-Zeile minimal** (`fab6e30`): Kategorie-Chips + Replay-Uhr RAUS (`CategoryFilter.tsx` gelöscht), stattdessen links **LIVE-Pill** (nur wenn jemand streamt, nutzt `useActiveLiveSessions`). Kopf jetzt: `[LIVE] Für dich|Folge ich [🔍]`. `activeTag`-Seed bleibt (Onboarding).
- **Guild-Kopf eine Zeile** (`4763b38`): `[⚡ Name · Mitglieder | + Einladen | 🏆]`. Einladen = primärer CTA (teilt Referral-Link mit Guild-Kontext). Rangliste von Toggle-Leiste auf Trophy-Icon geschrumpft. `GuildViewToggle.tsx` gelöscht.
- **Profil-Kopf entrümpelt** (`3564632`+`cf123fa`): „Resonanz"(avgDwell) raus (Jargon), leere Battle-Bilanz „0–0" versteckt, Meta-Zeile → Identitäts-Chips (Teip prominent, Women-Only rosa Pille). Anzeigename-Fallback (kapitalisierter Username → kein doppeltes „@zaur"). Kopf kompakter (Avatar 92→84, engere Paddings).
- **Shoppable-Chip kompakt** (`3c8d7d8`): `ProductFeedChip` CTA-Button entfernt (ganze Pille navigiert), schlanke runde Pille, **ÜBER** dem Autor-Block (drückt Nickname nicht mehr hoch). Alle 3 Flächen (FeedItem, post/[id], guild-post/[id]).
- **Web Mobile-Kauf-Funnel** (`bbe7e65`): Buy-Bar schwebt jetzt echt (`display:contents`-Wrapper + bottom-Offset über MobileBottomNav), CTA einzeilig („Vorbestellen"/„Jetzt kaufen" statt langer „Einloggen zum…"), Auth-Pills verdecken Kopfzeile nicht mehr (`pt-14`). „Creatorn"-Typo → „Community".
- **Edit-Post** (`9e380fb`): `autoFocus` raus (Tastatur springt nicht mehr auf), **Produkt-Picker** ergänzt (lädt/speichert `product_id`, eigene Produkte als Pillen).

### B) App-Store-Launch-Vorbereitung (Zaurs Hauptziel)
- **Coin-Shop hinter Feature-Flag** (`db76725`): NEU `lib/featureFlags.ts` `COIN_SHOP_ENABLED=false`. Gated: Profil-„Coins", Shop-Shortcut, alle „Aufladen"-CTAs, GiftPicker-„+Coins", coin-shop.tsx Deep-Link-Guard (Redirect→Profil). **Grund:** IAP-Produkte in App Store Connect nicht eingereicht („Could not check") = sicherer 2.1-Ablehnungsgrund. Wieder-anschalten = 1 Zeile + OTA. Salden/Gift-System bleiben sichtbar (Apple-konform).
- **ATT-String entfernt** (`fc80a46`): `NSUserTrackingUsageDescription` raus (kein Tracking-SDK) → Privacy-Label „Data Not Used to Track You".
- **SecureStore-Background-Crash gefixt** (`c3be0ac`): `lib/supabase.ts` `getLargeItem` warf beim Backgrounding (Keychain gesperrt) → fatal. Fix: `keychainAccessible: AFTER_FIRST_UNLOCK` + try/catch. War 1 der 3 Sentry-Crashes.
- **Pflicht-Status (alle verifiziert):** Permission-Strings ✓, Encryption-Flag ✓, Sign in with Apple ✓, Account-Löschung in-App ✓, UGC (Melden/Blockieren/Moderation) ✓, AGB/Datenschutz-Links ✓. `eas.json` submit `ascAppId` gesetzt ✓. Kein „Paid Apps Agreement" nötig (keine aktive IAP in v1).
- **Die 3 Sentry-Crashes (analysiert):** (1) SecureStore-`get` → **gefixt**. (2) App Hang ~3s beim LiveKit-Reconnect → **KEIN Crash, kein Ablehnungsgrund** (Apple lehnt nur bei echten Crashes ab). (3) EXC_BAD_ACCESS beim Bild-Laden → 1 User auf Zaurs iPhone 16 Pro / iOS 26.6 (Beta), niedrige Freq, schwer ohne Geräte-Repro. Alle 3 sind Einzel-User-Edge-Cases.
- **NOCH ZU TUN für Launch:** (1) Build 287 (`app.json` version/buildNumber hoch → `eas build --platform ios --profile production` → `eas submit`). Frisch von `main` bauen, damit das Coin-Flag IM Binary ist. (2) ASC: Screenshots (Plan: Feed/Live/Guild/Shop/Women-Only/Profil, deutsche Overlays, 1290×2796 — Zaur macht Roh-Screenshots, ich rahme sie), Privacy-Labels, Altersfreigabe **17+**, Kategorie Social, Demo-Account + Review-Notes.

### C) 🔴 Post-Overlay-Buttons — WICHTIG, noch nicht fertig ausgerollt
- **Der springende Punkt:** Ein **Profil-Post-Klick öffnet `app/user-posts.tsx`** (Multi-Bild-Pager „1/11" + …-Menü), **NICHT `app/post/[id].tsx`**! Ich habe zuerst versehentlich `post/[id]` poliert (Commits `6f22f59`/`c9a3547`/`699b408` — dort stehen jetzt dunkle Kreise + gefüllte Icons) → Zaur sah keine Änderung, weil er `user-posts` anschaut. Dann `user-posts.tsx` gefixt (`77ced75`/`806a22d`/`89b0c22`).
- **Finaler Look auf `user-posts.tsx` (Zaur testet gerade):** KEIN dunkler Kreis (bare), solide **gefüllte weiße** Icons (`fill="#FFFFFF"`) + kräftiger Schatten (shadowOpacity 0.6), Größen 26 (Mute 23), `rightActions` gap 10, Pille 44. Kommentar = **gefüllte Blase + 3 dunkle Punkte** (`bubbleWrap`/`bubbleDots`/`bubbleDot`, `top:9` ggf. justieren wenn Punkte nicht mittig). Zähler weiß+Schatten. Autor/Caption/Tags Text-Schatten.
- **🔴 TODO nach Zaurs „passt":** Genau diese Werte auf `app/post/[id].tsx` (dort noch dunkle Kreise), `app/guild-post/[id].tsx` und `components/feed/FeedItem.tsx` übertragen → **einheitlicher Look überall**. Screenshot-Falle beachten (echtes Display ≠ Screenshot).
- **Bonus in post/[id] (nur dort, noch NICHT in user-posts):** Tap-to-Pause (statt Mute) + nahtloser Kommentar-Peek (Video schrumpft & läuft weiter, wie Feed) — Commits `6f22f59`/`4762917`. Falls user-posts das auch bekommen soll: gleiches Muster (`sheetProgress`+`seamlessPeek`) übertragen.

### D) Guild-Commerce v1 (`172e830`, Migration ausgeführt)
- **Sammelbestellungs-Runden** (#3 App-Karte): Migration `20260702100000_guild_commerce_rounds.sql` — Tabelle `preorder_rounds` (product, seller, title, target_qty, closes_at, status; `guild_id` ab Tag 1 dabei, v1 immer NULL = überall sichtbar). RPCs `create_preorder_round` (adoptiert bestehendes Interesse → zählt ab Sekunde 1), `close_preorder_round`, `get_active_preorder_round`. `product_preorders.round_id` + Trigger.
- App: `lib/useShop.ts` (`useActivePreorderRound`/`useCreate`/`useClosePreorderRound`), `components/guild/GuildRoundCard.tsx` („Jetzt aktiv"-Karte, RollupNumber-Fortschritt), Start-Sheet in `app/shop/fulfillment.tsx` (Samstags-Presets). Bereit für die 80er-Runde.
- **OFFEN:** Web-Parität der Runden-Karte (WhatsApp→Web-Neukunden sehen sie noch nicht).

### E) Security-Review + 4 Fixes (2026-07-02, Memory `vibes-security-review-money`)
- `91ac42a` RC-Webhook: **fail-closed** (fehlt `REVENUECAT_WEBHOOK_SECRET` → 500 statt Auth-Skip) + **atomare Idempotenz** (INSERT-first-Claim statt check-then-credit).
- `b8e7d9a` Stripe-Webhook: **payment_status-Guard** (SEPA/Klarna feuern `completed` mit `unpaid` → nicht früh gutschreiben).
- `3c9635c` Migration `buy_product_quantity_guard`: p_quantity 1..999 validiert (negative Menge hätte Coins gutgeschrieben).
- **OFFEN vor Phase 2:** `seller_accounts`-RLS (`using(true)`) einschränken; Receipt-Verify aktivieren beim Coin-Launch; `[functions.bunny-webhook]` in config.toml zeigt auf gelöschte Function (erst prüfen ob remote noch deployed).

### F) Monitoring-Vollausbau (2.–3. Juli, Memory `vibes-monitoring-setup`, Doku `docs/MONITORING.md`)
- **Sentry-Web war KOMPLETT AUS** (DSN fehlte in Vercel!) → jetzt aktiv, 4 Vars in Vercel gesetzt (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG=brandwerkx`, `SENTRY_PROJECT=javascript-react`, `SENTRY_AUTH_TOKEN`). Source Maps laden (Falle: Redeploy OHNE Build-Cache nötig, sonst keine Injection). App+Web teilen EIN Sentry-Projekt.
- **Telegram-CI-Alerts** (`2769670`): `.github/actions/telegram-alert` + Job in allen 5 Workflows (`if:failure()`). Secrets `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` von Zaur gesetzt. Eigener Alert-Bot.
- **rose-Baseline gefixt** (`ac07f2b`): die 2 Dauer-TS-Fehler (deprecated Legacy-Aliasse ohne `accent.rose`) → CI-Typecheck jetzt **0 Fehler**. Rot ist wieder ein echtes Signal.
- **UptimeRobot**: 3 Monitore (`/`, `/shop`, Supabase `auth/v1/health?apikey=<anon>` als **Keyword**-Monitor auf `GoTrue` — HTTP-Monitor scheitert an HEAD/405/401!).
- **Stripe**: Webhook-Fehler-Mails aktiv (Kommunikationseinstellungen → API-Tab). ⚠️ Zaur hat mehrere Stripe-Kontexte (brandwerkx + Sandboxes) — Serlo-Zahlungskonto via bekannte Test-Zahlung identifizieren.

### Session-7-Gotchas
- **Profil-Post → `user-posts.tsx`**, nicht `post/[id].tsx`. Immer prüfen, welchen Screen der User wirklich sieht, bevor man UI fixt.
- **Screenshot ≠ echtes Display** bei Overlay-Sichtbarkeit. Dünne weiße Umrisse verschwinden real → solide gefüllte Icons.
- **OTA-Debug:** Wenn „keine Änderung sichtbar": `npx eas channel:view production` (Channel→Branch+Runtime prüfen), NICHT sofort Code verdächtigen. Meist: falscher Screen oder nicht kalt neugestartet.
- **`react/no-unescaped-entities`**: `„…"` im JSX-Text ist OK (deutsche Typo-Quotes), aber gerade `"` bricht den Web-Build.

---

## 1.2 🆕 Session 6 (29.6.) — Brücken aus der „App-Karte" + Fixes

> Leitidee dieser Session: Die App hat **Breite**, aber die Features waren **Silos**.
> Gebaut wurden die **Querverlinkungen** (Brücken), die den Akquise→Verkauf→Wiederkehr→
> Weitersagen-Loop schließen — durch Zaurs Premortem-Brille (erst validieren). Alles
> committed+gepusht+verifiziert. **App-Stand = OTA `7bb41482`; danach nur Web.**

### ✅ #2 Shoppable Posts (Feed↔Shop) — App + Web KOMPLETT
- **DB** `20260629160000_post_product_link`: `posts.product_id` + FK `posts_product_id_fkey` (ON DELETE SET NULL) + Partial-Index. Feed-RPCs unangetastet.
- **Daten-Muster** (kein RPC-Umbau): Produktinfo per Sekundär-Fetch über den FK-Embed nachladen — `lib/useFeedProducts.ts` (App, Batch per Post-ID) + `apps/web/lib/use-feed-product-links.ts` (Web, deckt Infinite-Scroll). Post-Detail Web: `getPostLinkedProductId` (public.ts).
- **Render** (überall dieselbe wiederverwendbare Karte): App `components/feed/ProductFeedChip.tsx` (Feed via FeedItem, `post/[id]`, `guild-post/[id]`). Web: bestehende `ProductLinkCard` (Chat) wiederverwendet in `feed-card.tsx` + `/p/[postId]` Post-Detail. Preorder zeigt €/„Vormerken", Coin-Produkt 🪙/„Ansehen".
- **Erstellen**: App `DetailsSheet` Produkt-Picker (eigene Produkte) → `product_id` beim Insert (nur wenn verknüpft → Posten bleibt safe). Web `CreateEditor` Picker → `publishPost` trägt `product_id` per Best-Effort-Update nach `create_post` nach (kein RPC-Umbau).
- **Deep-Link-Fix** (`332d414`): `app/shop/[id].tsx` suchte nur in der 30er-Browse-Liste (`useShopProducts`) → „Produkt nicht gefunden" bei verknüpften/geteilten/eigenen Produkten. Neuer `useProduct(id)` lädt direkt per ID (RLS: aktiv für alle, eigenes via Owner-Policy). Gilt für ALLE Deep-Links.

### ✅ #4 Rückkanal — zwei Ausprägungen (App + Web)
- **Auto-Zahlungserinnerung** (`20260629170000_payment_reminder`): stündlicher pg_cron `send_payment_reminders()` → 24h nach „Zahlung anfordern" EINE sanfte Erinnerung an unbezahlte `payment_requested`-Orders (`product_orders.reminded_at`-Gate = 1×, kein Spam). Typ `order_payment_reminder`.
- **„Sammelbestellung offen"** (`20260629180000_preorder_round_announce` + Fix `…200000`): manueller Auslöser → pingt **Vormerker ∪ Speicherer** (`product_preorders` ∪ `saved_products`) mit Deep-Link aufs Produkt. RPC `announce_preorder_round(product, msg?)` (seller/admin-gate, robust mit EXCEPTION→`{error,detail}`). Typ `preorder_round_open`. **Auslöser:** App `fulfillment` „📣 Ankündigen", Web `/studio/shop/preorders` `PreorderAnnounceButton` (Dialog erklärt WANN: neue Runde, unabhängig vom Bestellstatus).
- **Notification-Plumbing** (Memory `vibes-three-notification-surfaces`): beide Typen durch ALLE Surfaces — CHECK (dynamisch erweitert), `send-push-notification` (Titel/Body + `productId` jetzt in Push-`data`), App+Web In-App-Renderer (Text/Icon/Tap → my-orders bzw. /shop/[id]), Typ-Unions. Push feuert automatisch via `trg_push_notification` (AFTER INSERT auf notifications).

### ✅ #5 Referral-Foundation (`20260629190000_referrals`) — Tracking, KEINE Belohnung
- **Bewusst ohne Belohnungs-Engine** (Rabatte/Provisionen bleiben Zaurs manuelle Entscheidung). Nur wer-wen: `profiles.referred_by` + RPC `claim_referral(code)` (one-time, kein Selbst-Referral, code = Username) + `get_my_referral_count()`.
- **Web**: `/i/[code]` warmes Invite-Landing → `ClaimOnMount` ruft Server-Action `claimReferral` (setzt Cookie ausgeloggt / attribuiert sofort eingeloggt). `ReferralClaimer` im Root-Layout (cookie-gated) holt die Attribution nach Signup nach. **Kein Eingriff in Auth/Onboarding.**
- **App**: Einstellungen → „Freunde einladen" (teilt `serlo-web.vercel.app/i/<username>` + Zähler „N sind über dich dabei").
- **Attribution v1 = Web-Signup** (Perfume-Conversion läuft eh über Web). **OFFEN:** App-Deep-Link-Attribution + Web-Invite-Fläche + Belohnung.

### ✅ Weitere Fixes
- **Web schmale Sidebar** (`railCollapsible`) auf 9 Routen (admin/studio/woz/live/privacy/settings/coin-shop/create) — Rail aus `FeedSidebarLayout` in wiederverwendbare `FeedSidebarRail` ausgelagert; admin = fixed Rail mit xl-Offset, live nur Browse (nicht Fullscreen).
- **guild-post Reopen/Media-Fix** (`b3e9265`+`883a8a5`): „Kommentar nach Profilbesuch → kleines Video + schwarze Lücke". ECHTE Ursache war NICHT `removeClippedSubviews`, sondern: `guild-post/[id]` ist `presentation:'fullScreenModal'` + Kommentare sind ein `<Modal>` → iOS verschluckt das Re-Präsentieren nach dem Pop. Fix: Video-Höhe STRIKT an `showComments` gekoppelt (zu=voll, offen=klein) → kaputter Zustand unmöglich; Reopen verzögert via `InteractionManager`. Memory `vibes-seamless-comments-video` (Falle 3).
- **Vorbestell-Verwaltung admin-only** (`92f3247`): Vorbestellung war einmalige Admin-Aktion (Parfüm). Alle Verwaltungs-Flächen jetzt admin-gated — Web `/studio/shop/preorders` (redirect), „Vorbestellungen verwalten"-Links; App `fulfillment` + Einstiege in my-shop/my-orders. Käufer-„Vormerken" bleibt (Verkaufsweg).

### Schlüssel-Dateien Session 6
- DB: `supabase/migrations/2026062916–20*.sql` (5 Stück, alle ausgeführt).
- Daten: `lib/useFeedProducts.ts`, `lib/useShop.ts` (`useProduct`, `useAnnouncePreorderRound`), `apps/web/lib/use-feed-product-links.ts`, `apps/web/app/actions/{shop,referral}.ts`, `apps/web/lib/data/public.ts`.
- App-UI: `components/feed/ProductFeedChip.tsx`, `app/shop/fulfillment.tsx`, `app/settings.tsx`, `app/(tabs)/notifications.tsx`, `lib/usePushNotifications.ts`, `lib/useNotifications.ts`, `app/post/[id].tsx`, `app/guild-post/[id].tsx`, `components/create/editor/DetailsSheet.tsx`.
- Web-UI: `components/feed/{feed-list,feed-card}.tsx`, `components/shop/preorder-contact.tsx`, `components/referral/*`, `app/i/[code]/page.tsx`, `app/p/[postId]/page.tsx`, `components/notifications/notification-list.tsx`, `app/studio/shop/preorders/page.tsx`.

### Session-6-Gotchas (für nächsten Chat)
- **Feed-RPCs geben `product_id` NICHT zurück** → Produktinfo IMMER per Sekundär-Fetch über den FK-Embed nachladen (nie die `get_vibe_feed`/`get_public_feed`-RPCs umbauen).
- **Neuer notifications.type** = 4 Stellen (CHECK dynamisch + `send-push-notification` messages/TYPE_TO_PREF + App-Renderer + Web-Renderer) + 2 Typ-Unions (`lib/useNotifications.ts`, `apps/web/lib/data/notifications.ts`). Push fließt automatisch (Trigger). Push-Deep-Link braucht das Feld in der Push-`data` (z.B. `productId`).
- **Produkt-Deep-Link** überall via `useProduct(id)` (App) / direkter `/shop/[id]` — NIE auf der Browse-Liste basieren.
- **„Ankündigen" ≠ Bestell-Aktion**: Marketing-Stups an Interessenten, unabhängig vom Zahlungsstatus. War anfangs verwirrend + hatte einen CHECK-Bug (gefixt `…200000`).

### Post-Test-Fixes (Zaurs Gerätetest, 30.6.)
- **🔴 `notifications.product_id` fehlte komplett** (`20260630000000_notifications_product_id`): In Session 6 wurde `product_id` überall referenziert (announce-INSERT, App+Web-`getNotifications`-SELECT, Push-Payload), die Spalte existierte aber NIE (SCHEMA.md hatte mich getäuscht — notifications hat 14 Spalten, product_id war NICHT dabei). Folgen waren GROSS: (a) „Ankündigen" scheiterte, (b) **Notification-Liste auf App UND Web war LEER in Produktion** (SELECT mit product_id → Query-Fehler → `[]`), während der Unread-Count (eigene Query) weiterzählte → Badge „1" + Drawer leer. Fix: Spalte ergänzt (FK→products, ON DELETE SET NULL). **Lehre (CLAUDE.md Regel #10!): vor JEDER neuen notifications-Spalten-Referenz in `supabase/SCHEMA.md` prüfen — ein falscher Spaltenname im Listen-SELECT leert die Liste still, während ein separater Count weiterläuft.**
- **„Vormerken" → „Vorbestellen"** (`86a4b30`): Käufer-Aktion + Status + Benachrichtigungs-Text app-/webweit umbenannt (kollidierte mit „Merken"/Bookmark; „Vorbestellen" klingt ernster/verbindlicher). DB-Status (`reserved`/`interested`) UNVERÄNDERT — reine Anzeige. preorder_interest-Text wird in den Renderern generiert (nicht in der RPC gespeichert) → nur Renderer + Edge-Push geändert.
- **Web-Create Produkt-Picker kompakt**: war bei 30+ Produkten eine endlos lange Liste → jetzt Suchfeld + scrollbare Liste fester Höhe + Chip mit „entfernen".
- **`/studio/shop/preorders` Non-Admin = Inline-Panel statt `redirect()`** (`04db7c8`): redirect() warf „Ups, da lief was schief" (vermutlich Sentry-Interferenz) → robustes Inline-„Nur Admin"-Panel.
- **Preorders-Seite: Produkt-Cover je Karte** (war nur Titel).
- **„Merken" benachrichtigt jetzt den Verkäufer** (`0a36a0f`, Migration `20260630010000_notify_on_save`): neuer Typ `product_saved` (weiches Interesse/Lead-Signal — Zaurs Wunsch). Umgesetzt als **Trigger `fn_notify_seller_on_save` AFTER INSERT auf `saved_products`** statt in RPC/Action → deckt App (RPC `toggle_save_product`) UND Web (direkter `saved_products`-upsert) ab; kein Ping aufs eigene Produkt; EXCEPTION-geschützt (Merken darf nie scheitern). Renderer/Push/Deep-Link (→ /shop/[id]) wie die anderen Shop-Typen. **Klartrennung jetzt: 🔖 Merken = weiches Interesse (pingt), „Vorbestellen" = verbindlich (pingt + erzeugt bezahlbare Bestellung).**

---

## 1.3 🆕 Session 4–5 (28.–29.6.) — Realtime-Parität, Joy, Echtgeld-Bestell-Politur

> Alles committed + gepusht + verifiziert. **App-Änderungen brauchen EINEN OTA**
> (siehe Schnell-Status). Web deployt automatisch via Vercel. Keine offene DB-Migration.

### 🔴 NÄCHSTE AUFGABE (von Zaur unterbrochen) — schmale Sidebar auf mehr Seiten
**Ziel:** Die schmale, per Hover aufklappende Sidebar (`railCollapsible`) soll auf diesen
Web-Seiten erscheinen: `/admin`, `/studio`, `/woz`, `/live`, `/privacy`, `/settings/profile`,
`/coin-shop`, `/settings`, `/create`.
- **Mechanismus existiert schon:** `<FeedSidebarLayout railCollapsible>{children}</FeedSidebarLayout>`
  → siehe **`apps/web/app/shop/layout.tsx:10`** (einzige Stelle, die es aktuell nutzt). Flag fließt in
  `components/feed/feed-sidebar.tsx` (iconOnly wenn nicht gehovert) + `feed-sidebar-layout.tsx` (Rail `w-20`).
- **Vorhandene Layouts** (Kinder dort wrappen): `app/admin/layout.tsx`, `app/studio/layout.tsx`,
  `app/live/layout.tsx`, `app/settings/layout.tsx` (deckt `settings/profile` mit ab).
- **Ohne Layout** (neues `layout.tsx` anlegen ODER Seite wrappen): `app/woz/page.tsx`,
  `app/privacy/page.tsx`, `app/coin-shop/page.tsx`, `app/create/page.tsx`.
- ⚠️ **GOTCHA:** `/studio` (und evtl. `/admin`, `/settings`) haben schon eine **eigene** sekundäre Nav.
  Prüfen, ob `FeedSidebarLayout` dort eine **doppelte** Sidebar erzeugt — ggf. nur dort einsetzen, wo
  noch keine globale Rail ist, oder das bestehende Layout entsprechend kombinieren. Pro Route einzeln testen
  (Hover klappt als Overlay auf, schiebt Content nicht). tsc + `npm run build` grün halten.

### ✨ Number-Rollups (App, `170f6a3`, OTA'd) + Web-Port (`46b3541`/`27918e7`)
- Design-Gesetz §1: neue `components/ui/RollupNumber.tsx` (App) + `apps/web/components/ui/rollup-number.tsx` (Web) — eased rAF-Tween, `<Text>`/`<span>`-Drop-in. Default animiert nur bei Wert-Änderung; `animateOnMount` für Werte die beim Erscheinen feststehen.
- App: Coin-Saldo (coin-shop) + Stream-Earnings (`host.tsx`, `key={showSummary}` für Remount). Web: Stream-Summary-Stats + Coin-Kauf-Success-Seite.
- ⚠️ App-Coin-Rollup nur im echten App-Store-Build sichtbar (TestFlight = IAP gesperrt). Header-Coin-Pille bewusst NICHT (lädt nur 1× → würde bei jedem Öffnen feiern).

### 🌐 Cross-Platform-Realtime-Parität App↔Web (das große Thema dieser Session)
**Muster:** App hört Live-Events oft NUR per Broadcast (kein postgres_changes) und mit ANDEREN Channel/Event-Namen als Web → Events kreuzten die Plattform nicht. Memory: **`vibes-live-comments-cross-platform-realtime`** (Tabelle + Fix-Pattern). Gebrückt:
- **Chat** (`ab54fc2`): Web spiegelt Kommentare zusätzlich auf App-Vertrag (`toAppBroadcastComment` in `live-chat-messages.ts` → `live-chat.tsx` + `live-chat-overlay.tsx`).
- **Gifts** (`8cf8205`): Web-Gift-Picker spiegelt auf `live:${id}`/`gift` (GiftRealtimePayload, giftId=gift_catalog-Slug). Es gibt KEINEN DB-Trigger (Code-Kommentar war falsch).
- **Mod-Events Timeout/Pin** (`346b0ae`): Web spiegelt `chat-timeout`/`pin-comment` auf den App-Channel.
- **Reaktionen/Herzen** (`6fa1395`): Web auf App-Vertrag vereinheitlicht — `apps/web/lib/live-reactions.ts` (Key↔Emoji-Mapping), `sendLiveReaction` + `useRemoteReactions` → `live-reactions-${id}`/`new-reaction`.
- **CoHost geprüft = ok** (kein Fix): Requests laufen über DB (`live_duet_invites` + postgres_changes); Broadcast nur Nudge. Accept/Layout/End-Events matchen.
- **Noch offen:** System-Events („@x folgt jetzt"), Delete-Kommentar web↔app (kein Web-Auslöser bzw. local-only).

### 🛒 Echtgeld-Bestellverwaltung poliert (App + Web)
- **„Anfordern"→„Angefordert ✓"** persistenter State (`58d8413`) + **Zähler/„Erneut anfordern"/Zeitstempel** (`0880808`). Logik: „handled" = `payment_requested+paid+shipped+delivered`; ein Produkt **verschwindet** aus „Ware ist da", sobald keine offenen Vormerker (newCount) UND keine wartende Zahlung (waitingCount) — läuft dann unten in „Zu versenden" (`931b362`). `mark_preorders_payable` ändert den Vormerk-Status NICHT → people-Count bleibt, Ableitung stimmt.
- **Pull-to-refresh** auf `app/shop/fulfillment.tsx` (`931b362`). **Keyboard-Fix** (KeyboardAvoidingView) für Versand-/Anschreiben-/Review-Sheets (`0880808`/`7c66982`).
- **Sendungsverfolgung** (`1d8490d`): klickbarer „Sendung verfolgen"-Chip (Carrier-Deeplink, `lib/tracking.ts` + `apps/web/lib/tracking.ts` — DHL/Hermes/DPD/GLS/UPS/FedEx/Post) + Kopier-Chip. App `my-orders` + Web `product-orders-panel`.
- **Discoverability**: `/shop/fulfillment` jetzt über Mein-Shop-📦-Header erreichbar (Verkäufer); **„Bestellungen & Verkäufe" (Creator-Dashboard + Profil-Menü + Produktseiten-Warenkorb) auf Echtgeld umgeleitet** (`159b0f5`): → `/shop/my-orders` (Käufe) mit „Meine Verkäufe verwalten →"-Link zu `/shop/fulfillment`. Coin-`/shop/orders` nur noch Fußzeilen-Link. **Coin-Bestell-Friedhof**: stornierte Coin-Bestellungen ausgeblendet (`a4db32b`). Grund (Zaur): Coins werden nur bei ihm gekauft (für Geschenke→Diamanten-Auszahlung), nicht als Produkt verkauft → Coin-Käufe/Verkäufe-Seite unnötig.

### 💜 Parfüm-Teilen-Loop (Umsatz-Flywheel)
- **App** (`bc63046`): nach erfolgreichem Vormerken öffnet die ShareSheet mit Feier-Header (`celebrate`-Prop). **Web** (`46b3541`): neuer `PreorderCelebrateDialog` (Link/WhatsApp/Telegram/native Share). **OG-Karte** (`27918e7`): Vorbestell-OG-Bild aufgewertet (warmes Gradient + „Jetzt vormerken"-CTA + „Zahlung erst bei Lieferung"), gerendert verifiziert. End-to-end getestet (WhatsApp-Unfurl).

### 🐛 Web-Stream-End + Feed-Kommentar-Bugs
- **Web-Host-Hängen nach Stream-Ende** (`415181f` + Redesign): End-Zusammenfassung von `absolute inset-0` (in `aspect-video`-Box, abgeschnitten) auf `fixed inset-0 z-[140]` = echtes Vollbild + dunkler theme-unabhängiger BG (war im Light-Mode weiß-auf-weiß) + zentrierte Karte + prominenter Ausgang. Top-Spender/Kommentatoren-Namen werden in der Web-Summary jetzt nachgeladen (Realtime-WAL-Row hatte kein Profil-Join).
- **Kommentare nach Profilbesuch kaputt** (`7c66982` + `98887db`): Tippte man in Kommentaren auf einen User → Profil → zurück, blieb das Medium klein (sheetProgress nie auf 0) + Kommentare zu. Fix in ALLEN 4 Flächen: `FeedItem`, `guild-post/[id]`, `GuildCard`, `post/[id]` — `reopenCommentsRef` + `useFocusEffect` öffnet Kommentare beim Zurück-Fokus wieder; sheetProgress-Screens bekommen `else`-Reset.

---

## 1.4 🆕 Session 3 (28.6.) — Webhook-Fix, Coin-Ökonomie, Shop-Parität, Joy/Wärme

> Reiner Politur-/Tiefe-Pass + ein Prod-Incident-Fix. **KEIN neues großes Feature.**
> Zaurs Leitlinie diese Session: **Tiefe statt Breite.** Monetarisierungs-Breite
> (Serlo Plus / Boost / Creator-Abos / Marktplatz-Connect / Affiliate) bewusst
> **NICHT gebaut** → analysiert + im Brain `decisions/2026-06-28-serlo-finanz-backlog`
> (was geht jetzt / blockiert / Schritte). Plus-vs-Boost-Analyse: Plus wäre der bessere
> nächste Hebel, aber **erst wenn engagierter User-Kern da** — jetzt nichts davon.

### 🔴 Prod-Incident: Stripe-Webhook 401 (Echtgeld scheiterte STILL)
- Ein Session-2-Deploy hatte `stripe-webhook` OHNE `--no-verify-jwt` ausgerollt → Supabase-JWT-Gate wies Stripe mit **401** ab → Test-Käufe blieben auf `payment_requested` (Success-Seite hing auf „Zahlung wird bestätigt…"). Diagnose: Stripe-Dashboard (Test-Modus!) → Entwickler → Webhooks → Ereignisübermittlungen (401=Gate, 200=ok); hängende Events per „Erneut senden" befreien.
- **Fix:** `stripe-webhook` + `revenuecat-webhook` + `bunny-webhook` neu deployt mit `--no-verify-jwt`; **`supabase/config.toml` neu angelegt** (`verify_jwt=false` pro Webhook) → überlebt jeden künftigen Deploy. End-to-end verifiziert (Soirée-Order ging durch). Memory: `vibes-edge-webhook-verify-jwt`.

### 💰 Coin-Ökonomie kalibriert + LIVE (Migration `20260628150000`, ausgeführt)
- War strukturell **defizitär** (Verdienen ~85% Gift / 70% Shop @ 0,02 €/Diamant > Coin-Preis 0,005-0,008 €). **Fix:** Diamant-**Verdienen → 12,5%** (`gift_catalog.diamond_value` generisch + `buy_product`-RPC), **Auszahlkurs 0,02 € unverändert** → q×R = 0,0025 €/Coin → **Plattform behält 50-70%** (brutto; netto enger wg. Apple-30%/Stripe-3%).
- Anzeige-Fixes auf 12,5% nachgezogen: my-shop „≈ € für dich" (`price_coins*0.0025`), Shop-Statistik App (`lib/useShop` useShopAnalytics) + Web (`getShopAnalytics`). Brain-Roadmap „Coin=Minus" → als gelöst markiert.

### 🛒 Shop — App/Web-Parität + Qualität
- **Bewertung auf eigenem Profil** (`components/profile/ProfileListHeader.tsx`, war nur auf fremden Profilen).
- **Shop-Kachel: €-Preis + Titel** bei Vorbestellung statt Coins — `app/(tabs)/profile.tsx` + `UserProfileContent.tsx`.
- **Echtgeld-Texte** „Zahlung bei Eintreffen" statt „zahlbar bei Lieferung" (App+Web Produktseite) + DM-Vorlage (`preorder-contact.tsx`) + Notif-Text (Mig. `20260628140000`) + Push-Titel „💶 Zeit zu bezahlen".
- **„Produkt bearbeiten"-Button** (Besitzer) auf Produktseite: App → `/shop/my-shop?edit=<id>` (Edit-Sheet), Web → `/studio/shop/[id]/edit`.
- **App-Edit-Maske: €-Preis + Vorbestell-Schalter** (admin-gated, `my-shop.tsx`) · **Web: Vorbestellung direkt bei Erstellung** (`product-form.tsx` + `shared/schemas/product.ts` `sale_mode`). Vorbestellung ist via DB-Trigger `enforce_sale_mode_admin` **admin-only**.
- **App-Shop-Browse-Limit 30→200** (`app/shop/index.tsx` — Pflaster; echte Server-Query/Infinite-Scroll bewusst aufgeschoben, Pflaster reicht).
- **Vorbesteller-„Anschreiben"** in `app/shop/fulfillment.tsx` (RPC `notify_preorder_buyers`) + **Shop-Statistik-Screen** `app/shop/analytics.tsx` (BarChart3-Button im my-shop-Header).
- **Web-Banner-Karussell** `apps/web/components/shop/banner-carousel.tsx` (RPC `get_active_shop_banners`) auf der Katalog-Seite (Parität mit App).
- **Web-Shop: linke Nav als schmale Hover-Rail** — neues `railCollapsible`-Flag in `FeedSidebar`/`FeedSidebarLayout` (Default false → andere Routen unverändert), nur `app/shop/layout.tsx` setzt es. Klappt per Hover als Overlay auf (schiebt Content nicht).

### ✨ Joy/Wärme-Audit (Tiefe, kein Feature) — KOMPLETT
- **Wärme-Pass #1-3:** ~60 kalte Stellen warm gemacht — **33 Fehler-Alerts** („Hoppla 🙈 — gleich nochmal?"), **26 Leer-Zustände** („Dein Shop ist noch leer 🛍"), **Feed-Fehler** („Lädt gerade nicht 🌀"). Skript-gestützt (Text + 1 Emoji + „was tun?", Klarheit bleibt).
- **Erfolgs-Haptik beim Gift senden** ergänzt (war stumm; `GiftPicker.tsx`). Andere Peaks (Like/Post/Kauf/Coins) feiern bereits.
- Bewusst NICHT angefasst (maßhalten): Such-„nichts gefunden", AR-„kein Gesicht", „Kein Sound"-Option, schon-warme Texte, Login/Register (schon warm).

### Offene Tiefe-Punkte (optional — brauchen Geräte-Test/Entscheidung)
- ✅ **Number-Rollups** erledigt (Session 4, §1.3 — App; Web-Port offen). · **Parfüm-Kauf-+-Teilen-Loop** + Share-Karte polieren (Web-ShareSheet steht schon, es fehlt der Post-Kauf-Feier-/Teilen-Moment) · echte **Server-Browse-Query** + Preisfilter (App, #2) · **Produkt-Review ⇄ Order-Review** konsolidieren (zwei komplementäre Systeme, kein Bug) · **Cross-Platform-Realtime** für System-/Delete-/Timeout-Events web↔app (§1.3).

---

## 1.5 🆕 Session 2 (27.6. später) — Echtgeld-Bestell- & Vertrauens-System KOMPLETT

> Aufbauend auf §1-J. Der ganze Loop ist jetzt fertig + live (Web + App):
> **Vormerken → „Ware ist da → Zahlung anfordern" → bezahlen (Stripe) → versenden+Tracking
> → erhalten → bewerten (beidseitig) → Problem melden & klären.** Plus Direktkontakt jederzeit.

### Was gebaut wurde
- **Verkäufer-Vorbestell-Panel-Fix**: `getMyPreorderGroups` (Web) nutzte einen kaputten PostgREST-Embed `user:profiles(...)` (FK zeigt auf `auth.users`, nicht `profiles`) → PGRST200 → Panel leer. Fix: Usernamen separat per `.in()`. Memory: `vibes-postgrest-profiles-embed`.
- **Checkout-Zielseiten**: `/shop/success` + `/shop/cancelled` (gab's nicht → 404/Coin-Seite). `create-checkout-session` vom Coin-`STRIPE_SUCCESS_URL`-Fallback entkoppelt + **Cover-Bild** an Stripe (WebP→JPEG via `images.weserv.nl`).
- **Käufer-Aktionen**: Stornieren **vor** Zahlung (`cancel_product_order`, gibt Vormerkung frei) + **Lieferadresse ändern** solange `paid` (`update_order_shipping_address`). UI Web+App.
- **Eigenes UI statt Browser-Dialoge**: Versand/Erhalten/Stornieren laufen über `<Dialog>` (Web) statt `window.prompt/confirm`.
- **Repeat-Kauf**: „Vormerken" nach Lieferung wieder möglich (`useMyPreorder`/`preordered_by_me` zählen nur offene Vormerkungen; `mark_preorders_payable` blockt nur laufende, nicht gelieferte Orders).
- **Vorbestell-Oberflächen konsolidiert**: `/studio/shop/preorders` ist die **einzige** Zentrale (Anschreiben + „Ware ist da → Zahlung anfordern"); der doppelte Block aus `/studio/orders` ist raus (Banner verlinkt hin).
- **Direktkontakt** Käufer↔Verkäufer aus jeder Bestellung (DM-Button, Web+App).
- **Bewertungen nach Lieferung** (beidseitig): `order_reviews` + `submit_order_review`. Anzeige auf der Bestellung (eigene + erhaltene) **und aggregiert als Reputation** auf dem **Profil** (`get_order_rating`) + auf der **Produktseite** (Seller-Karte).
- **Dispute/Melden**: `order_disputes` + `report_order_dispute` (Partei, ab `paid`) + `resolve_order_dispute` (**Admin-only**). „In Klärung"-Banner; Admin klärt auf Web.
- **Benachrichtigungen korrekt**: eigene Typen statt generisches `gift` — `order_payment_requested/paid/shipped/cancelled/address_updated/review/dispute` + `preorder_interest`. Push-Texte + Deep-Links + Live-Glocken-Badge.
- **Echtgeld zählt jetzt**: `bump_product_sold_count` (Webhook beim Bezahlen) → `sold_count` auf Karten+Analytics; **€-Umsatz** in Shop-Analytics (`getShopAnalytics` aggregiert `product_orders.amount_eur`).

### Migrationen Session 2 (✅ alle ausgeführt) — chronologisch
`20260627150000` order_buyer_actions (cancel + address) · `20260627160000` repeat_preorder · `20260627170000` order_notification_types · `20260627180000` order_notif_types_2 (cancelled/address) · `20260628100000` order_reviews · `20260628110000` order_review_notify_and_disputes · `20260628120000` order_rating_aggregate · `20260628130000` echtgeld_sold_count. **+ einmaliges sold_count-Backfill-UPDATE** (manuell, nicht als Migration).

### Schlüssel-Dateien
- DB-RPCs (alle SECURITY DEFINER mit Identitäts-Check): siehe Migrationen oben.
- Edge: `supabase/functions/{create-checkout-session,stripe-webhook,send-push-notification}/index.ts`.
- Web-Daten/Actions: `apps/web/lib/data/shop.ts`, `apps/web/app/actions/shop.ts`.
- Web-UI: `components/shop/{product-orders-panel,order-review,order-dispute,preorder-contact}.tsx`, `app/studio/orders/page.tsx`, `app/studio/shop/preorders/page.tsx`, `app/shop/[id]/page.tsx`, `app/u/[username]/page.tsx`, `app/studio/shop/analytics/page.tsx`, `app/shop/success/page.tsx`, `app/shop/cancelled/page.tsx`.
- App-Hooks: `lib/useShop.ts` (ProductOrder+Reviews+Disputes+Rating-Hooks), `lib/useNotifications.ts`, `lib/usePushNotifications.ts`.
- App-UI: `app/shop/{my-orders,fulfillment,[id]}.tsx`, `app/(tabs)/notifications.tsx`, `components/shop/{OrderReviewControl,OrderDisputeControl}.tsx`, `components/profile/UserProfileContent.tsx`.

### Gotchas Session 2 (sonst Zeitfresser — auch als Memory gespeichert)
- **3 Notification-Surfaces** (`vibes-three-notification-surfaces`): ein neuer `notifications.type` muss In-App (App+Web), Expo-Push **und** Web-Push kennen + im CHECK stehen, sonst falsche/generische Texte. Insert scheitert sonst **still** (RPCs `EXCEPTION WHEN OTHERS THEN NULL`).
- **Realtime-Channel-Namen müssen pro Hook-Instanz eindeutig sein** (`useUnreadShellCounts` läuft mehrfach pro Seite) — geteilter Name → „cannot add postgres_changes callbacks after subscribe()" → **jede eingeloggte Seite crasht**. Fix: Random-Suffix + try/catch. (Hat diese Session einen Prod-Crash verursacht → gefixt in `43a117f`.)
- **PostgREST-Embed** (`vibes-postgrest-profiles-embed`): `user:profiles(...)` 400t wenn die Tabelle auf `auth.users` FK't statt `profiles`.
- **`sold_count`**: nur `buy_product` (Coins) zählte hoch — Echtgeld-Verkäufe brauchen den Webhook-Bump (sonst „0× verkauft"). Coin- vs €-Umsatz sind getrennte Einheiten (Analytics zeigt beide separat).
- **ESLint `react/no-unescaped-entities`**: gerade `"` im JSX-Text bricht den Vercel-Build — deutsche typografische `„…"` nutzen.
- **zsh + Inline-`#`-Kommentare** in Befehlen: zsh interpretiert `#` interaktiv NICHT als Kommentar → wird als Argument übergeben („Invalid Function name"). In Befehlen für Zaur keine Inline-Kommentare.

### Offen / nächste Schritte (Echtgeld)
- **Produktseite Verkäufer-Bewertung** ist gebaut; ggf. weitere Plätze (Shop-Karten) optional.
- **Stripe Test→Live** + AGB/Widerruf/Impressum/GoBD **vor echten Kundenzahlungen** (Memory `vibes-stripe-coinshop`). Stripe-Branding (Logo/Farbe) im Dashboard.
- **Auto-Refund** bei Storno nach Zahlung: bewusst NICHT gebaut (Phase 2 mit Recht). Aktuell: Käufer kontaktiert Verkäufer / Admin klärt Dispute manuell.
- Bestell-KPI „Umsatz brutto" (`/studio/orders`) + „Einnahmen"-Seite sind **Coin**-denominiert (Echtgeld via Stripe-Dashboard + Shop-Analytics-€).

---

## 1. 🌟 Was diese Session gebaut wurde (alles live)

### A) EUR-Preisfeld für Vorbestellungen (`products.price_eur`)
- **Problem**: Vorbestell-Produkte (`sale_mode <> coins`) hatten keinen sinnvollen Coin-Preis → Karte zeigte „Preis siehe Beschreibung".
- **Migration `20260624170000_product_price_eur.sql` ✅**: `products.price_eur numeric(10,2)` (nullable, CHECK > 0) + `get_shop_products`/`get_saved_products` geben `price_eur` zurück (DROP+CREATE).
- **Web**: `shared/types/shop.ts` + `shared/schemas/product.ts` + `apps/web/lib/data/shop.ts` (PRODUCT_COLUMNS), `apps/web/app/actions/shop.ts` (createProduct), **„Preis (€)"-Feld** im `product-form.tsx` (erscheint nur bei Vorbestell-Produkten), Anzeige in Karte/Detail/Buy-Bar/Studio-Zeile. `formatEur`-Helper in `apps/web/lib/utils.ts`.
- **App**: `lib/useShop.ts` (`price_eur` + `formatEur`), Anzeige in `app/shop/[id].tsx` + `app/shop/index.tsx`.
- **So nutzt Zaur es**: Web Shop-Studio → Produkt „⋯ → Als Vorbestellung" → Produkt **Bearbeiten** → Feld „Preis (€)" (mit Punkt, z.B. `7.90`).

### B) Teilbare Produkt-/Video-Links mit reicher Vorschau (WhatsApp-Unfurl)
- **App teilt jetzt den HTTPS-Web-Link** (`https://serlo-web.vercel.app/p/<id>` bzw. `/shop/<id>`) statt `serlo://`/`vibes.app` → unfurlt mit Bild+Titel. (`app/shop/[id].tsx` Share, preorder-aware Preis-Text.)
- **Gebrandetes OG-Bild** (`apps/web/app/shop/[id]/opengraph-image.tsx`): Cover + Titel + €-Preis. Cover ist WebP → **Satori kann kein WebP** → on-the-fly JPEG-Konvertierung via `images.weserv.nl` (neuer Helper `apps/web/lib/og-image.ts` → `loadImageDataUri`).
- **ALLE 16 OG-Routen repariert** (`commit 69fa92d`): Satori erlaubt kein `inline-block`/`inline-flex`, jedes Element mit >1 Kind braucht `display:flex`, keine `undefined`-Style-Werte, kein WebP-`<img>`. Symptom war HTTP 200 + 0-Byte-PNG („Bild lädt nicht"). Siehe Memory `vibes-og-image-satori`.
- **WICHTIG für Zaur**: Video teilen = **Teilen-Button am Post** nutzen (`serlo-web.vercel.app/p/<id>`), NICHT Browser-Rechtsklick „Videolink kopieren" (= rohe `.mp4`, unfurlt nie).

### C) Vorbesteller kontaktieren (Verkäufer-Dashboard)
- **Migration `20260625120000_notify_preorder_buyers.sql` ✅**: SECURITY-DEFINER-RPC `notify_preorder_buyers(product_id, message)` — Verkäufer/Admin-Gate, schreibt allen Interessenten (status='interested') eine DM + setzt sie auf 'notified' (idempotent, umgeht 500ms-DM-Cooldown + product_preorders-RLS).
- **Dashboard** `/studio/shop/preorders`: **„✉️ Anschreiben"** pro Person (öffnet 1:1-DM via `getOrCreateConversation`) + **„Alle anschreiben"** pro Produkt (Dialog mit editierbarem Text). Status-Badge „✓ angeschrieben". Komponente `apps/web/components/shop/preorder-contact.tsx`.

### D) Vormerkung zurücknehmen (App + Web)
- Käufer kann seine Vormerkung selbst löschen (RLS erlaubt's, keine Migration). Web: „Zurücknehmen"-Link in der Buy-Bar; App: Button tippbar → Bestätigungs-Alert. `preordered_by_me`-Flag in `getProduct` (Web) / `useMyPreorder`-Hook (App). Commit `42879ae`.

### E) Geteilte Produkte im Chat als Karte (statt roher Text)
- Chat-Renderer erkennt `/shop/<uuid>` im Nachrichtentext → rendert Produktkarte (Cover+Titel+Preis). Funktioniert rückwirkend (kein DB-Change, Inhalt wird geparst). Web: `apps/web/components/messages/product-link-card.tsx` (Commit `2400f4b`). App: `ProductPreviewCard` in `app/messages/[id].tsx` (Commit `3e844c7`).

### F) Chat-Bugfixes (Web) — Commit `66e75d9`
- **Bild-Upload**: Storage-Bucket `chat-images` war nie angelegt → **Migration `20260625130000_chat_images_bucket.sql` ✅** (öffentlich, 10 MB, Bild-MIME, Insert nur eigener Ordner).
- **GIF doppelt**: Realtime-Dedup verglich `content` (optimistisch `null` vs DB `''`) → fix: null/'' normalisieren + `image_url` mitvergleichen.
- **Unsichtbare Hover-Buttons**: Reply/Reaktion-Icons erbten weiße Schrift auf weißem `bg-card` → `text-foreground`.

### G) Chat-Bubble-Redesign
- **Web**: eigene Bubbles **gedämpftes Graphit** (`bg-neutral-700`, vorher hartes Schwarz/Lila — Zaurs Wahl), Medien (Bild/GIF/Produkt) **randlos** (overflow-hidden Bubble, Text+Zeit im gepolsterten Footer, reines Bild → Zeit als Overlay).
- **App**: Bubbles **graphit** (`#404040`/`#48484A`, kein Blau mehr), Bilder ohne Crop (`ChatImage` mit dynamischem Seitenverhältnis via onLoad), Produkt-Cover größer.
- **App-Ausrichtung (`2528174`)**: `bubbleRow` ist jetzt **Spalten-Container**, innerer Wrapper nutzt `alignSelf`: eigene `flex-end`, fremde `flex-start`. Reply-Icon `position:absolute`. (Zaur hat in dieser Session „so passt es" zu den Kommentaren gesagt; Chat-Bubbles nicht erneut bemängelt.)

### H) Shop TikTok-Redesign + vermietbare Werbe-Banner-Fläche
- **`app/shop/index.tsx` komplett umgebaut** (TikTok-Layout): Titel+Coins → volle Suchleiste (immer sichtbar) → Menü-Shortcuts mit Icons (Bestellungen/Favoriten/Coins/Mein Shop, alle Routen existieren) → **Werbe-Banner-Karussell** (auto-swipe 3.5s + Finger, Punkte) → dünne Text-Kategorien ohne Icons (Unterstrich-Aktiv: Alle/Angebote/Physisch/Digital/Service/Sammler/Frauen, mappt auf vorhandene Filter, KEINE Migration) + Sortier-/Filter-Icon (Sheet) → Produkt-Grid (unverändert). Eine einzige FlatList (Kopf scrollt mit), „Verkaufen"-FAB bleibt.
- **Migration `20260626120000_shop_banners.sql` ✅**: Tabelle `shop_banners` als **VERMIETBARE Werbefläche** gebaut (Zaur will Plätze vermieten + eigene Werbung). Felder: tag/title/subtitle/image_url/bg_color/link/sort_order/active + Vermietung (`advertiser_label`, `starts_at`/`ends_at`) + Analytics-ready (`impression_count`/`click_count`). RLS: jeder liest aktive+im-Zeitfenster, nur Admin schreibt. RPC `get_active_shop_banners()` (SECURITY DEFINER). 3 Launch-Banner geseedet. Hook `useShopBanners` in `lib/useShop.ts`. `link`: `tab:<key>` = In-App-Kategorie, `/route` = Navigation. Voller Ad-Server (Buchung/Abrechnung) aufgeschoben bis jemand mietet.

### I) Seamless-Kommentare (Video läuft beim Öffnen weiter) + contain/Blur-Fill
- **Kern-Mechanik** (Memory `vibes-seamless-comments-video`): `CommentsSheet` Prop **`seamlessPeek`** (durchsichtige Oberkante, kein Dim-Overlay → darunterliegendes Video scheint durch) + optional **`sheetProgress`** (SharedValue, schrumpft Video in-place auf ~40%). DERSELBE Player läuft weiter — nie zweite Instanz (Falle: `RESUME_MIN_SEC=60` → kurze Clips starten bei 0). `contentFit` cover↔contain (reine Anzeige, kein Reload).
- **Feed** (`FeedItem.tsx`): seamless in-place (Video schrumpft auf 40%, läuft, Overlays faden aus). `!commentsOpen` aus actualShouldPlay entfernt.
- **Guild-Detail** (`app/guild-post/[id].tsx`, Vollbild-Pager): seamless wie Feed.
- **Guild-Karte** (`GuildCard.tsx`, Scroll-Liste): in-list `seamlessPeek` OHNE `sheetProgress`/Scroll (Instagram-Stil, Video bleibt sichtbar oben, kein Schrumpf — Scroll/Schrumpf würde via removeClippedSubviews remounten = Neustart). **Falle gefixt:** instabile `onProgress`-Prop (inline `()=>{}`) triggerte den Restart-Effekt in FeedVideo → Neustart bei jedem Re-Render. Lösung: stabile `NOOP_PROGRESS`-Konstante. Feed/Detail nutzen `useCallback` → waren nie betroffen.
- **contain + Blur-Fill überall**: Feed, Guild-Karten, Guild-Detail zeigen Medien jetzt vollständig (`contentFit="contain"`) mit unscharfem Blur-Fill-Rand statt seitlichem Cover-Beschnitt (Querformat war abgeschnitten).

### J) 💶 Phase-1 Echtgeld-Bestellsystem (physische Ware / Parfüm) — Backend + App + Web
**Leitprinzip:** Echtes Geld läuft über **deinen Stripe** (du = Verkäufer, KEIN Connect in Phase 1). Strikt getrennt vom virtuellen Coin/Diamant-System. Marktplatz-nativ entworfen („du = Verkäufer #1") → Drittverkäufer später = nur Onboarding, kein Umbau. Architektur-Details: Brain `decisions/2026-06-27-serlo-finanz-architektur`.

- **Parfüm-Bezahllogik (Zaurs Entscheidung):** Vormerken (0 €) → du sammelst → du bestellst beim Lieferanten (streckst EK vor) → Ware da → **User zahlt** → Versand. Status: `reserved → payment_requested → paid → shipped → delivered`.
- **Migration `20260627120000_shop_real_money_orders.sql` ✅**: Tabellen `seller_accounts` (Zaur als #1, Provision 0; `platform_fee_bps`/`stripe_connect_id` für später) + `product_orders` (echte €-Bestellungen, Versand/Tracking/Stripe-Felder, Status-Maschine, RLS service-write/party-read).
- **Migration `20260627130000_shop_order_flow_rpcs.sql` ✅**: SECURITY-DEFINER-RPCs `mark_preorders_payable(product)` (Ware da → erzeugt payment_requested-Orders aus Vormerkungen + Push), `set_order_shipped(order, carrier, tracking)`, `confirm_order_delivered(order)`.
- **Edge Functions deployed**: `create-checkout-session` erkennt `{ order_id }` → Stripe-Checkout (€, Versandadresse via Stripe eingesammelt). `stripe-webhook` setzt `payment_requested → paid` (claim-before-update), speichert Adresse, benachrichtigt Verkäufer.
- **App-Frontend**: `lib/useShop.ts` (ProductOrder-Typ + Hooks: useMyProductOrders, useSellerProductOrders, usePayProductOrder, useConfirmOrderDelivered, useMarkPreordersPayable, useSetOrderShipped). Screens: `app/shop/my-orders.tsx` (Käufer: bezahlen/tracken/Erhalten — Shop-Shortcut „Bestellungen" zeigt hierher), `app/shop/fulfillment.tsx` (Verkäufer: Ware-da + versendet). 
- **Web-Frontend (Parität)**: `apps/web/lib/data/shop.ts` (getMyProductOrders, getMyPreorderGroups), `apps/web/app/actions/shop.ts` (payProductOrder, markPreordersPayable, setOrderShipped, confirmOrderDelivered), `apps/web/components/shop/product-orders-panel.tsx`, eingebunden in `apps/web/app/studio/orders/page.tsx` (Toggle Käufe/Verkäufe → Abschnitt „Echtgeld-Bestellungen").
- **Vormerk-Benachrichtigung-Fix (`20260627140000`, 🔴 NOCH AUSFÜHREN)**: `express_product_interest` schrieb Notif `type='preorder_interest'`, war aber nicht in `notifications_type_check` → Insert scheiterte still. Migration erweitert den CHECK dynamisch. Renderer (App+Web) behandeln `preorder_interest`; `'gift'` fällt auf `comment_text` zurück (Bestell-Pings lesbar). „Ware ist da" (Web) zeigt jetzt **wer** (Namen) + Anzahl + seit-wann; Bestellzeilen mit Datum/Uhrzeit.

> ⚠️ **NICHT kundenreif:** Stripe noch **Test-Modus** (Memory `vibes-stripe-coinshop`), **AGB/Widerruf/Impressum/GoBD fehlen**. Zum Testen bereit, nicht für echte Kunden-Zahlungen.

> ⚠️ **Zwei Vorbestell-Oberflächen (verwirrend, sollte konsolidiert werden):** `/studio/shop/preorders` (ALT: „Alle anschreiben" = nur DM, keine Zahlung) vs `/studio/orders?role=seller` → „Ware ist da → Anfordern" (NEU: erzeugt bezahlbare Order). Idee: „Zahlung anfordern" auf die preorders-Seite holen.

---

## 2. 🌸 Parfüm-Preisstrategie (Entscheidungen — nicht neu auswürfeln)

- **Geschäft**: Öl-Parfüm 10 ml Roll-on, alkoholfrei/halal (USP gegen Duftparadies), Dupes. Recherche-Ordner: `~/perfume-price-research/` (Excel `parfuem_preise.xlsx`, `STRATEGIE.md`, `PLAN-APP-FUNNEL.md`, `SHOP-TEXTE*.md`).
- **Einkaufspreis (EK) pro Flasche**: Zaur bekannt, **GEHEIM — nicht in getrackte Dateien/UI**. Marge auf allen Stufen gesund.
- **Preis-Stufen (runde Zahlen)**: Klassiker **9,90 €**, Premium **16,90 €**, Luxus **24,90 €**, Nische **39,90 €**. Vorbesteller-Aktion optional 1 Stufe drunter.
- **Anker NICHT über „Original kostet X" bei günstigen Düften** (oft teurer als Original/10 ml) — USP ist Öl/halal/Community, nicht Preis.
- **Rabatte NIE stapeln** (−20 % Vorbesteller UND −30 % Willkommen = gefährlich auf der Einstiegsstufe). Beides existiert aktuell nur als TEXT, keine Rabatt-Engine im Code.
- **Kein Streichpreis-Feld** (Geschmacks-/Rechts-Risiko Mondpreis) — nur Endpreis. Dringlichkeit via ehrlichen Text („nach Launch X €").
- **Phasen**: 0 Vorbestellung (kein Geld) ✅ · 1 Zaurs eigener Stripe-Direktverkauf (kein Connect) **✅ GEBAUT (Test-Modus)** — siehe §1-J · 2 Marktplatz mit Connect+Escrow (erst bei Verkäufer-Nachfrage, „du = Verkäufer #1"-Architektur liegt schon). Geld-Architektur: Coins=nur digital (IAP-Pflicht), physisch=echtes Geld/Web/Stripe (Apple verbietet IAP für Physisches).
- **Wachstums-Flywheel (Zaurs Plan)**: Parfüm = Türöffner → Sammelbestellung (nur Samstag-Fenster, „ist mein Parfüm da?"-Tracking = Wiederkehr-Hook) bringt User rein → zurückkehrende Käufer werden selbst **Verkäufer** → mehr Ware → mehr Käufer. Deshalb ist der Marktplatz Wachstumsmotor, nicht Nachgedanke.
- **Geld-Pre-Mortem (wichtig):** Bei 0 Usern bringen alle plattform-abhängigen Einnahmen 0 €. Einzige funktionierende Quelle jetzt = Zaur verkauft sein Parfüm an selbst-reingebrachte Leute. **Erst Verkauf validieren, dann Maschine.** Coin-Ökonomie verdient aktuell nichts/Minus (70% Diamanten @ 0,02 € > Coin-Preis) → kalibrieren. Details: Brain `outputs/2026-06-27-serlo-geld-premortem` + `decisions/2026-06-27-serlo-monetarisierung-roadmap`.

---

## 3. 🚀 OFFEN / Nächste Schritte

1. ✅ **ERLEDIGT (Session 2)**: Bestell-/Vertrauens-System komplett. **ERLEDIGT (Session 3, §1.4)**: Stripe-Webhook-401-Fix, **Coin-Ökonomie kalibriert+live**, App/Web-Shop-Parität, **Wärme-Audit komplett** + Gift-Erfolgs-Haptik. **Keine offene Migration.**
2. **🚀 Parfüm-Launch / Phase 0 validieren** (= jetzt der eigentliche nächste Schritt): erst **offline** verkaufen (Community/Bruder), dann Leute in die App holen. 20–30 Hero-Düfte als Vorbestellung einstellen (Web Shop-Studio), Links teilen (**OHNE www!**). **Erst-Verkauf beweisen, bevor mehr gebaut wird.**
3. **Stripe Test → Live** umstellen, sobald echte Kunden zahlen sollen: Keys `sk_live_`, Live-Webhook (Memory `vibes-stripe-coinshop` hat den Plan). VORHER **AGB + Widerruf + Impressum + GoBD-Rechnung** (Anwalt/Steuerberater) — kein Rechtsrat von mir.
4. **UG (haftungsbeschränkt)** gründen, spätestens bevor Drittverkäufer (Phase 2) Geld über die Plattform bewegen. Kappt Privathaftung (Zaur angestellt). Steuerberater ab erstem stetigen Umsatz; §19 → Regelbesteuerung bei 22.000 €.
5. ✅ **ERLEDIGT (Session 3): Coin-Ökonomie kalibriert + live** — Verdienen → 12,5%, Auszahlkurs 0,02 € unverändert → Plattform behält 50-70% (Mig. `20260628150000`). Optionale Feinjustierung wg. Apple-30%-Cut: Verdienen ~10% oder iOS-Coins teurer (nicht dringend). Cashout-Rail (Stripe-Connect-Payout) bleibt Phase 4.
6. **Phase 2 — Marktplatz scharf schalten** (andere Verkäufer): Stripe Connect + KYC + Escrow + Dispute. Architektur liegt schon (seller_accounts, platform_fee). Erst bei echter Verkäufer-Nachfrage.
7. **Polish-Backlog Finanz** (Session 2 erledigt: eigene Notif-Typen ✅, App-`my-orders`-Datum ✅, Vorbestell-Konsolidierung ✅). **Noch offen/optional**: Stripe-Branding (Logo/Farbe im Dashboard); Streichpreis bewusst NICHT; Auto-Refund erst Phase 2.
8. **Altlasten**: 🔴 Google-Login-Bug („upstream request timeout" am Supabase-Callback, `docs/auth-setup.md`) · E-Mail/Resend kaputt → Android-Signup-Lücke (`docs/auth-setup.md` Schritt 1) · Referral-System erst manuell (Bruder ~10-15 %, Kunde ~10 % Erst-Rabatt), dann bauen.

---

## 4. 🚀 Deploy-Workflow (Runtime 1.30.0)
```bash
# IMMER aus /Users/zaurhatuev/vibes-app

# Web: deployt automatisch bei Push zu main (Vercel). Vor Prod-Push:
cd apps/web && npx tsc --noEmit && npm run build   # beide grün halten

# Mobile OTA (reines JS) — EAS_BUILD=1 ZWINGEND (sonst Expo-Go-Stubs im Prod-OTA)
EAS_BUILD=1 npx eas update --branch production --message "…" --non-interactive
#   → OTA zieht nur beim KALTEN App-Neustart (App-Switcher → hochwischen)!

# Native Build (nur neue native Deps) — app.json: version 1.30.0, ios.buildNumber 291
npx eas build --platform ios --profile production && npx eas submit --platform ios --latest

# Push zu GitHub (PAT aus .env.local, NIE echoen!)
TOKEN=$(grep -E '^GITHUB_TOKEN=' .env.local | cut -d= -f2-)
git push "https://x-access-token:${TOKEN}@github.com/vibestes-boop/vibes-app.git" HEAD:main
#   ⚠️ aktualisiert origin/main-Tracking NICHT → mit `git ls-remote` verifizieren.

# Edge Functions: npx supabase functions deploy <name>  (Webhooks: --no-verify-jwt)
```
- **DB-Migrationen**: `.sql` unter `supabase/migrations/` (14-stellig), **Zaur führt sie im Supabase-SQL-Editor aus.** Return-Type-Change einer RPC = DROP + CREATE.
- **Reihenfolge**: Bei Web-Selects auf neue Spalten (direktes PostgREST) → **Migration ZUERST**, dann pushen, sonst bricht der Shop (Spalte fehlt). Bei reinen RPC-Calls/Buttons ist die Reihenfolge egal.
- **Verifizieren vor Commit** (Zaur: „commits kosten Geld"): Root `npx tsc --noEmit` (Baseline seit Session 10 = **0 Fehler**) + apps/web `npm run build`.

---

## 5. ⚙️ Gotchas / Architektur
- **Ein Supabase für beide**: App (Expo) + Web (Next.js) am SELBEN Projekt (`llymwqfgujwkoxzqxrlm`). DB-Last trifft beide.
- **Externe Dienste**: Cloudflare **R2** (+ Bunny CDN) = Bilder/Videos; **LiveKit** = Live; **Stripe** (Web)/**RevenueCat** (App) = Geld; Sentry; OpenAI (KI-Bild).
- **OG-Bilder (next/og + Satori)**: 4 stumme 0-Byte-Fallen — kein `inline-block`/`inline-flex`, >1 Kind braucht `display:flex`, kein `undefined`-Style-Wert, kein WebP-`<img>` (→ `lib/og-image.ts` weserv-Helper). Debug: `next dev` + curl die Route + Logs. Memory `vibes-og-image-satori`.
- **Chat-Bild-Upload** → Storage-Bucket `chat-images` (öffentlich, eigener-Ordner-RLS).
- **App-Chat-Ausrichtung**: horizontale Bubble-Ausrichtung über **Spalten-Container + `alignSelf`** (in Row geht's nicht zuverlässig). Reply-Icon `position:absolute`.
- **Coin-Saldo** in `coins_wallets` (`coins`/`diamonds`), NICHT `profiles.coins_balance`.
- **ZWEI Bestell-Systeme nicht vermischen**: `orders` = coin/digital (total_coins) · `product_orders` = echtes € (amount_eur, Phase 1). Vormerkungen = `product_preorders`.
- **`notifications.type` hat CHECK-Constraint** — neue Typen IMMER per Migration ergänzen, sonst scheitert der Insert **still** (RPCs haben `EXCEPTION WHEN OTHERS THEN NULL`). Dynamische Erweiterung: siehe `20260627140000`. Renderer (App `app/(tabs)/notifications.tsx` + Web `components/notifications/notification-list.tsx`) müssen den Typ auch kennen.
- **Finanz-Prinzip**: nie fremdes Geld halten — echtes Geld über Stripe (Phase 1: Zaurs Account) / später Stripe Connect (lizenzierter PSP). Coins = nur digital.
- **`supabase/SCHEMA.md`** = Source-of-Truth für reale Spalten (`profiles` hat KEIN `follower_count`).
- **FlashList + numColumns** = einspaltig → Grids mit RN-FlatList. **Reanimated** statisch importieren. **Status-Bar** `useThemedStatusBar` pro Screen. **Light-Mode**: kein hartes Weiß auf theme-Flächen.
- **Pre-existing tsc-Baseline = 2** (`'rose'` in explore/guild-Styles).

---

## 6. 🧠 Gedächtnis + Über Zaur
- **Strategie/Finanz im Brain (gbrain `~/brain`)**: `decisions/2026-06-27-serlo-finanz-architektur` (Geldfluss, „du=Verkäufer #1", Connect-Zielbild), `decisions/2026-06-27-serlo-monetarisierung-roadmap` (8 Einnahmequellen, Phasen; Coin-Ökonomie jetzt als gelöst markiert), `decisions/2026-06-28-serlo-finanz-backlog` (Restposten + Einnahmequellen 4-8: jetzt-möglich/blockiert/Schritte), `outputs/2026-06-27-serlo-geld-premortem`. Lesen via `mcp__gbrain__get_page`/`search`. ⚠️ Beim Aktualisieren: `put_page` MIT `type:`+`title:`+`tags:` im Frontmatter (sonst degradiert decision→concept); `add_timeline_entry` recompiliert NICHT → put_page nutzen + get_page verifizieren (Memory `gbrain-manual-edits-need-putpage`).
- Memory: `~/.claude/projects/-Users-zaurhatuev-vibes-app/memory/` (lädt automatisch). Relevant: **`vibes-edge-webhook-verify-jwt`** (🔴 Webhooks brauchen `--no-verify-jwt`/config.toml — sonst 401, Zahlung scheitert still — NEU Session 3), `vibes-stripe-coinshop`, `vibes-shop-banner-adspace`, `vibes-seamless-comments-video`, `vibes-og-image-satori`, `vibes-shop-digital-delivery`, `vibes-ota-eas-update-stubs` (EAS_BUILD=1!), `vibes-reanimated-static-import`, `vibes-flashlist-numcolumns-bug`, `vibes-statusbar-theme`, `vibes-lightmode-contrast-bug`, `vibes-web-deps-isolation`, `gbrain-manual-edits-need-putpage`.
- **Zaur**: Solo-Gründer, deutschsprachig (tschetschenische Community). **Kostenbewusst** (validieren vor bauen; „commits kosten Geld"). Macht **DB-Migrationen + Secrets + Compute selbst** im Dashboard. **Credentials/EK NIE im Chat oder in getrackten Dateien.** Testet Mobile auf dem Gerät → iterativ OTA → Feedback (App-Neustart nötig fürs OTA!). Bevorzugt knapp/direkt/warm, eine Sache pro Commit. Neues Geschäft: **Öl-Parfüm** (Sammelbestellung), Bruder + Community als Wachstums-/Reseller-Kanal.
- **Verifikations-Grenze**: Web-Chat + App sind login-geschützt / nicht headless prüfbar — visuelle Bestätigung läuft über Zaurs Screenshots.
