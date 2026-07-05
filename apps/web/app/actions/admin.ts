'use server';

// -----------------------------------------------------------------------------
// Admin Server Actions — v1.w.UI.215
//
// Alle Mutations für das Admin-Panel. Reads laufen direkt im Server-Component
// (getAdminStats, searchAdminUsers) oder via revalidatePath + refresh.
//
// Sicherheit: Alle Supabase-Calls sind SECURITY DEFINER RPCs oder direkte
// Tabellenzugriffe — RLS-Policies blocken Nicht-Admin-User auf DB-Ebene.
// Zusätzlich prüfen wir is_admin im aufrufenden Server-Component (Layout).
// -----------------------------------------------------------------------------

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient as createSupabaseServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  total_users:     number;
  new_users_7d:    number;
  total_posts:     number;
  active_lives:    number;
  total_orders:    number;
  total_revenue:   number;
  pending_reports: number;
}

export interface AdminUser {
  id:                  string;
  username:            string;
  display_name:        string | null;
  avatar_url:          string | null;
  is_verified:         boolean;
  is_admin:            boolean;
  is_moderator:        boolean;
  is_operator:         boolean;
  is_creator_ops:      boolean;
  is_banned:           boolean;
  is_restricted:       boolean;
  restricted_until:    string | null;
  is_shadow_banned:    boolean;
  women_only_verified: boolean;
  is_creator:          boolean;
  created_at:          string;
  post_count:          number;
  follower_count:      number;
}

export interface AdminUserDirectoryItem extends AdminUser {
  comment_count: number;
  report_count: number;
  last_activity_at: string | null;
  risk_level: 'low' | 'medium' | 'high';
}

export type AdminUserStatusFilter = 'all' | 'active' | 'restricted' | 'banned';
export type AdminUserRoleFilter = 'all' | 'admin' | 'moderator' | 'operator' | 'creator_ops' | 'creator' | 'user';
export type AdminUserVerificationFilter = 'all' | 'verified' | 'unverified';
export type AdminUserActivityFilter = 'all' | 'active_30d' | 'inactive_30d';
export type AdminUserRiskFilter = 'all' | 'low' | 'medium' | 'high';
export type AdminAssignableUserRole = Exclude<AdminUserRoleFilter, 'all'>;

export interface AdminUserDirectoryQuery {
  query?: string;
  status?: AdminUserStatusFilter;
  role?: AdminUserRoleFilter;
  verification?: AdminUserVerificationFilter;
  activity?: AdminUserActivityFilter;
  risk?: AdminUserRiskFilter;
  page?: number;
  pageSize?: number;
}

export interface AdminUserDirectoryPage {
  users: AdminUserDirectoryItem[];
  page: number;
  page_size: number;
  total_count: number;
  has_more: boolean;
}

export interface AdminUserManagementStats {
  total_users: number;
  active_users_30d: number;
  new_users_30d: number;
  verified_users: number;
  banned_users: number;
  pending_reports: number;
  restricted_users: number;
}

export interface AdminUsersPageSnapshot {
  generated_at: string;
  stats: AdminUserManagementStats;
  users: AdminUserDirectoryItem[];
  directory: AdminUserDirectoryPage;
}

export interface AdminUserIdentitySnapshot {
  email: string | null;
  email_confirmed_at: string | null;
  phone: string | null;
  phone_confirmed_at: string | null;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
  banned_until: string | null;
  mfa_enabled: boolean | null;
}

export interface AdminUserAuditItem {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_display_name: string | null;
}

export interface AdminUserDetailSnapshot {
  generated_at: string | null;
  identity: AdminUserIdentitySnapshot | null;
  audit: AdminUserAuditItem[];
}

export interface ContentReport {
  id:          string;
  reporter_id: string;
  target_type: 'post' | 'profile' | 'comment' | 'live' | 'product' | string;
  target_id:   string;
  reason:      string;
  status:      'pending' | 'reviewed' | 'actioned' | 'dismissed';
  admin_note:  string | null;
  created_at:  string;
  reviewed_at: string | null;
  reporter:    { username: string } | null;
}

export interface ModerationHealth {
  sla_hours: number;
  content_reports: {
    total: number;
    pending: number;
    pending_over_sla: number;
    oldest_pending_age_seconds: number | null;
    reviewed_7d: number;
    by_target_type: Record<string, number>;
  };
  legacy_unqueued: {
    total: number;
    post_reports: number;
    user_reports: number;
    live_reports: number;
  };
  admin_audit: {
    events_7d: number;
    moderation_events_7d: number;
  };
}

export interface SellerBalance {
  seller_id:       string;
  username:        string;
  avatar_url:      string | null;
  diamond_balance: number;
  total_earned:    number;
  pending_orders:  number;
}

export interface CommandCenterSnapshot {
  generated_at: string;
  overall_status: 'green' | 'yellow' | 'red';
  admin_stats: AdminStats;
  platform_metrics: CommandMetric[];
  activity: CommandActivityItem[];
  moderation_queue: CommandQueueItem[];
  system_rows: CommandSystemRow[];
  top_content: CommandTopContentItem[];
  top_reels: CommandTopContentItem[];
  top_stories: CommandTopContentItem[];
  growth_7d: CommandGrowthPoint[];
  growth_series: CommandGrowthSeries;
  report_categories: CommandReportCategory[];
  support_inbox: CommandSupportInbox;
  campaigns: CommandCampaignSnapshot;
  regions: CommandRegionSnapshot;
  areas: CommandCenterArea[];
}

export interface CommandMetric {
  key: string;
  label: string;
  value: string;
  sublabel: string;
  tone: 'blue' | 'green' | 'violet' | 'amber' | 'red' | 'slate';
}

export interface CommandActivityItem {
  id: string;
  kind: 'post' | 'comment' | 'report';
  label: string;
  detail: string;
  created_at: string;
}

export interface CommandQueueItem {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  priority: 'Hoch' | 'Mittel' | 'Niedrig';
  wait_label: string;
  created_at: string;
}

export interface CommandSystemRow {
  key: string;
  label: string;
  status: 'green' | 'yellow' | 'red';
  summary: string;
}

export interface CommandTopContentItem {
  id: string;
  title: string;
  author_username: string | null;
  thumbnail_url: string | null;
  likes: number;
  comments: number;
  views: number;
  engagement_rate: number | null;
  created_at: string;
}

export interface CommandGrowthPoint {
  date: string;
  label: string;
  new_registrations: number;
  active_users: number;
}

export type CommandGrowthRange = '7d' | '30d' | '90d';

export type CommandGrowthSeries = Record<CommandGrowthRange, CommandGrowthPoint[]>;

export interface CommandReportCategory {
  key: string;
  label: string;
  count: number;
  percentage: number;
}

export interface CommandSupportInbox {
  status: 'ready' | 'missing_model' | 'error';
  total: number;
  open: number;
  pending: number;
  resolved_7d: number;
  over_sla: number;
  oldest_open_age_seconds: number | null;
  latest: CommandSupportThreadItem[];
  error?: string;
}

export interface CommandSupportThreadItem {
  id: string;
  subject: string;
  status: string;
  priority: string;
  source: string;
  username: string | null;
  last_message_at: string;
  age_seconds: number | null;
}

export interface CommandCampaignSnapshot {
  status: 'ready' | 'missing_model' | 'error';
  total: number;
  active: number;
  paused: number;
  failed: number;
  budget_cents: number;
  spend_cents_30d: number;
  revenue_cents_30d: number;
  impressions_30d: number;
  clicks_30d: number;
  conversions_30d: number;
  roas: number | null;
  latest: CommandCampaignItem[];
  error?: string;
}

export interface CommandCampaignItem {
  id: string;
  title: string;
  channel: string;
  status: string;
  target_metric: string | null;
  budget_cents: number;
  spend_cents: number;
  impressions_30d: number;
  clicks_30d: number;
  conversions_30d: number;
  revenue_cents_30d: number;
  updated_at: string;
}

export interface CommandRegionSnapshot {
  status: 'ready' | 'missing_model' | 'error';
  total_profiles: number;
  active_users_30d: number;
  new_registrations_30d: number;
  posts_30d: number;
  views_30d: number;
  reports_30d: number;
  latest: CommandRegionItem[];
  error?: string;
}

export interface CommandRegionItem {
  country_code: string;
  country_name: string;
  total_profiles: number;
  active_users_30d: number;
  new_registrations_30d: number;
  posts_30d: number;
  views_30d: number;
  reports_30d: number;
  latest_metric_date: string | null;
}

