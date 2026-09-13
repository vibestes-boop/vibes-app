import { useCallback, useRef, useState } from 'react';

/** Keep a seller's work until confirmed; a late response cannot clear later edits. */
export function useSellerDraft<T extends object>(initial: T) {
  const empty = useRef(initial);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
  }, []);
  const submit = useCallback(async (save: (snapshot: T) => Promise<void>, errorText: (error: unknown) => string) => {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError(null);
    const snapshot = draft;
    try {
      await save(snapshot);
      setDraft(current => current === snapshot ? empty.current : current);
      return true;
    } catch (cause) {
      setError(errorText(cause));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [draft]);
  return { draft, setField, busy, error, clearError: () => setError(null), submit };
}
