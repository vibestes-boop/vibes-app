/**
 * @jest-environment node
 *
 * updateProfile Server-Action — v1.w.UI.20.
 *
 * Scope: Auth-Gate, Input-Validierung (display_name required/max-60, bio
 * max-200), Whitelist-Write (username + avatar_url werden NIE angefasst),
 * Bio-empty → NULL-Coerce, Supabase-Error-Pass-Through, revalidatePath-
 * Aufrufe.
 *
 * Alle Server-Deps (`@/lib/auth/session`, `@/lib/supabase/server`, `next/cache`)
 * sind gemockt — keine Runtime-Abhängigkeiten.
 */

// -----------------------------------------------------------------------------
// Mocks — MÜSSEN vor den Imports aus dem SUT stehen.
// -----------------------------------------------------------------------------

jest.mock('@/lib/auth/session', () => ({
  getUser: jest.fn(),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

// next/headers wird indirekt von supabase/server gezogen — der createClient-Mock
// oben fängt den Aufruf ab, aber defense-in-depth: cookies() no-op.
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}));

import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { updateProfile, updateAvatar } from '../profile';

const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

// -----------------------------------------------------------------------------
// Mini-Supabase-Mock für den Update-Pfad. Wir brauchen nur `from().update().eq()`.
// Die letzte Methode (`eq`) ist thenable — await gibt `{ error }` zurück.
// -----------------------------------------------------------------------------

interface UpdateBuilder {
  _updatePayload: unknown;
  _eqCalls: Array<[string, unknown]>;
  update: jest.Mock;
  eq: jest.Mock;
  then: (onFulfilled: (value: { error: unknown }) => unknown) => Promise<unknown>;
}

