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
//   • Kein Dauerflattern: Segeln ist flügelstill; nur beim Thermik-Einstieg
//     ein kurzer Schlagimpuls, so machen es echte Adler.
//   • Perspektive: Pinhole-Projektion — Größe, Tempo und Deckkraft (Luft-
//     perspektive) folgen aus der Entfernung, nicht aus Design-Werten.
//
// ASYNCHRONIE entsteht nicht durch Zeitversatz-Tricks, sondern physikalisch:
// Jeder Vogel hat eigene Fahrt (→ eigene Kreisdauer), eigene Steigrate, eigenes
// Thermik-Revier (links/mitte/rechts), eigene Drehrichtung und Start-Phase —
// dieselbe Luftmasse (ein Wind), aber drei unabhängige Flüge.
//
// Rücksicht: prefers-reduced-motion → gar nicht rendern. Ein einziges rAF für
// alle Vögel; pausiert im Hintergrund-Tab von selbst; dt ist geclampt.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';

const G = 9.81;                    // m/s²
const V_GLIDE = 12;                // m/s ruhige Gleitfahrt
const BANK_CIRCLE = (26 * Math.PI) / 180;    // Schräglage in der Thermik
const BANK_MANEUVER = (40 * Math.PI) / 180;  // steilere Kurve beim Manövrieren
const ROLL_RATE = (35 * Math.PI) / 180;      // max. Rollrate rad/s
const GLIDE_RATIO = 12;            // Gleitzahl E → Sinken = V/E
const WIND = { x: 0.8, z: 0.2 };  // m/s — alle teilen dieselbe Luftmasse
const H_MIN = 26;                  // m Einstiegs-/Mindesthöhe
const H_MAX = 75;                  // m Backup-Deckel (echter Ausstieg: nearTop)
const HORIZON_Y = 0.40;            // Horizontlinie: Anteil Bühnenhöhe von unten

type Phase = 'thermal' | 'glide';

type Bird = {
  // Individuum (leichte natürliche Streuung → asynchrone Kreiszeiten)
  vCircle: number;    // m/s Kreisflug-Fahrt
  climb: number;      // m/s Steigen im Aufwind
  wingspan: number;   // m Spannweite
  turnDir: 1 | -1;    // Drehrichtung in der Thermik
  band: [number, number]; // Thermik-Revier in x (Metern) — links/mitte/rechts
  seed: number;       // deterministische „Zufalls"-Streuung
  // Flugzustand
  x: number; h: number; z: number;
  psi: number; bank: number;
  phase: Phase;
  thermal: { x: number; z: number };
  next: { x: number; z: number };
  flapUntil: number;
};

// Drei Individuen: eigene Reviere, Fahrten, Drehrichtungen, Start-Phasen.
// band = Anteil des SICHTBAREN Fensters [0..1] — nicht der Bühne. So bleiben
// die Vögel auch im Mobile-Crop (Sonnen-Fokus links beim Turm) im Bild.
function makeBirds(): Bird[] {
  return [
    {
      vCircle: 10, climb: 0.9, wingspan: 2.1, turnDir: 1, band: [0.14, 0.42], seed: 12.9898,
      x: 0, h: 34, z: 125, psi: 0, bank: BANK_CIRCLE, phase: 'thermal',
      thermal: { x: 0, z: 125 }, next: { x: 0, z: 125 }, flapUntil: 0,
    },
    {
      vCircle: 9.4, climb: 0.75, wingspan: 2.25, turnDir: -1, band: [0.36, 0.64], seed: 47.117,
      x: 0, h: 46, z: 150, psi: Math.PI, bank: -BANK_CIRCLE, phase: 'thermal',
      thermal: { x: 0, z: 150 }, next: { x: 0, z: 150 }, flapUntil: 0,
    },
    {
      // startet mitten im Gleitflug
      vCircle: 10.6, climb: 1.0, wingspan: 1.95, turnDir: 1, band: [0.58, 0.86], seed: 78.233,
      x: 0, h: 52, z: 118, psi: -0.9, bank: 0, phase: 'glide',
      thermal: { x: 0, z: 138 }, next: { x: 0, z: 138 }, flapUntil: 0,
    },
  ];
}

