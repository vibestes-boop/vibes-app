'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  ShieldOff,
  UserRound,
  Users,
} from 'lucide-react';
import {
  adminBanUser,
  adminInviteUser,
  adminSetUserRole,
  adminSetUserSafetyState,
  adminToggleAdmin,
  adminVerifyUser,
  getAdminUserDetailSnapshot,
  searchAdminUserDirectoryPage,
  type AdminAssignableUserRole,
  type AdminUserActivityFilter,
  type AdminUserDetailSnapshot,
  type AdminUserDirectoryItem,
  type AdminUserRiskFilter,
  type AdminUserRoleFilter,
  type AdminUserStatusFilter,
  type AdminUserVerificationFilter,
  type AdminUsersPageSnapshot,
} from '@/app/actions/admin';
import { cn } from '@/lib/utils';

type UserAction = 'ban' | 'unban' | 'verify' | 'unverify' | 'makeAdmin' | 'removeAdmin' | 'restrict' | 'unrestrict' | 'shadowban' | 'unshadowban';
type DirectoryLoadOverrides = {
  query?: string;
  status?: AdminUserStatusFilter;
  role?: AdminUserRoleFilter;
  verification?: AdminUserVerificationFilter;
  activity?: AdminUserActivityFilter;
  risk?: AdminUserRiskFilter;
  page?: number;
};

const ADMIN_USERS_PAGE_SIZE = 20;

