'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { MessageCircle, Loader2 } from 'lucide-react';
import { getOrCreateConversation } from '@/app/actions/messages';

interface Props {
  sellerId: string;
  productId: string;
}

// -----------------------------------------------------------------------------
// SellerChatButton — Icon-Circle in der Seller-Karte auf /shop/[id]. Öffnet
// oder erstellt eine DM mit dem Seller und hängt `?productId=…` an, damit
// der Thread-View einen Product-Share-Context im Composer zeigt (v1.26.5-
// Parity zur Native Shop-Chat-Button-Logik).
//
// SSR-Render des Buttons wäre nice, aber der Button muss client-side sein
// weil er Server-Action + Router-Push nach Create kombiniert.
// -----------------------------------------------------------------------------

export function SellerChatButton({ sellerId, productId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await getOrCreateConversation(sellerId);
      if (!res.ok) {
        console.warn('conversation create failed', res.error);
        return;
      }
      router.push(`/messages/${res.data.id}?productId=${productId}`);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="grid h-9 w-9 flex-none place-items-center rounded-full border bg-background transition-colors hover:bg-muted disabled:opacity-60"
      aria-label="Verkäufer anschreiben"
      title="Verkäufer anschreiben"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageCircle className="h-4 w-4" />
      )}
    </button>
  );
}
