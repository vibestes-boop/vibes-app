'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, ShieldOff, Loader2 } from 'lucide-react';

import {
  approveWomenOnlyRequest,
  rejectWomenOnlyRequest,
  revokeWomenOnlyAccess,
  type WozRequest,
} from '@/app/actions/admin';

// -----------------------------------------------------------------------------
// WozReviewList — Admin-Freigabe der Women-Only-Anträge. Pending: Freigeben /
// Ablehnen. Approved: Aberkennen (Revoke). Jede Aktion ist auditiert (RPC →
// admin_audit_log).
// -----------------------------------------------------------------------------

function Avatar({ req }: { req: WozRequest }) {
  const label = req.display_name || req.username || '?';
  return req.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={req.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
  ) : (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
      {label.charAt(0).toUpperCase()}
    </div>
  );
}

export function WozReviewList({
  pending,
  approved,
}: {
  pending: WozRequest[];
  approved: WozRequest[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    startTransition(async () => {
      const res = await fn();
      setBusy(null);
      if (!res.ok) alert(res.error ?? 'Aktion fehlgeschlagen.');
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Pending-Queue */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Offene Anträge {pending.length > 0 && <span className="text-rose-500">· {pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Keine offenen Anträge. 🌸
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((req) => (
              <li
                key={req.user_id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
              >
                <Avatar req={req} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {req.display_name || req.username || req.user_id.slice(0, 8)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{req.username ?? '—'} · {new Date(req.requested_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <button
                  onClick={() => run(req.user_id, () => approveWomenOnlyRequest(req.user_id))}
                  disabled={busy === req.user_id}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy === req.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Freigeben
                </button>
                <button
                  onClick={() => run(req.user_id, () => rejectWomenOnlyRequest(req.user_id))}
                  disabled={busy === req.user_id}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Ablehnen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Verifizierte Mitglieder — Aberkennen möglich */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          Verifizierte Mitglieder {approved.length > 0 && <span className="text-muted-foreground">· {approved.length}</span>}
        </h2>
        {approved.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Noch keine verifizierten Mitglieder.
          </p>
        ) : (
          <ul className="space-y-2">
            {approved.map((req) => (
              <li
                key={req.user_id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
              >
                <Avatar req={req} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {req.display_name || req.username || req.user_id.slice(0, 8)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{req.username ?? '—'} · {req.method === 'grandfather' ? 'Bestand' : 'freigegeben'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Zugang zur Women-Only Zone wirklich aberkennen?')) {
                      run(req.user_id, () => revokeWomenOnlyAccess(req.user_id));
                    }
                  }}
                  disabled={busy === req.user_id}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                >
                  {busy === req.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                  Aberkennen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