export function AdminUsersClient({ initialSnapshot }: { initialSnapshot: AdminUsersPageSnapshot }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserDirectoryItem[]>(initialSnapshot.users);
  const [selectedId, setSelectedId] = useState<string | null>(initialSnapshot.users[0]?.id ?? null);
  const [page, setPage] = useState(initialSnapshot.directory.page);
  const [totalCount, setTotalCount] = useState(initialSnapshot.directory.total_count);
  const [hasMore, setHasMore] = useState(initialSnapshot.directory.has_more);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [statusFilter, setStatusFilter] = useState<AdminUserStatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<AdminUserRoleFilter>('all');
  const [verificationFilter, setVerificationFilter] = useState<AdminUserVerificationFilter>('all');
  const [activityFilter, setActivityFilter] = useState<AdminUserActivityFilter>('all');
  const [riskFilter, setRiskFilter] = useState<AdminUserRiskFilter>('all');
  const [detailsByUser, setDetailsByUser] = useState<Record<string, AdminUserDetailSnapshot | null>>({});
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [manualInviteLink, setManualInviteLink] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedId) ?? users[0] ?? null,
    [selectedId, users],
  );

  const hasActiveFilters =
    statusFilter !== 'all' ||
    roleFilter !== 'all' ||
    verificationFilter !== 'all' ||
    activityFilter !== 'all' ||
    riskFilter !== 'all';

  useEffect(() => {
    if (!selectedUser || Object.prototype.hasOwnProperty.call(detailsByUser, selectedUser.id)) return;

    let cancelled = false;
    setDetailLoadingId(selectedUser.id);
    getAdminUserDetailSnapshot(selectedUser.id)
      .then((detail) => {
        if (cancelled) return;
        setDetailsByUser((previous) => ({ ...previous, [selectedUser.id]: detail }));
      })
      .finally(() => {
        if (!cancelled) setDetailLoadingId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [detailsByUser, selectedUser]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function loadDirectory(overrides: DirectoryLoadOverrides = {}) {
    const nextQuery = overrides.query ?? query;
    const nextStatus = overrides.status ?? statusFilter;
    const nextRole = overrides.role ?? roleFilter;
    const nextVerification = overrides.verification ?? verificationFilter;
    const nextActivity = overrides.activity ?? activityFilter;
    const nextRisk = overrides.risk ?? riskFilter;
    const nextPage = overrides.page ?? page;

    startSearch(async () => {
      const result = await searchAdminUserDirectoryPage({
        query: nextQuery,
        status: nextStatus,
        role: nextRole,
        verification: nextVerification,
        activity: nextActivity,
        risk: nextRisk,
        page: nextPage,
        pageSize: ADMIN_USERS_PAGE_SIZE,
      });
      setUsers(result.users);
      setPage(result.page);
      setTotalCount(result.total_count);
      setHasMore(result.has_more);
      setSelectedId((current) => {
        if (current && result.users.some((user) => user.id === current)) return current;
        return result.users[0]?.id ?? null;
      });
    });
  }

  function handleSearch(value: string) {
    setQuery(value);
    loadDirectory({ query: value, page: 1 });
  }

  async function handleAction(user: AdminUserDirectoryItem, action: UserAction) {
    setActionId(user.id);
    const result =
      action === 'ban' || action === 'unban'
        ? await adminBanUser(user.id, action === 'ban')
        : action === 'verify' || action === 'unverify'
          ? await adminVerifyUser(user.id, action === 'verify')
          : action === 'makeAdmin' || action === 'removeAdmin'
            ? await adminToggleAdmin(user.id, action === 'makeAdmin')
            : await adminSetUserSafetyState(user.id, action);
    setActionId(null);

    if (!result.ok) {
      showToast(`Fehler: ${result.error}`, false);
      return;
    }

    setUsers((previous) =>
      previous.map((item) => {
        if (item.id !== user.id) return item;
        if (action === 'ban') return { ...item, is_banned: true, risk_level: 'high' };
        if (action === 'unban') return { ...item, is_banned: false, risk_level: item.report_count > 0 ? 'medium' : 'low' };
        if (action === 'verify') return { ...item, is_verified: true };
        if (action === 'unverify') return { ...item, is_verified: false };
        if (action === 'makeAdmin') return { ...item, is_admin: true };
        if (action === 'removeAdmin') return { ...item, is_admin: false };
        if (action === 'restrict') return { ...item, is_restricted: true, risk_level: item.risk_level === 'high' ? 'high' : 'medium' };
        if (action === 'unrestrict') return { ...item, is_restricted: false, restricted_until: null, risk_level: item.report_count > 0 ? 'medium' : 'low' };
        if (action === 'shadowban') return { ...item, is_shadow_banned: true, risk_level: 'high' };
        if (action === 'unshadowban') return { ...item, is_shadow_banned: false, risk_level: item.report_count > 0 ? 'medium' : 'low' };
        return item;
      }),
    );
    setDetailsByUser((previous) => {
      const next = { ...previous };
      delete next[user.id];
      return next;
    });

    const labels: Record<UserAction, string> = {
      ban: 'gesperrt',
      unban: 'entsperrt',
      verify: 'verifiziert',
      unverify: 'Verifizierung entfernt',
      makeAdmin: 'Admin-Rechte vergeben',
      removeAdmin: 'Admin-Rechte entzogen',
      restrict: 'eingeschraenkt',
      unrestrict: 'Einschraenkung entfernt',
      shadowban: 'shadowbanned',
      unshadowban: 'Shadowban entfernt',
    };
    showToast(`@${user.username}: ${labels[action]}`, true);
  }

  async function handleRoleChange(user: AdminUserDirectoryItem, role: AdminAssignableUserRole) {
    setActionId(user.id);
    const result = await adminSetUserRole(user.id, role);
    setActionId(null);

    if (!result.ok) {
      showToast(`Fehler: ${result.error}`, false);
      return;
    }

    setUsers((previous) =>
      previous.map((item) => item.id === user.id
        ? {
            ...item,
            is_admin: role === 'admin',
            is_moderator: role === 'moderator',
            is_operator: role === 'operator',
            is_creator_ops: role === 'creator_ops',
            is_creator: role === 'creator',
          }
        : item),
    );
    setDetailsByUser((previous) => {
      const next = { ...previous };
      delete next[user.id];
      return next;
    });
    showToast(`@${user.username}: Rolle auf ${roleLabel(role)} gesetzt`, true);
  }

  function resetFilters() {
    setStatusFilter('all');
    setRoleFilter('all');
    setVerificationFilter('all');
    setActivityFilter('all');
    setRiskFilter('all');
    loadDirectory({
      status: 'all',
      role: 'all',
      verification: 'all',
      activity: 'all',
      risk: 'all',
      page: 1,
    });
  }

  function exportVisibleUsers() {
    const rows = users.map((user) => ({
      id: user.id,
      username: user.username,
      display_name: user.display_name ?? '',
      role: userRoleLabel(user),
      status: userStatusLabel(user),
      verified: user.is_verified ? 'yes' : 'no',
      created_at: user.created_at,
      last_activity_at: user.last_activity_at ?? '',
      posts: user.post_count,
      comments: user.comment_count,
      reports: user.report_count,
      risk_level: user.risk_level,
    }));
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleInvite() {
    const formData = new FormData();
    formData.set('email', inviteEmail);
    formData.set('role', inviteRole);
    setInviteLoading(true);
    const result = await adminInviteUser(formData);
    setInviteLoading(false);

    if (!result.ok) {
      showToast(`Einladung fehlgeschlagen: ${result.error}`, false);
      return;
    }

    if (result.data?.delivery === 'manual_link' && result.data.invite_link) {
      setManualInviteLink(result.data.invite_link);
      showToast('Mailversand fehlgeschlagen, manueller Invite-Link wurde erstellt.', true);
      loadDirectory({ page: 1 });
      return;
    }

    showToast(`Einladung an ${inviteEmail} wurde gesendet.`, true);
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('user');
    setManualInviteLink(null);
    loadDirectory({ page: 1 });
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Nutzerverwaltung</h1>
          <p className="mt-1 text-sm text-slate-500">
            Verwalte Nutzer, Rollen, Verifizierung, Sicherheit und Aktivitaet deiner Plattform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TopSearch value={query} loading={searching} onChange={handleSearch} />
          <ToolbarButton icon={Filter} label="Filter" disabled />
          <ToolbarButton icon={Download} label="Export" onClick={exportVisibleUsers} disabled={users.length === 0} />
          <button
            type="button"
            onClick={() => {
              setManualInviteLink(null);
              setInviteOpen(true);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nutzer hinzufuegen
          </button>
        </div>
      </section>

      <section className="grid gap-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Users} label="Gesamt Nutzer" value={initialSnapshot.stats.total_users} tone="blue" />
        <StatCard icon={CheckCircle2} label="Aktive Nutzer" value={initialSnapshot.stats.active_users_30d} tone="green" sublabel="letzte 30 Tage" />
        <StatCard icon={UserRound} label="Neue Nutzer" value={initialSnapshot.stats.new_users_30d} tone="violet" sublabel="30 Tage" />
        <StatCard icon={BadgeCheck} label="Verifiziert" value={initialSnapshot.stats.verified_users} tone="blue" />
        <StatCard icon={Ban} label="Gesperrt" value={initialSnapshot.stats.banned_users} tone="red" />
        <StatCard icon={Shield} label="In Pruefung" value={initialSnapshot.stats.pending_reports} tone="amber" sublabel="offene Reports" />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Suche nach Name, Username oder ID"
                className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
            </div>
            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value as AdminUserStatusFilter);
                loadDirectory({ status: value as AdminUserStatusFilter, page: 1 });
              }}
              options={[
                ['all', 'Status'],
                ['active', 'Aktiv'],
                ['restricted', 'Eingeschraenkt'],
                ['banned', 'Gesperrt'],
              ]}
            />
            <FilterSelect
              label="Rolle"
              value={roleFilter}
              onChange={(value) => {
                setRoleFilter(value as AdminUserRoleFilter);
                loadDirectory({ role: value as AdminUserRoleFilter, page: 1 });
              }}
              options={[
                ['all', 'Rolle'],
                ['admin', 'Admin'],
                ['moderator', 'Moderator'],
                ['operator', 'Operator'],
                ['creator_ops', 'Creator Ops'],
                ['creator', 'Creator'],
                ['user', 'User'],
              ]}
            />
            <FilterSelect
              label="Verifizierung"
              value={verificationFilter}
              onChange={(value) => {
                setVerificationFilter(value as AdminUserVerificationFilter);
                loadDirectory({ verification: value as AdminUserVerificationFilter, page: 1 });
              }}
              options={[
                ['all', 'Verifizierung'],
                ['verified', 'Verifiziert'],
                ['unverified', 'Nicht verifiziert'],
              ]}
            />
            <FilterSelect
              label="Aktivitaet"
              value={activityFilter}
              onChange={(value) => {
                setActivityFilter(value as AdminUserActivityFilter);
                loadDirectory({ activity: value as AdminUserActivityFilter, page: 1 });
              }}
              options={[
                ['all', 'Aktivitaet'],
                ['active_30d', 'Aktiv 30d'],
                ['inactive_30d', 'Inaktiv 30d'],
              ]}
            />
            <FilterSelect
              label="Risiko"
              value={riskFilter}
              onChange={(value) => {
                setRiskFilter(value as AdminUserRiskFilter);
                loadDirectory({ risk: value as AdminUserRiskFilter, page: 1 });
              }}
              options={[
                ['all', 'Risiko'],
                ['low', 'Niedrig'],
                ['medium', 'Mittel'],
                ['high', 'Hoch'],
              ]}
            />
            <button type="button" disabled={!hasActiveFilters} onClick={resetFilters} className="h-9 px-2 text-xs font-semibold text-blue-600 disabled:opacity-50">
              Filter zuruecksetzen
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] text-slate-500">
                  <th className="px-4 py-3 font-bold">Nutzer</th>
                  <th className="px-3 py-3 font-bold">Rolle</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 font-bold">Verifiziert</th>
                  <th className="px-3 py-3 font-bold">Registriert</th>
                  <th className="px-3 py-3 font-bold">Letzte Aktivitaet</th>
                  <th className="px-3 py-3 text-right font-bold">Beitraege</th>
                  <th className="px-3 py-3 text-right font-bold">Reports</th>
                  <th className="px-4 py-3 text-right font-bold">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={cn(
                      'cursor-pointer bg-white transition hover:bg-blue-50/40',
                      selectedUser?.id === user.id && 'bg-blue-50/70',
                    )}
                    onClick={() => setSelectedId(user.id)}
                  >
                    <td className="px-4 py-3">
                      <UserIdentity user={user} />
                    </td>
                    <td className="px-3 py-3">
                      <RoleBadge user={user} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill user={user} />
                    </td>
                    <td className="px-3 py-3">
                      {user.is_verified ? <SmallBadge tone="blue" label="Verifiziert" /> : <SmallBadge tone="slate" label="Nein" />}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">{formatDate(user.created_at)}</td>
                    <td className="px-3 py-3 text-slate-600">{user.last_activity_at ? relativeTime(user.last_activity_at) : 'Noch nicht getrackt'}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-800">{formatNumber(user.post_count)}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-800">{formatNumber(user.report_count)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                        aria-label={`Aktionen fuer ${user.username}`}
                      >
                        {actionId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                      Keine Nutzer fuer diese Suche oder Filter gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>{pageRangeLabel(page, users.length, totalCount)}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || searching}
                onClick={() => loadDirectory({ page: page - 1 })}
                className="h-8 rounded-md border border-slate-200 px-2 font-semibold text-slate-700 disabled:opacity-40"
              >
                Zurueck
              </button>
              <span>Seite {page}</span>
              <button
                type="button"
                disabled={!hasMore || searching}
                onClick={() => loadDirectory({ page: page + 1 })}
                className="h-8 rounded-md border border-slate-200 px-2 font-semibold text-slate-700 disabled:opacity-40"
              >
                Weiter
              </button>
            </div>
          </div>
        </div>

        <UserDetailPanel
          user={selectedUser}
          detail={selectedUser ? detailsByUser[selectedUser.id] : null}
          detailLoading={Boolean(selectedUser && detailLoadingId === selectedUser.id)}
          loading={actionId === selectedUser?.id}
          onAction={handleAction}
          onRoleChange={handleRoleChange}
        />
      </section>

      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg',
            toast.ok ? 'bg-emerald-600' : 'bg-red-600',
          )}
        >
          {toast.msg}
        </div>
      )}

      {inviteOpen && (
        <InviteUserDialog
          email={inviteEmail}
          role={inviteRole}
          loading={inviteLoading}
          manualLink={manualInviteLink}
          onEmailChange={setInviteEmail}
          onRoleChange={setInviteRole}
          onClose={() => {
            setInviteOpen(false);
            setManualInviteLink(null);
          }}
          onSubmit={handleInvite}
        />
      )}
    </div>
  );
}