export interface AdminCampaign {
  id: string;
  title: string;
  channel: string;
  status: string;
  target_metric: string | null;
  budget_cents: number;
  spend_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminRegionMetric {
  id: string;
  country_code: string;
  country_name: string;
  metric_date: string;
  total_profiles: number;
  active_users: number;
  new_registrations: number;
  posts: number;
  views: number;
  reports: number;
  source: string;
  updated_at: string;
}

export interface AdminSupportThread {
  id: string;
  source: string;
  user_id: string | null;
  username: string | null;
  subject: string;
  status: string;
  priority: string;
  last_message_at: string;
  created_at: string;
}

export interface AdminSupportMessage {
  id: string;
  thread_id: string;
  sender_type: 'user' | 'admin' | 'system' | string;
  body: string;
  created_at: string;
  sender_username: string | null;
}

export interface AdminSidebarBadges {
  reports_pending: number;
  reports_over_sla: number;
  support_open: number;
  support_over_sla: number;
  campaigns_active: number;
  campaigns_failed: number;
  security_critical: number;
}

export interface CommandCenterArea {
  key: string;
  label: string;
  status: 'green' | 'yellow' | 'red';
  summary: string;
  detail: Record<string, string | number | boolean | null>;
  href?: string;
}

export interface CreatorActivationSummary {
  new_users_30d: number;
  users_without_first_post_30d: number;
  posts_7d: number;
  posts_30d: number;
  active_creators_7d: number;
  creators_with_posts_30d: number;
  creators_with_zero_engagement_30d: number;
  posts_with_meaningful_engagement_30d: number;
  views_30d: number;
  meaningful_engagement_30d: number;
}

export interface CreatorActivationFirstPostCandidate {
  profile_id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  created_at: string;
  days_since_signup: number;
}

export interface CreatorActivationEngagementCandidate {
  profile_id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  posts_30d: number;
  latest_post_at: string | null;
  views: number;
  likes: number;
  comments: number;
  bookmarks: number;
  follows: number;
}

export interface CreatorActivationSnapshot {
  generated_at: string;
  status: 'ready' | 'error';
  error?: string;
  summary: CreatorActivationSummary;
  need_first_post: CreatorActivationFirstPostCandidate[];
  need_engagement: CreatorActivationEngagementCandidate[];
  next_actions: string[];
}

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };
export interface AdminRoleStatus {
  is_authenticated: boolean;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  primary_role: 'admin' | 'moderator' | 'operator' | 'creator_ops' | 'none';
  is_admin: boolean;
  is_moderator: boolean;
  is_operator: boolean;
  is_creator_ops: boolean;
  can_admin: boolean;
  can_moderate: boolean;
  can_operate: boolean;
  can_creator_ops: boolean;
  can_access_admin: boolean;
}
type SnapshotObject = Record<string, unknown>;
type SnapshotResult = { ok: true; data: SnapshotObject } | { ok: false; error: string };
type CronJobSnapshot = { jobname?: unknown; active?: unknown };
type AdminServiceClient = {
  from: (table: string) => {
    update: (values: Record<string, boolean>) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

// ─── Auth guard helper ────────────────────────────────────────────────────────

export async function getAdminRoleStatus(): Promise<AdminRoleStatus> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return emptyAdminRoleStatus(false);

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, is_admin, is_moderator, is_operator, is_creator_ops')
    .eq('id', user.id)
    .maybeSingle();

  const roles = profile as {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
    is_admin?: boolean;
    is_moderator?: boolean;
    is_operator?: boolean;
    is_creator_ops?: boolean;
  } | null;

  return buildRoleStatus({
    is_admin: Boolean(roles?.is_admin),
    is_moderator: Boolean(roles?.is_moderator),
    is_operator: Boolean(roles?.is_operator),
    is_creator_ops: Boolean(roles?.is_creator_ops),
    username: roles?.username ?? null,
    display_name: roles?.display_name ?? null,
    avatar_url: roles?.avatar_url ?? null,
  });
}

async function requireAdmin() {
  return requireAdminRole('admin');
}

async function requireAdminRole(
  role: 'admin' | 'moderate' | 'operate' | 'creator_ops' | 'admin_console',
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, roles: emptyAdminRoleStatus(false), error: 'Bitte zuerst anmelden.' };

  const roles = await getAdminRoleStatus();
  const allowed =
    role === 'admin'
      ? roles.can_admin
      : role === 'moderate'
        ? roles.can_moderate
        : role === 'operate'
          ? roles.can_operate
          : role === 'creator_ops'
            ? roles.can_creator_ops
            : roles.can_access_admin;

  if (!allowed) return { supabase, user: null, roles, error: 'Keine ausreichende Berechtigung.' };
  return { supabase, user, roles, error: null };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const { error: authErr } = await requireAdminRole('admin_console');
  if (authErr) return emptyAdminStats();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error || !data) {
    return emptyAdminStats();
  }
  if ((data as { error?: string } | null)?.error) return emptyAdminStats();
  return data as AdminStats;
}

// ─── User search ──────────────────────────────────────────────────────────────

export async function searchAdminUsers(query: string): Promise<AdminUser[]> {
  const { error: authErr } = await requireAdmin();
  if (authErr) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_search_users', {
    p_query:  query || '',
    p_limit:  40,
    p_offset: 0,
  });
  if (error) return [];
  return (data ?? []) as AdminUser[];
}

export async function getAdminUsersPageSnapshot(): Promise<AdminUsersPageSnapshot> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return emptyAdminUsersPageSnapshot();

  const [directory, stats] = await Promise.all([
    searchAdminUserDirectoryPage({ page: 1, pageSize: 20 }),
    readAdminUserManagementStats(supabase),
  ]);

  return {
    generated_at: new Date().toISOString(),
    stats,
    users: directory.users,
    directory,
  };
}

export async function searchAdminUserDirectoryPage(input: AdminUserDirectoryQuery = {}): Promise<AdminUserDirectoryPage> {
  const { supabase, error: authErr } = await requireAdmin();
  const query = normalizeAdminUserDirectoryQuery(input);
  if (authErr) return emptyAdminUserDirectoryPage(query.page, query.pageSize);

  const { data, error } = await supabase.rpc('admin_user_directory_page', {
    p_query: query.query,
    p_status: query.status,
    p_role: query.role,
    p_verification: query.verification,
    p_activity: query.activity,
    p_risk: query.risk,
    p_limit: query.pageSize,
    p_offset: (query.page - 1) * query.pageSize,
  });

  if (!error && Array.isArray(data)) {
    return normalizeAdminUserDirectoryPage(data as SnapshotObject[], query.page, query.pageSize);
  }

  const fallbackUsers = await searchAdminUserDirectory(query.query);
  const filteredUsers = fallbackUsers.filter((user) => {
    if (query.status !== 'all' && adminUserStatusKey(user) !== query.status) return false;
    if (query.role !== 'all' && adminUserRoleKey(user) !== query.role) return false;
    if (query.verification === 'verified' && !user.is_verified) return false;
    if (query.verification === 'unverified' && user.is_verified) return false;
    if (query.activity !== 'all' && adminUserActivityKey(user) !== query.activity) return false;
    if (query.risk !== 'all' && user.risk_level !== query.risk) return false;
    return true;
  });
  const start = (query.page - 1) * query.pageSize;
  const pageUsers = filteredUsers.slice(start, start + query.pageSize);

  return {
    users: pageUsers,
    page: query.page,
    page_size: query.pageSize,
    total_count: filteredUsers.length,
    has_more: start + pageUsers.length < filteredUsers.length,
  };
}

export async function searchAdminUserDirectory(query: string): Promise<AdminUserDirectoryItem[]> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return [];

  const users = await searchAdminUsers(query);
  if (users.length === 0) return [];

  const ids = users.map((user) => user.id);
  const [commentCounts, reportCounts, lastActivity] = await Promise.all([
    readCountsByUser(supabase, 'comments', 'user_id', ids),
    readReportCountsByUser(supabase, ids),
    readLastActivityByUser(supabase, ids),
  ]);

  return users.map((user) => {
    const reportCount = reportCounts.get(user.id) ?? 0;
    return {
      ...user,
      comment_count: commentCounts.get(user.id) ?? 0,
      report_count: reportCount,
      last_activity_at: lastActivity.get(user.id) ?? null,
      risk_level: user.is_banned || user.is_shadow_banned || reportCount >= 3
        ? 'high'
        : user.is_restricted || reportCount > 0
          ? 'medium'
          : 'low',
    };
  });
}

export async function getAdminUserDetailSnapshot(userId: string): Promise<AdminUserDetailSnapshot | null> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr || !userId) return null;

  const { data, error } = await supabase.rpc('admin_user_detail_snapshot', {
    p_user_id: userId,
  });
  if (error || !data || typeof data !== 'object') return null;
  if ((data as { error?: string }).error) return null;

  return normalizeAdminUserDetailSnapshot(data as SnapshotObject);
}

// ─── User mutations ───────────────────────────────────────────────────────────

export async function adminInviteUser(formData: FormData): Promise<ActionResult<{
  user_id: string | null;
  delivery: 'email' | 'manual_link';
  invite_link?: string;
}>> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? 'user').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Bitte eine gueltige E-Mail eingeben.' };
  }
  if (!['user', 'creator', 'moderator', 'operator', 'creator_ops'].includes(role)) {
    return { ok: false, error: 'Diese Rolle ist fuer Einladungen nicht erlaubt.' };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY fehlt. Einladung kann nicht gesendet werden.' };
  }

  const origin = await getRequestOrigin();
  const adminClient = createSupabaseServiceClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const redirectTo = `${origin}/auth/accept-invite?next=${encodeURIComponent('/onboarding')}`;
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error) {
    const linkResult = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo },
    });
    if (linkResult.error || !linkResult.data.properties?.action_link) {
      return { ok: false, error: `${error.message}; Fallback-Link fehlgeschlagen: ${linkResult.error?.message ?? 'kein Link erhalten'}` };
    }

    const fallbackUserId = linkResult.data.user?.id ?? null;
    if (fallbackUserId) {
      await applyInvitedUserRole(adminClient as unknown as AdminServiceClient, fallbackUserId, role);
      await recordAdminUserAction(supabase, fallbackUserId, 'admin.user.invite_link', {
        email,
        invited_role: role,
        mail_error: error.message,
      });
    }

    revalidatePath('/admin/users');
    return {
      ok: true,
      data: {
        user_id: fallbackUserId,
        delivery: 'manual_link',
        invite_link: linkResult.data.properties.action_link,
      },
    };
  }

  const invitedUserId = data.user?.id ?? null;
  if (invitedUserId) {
    await applyInvitedUserRole(adminClient as unknown as AdminServiceClient, invitedUserId, role);
    await recordAdminUserAction(supabase, invitedUserId, 'admin.user.invite', {
      email,
      invited_role: role,
    });
  }

  revalidatePath('/admin/users');
  return { ok: true, data: { user_id: invitedUserId, delivery: 'email' } };
}

export async function adminBanUser(userId: string, ban: boolean): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: ban })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  await recordAdminUserAction(supabase, userId, ban ? 'admin.user.ban' : 'admin.user.unban', { is_banned: ban });
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function adminVerifyUser(userId: string, verify: boolean): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const { error } = await supabase
    .from('profiles')
    .update({ is_verified: verify })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  await recordAdminUserAction(supabase, userId, verify ? 'admin.user.verify' : 'admin.user.unverify', { is_verified: verify });
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function adminToggleAdmin(userId: string, isAdmin: boolean): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };

  const { error } = await supabase
    .from('profiles')
    .update({ is_admin: isAdmin })
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  await recordAdminUserAction(supabase, userId, isAdmin ? 'admin.user.make_admin' : 'admin.user.remove_admin', { is_admin: isAdmin });
  revalidatePath('/admin/users');
  return { ok: true };
}

