'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useTransition,
  memo,
  type MutableRefObject,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { createBrowserClient } from '@supabase/ssr';
import { Send, ImagePlus, Smile, CornerDownRight, X, Check, CheckCheck, Trash2 } from 'lucide-react';
import type {
  MessageWithContext,
  ReactionAggregate,
  ProductShareContext,
} from '@/lib/data/messages';
import {
  sendDirectMessage,
  markConversationRead,
  toggleMessageReaction,
  deleteMessage,
} from '@/app/actions/messages';

// -----------------------------------------------------------------------------
// MessageThread — Client-Container für Thread-View.
//  • Initial-State kommt aus SSR-Props.
//  • Realtime: INSERT auf `messages` via postgres_changes (Channel-Name
//    `messages-{id}` → matcht Native).
//  • Read-Receipts: on-mount + on-focus → `markConversationRead`-Action.
//  • Typing-Indicator: Presence auf `typing-{id}`. 3s Auto-Stop-Timer.
//  • Reactions: Emoji-Picker per Long-Press auf Bubble, Toggle via
//    `toggleMessageReaction`-Action, Realtime via separate Subscription auf
//    `message_reactions`.
// -----------------------------------------------------------------------------

const REACTION_EMOJIS = ['❤️', '😂', '🔥', '👏', '😱', '🥲'];

function supa() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface Props {
  conversationId: string;
  viewerId: string;
  initialMessages: MessageWithContext[];
  initialReactions: ReactionAggregate[];
  otherUser: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  isSelf: boolean;
  productShare: ProductShareContext | null;
}

type PendingMessage = MessageWithContext & { pending?: boolean };

