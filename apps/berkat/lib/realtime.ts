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
