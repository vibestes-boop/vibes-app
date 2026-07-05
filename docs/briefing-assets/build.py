# -*- coding: utf-8 -*-
"""Baut die self-contained SVGs, die HTML und (indirekt) die PDF fürs Team-Briefing."""
import os

REPO = "/Users/zaurhatuev/vibes-app"
ASSETS = f"{REPO}/docs/briefing-assets"
os.makedirs(ASSETS, exist_ok=True)

STYLE = (
  "text{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif}"
  ".t{font-size:14px;fill:#2C2C2A}.th{font-size:14px;font-weight:500;fill:#2C2C2A}"
  ".ts{font-size:12px;fill:#5F5E5A}"
  ".box{fill:#fff;stroke:#B4B2A9;stroke-width:.5}"
  ".arr{fill:none;stroke:#888780;stroke-width:1.5}"
  ".c-gray rect,.c-gray ellipse,rect.c-gray,ellipse.c-gray{fill:#F1EFE8;stroke:#5F5E5A;stroke-width:.5}"
  ".c-teal rect,.c-teal ellipse,rect.c-teal,ellipse.c-teal{fill:#E1F5EE;stroke:#0F6E56;stroke-width:.5}"
  ".c-purple rect,.c-purple ellipse,rect.c-purple,ellipse.c-purple{fill:#EEEDFE;stroke:#534AB7;stroke-width:.5}"
  ".c-gray .t,.c-gray .th{fill:#2C2C2A}.c-gray .ts{fill:#5F5E5A}"
  ".c-teal .t,.c-teal .th{fill:#04342C}.c-teal .ts{fill:#0F6E56}"
  ".c-purple .t,.c-purple .th{fill:#26215C}.c-purple .ts{fill:#534AB7}"
)

ARROW = ('<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" '
  'markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" '
  'stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>')

SVGS = {}

SVGS["roadmap"] = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 180" role="img"><title>Roadmap in vier Phasen</title>'
 + ARROW +
 '<g class="c-gray"><rect x="40" y="40" width="135" height="86" rx="8"/><text class="th" x="107" y="70" text-anchor="middle">Phase 0</text><text class="ts" x="107" y="92" text-anchor="middle">Vorbestellung</text><text class="ts" x="107" y="110" text-anchor="middle">validieren &#183; 0 &#8364;</text></g>'
 '<g class="c-teal"><rect x="195" y="40" width="135" height="86" rx="8"/><text class="th" x="262" y="70" text-anchor="middle">Phase 1</text><text class="ts" x="262" y="92" text-anchor="middle">Direktverkauf</text><text class="ts" x="262" y="110" text-anchor="middle">Stripe &#183; Parf&#252;m</text></g>'
 '<g class="c-gray"><rect x="350" y="40" width="135" height="86" rx="8"/><text class="th" x="417" y="70" text-anchor="middle">Phase 2</text><text class="ts" x="417" y="92" text-anchor="middle">Marktplatz</text><text class="ts" x="417" y="110" text-anchor="middle">Connect &#183; Escrow</text></g>'
 '<g class="c-gray"><rect x="505" y="40" width="135" height="86" rx="8"/><text class="th" x="572" y="70" text-anchor="middle">Phase 3</text><text class="ts" x="572" y="92" text-anchor="middle">Skalierung</text><text class="ts" x="572" y="110" text-anchor="middle">Auszahlung</text></g>'
 '<line class="arr" x1="177" y1="83" x2="193" y2="83" marker-end="url(#arrow)"/><line class="arr" x1="332" y1="83" x2="348" y2="83" marker-end="url(#arrow)"/><line class="arr" x1="487" y1="83" x2="503" y2="83" marker-end="url(#arrow)"/>'
 '<rect class="c-teal" x="40" y="146" width="13" height="13" rx="3"/><text class="ts" x="60" y="156">aktueller Fokus (Juli 2026): App-Store-Launch + Phase 1</text></svg>')

