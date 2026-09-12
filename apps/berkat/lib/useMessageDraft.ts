import { useCallback, useRef, useState } from 'react';
import type { SendResult } from './useDirectMessages';

type Send = (text: string, photo?: string | null, listingId?: string | null) => Promise<SendResult>;
/** Mounted per account/recipient. Failed requests keep the exact draft and attachments. */
export function useMessageDraft(initialText: string, initialListing: string | null, send: Send, upload: () => Promise<string | null>) {
  const [draft, setDraft] = useState(initialText);
  const [attached, setAttached] = useState(initialListing);
  const [photo, setPhoto] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'send' | 'upload' | null>(null);
  const lock = useRef(false);
  const onSend = useCallback(async () => {
    if (lock.current || (!draft.trim() && !photo)) return;
    lock.current = true;
    setBusy('send');
    setNotice(null);
    try {
      const result = await send(draft, photo, attached);
      if (result.ok) { setDraft(''); setPhoto(null); setAttached(null); }
      else setNotice(result.message);
    } catch {
      setNotice('Der Versand konnte nicht bestätigt werden. Prüfe den Verlauf, bevor du es erneut versuchst.');
    } finally { lock.current = false; setBusy(null); }
  }, [draft, photo, attached, send]);
  const addPhoto = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy('upload');
    setNotice(null);
    try {
      const uri = await upload();
      if (uri) setPhoto(uri);
    } catch { setNotice('Das Foto konnte nicht hinzugefügt werden. Bitte versuche es erneut.'); }
    finally { lock.current = false; setBusy(null); }
  }, [upload]);
  return { draft, setDraft, attached, setAttached, photo, setPhoto, notice, setNotice, busy, onSend, addPhoto };
}
