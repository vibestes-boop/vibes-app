// Das eigene Profil bearbeiten.
//
// Bis zum 16.08.2026 zeigte `app/seller/[id].tsx` eine Bio an, die niemand je
// setzen konnte — das Feld war tote Anzeige. In Berkat gab es keinen Ort dafür,
// und wer sein Serlo-Profil nicht kannte, hatte keinen.
//
// Geschrieben werden ausschließlich `bio`, `display_name` und `banner_url`.
// `profiles` gehört Serlo und trägt Spalten, die ein Client nicht anfassen darf
// — `women_only_verified` ist serverseitig über einen BEFORE-UPDATE-Trigger
// gesperrt, `coins_balance` ist Geld. Ein `update({ ...profile, bio })` würde
// beides mitschicken; deshalb stehen hier genau drei Felder.
//
// `username` fehlt bewusst: Er ist Serlo-weit eindeutig und steht schon in
// Live-Chats, Bestellungen und Bürgschaften. Ihn hier änderbar zu machen hieße,
// an einem Namen zu drehen, der an anderen Orten bereits vergeben ist. Der
// ANZEIGENAME daneben ist frei und genau dafür da.
//
// Die Policy heißt „User kann eigenes Profil bearbeiten" und prüft
// `auth.uid() = id` (am 16.08. im Schema-Abzug nachgesehen). Das `.eq('id', …)`
// ist trotzdem nicht überflüssig: Ohne WHERE würde PostgREST ein UPDATE über
// die ganze Tabelle schicken, das die Policy zwar auf eine Zeile eindampft,
// aber als Absicht falsch aussieht.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

/** Grenzen wie bei den Bürgen-Sätzen — kurz genug, dass niemand Werbung einträgt. */
export const BIO_MAX = 300;
export const NAME_MAX = 40;

export type ProfileEdit = {
  bio: string;
  /** Der frei wählbare Anzeigename — NICHT der eindeutige `username`. */
  displayName: string;
  /** R2-Adresse des Kopfbilds, oder null zum Entfernen. */
  bannerUrl?: string | null;
  /**
   * R2-Adresse des Profilbilds, oder null zum Entfernen.
   *
   * ⚠️ Ergänzt am 21.08.2026. Bis dahin gab es in ganz Berkat **keinen einzigen
   * Avatar-Upload** — das Bild wurde an einem Dutzend Stellen ANGEZEIGT (Live-
   * Kopf, Verkäuferkarte, Zuschauerliste, Bewertungen, Konto-Reiter), aber
   * nirgends gesetzt. Wer keins aus Serlo mitbrachte, hatte für immer den
   * grauen Kreis. Am Gerät gefunden, im ersten Durchlauf der Prüfliste.
   *
   * Für einen Marktplatz, dessen Kernargument Vertrauen zwischen Menschen ist,
   * ist das Gesicht des Verkäufers nicht optional.
   */
  avatarUrl?: string | null;
};

export function useUpdateProfile(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProfileEdit): Promise<void> => {
      if (!userId) throw new Error('not_authenticated');
      const bio = input.bio.trim().slice(0, BIO_MAX);
      const displayName = input.displayName.trim().slice(0, NAME_MAX);

      const { error } = await supabase
        .from('profiles')
        .update({
          // Leer heißt NULL, nicht "". Sonst rendert die Profilseite eine Zeile
          // mit nichts darin und der Abstand darunter stimmt nicht mehr.
          bio: bio.length > 0 ? bio : null,
          display_name: displayName.length > 0 ? displayName : null,
          // `undefined` lässt die Spalte unangetastet — wer nur die Bio ändert,
          // soll nicht sein Banner verlieren.
          ...(input.bannerUrl !== undefined ? { banner_url: input.bannerUrl } : {}),
          ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'seller-profile', userId] });
    },
  });
}

export function profileEditErrorText(message: string): string {
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('42501') || message.toLowerCase().includes('permission'))
    return 'Das darfst du hier nicht ändern.';
  // Kein Sammel-Satz — was der Server sagt, steht hier (HANDOFF 3).
  return message ? `Der Server sagt: ${message}` : 'Das hat nicht geklappt.';
}
