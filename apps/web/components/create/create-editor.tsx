'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Video as VideoIcon,
  X,
  Loader2,
  Clock,
  FileText,
  Globe,
  Users as UsersIcon,
  Lock,
  Sparkles,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Camera,
  Music2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { compressImage, extensionForMime } from '@/lib/image/compress';
import {
  publishPost,
  schedulePost,
  saveDraft,
  requestR2UploadUrl,
  searchHashtagSuggestions,
  searchMentionSuggestions,
  type Privacy,
  type MediaType,
} from '@/app/actions/posts';
import { AIImageSheet } from '@/components/ai/ai-image-sheet';
import { MusicPickerDialog, MUSIC_LIBRARY } from '@/components/create/music-picker-dialog';

// -----------------------------------------------------------------------------
// CreateEditor — zentrale Client-Komponente für /create.
//
// Architektur:
//  1. State-Sektionen: (a) Datei + Upload-Fortschritt, (b) Caption + Tags,
//     (c) Privacy + Toggles, (d) Schedule/Draft-UI, (e) Autocomplete-UI.
//  2. Upload läuft zwei-stufig: (1) Server-Action `requestR2UploadUrl` →
//     presigned PUT-URL; (2) `fetch(uploadUrl, { method: 'PUT', body: File })`.
//     Für Videos wird zusätzlich ein Cover-Frame aus dem Preview-Video
//     extrahiert (Canvas.toBlob) und als separater R2-Upload geschoben.
//  3. Autocomplete: Caption-Textarea trackt aktuellen Cursor + Wort-Token;
//     Debounce 200ms bis zum Server-Action-Call. Dropdown rendert über der
//     Eingabe, Pfeiltasten navigieren, Enter/Tab fügt ein.
//  4. Optimistic-UX: alle async Buttons disablen sich während `isPending`,
//     Upload-Progress per 4-Balken-Indicator (indeterminate = infinite bounce).
// -----------------------------------------------------------------------------

interface InitialDraft {
  id: string;
  caption: string;
  tags: string[];
  mediaUrl: string | null;
  mediaType: MediaType | null;
  thumbnailUrl: string | null;
  settings:
    | {
        privacy?: Privacy;
        allowComments?: boolean;
        allowDownload?: boolean;
        allowDuet?: boolean;
        womenOnly?: boolean;
        coverTimeMs?: number | null;
      }
    | null;
}

interface Props {
  viewerId: string;
  initialDraft: InitialDraft | null;
}

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const CAPTION_MAX_LEN = 2200;