SVGS["architektur"] = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 330" role="img"><title>Technische Architektur</title>'
 + ARROW +
 '<g class="c-purple"><rect x="90" y="40" width="220" height="60" rx="8"/><text class="th" x="200" y="66" text-anchor="middle">App (iOS &#183; Android)</text><text class="ts" x="200" y="86" text-anchor="middle">Expo / React Native</text></g>'
 '<g class="c-purple"><rect x="370" y="40" width="220" height="60" rx="8"/><text class="th" x="480" y="66" text-anchor="middle">Web</text><text class="ts" x="480" y="86" text-anchor="middle">Next.js &#183; Vercel</text></g>'
 '<g class="c-teal"><rect x="70" y="150" width="540" height="62" rx="8"/><text class="th" x="340" y="176" text-anchor="middle">Supabase (Backend)</text><text class="ts" x="340" y="197" text-anchor="middle">Postgres &#183; Auth &#183; Realtime &#183; Storage &#183; Edge Functions</text></g>'
 '<g class="c-gray"><rect x="70" y="252" width="135" height="60" rx="8"/><text class="th" x="137" y="278" text-anchor="middle">Live</text><text class="ts" x="137" y="298" text-anchor="middle">LiveKit</text></g>'
 '<g class="c-gray"><rect x="215" y="252" width="135" height="60" rx="8"/><text class="th" x="282" y="278" text-anchor="middle">Medien</text><text class="ts" x="282" y="298" text-anchor="middle">R2 &#183; Bunny CDN</text></g>'
 '<g class="c-gray"><rect x="360" y="252" width="135" height="60" rx="8"/><text class="th" x="427" y="278" text-anchor="middle">Zahlungen</text><text class="ts" x="427" y="298" text-anchor="middle">Stripe &#183; RevenueCat</text></g>'
 '<g class="c-gray"><rect x="505" y="252" width="105" height="60" rx="8"/><text class="th" x="557" y="278" text-anchor="middle">Monitor</text><text class="ts" x="557" y="298" text-anchor="middle">Sentry</text></g>'
 '<line class="arr" x1="200" y1="102" x2="200" y2="148" marker-end="url(#arrow)"/><line class="arr" x1="480" y1="102" x2="480" y2="148" marker-end="url(#arrow)"/>'
 '<line class="arr" x1="137" y1="214" x2="137" y2="250" marker-end="url(#arrow)"/><line class="arr" x1="282" y1="214" x2="282" y2="250" marker-end="url(#arrow)"/><line class="arr" x1="427" y1="214" x2="427" y2="250" marker-end="url(#arrow)"/><line class="arr" x1="557" y1="214" x2="557" y2="250" marker-end="url(#arrow)"/></svg>')

SVGS["finanzen"] = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 300" role="img"><title>Finanz-Architektur</title>'
 + ARROW +
 '<rect class="c-purple" x="40" y="20" width="13" height="13" rx="3"/><text class="ts" x="60" y="30">Coins (digital)</text>'
 '<rect class="c-teal" x="230" y="20" width="13" height="13" rx="3"/><text class="ts" x="250" y="30">Echtgeld (physisch)</text>'
 '<g class="c-purple"><rect x="42" y="50" width="140" height="58" rx="8"/><text class="th" x="112" y="76" text-anchor="middle">Coins kaufen</text><text class="ts" x="112" y="95" text-anchor="middle">IAP &#183; RevenueCat</text></g>'
 '<g class="c-purple"><rect x="205" y="50" width="140" height="58" rx="8"/><text class="th" x="275" y="76" text-anchor="middle">Geschenke</text><text class="ts" x="275" y="95" text-anchor="middle">an Creator senden</text></g>'
 '<g class="c-purple"><rect x="368" y="50" width="140" height="58" rx="8"/><text class="th" x="438" y="76" text-anchor="middle">Diamanten</text><text class="ts" x="438" y="95" text-anchor="middle">12,5 % verdient</text></g>'
 '<g class="c-purple"><rect x="531" y="50" width="110" height="58" rx="8"/><text class="th" x="586" y="76" text-anchor="middle">Auszahlung</text><text class="ts" x="586" y="95" text-anchor="middle">0,02 &#8364; / Coin</text></g>'
 '<line class="arr" x1="184" y1="79" x2="203" y2="79" marker-end="url(#arrow)"/><line class="arr" x1="347" y1="79" x2="366" y2="79" marker-end="url(#arrow)"/><line class="arr" x1="510" y1="79" x2="529" y2="79" marker-end="url(#arrow)"/>'
 '<g class="c-teal"><rect x="42" y="140" width="140" height="58" rx="8"/><text class="th" x="112" y="166" text-anchor="middle">Kauf im Web</text><text class="ts" x="112" y="185" text-anchor="middle">Stripe-Checkout</text></g>'
 '<g class="c-teal"><rect x="205" y="140" width="140" height="58" rx="8"/><text class="th" x="275" y="166" text-anchor="middle">Zaurs Konto</text><text class="ts" x="275" y="185" text-anchor="middle">Phase 1 &#183; kein Connect</text></g>'
 '<g class="c-teal"><rect x="368" y="140" width="140" height="58" rx="8"/><text class="th" x="438" y="166" text-anchor="middle">Versand</text><text class="ts" x="438" y="185" text-anchor="middle">an K&#228;ufer</text></g>'
 '<g class="c-teal"><rect x="531" y="140" width="110" height="58" rx="8"/><text class="th" x="586" y="166" text-anchor="middle">Marktplatz</text><text class="ts" x="586" y="185" text-anchor="middle">Connect &#183; P2</text></g>'
 '<line class="arr" x1="184" y1="169" x2="203" y2="169" marker-end="url(#arrow)"/><line class="arr" x1="347" y1="169" x2="366" y2="169" marker-end="url(#arrow)"/><line class="arr" x1="510" y1="169" x2="529" y2="169" marker-end="url(#arrow)"/>'
 '<g class="c-gray"><rect x="42" y="228" width="599" height="48" rx="8"/><text class="th" x="341" y="257" text-anchor="middle">Grundsatz: nie fremdes Geld halten &#8212; digital &#252;ber IAP, physisch &#252;ber Stripe</text></g></svg>')

