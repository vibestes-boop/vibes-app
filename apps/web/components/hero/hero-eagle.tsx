'use client';

// -----------------------------------------------------------------------------
// HeroEagle — drei thermik-segelnde Adler über dem Bergpanorama.
//
// Kein Keyframe-Loop, sondern ein echtes Flugmodell pro Vogel (wie Adler fliegen):
//   • Eine einzige Steuergröße: die Schräglage φ (Bank). Daraus folgt physikalisch
//     die Kurve — Radius R = V²/(g·tanφ), Gierrate ψ̇ = g·tanφ/V (koordinierte Kurve).
//   • THERMIK-Phase: Kreisen, Steigen im Aufwind, die ganze Thermik driftet mit
//     dem Wind — der Kreis wandert also leicht, wie in echt.
//   • GLEIT-Phase: Ab Ausstiegshöhe (bildschirm-bewusst) rollt er aus und gleitet
//     zur nächsten Thermik — Gleitzahl E ≈ 12, Kurs über bank-begrenzte Steuerung.
//   • Kein Dauerflattern: Segeln ist flügelstill (Kondor: 1,3 % der Flugzeit
//     schlagend). Geschlagen wird nur am Ende eines zu tief gewordenen Gleitwegs.
//
// DER VOGEL IST KEIN BILD, DAS GEDREHT WIRD, sondern ein körperfestes 3D-Gerüst,
// das durch dieselbe Pinhole-Kamera geht wie seine Position:
//   • Drei körperfeste Achsen (Spannweite w, Rumpf-Hoch u, Nase t) werden pro Frame
//     projiziert; die Silhouette wird als EIN SVG-Pfad daraus gebaut. Kurs,
//     Schräglage, perspektivische Verkürzung, Dieder und Flügelschlag fallen damit
//     aus einer Rechnung.
//   • Dadurch entsteht das AUFBLITZEN kreisender Greifvögel: beim Queren steht die
//     Flügelebene fast in der Sichtlinie (scheinbare Spannweite ~16 %), beim Weg-
//     und Hinfliegen ist sie voll ausgefahren und zeigt die echte Schräglage.
//     Eine flach rotierte Silhouette kann das prinzipiell nicht — sie vollführt
//     stattdessen einen 360°-Salto pro Kreis (der Fehler, den das hier ersetzt).
//   • Planform mit Adler-Proportionen: Streckung 6,3 (Aquila gemessen 6,7), Schwanz-
//     überstand 2,7× Kopfüberstand. Gefingerte Handschwingen sind bei 12–20 px
//     Spannweite unsichtbar — die gespreizte Hand steckt stattdessen in der
//     Spitzentiefe, die im Langsamflug zunimmt.
//
// ASYNCHRONIE entsteht nicht durch Zeitversatz-Tricks, sondern physikalisch:
// Jeder Vogel hat eigene Fahrt (→ eigene Kreisdauer), eigene Steigrate, eigenes
// Thermik-Revier (links/mitte/rechts), eigene Drehrichtung, eigene Schlagfrequenz
// (inkommensurabel) — dieselbe Luftmasse (ein Wind, ein Böenfeld), drei Flüge.
//
// Rücksicht: prefers-reduced-motion → EIN Standbild statt leerem Himmel (kein rAF).
// Sonst ein einziges rAF für alle Vögel; pausiert im Hintergrund-Tab von selbst;
// dt ist geclampt. Nur transform/d/opacity — kein Layout, kein Filter, kein Blend.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';

const RAD = Math.PI / 180;

const G = 9.81;                    // m/s²
const V_GLIDE = 12;                // m/s ruhige Gleitfahrt
const V_ACC = 1.6;                 // m/s² Fahrtänderung — V ist träge, springt nie
const BANK_CIRCLE = 26 * RAD;      // Grund-Schräglage in der Thermik
const BANK_MANEUVER = 40 * RAD;    // steilere Kurve beim Manövrieren
const ROLL_RATE = 35 * RAD;        // max. Rollrate des KOMMANDOS (rad/s)
const BANK_W = 2.6;                // rad/s Eigenfrequenz der Rollantwort
const BANK_ZETA = 0.62;            // leicht unterdämpft → weiches Überschwingen
const GLIDE_RATIO = 12;            // Gleitzahl E → Sinken = V/E
const WIND = { x: 0.8, z: 0.2 };   // m/s — alle teilen dieselbe Luftmasse
const H_MIN = 26;                  // m Einstiegs-/Mindesthöhe
const H_MAX = 75;                  // m Backup-Deckel (echter Ausstieg: nearTop)
const HORIZON_Y = 0.40;            // Horizontlinie: Anteil Bühnenhöhe von unten