function UserDetailPanel({
  user,
  detail,
  detailLoading,
  loading,
  onAction,
  onRoleChange,
}: {
  user: AdminUserDirectoryItem | null;
  detail: AdminUserDetailSnapshot | null | undefined;
  detailLoading: boolean;
  loading: boolean;
  onAction: (user: AdminUserDirectoryItem, action: UserAction) => void;
  onRoleChange: (user: AdminUserDirectoryItem, role: AdminAssignableUserRole) => void;
}) {
  if (!user) {
    return (
      <aside className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Keine Nutzer ausgewaehlt.
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar user={user} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-slate-950">{user.display_name || user.username}</h2>
          <p className="truncate text-sm text-slate-500">@{user.username}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <RoleBadge user={user} />
            <StatusPill user={user} />
            {user.is_verified && <SmallBadge tone="blue" label="Verifiziert" />}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4 text-xs">
        <InfoRow label="Registriert seit" value={formatDate(user.created_at)} />
        <InfoRow label="Letzte Aktivitaet" value={user.last_activity_at ? relativeTime(user.last_activity_at) : 'Noch nicht getrackt'} />
        <InfoRow label="Letzter Login" value={detail?.identity?.last_sign_in_at ? relativeTime(detail.identity.last_sign_in_at) : detailLoading ? 'Laedt...' : 'Noch nicht verfuegbar'} muted={!detail?.identity?.last_sign_in_at} />
        <InfoRow label="Nutzer-ID" value={shortId(user.id)} />
      </div>

      <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 text-center">
        <MiniStat label="Beitraege" value={user.post_count} />
        <MiniStat label="Kommentare" value={user.comment_count} />
        <MiniStat label="Reports" value={user.report_count} />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-900">Sicherheitsstatus</h3>
        <div className="mt-2 space-y-2 text-xs">
          <InfoRow label="Risiko-Level" value={riskLabel(user.risk_level)} valueClassName={riskText(user.risk_level)} />
          <InfoRow label="Account gesperrt" value={user.is_banned ? 'Ja' : 'Nein'} />
          <InfoRow label="Eingeschraenkt" value={user.is_restricted ? 'Ja' : 'Nein'} />
          <InfoRow label="Shadowban" value={user.is_shadow_banned ? 'Ja' : 'Nein'} />
          <InfoRow label="E-Mail" value={detail?.identity?.email ?? (detailLoading ? 'Laedt...' : 'Nicht verfuegbar')} muted={!detail?.identity?.email} />
          <InfoRow label="E-Mail verifiziert" value={detail?.identity?.email_confirmed_at ? 'Ja' : detailLoading ? 'Laedt...' : 'Nein'} />
          <InfoRow label="Telefon verifiziert" value={detail?.identity?.phone_confirmed_at ? 'Ja' : detail?.identity?.phone ? 'Nein' : detailLoading ? 'Laedt...' : 'Nicht hinterlegt'} muted={!detail?.identity?.phone} />
          <InfoRow label="2FA" value={detail?.identity?.mfa_enabled === true ? 'Aktiv' : detail?.identity?.mfa_enabled === false ? 'Nicht aktiv' : detailLoading ? 'Laedt...' : 'Nicht verfuegbar'} muted={detail?.identity?.mfa_enabled == null} />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">Letzte Aktionen</h3>
          {detailLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
        </div>
        <AuditTimeline items={detail?.audit ?? []} loading={detailLoading} />
      </div>

      <div className="mt-5 grid gap-2">
        <Link
          href={`/u/${encodeURIComponent(user.username)}`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
        >
          Profil oeffnen
        </Link>
        <label className="block text-xs font-semibold text-slate-700">
          Rolle aendern
          <select
            value={userRoleKey(user)}
            disabled={loading}
            onChange={(event) => onRoleChange(user, event.target.value as AdminAssignableUserRole)}
            className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
          >
            <option value="user">User</option>
            <option value="creator">Creator</option>
            <option value="moderator">Moderator</option>
            <option value="operator">Operator</option>
            <option value="creator_ops">Creator Ops</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={user.is_admin ? ShieldOff : Shield}
            label={user.is_admin ? 'Admin entziehen' : 'Admin machen'}
            variant={user.is_admin ? 'danger' : 'amber'}
            disabled={loading}
            onClick={() => onAction(user, user.is_admin ? 'removeAdmin' : 'makeAdmin')}
          />
          <ActionButton
            icon={user.is_verified ? ShieldOff : BadgeCheck}
            label={user.is_verified ? 'Unverify' : 'Verifizieren'}
            variant="blue"
            disabled={loading}
            onClick={() => onAction(user, user.is_verified ? 'unverify' : 'verify')}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={user.is_restricted ? CheckCircle2 : Ban}
            label={user.is_restricted ? 'Restrict weg' : 'Restrict'}
            variant={user.is_restricted ? 'success' : 'amber'}
            disabled={loading}
            onClick={() => onAction(user, user.is_restricted ? 'unrestrict' : 'restrict')}
          />
          <ActionButton
            icon={user.is_shadow_banned ? CheckCircle2 : ShieldOff}
            label={user.is_shadow_banned ? 'Shadow weg' : 'Shadowban'}
            variant={user.is_shadow_banned ? 'success' : 'amber'}
            disabled={loading}
            onClick={() => onAction(user, user.is_shadow_banned ? 'unshadowban' : 'shadowban')}
          />
        </div>
        <ActionButton
          icon={user.is_banned ? CheckCircle2 : Ban}
          label={user.is_banned ? 'Nutzer entsperren' : 'Nutzer sperren'}
          variant={user.is_banned ? 'success' : 'danger'}
          disabled={loading}
          onClick={() => onAction(user, user.is_banned ? 'unban' : 'ban')}
        />
      </div>
    </aside>
  );
}

function InviteUserDialog({
  email,
  role,
  loading,
  manualLink,
  onEmailChange,
  onRoleChange,
  onClose,
  onSubmit,
}: {
  email: string;
  role: string;
  loading: boolean;
  manualLink: string | null;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/30 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Nutzer einladen</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sendet eine Supabase-Einladung per E-Mail. Der Nutzer landet danach im Onboarding.
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {manualLink && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="font-bold">E-Mail konnte nicht gesendet werden.</div>
              <p className="mt-1 text-xs">
                Supabase hat aber einen Invite-Link erzeugt. Kopiere ihn und sende ihn manuell.
              </p>
              <textarea
                readOnly
                value={manualLink}
                className="mt-3 h-20 w-full rounded-md border border-amber-200 bg-white p-2 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(manualLink)}
                className="mt-2 h-8 rounded-md bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700"
              >
                Link kopieren
              </button>
            </div>
          )}

          <label className="block text-sm font-semibold text-slate-700">
            E-Mail
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="name@example.com"
              className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Start-Rolle
            <select
              value={role}
              onChange={(event) => onRoleChange(event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              <option value="user">User</option>
              <option value="creator">Creator</option>
              <option value="moderator">Moderator</option>
              <option value="operator">Operator</option>
              <option value="creator_ops">Creator Ops</option>
            </select>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-9 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !email}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Einladung senden
          </button>
        </div>
      </div>
    </div>
  );
}

function TopSearch({ value, loading, onChange }: { value: string; loading: boolean; onChange: (value: string) => void }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Suchen..."
        className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
      {loading ? (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
      ) : (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 px-1 text-[10px] font-semibold text-slate-400">
          ⌘ K
        </span>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sublabel = 'echte Backend-Daten',
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sublabel?: string;
  tone: 'blue' | 'green' | 'violet' | 'red' | 'amber';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', statTone(tone))}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-slate-500">{label}</div>
          <div className="text-lg font-bold tabular-nums text-slate-950">{formatNumber(value)}</div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-slate-500">{sublabel}</div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm disabled:opacity-60"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative inline-flex h-9 items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 appearance-none rounded-md border border-slate-200 bg-white py-0 pl-3 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
    </label>
  );
}

function UserIdentity({ user }: { user: AdminUserDirectoryItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar user={user} />
      <div className="min-w-0">
        <div className="truncate font-bold text-slate-900">{user.display_name || user.username}</div>
        <div className="truncate text-[11px] text-slate-500">@{user.username}</div>
      </div>
    </div>
  );
}

function Avatar({ user, size = 'sm' }: { user: AdminUserDirectoryItem; size?: 'sm' | 'lg' }) {
  const className = size === 'lg' ? 'h-16 w-16' : 'h-9 w-9';
  return (
    <div className={cn('relative shrink-0 overflow-hidden rounded-full bg-slate-100', className)}>
      {user.avatar_url ? (
        <Image src={user.avatar_url} alt={user.username} fill className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-sm font-bold uppercase text-slate-500">
          {user.username.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

function RoleBadge({ user }: { user: AdminUserDirectoryItem }) {
  if (user.is_admin) return <SmallBadge tone="amber" label="Admin" />;
  if (user.is_moderator) return <SmallBadge tone="teal" label="Moderator" />;
  if (user.is_operator) return <SmallBadge tone="blue" label="Operator" />;
  if (user.is_creator_ops) return <SmallBadge tone="violet" label="Creator Ops" />;
  if (user.is_creator) return <SmallBadge tone="violet" label="Creator" />;
  return <SmallBadge tone="slate" label="User" />;
}

function StatusPill({ user }: { user: AdminUserDirectoryItem }) {
  if (user.is_banned) return <SmallBadge tone="red" label="Gesperrt" />;
  if (user.is_restricted || user.is_shadow_banned) return <SmallBadge tone="amber" label="Eingeschraenkt" />;
  return <SmallBadge tone="green" label="Aktiv" />;
}

function SmallBadge({
  tone,
  label,
}: {
  tone: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'teal' | 'slate';
  label: string;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-[11px] font-bold', badgeTone(tone))}>
      {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-slate-200 px-2 py-3 last:border-r-0">
      <div className="text-base font-bold tabular-nums text-slate-950">{formatNumber(value)}</div>
      <div className="mt-0.5 text-[10px] text-slate-500">{label}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClassName,
  muted,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className={cn('truncate text-right font-semibold text-slate-800', muted && 'text-slate-400', valueClassName)}>{value}</span>
    </div>
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
  variant: 'danger' | 'success' | 'blue' | 'amber';
  disabled?: boolean;
}) {
  const styles = {
    danger: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
    blue: 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100',
    amber: 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn('inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-bold transition disabled:opacity-50', styles[variant])}
    >
      {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

function AuditTimeline({ items, loading }: { items: AdminUserDetailSnapshot['audit']; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-2 rounded-md border border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
        Audit-Timeline wird geladen...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-2 rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">
        Noch keine Admin-Aktionen fuer diesen Nutzer.
      </div>
    );
  }

  return (
    <ol className="mt-2 space-y-2">
      {items.slice(0, 6).map((item) => (
        <li key={item.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-bold text-slate-800">{adminActionLabel(item.action)}</div>
              <div className="mt-0.5 truncate text-slate-500">
                {item.actor_username ? `von @${item.actor_username}` : 'System/Admin'} · {relativeTime(item.created_at)}
              </div>
            </div>
            <span className="shrink-0 text-[10px] font-semibold text-slate-400">{formatDate(item.created_at)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function statTone(tone: 'blue' | 'green' | 'violet' | 'red' | 'amber') {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return tones[tone];
}

function badgeTone(tone: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'teal' | 'slate') {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
    teal: 'bg-teal-50 text-teal-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return tones[tone];
}

function riskLabel(risk: AdminUserDirectoryItem['risk_level']) {
  if (risk === 'high') return 'Hoch';
  if (risk === 'medium') return 'Mittel';
  return 'Niedrig';
}

function riskText(risk: AdminUserDirectoryItem['risk_level']) {
  if (risk === 'high') return 'text-red-600';
  if (risk === 'medium') return 'text-amber-600';
  return 'text-emerald-600';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('de-DE').format(value);
}

function pageRangeLabel(page: number, visible: number, total: number) {
  if (visible === 0) return 'Keine Nutzer';
  const start = (page - 1) * ADMIN_USERS_PAGE_SIZE + 1;
  const end = start + visible - 1;
  return `${formatNumber(start)}-${formatNumber(end)} von ${formatNumber(total)} Nutzern`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Gerade eben';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Vor ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return hours < 24 ? `Heute, ${formatTime(value)}` : 'Gestern';
  const days = Math.floor(hours / 24);
  if (days < 31) return `Vor ${days} Tagen`;
  return formatDate(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function userStatusLabel(user: AdminUserDirectoryItem) {
  if (user.is_banned) return 'Gesperrt';
  if (user.is_restricted || user.is_shadow_banned) return 'Eingeschraenkt';
  return 'Aktiv';
}

function userRoleKey(user: AdminUserDirectoryItem): AdminAssignableUserRole {
  if (user.is_admin) return 'admin';
  if (user.is_moderator) return 'moderator';
  if (user.is_operator) return 'operator';
  if (user.is_creator_ops) return 'creator_ops';
  if (user.is_creator) return 'creator';
  return 'user';
}

function userRoleLabel(user: AdminUserDirectoryItem) {
  const key = userRoleKey(user);
  return roleLabel(key);
}

function roleLabel(role: AdminAssignableUserRole) {
  const labels: Record<AdminAssignableUserRole, string> = {
    admin: 'Admin',
    moderator: 'Moderator',
    operator: 'Operator',
    creator_ops: 'Creator Ops',
    creator: 'Creator',
    user: 'User',
  };
  return labels[role] ?? 'User';
}

function toCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = rows.map((row) => headers.map((header) => csvCell(row[header])).join(','));
  return [headers.join(','), ...lines].join('\n');
}

function csvCell(value: string | number | undefined) {
  const raw = String(value ?? '');
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replaceAll('"', '""')}"`;
}

function adminActionLabel(action: string) {
  const labels: Record<string, string> = {
    'admin.user.ban': 'Nutzer gesperrt',
    'admin.user.unban': 'Nutzer entsperrt',
    'admin.user.verify': 'Nutzer verifiziert',
    'admin.user.unverify': 'Verifizierung entfernt',
    'admin.user.make_admin': 'Admin-Rechte vergeben',
    'admin.user.remove_admin': 'Admin-Rechte entzogen',
    'moderation.enforcement.ban_profile': 'Profil per Report gesperrt',
    'moderation.enforcement.restrict_profile': 'Profil eingeschraenkt',
    'moderation.enforcement.shadowban_profile': 'Profil verborgen',
    'moderation.report.reviewed': 'Report geprueft',
    'moderation.report.actioned': 'Report umgesetzt',
    'moderation.report.dismissed': 'Report abgelehnt',
  };
  return labels[action] ?? action.replaceAll('.', ' ');
}
