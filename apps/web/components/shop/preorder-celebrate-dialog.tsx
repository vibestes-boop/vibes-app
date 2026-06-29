"use client";

// -----------------------------------------------------------------------------
// PreorderCelebrateDialog — Teilen-Loop am Engagement-Peak (Web-Parität zur App).
//
// Öffnet sich nach erfolgreichem Vormerken: warme Feier + Teilen-Anstoß. Teilen
// nutzt den HTTPS-Produkt-Link, der via OG-Bild als gebrandete Vorbestell-Karte
// unfurlt. Klar wegklickbar (Maßhalten/Ethik, kein Force-Share, kein FOMO).
// -----------------------------------------------------------------------------

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatEur } from "@/lib/utils";
import type { ShopProduct } from "@/lib/data/shop";

export function PreorderCelebrateDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: ShopProduct;
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/shop/${product.id}`
      : `/shop/${product.id}`;
  const priceLabel = formatEur(product.price_eur)
    ? `${formatEur(product.price_eur)} · Vorbestellung`
    : "Vorbestellung";
  const shareText = `${product.title} — ${priceLabel}\n${shareUrl}`;
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard blockiert (z. B. kein HTTPS) — still ignorieren */
    }
  };
  const whatsapp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  const telegram = () =>
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`${product.title} — ${priceLabel}`)}`,
      "_blank",
    );
  const nativeShare = async () => {
    try {
      await navigator.share({ title: product.title, text: priceLabel, url: shareUrl });
    } catch {
      /* User hat abgebrochen — kein Fehler */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <span className="text-4xl" aria-hidden="true">
            🤎
          </span>
          <DialogTitle className="text-xl">Vorbestellt!</DialogTitle>
          <DialogDescription>
            Teil es mit Freunden — je mehr mitmachen, desto eher startet die
            Sammelbestellung 🚀
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Kopiert
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Link
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={whatsapp}>
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={telegram}>
            Telegram
          </Button>
        </div>

        {canNativeShare && (
          <Button variant="outline" className="mt-2 w-full" onClick={nativeShare}>
            Mehr Optionen…
          </Button>
        )}

        <Button
          variant="ghost"
          className="mt-1 w-full text-muted-foreground"
          onClick={() => onOpenChange(false)}
        >
          Später
        </Button>
      </DialogContent>
    </Dialog>
  );
}