function makeSupabaseMock(errorForUpdate: { message: string } | null = null): {
  client: { from: jest.Mock };
  lastBuilder: () => UpdateBuilder | null;
} {
  let lastBuilder: UpdateBuilder | null = null;

  const client = {
    from: jest.fn((_table: string) => {
      const builder: UpdateBuilder = {
        _updatePayload: undefined,
        _eqCalls: [],
        update: jest.fn((payload: unknown) => {
          builder._updatePayload = payload;
          return builder;
        }),
        eq: jest.fn((col: string, val: unknown) => {
          builder._eqCalls.push([col, val]);
          return builder;
        }),
        then: (onFulfilled) =>
          Promise.resolve({ error: errorForUpdate }).then(onFulfilled),
      };
      lastBuilder = builder;
      return builder;
    }),
  };

  return { client, lastBuilder: () => lastBuilder };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// -----------------------------------------------------------------------------
// Helper: FormData mit beliebigen Feldern
// -----------------------------------------------------------------------------
function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe('updateProfile — Auth-Gate', () => {
  it('returns { ok: false } when no user is logged in', async () => {
    mockGetUser.mockResolvedValue(null);

    const result = await updateProfile(makeFormData({ display_name: 'Alice', bio: '' }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});

describe('updateProfile — Input-Validierung', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ id: 'user-1' } as never);
  });

  it('rejects empty display_name', async () => {
    const result = await updateProfile(makeFormData({ display_name: '   ', bio: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('display_name');
    }
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects display_name > 60 chars', async () => {
    const result = await updateProfile(
      makeFormData({ display_name: 'x'.repeat(61), bio: '' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('display_name');
    }
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects bio > 200 chars', async () => {
    const result = await updateProfile(
      makeFormData({ display_name: 'Alice', bio: 'x'.repeat(201) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('bio');
    }
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('accepts display_name at exactly 60 chars + bio at exactly 200 chars', async () => {
    const { client } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updateProfile(
      makeFormData({ display_name: 'x'.repeat(60), bio: 'y'.repeat(200) }),
    );

    expect(result).toEqual({ ok: true, data: null });
  });
});

describe('updateProfile — Write-Pfad', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ id: 'user-42' } as never);
  });

  it('writes display_name + bio to profiles row scoped by id = user.id', async () => {
    const { client, lastBuilder } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    await updateProfile(makeFormData({ display_name: '  Alice  ', bio: 'hello world' }));

    expect(client.from).toHaveBeenCalledWith('profiles');
    const builder = lastBuilder();
    expect(builder).not.toBeNull();
    // display_name wird getrimmt
    expect(builder!._updatePayload).toEqual({
      display_name: 'Alice',
      bio: 'hello world',
    });
    expect(builder!._eqCalls).toEqual([['id', 'user-42']]);
  });

  it('coerces empty trimmed bio to null (so DB does not store "")', async () => {
    const { client, lastBuilder } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    await updateProfile(makeFormData({ display_name: 'Alice', bio: '    ' }));

    const builder = lastBuilder()!;
    expect(builder._updatePayload).toEqual({
      display_name: 'Alice',
      bio: null,
    });
  });

  it('does NOT write username or avatar_url even if passed in FormData', async () => {
    const { client, lastBuilder } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    const fd = makeFormData({ display_name: 'Alice', bio: 'hi' });
    // Malicious extra fields — must be ignored by the action.
    fd.set('username', 'admin');
    fd.set('avatar_url', 'https://evil.example/x.png');

    await updateProfile(fd);

    const payload = lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(payload).not.toHaveProperty('username');
    expect(payload).not.toHaveProperty('avatar_url');
    expect(Object.keys(payload).sort()).toEqual(['bio', 'display_name']);
  });

  it('returns Supabase error message when update fails', async () => {
    const { client } = makeSupabaseMock({ message: 'duplicate key' });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updateProfile(makeFormData({ display_name: 'Alice', bio: '' }));

    expect(result).toEqual({ ok: false, error: 'duplicate key' });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateProfile — Cache-Invalidation', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ id: 'user-9' } as never);
  });

  it('revalidates /settings/profile + layout + /u/[username] on success', async () => {
    const { client } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    await updateProfile(makeFormData({ display_name: 'Alice', bio: 'hi' }));

    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/profile');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/u/[username]', 'page');
  });

  it('does NOT revalidate when validation fails', async () => {
    const result = await updateProfile(makeFormData({ display_name: '', bio: '' }));
    expect(result.ok).toBe(false);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// v1.w.UI.21 — updateAvatar (Avatar-Upload-Save)
// -----------------------------------------------------------------------------

describe('updateAvatar — Auth-Gate', () => {
  it('returns { ok: false } when no user is logged in', async () => {
    mockGetUser.mockResolvedValue(null);

    const result = await updateAvatar('https://pub-abc.r2.dev/avatars/user-1/123.jpg');

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});

describe('updateAvatar — URL-Allowlist', () => {
  const USER_ID = 'user-42';

  beforeEach(() => {
    mockGetUser.mockResolvedValue({ id: USER_ID } as never);
  });

  it('accepts valid r2.dev public URL with correct /avatars/{userId}/ path', async () => {
    const { client, lastBuilder } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    const url = `https://pub-abc123.r2.dev/avatars/${USER_ID}/1712345678.webp`;
    const result = await updateAvatar(url);

    expect(result).toEqual({ ok: true, data: null });
    expect(lastBuilder()!._updatePayload).toEqual({ avatar_url: url });
    expect(lastBuilder()!._eqCalls).toEqual([['id', USER_ID]]);
  });

  it('accepts valid r2.cloudflarestorage.com URL', async () => {
    const { client } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    const url = `https://myaccount.r2.cloudflarestorage.com/vibes-media/avatars/${USER_ID}/42.jpg`;
    const result = await updateAvatar(url);

    expect(result.ok).toBe(true);
  });

  it('accepts valid supabase.co storage URL', async () => {
    const { client } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    const url = `https://project.supabase.co/storage/v1/object/public/avatars/${USER_ID}/img.png`;
    const result = await updateAvatar(url);

    expect(result.ok).toBe(true);
  });

  it('rejects URL with http:// (non-HTTPS)', async () => {
    const url = `http://pub-abc.r2.dev/avatars/${USER_ID}/42.jpg`;
    const result = await updateAvatar(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('avatar_url');
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects URL with non-allowed host', async () => {
    const url = `https://evil.example/avatars/${USER_ID}/42.jpg`;
    const result = await updateAvatar(url);
    expect(result.ok).toBe(false);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects URL without /avatars/{userId}/ path (cross-user steal)', async () => {
    const url = 'https://pub-abc.r2.dev/avatars/other-user-id/42.jpg';
    const result = await updateAvatar(url);
    expect(result.ok).toBe(false);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects URL pointing at posts/ instead of avatars/', async () => {
    const url = `https://pub-abc.r2.dev/posts/images/${USER_ID}/42.jpg`;
    const result = await updateAvatar(url);
    expect(result.ok).toBe(false);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects malformed URL', async () => {
    const result = await updateAvatar('not a url');
    expect(result.ok).toBe(false);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects empty string', async () => {
    const result = await updateAvatar('');
    expect(result.ok).toBe(false);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects URL longer than 2048 chars', async () => {
    const url = `https://pub-abc.r2.dev/avatars/${USER_ID}/${'x'.repeat(2100)}.jpg`;
    const result = await updateAvatar(url);
    expect(result.ok).toBe(false);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});

describe('updateAvatar — Remove (null)', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ id: 'user-7' } as never);
  });

  it('accepts null → writes avatar_url: null (clear avatar)', async () => {
    const { client, lastBuilder } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updateAvatar(null);

    expect(result).toEqual({ ok: true, data: null });
    expect(lastBuilder()!._updatePayload).toEqual({ avatar_url: null });
    expect(lastBuilder()!._eqCalls).toEqual([['id', 'user-7']]);
  });
});

describe('updateAvatar — Write-Pfad & Cache-Invalidation', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ id: 'user-9' } as never);
  });

  it('writes only avatar_url (no display_name / bio / username leaked)', async () => {
    const { client, lastBuilder } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    await updateAvatar('https://pub-abc.r2.dev/avatars/user-9/1.jpg');

    const payload = lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['avatar_url']);
  });

  it('returns Supabase error message when update fails', async () => {
    const { client } = makeSupabaseMock({ message: 'db offline' });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updateAvatar('https://pub-abc.r2.dev/avatars/user-9/1.jpg');

    expect(result).toEqual({ ok: false, error: 'db offline' });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates /settings/profile + layout + /u/[username] on success', async () => {
    const { client } = makeSupabaseMock();
    mockCreateClient.mockResolvedValue(client as never);

    await updateAvatar('https://pub-abc.r2.dev/avatars/user-9/1.jpg');

    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/profile');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/u/[username]', 'page');
  });

  it('does NOT revalidate when URL validation fails', async () => {
    const result = await updateAvatar('https://evil.example/avatars/user-9/1.jpg');
    expect(result.ok).toBe(false);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
