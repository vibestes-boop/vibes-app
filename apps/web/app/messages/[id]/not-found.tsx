import Link from 'next/link';
import type { Route } from 'next';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// /messages/[id] — 404
// Konversation existiert nicht oder User ist kein Teilnehmer.
// Aus Datenschutz-Sicht keine Unterscheidung.

export default function ConversationNotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <MessageCircle className="h-7 w-7 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Konversation nicht gefunden</h1>
        <p className="text-sm text-muted-foreground">
          Diese Unterhaltung existiert nicht oder du hast keinen Zugriff darauf.
        </p>
      </div>

      <Button asChild>
        <Link href={'/messages' as Route}>
          <ArrowLeft className="h-4 w-4" />
          Alle Nachrichten
        </Link>
      </Button>
    </main>
  );
}
