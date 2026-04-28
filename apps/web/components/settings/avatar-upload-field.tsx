'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Upload, Trash2, AlertCircle, Loader2, User, Sparkles } from 'lucide-react';

import { requestR2UploadUrl } from '@/app/actions/posts';
import { updateAvatar } from '@/app/actions/profile';
import { compressImage, extensionForMime } from '@/lib/image/compress';
import { cn } from '@/lib/utils';
import { AIImageSheet } from '@/components/ai/ai-image-sheet';

// -----------------------------------------------------------------------------
// <AvatarUploadField /> — v1.w.UI.21.
//
// Three-step R2-upload pattern (identisch zum Post-Editor / Story-Creator):
//   (1) compressImage() — browser-seitig Canvas-resize auf maxEdge 512 +
//       WebP/JPEG-Re-Encode bei Quality 0.85
//   (2) requestR2UploadUrl() → presigned PUT-URL von Supabase-Edge-Function
//       `r2-sign` (ALLOWED_KEY_PREFIXES enthält seit UI.21 'avatars/')
//   (3) fetch PUT → updateAvatar(publicUrl) als Server-Action die
//       `profiles.avatar_url` schreibt
//
// Kein Crop-UI in diesem Slice — der File-Picker erlaubt nur `image/*`, und
// das client-seitige `compressImage` resized auf quadratische Max-Edge
// (aspect-preserving, kein Crop). User kann den Avatar mit einem quadrat-
// igen Bild am besten kontrollieren; wir rendern das Preview in einem runden
// Container (`rounded-full` + `object-cover`) sodass der Browser den Crop
// visuell übernimmt.
//
// Remove-Button: rendert nur wenn `currentAvatarUrl` gesetzt ist. Ruft
// updateAvatar(null) → Avatar zurück auf Initials-Fallback.
// -----------------------------------------------------------------------------

const MAX_RAW_BYTES = 10 * 1024 * 1024; // 10 MB — vor Komprimierung
const MAX_EDGE_PX = 512; // Avatar-Maximum — renderngrößen nie >192px im Feed

export interface AvatarUploadFieldLabels {
  title: string;
  hint: string;
  upload: string;
  uploading: string;
  remove: string;
  /** Label for the AI-generate button (optional; button hidden when absent). */
  aiGenerate?: string;
  errorTooLarge: string;
  errorType: string;
  errorUpload: string;
  errorSign: string;
  errorSave: string;
}

export interface AvatarUploadFieldProps {
  /** Aktuelle Avatar-URL aus DB; `null` wenn noch keiner gesetzt. */
  initialAvatarUrl: string | null;
  /** Benötigt für den R2-Key-Pfad (`avatars/{userId}/{ts}.ext`). */
  userId: string;
  /** Displayname oder Username als Fallback-Initial-Letter. */
  displayName: string;
  labels: AvatarUploadFieldLabels;
}