// ── Planform (Anteile der Halbspannweite s), 4 Stationen je Halbflügel ───────
// Streckung = 4s²/Fläche = 6,31 (Aquila gemessen 6,7 — Reynolds 2014: b 1,90 m,
// S 0,54 m²). Der Ist-Pfad hatte ~24 (Albatros/Mauersegler).
// STA_G verteilt Dieder und Schlag SPANNWEITIG: der Armflügel steigt flach an,
// das Handgelenk ist der Knick, die Hand liegt am höchsten — das charakteristische
// Aquila-V, kein Brett und kein gerades V.
const STA_Y = [0.13, 0.36, 0.58, 1.0];    // spannweitige Position
const STA_LE = [0.19, 0.16, 0.10, -0.03]; // Vorderkante (+t = nach vorn)
const STA_C = [0.40, 0.42, 0.33, 0.09];   // Flügeltiefe
const STA_G = [0.10, 0.28, 0.52, 1.0];    // Anteil an Dieder/Schlag
const HEAD_T = 0.32;                      // Kopfspitze (+t) → Überstand 0,13 s
const TAIL_T = -0.56;                     // Schwanzspitze (−t) → Überstand 0,35 s
const TIP_C_SPREAD = 0.06;                // Spitzentiefe-Zuschlag bei gespreizter Hand

// Rumpfkern als Ellipsoid (Halbachsen in Halbspannweiten): Länge, Breite, Tiefe.
// Er ist der physikalische BODEN der Silhouette — wenn die Flügelebene in der
// Sichtlinie liegt, bleibt ein Körper mit echter Dicke stehen statt einer
// Haarlinie. Ein Vogel ist kein Blatt; ein Clamp auf die Projektion wäre gelogen.
const BODY_T = 0.214, BODY_W = 0.062, BODY_U = 0.076;
// Sechseck-Stützstellen (60°) — cos/sin als Konstanten, kein Aufruf pro Frame
const HEX_C = [1, 0.5, -0.5, -1, -0.5, 0.5];
const HEX_S = [0, 0.8660254, 0.8660254, 0, -0.8660254, -0.8660254];

const DIHEDRAL = 7 * RAD;          // Segel-V („slight, upturned V")
const FLAP_UP = 38 * RAD;          // obere Umkehr (ÜBER Körperniveau — fehlte bisher)
const FLAP_DN = -48 * RAD;         // untere Umkehr
const FLAP_MID = (FLAP_UP + FLAP_DN) / 2;
const FLAP_AMPL = (FLAP_UP - FLAP_DN) / 2;
const DOWN_FRAC = 0.57;            // Abschlag ist die kraftvolle, zeitstabile Phase
const FLAP_HZ_K = 5.36;            // Hz·m → f = K/Spannweite ≈ 2,4…2,8 Hz
const FLAP_ENV = 0.38;             // s Ein-/Ausblenden der Schlag-Amplitude
const FLAP_PROB = 0.18;            // geschlagen wird bei ~15 % der Gleitschenkel
const FLAP_CLIMB = 0.55;           // m/s Höhengewinn beim Schlagen (Schlag folgenlos = Fake)
const FLAP_HEAVE = 0.05;           // ×s Rumpf-Hub um den ruhenden Kopf

const SWEEP_MIN = 6 * RAD;         // Pfeilung langsam (Thermik)
const SWEEP_MAX = 20 * RAD;        // Pfeilung schnell (Streckengleiten)
const FOLD_SPEED = 0.13;           // Spannweiten-Reduktion bei Fahrt
const FOLD_UPSTROKE = 0.24;        // Handgelenk-Faltung im Aufschlag
const TAIL_W_LO = 0.13;            // ×s gefächert (Langsamflug, passiv stabil)
const TAIL_W_HI = 0.05;            // ×s geschlossen (Streckenflug)