export function CreateEditor({ viewerId, initialDraft }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ---------- File / Upload State ----------
  const [file, setFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(initialDraft?.mediaType ?? null);
  const [remoteMediaUrl, setRemoteMediaUrl] = useState<string | null>(
    initialDraft?.mediaUrl ?? null,
  );
  const [remoteThumbnailUrl, setRemoteThumbnailUrl] = useState<string | null>(
    initialDraft?.thumbnailUrl ?? null,
  );
  const [coverTimeMs, setCoverTimeMs] = useState<number | null>(
    initialDraft?.settings?.coverTimeMs ?? null,
  );
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape' | 'square'>('portrait');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // 0..100 | null
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // v1.28.0: AI-Image-Sheet für Bild-Posts ohne eigene Datei
  const [aiSheetOpen, setAiSheetOpen] = useState(false);

  // ---------- Caption + Tags State ----------
  const [caption, setCaption] = useState(initialDraft?.caption ?? '');
  const [tags, setTags] = useState<string[]>(initialDraft?.tags ?? []);

  // ---------- Privacy + Toggles ----------
  const [privacy, setPrivacy] = useState<Privacy>(initialDraft?.settings?.privacy ?? 'public');
  const [allowComments, setAllowComments] = useState(initialDraft?.settings?.allowComments ?? true);
  const [allowDuet, setAllowDuet] = useState(initialDraft?.settings?.allowDuet ?? true);
  const [allowDownload, setAllowDownload] = useState(
    initialDraft?.settings?.allowDownload ?? false,
  );
  const [womenOnly, setWomenOnly] = useState(initialDraft?.settings?.womenOnly ?? false);

  // ---------- Draft / Schedule ----------
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<Date>(() => nextQuarterHour(new Date()));

  // ---------- Music Picker (v1.w.UI.234) ----------
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [musicPickerOpen, setMusicPickerOpen] = useState(false);

  // ---------- Global Feedback ----------
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- Derived ----------
  const hasMedia = !!(file || remoteMediaUrl);
  const canPublish = hasMedia && !uploadProgress && !isPending;
  const captionLen = caption.length;

  // ---------- Preview URL Cleanup ----------
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  // ---------- File Selection ----------
  const onFileChosen = useCallback((f: File) => {
    setUploadError(null);
    setToast(null);

    const isVideo = f.type.startsWith('video/');
    const isImage = f.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setUploadError('Nur Bilder oder Videos.');
      return;
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (f.size > maxBytes) {
      setUploadError(
        isVideo
          ? `Video zu groß (max ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB).`
          : `Bild zu groß (max ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB).`,
      );
      return;
    }

    // Vorherige Preview-URL aufräumen
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);

    const objectUrl = URL.createObjectURL(f);
    setFile(f);
    setMediaType(isVideo ? 'video' : 'image');
    setLocalPreviewUrl(objectUrl);
    // Alte Remote-URL verwerfen — neuer Upload überschreibt
    setRemoteMediaUrl(null);
    setRemoteThumbnailUrl(null);
    setCoverTimeMs(null);

    // Aspect-Ratio auto-detect aus Medien-Dimensionen
    if (isVideo) {
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => {
        const w = vid.videoWidth;
        const h = vid.videoHeight;
        URL.revokeObjectURL(vid.src);
        if (w > 0 && h > 0) {
          const ratio = w / h;
          if (ratio > 1.4)       setAspectRatio('landscape'); // ≥ ~14:10 → 16:9
          else if (ratio > 0.85) setAspectRatio('square');    // ~1:1
          else                   setAspectRatio('portrait');   // 9:16
        }
      };
      vid.src = URL.createObjectURL(f);
    } else {
      // `Image` ist hier das `next/image`-Default-Import (siehe oben) — der
      // DOM-HTMLImageElement-Konstruktor wird via `window.Image` adressiert,
      // damit kein Namens-Clash entsteht.
      const img = new window.Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w > 0 && h > 0) {
          const ratio = w / h;
          if (ratio > 1.4)       setAspectRatio('landscape');
          else if (ratio > 0.85) setAspectRatio('square');
          else                   setAspectRatio('portrait');
        }
      };
      img.src = objectUrl;
    }
  }, [localPreviewUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileChosen(f);
  }, [onFileChosen]);

  // v1.28.0: AI-Image als Alternative zum File-Upload — URL ist bereits in Supabase-
  // Storage, also skippen wir den R2-Upload-Flow und setzen remoteMediaUrl direkt.
  const applyAIImage = useCallback((url: string) => {
    setUploadError(null);
    setFile(null);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    setMediaType('image');
    setRemoteMediaUrl(url);
    // Bei AI-Bildern ist das eigentliche Bild gleichzeitig das Thumbnail
    setRemoteThumbnailUrl(url);
    setCoverTimeMs(null);
    setUploadProgress(null);
    // KI-Bilder sind immer quadratisch (1024×1024 / 1024×1536 je nach Size-Option).
    // 1024×1024 → square, 1024×1536 → portrait. Default-Size ist 1024×1536,
    // also portrait. Wir setzen explizit zurück damit ein vorher gewähltes
    // Querformat nicht versehentlich übernommen wird.
    setAspectRatio('portrait');
  }, [localPreviewUrl]);

  const inputRef = useRef<HTMLInputElement>(null);
  const triggerFilePicker = () => inputRef.current?.click();

  // ---------- Upload ----------
  const doUpload = useCallback(
    async (
      f: File,
      mType: MediaType,
    ): Promise<{ mediaUrl: string; thumbnailUrl: string | null } | null> => {
      setUploadProgress(0);
      setUploadError(null);
      try {
        const ts = Date.now();

        // Image-Compression-Pass (v1.w.12.7): Bilder werden browser-seitig
        // auf Longest-Edge 1920px runterskaliert + WebP (Fallback JPEG) mit
        // Quality 0.82 re-encoded, bevor sie als PUT zu R2 gehen. Videos
        // bleiben unberührt — dafür bräuchte es ffmpeg.wasm (v1.w.8b-Scope).
        // `compressImage` ist defensiv: bei jedem Fehler + wenn das Original
        // bereits kleiner wäre, gibt es das Original unverändert zurück.
        let uploadBody: Blob = f;
        let uploadMime = f.type || fallbackMime(mType, (f.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5));
        let uploadExt = (f.name.split('.').pop() || (mType === 'video' ? 'mp4' : 'jpg'))
          .toLowerCase()
          .slice(0, 5);

        if (mType === 'image') {
          const result = await compressImage(f, { maxEdge: 1920, quality: 0.82 });
          if (result.compressed) {
            uploadBody = result.blob;
            uploadMime = result.mimeType;
            uploadExt = extensionForMime(result.mimeType);
          }
        }

        const key = `${mType === 'video' ? 'posts/videos' : 'posts/images'}/${viewerId}/${ts}.${uploadExt}`;

        const sig = await requestR2UploadUrl({ key, contentType: uploadMime });
        if (!sig.ok) throw new Error(sig.error);

        // PUT mit XHR (wegen Progress-Tracking)
        await putWithProgress(sig.data.uploadUrl, uploadBody, uploadMime, (p) =>
          setUploadProgress(p),
        );

        let thumbUrl: string | null = null;
        if (mType === 'video') {
          try {
            const thumbBlob = await extractVideoFrameBlob(f, coverTimeMs ?? 0);
            if (thumbBlob) {
              const thumbKey = `thumbnails/${viewerId}/${ts}.jpg`;
              const thumbSig = await requestR2UploadUrl({
                key: thumbKey,
                contentType: 'image/jpeg',
              });
              if (thumbSig.ok) {
                await putWithProgress(
                  thumbSig.data.uploadUrl,
                  thumbBlob,
                  'image/jpeg',
                  () => {
                    /* ignore thumb progress */
                  },
                );
                thumbUrl = thumbSig.data.publicUrl;
              }
            }
          } catch {
            // Thumbnail ist best-effort — Post funktioniert auch ohne.
          }
        } else if (mType === 'image') {
          // Bei Bild-Posts ist das hochgeladene Bild selbst das Thumbnail.
          // Wichtig: ohne das wäre thumbnail_url NULL → Profil-Grid zeigt
          // Gradient-Fallback, Explore zeigt Avatar-Letter-Fallback, Feed
          // kann (trotz Conditional-Render seit v1.w.12.9) das Poster
          // nicht setzen. Re-use der media_url ist kostenlos (R2 served
          // dasselbe Objekt), und spart den extra Roundtrip für ein
          // separat generiertes Thumbnail.
          thumbUrl = sig.data.publicUrl;
        }

        setUploadProgress(100);
        setTimeout(() => setUploadProgress(null), 400);
        return { mediaUrl: sig.data.publicUrl, thumbnailUrl: thumbUrl };
      } catch (err) {
        setUploadProgress(null);
        setUploadError((err as Error).message || 'Upload fehlgeschlagen.');
        return null;
      }
    },
    [viewerId, coverTimeMs],
  );

  // ---------- Publish ----------
  const handlePublish = async () => {
    if (!hasMedia && !file) return;
    let mUrl = remoteMediaUrl;
    let mThumb = remoteThumbnailUrl;
    let mType = mediaType;

    // Falls frischer File → zuerst hochladen
    if (file && !remoteMediaUrl && mediaType) {
      const up = await doUpload(file, mediaType);
      if (!up) return;
      mUrl = up.mediaUrl;
      mThumb = up.thumbnailUrl;
      setRemoteMediaUrl(up.mediaUrl);
      setRemoteThumbnailUrl(up.thumbnailUrl);
      mType = mediaType;
    }

    if (!mUrl || !mType) {
      setUploadError('Kein Medium bereit.');
      return;
    }

    startTransition(async () => {
      const res = await publishPost({
        caption,
        tags,
        mediaUrl: mUrl!,
        mediaType: mType!,
        thumbnailUrl: mThumb,
        privacy,
        allowComments,
        allowDuet,
        allowDownload,
        womenOnly,
        audioUrl,
        coverTimeMs,
        draftId,
        aspectRatio,
      });
      if (!res.ok) {
        setToast({ kind: 'err', msg: res.error });
        return;
      }
      setToast({ kind: 'ok', msg: 'Post ist live.' });
      // Nach kurzer Verzögerung zur Post-URL
      setTimeout(() => router.push(`/p/${res.data.id}`), 700);
    });
  };

  // ---------- Schedule ----------
  const handleSchedule = async () => {
    let mUrl = remoteMediaUrl;
    let mThumb = remoteThumbnailUrl;
    let mType = mediaType;

    if (file && !remoteMediaUrl && mediaType) {
      const up = await doUpload(file, mediaType);
      if (!up) return;
      mUrl = up.mediaUrl;
      mThumb = up.thumbnailUrl;
      setRemoteMediaUrl(up.mediaUrl);
      setRemoteThumbnailUrl(up.thumbnailUrl);
      mType = mediaType;
    }

    if (!mUrl || !mType) {
      setToast({ kind: 'err', msg: 'Kein Medium bereit.' });
      return;
    }

    startTransition(async () => {
      const res = await schedulePost({
        caption,
        tags,
        mediaUrl: mUrl!,
        mediaType: mType!,
        thumbnailUrl: mThumb,
        privacy,
        allowComments,
        allowDuet,
        allowDownload,
        womenOnly,
        audioUrl,
        coverTimeMs,
        publishAt: scheduleAt.toISOString(),
        draftId,
        aspectRatio,
      });
      if (!res.ok) {
        setToast({ kind: 'err', msg: res.error });
        return;
      }
      setToast({ kind: 'ok', msg: 'Geplant.' });
      setScheduleOpen(false);
      setTimeout(() => router.push('/create/scheduled'), 500);
    });
  };

  // ---------- Save as Draft ----------
  const handleSaveDraft = async () => {
    let mUrl = remoteMediaUrl;
    let mThumb = remoteThumbnailUrl;

    if (file && !remoteMediaUrl && mediaType) {
      const up = await doUpload(file, mediaType);
      if (!up) return;
      mUrl = up.mediaUrl;
      mThumb = up.thumbnailUrl;
      setRemoteMediaUrl(up.mediaUrl);
      setRemoteThumbnailUrl(up.thumbnailUrl);
    }

    startTransition(async () => {
      const res = await saveDraft({
        id: draftId,
        caption,
        tags,
        mediaType: mediaType,
        mediaUrl: mUrl,
        thumbnailUrl: mThumb,
        settings: {
          privacy,
          allowComments,
          allowDuet,
          allowDownload,
          womenOnly,
          coverTimeMs,
        },
      });
      if (!res.ok) {
        setToast({ kind: 'err', msg: res.error });
        return;
      }
      setDraftId(res.data.id);
      setToast({ kind: 'ok', msg: 'Entwurf gespeichert.' });
    });
  };

  // ---------- Tag-Chip Input ----------
  const [tagInput, setTagInput] = useState('');
  const addTagFromInput = () => {
    const raw = tagInput.trim().replace(/^#+/, '');
    if (!raw) return;
    if (tags.length >= 10) {
      setToast({ kind: 'err', msg: 'Max. 10 Tags.' });
      return;
    }
    const next = `#${raw.toLowerCase().slice(0, 64)}`;
    if (!tags.includes(next)) setTags([...tags, next]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* Hidden File-Input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileChosen(f);
          e.target.value = '';
        }}
      />

      {/* LEFT: Media-Zone */}
      <section className="flex flex-col gap-5">
        {!hasMedia ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={triggerFilePicker}
            className={cn(
              'flex aspect-[9/16] max-h-[720px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/30 p-8 text-center transition-all cursor-pointer',
              'hover:border-primary/50 hover:bg-muted/50',
              isDragging && 'border-primary bg-primary/5 scale-[1.01]',
            )}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') triggerFilePicker();
            }}
          >
            <div className="mb-4 rounded-full bg-background p-5 shadow-sm">
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="mb-1 text-lg font-semibold">Datei hierher ziehen</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              oder klicken um aus deinem Gerät auszuwählen
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1">
                <VideoIcon className="h-3.5 w-3.5" /> Video bis {MAX_VIDEO_BYTES / 1024 / 1024} MB
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-3 py-1">
                <ImageIcon className="h-3.5 w-3.5" /> Bild bis {MAX_IMAGE_BYTES / 1024 / 1024} MB
              </span>
            </div>
            {uploadError && (
              <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" /> {uploadError}
              </p>
            )}
            {/* v1.28.0: AI-Alternative (stopPropagation damit die Dropzone nicht öffnet) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAiSheetOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/15"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Mit KI erstellen
            </button>
          </div>
        ) : (
          <MediaPreview
            localPreviewUrl={localPreviewUrl}
            remoteMediaUrl={remoteMediaUrl}
            mediaType={mediaType}
            uploadProgress={uploadProgress}
            coverTimeMs={coverTimeMs}
            onCoverTimeChange={setCoverTimeMs}
            onRemove={() => {
              if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
              setFile(null);
              setLocalPreviewUrl(null);
              setMediaType(null);
              setRemoteMediaUrl(null);
              setRemoteThumbnailUrl(null);
              setCoverTimeMs(null);
              setUploadProgress(null);
              setUploadError(null);
            }}
            onReplace={triggerFilePicker}
          />
        )}

        {uploadError && hasMedia && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {uploadError}
          </div>
        )}
      </section>

      {/* RIGHT: Compose Sidebar */}
      <aside className="flex flex-col gap-5">
        <CaptionEditor
          caption={caption}
          setCaption={setCaption}
          captionLen={captionLen}
        />

        <TagChips
          tags={tags}
          tagInput={tagInput}
          setTagInput={setTagInput}
          addTagFromInput={addTagFromInput}
          removeTag={removeTag}
        />

        {/* Format-Picker — nur sichtbar wenn Media geladen */}
        {hasMedia && (
          <AspectRatioPicker
            value={aspectRatio}
            onChange={setAspectRatio}
          />
        )}

        <PrivacyPanel
          privacy={privacy}
          setPrivacy={setPrivacy}
          allowComments={allowComments}
          setAllowComments={setAllowComments}
          allowDuet={allowDuet}
          setAllowDuet={setAllowDuet}
          allowDownload={allowDownload}
          setAllowDownload={setAllowDownload}
          womenOnly={womenOnly}
          setWomenOnly={setWomenOnly}
        />

        {/* Music Picker (v1.w.UI.234) */}
        <div>
          <button
            type="button"
            onClick={() => setMusicPickerOpen(true)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50',
              audioUrl ? 'border-primary/40 bg-primary/5 text-primary' : 'bg-background text-muted-foreground',
            )}
          >
            <Music2 className="h-4 w-4 shrink-0" />
            {audioUrl
              ? (() => {
                  const t = MUSIC_LIBRARY.find((x) => x.url === audioUrl);
                  return t ? `${t.title} · ${t.genre}` : 'Musik gewählt';
                })()
              : 'Musik hinzufügen'}
            {audioUrl && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setAudioUrl(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setAudioUrl(null); } }}
                className="ml-auto rounded-full p-0.5 hover:bg-primary/20"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </div>

        {/* Action-Buttons */}
        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={handlePublish}
            disabled={!canPublish}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span className="font-semibold">Jetzt posten</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScheduleOpen(true)}
              disabled={!hasMedia || isPending}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border bg-background text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Clock className="h-4 w-4" />
              Planen
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={(!hasMedia && !caption) || isPending}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border bg-background text-sm transition-colors hover:bg-muted disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Entwurf
            </button>
          </div>
        </div>

        {draftId && (
          <p className="text-center text-xs text-muted-foreground">
            Automatisch gespeichert als Entwurf ·{' '}
            <a href="/create/drafts" className="underline hover:text-foreground">
              Alle Entwürfe
            </a>
          </p>
        )}
      </aside>

      {/* Music Picker Modal */}
      <MusicPickerDialog
        open={musicPickerOpen}
        onClose={() => setMusicPickerOpen(false)}
        selectedUrl={audioUrl}
        onSelect={setAudioUrl}
      />

      {/* Scheduler Modal */}
      {scheduleOpen && (
        <ScheduleModal
          value={scheduleAt}
          onChange={setScheduleAt}
          onClose={() => setScheduleOpen(false)}
          onConfirm={handleSchedule}
          busy={isPending}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-lg',
            toast.kind === 'ok'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white',
          )}
        >
          {toast.kind === 'ok' ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> {toast.msg}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> {toast.msg}
            </span>
          )}
        </div>
      )}

      {/* v1.28.0: AI-Image-Sheet — Parität mit Native-Create-Flow */}
      <AIImageSheet
        open={aiSheetOpen}
        onOpenChange={setAiSheetOpen}
        onUseImage={applyAIImage}
        purpose="post_cover"
        defaultSize="1024x1536"
        title="Post-Bild mit KI"
        promptPlaceholder="Beschreibe dein Wunsch-Motiv — z.B. „Sonnenuntergang über Bergen"
        suggestions={[
          'Moody-Portrait in Neon-Licht, cinematisch',
          'Abstrakte Komposition in warmen Farben',
          'Street-Photography-Look, schwarz-weiß',
        ]}
      />
    </div>
  );
}

