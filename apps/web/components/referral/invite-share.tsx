"use client";

// -----------------------------------------------------------------------------
// InviteShare — Web-Invite-Fläche (#5 Referral, Parität zur App-Einstellung
// „Freund:innen einladen"). Zeigt den eigenen Einladungslink + Teilen-Wege.
//
// Der Link zeigt auf /i/<username> → warmes Invite-Landing, das die Attribution
// per Server-Action setzt (siehe app/actions/referral.ts). Hier KEINE Belohnungs-
// Logik — bewusst nur Teilen + Zähler (Belohnung bleibt manuelle Entscheidung).
//
// Klar wegklickbar, kein Force-Share / kein FOMO (Design-Gesetz §3+4).
// -----------------------------------------------------------------------------

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InviteShare({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);

  // Auf der Live-Domain (www.serlo.ch) ergibt origin den korrekten Share-Link;
  // lokal zeigt er auf localhost (nur Dev sichtbar).
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://www.serlo.ch";
  const inviteUrl = `${origin}/i/${username}`;

  const shareText = `Komm zu Serlo 🌸 — Videos, Live-Streams und ein Marktplatz aus der Community.\n${inviteUrl}`;
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
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
      `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent("Komm zu Serlo 🌸 — aus der Community.")}`,
      "_blank",
    );
  const nativeShare = async () => {
    try {
      await navigator.share({
        title: "Serlo",
        text: "Komm zu Serlo 🌸 — aus der Community.",
        url: inviteUrl,
      });
    } catch {
      /* User hat abgebrochen — kein Fehler */
    }
  };

  return (
    <div className="space-y-3">
      {/* Link-Vorschau (readonly, ein Klick = kopieren) */}
      <button
        type="button"
        onClick={copy}
        className="flex w-full items-center gap-2 overflow-hidden rounded-xl bg-card/50 px-3 py-2.5 text-left ring-1 ring-border transition hover:bg-card"
      >
        <span className="flex-1 truncate text-sm text-muted-foreground">
          {inviteUrl}
        </span>
        {copied ? (
          <Check className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : (
          <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      <div className="grid grid-cols-3 gap-2">
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
        <Button variant="outline" className="w-full" onClick={nativeShare}>
          Mehr Optionen…
        </Button>
      )}
    </div>
  );
}