export function HeroEagle() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const glideRefs = useRef<(SVGPathElement | null)[]>([]);
  const flapRefs = useRef<(SVGPathElement | null)[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const birds = makeBirds();
    let last = performance.now();

    // Sichtbares Fenster in Bühnen-px: die 16:9-Bühne ist auf Mobile breiter
    // als der Viewport (Sonnen-Fokus-Crop) — Reviere/Guards richten sich am
    // sichtbaren Ausschnitt aus, nicht an der Bühnenmitte.
    let visLeft = 0, visW = 0;
    const measure = () => {
      const sceneR = wrap.getBoundingClientRect();
      const rootR = (wrap.parentElement?.parentElement ?? wrap).getBoundingClientRect();
      visLeft = Math.max(0, rootR.left - sceneR.left);
      visW = Math.min(sceneR.width, rootR.width);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);

    // Ziel im eigenen Revier (Anteil des sichtbaren Fensters), zurückgerechnet
    // in Welt-x für die gewählte Tiefe — deterministisch „zufällig" gestreut.
    const pickNext = (b: Bird) => {
      const Hpx = wrap.clientHeight;
      const f = Hpx * 1.15;
      const W = wrap.clientWidth;
      const z = 110 + Math.abs(Math.sin(b.h * (b.seed * 1.61))) * 50; // 110 … 160 m
      const u = b.band[0] + Math.abs(Math.sin(b.h * b.seed)) * (b.band[1] - b.band[0]);
      const sx = visLeft + u * visW;
      return { x: ((sx - W / 2) * z) / f, z };
    };
    // Startpositionen einmalig in die Reviere legen (Kreisbahn um das Ziel)
    for (const b of birds) {
      const t = pickNext(b);
      b.thermal = { ...t }; b.next = { ...t };
      const R = (b.vCircle * b.vCircle) / (G * Math.tan(BANK_CIRCLE));
      b.x = t.x - R; b.z = t.z;
    }

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const W = wrap.clientWidth, Hpx = wrap.clientHeight;
      const f = Hpx * 1.15; // ~50° FOV — realistische Kamera

      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];

        // ── Steuerung: Ziel-Schräglage je Phase ─────────────────────────────
        let targetBank: number;
        let V: number;
        if (b.phase === 'thermal') {
          V = b.vCircle;
          targetBank = BANK_CIRCLE * b.turnDir;
          b.h += b.climb * dt;                              // Aufwind hebt
          // Ausstieg bildschirm-bewusst: kurz bevor er oben/seitlich aus dem
          // Blickfeld steigt (oder Backup H_MAX), gleitet er ab.
          const nearTop = Hpx > 0 && Hpx * (1 - HORIZON_Y) - (f * b.h) / b.z < Hpx * 0.16;
          const sxNow = W / 2 + (f * b.x) / b.z;
          const offstage = visW > 0 && (sxNow < visLeft + visW * 0.06 || sxNow > visLeft + visW * 0.94);
          if (b.h > H_MAX || nearTop || offstage) { b.phase = 'glide'; b.next = pickNext(b); }
        } else {
          V = V_GLIDE;
          b.h -= (V_GLIDE / GLIDE_RATIO) * dt;              // Gleiten kostet Höhe
          // Kurs auf die nächste Thermik: Bank proportional zum Kursfehler
          const want = Math.atan2(b.next.x - b.x, b.next.z - b.z);
          let err = want - b.psi;
          while (err > Math.PI) err -= 2 * Math.PI;
          while (err < -Math.PI) err += 2 * Math.PI;
          targetBank = Math.max(-BANK_MANEUVER, Math.min(BANK_MANEUVER, err * 1.6));
          const dist = Math.hypot(b.next.x - b.x, b.next.z - b.z);
          if (dist < 22 || b.h < H_MIN) {
            b.phase = 'thermal';
            b.thermal = { ...b.next };
            b.flapUntil = now + 1300;                       // Einstiegs-Flattern
          }
        }

        // ── Physik: Rollrate begrenzen, Gierrate aus koordinierter Kurve ────
        const dBank = Math.max(-ROLL_RATE * dt, Math.min(ROLL_RATE * dt, targetBank - b.bank));
        b.bank += dBank;
        b.psi += ((G * Math.tan(b.bank)) / V) * dt;

        // Grundgeschwindigkeit = Luftfahrt + Wind (Thermik driftet identisch)
        b.x += (V * Math.sin(b.psi) + WIND.x) * dt;
        b.z += (V * Math.cos(b.psi) + WIND.z) * dt;
        b.thermal.x += WIND.x * dt; b.thermal.z += WIND.z * dt;
        b.next.x += WIND.x * dt; b.next.z += WIND.z * dt;

        // ── Projektion (Pinhole) ────────────────────────────────────────────
        const svg = svgRefs.current[i];
        if (!svg || W <= 0 || Hpx <= 0 || b.z <= 30) continue;
        const sx = W / 2 + (f * b.x) / b.z;
        const sy = Hpx * (1 - HORIZON_Y) - (f * b.h) / b.z;
        const span = (f * b.wingspan) / b.z;                // projizierte Spannweite

        // Blickrichtung auf dem Schirm = projizierte Bahngeschwindigkeit
        const vx = V * Math.sin(b.psi) + WIND.x;
        const vz = V * Math.cos(b.psi) + WIND.z;
        const svx = (f * (vx * b.z - b.x * vz)) / (b.z * b.z);
        const svy = (f * b.h * vz) / (b.z * b.z);
        const angle = (Math.atan2(svy, svx) * 180) / Math.PI;

        // Schräglage sichtbar machen: je frontaler die Flugrichtung, desto
        // stärker kippt die Silhouette
        const facing = Math.cos(b.psi);
        const rollDeg = ((b.bank * facing) * 180) / Math.PI * 0.7;

        // Luftperspektive: weiter weg = blasser
        const fade = Math.max(0.5, Math.min(0.82, 1.05 - b.z / 520));

        // Größe über scale statt width — reine Compositing-Arbeit, kein Layout
        const scale = Math.max(10, span) / 32;
        svg.style.transform =
          `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) ` +
          `rotate(${(angle + rollDeg).toFixed(1)}deg) ` +
          `scale(${scale.toFixed(3)}) ` +
          `translate(-50%, -50%)`;
        svg.style.opacity = String(fade);

        // Flatter-Impuls: 4 Hz Wechsel der beiden Silhouetten, sonst still
        const flapping = now < b.flapUntil;
        const up = flapping && Math.floor(now / 125) % 2 === 0;
        const g = glideRefs.current[i], fl = flapRefs.current[i];
        if (g) g.style.opacity = up ? '0' : '1';
        if (fl) fl.style.opacity = up ? '1' : '0';
      }

      raf = requestAnimationFrame(tick);
    };

    let raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          ref={(el) => { svgRefs.current[i] = el; }}
          viewBox="0 0 100 40"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 32,
            transformOrigin: '0 0',
            willChange: 'transform',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
          }}
        >
          {/* Segel-Silhouette: gestreckte Flügel mit gefingerten Handschwingen */}
          <path
            ref={(el) => { glideRefs.current[i] = el; }}
            fill="#0d1017"
            d="M50 20 C42 16 30 12 18 10 C12 9 5 10 1 12 C6 8 13 6 20 6.5 C31 7.5 42 12 48 16 C49 14 49.6 12 50 10.5 C50.4 12 51 14 52 16 C58 12 69 7.5 80 6.5 C87 6 94 8 99 12 C95 10 88 9 82 10 C70 12 58 16 50 20 C50 22.5 49.2 26 47.5 28 L50 26.5 L52.5 28 C50.8 26 50 22.5 50 20 Z"
          />
          {/* Abschlag-Silhouette (nur beim kurzen Flatter-Impuls sichtbar) */}
          <path
            ref={(el) => { flapRefs.current[i] = el; }}
            fill="#0d1017"
            style={{ opacity: 0 }}
            d="M50 20 C44 20 34 22 24 26 C17 28.5 9 32 4 35 C8 29 15 24 22 21 C32 17 43 16 48 17 C49 15 49.6 13 50 11 C50.4 13 51 15 52 17 C57 16 68 17 78 21 C85 24 92 29 96 35 C91 32 83 28.5 76 26 C66 22 56 20 50 20 C50 22.5 49.3 25.5 48 27.5 L50 26 L52 27.5 C50.7 25.5 50 22.5 50 20 Z"
          />
        </svg>
      ))}
    </div>
  );
}
