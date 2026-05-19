/**
 * @jest-environment node
 *
 * updatePost Server-Action — v1.w.UI.79.
 *
 * Scope: Author-Edit-Pfad für eigene Posts (Caption, Privacy,
 * Toggles inkl. women_only, aspect_ratio). Auth-Gate, Input-
 * Validierung (Caption-Length, Privacy-Whitelist, Aspect-Whitelist),
 * zentrale Mutation via `update_post` RPC, Hashtag-Auto-Extraktion aus
 * der Caption, Supabase-Error-Pass-Through, revalidatePath nach Erfolg.
 *
 * Mocking-Strategie identisch zu `profile.test.ts`:
 *  - `@/lib/supabase/server` wird komplett gestubbed
 *  - Inline-Client fängt `rpc('update_post', args)` auf und capturet
 *    RPC-Name + Payload
 *  - `next/headers` und `next/cache` neutralisiert
 *
 * Posts-Action ruft `supabase.auth.getUser()` direkt (kein
 * `@/lib/auth/session`-Wrapper) — der Mock-Client liefert das
 * deshalb als eigene Methode.
 */

// -----------------------------------------------------------------------------
// Mocks — MÜSSEN vor den Imports aus dem SUT stehen.
// -----------------------------------------------------------------------------

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ getAll: () => [], set: jest.fn() }),
}));

// `@/lib/data/posts` wird oben in `posts.ts` importiert (für die Autocomplete-
// Actions). Die Module evaluiert beim Import die echte Supabase-Lib —
// `next/headers` ist gemockt, das reicht. Für unsere updatePost-Tests
// rufen wir die Autocomplete-Actions nicht.
jest.mock('@/lib/data/posts', () => ({
  getTrendingHashtagSuggestions: jest.fn(),
  getMentionSuggestions: jest.fn(),
}));

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { updatePost, updatePostCaption } from '../posts';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

// -----------------------------------------------------------------------------
// Mini-Supabase-Mock für den Update-Pfad.
//
// Chain: `rpc('update_post', args)` liefert `{ error }`. Der Mock capturet
// RPC-Name und Args für Assertions. `auth.getUser()` ist separat — gibt den
// konfigurierten User (oder `null`) zurück.
// -----------------------------------------------------------------------------

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

interface SupabaseClientMock {
  auth: { getUser: jest.Mock };
  from: jest.Mock;
  rpc: jest.Mock;
  lastRpcCall: () => RpcCall | null;
}