SVGS["sicherheit"] = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 320" role="img"><title>Sicherheit in f&#252;nf Schichten</title>'
 '<g class="c-gray"><rect x="60" y="40" width="560" height="46" rx="6"/><text class="th" x="78" y="62">Authentifizierung</text><text class="ts" x="78" y="79">Supabase Auth &#183; Sign in with Apple &#183; SecureStore</text></g>'
 '<g class="c-gray"><rect x="60" y="96" width="560" height="46" rx="6"/><text class="th" x="78" y="118">Datenbank</text><text class="ts" x="78" y="135">RLS auf allen Tabellen &#183; SECURITY-DEFINER-RPCs mit Identit&#228;tscheck</text></g>'
 '<g class="c-gray"><rect x="60" y="152" width="560" height="46" rx="6"/><text class="th" x="78" y="174">Zahlungen</text><text class="ts" x="78" y="191">Webhooks fail-closed &#183; atomare Idempotenz &#183; payment_status-Guards</text></g>'
 '<g class="c-gray"><rect x="60" y="208" width="560" height="46" rx="6"/><text class="th" x="78" y="230">Inhalte / UGC</text><text class="ts" x="78" y="247">Moderation (Shadow-Ban) &#183; Melden/Blockieren &#183; Server-Mute &#183; EULA</text></g>'
 '<g class="c-gray"><rect x="60" y="264" width="560" height="46" rx="6"/><text class="th" x="78" y="286">Medien &amp; Live</text><text class="ts" x="78" y="303">R2-L&#246;sch-Queue &#183; LiveKit-Admin-Tokens kurzlebig &amp; raum-begrenzt</text></g></svg>')

