'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CommentsBody } from './comments-body';

// -----------------------------------------------------------------------------
// CommentSheet — Bottom-Sheet auf Mobile, Right-Sheet auf Desktop/< xl.
// Seit v1.w.UI.11 Phase C nur noch ein Radix-Dialog-Wrapper um `CommentsBody`.
// Die gesamte Liste/Compose-Logik lebt in `comments-body.tsx`, damit sie
// auch vom inline `CommentPanel` (xl+ Push-Layout) konsumiert werden kann.
//
// Mount-Strategie: SheetContent wird erst beim Öffnen gerendert (Radix-
// Default), damit der Fetch in `useComments` on-demand läuft — selbes
// Verhalten wie v1 vor dem Body-Split (dort via `enabled={open}`, jetzt
// via „Component nicht gemountet → Hook nicht aktiv").
// -----------------------------------------------------------------------------

export interface CommentSheetProps {
  postId: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  allowComments: boolean;
  viewerId: string | null;
}

export function CommentSheet({ postId, open, onOpenChange, allowComments, viewerId }: CommentSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-md"
        onInteractOutside={(e) => {
          // Auf Mobile will man den Sheet ggf. nur über den X-Button schließen, aber wir lassen ihn offen.
          e.preventDefault();
        }}
      >
        <SheetHeader className="px-5 py-4">
          {/* Radix-SheetTitle ist a11y-Pflicht; die tatsächliche Count-
              Headline wird vom Body in Panel-Variant gerendert — hier
              reicht ein statischer Title für Sheet-Mode. */}
          <SheetTitle className="text-base font-semibold">Kommentare</SheetTitle>
        </SheetHeader>
        <CommentsBody
          postId={postId}
          allowComments={allowComments}
          viewerId={viewerId}
          variant="sheet"
        />
      </SheetContent>
    </Sheet>
  );
}
