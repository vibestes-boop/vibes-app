/**
 * @jest-environment node
 *
 * updatePost Server-Action — v1.w.UI.79.
 *
 * Scope: Author-Edit-Pfad für eigene Posts (Caption, Privacy,
 * Toggles inkl. women_only, aspect_ratio). Auth-Gate, Input-
 * Validierung (Caption-Length, Privacy-Whitelist, Aspect-Whitelist),
 * Ownership via doppeltem `.eq('author_id', viewer)` (defense-in-
 * depth zur RLS), Hashtag-Auto-Extraktion aus der Caption,
 * Supabase-Error-Pass-Through, revalidatePath nach Erfolg.
 *
 * Mocking-Strategie identisch zu `profile.test.ts`:
 *  - `@/lib/supabase/server` wird komplett gestubbed
 *  - Inline-Builder fängt `from().update().eq().eq()` auf und
 *    capturet Payload + alle eq-Args
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
// Chain: `from(table).update(payload).eq(c1, v1).eq(c2, v2)` — letzte `eq`
// ist thenable und liefert `{ error }`. Der Mock capturet Tabelle, Payload
// und alle eq-Calls für Assertions. `auth.getUser()` ist separat — gibt
// den konfigurierten User (oder `null`) zurück.
// -----------------------------------------------------------------------------

interface UpdateBuilder {
  _table: string;
  _updatePayload: unknown;
  _eqCalls: Array<[string, unknown]>;
  update: jest.Mock;
  eq: jest.Mock;
  then: (onFulfilled: (value: { error: unknown }) => unknown) => Promise<unknown>;
}

interface SupabaseClientMock {
  auth: { getUser: jest.Mock };
  from: jest.Mock;
  lastBuilder: () => UpdateBuilder | null;
}

function makeSupabaseMock(opts: {
  user?: { id: string } | null;
  errorForUpdate?: { message: string } | null;
} = {}): SupabaseClientMock {
  const { user = null, errorForUpdate = null } = opts;

  let lastBuilder: UpdateBuilder | null = null;

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      const builder: UpdateBuilder = {
        _table: table,
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
    lastBuilder: () => lastBuilder,
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

// -----------------------------------------------------------------------------
// Auth-Gate
// -----------------------------------------------------------------------------

describe('updatePost — Auth-Gate', () => {
  it('returns { ok: false } when no user is logged in', async () => {
    const client = makeSupabaseMock({ user: null });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost('post-1', makeInput());

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    // `from` darf NICHT aufgerufen werden — Auth-Gate kommt vor jeder Query.
    expect(client.from).not.toHaveBeenCalled();
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
    expect(client.from).not.toHaveBeenCalled();
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
    expect(client.from).not.toHaveBeenCalled();
  });

  it('accepts each valid privacy value (public/friends/private)', async () => {
    for (const privacy of ['public', 'friends', 'private'] as const) {
      const client = makeSupabaseMock({ user: { id: 'user-1' } });
      mockCreateClient.mockResolvedValue(client as never);

      const result = await updatePost('post-1', makeInput({ privacy }));
      expect(result).toEqual({ ok: true, data: null });

      const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
      expect(payload.privacy).toBe(privacy);
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
    expect(client.from).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// Write-Pfad: Author kann Caption / Privacy / women_only ändern
// -----------------------------------------------------------------------------

describe('updatePost — Write-Pfad', () => {
  const USER_ID = 'user-42';
  const POST_ID = 'post-abc';

  it('writes caption (trimmed) to posts.posts row scoped by id + author_id', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(
      POST_ID,
      makeInput({ caption: '  hallo welt  ' }),
    );

    expect(result).toEqual({ ok: true, data: null });
    expect(client.from).toHaveBeenCalledWith('posts');

    const builder = client.lastBuilder()!;
    const payload = builder._updatePayload as Record<string, unknown>;
    expect(payload.caption).toBe('hallo welt');

    // BEIDE eq-Calls — `id` UND `author_id` (Ownership-Defense-in-Depth).
    expect(builder._eqCalls).toEqual([
      ['id', POST_ID],
      ['author_id', USER_ID],
    ]);
  });

  it('coerces empty trimmed caption to null (so DB does not store "")', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(POST_ID, makeInput({ caption: '   ' }));

    const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(payload.caption).toBeNull();
  });

  it('persists privacy change (public → friends)', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(POST_ID, makeInput({ privacy: 'friends' }));
    expect(result.ok).toBe(true);

    const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(payload.privacy).toBe('friends');
  });

  it('persists women_only toggle = true', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePost(POST_ID, makeInput({ womenOnly: true }));
    expect(result.ok).toBe(true);

    const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(payload.women_only).toBe(true);
  });

  it('persists women_only toggle = false (off-state, defense gegen partial-payload-bug)', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(POST_ID, makeInput({ womenOnly: false }));

    const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(payload).toHaveProperty('women_only', false);
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

    const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(payload).toMatchObject({
      allow_comments: false,
      allow_download: true,
      allow_duet: false,
      women_only: true,
    });
  });

  it('persists aspect_ratio (landscape)', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(POST_ID, makeInput({ aspectRatio: 'landscape' }));

    const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(payload.aspect_ratio).toBe('landscape');
  });

  it('extracts hashtags from caption into tags column (lowercased, deduped)', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(
      POST_ID,
      makeInput({ caption: 'Yo #Foo and #bar then #FOO again' }),
    );

    const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
    // updatePost lowercases and dedupes, but keeps the # prefix (withHash pattern).
    // #FOO is a dup of #Foo → only one entry.
    expect(payload.tags).toEqual(['#foo', '#bar']);
  });

  it('writes empty tags array when caption has no hashtag', async () => {
    const client = makeSupabaseMock({ user: { id: USER_ID } });
    mockCreateClient.mockResolvedValue(client as never);

    await updatePost(POST_ID, makeInput({ caption: 'just some plain text' }));

    const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(payload.tags).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// Ownership-Check (defense-in-depth zur RLS)
// -----------------------------------------------------------------------------

describe('updatePost — Ownership-Check', () => {
  it('always scopes UPDATE by author_id = viewer (defense-in-depth)', async () => {
    const client = makeSupabaseMock({ user: { id: 'attacker-id' } });
    mockCreateClient.mockResolvedValue(client as never);

    // Simuliert: Angreifer ruft updatePost mit fremder Post-ID. `author_id`
    // muss trotzdem die *eigene* Viewer-ID sein — RLS blockt dann den
    // Update zusätzlich, aber der Test prüft den App-Layer-Guard.
    await updatePost('foreign-post-id', makeInput());

    const builder = client.lastBuilder()!;
    expect(builder._eqCalls).toEqual([
      ['id', 'foreign-post-id'],
      ['author_id', 'attacker-id'],
    ]);
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

    const payload = client.lastBuilder()!._updatePayload as Record<string, unknown>;
    expect(payload).toMatchObject({
      caption: 'edited caption',
      privacy: 'public',
      allow_comments: true,
      allow_download: true,
      allow_duet: true,
      women_only: false,
      aspect_ratio: 'portrait',
    });
  });

  it('still requires auth', async () => {
    const client = makeSupabaseMock({ user: null });
    mockCreateClient.mockResolvedValue(client as never);

    const result = await updatePostCaption('post-1', 'whatever');
    expect(result.ok).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });
});
