import { useCallback, useRef, useState } from 'react';

/** Mounted per account/show. A response must never replace text edited while it was pending. */
export function useLiveChatDraft(send: (text: string) => Promise<boolean>) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const submit = useCallback(async () => {
    if (lock.current || !draft.trim()) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const submitted = draft;
    try {
      if (await send(submitted)) setDraft(current => current === submitted ? '' : current);
      else setError('Der Kommentar konnte nicht gesendet werden. Dein Text bleibt erhalten.');
    } catch {
      setError('Der Versand konnte nicht bestätigt werden. Prüfe den Chat, bevor du es erneut versuchst.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [draft, send]);
  return { draft, setDraft, busy, error, clearError: () => setError(null), submit };
}
