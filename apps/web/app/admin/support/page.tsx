import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock, MessageSquare, Send } from 'lucide-react';
import {
  adminReplySupportThread,
  adminResolveSupportThread,
  getAdminRoleStatus,
  getAdminSupportMessages,
  getAdminSupportThreads,
  type AdminSupportMessage,
  type AdminSupportThread,
} from '@/app/actions/admin';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin - Support Inbox',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSupportPage() {
  const roles = await getAdminRoleStatus();
  if (!roles.can_moderate) redirect('/admin');

  const threads = await getAdminSupportThreads();
  const messagesByThread = await getAdminSupportMessages(threads.map((thread) => thread.id));
  const openCount = threads.filter((thread) => thread.status === 'open').length;
  const pendingCount = threads.filter((thread) => thread.status === 'pending').length;
  const highCount = threads.filter((thread) => thread.priority === 'high' && ['open', 'pending'].includes(thread.status)).length;

  async function replyThread(formData: FormData) {
    'use server';
    await adminReplySupportThread(formData);
  }

  async function resolveThread(formData: FormData) {
    'use server';
    await adminResolveSupportThread(formData);
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-950">Support Inbox</h1>
          <p className="mt-1 text-xs text-slate-500">
            Echte Supportfaelle mit Antwort- und Status-Workflow. Mutationen laufen ueber Admin-RPCs.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SummaryPill label="Offen" value={openCount} tone="blue" />
          <SummaryPill label="Wartend" value={pendingCount} tone="amber" />
          <SummaryPill label="Hoch" value={highCount} tone={highCount > 0 ? 'red' : 'green'} />
        </div>
      </section>

      {threads.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-slate-200 px-3 text-center text-xs text-slate-500">
            Keine offenen Supportfaelle.
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          {threads.map((thread) => (
            <SupportThreadPanel
              key={thread.id}
              thread={thread}
              messages={messagesByThread[thread.id] ?? []}
              replyAction={replyThread}
              resolveAction={resolveThread}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function SupportThreadPanel({
  thread,
  messages,
  replyAction,
  resolveAction,
}: {
  thread: AdminSupportThread;
  messages: AdminSupportMessage[];
  replyAction: (formData: FormData) => Promise<void>;
  resolveAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-slate-950">{thread.subject}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>{thread.username ? `@${thread.username}` : 'Unbekannter Nutzer'}</span>
                <span>{thread.source}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(thread.last_message_at)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge label={thread.priority} tone={priorityTone(thread.priority)} />
              <Badge label={thread.status} tone={statusTone(thread.status)} />
            </div>
          </div>

          <div className="mt-2 space-y-2">
            {messages.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
                Noch keine Nachrichten geladen.
              </div>
            ) : (
              messages.slice(-5).map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-2.5">
          <form action={replyAction} className="space-y-2">
            <input type="hidden" name="thread_id" value={thread.id} />
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <MessageSquare className="h-3 w-3" />
                Antwort
              </span>
              <textarea
                name="body"
                required
                maxLength={4000}
                rows={4}
                placeholder="Antwort an den Supportfall..."
                className="w-full resize-none rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <Send className="h-3.5 w-3.5" />
              Antworten
            </button>
          </form>

          <form action={resolveAction} className="space-y-2 border-t border-slate-200 pt-2">
            <input type="hidden" name="thread_id" value={thread.id} />
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <CheckCircle2 className="h-3 w-3" />
                Status
              </span>
              <select
                name="status"
                defaultValue={thread.status}
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <button
              type="submit"
              className="h-8 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Status setzen
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

function MessageBubble({ message }: { message: AdminSupportMessage }) {
  const isAdmin = message.sender_type === 'admin';
  return (
    <div className={cn('flex', isAdmin ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[86%] rounded-lg px-3 py-2 text-xs',
          isAdmin ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700',
        )}
      >
        <div className={cn('mb-1 text-[10px] font-semibold', isAdmin ? 'text-blue-100' : 'text-slate-500')}>
          {message.sender_username ? `@${message.sender_username}` : humanize(message.sender_type)} · {formatDate(message.created_at)}
        </div>
        <p className="whitespace-pre-wrap leading-5">{message.body}</p>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'green' | 'amber' | 'red';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className={cn('text-[10px] font-semibold uppercase', toneClass(tone))}>{label}</div>
      <div className="mt-1 text-sm font-bold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'slate' }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', badgeClass(tone))}>{humanize(label)}</span>;
}

function priorityTone(priority: string): 'green' | 'amber' | 'red' {
  if (priority === 'high') return 'red';
  if (priority === 'medium') return 'amber';
  return 'green';
}

function statusTone(status: string): 'blue' | 'green' | 'amber' | 'slate' {
  if (status === 'resolved' || status === 'closed') return 'green';
  if (status === 'pending') return 'amber';
  if (status === 'open') return 'blue';
  return 'slate';
}

function toneClass(tone: 'blue' | 'green' | 'amber' | 'red'): string {
  if (tone === 'green') return 'text-emerald-600';
  if (tone === 'amber') return 'text-amber-600';
  if (tone === 'red') return 'text-red-600';
  return 'text-blue-600';
}

function badgeClass(tone: 'blue' | 'green' | 'amber' | 'red' | 'slate'): string {
  if (tone === 'green') return 'bg-emerald-50 text-emerald-700';
  if (tone === 'amber') return 'bg-amber-50 text-amber-700';
  if (tone === 'red') return 'bg-red-50 text-red-700';
  if (tone === 'blue') return 'bg-blue-50 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