SVGS["monitoring"] = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 210" role="img"><title>Vier Monitoring-S&#228;ulen</title>'
 '<g class="c-gray"><rect x="40" y="40" width="140" height="104" rx="8"/><text class="th" x="110" y="66" text-anchor="middle">Sentry</text><text class="ts" x="110" y="90" text-anchor="middle">Crashes &amp; Fehler</text><text class="ts" x="110" y="108" text-anchor="middle">App + Web</text><text class="ts" x="110" y="130" text-anchor="middle">wo: sentry.io</text></g>'
 '<g class="c-gray"><rect x="193" y="40" width="140" height="104" rx="8"/><text class="th" x="263" y="66" text-anchor="middle">UptimeRobot</text><text class="ts" x="263" y="90" text-anchor="middle">Verf&#252;gbarkeit</text><text class="ts" x="263" y="108" text-anchor="middle">3 Monitore</text><text class="ts" x="263" y="130" text-anchor="middle">wo: uptimerobot</text></g>'
 '<g class="c-gray"><rect x="346" y="40" width="140" height="104" rx="8"/><text class="th" x="416" y="66" text-anchor="middle">Telegram-Alerts</text><text class="ts" x="416" y="90" text-anchor="middle">CI/Build-Fehler</text><text class="ts" x="416" y="108" text-anchor="middle">5 Workflows</text><text class="ts" x="416" y="130" text-anchor="middle">wo: Alert-Bot</text></g>'
 '<g class="c-gray"><rect x="499" y="40" width="141" height="104" rx="8"/><text class="th" x="569" y="66" text-anchor="middle">Supabase-Logs</text><text class="ts" x="569" y="90" text-anchor="middle">RPC-/DB-Fehler</text><text class="ts" x="569" y="108" text-anchor="middle">stille 400er</text><text class="ts" x="569" y="130" text-anchor="middle">wo: Dashboard</text></g>'
 '<text class="ts" x="340" y="176" text-anchor="middle">Zentrale Doku: docs/MONITORING.md &#8212; Baseline = 0 Fehler, Rot ist ein echtes Signal</text></svg>')

SVGS["marketing"] = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 350" role="img"><title>Marketing-Funnel</title>'
 '<g class="c-teal"><rect x="60" y="30" width="560" height="42" rx="6"/><text class="th" x="340" y="56" text-anchor="middle">T&#252;r&#246;ffner: Parf&#252;m (offline, Community)</text></g>'
 '<g class="c-teal"><rect x="90" y="82" width="500" height="42" rx="6"/><text class="th" x="340" y="108" text-anchor="middle">App-Installation (Referral-Links)</text></g>'
 '<g class="c-teal"><rect x="120" y="134" width="440" height="42" rx="6"/><text class="th" x="340" y="160" text-anchor="middle">Erster Wert &lt; 60 Sekunden</text></g>'
 '<g class="c-teal"><rect x="150" y="186" width="380" height="42" rx="6"/><text class="th" x="340" y="212" text-anchor="middle">Kauf (Sammelbestellung, samstags)</text></g>'
 '<g class="c-teal"><rect x="180" y="238" width="320" height="42" rx="6"/><text class="th" x="340" y="264" text-anchor="middle">Wiederkehr (Tracking, Streak)</text></g>'
 '<g class="c-teal"><rect x="210" y="290" width="260" height="42" rx="6"/><text class="th" x="340" y="316" text-anchor="middle">Weiterempfehlung &#8594; Verk&#228;ufer</text></g></svg>')

SVGS["wachstum"] = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 330" role="img"><title>Wachstums-Flywheel</title>'
 + ARROW +
 '<ellipse class="c-purple" cx="340" cy="165" rx="120" ry="46"/><text class="th" x="340" y="160" text-anchor="middle">Moat: Kultur &amp; N&#228;he</text><text class="ts" x="340" y="180" text-anchor="middle">Teip &#183; Women-Only &#183; Community</text>'
 '<g class="c-teal"><rect x="235" y="30" width="210" height="52" rx="8"/><text class="th" x="340" y="61" text-anchor="middle">Parf&#252;m bringt Nutzer rein</text></g>'
 '<g class="c-teal"><rect x="470" y="139" width="200" height="52" rx="8"/><text class="th" x="570" y="170" text-anchor="middle">Nutzer kaufen</text></g>'
 '<g class="c-teal"><rect x="235" y="248" width="210" height="52" rx="8"/><text class="th" x="340" y="279" text-anchor="middle">K&#228;ufer werden Verk&#228;ufer</text></g>'
 '<g class="c-teal"><rect x="10" y="139" width="200" height="52" rx="8"/><text class="th" x="110" y="165" text-anchor="middle">Mehr Produkte,</text><text class="th" x="110" y="183" text-anchor="middle">mehr K&#228;ufer</text></g>'
 '<path class="arr" d="M445 60 Q560 70 570 137" fill="none" marker-end="url(#arrow)"/><path class="arr" d="M570 191 Q560 285 445 278" fill="none" marker-end="url(#arrow)"/><path class="arr" d="M235 278 Q120 285 110 191" fill="none" marker-end="url(#arrow)"/><path class="arr" d="M110 139 Q120 70 235 60" fill="none" marker-end="url(#arrow)"/></svg>')


