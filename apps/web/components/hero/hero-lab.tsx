'use client';

// -----------------------------------------------------------------------------
// HeroLab — Zaurs Hand-Kompositions-Werkzeug für den Landing-Hero (DEV-only,
// Route /hero-lab). Links die echte Bühne (HeroHorizon), rechts das Panel.
// Workflow: PNG-Schnipsel nach public/hero/ legen → hier ziehen/skalieren/
// Tiefe geben → Sonne setzen → „Layout speichern" schreibt
// public/hero/hero-layout.json — genau die Datei, die das finale Hero liest.
// -----------------------------------------------------------------------------

import { useCallback, useRef, useState } from 'react';
import {
  HeroHorizon,
  layerStyle,
  type HeroLayer,
  type HeroLayout,
} from './hero-horizon';
import type { HeroPresetName } from './hero-shader';

const PRESETS: HeroPresetName[] = ['night', 'dawn', 'mono'];

export function HeroLab({
  files,
  initialLayout,
}: {
  files: string[];
  initialLayout: HeroLayout;
}) {
  const [layout, setLayout] = useState<HeroLayout>(initialLayout);
  const [selected, setSelected] = useState<number>(-1);
  const [sunMode, setSunMode] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [status, setStatus] = useState('');
  const stageRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ idx: number; startX: number; startY: number; x0: number; b0: number } | null>(null);

  const unused = files.filter(
    (f) => !f.endsWith('.json') && !layout.layers.some((l) => l.file === f),
  );

  const patchLayer = useCallback((idx: number, patch: Partial<HeroLayer>) => {
    setLayout((cur) => ({
      ...cur,
      layers: cur.layers.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  }, []);

  const stageRect = () => stageRef.current?.getBoundingClientRect();

  const onStagePointerDown = (e: React.PointerEvent) => {
    const r = stageRect();
    if (!r) return;
    if (sunMode) {
      setLayout((cur) => ({
        ...cur,
        sun: {
          x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
          y: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)),
        },
      }));
      setSunMode(false);
      return;
    }
    if (selected < 0) return;
    const l = layout.layers[selected];
    if (!l) return;
    drag.current = { idx: selected, startX: e.clientX, startY: e.clientY, x0: l.x, b0: l.bottom };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const r = stageRect();
    if (!d || !r) return;
    patchLayer(d.idx, {
      x: d.x0 + (e.clientX - d.startX) / r.width,
      bottom: d.b0 - (e.clientY - d.startY) / r.height,
    });
  };

  const onStagePointerUp = () => {
    drag.current = null;
  };

  const addLayer = (file: string) => {
    setLayout((cur) => ({
      ...cur,
      layers: [...cur.layers, { file, x: 0.5, bottom: 0.1, scale: 0.4, depth: 0.5 }],
    }));
    setSelected(layout.layers.length);
  };

  const removeLayer = (idx: number) => {
    setLayout((cur) => ({ ...cur, layers: cur.layers.filter((_, i) => i !== idx) }));
    setSelected(-1);
  };

  const save = async () => {
    setStatus('speichere…');
    try {
      const res = await fetch('/api/hero-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout),
      });
      setStatus(res.ok ? 'Gespeichert ✓ (public/hero/hero-layout.json)' : `Fehler: HTTP ${res.status}`);
    } catch {
      setStatus('Fehler beim Speichern');
    }
  };

  const sel = selected >= 0 ? layout.layers[selected] : null;

  return (
    <div className="flex min-h-screen flex-col gap-4 bg-neutral-950 p-4 text-neutral-100 lg:flex-row">
      <div className="flex-1">
        <div
          ref={stageRef}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          className="relative mx-auto touch-none rounded-xl border border-neutral-800"
          style={{
            aspectRatio: mobile ? '390 / 700' : '16 / 9',
            maxHeight: '82vh',
            width: mobile ? 'auto' : '100%',
            cursor: sunMode ? 'crosshair' : sel ? 'move' : 'default',
          }}
        >
          <HeroHorizon layout={layout} className="absolute inset-0 h-full w-full rounded-xl" />
          {layout.layers.map((l, i) => (
            <div
              key={`${l.file}-overlay`}
              onPointerDown={(e) => {
                if (!sunMode) {
                  setSelected(i);
                  e.stopPropagation();
                  const r = stageRect();
                  if (!r) return;
                  drag.current = { idx: i, startX: e.clientX, startY: e.clientY, x0: l.x, b0: l.bottom };
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                }
              }}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              style={{
                ...layerStyle(l),
                opacity: 1,
                height: `${Math.max(6, l.scale * 30)}%`,
                background: 'transparent',
                border: i === selected ? '1.5px dashed rgba(255,200,80,0.9)' : '1px dashed rgba(255,255,255,0.12)',
                borderRadius: 6,
                cursor: 'move',
              }}
              title={l.file}
            />
          ))}
          <div
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full border border-amber-300"
            style={{ left: `${layout.sun.x * 100}%`, bottom: `${layout.sun.y * 100}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-neutral-400">
          Layer anklicken + ziehen · gestrichelter Rahmen = Auswahl · Punkt = Sonne
        </p>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:w-80">
        <h1 className="text-lg font-semibold">Hero-Lab</h1>

        <div className="space-y-2 rounded-lg border border-neutral-800 p-3">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Himmel</p>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setLayout((c) => ({ ...c, preset: p }))}
                className={`rounded-md px-3 py-1.5 text-sm ${layout.preset === p ? 'bg-amber-400 text-black' : 'bg-neutral-800'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSunMode((v) => !v)}
            className={`w-full rounded-md px-3 py-1.5 text-sm ${sunMode ? 'bg-amber-400 text-black' : 'bg-neutral-800'}`}
          >
            {sunMode ? 'Klick in den Himmel…' : '☀ Sonne setzen'}
          </button>
          <label className="block text-sm">
            Wolken {Math.round(layout.cloud * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={layout.cloud}
              onChange={(e) => setLayout((c) => ({ ...c, cloud: Number(e.target.value) }))}
              className="w-full"
            />
          </label>
        </div>

        <div className="space-y-2 rounded-lg border border-neutral-800 p-3">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Ebenen (vorn → hinten)</p>
          {[...layout.layers]
            .map((l, i) => ({ l, i }))
            .sort((a, b) => a.l.depth - b.l.depth)
            .map(({ l, i }) => (
              <button
                key={l.file}
                onClick={() => setSelected(i)}
                className={`block w-full truncate rounded-md px-2 py-1 text-left text-sm ${i === selected ? 'bg-neutral-700' : 'bg-neutral-800/50'}`}
              >
                {l.file} <span className="text-neutral-400">· Tiefe {l.depth.toFixed(2)}</span>
              </button>
            ))}
          {unused.length > 0 && (
            <div className="pt-1">
              <p className="mb-1 text-xs text-neutral-500">Noch nicht auf der Bühne:</p>
              {unused.map((f) => (
                <button
                  key={f}
                  onClick={() => addLayer(f)}
                  className="mb-1 block w-full truncate rounded-md bg-neutral-800/30 px-2 py-1 text-left text-sm text-neutral-300"
                >
                  + {f}
                </button>
              ))}
            </div>
          )}
        </div>

        {sel && (
          <div className="space-y-2 rounded-lg border border-amber-400/40 p-3">
            <p className="truncate text-sm font-medium">{sel.file}</p>
            <label className="block text-sm">
              Breite {(sel.scale * 100).toFixed(0)}%
              <input
                type="range"
                min={0.05}
                max={1.6}
                step={0.01}
                value={sel.scale}
                onChange={(e) => patchLayer(selected, { scale: Number(e.target.value) })}
                className="w-full"
              />
            </label>
            <label className="block text-sm">
              Tiefe {sel.depth.toFixed(2)} <span className="text-neutral-400">(hinten = heller + langsamer)</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={sel.depth}
                onChange={(e) => patchLayer(selected, { depth: Number(e.target.value) })}
                className="w-full"
              />
            </label>
            <button
              onClick={() => removeLayer(selected)}
              className="w-full rounded-md bg-red-900/60 px-3 py-1.5 text-sm"
            >
              Von der Bühne nehmen
            </button>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={() => setMobile((v) => !v)}
            className="w-full rounded-md bg-neutral-800 px-3 py-1.5 text-sm"
          >
            {mobile ? 'Desktop-Ansicht' : 'Mobil-Ansicht (390px)'}
          </button>
          <button
            onClick={save}
            className="w-full rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-black"
          >
            Layout speichern
          </button>
          {status && <p className="text-xs text-neutral-400">{status}</p>}
        </div>
      </aside>
    </div>
  );
}
