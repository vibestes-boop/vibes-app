'use client';

import { useState, useTransition, useDeferredValue } from 'react';
import Image from 'next/image';
import {
  Search, Shield, CheckCircle, Ban,
  ShieldOff, BadgeCheck, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  searchAdminUsers, adminBanUser, adminVerifyUser, adminToggleAdmin,
  type AdminUser,
} from '@/app/actions/admin';

// -----------------------------------------------------------------------------
// AdminUsersClient — Live-Suche + Aktions-Buttons
// Parity mit app/admin/users.tsx
// -----------------------------------------------------------------------------

export function AdminUsersClient({ initialUsers }: { initialUsers: AdminUser[] }) {
  const [query, setQuery]       = useState('');
  const [users, setUsers]       = useState<AdminUser[]>(initialUsers);
  const [searching, startSearch] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const deferredQuery = useDeferredValue(query);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function handleSearch(q: string) {
    setQuery(q);
    startSearch(async () => {
      const results = await searchAdminUsers(q);
      setUsers(results);
    });
  }

  async function handleAction(
    user: AdminUser,
    action: 'ban' | 'unban' | 'verify' | 'unverify' | 'makeAdmin' | 'removeAdmin',
  ) {
    setActionId(user.id);
    let result;
    if (action === 'ban' || action === 'unban') {
      result = await adminBanUser(user.id, action === 'ban');
    } else if (action === 'verify' || action === 'unverify') {
      result = await adminVerifyUser(user.id, action === 'verify');
    } else {
      result = await adminToggleAdmin(user.id, action === 'makeAdmin');
    }
    setActionId(null);

    if (result.ok) {
      // Optimistic UI update
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== user.id) return u;
          if (action === 'ban')        return { ...u, is_banned: true };
          if (action === 'unban')      return { ...u, is_banned: false };
          if (action === 'verify')     return { ...u, is_verified: true };
          if (action === 'unverify')   return { ...u, is_verified: false };
          if (action === 'makeAdmin')  return { ...u, is_admin: true };
          if (action === 'removeAdmin') return { ...u, is_admin: false };
          return u;
        }),
      );
      const labels: Record<string, string> = {
        ban: 'Gesperrt', unban: 'Entsperrt',
        verify: 'Verifiziert', unverify: 'Verifizierung entfernt',
        makeAdmin: 'Admin-Rechte vergeben', removeAdmin: 'Admin-Rechte entzogen',
      };
      showToast(`@${user.username}: ${labels[action]}`, true);
    } else {
      showToast(`Fehler: ${result.error}`, false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Username suchen…"
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {users.length} Nutzer{users.length !== 1 ? '' : ''}
        {deferredQuery && ` für „${deferredQuery}"`}
      </p>

      {/* User list */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {users.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Keine Nutzer gefunden.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                loading={actionId === user.id}
                expanded={expandedId === user.id}
                onToggleExpand={() =>
                  setExpandedId((prev) => (prev === user.id ? null : user.id))
                }
                onAction={(action) => handleAction(user, action)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all',
            toast.ok ? 'bg-green-600' : 'bg-destructive',
          )}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── UserRow ──────────────────────────────────────────────────────────────────

type UserAction = 'ban' | 'unban' | 'verify' | 'unverify' | 'makeAdmin' | 'removeAdmin';

function UserRow({
  user,
  loading,
  expanded,
  onToggleExpand,
  onAction,
}: {
  user: AdminUser;
  loading: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onAction: (action: UserAction) => void;
}) {
  return (
    <li>
      {/* Main row */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        {/* Avatar */}
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
          {user.avatar_url ? (
            <Image src={user.avatar_url} alt={user.username} fill className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-semibold uppercase text-muted-foreground">
              {user.username.slice(0, 1)}
            </span>
          )}
        </div>

        {/* Name + badges */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">@{user.username}</span>
            {user.is_admin && (
              <Badge color="amber" label="Admin" />
            )}
            {user.is_verified && (
              <Badge color="blue" label="Verifiziert" />
            )}
            {user.is_banned && (
              <Badge color="red" label="Gesperrt" />
            )}
            {user.is_creator && (
              <Badge color="purple" label="Creator" />
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{user.follower_count.toLocaleString()} Follower</span>
            <span>{user.post_count.toLocaleString()} Posts</span>
            <span>{new Date(user.created_at).toLocaleDateString('de-DE')}</span>
          </div>
        </div>

        {/* Chevron */}
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Actions panel */}
      {expanded && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {/* Ban / Unban */}
            {user.is_banned ? (
              <ActionButton
                icon={CheckCircle}
                label="Entsperren"
                onClick={() => onAction('unban')}
                variant="success"
                disabled={loading}
              />
            ) : (
              <ActionButton
                icon={Ban}
                label="Sperren"
                onClick={() => onAction('ban')}
                variant="danger"
                disabled={loading}
              />
            )}

            {/* Verify / Unverify */}
            {user.is_verified ? (
              <ActionButton
                icon={ShieldOff}
                label="Verifizierung entfernen"
                onClick={() => onAction('unverify')}
                variant="default"
                disabled={loading}
              />
            ) : (
              <ActionButton
                icon={BadgeCheck}
                label="Verifizieren"
                onClick={() => onAction('verify')}
                variant="blue"
                disabled={loading}
              />
            )}

            {/* Admin toggle */}
            {user.is_admin ? (
              <ActionButton
                icon={ShieldOff}
                label="Admin entziehen"
                onClick={() => onAction('removeAdmin')}
                variant="danger"
                disabled={loading}
              />
            ) : (
              <ActionButton
                icon={Shield}
                label="Admin machen"
                onClick={() => onAction('makeAdmin')}
                variant="amber"
                disabled={loading}
              />
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Badge({ color, label }: { color: 'amber' | 'blue' | 'red' | 'purple'; label: string }) {
  const colors = {
    amber:  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    blue:   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    red:    'bg-red-500/10 text-red-600 dark:text-red-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold', colors[color])}>
      {label}
    </span>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant: 'danger' | 'success' | 'default' | 'blue' | 'amber';
  disabled?: boolean;
}) {
  const styles = {
    danger:  'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400',
    success: 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-400',
    blue:    'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400',
    amber:   'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400',
    default: 'border-border bg-background text-foreground hover:bg-muted',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
        styles[variant],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