def selfcontained(svg):
    return svg.replace('role="img">', 'role="img"><style>' + STYLE + '</style>', 1)

for name, svg in SVGS.items():
    with open(f"{ASSETS}/{name}.svg", "w", encoding="utf-8") as f:
        f.write(selfcontained(svg))

print("SVGs geschrieben:", ", ".join(SVGS.keys()))

# ---- HTML fuer die PDF -------------------------------------------------------
def fig(name):
    return '<div class="fig">' + selfcontained(SVGS[name]) + '</div>'

TEAM_TABLE = '''
<table>
<tr><th>Rolle</th><th style="text-align:center">Phase 1<br><span class="muted">Validierung</span></th><th style="text-align:center">Phase 2<br><span class="muted">Wachstum</span></th><th style="text-align:center">Phase 3<br><span class="muted">Skalierung</span></th></tr>
<tr><td>Gr&uuml;nder / CEO</td><td class="c">1</td><td class="c">1</td><td class="c">1</td></tr>
<tr><td>Mobile-Entwicklung (RN/Expo)</td><td class="c">1</td><td class="c">1&ndash;2</td><td class="c">2</td></tr>
<tr><td>Backend / Web (Supabase, Next)</td><td class="c">Zaur</td><td class="c">1</td><td class="c">2</td></tr>
<tr><td>DevOps / Security</td><td class="c">geteilt</td><td class="c">0,5&ndash;1</td><td class="c">1</td></tr>
<tr><td>Product / Design</td><td class="c">0&ndash;1</td><td class="c">1</td><td class="c">1</td></tr>
<tr><td><b>Community &amp; Moderation &#9733;</b></td><td class="c">1</td><td class="c">1&ndash;2</td><td class="c">2&ndash;3</td></tr>
<tr><td>Marketing / Growth</td><td class="c">0&ndash;1</td><td class="c">1</td><td class="c">1&ndash;2</td></tr>
<tr><td>Support / Ops</td><td class="c">&mdash;</td><td class="c">1</td><td class="c">1&ndash;2</td></tr>
<tr><td>Finanz / Recht</td><td class="c">extern</td><td class="c">extern</td><td class="c">1 + extern</td></tr>
<tr style="background:#f5f3ec"><td><b>Team-Gr&ouml;&szlig;e gesamt</b></td><td class="c"><b>~3&ndash;4</b></td><td class="c"><b>~6&ndash;8</b></td><td class="c"><b>~10&ndash;14</b></td></tr>
</table>
<p class="muted" style="font-size:10pt">&#9733; = wichtigste fr&uuml;he Einstellung. &bdquo;geteilt/extern&ldquo; = keine eigene Vollzeitstelle, sondern Nebenrolle oder Dienstleister (Steuerberater, Anwalt).</p>
'''

