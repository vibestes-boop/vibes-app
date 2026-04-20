'use client';

import { useCallback, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Image from 'next/image';
import {
  Upload,
  X,
  Loader2,
  AlertCircle,
  Plus,
  BarChart3,
  Trash2,
} from 'lucide-react';

import { requestR2UploadUrl } from '@/app/actions/posts';
import { createStory } from '@/app/actions/stories';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// <StoryCreator /> — Upload + Poll-Builder für neue Stories.
//
// MVP-Scope:
//   - File-Picker für Bild ODER Video (9:16 empfohlen, aber nicht erzwungen)
//   - Upload zu R2 via existierendem `requestR2UploadUrl` + PUT-Request
//   - Optional: Poll mit Frage + 2 Optionen
//   - Submit → `createStory` Server-Action → Redirect zu `/`
//
// Naming-Konvention R2: Wir nutzen bewusst die existierenden Prefixes
// `posts/images/` und `posts/videos/` für Story-Uploads, weil der Allow-List
// im `requestR2UploadUrl`-Guard keine `stories/`-Prefixe kennt. Keine
// semantische Überschneidung — die Routing-Logik hängt an der `stories`-
// Tabelle, nicht am Storage-Pfad.
//
// Postponed für spätere Version:
//   - Text-Overlay (Canvas-Rendern) — braucht eigenes UI
//   - Camera-Capture direkt im Browser
//   - Filter/Stickers
// -----------------------------------------------------------------------------

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB Cap für Story-Uploads

type MediaType = 'image' | 'video';

interface StoryCreatorProps {
  viewerId: string;
}

export function StoryCreator({ viewerId }: StoryCreatorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [pollOn, setPollOn] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollA, setPollA] = useState('');
  const [pollB, setPollB] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── File-Handling ──
  const onFileChosen = useCallback((f: File) => {
    if (f.size > MAX_FILE_BYTES) {
      setUploadError('Datei zu groß (max 100 MB).');
      return;
    }

    const mType: MediaType = f.type.startsWith('video') ? 'video' : 'image';
    const url = URL.createObjectURL(f);
    setFile(f);
    setMediaType(mType);
    setPreviewUrl(url);
    setMediaUrl(null);
    setUploadError(null);
    setUploadProgress(null);
  }, []);

  const clearFile = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setMediaType(null);
    setPreviewUrl(null);
    setMediaUrl(null);
    setUploadError(null);
    setUploadProgress(null);
  }, [previewUrl]);

  // ── Upload ──
  const doUpload = useCallback(async () => {
    if (!file || !mediaType) return;
    setUploadProgress(0);
    setUploadError(null);
    try {
      const ts = Date.now();
      const ext = (file.name.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg'))
        .toLowerCase()
        .slice(0, 5);
      // Siehe Kopf-Kommentar: Reuse der `posts/*`-Prefixes, weil R2-Allowlist
      // `stories/` aktuell nicht kennt.
      const prefix = mediaType === 'video' ? 'posts/videos' : 'posts/images';
      const key = `${prefix}/${viewerId}/story_${ts}.${ext}`;
      const contentType = file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');

      const sig = await requestR2UploadUrl({ key, contentType });
      if (!sig.ok) throw new Error(sig.error);

      await putWithProgress(sig.data.uploadUrl, file, contentType, setUploadProgress);
      setMediaUrl(sig.data.publicUrl);
      setUploadProgress(100);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload fehlgeschlagen.');
      setUploadProgress(null);
    }
  }, [file, mediaType, viewerId]);

  // ── Submit ──
  const canSubmit = !!mediaUrl && !!mediaType && !submitting;

  const handleSubmit = async () => {
    if (!mediaUrl || !mediaType) return;

    let interactive: { type: 'poll'; question: string; options: [string, string] } | null = null;
    if (pollOn) {
      const q = pollQ.trim();
      const a = pollA.trim();
      const b = pollB.trim();
      if (q.length < 3 || q.length > 120) {
        setSubmitError('Poll-Frage muss 3–120 Zeichen haben.');
        return;
      }
      if (!a || !b) {
        setSubmitError('Beide Poll-Optionen sind pflicht.');
        return;
      }
      interactive = { type: 'poll', question: q, options: [a, b] };
    }

    setSubmitting(true);
    setSubmitError(null);

    startTransition(async () => {
      const res = await createStory({
        mediaUrl,
        mediaType,
        interactive,
      });
      setSubmitting(false);
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      // Strip aktualisiert sich via revalidatePath('/') serverseitig.
      router.push('/' as Route);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* ── Preview-Spalte ───────────────────────────────────── */}
      <section className="order-2 lg:order-1">
        <div className="mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-black">
          {!file ? (
            <Dropzone inputRef={inputRef} onFileChosen={onFileChosen} />
          ) : (
            <div className="relative h-full w-full">
              {mediaType === 'video' ? (
                <video
                  src={previewUrl ?? undefined}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  sizes="(min-width: 640px) 400px, 100vw"
                  className="object-cover"
                  priority
                />
              ) : null}

              {/* Clear-Button */}
              <button
                type="button"
                onClick={clearFile}
                aria-label="Media entfernen"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-rose-500/80"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Poll-Overlay Preview */}
              {pollOn && pollQ.trim() && (
                <div className="absolute bottom-20 left-4 right-4 rounded-xl bg-black/60 p-3 backdrop-blur-md">
                  <p className="mb-2 text-center text-sm font-semibold text-white">
                    {pollQ}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-center text-sm text-white">
                      {pollA || 'Option A'}
                    </div>
                    <div className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-center text-sm text-white">
                      {pollB || 'Option B'}
                    </div>
                  </div>
                </div>
              )}

              {/* Upload-Progress-Overlay */}
              {uploadProgress !== null && uploadProgress < 100 && (
                <div className="absolute inset-x-0 bottom-0 bg-black/70 p-3 text-white">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Upload… {uploadProgress}%
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full bg-white"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {uploadError && (
          <div className="mx-auto mt-3 flex max-w-sm items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
            <AlertCircle className="h-4 w-4" /> {uploadError}
          </div>
        )}
      </section>

      {/* ── Controls-Spalte ─────────────────────────────────── */}
      <section className="order-1 flex flex-col gap-4 lg:order-2">
        {/* Upload-Button (nach Datei-Wahl) */}
        {file && !mediaUrl && (
          <button
            type="button"
            onClick={doUpload}
            disabled={uploadProgress !== null && uploadProgress < 100}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {uploadProgress === null ? (
              <>
                <Upload className="h-4 w-4" />
                Media hochladen
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Upload läuft…
              </>
            )}
          </button>
        )}

        {file && mediaUrl && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
            Upload fertig — Story ist bereit zum Veröffentlichen.
          </div>
        )}

        {/* Poll-Toggle */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="h-4 w-4" />
                Poll hinzufügen
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Viewer können zwischen 2 Optionen abstimmen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPollOn((v) => !v)}
              aria-pressed={pollOn}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border transition-colors',
                pollOn
                  ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              {pollOn ? <Trash2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>

          {pollOn && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={pollQ}
                onChange={(e) => setPollQ(e.target.value.slice(0, 120))}
                maxLength={120}
                placeholder="Deine Frage (z.B. Team A oder Team B?)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={pollA}
                  onChange={(e) => setPollA(e.target.value.slice(0, 40))}
                  maxLength={40}
                  placeholder="Option A"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
                />
                <input
                  type="text"
                  value={pollB}
                  onChange={(e) => setPollB(e.target.value.slice(0, 40))}
                  maxLength={40}
                  placeholder="Option B"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Max 120 Zeichen für die Frage, 40 Zeichen pro Option.
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="sticky bottom-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 text-xs text-muted-foreground">
            Deine Story ist <strong>24h</strong> sichtbar und verschwindet danach
            automatisch.
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Veröffentliche…
              </>
            ) : (
              'Story veröffentlichen'
            )}
          </button>
          {submitError && (
            <p className="mt-2 text-xs text-rose-500">{submitError}</p>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Dropzone ────────────────────────────────────────────────────────────

function Dropzone({
  inputRef,
  onFileChosen,
}: {
  inputRef: React.Ref<HTMLInputElement>;
  onFileChosen: (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <label
      htmlFor="story-file-input"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFileChosen(f);
      }}
      className={cn(
        'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-3 text-center text-white transition-colors',
        dragging ? 'bg-white/10' : 'bg-black',
      )}
    >
      <Upload className="h-8 w-8 opacity-80" />
      <div>
        <p className="text-sm font-semibold">Bild oder Video hochladen</p>
        <p className="mt-1 text-[11px] opacity-70">9:16 empfohlen · bis 100 MB</p>
      </div>
      <input
        ref={inputRef}
        id="story-file-input"
        type="file"
        accept="image/*,video/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileChosen(f);
        }}
      />
    </label>
  );
}

// ─── XHR-PUT mit Progress ────────────────────────────────────────────────

function putWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload fehlgeschlagen (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Netzwerkfehler beim Upload.'));
    xhr.send(body);
  });
}
