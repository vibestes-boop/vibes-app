// Ein Realtime-Kanal pro Signal, nicht pro Komponente.
//
// Zwei Gründe:
//
//  1. Richtigkeit. supabase.channel(name) liefert bei gleichem Namen den
//     BESTEHENDEN Kanal zurück. Hängt der schon an subscribe(), wirft jedes
//     weitere .on('postgres_changes', …) — genau der Absturz, wenn Studio und
//     Raum gleichzeitig offen sind und dieselbe Session beobachten.
//
//  2. Kosten. Supabase rechnet gleichzeitige Verbindungen und Nachrichten ab.
//     Zwei Screens, die dasselbe wissen wollen, brauchen ein Abo, nicht zwei.
//
// Der Kanalname bekommt eine laufende Nummer, weil removeChannel erst nach dem
// Abmelden aus der internen Liste räumt. Ohne die Nummer könnte ein schneller
// Remount den sterbenden Kanal erwischen.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type ChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type Listener = (payload: ChangePayload) => void;
type Entry = { channel: RealtimeChannel; listeners: Set<Listener> };

const registry = new Map<string, Entry>();
let generation = 0;

export type TableWatch = {
  event: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  /** Immer setzen. Ein Abo ohne Filter hört auf die ganze Tabelle. */
  filter: string;
};

/**
 * Meldet einen Zuhörer für eine gefilterte Tabellenänderung an.
 * Gibt die Abmeldefunktion zurück — der Kanal verschwindet, sobald der letzte
 * Zuhörer weg ist.
 */
export function subscribeToTable(key: string, watch: TableWatch, listener: Listener): () => void {
  let entry = registry.get(key);

  if (!entry) {
    generation += 1;
    const listeners = new Set<Listener>();
    const channel = supabase
      .channel(`${key}-${generation}`)
      .on(
        // supabase-js kennt den Ereignisnamen nur als Literal-Union, die es
        // aus dem Schema ableitet — hier reicht die schmale Form oben.
        'postgres_changes' as never,
        { event: watch.event, schema: 'public', table: watch.table, filter: watch.filter } as never,
        ((payload: ChangePayload) => {
          listeners.forEach((notify) => notify(payload));
        }) as never,
      )
      .subscribe();

    entry = { channel, listeners };
    registry.set(key, entry);
  }

  entry.listeners.add(listener);

  return () => {
    const current = registry.get(key);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    // Erst aus der Registry nehmen, dann abmelden — sonst könnte ein sofortiger
    // Remount den gerade sterbenden Kanal wiederfinden.
    registry.delete(key);
    void supabase.removeChannel(current.channel);
  };
}

// ── Broadcast ────────────────────────────────────────────────────────────────
//
// Für flüchtige Signale, die keine Zeile in der Datenbank verdienen — Herzen
// zum Beispiel.
//
// Anders als oben bekommt der Kanalname hier KEINE laufende Nummer: bei
// Broadcast ist der Name der Vertrag. Serlo-App und -Web senden und hören auf
// `live-reactions-<id>`; eine Nummer dahinter wäre ein anderes Thema, und
// Berkat bliebe für beide stumm — genau der Bruch, der im Juli 2026 zwischen
// Serlo-Web und -App auftrat.
//
// Ohne die Nummer fehlt allerdings ihr Schutz: `removeChannel` meldet erst ab
// und räumt dann auf, und `supabase.channel(name)` liefert in diesem Fenster
// genau den Kanal zurück, der gerade stirbt. Deshalb merkt sich `closings` das
// Abmelde-Versprechen pro Name, und ein neuer Zuhörer wartet es ab, bevor er
// aufmacht. Der Merker hängt am Namen, nicht am Eintrag — sonst würde ein
// frischer Eintrag ihn nicht finden.

type BroadcastListener = (payload: Record<string, unknown>) => void;

type BroadcastEntry = {
  channel: RealtimeChannel | null;
  listeners: Set<BroadcastListener>;
  /** Verhindert, dass zwei Zuhörer gleichzeitig aufmachen. */
  opening: boolean;
};

const broadcasts = new Map<string, BroadcastEntry>();
const closings = new Map<string, Promise<unknown>>();

async function openBroadcast(name: string, event: string, entry: BroadcastEntry): Promise<void> {
  entry.opening = true;
  try {
    const closing = closings.get(name);
    if (closing) await closing;
    // Während des Wartens kann der letzte Zuhörer gegangen oder der Eintrag
    // ersetzt worden sein.
    if (entry.channel || entry.listeners.size === 0 || broadcasts.get(name) !== entry) return;

    entry.channel = supabase
      .channel(name)
      .on('broadcast', { event }, (message) => {
        const payload = (message as { payload?: Record<string, unknown> }).payload;
        if (payload) entry.listeners.forEach((notify) => notify(payload));
      })
      .subscribe();
  } finally {
    entry.opening = false;
  }
}

/** Meldet einen Zuhörer für ein Broadcast-Ereignis an. Gibt die Abmeldung zurück. */
export function subscribeToBroadcast(
  name: string,
  event: string,
  listener: BroadcastListener,
): () => void {
  let entry = broadcasts.get(name);
  if (!entry) {
    entry = { channel: null, listeners: new Set(), opening: false };
    broadcasts.set(name, entry);
  }

  const active = entry;
  active.listeners.add(listener);
  if (!active.channel && !active.opening) void openBroadcast(name, event, active);

  return () => {
    active.listeners.delete(listener);
    if (active.listeners.size > 0) return;

    const channel = active.channel;
    active.channel = null;
    if (broadcasts.get(name) === active) broadcasts.delete(name);
    if (!channel) return;

    let closing: Promise<unknown>;
    closing = supabase.removeChannel(channel).finally(() => {
      if (closings.get(name) === closing) closings.delete(name);
    });
    closings.set(name, closing);
  };
}

/**
 * Sendet auf einen Kanal, den `subscribeToBroadcast` offen hält.
 *
 * Ohne offenen Kanal geht die Nachricht verloren, und das ist richtig so: ein
 * verpasstes Herz ist kein Fehler, ein Sendepuffer für flüchtige Signale wäre
 * einer.
 */
export function sendBroadcast(
  name: string,
  event: string,
  payload: Record<string, unknown>,
): void {
  void broadcasts.get(name)?.channel?.send({ type: 'broadcast', event, payload });
}