HTML = '''<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><style>
@page{size:A4;margin:16mm 15mm}
*{box-sizing:border-box}
body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#1c1c1c;font-size:11.5pt;line-height:1.55;margin:0}
h1{font-size:22pt;font-weight:600;margin:0 0 2px}
.sub{color:#666;font-size:12pt;margin:0 0 4px}
.title-block{border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:14px}
h2{font-size:15pt;font-weight:600;margin:22px 0 6px;border-bottom:1px solid #e3e0d8;padding-bottom:4px;page-break-after:avoid}
p{margin:6px 0}
ul{margin:6px 0;padding-left:1.15em}li{margin:3px 0}
code{background:#f2f0ea;padding:1px 4px;border-radius:3px;font-size:.9em}
.fig{margin:10px 0 16px;page-break-inside:avoid}.fig svg{width:100%;height:auto}
table{width:100%;border-collapse:collapse;font-size:10.5pt;page-break-inside:avoid;margin:8px 0}
th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}
th{background:#f5f3ec;font-weight:600}
td.c{text-align:center}
.muted{color:#666}
.section{page-break-inside:avoid}
</style></head><body>

<div class="title-block">
<h1>Serlo &mdash; Strategisches Projekt-Briefing</h1>
<p class="sub">Team-Onboarding &#183; Aufbau, Finanzen, Technik, Sicherheit, Monitoring, Team, Marketing, Wachstum</p>
<p class="muted">Stand: Juli 2026 &#183; Version 1.30.0 / Build 287</p>
</div>

<div class="section"><h2>1. &Uuml;berblick &amp; Vision</h2>
<p>Serlo (Entwicklungsname Vibes) ist eine TikTok-inspirierte Social-App f&uuml;r iOS/Android und Web, gebaut f&uuml;r die tschetschenische Community und junge Erwachsene. Der Wettbewerbsvorteil ist nicht die Technik, sondern <b>N&auml;he + Kultur</b> (Teip, Women-Only, Sprache) &mdash; eine App, die sich wie Zuhause anf&uuml;hlt.</p>
<ul>
<li>Status: Produktion &mdash; Version 1.30.0 / Build 287, gerade bei Apple zur Pr&uuml;fung.</li>
<li>Kan&auml;le: App (App Store / TestFlight) und Web (serlo-web.vercel.app).</li>
<li>Gesch&auml;ftsmodell-Kern: Parf&uuml;m-Direktverkauf als T&uuml;r&ouml;ffner &rarr; Community w&auml;chst &rarr; K&auml;ufer werden selbst Verk&auml;ufer &rarr; Marktplatz.</li>
</ul>
''' + fig("roadmap") + '''</div>

<div class="section"><h2>2. Technische Architektur</h2>
<p>Ein Backend (Supabase) versorgt beide Clients aus einem Projekt; externe Spezial-Dienste h&auml;ngen dran. Wichtig: App-&Auml;nderungen gehen oft per OTA (<code>eas update</code>) ohne neuen Store-Build &mdash; nur native &Auml;nderungen brauchen einen echten Build.</p>
<ul>
<li>Clients: App = Expo / React Native (SDK 54, TypeScript); Web = Next.js auf Vercel.</li>
<li>Kern: Supabase = Postgres + Auth + Realtime + Storage + Edge Functions (Deno).</li>
<li>Live: LiveKit Cloud (WebRTC). Medien: Upload nach Cloudflare R2, Video &uuml;ber Bunny CDN.</li>
<li>Zahlungen: Stripe (Web/physisch) + RevenueCat (App-IAP/Coins). Monitoring: Sentry.</li>
</ul>
''' + fig("architektur") + '''</div>

<div class="section"><h2>3. Finanz-Architektur</h2>
<p>Zwei strikt getrennte Geld-Kreisl&auml;ufe. Grund: Apple verlangt IAP f&uuml;r Digitales, verbietet es aber f&uuml;r physische Ware &mdash; und die Plattform soll nie fremdes Geld halten.</p>
<ul>
<li><b>Digital (Coins):</b> Kauf per IAP &rarr; Geschenke an Creator &rarr; Diamanten (12,5&nbsp;% verdient) &rarr; Auszahlung 0,02&nbsp;&euro;/Coin; Plattform beh&auml;lt 50&ndash;70&nbsp;%. In v1 per Feature-Flag versteckt (sauberer Store-Start).</li>
<li><b>Physisch (Echtgeld):</b> Zahlung im Web per Stripe. Phase 1 = Zaurs eigenes Konto (kein Connect); Phase 2 = Marktplatz mit Connect + Escrow.</li>
<li>Geld-Pfade bereits geh&auml;rtet (Webhook fail-closed, atomare Idempotenz, payment_status-Guards).</li>
</ul>
''' + fig("finanzen") + '''</div>

<div class="section"><h2>4. Sicherheit</h2>
<p>In Schichten gebaut &mdash; jede f&auml;ngt einen anderen Angriff ab. Regel f&uuml;rs Team: keine neue DB-Referenz ohne RLS, keine neue Webhook-Function ohne fail-closed-Auth.</p>
''' + fig("sicherheit") + '''
<p class="muted">Es gab ein Security-Review der Geld-Pfade (Juli 2026) mit vier Fixes. Offen f&uuml;r Phase 2: seller_accounts-RLS enger fassen, Receipt-Verify aktivieren.</p>
</div>

<div class="section"><h2>5. Fehler-&Uuml;berwachung (Monitoring)</h2>
<p>Vier &Uuml;berwachungs-S&auml;ulen, zentrale Doku in <code>docs/MONITORING.md</code>. Prinzip: Baseline = 0 Fehler, jedes Rot ist ein echtes Signal. &bdquo;Keine &Auml;nderung sichtbar&ldquo; wird zuerst &uuml;ber die Logs gepr&uuml;ft, nicht geraten.</p>
''' + fig("monitoring") + '''</div>

<div class="section"><h2>6. Team &mdash; welche Rollen, wie viele Leute</h2>
<p>Heute: 1 Person (Zaur = Gr&uuml;nder + Full-Stack + Business) &mdash; das ist der gr&ouml;&szlig;te Risikofaktor (Bus-Faktor 1). Schlank starten, mit Umsatz wachsen. Die wichtigste fr&uuml;he Einstellung ist ein Community- &amp; Moderations-Lead: bei einer jungen, engen Community ist Vertrauen + Sicherheit das ganze Produkt (und in der EU ist Moderation gesetzliche Pflicht).</p>
''' + TEAM_TABLE + '''</div>

<div class="section"><h2>7. Marketing-Plan</h2>
<p>Kern-Idee (Pre-Mortem): erst validieren, dann Maschine bauen. Bei 0 Nutzern bringen plattform-abh&auml;ngige Einnahmen 0&nbsp;&euro;. Die einzige heute funktionierende Quelle: Parf&uuml;m an selbst reingebrachte Leute verkaufen &mdash; halal/alkoholfrei als echter USP.</p>
''' + fig("marketing") + '''</div>

<div class="section"><h2>8. Wachstums-Plan (Flywheel)</h2>
<p>Ein sich selbst verst&auml;rkender Kreislauf. Der Marktplatz ist kein Nachgedanke, sondern der Motor. In der Mitte sitzt der Burggraben, den kein gro&szlig;er Wettbewerber kopieren kann: Kultur &amp; N&auml;he.</p>
''' + fig("wachstum") + '''</div>

<div class="section"><h2>9. Was noch kritisch ist</h2>
<ul>
<li><b>Recht &amp; Compliance</b> (gr&ouml;&szlig;ter blinder Fleck): AGB, Widerruf, Impressum, GoBD vor Kundenzahlungen; UG gr&uuml;nden (Haftung); DSGVO + Auftragsverarbeitung (Supabase/Stripe/Sentry); EU Digital Services Act (Meldewege + Moderation sind Pflicht). Steuerberater + Anwalt jetzt extern.</li>
<li><b>Kennzahlen (KPIs):</b> D1/D7/D30-Retention, DAU/MAU, GMV, Take-Rate, CAC/LTV &mdash; daf&uuml;r fehlt ein sauberes Analytics-Dashboard.</li>
<li><b>Kosten &amp; Runway:</b> Infra (Supabase, LiveKit, R2, Bunny) skaliert mit der Nutzung; cost_health_snapshot existiert, aber Burn-Rate/Break-even braucht einen klaren Blick.</li>
<li><b>Wissen &amp; Bus-Faktor:</b> fast alles steckt in Zaurs Kopf + handoff.md/CLAUDE.md/Brain. F&uuml;rs Team: Onboarding-Doku, Runbooks (Deploy, Incident, Migrationen), sauberes Secrets-Management.</li>
<li><b>Betrieb &amp; Ausfallsicherheit:</b> DB-Backups + Wiederherstellungs-Plan, 24/7-Moderationsabdeckung bei Wachstum.</li>
</ul></div>

<div class="section"><h2>10. Empfohlene Reihenfolge</h2>
<ul>
<li><b>Einstellungs-Priorit&auml;t:</b> (1) Community- &amp; Moderations-Lead &rarr; (2) zweiter Entwickler (entlastet Zaur im Backend/Web) &rarr; (3) Marketing/Growth. Recht/Steuer sofort extern.</li>
<li><b>Zuerst validieren:</b> Erst-Verkauf des Parf&uuml;ms beweisen (Phase 1), dann Team hochfahren.</li>
<li><b>Parallel absichern:</b> UG + Rechtstexte + DSA-Meldewege, bevor Echtgeld &uuml;ber die Plattform flie&szlig;t.</li>
</ul></div>

</body></html>'''

with open(f"{REPO}/docs/briefing.html", "w", encoding="utf-8") as f:
    f.write(HTML)
print("HTML geschrieben: docs/briefing.html")