const TUCK_MIN = 18, TUCK_MAX = 36; // s zwischen Wing-Tucks (2,2–2,7/min)
const TUCK_DUR = 0.35;             // s Dauer (gemessen)
const TUCK_ANG = -26 * RAD;        // Flügel rasch UNTER Körperniveau
const TUCK_BANK = 6 * RAD;         // Rollantwort auf den Auftriebsverlust
const PHUG_T = 6.5;                // s Phygoid-Periode (gemessen)
const PHUG_TAU = 3.5;              // s Abklingzeit
const PHUG_A = 0.9;                // m/s Anregung durch einen Tuck
const PHUG_FLOOR = 0.18;           // m/s Grunddünung — nie exakt ruhig

const GUST_BANK = 1.2 * RAD;       // Böe wirkt auf die SOLL-Schräglage …
const GUST_LIFT = 0.10;            // … und minimal auf die Vertikalrate. Nie auf die Form.

const SPAN_MIN_PX = 11;
const EAGLE_FILL = '#0d1017';
const EAGLE_RIM = 'rgba(190,205,230,0.22)'; // Himmelslicht-Saum am Unterflügel

type Phase = 'thermal' | 'glide';

type Bird = {
  // Individuum (leichte natürliche Streuung → asynchrone Kreiszeiten)
  vCircle: number;    // m/s Kreisflug-Fahrt
  climb: number;      // m/s Steigen im Aufwind
  wingspan: number;   // m Spannweite
  turnDir: 1 | -1;    // Drehrichtung in der Thermik
  band: [number, number]; // Thermik-Revier in x (Metern) — links/mitte/rechts
  flapHz: number;     // eigene Schlagfrequenz (aus der Spannweite)
  rnd: number;        // LCG-Zustand (deterministisch, aber nicht an h gekoppelt)
  // Flugzustand
  x: number; h: number; z: number;
  psi: number; bank: number; bankCmd: number; bankVel: number;
  V: number;
  phase: Phase;
  next: { x: number; z: number };
  // Schlag
  flapBeats: number; flapPhase: number; flapAmp: number;
  // Wing-Tuck + Phygoide
  tuckIn: number; tuckT: number; tuckSide: 1 | -1;
  phugA: number; phugP: number;
  lastFade: number;
};

// Deterministischer LCG. Ersetzt Math.sin(b.h · seed): dessen Hash-Eingang war die
// aktuelle HÖHE, und die ist im Aufrufmoment determiniert (bei nearTop gilt
// h ≈ 0,383·z) → gleicher Hash, gleiches Ziel, Endlospendeln zwischen zwei Punkten.
const rnd = (b: Bird) => ((b.rnd = (b.rnd * 1664525 + 1013904223) >>> 0) / 4294967296);

// Ein Böenfeld für alle — zwei Vögel an derselben Stelle erwischen zeitversetzt
// dieselbe Böe. Korrelation ohne Synchronität, wie die geteilte Windmasse.
const gustAt = (x: number, z: number, t: number) =>
  Math.sin(x * 0.031 + t * 0.41) * 0.55 +
  Math.sin(z * 0.024 - t * 0.29) * 0.45 +
  Math.sin((x + z) * 0.017 + t * 0.63) * 0.35;

// Drei Individuen: eigene Reviere, Fahrten, Drehrichtungen, Start-Phasen.
// band = Anteil des SICHTBAREN Fensters [0..1] — nicht der Bühne. So bleiben
// die Vögel auch im Mobile-Crop (Sonnen-Fokus links beim Turm) im Bild.
function makeBirds(): Bird[] {
  const base = (
    vCircle: number, climb: number, wingspan: number, turnDir: 1 | -1,
    band: [number, number], seed: number, h: number, z: number, psi: number,
    phase: Phase, bank: number,
  ): Bird => ({
    vCircle, climb, wingspan, turnDir, band,
    flapHz: FLAP_HZ_K / wingspan,
    rnd: seed >>> 0,
    x: 0, h, z, psi, bank, bankCmd: bank, bankVel: 0,
    V: phase === 'thermal' ? vCircle : V_GLIDE,
    phase, next: { x: 0, z },
    flapBeats: 0, flapPhase: 0, flapAmp: 0,
    tuckIn: 6 + (seed % 19), tuckT: 0, tuckSide: 1,
    phugA: PHUG_FLOOR, phugP: (seed % 100) / 15.9,
    lastFade: -1,
  });
  return [
    // Steigraten gegenüber früher (0,75–1,0) angehoben — gemessen sind 1,7 m/s
    // (Steinadler instrumentiert), aber darüber verlässt der Vogel das Bild nach
    // ~1 Kreis. 1,05–1,25 ist der Kompromiss zwischen Messwert und Komposition.
    base(10, 1.15, 2.1, 1, [0.14, 0.42], 1266747, 34, 125, 0, 'thermal', BANK_CIRCLE),
    base(9.4, 1.05, 2.25, -1, [0.36, 0.64], 47117251, 46, 150, Math.PI, 'thermal', -BANK_CIRCLE),
    // startet mitten im Gleitflug
    base(10.6, 1.25, 1.95, 1, [0.58, 0.86], 78233907, 52, 118, -0.9, 'glide', 0),
  ];
}

