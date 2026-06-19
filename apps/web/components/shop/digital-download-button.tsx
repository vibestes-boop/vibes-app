"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// Sicherer Download digitaler Produkte: generate_download_url (prüft Order +
// Käufer-Berechtigung server-seitig) → kurzlebige Signed URL aus dem privaten
// Bucket `digital-products`. Kein statischer `download_url` (Bucket ist privat).
export function DigitalDownloadButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("generate_download_url", {
        p_order_id: orderId,
      });
      const res = (data ?? null) as
        | { error?: string; bucket?: string; file_path?: string }
        | null;
      if (error || !res) {
        toast.error("Download nicht verfügbar.");
        return;
      }
      if (res.error) {
        toast.error(
          res.error === "no_file_attached"
            ? "Für dieses Produkt wurde keine Datei hinterlegt."
            : "Download nicht verfügbar.",
        );
        return;
      }
      if (!res.bucket || !res.file_path) {
        toast.error("Download nicht verfügbar.");
        return;
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from(res.bucket)
        .createSignedUrl(res.file_path, 3600);
      if (signErr || !signed?.signedUrl) {
        toast.error("Download-Link konnte nicht erstellt werden.");
        return;
      }
      window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Download fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Herunterladen
    </button>
  );
}