// =============================================================================
// Sub-Components
// =============================================================================

function MediaPreview({
  localPreviewUrl,
  remoteMediaUrl,
  mediaType,
  uploadProgress,
  coverTimeMs,
  onCoverTimeChange,
  onRemove,
  onReplace,
}: {
  localPreviewUrl: string | null;
  remoteMediaUrl: string | null;
  mediaType: MediaType | null;
  uploadProgress: number | null;
  coverTimeMs: number | null;
  onCoverTimeChange: (ms: number | null) => void;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const src = localPreviewUrl ?? remoteMediaUrl;
  if (!src) return null;

  return (
    <div className="relative flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        {mediaType === 'video' ? (
          <VideoPreview
            src={src}
            coverTimeMs={coverTimeMs}
            onCoverTimeChange={onCoverTimeChange}
          />
        ) : (
          // Bild — next/image, unoptimized weil lokale blob: URL
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="mx-auto max-h-[720px] w-full object-contain"
          />
        )}

        {/* Upload-Progress-Overlay */}
        {uploadProgress !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white">
            <Loader2 className="mb-3 h-8 w-8 animate-spin" />
            <div className="mb-2 text-sm">
              Upload läuft… {uploadProgress}%
            </div>
            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Top-Right Actions */}
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            type="button"
            onClick={onReplace}
            className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/80"
            title="Anderes Medium wählen"
          >
            Ersetzen
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
            aria-label="Entfernen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoPreview({
  src,
  coverTimeMs,
  onCoverTimeChange,
}: {
  src: string;
  coverTimeMs: number | null;
  onCoverTimeChange: (ms: number | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        controls
        preload="metadata"
        onLoadedMetadata={() => {
          const d = videoRef.current?.duration ?? 0;
          if (d > 0 && Number.isFinite(d)) setDuration(d);
        }}
        className="mx-auto max-h-[720px] w-full"
        playsInline
      />

      {/* Cover-Frame-Picker Button */}
      <div className="absolute bottom-16 right-3 z-10">
        <button
          type="button"
          onClick={() => setShowCoverPicker((x) => !x)}
          className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/90"
        >
          <Camera className="h-3.5 w-3.5" />
          Cover
        </button>
      </div>

      {/* Cover-Frame-Picker Panel */}
      {showCoverPicker && duration && (
        <div className="absolute bottom-28 left-3 right-3 z-20 rounded-xl border bg-background/95 p-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium">Cover wählen</span>
            <span className="text-muted-foreground">
              {((coverTimeMs ?? 0) / 1000).toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.floor(duration * 1000)}
            step={100}
            value={coverTimeMs ?? 0}
            onChange={(e) => {
              const ms = Number(e.target.value);
              onCoverTimeChange(ms);
              if (videoRef.current) {
                videoRef.current.currentTime = ms / 1000;
                videoRef.current.pause();
              }
            }}
            className="w-full accent-primary"
          />
        </div>
      )}
    </div>
  );
}

