'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Copy, Eye, EyeOff, Loader2, Radio, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createWhipIngress,
  deleteWhipIngress,
  getWhipStatus,
  getMyWhipIngress,
  rotateWhipIngress,
} from '@/app/actions/live-ingress';

// -----------------------------------------------------------------------------
// OBSSetupForm — UI für /live/start im OBS-Tab.
//
// v1.w.UI.36 — Persistenter WHIP-Ingress
//
// Phasen:
//
//   loading:     Prüft on-mount ob der User bereits persistente Credentials
//                hat (getMyWhipIngress RPC). Kurze Lade-State.
//
//   setup:       Zeigt je nach hasExistingIngress zwei Varianten:
//
//     hasExistingIngress=false (erster Stream):
//       Title-Eingabe + „WHIP-Endpoint generieren"-Button.
//       Beim Klick → createWhipIngress → credentials-Phase.
//
//     hasExistingIngress=true (wiederkehrender Streamer):
//       Existing URL + Stream-Key bereits sichtbar.
//       Title-Eingabe + „Stream starten"-Button → nur neue Session anlegen,
//       Credentials bleiben gleich → credentials-Phase (Polling).
//       „Schlüssel rotieren"-Link zum Erneuern des Keys.
//
//   credentials: WHIP-URL + Stream-Key (masked-with-reveal + Copy-Button) +
//                OBS-Setup-Anleitung. Polling auf Status alle 3s.
//                Sobald LiveKit isPublishing=true → Redirect /live/host/[id].
//
// Cleanup (beforeunload): Wenn der User die Seite verlässt BEVOR OBS
// verbunden hat, rufen wir deleteWhipIngress() (beendet nur die Session,
// Ingress bleibt erhalten). Damit bleiben keine aktiven Sessions im DB zurück.
// -----------------------------------------------------------------------------

type Phase = 'loading' | 'setup' | 'credentials';

