'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, Coins, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';

import { sendCreatorTip } from '@/app/actions/payments';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

// -----------------------------------------------------------------------------
// CreatorTipButton — One-off Coin-Tip ohne Gift-Wrapping.
//
// Flow:
//   1. User klickt „Unterstützen" → Dialog öffnet sich
//   2. Preset-Beträge (50 / 200 / 500 / 1000) + Custom-Input
//   3. Optional 140-Char-Message
//   4. „Senden" → sendCreatorTip() → atomare DB-RPC
//   5. Success-State zeigt Herz + „X Coins gesendet" → Dialog schließt sich
//      nach 2s, Router.refresh() damit Coin-Balance im Header aktuell ist.
//   6. Bei „insufficient_coins" blendet der Error-State einen Shop-Link ein.
//
// Nicht-signierte User sehen einen „Einloggen"-Link statt des Buttons — damit
// der CTA sichtbar bleibt und als Anreiz wirkt, auch ohne Dialog zu triggern.
// -----------------------------------------------------------------------------

const PRESET_AMOUNTS = [50, 200, 500, 1000] as const;

interface Props {
  recipientId: string;
  recipientName: string;
  /** coins_balance des aktuellen Users — wird für UI-Hint verwendet, RPC
   * macht die autoritative Prüfung */
  currentCoins: number | null;
  isAuthenticated: boolean;
  /** True wenn viewer === recipient; Button wird dann nicht gerendert */
  isSelf: boolean;
}

type Stage = 'input' | 'success' | 'error';

export function CreatorTipButton({
  recipientId,
  recipientName,
  currentCoins,
  isAuthenticated,
  isSelf,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [amount, setAmount] = useState<number>(PRESET_AMOUNTS[1]);
  const [customInput, setCustomInput] = useState<string>('');
  const [message, setMessage] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [error, setError] = useState<string | null>(null);

  if (isSelf) return null;

  if (!isAuthenticated) {
    return (
      <Link
        href={`/login?next=/u/${encodeURIComponent(recipientName)}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
      >
        <Heart className="h-4 w-4" />
        Unterstützen
      </Link>
    );
  }

  function reset() {
    setStage('input');
    setAmount(PRESET_AMOUNTS[1]);
    setCustomInput('');
    setMessage('');
    setError(null);
  }

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) {
      // kleiner Delay damit die Close-Animation sauber durchläuft
      setTimeout(reset, 200);
    }
  }

  const effectiveAmount = customInput
    ? Math.max(1, Math.min(100000, Math.floor(Number(customInput)) || 0))
    : amount;
  const lowBalance = currentCoins !== null && currentCoins < effectiveAmount;

  function handleSubmit() {
    setError(null);
    if (effectiveAmount < 1) {
      setError('Bitte einen Betrag ≥ 1 angeben.');
      return;
    }

    startTransition(async () => {
      const result = await sendCreatorTip(
        recipientId,
        effectiveAmount,
        message.trim() || null,
      );
      if (!result.ok) {
        setError(result.error);
        setStage('error');
        return;
      }
      setStage('success');
      router.refresh();
      setTimeout(() => handleClose(false), 2000);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-500/90"
        >
          <Heart className="h-4 w-4 fill-current" />
          Unterstützen
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            @{recipientName} unterstützen
          </DialogTitle>
          <DialogDescription>
            Sende einmalig Coins — 85% landen als Diamanten beim Creator.
          </DialogDescription>
        </DialogHeader>

        {stage === 'input' && (
          <>
            {/* Preset-Beträge */}
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((preset) => {
                const isActive = !customInput && amount === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setAmount(preset);
                      setCustomInput('');
                    }}
                    className={`flex flex-col items-center rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                        : 'border-border bg-card hover:border-rose-500/50'
                    }`}
                  >
                    <Coins className="mb-0.5 h-3.5 w-3.5" />
                    {preset.toLocaleString('de-DE')}
                  </button>
                );
              })}
            </div>

            {/* Custom-Input */}
            <div>
              <label
                htmlFor="custom-amount"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Eigener Betrag
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <Coins className="h-4 w-4 text-brand-gold" />
                <input
                  id="custom-amount"
                  type="number"
                  min={1}
                  max={100000}
                  step={1}
                  inputMode="numeric"
                  value={customInput}
                  placeholder="z.B. 250"
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="tip-message"
                className="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Nachricht (optional, max. 140 Zeichen)
              </label>
              <textarea
                id="tip-message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 140))}
                rows={2}
                placeholder="Danke für den Content!"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-rose-500/60"
              />
              <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                {message.length}/140
              </p>
            </div>

            {/* Balance-Hint */}
            {currentCoins !== null && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  lowBalance
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-500'
                    : 'border-border bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Dein Guthaben</span>
                  <span className="font-medium tabular-nums">
                    {currentCoins.toLocaleString('de-DE')} Coins
                  </span>
                </div>
                {lowBalance && (
                  <Link
                    href="/coin-shop"
                    className="mt-1 block text-xs font-semibold underline hover:no-underline"
                  >
                    Nicht genug — jetzt aufladen →
                  </Link>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-500">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending || effectiveAmount < 1}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart className="h-4 w-4 fill-current" />
                )}
                {effectiveAmount.toLocaleString('de-DE')} Coins senden
              </button>
            </DialogFooter>
          </>
        )}

        {stage === 'success' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-center text-sm font-semibold">
              {effectiveAmount.toLocaleString('de-DE')} Coins gesendet
            </p>
            <p className="max-w-[280px] text-center text-xs text-muted-foreground">
              @{recipientName} bekommt eine Benachrichtigung.
            </p>
          </div>
        )}

        {stage === 'error' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
              <X className="h-8 w-8 text-rose-500" />
            </div>
            <p className="text-center text-sm font-semibold">Konnte nicht gesendet werden</p>
            <p className="max-w-[300px] text-center text-xs text-muted-foreground">
              {error ?? 'Unbekannter Fehler'}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                Erneut versuchen
              </button>
              <Link
                href="/coin-shop"
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Coins className="h-3 w-3" />
                Coins aufladen
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