export async function adminSetUserRole(userId: string, role: AdminAssignableUserRole): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };
  if (!userId) return { ok: false, error: 'Nutzer-ID fehlt.' };
  if (!['admin', 'moderator', 'operator', 'creator_ops', 'creator', 'user'].includes(role)) {
    return { ok: false, error: 'Diese Rolle ist nicht erlaubt.' };
  }
  if (user?.id === userId && role !== 'admin') {
    return { ok: false, error: 'Du kannst dir nicht selbst Admin-Rechte entziehen.' };
  }

  const patch = {
    is_admin: role === 'admin',
    is_moderator: role === 'moderator',
    is_operator: role === 'operator',
    is_creator_ops: role === 'creator_ops',
    is_creator: role === 'creator',
  };
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  await recordAdminUserAction(supabase, userId, 'admin.user.set_role', { role, ...patch });
  revalidatePath('/admin/users');
  revalidatePath('/admin/command-center');
  return { ok: true };
}

export async function adminSetUserSafetyState(
  userId: string,
  action: 'restrict' | 'unrestrict' | 'shadowban' | 'unshadowban',
): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdmin();
  if (authErr) return { ok: false, error: authErr };
  if (!userId) return { ok: false, error: 'Nutzer-ID fehlt.' };

  const restrictedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const patch =
    action === 'restrict'
      ? { is_restricted: true, restricted_until: restrictedUntil }
      : action === 'unrestrict'
        ? { is_restricted: false, restricted_until: null }
        : action === 'shadowban'
          ? { is_shadow_banned: true }
          : { is_shadow_banned: false };

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);

  if (error) return { ok: false, error: error.message };
  await recordAdminUserAction(supabase, userId, `admin.user.${action}`, patch);
  revalidatePath('/admin/users');
  revalidatePath('/admin/reports');
  revalidatePath('/admin/command-center');
  revalidatePath('/');
  return { ok: true };
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function getAdminReports(
  status?: 'pending' | 'reviewed' | 'actioned' | 'dismissed',
): Promise<ContentReport[]> {
  const { error: authErr } = await requireAdminRole('moderate');
  if (authErr) return [];

  const supabase = await createClient();
  let q = supabase
    .from('content_reports')
    .select('*, reporter:profiles!reporter_id(username)')
    .order('created_at', { ascending: false })
    .limit(60);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as unknown as ContentReport[];
}

export async function getModerationHealth(): Promise<ModerationHealth | null> {
  const { error: authErr } = await requireAdminRole('moderate');
  if (authErr) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('moderation_health_snapshot');
  if (error || !data || typeof data !== 'object') return null;
  return data as ModerationHealth;
}

export async function getAdminSupportThreads(status?: string): Promise<AdminSupportThread[]> {
  const { error: authErr } = await requireAdminRole('moderate');
  if (authErr) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_list_support_threads', {
    p_status: status ?? null,
    p_limit: 50,
    p_offset: 0,
  });
  if (error) return [];
  return (data ?? []) as unknown as AdminSupportThread[];
}

export async function getAdminSupportMessages(threadIds: string[]): Promise<Record<string, AdminSupportMessage[]>> {
  const { supabase, error: authErr } = await requireAdminRole('moderate');
  if (authErr || threadIds.length === 0) return {};

  const { data, error } = await supabase
    .from('admin_support_messages')
    .select('id, thread_id, sender_type, body, created_at, sender:profiles!sender_id(username)')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) return {};

  const grouped: Record<string, AdminSupportMessage[]> = {};
  for (const row of data ?? []) {
    const threadId = String(row.thread_id);
    if (!grouped[threadId]) grouped[threadId] = [];
    const sender = row.sender as { username?: string | null } | null;
    grouped[threadId].push({
      id: String(row.id),
      thread_id: threadId,
      sender_type: String(row.sender_type),
      body: String(row.body),
      created_at: String(row.created_at),
      sender_username: sender?.username ?? null,
    });
  }
  return grouped;
}

export async function adminReplySupportThread(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdminRole('moderate');
  if (authErr) return { ok: false, error: authErr };

  const threadId = String(formData.get('thread_id') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!threadId) return { ok: false, error: 'Supportfall fehlt.' };
  if (!body) return { ok: false, error: 'Antwort fehlt.' };

  const { data, error } = await supabase.rpc('admin_reply_support_thread', {
    p_thread_id: threadId,
    p_body: body,
  });
  if (error) return { ok: false, error: error.message };
  if ((data as { error?: string } | null)?.error) return { ok: false, error: (data as { error: string }).error };

  revalidatePath('/admin/support');
  revalidatePath('/admin/command-center');
  return { ok: true };
}