function makeSupabaseMock(opts: {
  user?: { id: string } | null;
  errorForUpdate?: { message: string } | null;
} = {}): SupabaseClientMock {
  const { user = null, errorForUpdate = null } = opts;

  let lastRpcCall: RpcCall | null = null;

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: jest.fn(),
    rpc: jest.fn((name: string, args: Record<string, unknown> = {}) => {
      lastRpcCall = { name, args };
      return Promise.resolve({ error: errorForUpdate });
    }),
    lastRpcCall: () => lastRpcCall,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// -----------------------------------------------------------------------------
// Helper: vollständiger UpdatePostInput mit Defaults — ein Test überschreibt
// gezielt nur die Felder die er prüft.
// -----------------------------------------------------------------------------

function makeInput(
  overrides: Partial<Parameters<typeof updatePost>[1]> = {},
): Parameters<typeof updatePost>[1] {
  return {
    caption: 'hello world',
    privacy: 'public',
    allowComments: true,
    allowDownload: false,
    allowDuet: true,
    womenOnly: false,
    aspectRatio: 'portrait',
    ...overrides,
  };
}

function lastUpdatePostArgs(client: SupabaseClientMock): Record<string, unknown> {
  const call = client.lastRpcCall();
  expect(call).not.toBeNull();
  expect(call?.name).toBe('update_post');
  return call?.args ?? {};
}

// -----------------------------------------------------------------------------
// Auth-Gate
// -----------------------------------------------------------------------------

describe('updatePost — Auth-Gate', () => {
  it('returns { ok: false } when no user is logged in', async () => {
    const client = makeSupabaseMock({ user: null });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost('post-1', makeInput());

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    // `rpc` darf NICHT aufgerufen werden — Auth-Gate kommt vor jeder Mutation.
    expect(client.rpc).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// Input-Validierung
// -----------------------------------------------------------------------------

describe('updatePost — Input-Validierung', () => {
  it('rejects caption > 2000 chars', async () => {
    const client = makeSupabaseMock({ user: { id: 'user-1' } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(
      'post-1',
      makeInput({ caption: 'x'.repeat(2001) }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Caption/i);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('accepts caption at exactly 2000 chars', async () => {
    const client = makeSupabaseMock({ user: { id: 'user-1' } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(
      'post-1',
      makeInput({ caption: 'x'.repeat(2000) }),
    );

    expect(result).toEqual({ ok: true, data: null });
  });

  it('rejects unknown privacy value', async () => {
    const client = makeSupabaseMock({ user: { id: 'user-1' } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(
      'post-1',
      // Bewusst unsauber: nicht in der Whitelist.
      makeInput({ privacy: 'everyone' as never }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Privacy/i);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('accepts each valid privacy value (public/friends/private)', async () => {
    for (const privacy of ['public', 'friends', 'private'] as const) {
      const client = makeSupabaseMock({ user: { id: 'user-1' } });
      mockCreateClient.mockResolvedValue(client as never);

      const result = await updatePost('post-1', makeInput({ privacy }));
      expect(result).toEqual({ ok: true, data: null });

      const args = lastUpdatePostArgs(client);
      expect(args.p_privacy).toBe(privacy);
    }
  });

  it('rejects unknown aspect_ratio value', async () => {
    const client = makeSupabaseMock({ user: { id: 'user-1' } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(
      'post-1',
      makeInput({ aspectRatio: 'cinema' as never }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Format/i);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// Write-Pfad: Author kann Caption / Privacy / women_only ändern
// -----------------------------------------------------------------------------

describe('updatePost — Write-Pfad', () => {
  const USER_ID = 'user-42';
  const POST_ID = 'post-abc';

  it('writes caption (trimmed) through update_post RPC scoped by post id', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(
      POST_ID,
      makeInput({ caption: '  hallo welt  ' }),
    );

    expect(result).toEqual({ ok: true, data: null });
    expect(client.from).not.toHaveBeenCalled();

    const args = lastUpdatePostArgs(client);
    expect(args.p_post_id).toBe(POST_ID);
    expect(args.p_caption).toBe('hallo welt');
  });

  it('coerces empty trimmed caption to null (so DB does not store "")', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(POST_ID, makeInput({ caption: '   ' }));

    const args = lastUpdatePostArgs(client);
    expect(args.p_caption).toBeNull();
  });

  it('persists privacy change (public → friends)', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(POST_ID, makeInput({ privacy: 'friends' }));
    expect(result.ok).toBe(true);

    const args = lastUpdatePostArgs(client);
    expect(args.p_privacy).toBe('friends');
  });

  it('persists women_only toggle = true', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(POST_ID, makeInput({ womenOnly: true }));
    expect(result.ok).toBe(true);

    const args = lastUpdatePostArgs(client);
    expect(args.p_women_only).toBe(true);
  });

  it('persists women_only toggle = false (off-state, defense gegen partial-payload-bug)', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(POST_ID, makeInput({ womenOnly: false }));

    const args = lastUpdatePostArgs(client);
    expect(args).toHaveProperty('p_women_only', false);
  });

  it('persists all toggle changes (allow_comments, allow_download, allow_duet, women_only)', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(
      POST_ID,
      makeInput({
        allowComments: false,
        allowDownload: true,
        allowDuet: false,
        womenOnly: true,
      }),
    );

    const args = lastUpdatePostArgs(client);
    expect(args).toMatchObject({
      p_allow_comments: false,
      p_allow_download: true,
      p_allow_duet: false,
      p_women_only: true,
    });
  });

  it('persists aspect_ratio (landscape)', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(POST_ID, makeInput({ aspectRatio: 'landscape' }));

    const args = lastUpdatePostArgs(client);
    expect(args.p_aspect_ratio).toBe('landscape');
  });

  it('extracts hashtags from caption into tags column (lowercased, deduped)', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(
      POST_ID,
      makeInput({ caption: 'Yo #Foo and #bar then #FOO again' }),
    );

    const args = lastUpdatePostArgs(client);
    // updatePost lowercases and dedupes, but keeps the # prefix (withHash pattern).
    // #FOO is a dup of #Foo → only one entry.
    expect(args.p_tags).toEqual(['#foo', '#bar']);
  });

  it('writes empty tags array when caption has no hashtag', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(POST_ID, makeInput({ caption: 'just some plain text' }));

    const args = lastUpdatePostArgs(client);
    expect(args.p_tags).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// Ownership-Check (defense-in-depth zur RLS)
// -----------------------------------------------------------------------------

describe('updatePost — Ownership-Check', () => {
  it('delegates ownership enforcement to update_post RPC with viewer auth context', async () => {
    const client = makeSupabaseMock({ user: { id: 'attacker-id' } });
    mockCreateClient.mockResolvedValue(client as never);

    // Simuliert: Angreifer ruft updatePost mit fremder Post-ID. Die App macht
    // keine direkte Tabellenmutation mehr, sondern delegiert an den SECURITY
    // DEFINER RPC, der auth.uid() serverseitig gegen den Author prüft.
    await updatePost('foreign-post-id', makeInput());

    const args = lastUpdatePostArgs(client);
    expect(args.p_post_id).toBe('foreign-post-id');
    expect(args).not.toHaveProperty('p_author_id');
  });

  it('returns Supabase error message when RLS blocks the update (non-author)', async () => {
    // Simuliert das Verhalten wenn RLS den Update für einen Nicht-Author
    // ablehnt — Supabase liefert dann meistens ein `error`-Objekt.
    const client = makeSupabaseMock({
      user: { id: 'user-1' },
      errorForUpdate: { message: 'permission denied for table posts' },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost('post-of-someone-else', makeInput());

    expect(result).toEqual({
      ok: false,
      error: 'permission denied for table posts',
    });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('passes through Supabase errors verbatim', async () => {
    const client = makeSupabaseMock({
      user: { id: 'user-1' },
      errorForUpdate: { message: 'connection lost' },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost('post-1', makeInput());

    expect(result).toEqual({ ok: false, error: 'connection lost' });
  });
});

// -----------------------------------------------------------------------------
// Cache-Invalidation
// -----------------------------------------------------------------------------

describe('updatePost — Cache-Invalidation', () => {
  it('revalidates /p/[postId] after a successful update', async () => {
    const client = makeSupabaseMock({ user: { id: 'user-1' } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost('post-xyz', makeInput());

    expect(mockRevalidatePath).toHaveBeenCalledWith('/p/post-xyz');
  });

  it('does NOT revalidate when input validation fails', async () => {
    const client = makeSupabaseMock({ user: { id: 'user-1' } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(
      'post-1',
      makeInput({ privacy: 'galaxy' as never }),
    );

    expect(result.ok).toBe(false);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('does NOT revalidate when Supabase write fails', async () => {
    const client = makeSupabaseMock({
      user: { id: 'user-1' },
      errorForUpdate: { message: 'db error' },
    });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost('post-1', makeInput());

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// updatePostCaption — backwards-compat alias.
//
// Der Wrapper ruft updatePost mit Default-Werten für alle nicht-Caption-Felder.
// Test deckt zumindest, dass der Caption-Wert sauber durchgereicht wird und
// keine versehentliche Schreibung an fremden Spalten stattfindet.
// -----------------------------------------------------------------------------

describe('updatePostCaption — alias', () => {
  it('routes caption through updatePost with safe defaults', async () => {
    const client = makeSupabaseMock({ user: { id: 'user-9' } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePostCaption('post-1', '  edited caption  ');

    expect(result).toEqual({ ok: true, data: null });

    const args = lastUpdatePostArgs(client);
    expect(args).toMatchObject({
      p_caption: 'edited caption',
      p_privacy: 'public',
      p_allow_comments: true,
      p_allow_download: true,
      p_allow_duet: true,
      p_women_only: false,
      p_aspect_ratio: 'portrait',
    });
  });

  it('still requires auth', async () => {
    const client = makeSupabaseMock({ user: null });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePostCaption('post-1', 'whatever');
    expect(result.ok).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