function CaptionEditor({
  caption,
  setCaption,
  captionLen,
}: {
  caption: string;
  setCaption: (v: string) => void;
  captionLen: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<
    | { kind: 'hashtag'; items: string[]; token: { start: number; end: number } }
    | {
        kind: 'mention';
        items: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; verified: boolean }>;
        token: { start: number; end: number };
      }
    | null
  >(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const debounceRef = useRef<number | null>(null);
  const searchTokenRef = useRef(0);

  const probeCaret = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    const prefix = caption.slice(0, pos);
    // Finde aktuelles Token (Wort ab zuletzt # oder @ bis Cursor)
    const match = /([@#])([\w.-]*)$/.exec(prefix);
    if (!match) {
      setSuggestions(null);
      return;
    }
    const trigger = match[1] as '#' | '@';
    const query = match[2];
    const start = pos - match[0].length;
    const end = pos;

    if (query.length < 1) {
      setSuggestions(null);
      return;
    }

    // Debounce 200ms
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const myToken = ++searchTokenRef.current;
    debounceRef.current = window.setTimeout(async () => {
      if (trigger === '#') {
        const items = await searchHashtagSuggestions(query);
        if (myToken !== searchTokenRef.current) return;
        setSuggestions(items.length > 0 ? { kind: 'hashtag', items, token: { start, end } } : null);
      } else {
        const items = await searchMentionSuggestions(query);
        if (myToken !== searchTokenRef.current) return;
        setSuggestions(items.length > 0 ? { kind: 'mention', items, token: { start, end } } : null);
      }
      setActiveIdx(0);
    }, 200);
  }, [caption]);

  useEffect(() => {
    probeCaret();
  }, [caption, probeCaret]);

  const insertSuggestion = useCallback(
    (insertText: string) => {
      if (!suggestions) return;
      const { start, end } = suggestions.token;
      const next = caption.slice(0, start) + insertText + ' ' + caption.slice(end);
      setCaption(next);
      setSuggestions(null);
      // Cursor hinter das eingefügte Wort setzen
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        const newCaret = start + insertText.length + 1;
        el.selectionStart = el.selectionEnd = newCaret;
        el.focus();
      });
    },
    [suggestions, caption, setCaption],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggestions) return;
    const max =
      suggestions.kind === 'hashtag'
        ? suggestions.items.length
        : suggestions.items.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % max);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + max) % max);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.kind === 'hashtag') {
        insertSuggestion(suggestions.items[activeIdx] ?? '');
      } else {
        const u = suggestions.items[activeIdx];
        if (u) insertSuggestion(`@${u.username}`);
      }
    } else if (e.key === 'Escape') {
      setSuggestions(null);
    }
  };

  return (
    <div className="relative">
      <label className="mb-2 flex items-center justify-between text-sm font-medium">
        <span>Caption</span>
        <span
          className={cn(
            'text-xs tabular-nums text-muted-foreground',
            captionLen > CAPTION_MAX_LEN && 'text-red-500',
          )}
        >
          {captionLen} / {CAPTION_MAX_LEN}
        </span>
      </label>
      <textarea
        ref={textareaRef}
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX_LEN))}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Kurz verzögert, damit Click auf Dropdown-Item noch durchkommt.
          setTimeout(() => setSuggestions(null), 120);
        }}
        placeholder="Beschreib deinen Post. #hashtag und @mention werden automatisch vorgeschlagen."
        className="h-32 w-full resize-none rounded-xl border bg-background px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary"
      />

      {suggestions && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border bg-popover shadow-lg">
          {suggestions.kind === 'hashtag'
            ? suggestions.items.map((tag, i) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertSuggestion(tag);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                    i === activeIdx && 'bg-muted',
                  )}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs text-primary">
                    #
                  </span>
                  <span className="font-medium">{tag}</span>
                </button>
              ))
            : suggestions.items.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertSuggestion(`@${u.username}`);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                    i === activeIdx && 'bg-muted',
                  )}
                >
                  <div className="relative h-8 w-8 flex-none overflow-hidden rounded-full bg-muted">
                    {u.avatar_url && (
                      <Image
                        src={u.avatar_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="32px"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">@{u.username}</div>
                    {u.display_name && (
                      <div className="truncate text-xs text-muted-foreground">
                        {u.display_name}
                      </div>
                    )}
                  </div>
                </button>
              ))}
        </div>
      )}
    </div>
  );
}