export function OBSSetupForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isRotating, setIsRotating] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);

  // Persistente Credentials (loaded on mount)
  const [hasExistingIngress, setHasExistingIngress] = useState(false);

  // Aktuelle Credentials für die credentials-Phase
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ingressUrl, setIngressUrl] = useState<string | null>(null);
  const [ingressStreamKey, setIngressStreamKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  // cleanupRef: damit beforeunload die aktuelle sessionId sieht ohne
  // den Effect neu zu binden.
  const cleanupRef = useRef<{ sessionId: string | null; isPublishing: boolean }>({
    sessionId: null,
    isPublishing: false,
  });
  useEffect(() => {
    cleanupRef.current.sessionId = sessionId;
  }, [sessionId]);

  // ── On-mount: persistente Credentials laden ────────────────────────────────
  useEffect(() => {
    void (async () => {
      const res = await getMyWhipIngress();
      if (res.ok && res.ingress) {
        setHasExistingIngress(true);
        setIngressUrl(res.ingress.ingressUrl);
        setIngressStreamKey(res.ingress.streamKey);
      }
      setPhase('setup');
    })();
  }, []);

  // ── beforeunload cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    function onUnload() {
      const sid = cleanupRef.current.sessionId;
      if (sid && !cleanupRef.current.isPublishing) {
        // Beendet nur die Session (nicht den Ingress — der ist persistent).
        void deleteWhipIngress(sid);
      }
    }
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // ── Polling auf Stream-Status in credentials-Phase ─────────────────────────
  useEffect(() => {
    if (phase !== 'credentials' || !sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (cancelled || !sessionId) return;
      const res = await getWhipStatus(sessionId);
      if (cancelled) return;
      if (res.ok && res.isPublishing) {
        cleanupRef.current.isPublishing = true;
        setIsWaiting(false);
        toast.success('OBS verbunden — du bist live!');
        setTimeout(() => router.push(`/live/host/${sessionId}` as Route), 700);
        return;
      }
      timer = setTimeout(poll, 3000);
    }
    setIsWaiting(true);
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, sessionId, router]);

  // ── Neuen Stream starten (mit oder ohne existing ingress) ──────────────────
  function handleStartStream() {
    if (!title.trim()) {
      toast.error('Bitte gib einen Titel ein.');
      return;
    }
    startTransition(async () => {
      const res = await createWhipIngress({ title: title.trim(), privacy: 'public' });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSessionId(res.sessionId);
      // Credentials aktualisieren (bei erstem Stream neue Werte, bei
      // bestehendem Ingress dieselben wie vorher — aber trotzdem setzen
      // damit die credentials-Phase immer aktuelle Werte zeigt).
      setIngressUrl(res.ingressUrl);
      setIngressStreamKey(res.ingressStreamKey);
      if (!hasExistingIngress) {
        // Jetzt hat der User einen Ingress — beim nächsten Render wird
        // hasExistingIngress=true gesetzt (via state update unten).
        setHasExistingIngress(true);
      }
      setPhase('credentials');
    });
  }

  // ── Stream-Setup abbrechen (nur in credentials-Phase möglich) ─────────────
  async function handleCancel() {
    if (!sessionId) {
      setPhase('setup');
      return;
    }
    setPhase('setup');
    const sid = sessionId;
    setSessionId(null);
    setIsWaiting(false);
    cleanupRef.current.sessionId = null;
    await deleteWhipIngress(sid);
    toast('Stream-Setup abgebrochen.');
  }

  // ── Schlüssel rotieren ─────────────────────────────────────────────────────
  async function handleRotate() {
    setShowRotateConfirm(false);
    setIsRotating(true);
    const res = await rotateWhipIngress();
    setIsRotating(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setIngressUrl(res.ingressUrl);
    setIngressStreamKey(res.ingressStreamKey);
    setShowKey(false);
    toast.success('Neuer Stream-Key generiert. Bitte OBS neu konfigurieren.');
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} kopiert.`);
    } catch {
      toast.error('Kopieren fehlgeschlagen.');
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Setup-Phase ────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="space-y-6">
        {/* Header-Card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Mit OBS streamen</h2>
              <p className="text-sm text-muted-foreground">
                Pro-Setup mit höherer Qualität, mehreren Quellen und besseren Encodern.
              </p>
            </div>
          </div>

          {/* Existing credentials panel */}
          {hasExistingIngress && ingressUrl && ingressStreamKey && (
            <div className="mb-5 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  ✓ OBS bereits konfiguriert — Credentials unverändert
                </p>
                {!showRotateConfirm && (
                  <button
                    type="button"
                    onClick={() => setShowRotateConfirm(true)}
                    disabled={isRotating}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {isRotating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Schlüssel rotieren
                  </button>
                )}
              </div>

              {showRotateConfirm && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
                  <div className="mb-2 flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Neuer Key macht den alten ungültig. OBS muss danach neu konfiguriert werden.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRotate}
                      className="rounded bg-yellow-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-yellow-700"
                    >
                      Ja, rotieren
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRotateConfirm(false)}
                      className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Server (URL)</Label>
                <div className="mt-1 flex gap-2">
                  <Input value={ingressUrl} readOnly className="font-mono text-xs" />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(ingressUrl, 'Server-URL')}
                    aria-label="Server-URL kopieren"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs">Stream Key (Bearer Token)</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={ingressStreamKey}
                    readOnly
                    type={showKey ? 'text' : 'password'}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? 'Stream-Key verstecken' : 'Stream-Key zeigen'}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(ingressStreamKey, 'Stream-Key')}
                    aria-label="Stream-Key kopieren"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Titel + Start-Button */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="obs-title">Titel des Streams</Label>
              <Input
                id="obs-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Late-Night Coding mit Lo-Fi"
                maxLength={140}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Max. 140 Zeichen. Wird Zuschauern angezeigt.
              </p>
            </div>

            <Button
              onClick={handleStartStream}
              disabled={isPending || !title.trim() || isRotating}
              className="w-full"
              size="lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {hasExistingIngress ? 'Starte Stream…' : 'Erstelle Stream-Endpoint…'}
                </>
              ) : hasExistingIngress ? (
                'Stream starten'
              ) : (
                'WHIP-Endpoint generieren'
              )}
            </Button>
          </div>
        </div>

        {/* Info-Box */}
        <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
          <h3 className="mb-2 font-semibold">Was du brauchst</h3>
          <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
            <li>OBS Studio 30+ (oder vMix, Streamlabs, jeder WHIP-fähige Encoder)</li>
            <li>Eine stabile Upload-Verbindung (mind. 5 Mbps für 1080p60)</li>
            <li>Hardware-Encoder empfohlen (NVENC, AMD AMF, Apple VideoToolbox)</li>
            {hasExistingIngress && (
              <li className="text-green-600 dark:text-green-400">
                Dein OBS ist bereits konfiguriert — einfach Titel eingeben und starten!
              </li>
            )}
          </ul>
        </div>
      </div>
    );
  }

  // ── Credentials-Phase (warten auf OBS) ────────────────────────────────────
  return (
    <div className="space-y-6">
      {isWaiting && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-300">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span>
            Wartet auf OBS-Verbindung… Sobald du in OBS auf „Streaming starten" klickst, leiten
            wir dich zur Live-Ansicht weiter.
          </span>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 text-lg font-semibold">OBS-Konfiguration</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Kopiere diese Werte in <strong>OBS → Einstellungen → Stream</strong>.
          {hasExistingIngress && (
            <span className="ml-1 text-green-600 dark:text-green-400">
              Dein Key ist persistent — er ändert sich nicht zwischen Streams.
            </span>
          )}
        </p>

        <div className="space-y-4">
          <div>
            <Label>Service</Label>
            <div className="mt-1.5 rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-sm">
              WHIP
            </div>
          </div>

          <div>
            <Label>Server (URL)</Label>
            <div className="mt-1.5 flex gap-2">
              <Input value={ingressUrl ?? ''} readOnly className="font-mono text-sm" />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => ingressUrl && copyToClipboard(ingressUrl, 'Server-URL')}
                aria-label="Server-URL kopieren"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label>Stream Key (Bearer Token)</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                value={ingressStreamKey ?? ''}
                readOnly
                type={showKey ? 'text' : 'password'}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Stream-Key verstecken' : 'Stream-Key zeigen'}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() =>
                  ingressStreamKey && copyToClipboard(ingressStreamKey, 'Stream-Key')
                }
                aria-label="Stream-Key kopieren"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Diesen Key niemandem zeigen — er authentifiziert dich als Stream-Quelle.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
        <h3 className="mb-2 font-semibold">Schritt für Schritt</h3>
        <ol className="ml-5 list-decimal space-y-2 text-muted-foreground">
          <li>
            <strong>OBS öffnen</strong> → <em>Einstellungen</em> →{' '}
            <em>Stream</em>
          </li>
          <li>
            Bei <em>Service</em> wählst du <strong>WHIP</strong>
          </li>
          <li>
            Server-URL und Stream-Key oben einfügen
            {hasExistingIngress && (
              <span className="text-green-600 dark:text-green-400"> (bereits eingetragen — nichts ändern!)</span>
            )}
          </li>
          <li>
            <em>Einstellungen</em> →{' '}
            <em>Ausgabe</em> → Encoder auf Hardware (NVENC / AMF / VideoToolbox), Bitrate
            6000–8000 kbps für 1080p60
          </li>
          <li>
            Auf <strong>Streaming starten</strong> klicken — diese Seite leitet automatisch
            weiter sobald der Stream live ist
          </li>
        </ol>
        <a
          href="https://obsproject.com/kb/whip"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          OBS WHIP-Anleitung <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <Button variant="outline" onClick={handleCancel} className="w-full">
        Abbrechen
      </Button>
    </div>
  );
}
