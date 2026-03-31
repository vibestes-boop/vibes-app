/**
 * useDrafts.ts
 *
 * Lokale Entwürfe für Posts. Werden in AsyncStorage gespeichert.
 * Kein Server — rein lokale Persistenz.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Typen ──────────────────────────────────────────────────────────────────
export type Draft = {
  id:          string;
  caption:     string;
  tags:        string[];
  mediaUri:    string | null;
  mediaType:   'image' | 'video' | null;
  createdAt:   string;
};

const STORAGE_KEY = '@vibes_drafts_v1';

// ── Hilfsfunktionen ────────────────────────────────────────────────────────
async function readDrafts(): Promise<Draft[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Draft[]) : [];
  } catch {
    return [];
  }
}

async function writeDrafts(drafts: Draft[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  // Beim Mount laden
  useEffect(() => {
    readDrafts().then((d) => {
      setDrafts(d);
      setLoading(false);
    });
  }, []);

  /** Neuen Entwurf speichern */
  const saveDraft = useCallback(
    async (data: Omit<Draft, 'id' | 'createdAt'>): Promise<string> => {
      const newDraft: Draft = {
        ...data,
        id:        Math.random().toString(36).substring(2),
        createdAt: new Date().toISOString(),
      };
      const updated = [newDraft, ...drafts].slice(0, 20); // Max 20 Entwürfe
      await writeDrafts(updated);
      setDrafts(updated);
      return newDraft.id;
    },
    [drafts]
  );

  /** Entwurf löschen */
  const deleteDraft = useCallback(
    async (id: string): Promise<void> => {
      const updated = drafts.filter((d) => d.id !== id);
      await writeDrafts(updated);
      setDrafts(updated);
    },
    [drafts]
  );

  /** Alle Entwürfe löschen */
  const clearAllDrafts = useCallback(async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setDrafts([]);
  }, []);

  return { drafts, loading, saveDraft, deleteDraft, clearAllDrafts };
}