function TagChips({
  tags,
  tagInput,
  setTagInput,
  addTagFromInput,
  removeTag,
}: {
  tags: string[];
  tagInput: string;
  setTagInput: (v: string) => void;
  addTagFromInput: () => void;
  removeTag: (t: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Tags</label>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => removeTag(t)}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
          >
            {t}
            <X className="h-3 w-3" />
          </button>
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTagFromInput();
            } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
              removeTag(tags[tags.length - 1]);
            }
          }}
          placeholder={tags.length === 0 ? '#hashtag hinzufügen…' : ''}
          className="min-w-[120px] flex-1 bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

function AspectRatioPicker({
  value,
  onChange,
}: {
  value: 'portrait' | 'landscape' | 'square';
  onChange: (v: 'portrait' | 'landscape' | 'square') => void;
}) {
  const options: Array<{
    v: 'portrait' | 'landscape' | 'square';
    label: string;
    sub: string;
    preview: string; // Tailwind-Klassen für das visuelle Vorschau-Rechteck
  }> = [
    { v: 'portrait',  label: 'Hochformat', sub: '9:16',  preview: 'h-8 w-5' },
    { v: 'landscape', label: 'Querformat', sub: '16:9',  preview: 'h-5 w-8' },
    { v: 'square',    label: 'Quadrat',    sub: '1:1',   preview: 'h-6 w-6' },
  ];

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Format</label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'bg-background hover:bg-muted',
              )}
            >
              {/* Visuelle Vorschau des Seitenverhältnisses */}
              <div
                className={cn(
                  'rounded-sm border-2',
                  active ? 'border-primary' : 'border-muted-foreground/40',
                  o.preview,
                )}
              />
              <span className="font-medium">{o.label}</span>
              <span className="text-[10px] text-muted-foreground">{o.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PrivacyPanel({
  privacy,
  setPrivacy,
  allowComments,
  setAllowComments,
  allowDuet,
  setAllowDuet,
  allowDownload,
  setAllowDownload,
  womenOnly,
  setWomenOnly,
}: {
  privacy: Privacy;
  setPrivacy: (v: Privacy) => void;
  allowComments: boolean;
  setAllowComments: (v: boolean) => void;
  allowDuet: boolean;
  setAllowDuet: (v: boolean) => void;
  allowDownload: boolean;
  setAllowDownload: (v: boolean) => void;
  womenOnly: boolean;
  setWomenOnly: (v: boolean) => void;
}) {
  const options: Array<{
    v: Privacy;
    label: string;
    icon: typeof Globe;
    sub: string;
  }> = [
    { v: 'public', label: 'Öffentlich', icon: Globe, sub: 'Alle können sehen' },
    { v: 'friends', label: 'Freunde', icon: UsersIcon, sub: 'Nur Follower' },
    { v: 'private', label: 'Privat', icon: Lock, sub: 'Nur du' },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-2 block text-sm font-medium">Sichtbarkeit</label>
        <div className="grid grid-cols-3 gap-2">
          {options.map((o) => {
            const Icon = o.icon;
            const active = privacy === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => setPrivacy(o.v)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'bg-background hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{o.label}</span>
                <span className="text-[10px] text-muted-foreground">{o.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
        <ToggleRow
          label="Kommentare erlauben"
          checked={allowComments}
          onChange={setAllowComments}
        />
        <ToggleRow label="Duette erlauben" checked={allowDuet} onChange={setAllowDuet} />
        <ToggleRow
          label="Download erlauben"
          checked={allowDownload}
          onChange={setAllowDownload}
        />
        <ToggleRow
          label="Nur für Frauen (♀)"
          checked={womenOnly}
          onChange={setWomenOnly}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between text-sm">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          'inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0',
          checked ? 'bg-emerald-500' : 'bg-zinc-600',
        )}
        aria-pressed={checked}
      >
        <span
          className={cn(
            'h-[18px] w-[18px] rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[25px]' : 'translate-x-[3px]',
          )}
        />
      </button>
    </label>
  );
}

function ScheduleModal({
  value,
  onChange,
  onClose,
  onConfirm,
  busy,
}: {
  value: Date;
  onChange: (d: Date) => void;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  // 60-Tage-Future-Cap (Native-Constraint)
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  }, []);

  const presets = useMemo(() => {
    const now = new Date();
    return [
      { label: 'In 1h', d: addMin(now, 60) },
      { label: 'In 3h', d: addMin(now, 180) },
      { label: 'Heute 20:00', d: atTime(now, 20, 0) },
      { label: 'Morgen 09:00', d: atTime(addDays(now, 1), 9, 0) },
      { label: 'Morgen 18:00', d: atTime(addDays(now, 1), 18, 0) },
      { label: 'In 3 Tagen', d: addDays(now, 3) },
    ];
  }, []);

  const futureOk = value.getTime() > Date.now() + 60_000; // ≥1min future
  const notTooFar = value.getTime() < maxDate.getTime();
  const canConfirm = futureOk && notTooFar && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Zeitpunkt wählen</h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-muted/50 p-4 text-center">
          <div className="text-2xl font-semibold tabular-nums">
            {formatDE(value)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {relativeFuture(value)}
          </div>
        </div>

        {/* Preset-Chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          {presets.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(p.d)}
              disabled={p.d.getTime() < Date.now() + 60_000}
              className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-muted disabled:opacity-40"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Datum + Zeit Inputs */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Datum</label>
            <input
              type="date"
              value={toDateInput(value)}
              min={toDateInput(new Date())}
              max={toDateInput(maxDate)}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                const next = new Date(value);
                next.setFullYear(y, m - 1, d);
                onChange(next);
              }}
              className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Uhrzeit</label>
            <input
              type="time"
              value={toTimeInput(value)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                const next = new Date(value);
                next.setHours(h, m, 0, 0);
                onChange(next);
              }}
              className="w-full rounded-lg border bg-background px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border bg-background text-sm hover:bg-muted"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Clock className="h-4 w-4" /> Planen
              </>
            )}
          </button>
        </div>

        {!futureOk && (
          <p className="mt-2 text-center text-xs text-red-500">
            Zeitpunkt muss mindestens 1 Minute in der Zukunft liegen.
          </p>
        )}
        {!notTooFar && (
          <p className="mt-2 text-center text-xs text-red-500">
            Max. 60 Tage in der Zukunft.
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function fallbackMime(t: MediaType, ext: string): string {
  if (t === 'video') {
    if (ext === 'mov') return 'video/quicktime';
    if (ext === 'webm') return 'video/webm';
    return 'video/mp4';
  }
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function putWithProgress(
  url: string,
  body: Blob,
  contentType: string,
  onProgress: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload fehlgeschlagen (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error('Netzwerkfehler beim Upload.'));
    xhr.send(body);
  });
}

async function extractVideoFrameBlob(file: File, timeMs: number): Promise<Blob | null> {
  const videoUrl = URL.createObjectURL(file);
  try {
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.src = videoUrl;

      video.onloadedmetadata = () => {
        const seekTo = Math.min((video.duration || 1) - 0.05, Math.max(0, timeMs / 1000));
        video.currentTime = seekTo;
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
      };
      video.onerror = () => reject(new Error('Video-Preview-Fehler.'));
    });
    return blob;
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

function nextQuarterHour(d: Date): Date {
  const r = new Date(d);
  r.setSeconds(0, 0);
  const extra = 15 - (r.getMinutes() % 15);
  r.setMinutes(r.getMinutes() + (extra === 0 ? 15 : extra));
  return r;
}
function addMin(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}
function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
function atTime(d: Date, h: number, m: number): Date {
  const r = new Date(d);
  r.setHours(h, m, 0, 0);
  return r;
}
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toTimeInput(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
function formatDE(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${mon}.${y} · ${h}:${mi}`;
}
function relativeFuture(d: Date): string {
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return 'Vergangen';
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `in ${mins} Min.`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs} Std.`;
  const days = Math.round(hrs / 24);
  return `in ${days} Tagen`;
}