export function HeroEagle() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const bodyRefs = useRef<(SVGPathElement | null)[]>([]);
  // 'off' = SSR/erster Client-Frame (identisch → keine Hydration-Abweichung),
  // 'still' = ein Standbild ohne rAF, 'anim' = volle Simulation.
  const [mode, setMode] = useState<'off' | 'still' | 'anim'>('off');

  useEffect(() => {
    setMode(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'still' : 'anim',
    );
  }, []);

  useEffect(() => {
    if (mode === 'off') return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const birds = makeBirds();
    let last = performance.now();
    const t0 = last;

    // Sichtbares Fenster in Bühnen-px: die 16:9-Bühne ist auf Mobile breiter
    // als der Viewport (Sonnen-Fokus-Crop) — Reviere/Guards richten sich am
    // sichtbaren Ausschnitt aus, nicht an der Bühnenmitte.
    // Größen werden hier GECACHT: der Pfad-Write pro Frame würde sonst zusammen
    // mit einem clientWidth-Read jeden Frame ein Layout erzwingen.
    let visLeft = 0, visW = 0, W = 0, Hpx = 0, f = 0;
    const measure = () => {
      const sceneR = wrap.getBoundingClientRect();
      const rootR = (wrap.parentElement?.parentElement ?? wrap).getBoundingClientRect();
      visLeft = Math.max(0, rootR.left - sceneR.left);
      visW = Math.min(sceneR.width, rootR.width);
      W = wrap.clientWidth;
      Hpx = wrap.clientHeight;
      f = Hpx * 1.15; // ~50° FOV — realistische Kamera
    };
    measure();

    // Ziel im eigenen Revier (Anteil des sichtbaren Fensters), zurückgerechnet
    // in Welt-x für die gewählte Tiefe — deterministisch „zufällig" gestreut.
    const pickNext = (b: Bird) => {
      const z = 110 + rnd(b) * 50; // 110 … 160 m
      const u = b.band[0] + rnd(b) * (b.band[1] - b.band[0]);
      const sx = visLeft + u * visW;
      return { x: ((sx - W / 2) * z) / f, z };
    };
    // Startpositionen einmalig in die Reviere legen (Kreisbahn um das Ziel)
    for (const b of birds) {
      const t = pickNext(b);
      b.next = { ...t };
      const R = (b.vCircle * b.vCircle) / (G * Math.tan(BANK_CIRCLE));
      b.x = t.x - R; b.z = t.z;
    }

    const step = (now: number, dt: number) => {
      const tSec = (now - t0) / 1000;
      if (W <= 0 || Hpx <= 0) return;

      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        const gv = gustAt(b.x, b.z, tSec);

        // ── Steuerung: Ziel-Schräglage je Phase ─────────────────────────────
        let targetBank: number;
        const vTarget = b.phase === 'thermal' ? b.vCircle : V_GLIDE;
        // Fahrt ist eine träge Zustandsgröße. Ohne das springt V am Phasenwechsel
        // in einem Frame von 10 auf 12 m/s — und weil die Flügelform an V hängt,
        // würde die Silhouette in 16 ms sichtbar umklappen.
        b.V += Math.max(-V_ACC * dt, Math.min(V_ACC * dt, vTarget - b.V));
        const V = b.V;

        let hdot: number;
        if (b.phase === 'thermal') {
          // Schräglage nimmt mit der Steighöhe ab (Williams 2018: 25–35 % früh,
          // dann flacher) → der Kreis weitet sich sichtbar auf: R 16,9 → 23,5 m
          const hN = Math.min(1, Math.max(0, (b.h - H_MIN) / (H_MAX - H_MIN)));
          targetBank = BANK_CIRCLE * b.turnDir * (1.22 - 0.3 * hN);
          hdot = b.climb;
          // Ausstieg bildschirm-bewusst: kurz bevor er oben/seitlich aus dem
          // Blickfeld steigt (oder Backup H_MAX), gleitet er ab.
          const nearTop = Hpx * (1 - HORIZON_Y) - (f * b.h) / b.z < Hpx * 0.16;
          const sxNow = W / 2 + (f * b.x) / b.z;
          const offstage = visW > 0 && (sxNow < visLeft + visW * 0.06 || sxNow > visLeft + visW * 0.94);
          if (b.h > H_MAX || nearTop || offstage) { b.phase = 'glide'; b.next = pickNext(b); }
        } else {
          hdot = -V_GLIDE / GLIDE_RATIO;                   // Gleiten kostet Höhe
          // Kurs auf die nächste Thermik: Bank proportional zum Kursfehler
          const want = Math.atan2(b.next.x - b.x, b.next.z - b.z);
          let err = want - b.psi;
          while (err > Math.PI) err -= 2 * Math.PI;
          while (err < -Math.PI) err += 2 * Math.PI;
          targetBank = Math.max(-BANK_MANEUVER, Math.min(BANK_MANEUVER, err * 1.6));
          const dist = Math.hypot(b.next.x - b.x, b.next.z - b.z);
          if (dist < 22 || b.h < H_MIN) {
            b.phase = 'thermal';
            // Nicht mehr rituell bei jedem Einstieg: der Andenkondor schlägt
            // 1,3 % der Flugzeit. Geschlagen wird am Ende eines zu tief
            // gewordenen Gleitwegs — oder in 18 % der Fälle.
            if (b.h < H_MIN + 8 || rnd(b) < FLAP_PROB) {
              b.flapBeats = 6 + ((rnd(b) * 3) | 0);        // 6…8 Schläge ≈ 2,4–3,1 s
            }
          }
        }

        // ── Wing-Tuck: Reaktion auf Turbulenz, nicht auf einen Timer ────────
        // (Reynolds 2014, Steppenadler, 2 594 Tucks: lokale Windstärke ist der
        //  stärkste Prädiktor — deshalb läuft die Uhr in Böen schneller.)
        b.tuckIn -= dt * (0.6 + 0.9 * Math.abs(gv));
        if (b.tuckIn <= 0) {
          b.tuckIn = TUCK_MIN + rnd(b) * (TUCK_MAX - TUCK_MIN);
          b.tuckT = TUCK_DUR;
          b.tuckSide = rnd(b) < 0.5 ? -1 : 1;
          b.phugA = PHUG_A;                                 // Tuck regt die Phygoide an
        }
        const tuckU = b.tuckT > 0 ? Math.sin(Math.PI * (1 - b.tuckT / TUCK_DUR)) : 0;
        if (b.tuckT > 0) b.tuckT -= dt;
        // Der eingezogene Flügel verliert Auftrieb → der Vogel rollt dorthin
        targetBank += b.tuckSide * TUCK_BANK * tuckU;
        // Böe wirkt auf den SOLLWERT (Starrkörper + Regelantwort), nie auf die
        // Flügelform — Rauschen direkt auf die Spitzenhöhe läse sich als Summen.
        targetBank += GUST_BANK * gv;

        // ── Rollkette: Rate-Limit auf das KOMMANDO, Istwert folgt gedämpft ──
        // Ein reiner Rate-Limiter erzeugt eine lineare Rampe mit unendlich
        // scharfem Stopp; ein Tier schwingt leicht über und fängt sich.
        b.bankCmd += Math.max(-ROLL_RATE * dt, Math.min(ROLL_RATE * dt, targetBank - b.bankCmd));
        b.bankVel += (BANK_W * BANK_W * (b.bankCmd - b.bank) - 2 * BANK_ZETA * BANK_W * b.bankVel) * dt;
        b.bank += b.bankVel * dt;

        // ── Schlagzyklus: kontinuierliche Phase statt 4-Hz-Posen-Tausch ─────
        const wantAmp = b.flapBeats > 0 ? 1 : 0;
        const dA = dt / FLAP_ENV;
        b.flapAmp += Math.max(-dA, Math.min(dA, wantAmp - b.flapAmp));
        if (b.flapAmp > 0.001 || b.flapBeats > 0) {
          b.flapPhase += 2 * Math.PI * b.flapHz * dt;
          if (b.flapPhase >= 2 * Math.PI) {
            b.flapPhase -= 2 * Math.PI;
            if (b.flapBeats > 0) b.flapBeats--;
          }
        } else b.flapPhase = 0;

        const p = b.flapPhase / (2 * Math.PI);
        let gFlap: number, upstroke: number;
        if (p < DOWN_FRAC) {
          // Abschlag (57 % der Zykluszeit): kraftvoll, zeitstabil
          gFlap = FLAP_MID + FLAP_AMPL * Math.cos((Math.PI * p) / DOWN_FRAC);
          upstroke = 0;
        } else {
          // Aufschlag (43 %, komprimiert): Handgelenk angewinkelt, Flügel eingeklappt
          const q = (p - DOWN_FRAC) / (1 - DOWN_FRAC);
          gFlap = FLAP_MID - FLAP_AMPL * Math.cos(Math.PI * q);
          upstroke = Math.sin(Math.PI * q);
        }
        const gam = DIHEDRAL + b.flapAmp * (gFlap - DIHEDRAL); // Amp 0 → exakt Segel-Dieder
        const tuckFold = b.flapAmp * upstroke;
        // Schlagen bringt Höhe — ein Vogel, der schlägt und nichts gewinnt, ist Fake
        hdot += FLAP_CLIMB * b.flapAmp;

        // ── Phygoide: die Bahn ist nie exakt glatt ──────────────────────────
        b.phugA = Math.max(PHUG_FLOOR, b.phugA * Math.exp(-dt / PHUG_TAU));
        b.phugP += ((2 * Math.PI) / PHUG_T) * dt;
        hdot += b.phugA * Math.sin(b.phugP) + GUST_LIFT * gv;

        // ── Integration ─────────────────────────────────────────────────────
        b.psi += ((G * Math.tan(b.bank)) / V) * dt;
        b.h += hdot * dt;
        // Grundgeschwindigkeit = Luftfahrt + Wind (Thermik driftet identisch)
        b.x += (V * Math.sin(b.psi) + WIND.x) * dt;
        b.z += (V * Math.cos(b.psi) + WIND.z) * dt;
        b.next.x += WIND.x * dt; b.next.z += WIND.z * dt;

        const svg = svgRefs.current[i];
        const path = pathRefs.current[i];
        const body = bodyRefs.current[i];
        if (!svg || !path || !body || b.z <= 30) continue;

        // ── Projektion: Position ────────────────────────────────────────────
        const sx = W / 2 + (f * b.x) / b.z;
        const sy = Hpx * (1 - HORIZON_Y) - (f * b.h) / b.z;
        const spanPx = Math.max(SPAN_MIN_PX, (f * b.wingspan) / b.z);

        // ── Projektion: körperfester Rahmen ─────────────────────────────────
        // Luftfahrt-Richtung (nicht Grundgeschwindigkeit) → der Windversatz
        // erzeugt automatisch den korrekten Vorhaltewinkel.
        const sT = Math.max(-0.3, Math.min(0.3, hdot / V));   // sin(Bahnneigung)
        const cT = Math.sqrt(1 - sT * sT);
        const cP = Math.cos(b.psi), sP = Math.sin(b.psi);
        const cB = Math.cos(b.bank), sB = Math.sin(b.bank);

        // Nase
        const tX = sP * cT, tH = sT, tZ = cP * cT;
        // Rechte Flügelachse und Rumpf-Hoch bei Schräglage 0 …
        const w0X = cP, w0Z = -sP;
        const u0X = -sT * sP, u0H = cT, u0Z = -sT * cP;
        // … dann um die Nase gerollt (φ>0 = rechter Flügel tief). Exakt orthonormal.
        const wX = w0X * cB - u0X * sB, wH = -u0H * sB, wZ = w0Z * cB - u0Z * sB;
        const uX = w0X * sB + u0X * cB, uH = u0H * cB, uZ = w0Z * sB + u0Z * cB;

        // Projektions-Jacobi (ohne den gemeinsamen Faktor f/z — der steckt im
        // CSS-scale, dadurch ist der Pfad entfernungsunabhängig).
        // Herleitung: sx = W/2 + f·x/z, sy = C − f·h/z.
        const ax = b.x / b.z, ah = b.h / b.z;
        const jtx = tX - ax * tZ, jty = ah * tZ - tH;
        const jwx = wX - ax * wZ, jwy = ah * wZ - wH;
        const jux = uX - ax * uZ, juy = ah * uZ - uH;

        // ── Form aus dem Flugzustand ────────────────────────────────────────
        const spd01 = Math.min(1, Math.max(0, (V - b.vCircle) / (V_GLIDE - b.vCircle)));
        const tanSweep = Math.tan(SWEEP_MIN + (SWEEP_MAX - SWEEP_MIN) * spd01);
        const foldBase = (1 - FOLD_SPEED * spd01) * (1 - FOLD_UPSTROKE * tuckFold);
        const tailW = TAIL_W_LO + (TAIL_W_HI - TAIL_W_LO) * spd01;
        // Gespreizte Hand statt gezeichneter Finger: die Spitzentiefe wächst im
        // Langsamflug (gemessen: einzelne Finger sind bis 36 px 0 Gerätepixel).
        const tipC = STA_C[3] + TIP_C_SPREAD * (1 - spd01);
        // Rumpf hebt und senkt sich beim Schlag um den ruhenden Kopf herum
        // (gemessen: Kopf ~5× ruhiger als der Rumpf).
        const heave = FLAP_HEAVE * b.flapAmp * Math.cos(2 * Math.PI * p);

        // Wing-Tuck asymmetrisch — genau das kann eine rotierte Silhouette nicht
        let gamR = gam, gamL = gam, foldR = foldBase, foldL = foldBase;
        if (tuckU > 0) {
          if (b.tuckSide > 0) { gamR += TUCK_ANG * tuckU; foldR *= 1 - 0.16 * tuckU; }
          else { gamL += TUCK_ANG * tuckU; foldL *= 1 - 0.16 * tuckU; }
        }

        // ── Silhouette: EIN Pfad aus 19 projizierten Punkten ────────────────
        // Kopf ist der lokale Nullpunkt (kostet nichts, hält den Kopf ruhig,
        // während Rumpf/Flügel/Schwanz um ihn herum arbeiten).
        const hX = 50 * HEAD_T * jtx, hY = 50 * HEAD_T * jty;
        const pt = (aw: number, au: number, at: number) =>
          `${(50 * (aw * jwx + au * jux + at * jtx) - hX).toFixed(1)} ` +
          `${(50 * (aw * jwy + au * juy + at * jty) - hY).toFixed(1)}`;

        let d = `M0 0`; // Kopfspitze
        // rechte Vorderkante auswärts, dann rechte Hinterkante einwärts
        for (let s = 0; s < 2; s++) {
          const sign = s === 0 ? 1 : -1;              // 1 = rechts, −1 = links
          const gm = s === 0 ? gamR : gamL;
          const fo = s === 0 ? foldR : foldL;
          const seq: string[] = [];
          for (let k = 0; k < 4; k++) {
            const idx = k;
            const a = fo * STA_Y[idx];
            const gg = gm * STA_G[idx];
            const aw = sign * a * Math.cos(gg);
            const au = a * Math.sin(gg) + heave;
            const at = STA_LE[idx] - a * tanSweep;
            const c = idx === 3 ? tipC : STA_C[idx];
            seq[idx] = pt(aw, au, at);                 // Vorderkante
            seq[4 + idx] = pt(aw, au, at - c);         // Hinterkante
          }
          if (s === 0) {
            d += ` L${seq[0]} L${seq[1]} L${seq[2]} L${seq[3]}` +
                 ` L${seq[7]} L${seq[6]} L${seq[5]} L${seq[4]}` +
                 ` L${pt(tailW, heave, TAIL_T)} L${pt(-tailW, heave, TAIL_T)}`;
          } else {
            d += ` L${seq[4]} L${seq[5]} L${seq[6]} L${seq[7]}` +
                 ` L${seq[3]} L${seq[2]} L${seq[1]} L${seq[0]}`;
          }
        }
        d += ' Z';
        path.setAttribute('d', d);

        // ── Rumpfkern: projiziertes Ellipsoid, eigener Pfad HINTER den Flügeln ─
        // Die Projektion eines Ellipsoids ist exakt eine Ellipse; ihre Form steckt
        // in S = M·Mᵀ mit M = [a_w·jw, a_u·ju, a_t·jt]. Eigenwerte → Halbachsen,
        // Eigenvektor → Lage. Sechs Stützstellen reichen bei 1–3 px.
        const aX = 50 * BODY_W * jwx, aY = 50 * BODY_W * jwy;
        const bX = 50 * BODY_U * jux, bY = 50 * BODY_U * juy;
        const cX = 50 * BODY_T * jtx, cY = 50 * BODY_T * jty;
        const s11 = aX * aX + bX * bX + cX * cX;
        const s12 = aX * aY + bX * bY + cX * cY;
        const s22 = aY * aY + bY * bY + cY * cY;
        const tr = s11 + s22;
        const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - (s11 * s22 - s12 * s12)));
        const r1 = Math.sqrt(Math.max(0, tr / 2 + disc));
        const r2 = Math.sqrt(Math.max(0, tr / 2 - disc));
        const ea = 0.5 * Math.atan2(2 * s12, s11 - s22);
        const e1x = Math.cos(ea), e1y = Math.sin(ea);
        const bodyX = 50 * heave * jux - hX, bodyY = 50 * heave * juy - hY;
        let bd = '';
        for (let j = 0; j < 6; j++) {
          const px = bodyX + r1 * HEX_C[j] * e1x - r2 * HEX_S[j] * e1y;
          const py = bodyY + r1 * HEX_C[j] * e1y + r2 * HEX_S[j] * e1x;
          bd += `${j === 0 ? 'M' : ' L'}${px.toFixed(1)} ${py.toFixed(1)}`;
        }
        body.setAttribute('d', bd + ' Z');

        // Größe trägt allein das CSS-scale — immer herunterskaliert, nie hoch.
        // hX/hY gleicht den Kopf-Ursprung des Pfads aus, damit der Schwerpunkt
        // dort sitzt, wo die Physik ihn hat (der Kopf steht davor, wie im Tier).
        const k = spanPx / 100;
        svg.style.transform =
          `translate(${(sx + k * hX).toFixed(1)}px, ${(sy + k * hY).toFixed(1)}px) ` +
          `scale(${k.toFixed(4)}) translate(-50%, -50%)`;

        // Luftperspektive: weiter weg = blasser (Spanne 0,08 → 0,19 geöffnet)
        const fade = Math.max(0.52, Math.min(0.95, 1.28 - b.z / 260));
        if (Math.abs(fade - b.lastFade) > 0.004) {
          svg.style.opacity = fade.toFixed(2);
          b.lastFade = fade;
        }
      }
    };

    let raf = 0;
    if (mode === 'still') {
      // Ein Standbild statt leerem Himmel — Bewegung entfernen, nicht Inhalt.
      step(last, 0);
    } else {
      const tick = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        step(now, dt);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => {
      measure();
      if (mode === 'still') step(performance.now(), 0);
    });
    ro.observe(wrap);

    return () => { if (raf) cancelAnimationFrame(raf); ro.disconnect(); };
  }, [mode]);

  if (mode === 'off') return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          data-eagle={i}
          ref={(el) => { svgRefs.current[i] = el; }}
          viewBox="-75 -75 150 150"
          width={150}
          height={150}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transformOrigin: '0 0',
            willChange: 'transform',
            overflow: 'visible',
          }}
        >
          {/* Der Saum liegt HINTER der Füllung (paint-order) und skaliert nicht mit
              (non-scaling-stroke) — sonst wäre er bei scale ≈ 0,15 auf 0,2 px
              eingedampft. Er macht den Vogel vor gleich dunklen Gipfeln und im
              Nachthimmel überhaupt erst sichtbar: eine Silhouette ist ein
              Gegenlicht-Phänomen, man sieht nachts eine KANTE, keine graue Fläche.
              Der frühere drop-shadow war physikalisch falsch (ein Vogel in 130 m
              Luft wirft keinen Schatten auf den Himmel) und ein zusätzlicher
              Filterpass über dem WebGL-Hero. */}
          {/* Rumpfkern liegt HINTER den Flügeln: sein Saum stört die Silhouette
              nicht, wird aber sichtbar, sobald die Flügelebene in der Sichtlinie
              liegt und nur noch der Körper übrig bleibt. */}
          <path
            ref={(el) => { bodyRefs.current[i] = el; }}
            fill={EAGLE_FILL}
            stroke={EAGLE_RIM}
            strokeWidth={1.4}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            paintOrder="stroke"
            d="M0 0"
          />
          <path
            ref={(el) => { pathRefs.current[i] = el; }}
            fill={EAGLE_FILL}
            stroke={EAGLE_RIM}
            strokeWidth={1.4}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            paintOrder="stroke"
            d="M0 0"
          />
        </svg>
      ))}
    </div>
  );
}