export function MessageThread({
  conversationId,
  viewerId,
  initialMessages,
  initialReactions,
  otherUser,
  isSelf,
  productShare,
}: Props) {
  const [messages, setMessages] = useState<PendingMessage[]>(initialMessages);
  const [reactions, setReactions] = useState<ReactionAggregate[]>(initialReactions);
  const [replyTo, setReplyTo] = useState<MessageWithContext | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [productPreview, setProductPreview] = useState<ProductShareContext | null>(productShare);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const wasNearBottomRef = useRef(true);

  // Shared Typing-Channel für MessageThread + Composer. MessageThread ist
  // der Besitzer (subscribe + presence-Listener), Composer bekommt den Ref
  // per Prop um `track({ typing: true/false })` zu feuern. Pragmatisch: dasselbe
  // Client.channel(topic) wird von @supabase/realtime-js pro Topic dedupliziert
  // → parallele `.channel('typing-…')` Aufrufe geben das gleiche Objekt zurück.
  // Ein zweiter `.on('presence', …)` nach `.subscribe()` wirft aber
  // ("cannot add presence callbacks after subscribe()"), was in #310
  // (infinite render) kaskadiert. Deshalb: single owner.
  const typingChannelRef = useRef<ReturnType<ReturnType<typeof supa>['channel']> | null>(null);

  // Scroll-State verfolgen — nur auto-scroll bei neuen Messages wenn der User
  // am unteren Ende ist. Sonst frieren wir die Position.
  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    wasNearBottomRef.current = nearBottom;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Initial-Scroll-Bottom ohne Smooth-Animation
  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  // Read-Receipts: on-mount + on-focus
  useEffect(() => {
    const mark = () => {
      markConversationRead(conversationId).catch(() => undefined);
    };
    mark();
    const onVis = () => {
      if (document.visibilityState === 'visible') mark();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [conversationId]);

  // Realtime: Messages INSERT
  useEffect(() => {
    const client = supa();
    const channel = client
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const raw = payload.new as Omit<MessageWithContext, 'reply_to' | 'post'>;
          setMessages((prev) => {
            // Optimistic-Matches dedupen: wenn eine Pending-Message des gleichen
            // Senders mit identischem Content in den letzten 5s existiert, ersetzen.
            const nowMs = new Date(raw.created_at).getTime();
            const optimisticIdx = prev.findIndex(
              (m) =>
                m.pending &&
                m.sender_id === raw.sender_id &&
                m.content === raw.content &&
                Math.abs(new Date(m.created_at).getTime() - nowMs) < 5000,
            );
            const enriched: MessageWithContext = { ...raw, reply_to: null, post: null };
            if (optimisticIdx !== -1) {
              const next = [...prev];
              next[optimisticIdx] = enriched;
              return next;
            }
            if (prev.some((m) => m.id === raw.id)) return prev;
            return [...prev, enriched];
          });
        },
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [conversationId]);

  // Realtime: Reactions INSERT/DELETE
  useEffect(() => {
    const client = supa();
    const refreshReactions = async () => {
      const { data } = await client
        .from('message_reactions')
        .select('message_id, user_id, emoji, messages!inner(conversation_id)')
        .eq('messages.conversation_id', conversationId);
      if (!data) return;
      const agg = new Map<string, { count: number; by_me: boolean }>();
      for (const row of data as Array<{ message_id: string; user_id: string; emoji: string }>) {
        const key = `${row.message_id}|${row.emoji}`;
        const curr = agg.get(key) ?? { count: 0, by_me: false };
        curr.count += 1;
        if (row.user_id === viewerId) curr.by_me = true;
        agg.set(key, curr);
      }
      setReactions(
        Array.from(agg.entries()).map(([key, val]) => {
          const [message_id, emoji] = key.split('|');
          return { message_id, emoji, count: val.count, by_me: val.by_me };
        }),
      );
    };
    const channel = client
      .channel(`message-reactions-rt-${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        () => refreshReactions(),
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [conversationId, viewerId]);

  // Typing-Presence — Owner-Effekt. Reihenfolge ist hier kritisch:
  // `.on('presence', …)` MUSS vor `.subscribe()` kommen, sonst wirft
  // realtime-js mit "cannot add presence callbacks after subscribe()".
  useEffect(() => {
    if (isSelf) {
      typingChannelRef.current = null;
      return;
    }
    const client = supa();
    const channel = client.channel(`typing-${conversationId}`, {
      config: { presence: { key: viewerId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ typing: boolean }>();
      const others = Object.entries(state).filter(([k]) => k !== viewerId);
      const anyTyping = others.some(([, presences]) =>
        presences.some((p) => p.typing === true),
      );
      setOtherTyping(anyTyping);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ typing: false });
      }
    });

    typingChannelRef.current = channel;

    return () => {
      typingChannelRef.current = null;
      client.removeChannel(channel);
    };
  }, [conversationId, viewerId, isSelf]);

  // Auto-scroll-Hook: scrollt bei neuen Messages nur wenn der User eh unten war
  useEffect(() => {
    if (wasNearBottomRef.current) scrollToBottom(true);
  }, [messages.length, scrollToBottom]);

  const reactionMap = useMemo(() => {
    const m = new Map<string, ReactionAggregate[]>();
    reactions.forEach((r) => {
      const existing = m.get(r.message_id) ?? [];
      existing.push(r);
      m.set(r.message_id, existing);
    });
    return m;
  }, [reactions]);

  const messagesByDay = useMemo(() => groupByDay(messages), [messages]);

  const onSent = useCallback((msg: PendingMessage) => {
    setMessages((prev) => [...prev, msg]);
    setReplyTo(null);
    wasNearBottomRef.current = true;
  }, []);

  const onToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      setPickerFor(null);
      // Optimistic
      setReactions((prev) => {
        const existing = prev.find((r) => r.message_id === messageId && r.emoji === emoji);
        if (existing?.by_me) {
          // Remove
          return prev
            .map((r) =>
              r.message_id === messageId && r.emoji === emoji
                ? { ...r, by_me: false, count: Math.max(0, r.count - 1) }
                : r,
            )
            .filter((r) => r.count > 0);
        }
        if (existing) {
          return prev.map((r) =>
            r.message_id === messageId && r.emoji === emoji
              ? { ...r, by_me: true, count: r.count + 1 }
              : r,
          );
        }
        return [...prev, { message_id: messageId, emoji, count: 1, by_me: true }];
      });
      const res = await toggleMessageReaction(messageId, emoji);
      if (!res.ok) {
        // Realtime refresh korrigiert bei Fehler automatisch.
        console.warn('reaction failed', res.error);
      }
    },
    [],
  );

  const onDeleteMessage = useCallback(async (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    const res = await deleteMessage(messageId);
    if (!res.ok) console.warn('delete failed', res.error);
  }, []);

  return (
    <>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {messages.length === 0 ? (
          <EmptyThread otherName={otherUser.display_name ?? otherUser.username} isSelf={isSelf} />
        ) : (
          <ol className="space-y-3">
            {messagesByDay.map(({ day, items }) => (
              <li key={day}>
                <DaySeparator label={day} />
                <ul className="mt-2 space-y-1.5">
                  {items.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isOwn={msg.sender_id === viewerId}
                      reactions={reactionMap.get(msg.id) ?? []}
                      onReply={() => setReplyTo(msg)}
                      onOpenPicker={() => setPickerFor(msg.id)}
                      onToggleReaction={onToggleReaction}
                      onDelete={() => onDeleteMessage(msg.id)}
                      pickerOpen={pickerFor === msg.id}
                      onClosePicker={() => setPickerFor(null)}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}

        {otherTyping && <TypingDots />}
      </div>

      <Composer
        conversationId={conversationId}
        viewerId={viewerId}
        isSelf={isSelf}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        productShare={productPreview}
        onClearProductShare={() => setProductPreview(null)}
        onSent={onSent}
        typingChannelRef={typingChannelRef}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// MessageBubble
// -----------------------------------------------------------------------------

const MessageBubble = memo(function MessageBubble({
  msg,
  isOwn,
  reactions,
  onReply,
  onOpenPicker,
  onToggleReaction,
  onDelete,
  pickerOpen,
  onClosePicker,
}: {
  msg: PendingMessage;
  isOwn: boolean;
  reactions: ReactionAggregate[];
  onReply: () => void;
  onOpenPicker: () => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDelete: () => void;
  pickerOpen: boolean;
  onClosePicker: () => void;
}) {
  const time = new Date(msg.created_at).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[78%] flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {msg.reply_to && (
          <div
            className={`mb-1 flex items-center gap-1.5 rounded-t-lg border-l-2 bg-muted/60 px-2 py-1 text-xs text-muted-foreground ${
              isOwn ? 'border-primary/60' : 'border-border'
            }`}
          >
            <CornerDownRight className="h-3 w-3" />
            <span className="max-w-[200px] truncate">
              {msg.reply_to.content ?? (msg.reply_to.image_url ? '📷 Bild' : 'Nachricht')}
            </span>
          </div>
        )}

        <div
          className={`relative rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
            isOwn
              ? 'rounded-br-md bg-primary text-primary-foreground'
              : 'rounded-bl-md bg-muted text-foreground'
          } ${msg.pending ? 'opacity-70' : ''}`}
        >
          {msg.image_url && (
            <a
              href={msg.image_url}
              target="_blank"
              rel="noreferrer"
              className="mb-1 block overflow-hidden rounded-lg"
            >
              <Image
                src={msg.image_url}
                alt=""
                width={240}
                height={240}
                className="max-h-60 w-auto object-cover"
              />
            </a>
          )}

          {msg.post && (
            <Link
              href={`/p/${msg.post.id}` as Route}
              className="mb-1 flex items-center gap-2 rounded-lg bg-black/10 p-2 text-xs hover:bg-black/20"
            >
              {msg.post.thumbnail_url && (
                <Image
                  src={msg.post.thumbnail_url}
                  alt=""
                  width={32}
                  height={48}
                  className="h-12 w-8 flex-none rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  @{msg.post.author_username ?? '—'}
                </div>
                <div className="truncate opacity-80">{msg.post.caption ?? 'Video öffnen'}</div>
              </div>
            </Link>
          )}

          {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}

          <div
            className={`mt-0.5 flex items-center gap-1 text-[10px] ${
              isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
            }`}
          >
            {/*
              suppressHydrationWarning: `toLocaleTimeString('de-DE', …)` rendert
              basierend auf der TZ des Prozesses — Server (Vercel Edge = UTC)
              und Client (Europe/Berlin etc.) können auf Stunden-Grenzen um 1-2h
              abweichen. Der Text-Mismatch ist kosmetisch (beide Strings sind
              valide), nur der React-#418 Warning ist störend.
            */}
            <span suppressHydrationWarning>{time}</span>
            {isOwn && !msg.pending && (
              <span aria-label={msg.read ? 'gelesen' : 'gesendet'}>
                {msg.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              </span>
            )}
          </div>

          <div
            className={`absolute ${
              isOwn ? 'left-[-72px]' : 'right-[-72px]'
            } top-1/2 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity group-hover:opacity-100`}
          >
            <button
              type="button"
              onClick={onReply}
              className="grid h-7 w-7 place-items-center rounded-full bg-card shadow hover:bg-muted"
              aria-label="Antworten"
              title="Antworten"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenPicker}
              className="grid h-7 w-7 place-items-center rounded-full bg-card shadow hover:bg-muted"
              aria-label="Emoji-Reaktion hinzufügen"
              title="Reaktion"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={onDelete}
                className="grid h-7 w-7 place-items-center rounded-full bg-card text-red-500 shadow hover:bg-muted"
                aria-label="Löschen"
                title="Löschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onToggleReaction(msg.id, r.emoji)}
                className={`flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs ${
                  r.by_me
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {pickerOpen && (
          <div className="relative">
            <div
              onClick={onClosePicker}
              className="fixed inset-0 z-20"
              aria-hidden="true"
            />
            <div className="relative z-30 mt-1 flex gap-1 rounded-full border bg-card px-2 py-1.5 shadow-lg">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onToggleReaction(msg.id, e)}
                  className="text-xl transition-transform hover:scale-125"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  );
});

// -----------------------------------------------------------------------------
// Composer
// -----------------------------------------------------------------------------

function Composer({
  conversationId,
  viewerId,
  isSelf,
  replyTo,
  onCancelReply,
  productShare,
  onClearProductShare,
  onSent,
  typingChannelRef,
}: {
  conversationId: string;
  viewerId: string;
  isSelf: boolean;
  replyTo: MessageWithContext | null;
  onCancelReply: () => void;
  productShare: ProductShareContext | null;
  onClearProductShare: () => void;
  onSent: (msg: PendingMessage) => void;
  // Owner des Channels ist MessageThread — Composer feuert nur `track()` darauf.
  // Siehe Kommentar am Ref-Deklarationspunkt in MessageThread oben.
  typingChannelRef: MutableRefObject<ReturnType<ReturnType<typeof supa>['channel']> | null>;
}) {
  const [text, setText] = useState('');
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Typing-Presence clientseitig tracken (3s Auto-Stop). Nutzt den von
  // MessageThread verwalteten Channel — KEINE eigene `client.channel(...)`-Call-Site
  // hier, sonst bekommen wir einen zweiten `.on('presence', …)` auf dem gleichen
  // (deduplizierten) Topic → "cannot add presence callbacks after subscribe()" → #310.
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup: bei Unmount den laufenden Stop-Timer killen und letzten
  // `typing: false`-State senden, damit der Peer keine hängende "schreibt…"-Dots sieht.
  useEffect(() => {
    return () => {
      if (typingStopTimer.current) {
        clearTimeout(typingStopTimer.current);
        typingStopTimer.current = null;
      }
      const ch = typingChannelRef.current;
      if (ch && !isSelf) {
        try {
          ch.track({ typing: false });
        } catch {
          // Channel might already be torn down; silently ignore.
        }
      }
    };
  }, [isSelf, typingChannelRef]);

  const onTextChange = useCallback(
    (v: string) => {
      setText(v);
      const ch = typingChannelRef.current;
      if (!ch || isSelf) return;
      ch.track({ typing: true });
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingStopTimer.current = setTimeout(() => {
        ch.track({ typing: false });
      }, 3000);
    },
    [isSelf, typingChannelRef],
  );

  const productPriceLabel = (p: ProductShareContext) => {
    const eff = p.sale_price_coins ?? p.price_coins;
    return `🪙 ${eff.toLocaleString('de-DE')}`;
  };

  const canSend = text.trim().length > 0 || productShare !== null;

  const handleSend = () => {
    if (!canSend || isPending) return;
    const content = text.trim();
    const optimistic: PendingMessage = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversation_id: conversationId,
      sender_id: viewerId,
      content: content || (productShare ? `${productShare.title}` : null),
      image_url: null,
      post_id: null,
      reply_to_id: replyTo?.id ?? null,
      story_media_url: null,
      read: false,
      created_at: new Date().toISOString(),
      reply_to: replyTo
        ? {
            id: replyTo.id,
            sender_id: replyTo.sender_id,
            content: replyTo.content,
            image_url: replyTo.image_url,
          }
        : null,
      post: null,
      pending: true,
    };
    onSent(optimistic);
    setText('');
    const productForSend = productShare;
    if (productForSend) onClearProductShare();

    startTransition(async () => {
      // Wenn ein Produkt geteilt wird, hängen wir den Produkt-Link ans Ende
      // an. (Volles Product-Share-Card-Rendering wäre separate Tabelle —
      // Phase 7b.)
      const finalContent = productForSend
        ? `${content ? content + '\n' : ''}🛍️ ${productForSend.title} — ${productPriceLabel(
            productForSend,
          )}\n/shop/${productForSend.id}`
        : content;
      const res = await sendDirectMessage({
        conversationId,
        content: finalContent || null,
        replyToId: replyTo?.id ?? null,
      });
      if (!res.ok) {
        console.warn('send failed', res.error);
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t bg-background px-3 py-2">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
          <CornerDownRight className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <div className="flex-1 truncate">
            Antwort auf: {replyTo.content ?? (replyTo.image_url ? '📷 Bild' : 'Nachricht')}
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Antwort abbrechen"
            className="grid h-5 w-5 flex-none place-items-center rounded-full hover:bg-muted"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      )}

      {productShare && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5">
          <div className="relative h-10 w-10 flex-none overflow-hidden rounded-md bg-muted">
            {productShare.cover_url && (
              <Image
                src={productShare.cover_url}
                alt=""
                fill
                className="object-cover"
                sizes="40px"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{productShare.title}</div>
            <div className="text-[10px] text-muted-foreground">
              {productPriceLabel(productShare)} · @{productShare.seller_username}
            </div>
          </div>
          <button
            type="button"
            onClick={onClearProductShare}
            className="grid h-6 w-6 flex-none place-items-center rounded-full hover:bg-amber-500/20"
            aria-label="Produkt-Share entfernen"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          disabled
          className="grid h-9 w-9 flex-none place-items-center rounded-full text-muted-foreground/50"
          aria-label="Bild anhängen (Phase 7b)"
          title="Bild-Upload kommt Phase 7b"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isSelf ? 'Notiere etwas für dich…' : 'Nachricht schreiben…'}
          rows={1}
          maxLength={500}
          className="flex-1 resize-none rounded-2xl border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend || isPending}
          className="grid h-9 w-9 flex-none place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          aria-label="Nachricht senden"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function groupByDay(messages: PendingMessage[]): { day: string; items: PendingMessage[] }[] {
  const groups: { day: string; items: PendingMessage[] }[] = [];
  let currentDay = '';
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const label = sameDay
      ? 'Heute'
      : isYesterday
        ? 'Gestern'
        : d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    if (label !== currentDay) {
      groups.push({ day: label, items: [msg] });
      currentDay = label;
    } else {
      groups[groups.length - 1].items.push(msg);
    }
  }
  return groups;
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-2">
      {/*
        suppressHydrationWarning: "Heute"/"Gestern" kommt aus `groupByDay(msgs)` →
        `new Date().toDateString()` — same TZ-shift-Problem wie bei den
        Message-Zeiten. Um Mitternacht in DE ist es serverseitig 23:00 UTC noch
        "heute", clientseitig schon nächster Tag = "Gestern". Wir tolerieren
        den einen Re-Render nach der Hydration.
      */}
      <span
        suppressHydrationWarning
        className="rounded-full bg-muted px-3 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </span>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="mt-3 flex items-center gap-2 pl-3 text-xs text-muted-foreground">
      <div className="flex gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
      <span>schreibt…</span>
    </div>
  );
}

function EmptyThread({ otherName, isSelf }: { otherName: string; isSelf: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10">
        <Send className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-base font-semibold">
        {isSelf ? 'Meine Notizen' : `Sag Hallo zu ${otherName}`}
      </h3>
      <p className="max-w-xs text-sm text-muted-foreground">
        {isSelf
          ? 'Hier kannst du Links, Gedanken oder Bilder für dich selbst speichern.'
          : 'Starte die Unterhaltung — die erste Nachricht ist meist die schwerste.'}
      </p>
    </div>
  );
}
