'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { Copy, Eye, EyeOff, Loader2, Radio, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createWhipIngress,
  deleteWhipIngress,
  getWhipStatus,
} from '@/app/actions/live-ingress';

// -----------------------------------------------------------------------------
// OBSSetupForm — UI für /live/start im OBS-Tab.
//
// Drei Phasen:
//
//   1. SETUP (default): Title-Eingabe + „WHIP-Endpoint generieren"-Button.
//      Beim Klick → Server-Action createWhipIngress → Phase 2.
//
//   2. CREDENTIALS: Zeigt WHIP-URL + Stream-Key (masked-with-reveal +
//      Copy-Button) + OBS-Setup-Anleitung. Polling auf Status alle 3s.
//
//   3. LIVE: Sobald LiveKit isPublishing=true zurückgibt, redirecten wir
//      zu /live/host/[id]. Dort sieht der Host sein Stream-Preview, hat
//      Chat-Moderation, kann Polls starten — alles wie im Browser-Modus.
//      Aber er ist NICHT der Publisher (OBS ist es), das Host-Deck wird
//      mit `obsMode={true}`-Variante gerendert (kein Cam-Toggle, kein
//      Screenshare-Toggle — diese Optionen sind in OBS).
//
// Cleanup: Wenn der User die Seite verlässt BEVOR OBS verbunden hat,
// rufen wir deleteWhipIngress() im beforeunload-Handler. Dadurch bleiben
// keine verwaisten Sessions/Ingresses bei LiveKit zurück. Falls der User
// zurückkommt nach OBS-Verbindung, ist die Session aktiv und der
// Standard-/live/host/[id] Cleanup-Flow greift.
// -----------------------------------------------------------------------------

type Phase = 'setup' | 'credentials';

export function OBSSetupForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();

  // Phase 2 state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ingressUrl, setIngressUrl] = useState<string | null>(null);
  const [ingressStreamKey, setIngressStreamKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  // beforeunload cleanup: wenn User die Seite verlässt während wir noch
  // auf OBS warten, killen wir die Session damit kein Zombie-Ingress
  // bei LiveKit bleibt. Best-effort: navigator.sendBeacon ist hier
  // overkill, supabase.functions.invoke geht auch. Wir nutzen ein Ref
  // damit der Effect die aktuelle sessionId sieht ohne re-binden zu
  // müssen.
  const cleanupRef = useRef<{ sessionId: string | null; isPublishing: boolean }>({
    sessionId: null,
    isPublishing: false,
  });
  useEffect(() => {
    cleanupRef.current.sessionId = sessionId;
  }, [sessionId]);

  useEffect(() => {
    function onUnload() {
      const sid = cleanupRef.current.sessionId;
      if (sid && !cleanupRef.current.isPublishing) {
        // Fire-and-forget — der Browser killt Page eh, await würde nichts
        // bringen. Server-Action ist idempotent: doppel-DELETE schadet
        // nicht.
        void deleteWhipIngress(sid);
      }
    }
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  // Polling auf Stream-Status während Phase 2
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
        // Mini-Delay damit der Toast sichtbar bleibt vor dem Redirect
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

  function handleCreate() {
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
      setIngressUrl(res.ingressUrl);
      setIngressStreamKey(res.ingressStreamKey);
      setPhase('credentials');
    });
  }

  async function handleCancel() {
    if (!sessionId) return;
    setPhase('setup');
    setSessionId(null);
    setIngressUrl(null);
    setIngressStreamKey(null);
    setShowKey(false);
    setIsWaiting(false);
    await deleteWhipIngress(sessionId);
    toast('Stream-Setup abgebrochen.');
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} kopiert.`);
    } catch {
      toast.error('Kopieren fehlgeschlagen.');
    }
  }

  if (phase === 'setup') {
    return (
      <div className="space-y-6">
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
              onClick={handleCreate}
              disabled={isPending || !title.trim()}
              className="w-full"
              size="lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Erstelle Stream-Endpoint…
                </>
              ) : (
                'WHIP-Endpoint generieren'
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
          <h3 className="mb-2 font-semibold">Was du brauchst</h3>
          <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
            <li>OBS Studio 30+ (oder vMix, Streamlabs, jeder WHIP-fähige Encoder)</li>
            <li>Eine stabile Upload-Verbindung (mind. 5 Mbps für 1080p60)</li>
            <li>Hardware-Encoder empfohlen (NVENC, AMD AMF, Apple VideoToolbox)</li>
          </ul>
        </div>
      </div>
    );
  }

  // Phase: credentials
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
