'use client';

import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { Sparkles, X, RefreshCw, Check, Loader2 } from 'lucide-react';
import {
  generateAIImage,
  type AIImagePurpose,
  type AIImageSize,
} from '@/app/actions/ai';

// -----------------------------------------------------------------------------
// AIImageSheet — Wiederverwendbares Modal für AI-Image-Generation im Web.
// Web-Pendant zu components/ai/AIImageSheet.tsx (Native).
//
// Verwendung in allen 5 Einsatzorten gleich:
//   <AIImageSheet
//     open={open}
//     onOpenChange={setOpen}
//     onUseImage={(url) => setFormField(url)}
//     purpose="shop_mockup"
//     defaultSize="1024x1024"
//     suggestions={['Black hoodie on minimalist background', ...]}
//   />
// -----------------------------------------------------------------------------

const PROMPT_MIN = 3;
const PROMPT_MAX = 500;

function availableSizes(purpose: AIImagePurpose): AIImageSize[] {
  if (purpose === 'avatar' || purpose === 'sticker' || purpose === 'icon') {
    return ['512x512', '1024x1024'];
  }
  if (purpose === 'live_thumbnail' || purpose === 'post_cover') {
    return ['1024x1024', '1536x1024', '1024x1536'];
  }
  return ['1024x1024', '1024x1536', '1536x1024'];
}

function sizeLabel(sz: AIImageSize): string {
  if (sz === '512x512') return 'Klein · 1:1';
  if (sz === '1024x1024') return 'Quadrat · 1:1';
  if (sz === '1024x1536') return 'Hoch · 2:3';
  if (sz === '1536x1024') return 'Quer · 3:2';
  return sz;
}

function prettyError(code: string, fallback: string): string {
  switch (code) {
    case 'rate_limit_minute':
      return 'Du hast gerade mehrere Bilder generiert — kurz durchatmen und in einer Minute nochmal versuchen.';
    case 'rate_limit_day':
      return 'Tages-Limit erreicht (30 Bilder / 24h). Morgen geht es weiter.';
    case 'cost_limit_month':
      return 'Monats-Budget erreicht. Am 1. des nächsten Monats steht wieder Kontingent bereit.';
    case 'prompt_too_short':
      return 'Dein Prompt ist zu kurz — beschreibe das gewünschte Bild in mindestens 3 Zeichen.';
    case 'prompt_too_long':
      return 'Dein Prompt ist zu lang (max 2000 Zeichen).';
    case 'prompt_blocked':
      return 'Dieser Prompt enthält nicht erlaubte Inhalte.';
    case 'unauthorized':
      return 'Du musst eingeloggt sein.';
    case 'network_error':
      return 'Keine Verbindung. Prüfe dein Internet.';
    default:
      return fallback;
  }
}

export interface AIImageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseImage: (url: string) => void;
  purpose: AIImagePurpose;
  defaultSize?: AIImageSize;
  title?: string;
  promptPlaceholder?: string;
  suggestions?: string[];
}

export function AIImageSheet({
  open,
  onOpenChange,
  onUseImage,
  purpose,
  defaultSize,
  title = 'Bild mit KI erstellen',
  promptPlaceholder = 'Beschreibe dein Wunsch-Bild auf Deutsch oder Englisch…',
  suggestions,
}: AIImageSheetProps) {
  const sizes = availableSizes(purpose);
  const [size, setSize] = useState<AIImageSize>(defaultSize ?? sizes[0]);
  const [prompt, setPrompt] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Default-Size neu setzen wenn Purpose wechselt
  useEffect(() => {
    setSize(defaultSize ?? sizes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose, defaultSize]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setPrompt('');
      setPreviewUrl(null);
      setErrorMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const handleGenerate = () => {
    const trimmed = prompt.trim();
    if (trimmed.length < PROMPT_MIN) {
      setErrorMsg(prettyError('prompt_too_short', 'Prompt zu kurz.'));
      return;
    }
    setErrorMsg(null);
    setPreviewUrl(null);

    startTransition(async () => {
      const result = await generateAIImage({ prompt: trimmed, purpose, size });
      if (!result.ok) {
        setErrorMsg(prettyError(result.code, result.error));
        return;
      }
      setPreviewUrl(result.url);
    });
  };

  const handleUse = () => {
    if (!previewUrl) return;
    onUseImage(previewUrl);
    onOpenChange(false);
  };

  const handleRetry = () => {
    setPreviewUrl(null);
    setErrorMsg(null);
  };

  // Aspect-Class für das Preview-Wrapper-Div (Tailwind arbitrary aspect)
  const previewAspectClass = (() => {
    if (size === '1024x1536') return 'aspect-[2/3]';
    if (size === '1536x1024') return 'aspect-[3/2]';
    return 'aspect-square';
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-card shadow-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {previewUrl ? (
            <div
              className={`relative w-full overflow-hidden rounded-xl bg-muted ${previewAspectClass}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Generiertes Bild"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : (
            <>
              <label
                htmlFor="ai-prompt-input"
                className="mb-2 block text-xs font-semibold text-foreground"
              >
                Dein Prompt
              </label>
              <textarea
                id="ai-prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
                placeholder={promptPlaceholder}
                rows={4}
                maxLength={PROMPT_MAX}
                disabled={isPending}
                className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground">
                {prompt.length} / {PROMPT_MAX}
              </div>

              {suggestions && suggestions.length > 0 && (
                <>
                  <div className="mt-4 mb-2 text-xs font-semibold text-foreground">
                    Beispiele
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setPrompt(sug)}
                        className="max-w-full truncate rounded-full border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {sizes.length > 1 && (
                <>
                  <div className="mt-5 mb-2 text-xs font-semibold text-foreground">Format</div>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((sz) => {
                      const isActive = sz === size;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSize(sz)}
                          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                            isActive
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'bg-background text-foreground hover:bg-muted'
                          }`}
                        >
                          {sizeLabel(sz)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {errorMsg && (
            <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Action-Bar */}
        <div className="flex gap-2 border-t px-4 py-3">
          {previewUrl ? (
            <>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Anderen Prompt
              </button>
              <button
                type="button"
                onClick={handleUse}
                disabled={isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                Bild verwenden
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending || prompt.trim().length < PROMPT_MIN}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generiere…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Bild generieren
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-Export für komfortables Importieren nur der Props-Types
export type { AIImagePurpose, AIImageSize };
// Avoid unused-import lint on Image (reserved for <Image fill> switch later
// when the ai-generated bucket hostname is added to next.config images.remotePatterns)
void Image;