export function AvatarUploadField({
  initialAvatarUrl,
  userId,
  displayName,
  labels,
}: AvatarUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(initialAvatarUrl);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();
  const [aiSheetOpen, setAiSheetOpen] = useState(false);

  const initial = (displayName || '?').trim().charAt(0).toUpperCase() || '?';
  const isBusy = progress !== null || isRemoving;

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset das Input sofort, sonst triggert der gleiche File kein neues
    // `change` (Browser-Standard-Verhalten).
    e.target.value = '';
    if (!file) return;

    setError(null);

    if (!file.type.startsWith('image/')) {
      setError(labels.errorType);
      return;
    }
    if (file.size > MAX_RAW_BYTES) {
      setError(labels.errorTooLarge);
      return;
    }

    setProgress(0);

    try {
      // (1) Komprimierung — bei Fehler fällt `compressImage` auf das Original
      // zurück (Passthrough), also nie als Showstopper.
      const compressed = await compressImage(file, {
        maxEdge: MAX_EDGE_PX,
        quality: 0.85,
      });

      const ext = extensionForMime(compressed.mimeType);
      const key = `avatars/${userId}/${Date.now()}.${ext}`;

      // (2) Presigned URL holen.
      const signed = await requestR2UploadUrl({
        key,
        contentType: compressed.mimeType,
      });

      if (!signed.ok) {
        setError(signed.error || labels.errorSign);
        setProgress(null);
        return;
      }

      // (3) PUT zu R2 mit XHR (damit wir echten Upload-Progress haben —
      // `fetch` kann upload-progress im Browser noch nicht).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signed.data.uploadUrl, true);
        xhr.setRequestHeader('Content-Type', compressed.mimeType);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(compressed.blob);
      });

      // (4) DB-Update via Server-Action.
      const saved = await updateAvatar(signed.data.publicUrl);
      if (!saved.ok) {
        setError(saved.error || labels.errorSave);
        setProgress(null);
        return;
      }

      setCurrentUrl(signed.data.publicUrl);
      setProgress(null);
    } catch {
      setError(labels.errorUpload);
      setProgress(null);
    }
  }

  function handleRemove() {
    setError(null);
    startRemoveTransition(async () => {
      const result = await updateAvatar(null);
      if (result.ok) {
        setCurrentUrl(null);
      } else {
        setError(result.error || labels.errorSave);
      }
    });
  }

  // ── v1.w.UI.221 — AI-generated avatar ────────────────────────────────────────
  // The AI image lands in Supabase Storage (`ai-generated` bucket) at a path
  // that doesn't satisfy the `/avatars/{userId}/` security-check in
  // `updateAvatar`. So we fetch it as a Blob client-side, compress it the
  // same way as a normal file upload, then push it to R2 at the canonical
  // `avatars/{userId}/ai-{ts}.ext` key before calling `updateAvatar`.
  async function handleAIImage(url: string) {
    setError(null);
    setProgress(0);
    try {
      // (1) Fetch AI image as blob.
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('fetch');
      const blob = await resp.blob();
      const file = new File([blob], 'ai-avatar.png', { type: blob.type || 'image/png' });

      // (2) Compress to 512px WebP.
      const compressed = await compressImage(file, { maxEdge: MAX_EDGE_PX, quality: 0.85 });
      const ext = extensionForMime(compressed.mimeType);
      const key = `avatars/${userId}/ai-${Date.now()}.${ext}`;

      // (3) Presigned R2 upload URL.
      const signed = await requestR2UploadUrl({ key, contentType: compressed.mimeType });
      if (!signed.ok) {
        setError(signed.error || labels.errorSign);
        setProgress(null);
        return;
      }

      // (4) PUT to R2.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', signed.data.uploadUrl, true);
        xhr.setRequestHeader('Content-Type', compressed.mimeType);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
        xhr.onerror = () => reject(new Error('network'));
        xhr.send(compressed.blob);
      });

      // (5) Save to profile.
      const saved = await updateAvatar(signed.data.publicUrl);
      if (!saved.ok) {
        setError(saved.error || labels.errorSave);
        setProgress(null);
        return;
      }

      setCurrentUrl(signed.data.publicUrl);
      setProgress(null);
    } catch {
      setError(labels.errorUpload);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-2" data-testid="avatar-upload-field">
      <label className="text-sm font-medium text-foreground">{labels.title}</label>

      <div className="flex items-start gap-4">
        {/* Avatar-Preview — rundes Bild oder Initial-Fallback. */}
        <div
          className={cn(
            'relative h-20 w-20 shrink-0 overflow-hidden rounded-full',
            'border border-border bg-muted',
            'flex items-center justify-center',
          )}
          data-testid="avatar-upload-preview"
        >
          {currentUrl ? (
            <Image
              src={currentUrl}
              alt={displayName}
              width={80}
              height={80}
              className="h-full w-full object-cover"
              unoptimized={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
              {initial !== '?' ? initial : <User className="h-8 w-8" aria-hidden="true" />}
            </div>
          )}

          {/* Progress-Overlay */}
          {progress !== null && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <div className="flex flex-col items-center">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span className="mt-1 text-xs tabular-nums">{progress}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm',
                'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
              data-testid="avatar-upload-button"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {progress !== null ? labels.uploading : labels.upload}
            </button>

            {labels.aiGenerate && (
              <button
                type="button"
                onClick={() => setAiSheetOpen(true)}
                disabled={isBusy}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-primary',
                  'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                data-testid="avatar-ai-button"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {labels.aiGenerate}
              </button>
            )}

            {currentUrl && !isBusy && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={isBusy}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground',
                  'hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                data-testid="avatar-remove-button"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {labels.remove}
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">{labels.hint}</p>

          {error && (
            <div
              className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400"
              role="alert"
              data-testid="avatar-upload-error"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileSelected}
        data-testid="avatar-upload-input"
      />

      {/* v1.w.UI.221 — AI avatar generation sheet */}
      <AIImageSheet
        open={aiSheetOpen}
        onOpenChange={setAiSheetOpen}
        onUseImage={(url) => void handleAIImage(url)}
        purpose="avatar"
        defaultSize="512x512"
        title="KI-Avatar erstellen"
        promptPlaceholder="Beschreibe deinen Wunsch-Avatar auf Deutsch oder Englisch…"
        suggestions={[
          'Realistisches Portrait, junger Mann, tschetschenisches Aussehen, sauberer Hintergrund',
          'Anime-Stil Avatar, farbige Haare, glänzende Augen',
          'Minimalistisches Icon, geometrisch, Blautöne',
          'Cartoon-Charakter, freundliches Lächeln, heller Hintergrund',
        ]}
      />
    </div>
  );
}
