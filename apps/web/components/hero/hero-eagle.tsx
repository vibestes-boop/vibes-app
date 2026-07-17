'use client';

// -----------------------------------------------------------------------------
// HeroEagle — ein thermik-segelnder Adler über dem Bergpanorama.
//
// Kein Keyframe-Loop, sondern ein echtes Flugmodell (wie Adler wirklich fliegen):
//   • Eine einzige Steuergröße: die Schräglage φ (Bank). Daraus folgt physikalisch
//     die Kurve — Radius R = V²/(g·tanφ), Gierrate ψ̇ = g·tanφ/V (koordinierte Kurve).
//   • THERMIK-Phase: Kreisen mit φ ≈ 30°, Steigen ~1,1 m/s (Aufwind), die ganze
//     Thermik driftet mit dem Wind — der Kreis wandert also leicht, wie in echt.
//   • GLEIT-Phase: Ab Ausstiegshöhe rollt er aus und gleitet geradeaus zur
//     nächsten Thermik — mit Gleitzahl E ≈ 12 (Sinken = V/E), Kurs über eine
//     bank-begrenzte Steuerung (max. 35°/s Rollrate, wie ein träger Großvogel).
//   • Kein Dauerflattern: Segeln ist flügelstill; nur beim Thermik-Einstieg
//     ein kurzer Schlagimpuls (3–4 Schläge), so machen es echte Adler.
//   • Perspektive: Pinhole-Projektion — Größe, Tempo und Deckkraft (Luft-
//     perspektive) folgen aus der Entfernung, nicht aus Design-Werten.
//
// Rücksicht: prefers-reduced-motion → gar nicht rendern. rAF pausiert im
// Hintergrund-Tab von selbst; dt ist geclampt.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';

const G = 9.81;                    // m/s²
const V_CIRCLE = 13;               // m/s Kreisflug-Fahrt (Steinadler-typisch)
const V_GLIDE = 16;                // m/s Gleitfahrt zwischen Thermiken
const BANK_CIRCLE = (30 * Math.PI) / 180;  // Schräglage in der Thermik
const ROLL_RATE = (35 * Math.PI) / 180;    // max. Rollrate rad/s
const BANK_MANEUVER = (40 * Math.PI) / 180;  // steilere Kurve beim Manövrieren
const CLIMB = 1.1;                 // m/s Steigen im Aufwind
const GLIDE_RATIO = 12;            // Gleitzahl E → Sinken = V/E
const WINGSPAN = 2.1;              // m Spannweite
const WIND = { x: 1.2, z: 0.25 }; // m/s — Thermik + Vogel driften gemeinsam
const H_MIN = 26;                  // m Einstiegs-/Mindesthöhe
const H_MAX = 75;                  // m Backup-Deckel (echter Ausstieg: nearTop)
const HORIZON_Y = 0.40;            // Horizontlinie: Anteil Bühnenhöhe von unten

type Phase = 'thermal' | 'glide';

