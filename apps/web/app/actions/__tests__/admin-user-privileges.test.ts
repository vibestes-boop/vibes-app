/**
 * @jest-environment node
 *
 * Admin-Konsole: Rollen, Sperren, Haken — die fünf Server-Actions laufen über
 * SECURITY-DEFINER-RPCs (20261014160000_admin_profile_privilege_rpcs.sql).
 *
 * Bis 14.10.2026 schrieben sie per `.from('profiles').update()` mit der
 * Admin-Sitzung. RLS lässt nur das eigene Profil zu → 0 Zeilen, kein Fehler,
 * die Konsole meldete trotzdem Erfolg. Diese Tests halten fest:
 *   - jede Aktion ruft genau ihre RPC mit den richtigen Argumenten,
 *   - kein direktes Update auf profiles,
 *   - Fehler der RPC kommen als verständlicher Text an,
 *   - ohne `success: true` der Datenbank gibt es keinen Erfolg.
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ getAll: () => [], set: jest.fn() }),
  headers: jest.fn().mockResolvedValue(new Map()),
}));

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  adminBanUser,
  adminSetUserRole,
  adminSetUserSafetyState,
  adminToggleAdmin,
  adminVerifyUser,
} from '../admin';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

const ADMIN_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const TARGET_ID = 'bbbbbbbb-0000-4000-8000-000000000002';

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

interface ProfileBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  update: jest.Mock;
  maybeSingle: jest.Mock;
}

function makeSupabaseMock({
  isAdmin = true,
  rpcResult = { data: { success: true }, error: null },
}: { isAdmin?: boolean; rpcResult?: RpcResult } = {}) {
  const update = jest.fn();
  const rpc = jest.fn().mockResolvedValue(rpcResult);
  const from = jest.fn(() => {
    // Nur für getAdminRoleStatus: select(...).eq(...).maybeSingle()
    const builder: ProfileBuilder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      update,
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          username: 'admin',
          display_name: null,
          avatar_url: null,
          is_admin: isAdmin,
          is_moderator: !isAdmin,
          is_operator: false,
          is_creator_ops: false,
        },
        error: null,
      }),
    };
    return builder;
  });
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: ADMIN_ID } } }) },
    from,
    rpc,
  };
  mockCreateClient.mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);
  return { client, rpc, update };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Admin-Profil-Aktionen → RPCs', () => {
  it.each([
    ['adminSetUserRole', 'admin_set_user_role', { p_user_id: TARGET_ID, p_role: 'creator' }, () => adminSetUserRole(TARGET_ID, 'creator')],
    ['adminBanUser', 'admin_set_user_banned', { p_user_id: TARGET_ID, p_banned: true }, () => adminBanUser(TARGET_ID, true)],
    ['adminVerifyUser', 'admin_set_user_verified', { p_user_id: TARGET_ID, p_verified: false }, () => adminVerifyUser(TARGET_ID, false)],
    ['adminToggleAdmin', 'admin_set_user_admin', { p_user_id: TARGET_ID, p_is_admin: true }, () => adminToggleAdmin(TARGET_ID, true)],
    ['adminSetUserSafetyState', 'admin_set_user_safety_state', { p_user_id: TARGET_ID, p_action: 'restrict' }, () => adminSetUserSafetyState(TARGET_ID, 'restrict')],
  ] as const)('%s ruft genau %s und schreibt nicht direkt in profiles', async (_name, fn, args, run) => {
    const { rpc, update } = makeSupabaseMock();

    const result = await run();

    expect(result).toEqual({ ok: true });
    // Genau ein RPC-Aufruf: Das Audit schreibt die RPC selbst, kein
    // zusätzliches admin_record_user_action mehr.
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(fn, args);
    expect(update).not.toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/users');
  });

  it('meldet keinen Erfolg, wenn die Datenbank nichts bestätigt (früher: 0 Zeilen = „Rolle gesetzt“)', async () => {
    makeSupabaseMock({ rpcResult: { data: null, error: null } });

    const result = await adminSetUserRole(TARGET_ID, 'creator');

    expect(result).toEqual({ ok: false, error: 'Die Änderung wurde nicht gespeichert.' });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ['not_admin', 'Keine ausreichende Berechtigung.'],
    ['cannot_demote_self', 'Du kannst dir nicht selbst Admin-Rechte entziehen.'],
    ['cannot_sanction_self', 'Du kannst dich nicht selbst sperren oder einschränken.'],
    ['profile_not_found', 'Nutzer nicht gefunden.'],
  ])('übersetzt den RPC-Fehler %s', async (code, text) => {
    makeSupabaseMock({ rpcResult: { data: null, error: { code: '42501', message: code } } });

    const result = await adminBanUser(TARGET_ID, true);

    expect(result).toEqual({ ok: false, error: text });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('reicht unbekannte Fehler im Wortlaut durch (z. B. fehlende Migration)', async () => {
    makeSupabaseMock({
      rpcResult: {
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.admin_set_user_role' },
      },
    });

    const result = await adminSetUserRole(TARGET_ID, 'creator');

    expect(result).toEqual({ ok: false, error: 'Could not find the function public.admin_set_user_role' });
  });

  it('lehnt Selbst-Herabstufung schon vor der RPC ab', async () => {
    const { rpc } = makeSupabaseMock();

    const result = await adminSetUserRole(ADMIN_ID, 'creator');

    expect(result).toEqual({ ok: false, error: 'Du kannst dir nicht selbst Admin-Rechte entziehen.' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('ruft für Nicht-Admins gar keine RPC', async () => {
    const { rpc } = makeSupabaseMock({ isAdmin: false });

    const result = await adminVerifyUser(TARGET_ID, true);

    expect(result).toEqual({ ok: false, error: 'Keine ausreichende Berechtigung.' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