export async function adminResolveSupportThread(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdminRole('moderate');
  if (authErr) return { ok: false, error: authErr };

  const threadId = String(formData.get('thread_id') ?? '').trim();
  const status = String(formData.get('status') ?? 'resolved').trim() || 'resolved';
  if (!threadId) return { ok: false, error: 'Supportfall fehlt.' };
  if (!['resolved', 'closed', 'pending', 'open'].includes(status)) return { ok: false, error: 'Status ist nicht erlaubt.' };

  const { data, error } = await supabase.rpc('admin_resolve_support_thread', {
    p_thread_id: threadId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  if ((data as { error?: string } | null)?.error) return { ok: false, error: (data as { error: string }).error };

  revalidatePath('/admin/support');
  revalidatePath('/admin/command-center');
  return { ok: true };
}

export async function adminCreateActivationSupportThread(formData: FormData): Promise<ActionResult> {
  const { supabase, roles, error: authErr } = await requireAdminRole('admin_console');
  if (authErr) return { ok: false, error: authErr };
  if (!roles.can_operate && !roles.can_creator_ops) return { ok: false, error: 'Keine ausreichende Berechtigung.' };

  const userId = String(formData.get('user_id') ?? '').trim();
  const kind = String(formData.get('kind') ?? 'first_post').trim() || 'first_post';
  const bodyValue = String(formData.get('body') ?? '').trim();
  const body = bodyValue.length > 0 ? bodyValue : null;

  if (!userId) return { ok: false, error: 'Nutzer fehlt.' };
  if (!['first_post', 'engagement'].includes(kind)) return { ok: false, error: 'Activation-Art ist nicht erlaubt.' };

  const { data, error } = await supabase.rpc('admin_create_activation_support_thread', {
    p_user_id: userId,
    p_kind: kind,
    p_body: body,
  });
  if (error) return { ok: false, error: error.message };
  if ((data as { error?: string } | null)?.error) return { ok: false, error: (data as { error: string }).error };

  revalidatePath('/admin/activation');
  revalidatePath('/admin/support');
  revalidatePath('/admin/command-center');
  return { ok: true };
}

export async function getAdminCampaigns(): Promise<AdminCampaign[]> {
  const { supabase, error: authErr } = await requireAdminRole('operate');
  if (authErr) return [];

  const { data, error } = await supabase
    .from('admin_campaigns')
    .select('id, title, channel, status, target_metric, budget_cents, spend_cents, starts_at, ends_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(80);
  if (error) return [];
  return (data ?? []) as unknown as AdminCampaign[];
}

export async function getAdminRegionMetrics(): Promise<AdminRegionMetric[]> {
  const { supabase, error: authErr } = await requireAdminRole('operate');
  if (authErr) return [];

  const { data, error } = await supabase
    .from('admin_region_daily_metrics')
    .select('id, country_code, country_name, metric_date, total_profiles, active_users, new_registrations, posts, views, reports, source, updated_at')
    .order('metric_date', { ascending: false })
    .order('total_profiles', { ascending: false })
    .limit(120);
  if (error) return [];
  return (data ?? []) as unknown as AdminRegionMetric[];
}

export async function adminRefreshRegionMetricsFromProfiles(): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdminRole('operate');
  if (authErr) return { ok: false, error: authErr };

  const { data, error } = await supabase.rpc('refresh_admin_region_metrics_from_profiles');
  if (error) return { ok: false, error: error.message };
  if ((data as { error?: string } | null)?.error) return { ok: false, error: (data as { error: string }).error };

  revalidatePath('/admin/regions');
  revalidatePath('/admin/command-center');
  return { ok: true };
}

export async function adminUpsertRegionDailyMetrics(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdminRole('admin');
  if (authErr) return { ok: false, error: authErr };

  const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase();
  const countryName = String(formData.get('country_name') ?? '').trim();
  const metricDate = String(formData.get('metric_date') ?? '').trim() || new Date().toISOString().slice(0, 10);
  const source = String(formData.get('source') ?? 'manual').trim() || 'manual';

  if (!/^[A-Z]{2}$/.test(countryCode)) return { ok: false, error: 'Land muss als ISO-2 Code angegeben werden.' };
  if (!countryName) return { ok: false, error: 'Landname fehlt.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) return { ok: false, error: 'Datum ist ungueltig.' };

  const { error } = await supabase
    .from('admin_region_daily_metrics')
    .upsert({
      country_code: countryCode,
      country_name: countryName,
      metric_date: metricDate,
      total_profiles: positiveInteger(formData.get('total_profiles')),
      active_users: positiveInteger(formData.get('active_users')),
      new_registrations: positiveInteger(formData.get('new_registrations')),
      posts: positiveInteger(formData.get('posts')),
      views: positiveInteger(formData.get('views')),
      reports: positiveInteger(formData.get('reports')),
      source,
    }, { onConflict: 'country_code,metric_date,source' });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/regions');
  revalidatePath('/admin/command-center');
  return { ok: true };
}

export async function adminCreateCampaign(formData: FormData): Promise<ActionResult> {
  const { supabase, user, error: authErr } = await requireAdminRole('admin');
  if (authErr) return { ok: false, error: authErr };

  const title = String(formData.get('title') ?? '').trim();
  const channel = String(formData.get('channel') ?? 'manual').trim() || 'manual';
  const status = String(formData.get('status') ?? 'draft').trim() || 'draft';
  const targetMetric = String(formData.get('target_metric') ?? '').trim() || null;
  const budgetEuros = Number(String(formData.get('budget_euros') ?? '0').replace(',', '.'));

  if (!title) return { ok: false, error: 'Titel fehlt.' };
  if (!['draft', 'active', 'paused'].includes(status)) return { ok: false, error: 'Status ist nicht erlaubt.' };
  if (!Number.isFinite(budgetEuros) || budgetEuros < 0) return { ok: false, error: 'Budget ist ungueltig.' };

  const { error } = await supabase.from('admin_campaigns').insert({
    title,
    channel,
    status,
    target_metric: targetMetric,
    budget_cents: Math.round(budgetEuros * 100),
    created_by: user?.id ?? null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/campaigns');
  revalidatePath('/admin/command-center');
  return { ok: true };
}

export async function adminUpdateCampaignStatus(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdminRole('admin');
  if (authErr) return { ok: false, error: authErr };

  const campaignId = String(formData.get('campaign_id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!campaignId) return { ok: false, error: 'Kampagne fehlt.' };
  if (!['draft', 'active', 'paused', 'completed', 'failed', 'archived'].includes(status)) {
    return { ok: false, error: 'Status ist nicht erlaubt.' };
  }

  const { error } = await supabase
    .from('admin_campaigns')
    .update({ status })
    .eq('id', campaignId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/campaigns');
  revalidatePath('/admin/command-center');
  return { ok: true };
}

export async function adminUpsertCampaignDailyMetrics(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdminRole('admin');
  if (authErr) return { ok: false, error: authErr };

  const campaignId = String(formData.get('campaign_id') ?? '').trim();
  const metricDate = String(formData.get('metric_date') ?? '').trim() || new Date().toISOString().slice(0, 10);
  const impressions = positiveInteger(formData.get('impressions'));
  const clicks = positiveInteger(formData.get('clicks'));
  const conversions = positiveInteger(formData.get('conversions'));
  const revenueCents = eurosToCents(formData.get('revenue_euros'));
  const spendCents = eurosToCents(formData.get('spend_euros'));

  if (!campaignId) return { ok: false, error: 'Kampagne fehlt.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metricDate)) return { ok: false, error: 'Datum ist ungueltig.' };

  const { error } = await supabase
    .from('admin_campaign_daily_metrics')
    .upsert({
      campaign_id: campaignId,
      metric_date: metricDate,
      impressions,
      clicks,
      conversions,
      revenue_cents: revenueCents,
      spend_cents: spendCents,
    }, { onConflict: 'campaign_id,metric_date' });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/campaigns');
  revalidatePath('/admin/command-center');
  return { ok: true };
}

export async function getAdminSidebarBadges(): Promise<AdminSidebarBadges> {
  const { supabase, error: authErr } = await requireAdminRole('admin_console');
  if (authErr) return emptySidebarBadges();

  const result = await readRpcSnapshot(supabase, 'admin_sidebar_badges_snapshot');
  if (!result.ok || typeof result.data.error === 'string') return emptySidebarBadges();

  const reports = asRecord(result.data.reports);
  const support = asRecord(result.data.support);
  const campaigns = asRecord(result.data.campaigns);
  const security = asRecord(result.data.security);

  return {
    reports_pending: toNumber(reports.pending),
    reports_over_sla: toNumber(reports.over_sla),
    support_open: toNumber(support.open),
    support_over_sla: toNumber(support.over_sla),
    campaigns_active: toNumber(campaigns.active),
    campaigns_failed: toNumber(campaigns.failed),
    security_critical: toNumber(security.critical),
  };
}

export async function getAdminCommandCenterSnapshot(): Promise<CommandCenterSnapshot> {
  const { supabase, error: authErr } = await requireAdminRole('operate');
  if (authErr) {
    return fallbackCommandCenterSnapshot(authErr);
  }

  const [adminStats, integrity, product, cost, moderation, pushFeed, support, campaigns, regions] = await Promise.all([
    getAdminStats(),
    readRpcSnapshot(supabase, 'production_integrity_snapshot'),
    readRpcSnapshot(supabase, 'product_health_snapshot'),
    readRpcSnapshot(supabase, 'cost_health_snapshot'),
    readRpcSnapshot(supabase, 'moderation_health_snapshot'),
    readRpcSnapshot(supabase, 'push_feed_health_snapshot'),
    readRpcSnapshot(supabase, 'admin_support_snapshot'),
    readRpcSnapshot(supabase, 'admin_campaign_snapshot'),
    readRpcSnapshot(supabase, 'admin_region_snapshot'),
  ]);

  const areas = [
    buildIntegrityArea(integrity),
    buildProductArea(product),
    buildCostArea(cost),
    buildModerationArea(moderation),
    buildPushFeedArea(pushFeed),
    buildReleaseArea(),
  ];
  const [
    activity,
    moderationQueue,
    topContent,
    topReels,
    topStories,
    growth7d,
    growth30d,
    growth90d,
    reportCategories,
  ] = await Promise.all([
    readCommandActivity(supabase),
    readModerationQueue(supabase),
    readTopContent(supabase),
    readTopContent(supabase, { mediaType: 'video' }),
    readTopStories(supabase),
    readGrowthSeries(supabase, 7),
    readGrowthSeries(supabase, 30),
    readGrowthSeries(supabase, 90),
    readReportCategories(supabase),
  ]);

  return {
    generated_at: new Date().toISOString(),
    overall_status: rollupStatus(areas),
    admin_stats: adminStats,
    platform_metrics: buildPlatformMetrics(adminStats, product),
    activity,
    moderation_queue: moderationQueue,
    system_rows: areas.map((area) => ({
      key: area.key,
      label: area.label,
      status: area.status,
      summary: area.summary,
    })),
    top_content: topContent,
    top_reels: topReels,
    top_stories: topStories,
    growth_7d: growth7d,
    growth_series: {
      '7d': growth7d,
      '30d': growth30d,
      '90d': growth90d,
    },
    report_categories: reportCategories,
    support_inbox: buildSupportInbox(support),
    campaigns: buildCampaignSnapshot(campaigns),
    regions: buildRegionSnapshot(regions),
    areas,
  };
}

export async function getCreatorActivationSnapshot(): Promise<CreatorActivationSnapshot> {
  const { supabase, error: authErr } = await requireAdminRole('admin_console');
  if (authErr) return emptyCreatorActivationSnapshot(authErr);

  const result = await readRpcSnapshot(supabase, 'creator_activation_recovery_snapshot');
  if (!result.ok) return emptyCreatorActivationSnapshot(result.error);
  if (typeof result.data.error === 'string') return emptyCreatorActivationSnapshot(result.data.error);

  return buildCreatorActivationSnapshot(result.data);
}

export async function adminResolveReport(
  reportId: string,
  status: 'reviewed' | 'actioned' | 'dismissed',
  adminNote?: string,
): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdminRole('moderate');
  if (authErr) return { ok: false, error: authErr };

  const { data, error } = await supabase.rpc('admin_resolve_content_report', {
    p_report_id: reportId,
    p_status: status,
    p_admin_note: adminNote ?? null,
  });
  if (error) return { ok: false, error: error.message };
  if ((data as { error?: string } | null)?.error) return { ok: false, error: (data as { error: string }).error };
  revalidatePath('/admin/reports');
  return { ok: true };
}

export async function adminEnforceReport(
  reportId: string,
  action: 'remove_post' | 'ban_profile' | 'restrict_profile' | 'shadowban_profile' | 'mute_live_host',
  adminNote?: string,
): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdminRole('moderate');
  if (authErr) return { ok: false, error: authErr };

  const { data, error } = await supabase.rpc('admin_enforce_content_report', {
    p_report_id: reportId,
    p_action: action,
    p_admin_note: adminNote ?? null,
  });
  if (error) return { ok: false, error: error.message };
  if ((data as { error?: string } | null)?.error) return { ok: false, error: (data as { error: string }).error };
  revalidatePath('/admin/reports');
  revalidatePath('/admin/users');
  revalidatePath('/');
  revalidatePath('/following');
  return { ok: true };
}

/** Schlanker Client-Check: ist der eingeloggte Nutzer Admin? (für UI-Gating). */
export async function getViewerIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  return Boolean((data as { is_admin?: boolean } | null)?.is_admin);
}

/** Direktes, protokolliertes Admin-Löschen eines Posts (ohne vorherige Meldung). */
export async function adminRemovePost(postId: string, reason?: string): Promise<ActionResult> {
  const { supabase, error: authErr } = await requireAdminRole('moderate');
  if (authErr) return { ok: false, error: authErr };

  const { data, error } = await supabase.rpc('admin_remove_post', {
    p_post_id: postId,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };
  if ((data as { error?: string } | null)?.error) return { ok: false, error: (data as { error: string }).error };
  revalidatePath('/');
  revalidatePath('/following');
  return { ok: true };
}

// ─── Seller balances ──────────────────────────────────────────────────────────

export async function getSellerBalances(): Promise<SellerBalance[]> {
  const { error: authErr } = await requireAdminRole('creator_ops');
  if (authErr) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_get_seller_balances');
  if (error) return [];
  return (data ?? []) as SellerBalance[];
}

// ─── Command center helpers ─────────────────────────────────────────────────

async function readRpcSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
): Promise<SnapshotResult> {
  const { data, error } = await supabase.rpc(name);
  if (error) return { ok: false, error: error.message };
  if (!data || typeof data !== 'object') return { ok: false, error: 'Snapshot leer oder ungültig.' };
  return { ok: true, data: data as SnapshotObject };
}

function fallbackCommandCenterSnapshot(reason: string): CommandCenterSnapshot {
  return {
    generated_at: new Date().toISOString(),
    overall_status: 'red',
    admin_stats: {
      total_users: 0,
      new_users_7d: 0,
      total_posts: 0,
      active_lives: 0,
      total_orders: 0,
      total_revenue: 0,
      pending_reports: 0,
    },
    platform_metrics: [],
    activity: [],
    moderation_queue: [],
    system_rows: [],
    top_content: [],
    top_reels: [],
    top_stories: [],
    growth_7d: [],
    growth_series: {
      '7d': [],
      '30d': [],
      '90d': [],
    },
    report_categories: [],
    support_inbox: emptySupportInbox('error', reason),
    campaigns: emptyCampaignSnapshot('error', reason),
    regions: emptyRegionSnapshot('error', reason),
    areas: [
      {
        key: 'access',
        label: 'Admin Zugriff',
        status: 'red',
        summary: reason,
        detail: {},
      },
    ],
  };
}

function emptyAdminStats(): AdminStats {
  return {
    total_users: 0,
    new_users_7d: 0,
    total_posts: 0,
    active_lives: 0,
    total_orders: 0,
    total_revenue: 0,
    pending_reports: 0,
  };
}

function emptySidebarBadges(): AdminSidebarBadges {
  return {
    reports_pending: 0,
    reports_over_sla: 0,
    support_open: 0,
    support_over_sla: 0,
    campaigns_active: 0,
    campaigns_failed: 0,
    security_critical: 0,
  };
}

function buildCampaignSnapshot(result: SnapshotResult): CommandCampaignSnapshot {
  if (!result.ok) {
    const missingModel = /function .*admin_campaign_snapshot|schema cache|not found/i.test(result.error);
    return emptyCampaignSnapshot(missingModel ? 'missing_model' : 'error', result.error);
  }
  if (typeof result.data.error === 'string') {
    return emptyCampaignSnapshot('error', result.data.error);
  }

  const summary = asRecord(result.data.summary);
  const campaigns = Array.isArray(result.data.campaigns) ? result.data.campaigns as SnapshotObject[] : [];
  const roasValue = summary.roas === null || summary.roas === undefined ? null : Number(summary.roas);

  return {
    status: 'ready',
    total: toNumber(summary.total),
    active: toNumber(summary.active),
    paused: toNumber(summary.paused),
    failed: toNumber(summary.failed),
    budget_cents: toNumber(summary.budget_cents),
    spend_cents_30d: toNumber(summary.spend_cents_30d),
    revenue_cents_30d: toNumber(summary.revenue_cents_30d),
    impressions_30d: toNumber(summary.impressions_30d),
    clicks_30d: toNumber(summary.clicks_30d),
    conversions_30d: toNumber(summary.conversions_30d),
    roas: Number.isFinite(roasValue) ? roasValue : null,
    latest: campaigns.map((item) => ({
      id: String(item.id ?? ''),
      title: String(item.title ?? 'Kampagne ohne Titel'),
      channel: String(item.channel ?? 'manual'),
      status: String(item.status ?? 'draft'),
      target_metric: typeof item.target_metric === 'string' ? item.target_metric : null,
      budget_cents: toNumber(item.budget_cents),
      spend_cents: toNumber(item.spend_cents),
      impressions_30d: toNumber(item.impressions_30d),
      clicks_30d: toNumber(item.clicks_30d),
      conversions_30d: toNumber(item.conversions_30d),
      revenue_cents_30d: toNumber(item.revenue_cents_30d),
      updated_at: String(item.updated_at ?? new Date().toISOString()),
    })),
  };
}

function emptyCampaignSnapshot(status: CommandCampaignSnapshot['status'], error?: string): CommandCampaignSnapshot {
  return {
    status,
    total: 0,
    active: 0,
    paused: 0,
    failed: 0,
    budget_cents: 0,
    spend_cents_30d: 0,
    revenue_cents_30d: 0,
    impressions_30d: 0,
    clicks_30d: 0,
    conversions_30d: 0,
    roas: null,
    latest: [],
    error,
  };
}

function buildRegionSnapshot(result: SnapshotResult): CommandRegionSnapshot {
  if (!result.ok) {
    const missingModel = /function .*admin_region_snapshot|schema cache|not found/i.test(result.error);
    return emptyRegionSnapshot(missingModel ? 'missing_model' : 'error', result.error);
  }
  if (typeof result.data.error === 'string') {
    return emptyRegionSnapshot('error', result.data.error);
  }

  const summary = asRecord(result.data.summary);
  const regions = Array.isArray(result.data.regions) ? result.data.regions as SnapshotObject[] : [];

  return {
    status: 'ready',
    total_profiles: toNumber(summary.total_profiles),
    active_users_30d: toNumber(summary.active_users_30d),
    new_registrations_30d: toNumber(summary.new_registrations_30d),
    posts_30d: toNumber(summary.posts_30d),
    views_30d: toNumber(summary.views_30d),
    reports_30d: toNumber(summary.reports_30d),
    latest: regions.map((item) => ({
      country_code: String(item.country_code ?? ''),
      country_name: String(item.country_name ?? 'Unbekannte Region'),
      total_profiles: toNumber(item.total_profiles),
      active_users_30d: toNumber(item.active_users_30d),
      new_registrations_30d: toNumber(item.new_registrations_30d),
      posts_30d: toNumber(item.posts_30d),
      views_30d: toNumber(item.views_30d),
      reports_30d: toNumber(item.reports_30d),
      latest_metric_date: typeof item.latest_metric_date === 'string' ? item.latest_metric_date : null,
    })),
  };
}

function emptyRegionSnapshot(status: CommandRegionSnapshot['status'], error?: string): CommandRegionSnapshot {
  return {
    status,
    total_profiles: 0,
    active_users_30d: 0,
    new_registrations_30d: 0,
    posts_30d: 0,
    views_30d: 0,
    reports_30d: 0,
    latest: [],
    error,
  };
}

function buildCreatorActivationSnapshot(data: SnapshotObject): CreatorActivationSnapshot {
  const summary = asRecord(data.summary);
  const needFirstPost = Array.isArray(data.need_first_post) ? data.need_first_post as SnapshotObject[] : [];
  const needEngagement = Array.isArray(data.need_engagement) ? data.need_engagement as SnapshotObject[] : [];
  const nextActions = Array.isArray(data.next_actions)
    ? data.next_actions.map((item) => String(item)).filter(Boolean)
    : [];

  return {
    generated_at: typeof data.generated_at === 'string' ? data.generated_at : new Date().toISOString(),
    status: 'ready',
    summary: {
      new_users_30d: toNumber(summary.new_users_30d),
      users_without_first_post_30d: toNumber(summary.users_without_first_post_30d),
      posts_7d: toNumber(summary.posts_7d),
      posts_30d: toNumber(summary.posts_30d),
      active_creators_7d: toNumber(summary.active_creators_7d),
      creators_with_posts_30d: toNumber(summary.creators_with_posts_30d),
      creators_with_zero_engagement_30d: toNumber(summary.creators_with_zero_engagement_30d),
      posts_with_meaningful_engagement_30d: toNumber(summary.posts_with_meaningful_engagement_30d),
      views_30d: toNumber(summary.views_30d),
      meaningful_engagement_30d: toNumber(summary.meaningful_engagement_30d),
    },
    need_first_post: needFirstPost.map((item) => ({
      profile_id: String(item.profile_id ?? item.user_id ?? ''),
      user_id: String(item.user_id ?? ''),
      username: typeof item.username === 'string' ? item.username : null,
      display_name: typeof item.display_name === 'string' ? item.display_name : null,
      created_at: String(item.created_at ?? new Date().toISOString()),
      days_since_signup: toNumber(item.days_since_signup),
    })),
    need_engagement: needEngagement.map((item) => ({
      profile_id: String(item.profile_id ?? item.user_id ?? ''),
      user_id: String(item.user_id ?? ''),
      username: typeof item.username === 'string' ? item.username : null,
      display_name: typeof item.display_name === 'string' ? item.display_name : null,
      posts_30d: toNumber(item.posts_30d),
      latest_post_at: typeof item.latest_post_at === 'string' ? item.latest_post_at : null,
      views: toNumber(item.views),
      likes: toNumber(item.likes),
      comments: toNumber(item.comments),
      bookmarks: toNumber(item.bookmarks),
      follows: toNumber(item.follows),
    })),
    next_actions: nextActions,
  };
}

function emptyCreatorActivationSnapshot(error?: string): CreatorActivationSnapshot {
  return {
    generated_at: new Date().toISOString(),
    status: 'error',
    error,
    summary: {
      new_users_30d: 0,
      users_without_first_post_30d: 0,
      posts_7d: 0,
      posts_30d: 0,
      active_creators_7d: 0,
      creators_with_posts_30d: 0,
      creators_with_zero_engagement_30d: 0,
      posts_with_meaningful_engagement_30d: 0,
      views_30d: 0,
      meaningful_engagement_30d: 0,
    },
    need_first_post: [],
    need_engagement: [],
    next_actions: [],
  };
}

function emptyAdminRoleStatus(isAuthenticated: boolean): AdminRoleStatus {
  return buildRoleStatus({
    is_authenticated: isAuthenticated,
    is_admin: false,
    is_moderator: false,
    is_operator: false,
    is_creator_ops: false,
  });
}

function buildRoleStatus(roles: {
  is_authenticated?: boolean;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  is_admin: boolean;
  is_moderator: boolean;
  is_operator: boolean;
  is_creator_ops: boolean;
}): AdminRoleStatus {
  const primaryRole = roles.is_admin
    ? 'admin'
    : roles.is_moderator
      ? 'moderator'
      : roles.is_operator
        ? 'operator'
        : roles.is_creator_ops
          ? 'creator_ops'
          : 'none';

  return {
    is_authenticated: Boolean(roles.is_authenticated ?? true),
    username: roles.username ?? null,
    display_name: roles.display_name ?? null,
    avatar_url: roles.avatar_url ?? null,
    primary_role: primaryRole,
    ...roles,
    can_admin: roles.is_admin,
    can_moderate: roles.is_admin || roles.is_moderator,
    can_operate: roles.is_admin || roles.is_operator,
    can_creator_ops: roles.is_admin || roles.is_creator_ops,
    can_access_admin: roles.is_admin || roles.is_moderator || roles.is_operator || roles.is_creator_ops,
  };
}

function buildPlatformMetrics(
  adminStats: AdminStats,
  product: SnapshotResult,
): CommandMetric[] {
  const productData = product.ok ? product.data : {};
  const northStar = asRecord(productData.north_star);
  const audience = asRecord(productData.audience);
  const engagement = asRecord(productData.engagement_7d);

  return [
    {
      key: 'users',
      label: 'Aktive Nutzer',
      value: formatNumberValue(toNumber(audience.wau)),
      sublabel: `MAU ${formatNumberValue(toNumber(audience.mau))}`,
      tone: 'blue',
    },
    {
      key: 'registrations',
      label: 'Neue Registrierungen',
      value: formatNumberValue(toNumber(adminStats.new_users_7d || audience.new_users_7d)),
      sublabel: 'letzte 7 Tage',
      tone: 'green',
    },
    {
      key: 'posts',
      label: 'Posts',
      value: formatNumberValue(toNumber(engagement.posts || adminStats.total_posts)),
      sublabel: engagement.posts === undefined ? 'gesamt' : 'letzte 7 Tage',
      tone: 'violet',
    },
    {
      key: 'north_star',
      label: 'North Star',
      value: formatNumberValue(toNumber(northStar.value)),
      sublabel: 'aktive Creator mit Engagement',
      tone: toNumber(northStar.value) > 0 ? 'amber' : 'red',
    },
  ];
}

function buildSupportInbox(result: SnapshotResult): CommandSupportInbox {
  if (!result.ok) {
    const missingModel = /function .*admin_support_snapshot|schema cache|not found/i.test(result.error);
    return emptySupportInbox(missingModel ? 'missing_model' : 'error', result.error);
  }
  if (typeof result.data.error === 'string') {
    return emptySupportInbox('error', result.data.error);
  }

  const threads = asRecord(result.data.threads);
  const latest = Array.isArray(result.data.latest) ? result.data.latest as SnapshotObject[] : [];

  return {
    status: 'ready',
    total: toNumber(threads.total),
    open: toNumber(threads.open),
    pending: toNumber(threads.pending),
    resolved_7d: toNumber(threads.resolved_7d),
    over_sla: toNumber(threads.over_sla),
    oldest_open_age_seconds: threads.oldest_open_age_seconds === null ? null : toNumber(threads.oldest_open_age_seconds),
    latest: latest.map((item) => ({
      id: String(item.id ?? ''),
      subject: String(item.subject ?? 'Supportfall ohne Betreff'),
      status: String(item.status ?? 'open'),
      priority: String(item.priority ?? 'medium'),
      source: String(item.source ?? 'manual'),
      username: typeof item.username === 'string' ? item.username : null,
      last_message_at: String(item.last_message_at ?? new Date().toISOString()),
      age_seconds: item.age_seconds === null || item.age_seconds === undefined ? null : toNumber(item.age_seconds),
    })),
  };
}

function emptySupportInbox(status: CommandSupportInbox['status'], error?: string): CommandSupportInbox {
  return {
    status,
    total: 0,
    open: 0,
    pending: 0,
    resolved_7d: 0,
    over_sla: 0,
    oldest_open_age_seconds: null,
    latest: [],
    error,
  };
}

async function readCommandActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CommandActivityItem[]> {
  const [posts, comments, reports] = await Promise.all([
    readRecentPosts(supabase),
    readRecentComments(supabase),
    readRecentReports(supabase),
  ]);

  return [...posts, ...comments, ...reports]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);
}

async function readRecentPosts(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CommandActivityItem[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, caption, created_at')
    .order('created_at', { ascending: false })
    .limit(4);
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: `post-${row.id}`,
    kind: 'post' as const,
    label: 'Neuer Post',
    detail: summarizeText(row.caption, `Post ${shortId(row.id)}`),
    created_at: row.created_at,
  }));
}

async function readRecentComments(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CommandActivityItem[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(4);
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: `comment-${row.id}`,
    kind: 'comment' as const,
    label: 'Neuer Kommentar',
    detail: summarizeText(row.content, `zu Post ${shortId(row.post_id)}`),
    created_at: row.created_at,
  }));
}

async function readRecentReports(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CommandActivityItem[]> {
  const { data, error } = await supabase
    .from('content_reports')
    .select('id, target_type, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(4);
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: `report-${row.id}`,
    kind: 'report' as const,
    label: 'Neue Meldung',
    detail: `${normalizeTargetType(row.target_type)} · ${row.reason || 'Ohne Grund'}`,
    created_at: row.created_at,
  }));
}

