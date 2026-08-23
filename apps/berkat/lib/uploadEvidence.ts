/**
 * Belegfotos für Streitfälle — privater Eimer, nicht das öffentliche R2
 * ============================================================================
 *
 * ⚠️ WARUM DAS NICHT ÜBER `uploadImage` LÄUFT.
 *
 * Bis zum 23.08.2026 tat es das: `DisputeSheet` rief `pickAndUpload('cover', …)`,
 * und das Foto landete unter `thumbnails/` im **öffentlichen** R2-Eimer — im
 * selben Regal wie Show-Cover und Artikelfotos, weltweit abrufbar, wer die
 * Adresse hat. Ein Belegfoto zeigt aber typischerweise genau das, was ein
 * Show-Cover nie zeigt: ein Adressetikett, eine beschädigte Sendung im
 * Wohnzimmer, manchmal Menschen. Und die Adresse geht per Meldung an alle
 * Admins.
 *
 * Deshalb ein eigener Weg in den privaten Bucket `dispute-evidence`
 * (`20260823110000`). Wer ihn liest, entscheidet die RLS auf `storage.objects`:
 * Melder, Gegenseite, Betreiber — sonst niemand.
 *
 * ⚠️ WAS HIER GESPEICHERT WIRD, IST EIN PFAD — KEINE ADRESSE.
 * `order_disputes.image_url` trug bisher eine fertige URL. Ab jetzt steht dort
 * `<melder-id>/<bestell-id>/<datei>.jpg`, und die anzeigbare Adresse entsteht
 * erst beim Ansehen (`evidenceUri`), mit kurzer Gültigkeit. Der Spaltenname
 * bleibt — ihn zu ändern hiesse, den Typ, die RPC und drei Bildschirme
 * anzufassen, und der Name ist pragmatisch umdeutbar (dieselbe Entscheidung
 * wie bei `live_polls.host_id` in Serlo).
 *
 * ⚠️ ALTBESTAND: Zeilen von vor dem 23.08.2026 tragen weiterhin eine
 * `https://…`-Adresse. `evidenceUri` erkennt beides — wer den Zweig entfernt,
 * macht die alten Belege unsichtbar.
 */

import { useEffect, useState } from 'react';

import { supabase } from './supabase';
import { askImageSource, pickImage, type PickedImage } from './uploadImage';

const BUCKET = 'dispute-evidence';

/** Deckel wie im Eimer selbst (`file_size_limit`), damit der Fehler hier
 *  entsteht und nicht als nackter Storage-Fehler zurückkommt. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Lädt ein bereits gewähltes Bild in den privaten Eimer und gibt den PFAD
 * zurück (nicht die Adresse).
 */
export async function uploadEvidence(image: PickedImage, orderId: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Nicht angemeldet.');

  const fileResponse = await fetch(image.uri);
  if (!fileResponse.ok) throw new Error('Das Bild konnte nicht gelesen werden.');
  const buffer = await fileResponse.arrayBuffer();

  if (buffer.byteLength > MAX_BYTES) {
    throw new Error(
      `Das Bild ist ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB groß — höchstens 10 MB.`,
    );
  }

  // Der erste Pfad-Teil IST die Identität — darauf steht die INSERT-Policy
  // (`(storage.foldername(name))[1] = auth.uid()`). Die Bestell-ID darunter
  // ist Ordnung, keine Sicherheit.
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${userId}/${orderId}/${unique}.${image.extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: image.mimeType,
    // Kein `upsert`: Jeder Beleg bekommt einen eigenen Namen, und ein
    // Überschreiben wäre bei einem Beweisstück das falsche Verhalten.
    upsert: false,
  });
  if (error) throw new Error('Der Upload ist fehlgeschlagen.');

  return path;
}

/**
 * Auswählen und hochladen in einem Schritt. Null = abgebrochen.
 *
 * Zuschnitt `portrait`, also GAR KEIN Rahmen — ein Beleg ist genau das, was
 * die Kamera gesehen hat; ein quadratischer Rahmen schnitte ein Viertel der
 * Höhe weg, und darin liegt womöglich der Schaden.
 */
export async function pickAndUploadEvidence(orderId: string): Promise<string | null> {
  const source = await askImageSource();
  if (!source) return null;
  const picked = await pickImage('portrait', source);
  if (!picked) return null;
  return uploadEvidence(picked, orderId);
}

/**
 * Macht aus dem, was in `order_disputes.image_url` steht, etwas Anzeigbares.
 *
 * Zwei Formen, und beide müssen bleiben:
 *   • Pfad im privaten Eimer  → kurzlebige Signed URL (5 Minuten)
 *   • `https://…` (Altbestand) → unverändert
 *
 * Gibt `null` zurück, wenn der Betrachter das Bild nicht sehen darf — die RLS
 * lehnt die Signatur dann ab. Das ist der gewollte Ausgang: kein Bild statt
 * einer Fehlermeldung, die verrät, dass es eines gibt.
 */
export async function evidenceUri(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith('http://') || ref.startsWith('https://')) return ref;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ref, 300);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Dieselbe Auskunft für einen Bildschirm — die Signatur entsteht asynchron,
 * ein `<Image source={{ uri }}>` will sie aber sofort.
 *
 * ⚠️ Kein React Query dafür. Eine Signed URL läuft nach fünf Minuten ab; sie
 * zwischenzuspeichern hiesse, beim zweiten Öffnen ein totes Bild zu zeigen.
 * Der Aufwand ist genau ein Aufruf je Ansicht, und der Fall ist selten.
 *
 * `alive` fängt den Bildschirm ab, der geschlossen wird, während die Signatur
 * noch unterwegs ist — sonst setzt der Effekt Zustand auf eine abgebaute
 * Komponente.
 */
export function useEvidenceUri(ref: string | null | undefined): string | null {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!ref) { setUri(null); return; }
    void evidenceUri(ref).then((u) => { if (alive) setUri(u); });
    return () => { alive = false; };
  }, [ref]);

  return uri;
}
