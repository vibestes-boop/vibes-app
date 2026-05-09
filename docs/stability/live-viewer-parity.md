# Live Viewer Parity Plan

Ziel: Der Serlo/Vibes Live-Viewer soll sich wie ein echtes Desktop-Produkt anfuehlen:
links Navigation, mittig Theater/Player, rechts Zuschauer und Chat, unten ein sauberer
Gift-/Action-Dock. Die Referenz ist nicht "TikTok kopieren", sondern dieselbe
Produktqualitaet: klare Flaechen, stabile Abstaende, schnelle Interaktion.

## Erledigt

- Desktop-Shell fuer `/live/[id]`: linke Live-Navigation, zentraler Stage-Bereich,
  rechte Zuschauer-/Chat-Spalte.
- Mobile bleibt immersiv und nutzt weiter das Overlay-Verhalten.
- Kommentare respektieren deaktivierte/follower-only Chats auch im Desktop-Panel.
- Cookie-Banner ist auf Live-/Story-Routen kompakter und blockiert die Stage nicht.
- Action-Bar ist auf Desktop kein generischer Button-Haufen mehr, sondern ein
  horizontaler Stage-Dock.
- Rechte Spalte hat eine kompakte Zuschauer-Preview aus Chat-Aktivitaet.
- Beendete Streams loesen keine unnoetigen Mobile-Gift-Queries mehr aus.
- Gift-Katalog und Gift-Events nutzen wieder das produktive Schema:
  `gift_catalog` + `gift_transactions`. Die vorherigen `live_gifts`/
  `live_gift_catalog`-Zugriffe waren nicht mit den vorhandenen Migrationen
  synchron und fuehrten zu 404s.
- Gift-Ziele sind per Feature-Flag (`NEXT_PUBLIC_LIVE_GIFT_GOALS_ENABLED=1`)
  gekapselt, bis `live_gift_goals` wirklich migriert ist.
- Eine Migration ergaenzt Viewer-Read-Zugriff und Realtime-Publication fuer
  `gift_transactions`, damit Top-Gifter/Animationen aus echten Events kommen.
- Desktop-Stage kann unterhalb des Players empfohlene aktive Livestreams zeigen,
  ohne den mobilen Fullscreen-Viewer zu veraendern.
- Rechte Zuschauer-Preview hat eine anklickbare Mini-Profilkarte mit Follow- und
  Profil-Aktion.
- Rechte Zuschauer-Preview mischt jetzt echte Chat- und Gift-Aktivitaet aus
  `live_comments` und `gift_transactions`, sortiert nach Coins/Aktivitaet und
  aktualisiert per Realtime.
- Rechte Zuschauer-Preview kann nach Migration `get_live_session_audience()`
  echte aktive Viewer aus `live_session_viewers` nutzen. Bis die Migration
  ausgerollt ist, bleibt der Chat-/Gift-Fallback aktiv.
- Host/Moderator sehen in der Zuschauer-Preview schnelle Timeout-Aktionen
  direkt in der Mini-Profilkarte.
- Player-Controls haben ein ruhiges Einstellungs-Popover fuer Qualitaetsobergrenze
  und Bildmodus statt loser Einzelbuttons.
- Stage-Dock hat ein eigenes Teilen-/Melden-Popover mit System-Share, Link,
  WhatsApp, Telegram und E-Mail.
- Aktive Viewer-Overlays fuer Gifts, Sticker, platzierte Produkte, Polls,
  Battle, Shopping, Duet-Invites und Welcome-Toasts werden jetzt clientseitig
  deferred geladen. Beendete Streams ziehen diese Live-Bundles nicht mehr mit.
- Action-Bar-Dialoge fuer Geschenke und Poll-Start werden erst nach Klick
  geladen, damit der initiale Viewer nicht alle schweren Panels vorlaedt.
- Desktop- und Mobile-Chat werden erst nach der Viewport-Entscheidung als
  eigener Chunk geladen. Dadurch rendert Desktop nicht kurz das Mobile-Overlay
  und der Initial-Bundle zieht nicht beide Chat-Varianten gleichzeitig.
- Gift-Leaderboard wird ebenfalls deferred geladen, weil es nur fuer aktive
  Streams nach Client-Start gebraucht wird.
- Das vollstaendige Zuschauer-Modal wird erst nach Klick auf den Viewer-Count
  geladen; der initiale Live-Viewer zieht nur den leichten Count-Button.
- Zuschauer-Modal und rechter Rail nutzen dieselbe vorbereitete
  `get_live_session_audience()`-Quelle fuer echte aktive Viewer und fallen
  ansonsten auf Gifts/Kommentare zurueck.

## Noch Fehlend

- Aktive Live-Session visuell pruefen: aktuell gab es keine aktive Session, nur
  beendete Streams. Der Dock muss noch in echter Active-Live-Situation gesehen
  werden.
- Gift-Ziele sauber entscheiden: entweder Migration fuer `live_gift_goals`
  produktiv ausrollen oder Feature wieder aus dem Host-Panel entfernen.
- Rechte Spalte live pruefen: echte Join-/Presence-Liste ist vorbereitet, muss
  nach Migration mit mehreren eingeloggten Test-Usern gegen eine aktive Session
  validiert werden.
- Player-Menues ausbauen: weitere Stream-Aktionen sollen als ruhige Popovers
  erscheinen; Qualitaet, Bildmodus, Vollbild, Audio, Teilen und Melden sind
  bereits verankert.
- Bundle-Groesse weiter messen und senken: Live-Overlays, Chat-Varianten und
  die ersten Action-Bar-Dialoge sind gesplittet; als naechstes muessen die
  verbleibenden Moderation-/Host-Panels im Produktionsbuild geprueft werden.
- Native-Paritaet danach pruefen: die App soll dieselben Backend-Regeln und
  Performance-Grenzen einhalten, aber nicht zwingend dasselbe Desktop-Layout.

## Naechste Sichere Schritte

1. Die neue `gift_transactions`-Migration gegen Supabase ausrollen.
2. Eine aktive Test-Live-Session starten und Desktop/Mobile Screenshots gegen
   `/live/[id]` aufnehmen.
3. Gift-Ziele final entscheiden: `live_gift_goals` migrieren oder das Goal-UI
   bewusst ausblenden lassen.
4. Neue `get_live_session_audience()`-Migration ausrollen und mit zwei
   eingeloggten Viewer-Accounts pruefen.
5. Produktionsbuild-Bundle von `/live/[id]` weiter senken: aktueller Stand im
   lokalen Build ist `16.9 kB` Route Size und `335 kB First Load JS`.