async function readModerationQueue(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CommandQueueItem[]> {
  const { data, error } = await supabase
    .from('content_reports')
    .select('id, target_type, target_id, reason, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(6);
  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    target_type: row.target_type,
    target_id: row.target_id,
    reason: row.reason || 'Ohne Grund',
    priority: moderationPriority(row.reason),
    wait_label: formatAgeLabel(row.created_at),
    created_at: row.created_at,
  }));
}

async function readTopContent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: { mediaType?: 'image' | 'video' } = {},
): Promise<CommandTopContentItem[]> {
  let query = supabase
    .from('posts')
    .select('id, caption, thumbnail_url, media_url, created_at, like_count, comment_count, view_count, author:profiles!posts_author_id_fkey(username)')
    .order('view_count', { ascending: false, nullsFirst: false })
    .limit(5);

  if (options.mediaType) {
    query = query.eq('media_type', options.mediaType);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((row) => {
    const views = toNumber(row.view_count);
    const likes = toNumber(row.like_count);
    const comments = toNumber(row.comment_count);
    const engagementEvents = likes + comments;

    return {
      id: row.id,
      title: summarizeText(row.caption, `Post ${shortId(row.id)}`),
      author_username: normalizeJoinedUsername(row.author),
      thumbnail_url: typeof row.thumbnail_url === 'string' && row.thumbnail_url.length > 0
        ? row.thumbnail_url
        : null,
      likes,
      comments,
      views,
      engagement_rate: views > 0 ? Number((engagementEvents / views).toFixed(4)) : null,
      created_at: row.created_at,
    };
  });
}

async function readTopStories(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CommandTopContentItem[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, user_id, media_url, thumbnail_url, media_type, created_at, author:profiles!stories_user_id_fkey(username), view_count:story_views(count)')
    .eq('archived', false)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return [];

  return (data ?? [])
    .map((row) => {
      const views = readAggregateCount(row.view_count);
      return {
        id: row.id,
        title: row.media_type === 'video' ? `Story Video ${shortId(row.id)}` : `Story ${shortId(row.id)}`,
        author_username: normalizeJoinedUsername(row.author),
        thumbnail_url: typeof row.thumbnail_url === 'string' && row.thumbnail_url.length > 0
          ? row.thumbnail_url
          : null,
        likes: 0,
        comments: 0,
        views,
        engagement_rate: null,
        created_at: row.created_at,
      };
    })
    .sort((a, b) => b.views - a.views || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
}

async function readGrowthSeries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dayCount: number,
): Promise<CommandGrowthPoint[]> {
  const days = lastNDays(dayCount);
  const start = `${days[0].date}T00:00:00.000Z`;

  const [
    profiles,
    posts,
    likes,
    comments,
    bookmarks,
    follows,
  ] = await Promise.all([
    readEventRows(supabase, 'profiles', 'id, created_at', start),
    readEventRows(supabase, 'posts', 'author_id, created_at', start),
    readEventRows(supabase, 'likes', 'user_id, created_at', start),
    readEventRows(supabase, 'comments', 'user_id, created_at', start),
    readEventRows(supabase, 'bookmarks', 'user_id, created_at', start),
    readEventRows(supabase, 'follows', 'follower_id, created_at', start),
  ]);

  const registrationsByDay = new Map<string, number>();
  for (const row of profiles) {
    if (typeof row.created_at !== 'string') continue;
    const day = dayKey(row.created_at);
    registrationsByDay.set(day, (registrationsByDay.get(day) ?? 0) + 1);
  }

  const activeUsersByDay = new Map<string, Set<string>>();
  const addActive = (createdAt: unknown, userId: unknown) => {
    if (typeof createdAt !== 'string' || typeof userId !== 'string') return;
    const day = dayKey(createdAt);
    if (!activeUsersByDay.has(day)) activeUsersByDay.set(day, new Set());
    activeUsersByDay.get(day)?.add(userId);
  };

  posts.forEach((row) => addActive(row.created_at, row.author_id));
  likes.forEach((row) => addActive(row.created_at, row.user_id));
  comments.forEach((row) => addActive(row.created_at, row.user_id));
  bookmarks.forEach((row) => addActive(row.created_at, row.user_id));
  follows.forEach((row) => addActive(row.created_at, row.follower_id));

  return days.map((day) => ({
    date: day.date,
    label: day.label,
    new_registrations: registrationsByDay.get(day.date) ?? 0,
    active_users: activeUsersByDay.get(day.date)?.size ?? 0,
  }));
}

async function readReportCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CommandReportCategory[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('content_reports')
    .select('reason, created_at')
    .gte('created_at', since)
    .limit(500);
  if (error) return [];

  const labels: Record<string, string> = {
    spam: 'Spam',
    hate: 'Hassrede',
    violence: 'Gewalt & Extremismus',
    nsfw: 'Nacktheit / NSFW',
    copyright: 'Copyright',
    misinformation: 'Fehlinformation',
    other: 'Sonstiges',
  };
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = reportCategoryKey(row.reason);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);

  return Object.entries(labels)
    .map(([key, label]) => {
      const count = counts.get(key) ?? 0;
      return {
        key,
        label,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    })
    .filter((category) => category.count > 0);
}

function buildIntegrityArea(result: Awaited<ReturnType<typeof readRpcSnapshot>>): CommandCenterArea {
  if (!result.ok) return failedArea('data-lifecycle', 'Data Lifecycle', result.error);
  const queue = asRecord(result.data.r2_delete_queue);
  const posts = asRecord(result.data.posts);
  const cron = asRecord(result.data.cron);
  const jobs = Array.isArray(cron.jobs) ? cron.jobs as CronJobSnapshot[] : [];
  const r2CronActive = jobs.some((job) => job.jobname === 'r2-delete-queue' && job.active === true);
  const pending = toNumber(queue.pending);
  const errors = toNumber(queue.error);
  const emptyPosts = toNumber(posts.empty_content);
  const status = errors > 0 || emptyPosts > 0 || !cron.available || !r2CronActive
    ? 'red'
    : pending > 0
      ? 'yellow'
      : 'green';

  return {
    key: 'data-lifecycle',
    label: 'Data Lifecycle',
    status,
    summary: `R2 Queue ${pending}/${errors}, leere Posts ${emptyPosts}, Cron ${r2CronActive ? 'aktiv' : 'prüfen'}`,
    detail: {
      pending_r2_deletes: pending,
      r2_delete_errors: errors,
      empty_posts: emptyPosts,
      cron_available: Boolean(cron.available),
      r2_delete_cron_active: r2CronActive,
    },
  };
}

function buildProductArea(result: Awaited<ReturnType<typeof readRpcSnapshot>>): CommandCenterArea {
  if (!result.ok) return failedArea('product', 'Product Health', result.error);
  const northStar = asRecord(result.data.north_star);
  const audience = asRecord(result.data.audience);
  const retention = asRecord(result.data.retention);
  const value = toNumber(northStar.value);
  const activeCreators = toNumber(northStar.active_creators_7d);
  const status = value <= 0 ? 'yellow' : 'green';

  return {
    key: 'product',
    label: 'Product Health',
    status,
    summary: `North Star ${value}, Creator 7d ${activeCreators}, WAU/MAU ${toNumber(audience.wau)}/${toNumber(audience.mau)}`,
    href: '/admin/activation',
    detail: {
      north_star: value,
      active_creators_7d: activeCreators,
      wau: toNumber(audience.wau),
      mau: toNumber(audience.mau),
      d7_retained: toNumber(retention.d7_retained),
      d7_cohort: toNumber(retention.d7_cohort),
      next_action: value <= 0 ? 'Creator Activation Review' : 'Weekly Product Review',
    },
  };
}

function buildCostArea(result: Awaited<ReturnType<typeof readRpcSnapshot>>): CommandCenterArea {
  if (!result.ok) return failedArea('cost', 'Cost Health', result.error);
  const unit = asRecord(result.data.unit_economics);
  const live = asRecord(result.data.live);
  const media = asRecord(result.data.media);
  const trackedCost = toNumber(unit.tracked_cost_cents_month);
  const perMau = toNumber(unit.tracked_cost_cents_per_mau);
  const liveMinutes = toNumber(live.minutes_month);
  const mediaObjects = toNumber(media.referenced_media_objects);
  const critical =
    trackedCost >= 2500 ||
    perMau >= 200 ||
    liveMinutes >= 1000 ||
    mediaObjects >= 10000;
  const warning =
    trackedCost >= 1750 ||
    perMau >= 140 ||
    liveMinutes >= 700 ||
    mediaObjects >= 7000;

  return {
    key: 'cost',
    label: 'Cost Health',
    status: critical ? 'red' : warning ? 'yellow' : 'green',
    summary: `Tracked ${formatMoneyCents(trackedCost)}, pro MAU ${formatMoneyCents(perMau)}, Live ${liveMinutes} min`,
    detail: {
      tracked_cost_cents_month: trackedCost,
      tracked_cost_cents_per_mau: perMau,
      live_minutes_month: liveMinutes,
      r2_media_objects: mediaObjects,
    },
  };
}

function buildModerationArea(result: Awaited<ReturnType<typeof readRpcSnapshot>>): CommandCenterArea {
  if (!result.ok) return failedArea('moderation', 'Trust & Moderation', result.error, '/admin/reports');
  const reports = asRecord(result.data.content_reports);
  const legacy = asRecord(result.data.legacy_unqueued);
  const audit = asRecord(result.data.admin_audit);
  const pending = toNumber(reports.pending);
  const overSla = toNumber(reports.pending_over_sla);
  const legacyTotal = toNumber(legacy.total);
  const status = overSla > 0 || legacyTotal > 0 ? 'red' : pending > 0 ? 'yellow' : 'green';

  return {
    key: 'moderation',
    label: 'Trust & Moderation',
    status,
    summary: `Reports ${pending}, über SLA ${overSla}, Legacy ${legacyTotal}`,
    href: '/admin/reports',
    detail: {
      pending_reports: pending,
      pending_over_sla: overSla,
      legacy_unqueued: legacyTotal,
      audit_events_7d: toNumber(audit.moderation_events_7d),
    },
  };
}

function buildPushFeedArea(result: Awaited<ReturnType<typeof readRpcSnapshot>>): CommandCenterArea {
  if (!result.ok) return failedArea('push-feed', 'Push & Feed', result.error);
  const push = asRecord(result.data.push);
  const feed = asRecord(result.data.feed);
  const nativeTokens = asRecord(push.native_tokens);
  const webSubscriptions = asRecord(push.web_subscriptions);
  const notifications = asRecord(push.notifications);
  const unreadByType = asRecord(notifications.by_type_unread);
  const recipientBacklog = asRecord(notifications.recipient_backlog);
  const totalPosts = toNumber(feed.public_posts_total);
  const videosMissingThumb = toNumber(feed.public_video_posts_without_thumbnail);
  const unread = toNumber(notifications.unread_total);
  const unread30dPlus = toNumber(notifications.unread_30d_plus);
  const unread60dPlus = toNumber(notifications.unread_60d_plus);
  const unread90dPlus = toNumber(notifications.unread_90d_plus);
  const usersWithUnread = toNumber(recipientBacklog.users_with_unread);
  const maxUnreadForOneUser = toNumber(recipientBacklog.max_unread_for_one_user);
  const liveUnread = toNumber(unreadByType.live);
  const topUnreadType = topObjectCountLabel(unreadByType);
  const status =
    totalPosts < 3 || videosMissingThumb > 0
      ? 'red'
      : unread > 500 || unread60dPlus > 0 || maxUnreadForOneUser > 100
        ? 'yellow'
        : 'green';
  const backlogSummary = unread30dPlus > 0 || maxUnreadForOneUser > 0
    ? `, Unread ${unread} (${unread30dPlus} >30d, max/user ${maxUnreadForOneUser})`
    : `, Unread ${unread}`;

  return {
    key: 'push-feed',
    label: 'Push & Feed',
    status,
    summary: `Public Posts ${totalPosts}, Videos ohne Thumbnail ${videosMissingThumb}${backlogSummary}`,
    href: '/admin/command-center',
    detail: {
      public_posts_total: totalPosts,
      public_video_posts_without_thumbnail: videosMissingThumb,
      unread_notifications: unread,
      unread_30d_plus: unread30dPlus,
      unread_60d_plus: unread60dPlus,
      unread_90d_plus: unread90dPlus,
      unread_users: usersWithUnread,
      max_unread_for_one_user: maxUnreadForOneUser,
      top_unread_type: topUnreadType,
      live_unread: liveUnread,
      native_tokens_total: toNumber(nativeTokens.total),
      web_subscriptions_total: toNumber(webSubscriptions.total),
      next_action: liveUnread > unread / 2
        ? 'Live Notification Backlog Review'
        : unread > 500
          ? 'Unread Backlog Review'
          : 'Push Token Review',
    },
  };
}

function buildReleaseArea(): CommandCenterArea {
  return {
    key: 'release',
    label: 'Release & Governance',
    status: 'green',
    summary: 'Release Gate, Weekly Integrity und Feature Freeze sind als CI-Prozess aktiv.',
    detail: {
      release_gate: 'npm run release:gate',
      weekly_integrity: 'weekly-integrity.yml',
      feature_freeze: 'npm run feature:freeze',
    },
  };
}

function failedArea(key: string, label: string, error: string, href?: string): CommandCenterArea {
  return {
    key,
    label,
    status: 'red',
    summary: error,
    href,
    detail: {},
  };
}

function rollupStatus(areas: CommandCenterArea[]): 'green' | 'yellow' | 'red' {
  if (areas.some((area) => area.status === 'red')) return 'red';
  if (areas.some((area) => area.status === 'yellow')) return 'yellow';
  return 'green';
}

function formatMoneyCents(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`;
}

function formatNumberValue(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}

function summarizeText(value: string | null | undefined, fallback: string): string {
  const text = value?.trim();
  if (!text) return fallback;
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function shortId(value: string | null | undefined): string {
  if (!value) return 'unbekannt';
  return value.slice(0, 8);
}

function normalizeTargetType(value: string | null | undefined): string {
  switch (value) {
    case 'post':
      return 'Post';
    case 'profile':
      return 'Profil';
    case 'comment':
      return 'Kommentar';
    case 'live':
      return 'Live';
    case 'product':
      return 'Produkt';
    default:
      return value || 'Inhalt';
  }
}

function moderationPriority(reason: string | null | undefined): CommandQueueItem['priority'] {
  const normalized = (reason || '').toLowerCase();
  if (
    normalized.includes('hate') ||
    normalized.includes('gewalt') ||
    normalized.includes('violence') ||
    normalized.includes('nsfw') ||
    normalized.includes('harassment')
  ) {
    return 'Hoch';
  }
  if (normalized.includes('spam') || normalized.includes('copyright') || normalized.includes('misinformation')) {
    return 'Mittel';
  }
  return 'Niedrig';
}

async function readAdminUserManagementStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AdminUserManagementStats> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    profiles,
    newUsers,
    verified,
    banned,
    restricted,
    pendingReports,
    activePosts,
    activeComments,
    activeLikes,
    activeBookmarks,
    activeFollows,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', since30d),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_verified', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_banned', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_restricted', true),
    supabase.from('content_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    readEventRows(supabase, 'posts', 'author_id, created_at', since30d),
    readEventRows(supabase, 'comments', 'user_id, created_at', since30d),
    readEventRows(supabase, 'likes', 'user_id, created_at', since30d),
    readEventRows(supabase, 'bookmarks', 'user_id, created_at', since30d),
    readEventRows(supabase, 'follows', 'follower_id, created_at', since30d),
  ]);

  const activeIds = new Set<string>();
  activePosts.forEach((row) => addString(activeIds, row.author_id));
  activeComments.forEach((row) => addString(activeIds, row.user_id));
  activeLikes.forEach((row) => addString(activeIds, row.user_id));
  activeBookmarks.forEach((row) => addString(activeIds, row.user_id));
  activeFollows.forEach((row) => addString(activeIds, row.follower_id));

  return {
    total_users: profiles.count ?? 0,
    active_users_30d: activeIds.size,
    new_users_30d: newUsers.count ?? 0,
    verified_users: verified.count ?? 0,
    banned_users: banned.count ?? 0,
    pending_reports: pendingReports.count ?? 0,
    restricted_users: restricted.count ?? 0,
  };
}

async function readCountsByUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  userColumn: string,
  userIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (userIds.length === 0) return counts;

  const { data, error } = await supabase
    .from(table)
    .select(userColumn)
    .in(userColumn, userIds)
    .limit(5000);
  if (error) return counts;

  for (const row of (data ?? []) as unknown as SnapshotObject[]) {
    const value = row[userColumn];
    if (typeof value !== 'string') continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

async function readReportCountsByUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (userIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('content_reports')
    .select('target_id')
    .eq('target_type', 'profile')
    .in('target_id', userIds)
    .limit(5000);
  if (error) return counts;

  for (const row of (data ?? []) as SnapshotObject[]) {
    const value = row.target_id;
    if (typeof value !== 'string') continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

async function readLastActivityByUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  if (userIds.length === 0) return latest;

  const [posts, comments, likes, bookmarks, follows] = await Promise.all([
    readUserActivityRows(supabase, 'posts', 'author_id', userIds),
    readUserActivityRows(supabase, 'comments', 'user_id', userIds),
    readUserActivityRows(supabase, 'likes', 'user_id', userIds),
    readUserActivityRows(supabase, 'bookmarks', 'user_id', userIds),
    readUserActivityRows(supabase, 'follows', 'follower_id', userIds),
  ]);

  for (const row of [...posts, ...comments, ...likes, ...bookmarks, ...follows]) {
    const userId = row.user_id;
    const createdAt = row.created_at;
    if (typeof userId !== 'string' || typeof createdAt !== 'string') continue;
    const previous = latest.get(userId);
    if (!previous || new Date(createdAt).getTime() > new Date(previous).getTime()) {
      latest.set(userId, createdAt);
    }
  }
  return latest;
}

async function readUserActivityRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  userColumn: string,
  userIds: string[],
): Promise<Array<{ user_id: string; created_at: string }>> {
  const { data, error } = await supabase
    .from(table)
    .select(`${userColumn}, created_at`)
    .in(userColumn, userIds)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return [];

  return ((data ?? []) as unknown as SnapshotObject[])
    .map((row) => ({
      user_id: typeof row[userColumn] === 'string' ? row[userColumn] : '',
      created_at: typeof row.created_at === 'string' ? row.created_at : '',
    }))
    .filter((row) => row.user_id && row.created_at);
}

async function readEventRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  columns: string,
  start: string,
): Promise<SnapshotObject[]> {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .gte('created_at', start)
    .limit(1000);
  if (error) return [];
  return (data ?? []) as unknown as SnapshotObject[];
}

function emptyAdminUsersPageSnapshot(): AdminUsersPageSnapshot {
  const directory = emptyAdminUserDirectoryPage(1, 20);

  return {
    generated_at: new Date().toISOString(),
    stats: {
      total_users: 0,
      active_users_30d: 0,
      new_users_30d: 0,
      verified_users: 0,
      banned_users: 0,
      pending_reports: 0,
      restricted_users: 0,
    },
    users: [],
    directory,
  };
}

type NormalizedAdminUserDirectoryQuery = {
  query: string;
  status: AdminUserStatusFilter;
  role: AdminUserRoleFilter;
  verification: AdminUserVerificationFilter;
  activity: AdminUserActivityFilter;
  risk: AdminUserRiskFilter;
  page: number;
  pageSize: number;
};

function emptyAdminUserDirectoryPage(page: number, pageSize: number): AdminUserDirectoryPage {
  return {
    users: [],
    page,
    page_size: pageSize,
    total_count: 0,
    has_more: false,
  };
}

function normalizeAdminUserDirectoryQuery(input: AdminUserDirectoryQuery): NormalizedAdminUserDirectoryQuery {
  return {
    query: String(input.query ?? '').trim().slice(0, 120),
    status: pickAdminFilter(input.status, ['all', 'active', 'restricted', 'banned'], 'all'),
    role: pickAdminFilter(input.role, ['all', 'admin', 'moderator', 'operator', 'creator_ops', 'creator', 'user'], 'all'),
    verification: pickAdminFilter(input.verification, ['all', 'verified', 'unverified'], 'all'),
    activity: pickAdminFilter(input.activity, ['all', 'active_30d', 'inactive_30d'], 'all'),
    risk: pickAdminFilter(input.risk, ['all', 'low', 'medium', 'high'], 'all'),
    page: clampInteger(input.page, 1, 500, 1),
    pageSize: clampInteger(input.pageSize, 10, 100, 20),
  };
}

function pickAdminFilter<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function normalizeAdminUserDirectoryPage(
  rows: SnapshotObject[],
  page: number,
  pageSize: number,
): AdminUserDirectoryPage {
  const users = rows.map(normalizeAdminUserDirectoryRow).filter((user) => user.id && user.username);
  const totalCount = rows.length > 0 ? toNumber(rows[0].total_count) : 0;

  return {
    users,
    page,
    page_size: pageSize,
    total_count: totalCount,
    has_more: page * pageSize < totalCount,
  };
}

function normalizeAdminUserDirectoryRow(row: SnapshotObject): AdminUserDirectoryItem {
  return {
    id: String(row.id ?? ''),
    username: String(row.username ?? ''),
    display_name: stringOrNull(row.display_name),
    avatar_url: stringOrNull(row.avatar_url),
    is_verified: Boolean(row.is_verified),
    is_admin: Boolean(row.is_admin),
    is_moderator: Boolean(row.is_moderator),
    is_operator: Boolean(row.is_operator),
    is_creator_ops: Boolean(row.is_creator_ops),
    is_banned: Boolean(row.is_banned),
    is_restricted: Boolean(row.is_restricted),
    restricted_until: stringOrNull(row.restricted_until),
    is_shadow_banned: Boolean(row.is_shadow_banned),
    women_only_verified: Boolean(row.women_only_verified),
    is_creator: Boolean(row.is_creator),
    created_at: String(row.created_at ?? new Date(0).toISOString()),
    post_count: toNumber(row.post_count),
    follower_count: toNumber(row.follower_count),
    comment_count: toNumber(row.comment_count),
    report_count: toNumber(row.report_count),
    last_activity_at: stringOrNull(row.last_activity_at),
    risk_level: normalizeRiskLevel(row.risk_level),
  };
}

function normalizeRiskLevel(value: unknown): AdminUserDirectoryItem['risk_level'] {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function adminUserStatusKey(user: AdminUserDirectoryItem): AdminUserStatusFilter {
  if (user.is_banned) return 'banned';
  if (user.is_restricted || user.is_shadow_banned) return 'restricted';
  return 'active';
}

function adminUserRoleKey(user: AdminUserDirectoryItem): AdminUserRoleFilter {
  if (user.is_admin) return 'admin';
  if (user.is_moderator) return 'moderator';
  if (user.is_operator) return 'operator';
  if (user.is_creator_ops) return 'creator_ops';
  if (user.is_creator) return 'creator';
  return 'user';
}

function adminUserActivityKey(user: AdminUserDirectoryItem): AdminUserActivityFilter {
  if (!user.last_activity_at) return 'inactive_30d';
  const activityWindowMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(user.last_activity_at).getTime() <= activityWindowMs
    ? 'active_30d'
    : 'inactive_30d';
}

function addString(target: Set<string>, value: unknown) {
  if (typeof value === 'string' && value.length > 0) target.add(value);
}

async function recordAdminUserAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  await supabase.rpc('admin_record_user_action', {
    p_target_user_id: userId,
    p_action: action,
    p_metadata: metadata,
  });
}

async function getRequestOrigin(): Promise<string> {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (envOrigin) return envOrigin;

  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

async function applyInvitedUserRole(
  adminClient: AdminServiceClient,
  userId: string,
  role: string,
) {
  const rolePatch = inviteRolePatch(role);
  if (Object.keys(rolePatch).length > 0) {
    await adminClient.from('profiles').update(rolePatch).eq('id', userId);
  }
}

function inviteRolePatch(role: string): Record<string, boolean> {
  return {
    is_creator: role === 'creator',
    is_moderator: role === 'moderator',
    is_operator: role === 'operator',
    is_creator_ops: role === 'creator_ops',
  };
}

function normalizeAdminUserDetailSnapshot(data: SnapshotObject): AdminUserDetailSnapshot {
  const identity = asRecord(data.identity);
  const auditRows = Array.isArray(data.audit) ? data.audit : [];

  return {
    generated_at: typeof data.generated_at === 'string' ? data.generated_at : null,
    identity: {
      email: stringOrNull(identity.email),
      email_confirmed_at: stringOrNull(identity.email_confirmed_at),
      phone: stringOrNull(identity.phone),
      phone_confirmed_at: stringOrNull(identity.phone_confirmed_at),
      last_sign_in_at: stringOrNull(identity.last_sign_in_at),
      confirmed_at: stringOrNull(identity.confirmed_at),
      banned_until: stringOrNull(identity.banned_until),
      mfa_enabled: typeof identity.mfa_enabled === 'boolean' ? identity.mfa_enabled : null,
    },
    audit: auditRows.map((row) => normalizeAdminUserAuditItem(asRecord(row))).filter(Boolean),
  };
}

function normalizeAdminUserAuditItem(row: SnapshotObject): AdminUserAuditItem {
  return {
    id: String(row.id ?? ''),
    action: String(row.action ?? ''),
    target_type: String(row.target_type ?? ''),
    target_id: stringOrNull(row.target_id),
    metadata: asRecord(row.metadata),
    created_at: String(row.created_at ?? ''),
    actor_id: stringOrNull(row.actor_id),
    actor_username: stringOrNull(row.actor_username),
    actor_display_name: stringOrNull(row.actor_display_name),
  };
}

function lastNDays(count: number): { date: string; label: string }[] {
  const formatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (count - 1 - index));
    return {
      date: date.toISOString().slice(0, 10),
      label: formatter.format(date),
    };
  });
}

function dayKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function reportCategoryKey(reason: string | null | undefined): string {
  const normalized = (reason || '').toLowerCase();
  if (normalized.includes('spam')) return 'spam';
  if (normalized.includes('hate') || normalized.includes('hass')) return 'hate';
  if (normalized.includes('violence') || normalized.includes('gewalt') || normalized.includes('extrem')) return 'violence';
  if (normalized.includes('nsfw') || normalized.includes('nackt') || normalized.includes('sexual')) return 'nsfw';
  if (normalized.includes('copyright') || normalized.includes('urheber')) return 'copyright';
  if (normalized.includes('misinformation') || normalized.includes('fehl')) return 'misinformation';
  return 'other';
}

function positiveInteger(value: FormDataEntryValue | null): number {
  const number = Number(String(value ?? '0').replace(',', '.'));
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

function eurosToCents(value: FormDataEntryValue | null): number {
  const number = Number(String(value ?? '0').replace(',', '.'));
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

function formatAgeLabel(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function asRecord(value: unknown): SnapshotObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SnapshotObject : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function normalizeJoinedUsername(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  const username = asRecord(row).username;
  return typeof username === 'string' && username.length > 0 ? username : null;
}

function readAggregateCount(value: unknown): number {
  if (Array.isArray(value)) {
    return toNumber(asRecord(value[0]).count);
  }
  return toNumber(asRecord(value).count);
}

function topObjectCountLabel(value: SnapshotObject): string {
  const entries = Object.entries(value)
    .map(([key, count]) => [key, toNumber(count)] as const)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return 'none';
  const [key, count] = entries[0];
  return `${key} (${count})`;
}

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