export function HeroEagle() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const eagleRef = useRef<SVGSVGElement | null>(null);
  const glideRef = useRef<SVGPathElement | null>(null);
  const flapRef = useRef<SVGPathElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const wrap = wrapRef.current;
    const eagle = eagleRef.current;
    if (!wrap || !eagle) return;

    // ── Weltzustand (Meter; Kamera bei 0/0/0, blickt in +z) ──────────────────
    // Start exakt auf der Kreisbahn: Radius links vom Zentrum, Kurs tangential,
    // Schräglage schon anliegend — er IST im Kreisen, kein Einroll-Transient.
    let x = -11, h = 34, z = 95;
    let psi = 0;                          // Kurs (rad, 0 = +z „von uns weg")
    let bank = BANK_CIRCLE;               // aktuelle Schräglage
    let phase: Phase = 'thermal';
    let thermal = { x: 18, z: 95 };      // Thermik-Zentrum (driftet mit Wind)
    let nextThermal = thermal;
    let flapUntil = 0;                    // Zeitstempel: solange wird geflattert
    let last = performance.now();

    // Deterministisch „zufällige" Ziele, absolut in die sichtbare Box geklemmt —
    // so holt der nächste Gleitflug den Vogel immer zurück über die Bühne,
    // egal wie weit der Wind die letzte Thermik getragen hat.
    const pickNextThermal = () => ({
      x: -46 + Math.abs(Math.sin(h * 12.9898)) * 78,   // −46 … +32 m (luvseitig)
      z: 95 + Math.abs(Math.sin(h * 78.233)) * 45,     //  95 … 140 m
    });

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const W = wrap.clientWidth, Hpx = wrap.clientHeight;
      const f = Hpx * 1.15;                               // ~50° FOV — realistische Kamera

      // ── Steuerung: Ziel-Schräglage je Phase ────────────────────────────────
      let targetBank: number;
      let V: number;
      if (phase === 'thermal') {
        V = V_CIRCLE;
        targetBank = BANK_CIRCLE;
        h += CLIMB * dt;                                  // Aufwind hebt
        // Ausstieg bildschirm-bewusst: kurz bevor er oben/seitlich aus dem
        // Blickfeld steigen würde (oder als Backup bei H_MAX), gleitet er ab —
        // der Vogel fliegt physikalisch weiter, wir wählen nur Thermiken im Bild.
        const nearTop = Hpx > 0 && Hpx * (1 - HORIZON_Y) - (f * h) / z < Hpx * 0.16;
        const offstage = Math.abs(x / z) > 0.42;
        if (h > H_MAX || nearTop || offstage) { phase = 'glide'; nextThermal = pickNextThermal(); }
      } else {
        V = V_GLIDE;
        h -= (V_GLIDE / GLIDE_RATIO) * dt;                // Gleiten kostet Höhe
        // Kurs auf die nächste Thermik: Bank proportional zum Kursfehler
        const want = Math.atan2(nextThermal.x - x, nextThermal.z - z);
        let err = want - psi;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        targetBank = Math.max(-BANK_MANEUVER, Math.min(BANK_MANEUVER, err * 1.6));
        const dist = Math.hypot(nextThermal.x - x, nextThermal.z - z);
        if (dist < 32 || h < H_MIN) {
          phase = 'thermal';
          thermal = { ...nextThermal };
          flapUntil = now + 1300;                         // Einstiegs-Flattern
        }
      }

      // ── Physik: Rollrate begrenzen, Gierrate aus koordinierter Kurve ──────
      const dBank = Math.max(-ROLL_RATE * dt, Math.min(ROLL_RATE * dt, targetBank - bank));
      bank += dBank;
      psi += ((G * Math.tan(bank)) / V) * dt;

      // Grundgeschwindigkeit = Luftfahrt + Wind (Thermik driftet identisch mit)
      x += (V * Math.sin(psi) + WIND.x) * dt;
      z += (V * Math.cos(psi) + WIND.z) * dt;
      thermal.x += WIND.x * dt; thermal.z += WIND.z * dt;
      nextThermal.x += WIND.x * dt; nextThermal.z += WIND.z * dt;

      // ── Projektion (Pinhole) ──────────────────────────────────────────────
      if (W > 0 && Hpx > 0 && z > 30) {
        const sx = W / 2 + (f * x) / z;
        const sy = Hpx * (1 - HORIZON_Y) - (f * h) / z;
        const span = (f * WINGSPAN) / z;                  // projizierte Spannweite

        // Blickrichtung auf dem Schirm = projizierte Bahngeschwindigkeit
        const vx = V * Math.sin(psi) + WIND.x;
        const vz = V * Math.cos(psi) + WIND.z;
        const svx = (f * (vx * z - x * vz)) / (z * z);    // d/dt von f·x/z
        const svy = (f * h * vz) / (z * z);
        const angle = (Math.atan2(svy, svx) * 180) / Math.PI;

        // Schräglage sichtbar machen: je frontaler die Flugrichtung, desto
        // stärker kippt die Silhouette (cos-Anteil der Blickgeometrie)
        const facing = Math.cos(psi);
        const rollDeg = ((bank * facing) * 180) / Math.PI * 0.7;

        // Luftperspektive: weiter weg = blasser
        const fade = Math.max(0.5, Math.min(0.82, 1.05 - z / 520));

        // Größe über scale statt width — reine Compositing-Arbeit, kein Layout
        const scale = Math.max(10, span) / 32;
        eagle.style.transform =
          `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) ` +
          `rotate(${(angle + rollDeg).toFixed(1)}deg) ` +
          `scale(${scale.toFixed(3)}) ` +
          `translate(-50%, -50%)`;
        eagle.style.opacity = String(fade);

        // Flatter-Impuls: 4 Hz Wechsel der beiden Silhouetten, sonst still
        const flapping = now < flapUntil;
        const up = flapping && Math.floor(now / 125) % 2 === 0;
        if (glideRef.current) glideRef.current.style.opacity = up ? '0' : '1';
        if (flapRef.current) flapRef.current.style.opacity = up ? '1' : '0';
      }

      raf = requestAnimationFrame(tick);
    };

    let raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <svg
        ref={eagleRef}
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
          ref={glideRef}
          fill="#0d1017"
          d="M50 20 C42 16 30 12 18 10 C12 9 5 10 1 12 C6 8 13 6 20 6.5 C31 7.5 42 12 48 16 C49 14 49.6 12 50 10.5 C50.4 12 51 14 52 16 C58 12 69 7.5 80 6.5 C87 6 94 8 99 12 C95 10 88 9 82 10 C70 12 58 16 50 20 C50 22.5 49.2 26 47.5 28 L50 26.5 L52.5 28 C50.8 26 50 22.5 50 20 Z"
        />
        {/* Abschlag-Silhouette (nur beim kurzen Flatter-Impuls sichtbar) */}
        <path
          ref={flapRef}
          fill="#0d1017"
          style={{ opacity: 0 }}
          d="M50 20 C44 20 34 22 24 26 C17 28.5 9 32 4 35 C8 29 15 24 22 21 C32 17 43 16 48 17 C49 15 49.6 13 50 11 C50.4 13 51 15 52 17 C57 16 68 17 78 21 C85 24 92 29 96 35 C91 32 83 28.5 76 26 C66 22 56 20 50 20 C50 22.5 49.3 25.5 48 27.5 L50 26 L52 27.5 C50.7 25.5 50 22.5 50 20 Z"
        />
      </svg>
    </div>
  );
}
