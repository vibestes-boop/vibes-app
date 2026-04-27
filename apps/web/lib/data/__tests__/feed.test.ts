/**
 * @jest-environment node
 *
 * Feed-Data-Layer-Tests (Server-Side).
 *
 * Scope: getForYouFeed, getFollowingFeed, getSuggestedFollows,
 * getTrendingHashtags, searchAll. Alle Tests mocken `@/lib/supabase/server`
 * über `createSupabaseMock` aus `test-utils/supabase-mock.ts` — keine
 * echten Queries, kein next/headers-Runtime.
 *
 * React `cache()` wird hier auf Identity zurückgepatched, damit
 * aufeinanderfolgende Aufrufe in verschiedenen Tests nicht durch die
 * Request-Scope-Memoization gegenseitig beeinflusst werden.
 */

// -----------------------------------------------------------------------------
// Mocks — MÜSSEN vor den Imports aus dem SUT stehen.
// -----------------------------------------------------------------------------

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

// `cache` aus react memoized per Request-Scope — außerhalb des Next.js-
// Server-Runtimes ist das unpredictable. Identity-Wrap, damit jeder Test
// frisch evaluiert.
jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

// next/headers wird vom server-client.ts gezogen — kommt aber nie zum Zug,
// weil wir createClient komplett überschreiben. Der Mock fängt den
// Modul-Resolve-Versuch trotzdem ab (defense-in-depth).
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    getAll: () => [],
    set: jest.fn(),
  }),
}));

import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock, type SupabaseMockConfig } from '@/test-utils/supabase-mock';
import {
  getForYouFeed,
  getFollowingFeed,
  getSuggestedFollows,
  getTrendingHashtags,
  searchAll,
  searchPaginated,
  getSuggestedFollowsPage,
} from '../feed';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function setupSupabase(config: SupabaseMockConfig = {}) {
  const client = createSupabaseMock(config);
  // `createClient` kann pro Request mehrfach aufgerufen werden (getForYouFeed +
  // batchEngagement rufen beide separat). Wir geben immer dieselbe Instanz —
  // das ist nahe genug an der Realität (in Prod ist es pro Request auch
  // derselbe cookie-scope), und `_calls` zählt alles konsistent.
  mockCreateClient.mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);
  return client;
}

// `getForYouFeed` ruft bei 0 rows oder error `console.error` — silencen.
let errorSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

function makeRawPost(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p-1',
    user_id: 'author-1',
    caption: 'hello',
    video_url: 'https://cdn.example/p-1.mp4',
    thumbnail_url: 'https://cdn.example/p-1.jpg',
    view_count: 100,
    like_count: 10,
    comment_count: 2,
    hashtags: ['vibes'],
    allow_comments: true,
    allow_duet: true,
    created_at: '2026-04-20T10:00:00Z',
    privacy: 'public',
    author: {
      id: 'author-1',
      username: 'alice',
      display_name: 'Alice',
      avatar_url: null,
      verified: true,
    },
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// getForYouFeed
// -----------------------------------------------------------------------------

describe('getForYouFeed', () => {
  it('returns normalized posts for an anonymous viewer (no engagement lookup)', async () => {
    const client = setupSupabase({
      auth: { user: null },
      tables: {
        posts: { data: [makeRawPost()], error: null },
      },
    });

    const result = await getForYouFeed({ limit: 10 });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'p-1',
      caption: 'hello',
      video_url: 'https://cdn.example/p-1.mp4',
      liked_by_me: false,
      saved_by_me: false,
      following_author: false,
      hashtags: ['vibes'],
      // applyPostDefaults-Felder
      duration_secs: null,
      music_id: null,
      allow_stitch: true,
      share_count: 0,
    });
    expect(result[0].author).toMatchObject({
      id: 'author-1',
      username: 'alice',
      verified: true,
    });
    // Anon → kein Hit auf likes/bookmarks/follows.
    expect(client._calls.tables.posts).toBe(1);
    expect(client._calls.tables.likes).toBeUndefined();
    expect(client._calls.tables.bookmarks).toBeUndefined();
    expect(client._calls.tables.follows).toBeUndefined();
  });

  it('hydrates engagement flags for an authed viewer', async () => {
    const client = setupSupabase({
      auth: { user: { id: 'viewer-1' } },
      tables: {
        posts: {
          data: [
            makeRawPost({ id: 'p-a' }),
            makeRawPost({ id: 'p-b', author: { ...makeRawPost().author, id: 'author-2', username: 'bob' } }),
          ],
          error: null,
        },
        likes: { data: [{ post_id: 'p-a' }], error: null },
        bookmarks: { data: [{ post_id: 'p-b' }], error: null },
        follows: { data: [{ following_id: 'author-1' }], error: null },
      },
    });

    const result = await getForYouFeed();

    expect(result).toHaveLength(2);
    const pa = result.find((p) => p.id === 'p-a')!;
    const pb = result.find((p) => p.id === 'p-b')!;
    expect(pa).toMatchObject({ liked_by_me: true, saved_by_me: false, following_author: true });
    expect(pb).toMatchObject({ liked_by_me: false, saved_by_me: true, following_author: false });
    expect(client._calls.tables.likes).toBe(1);
    expect(client._calls.tables.bookmarks).toBe(1);
    expect(client._calls.tables.follows).toBe(1);
  });

  it('returns [] and logs on query error (visible in Vercel logs)', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        posts: {
          data: null,
          error: { code: '42P01', message: 'relation does not exist', details: null },
        },
      },
    });

    const result = await getForYouFeed();

    expect(result).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[feed] getForYouFeed query error:'),
      '42P01',
      'relation does not exist',
      null,
    );
  });

  it('returns [] and logs on rows=null edge case (no error, no data)', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        posts: { data: null, error: null },
      },
    });

    const result = await getForYouFeed();

    expect(result).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('rows is null'),
      expect.any(Object),
    );
  });

  it('logs RLS-suspected message when authed viewer gets 0 rows', async () => {
    setupSupabase({
      auth: { user: { id: 'viewer-1' } },
      tables: {
        posts: { data: [], error: null },
        likes: { data: [], error: null },
        bookmarks: { data: [], error: null },
        follows: { data: [], error: null },
      },
    });

    await getForYouFeed();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('suspected RLS'),
      expect.objectContaining({ viewerId: 'viewer-1' }),
    );
  });

  it('logs cookie-drift message when anon viewer gets 0 rows', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        posts: { data: [], error: null },
      },
    });

    await getForYouFeed();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('suspected cookie drift'),
      expect.objectContaining({ viewerId: null }),
    );
  });

  it('passes excludeIds to the query builder (.not chain)', async () => {
    const client = setupSupabase({
      auth: { user: null },
      tables: {
        posts: { data: [makeRawPost()], error: null },
      },
    });

    // Wir capturen den .not-Call über den Rückgabe-Chain des from()-Mocks.
    // Weil jeder Chain-Method-Mock das Chain-Object zurückgibt, reicht es den
    // jest.fn() von .not zu inspizieren, das im letzten `from`-Call produziert
    // wurde.
    await getForYouFeed({ excludeIds: ['skip-1', 'skip-2'] });

    // `from('posts')` wurde 1× aufgerufen → get the resulting chain.
    const chain = client.from.mock.results[0].value as {
      not: jest.Mock;
    };
    expect(chain.not).toHaveBeenCalledWith('id', 'in', '(skip-1,skip-2)');
  });

  it('accepts author as array (PostgREST !inner sometimes returns Profile[])', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        posts: {
          data: [
            makeRawPost({
              author: [
                {
                  id: 'author-arr',
                  username: 'arr',
                  display_name: null,
                  avatar_url: null,
                  verified: false,
                },
              ],
            }),
          ],
          error: null,
        },
      },
    });

    const result = await getForYouFeed();
    expect(result).toHaveLength(1);
    expect(result[0].author.id).toBe('author-arr');
    expect(result[0].author.verified).toBe(false); // null → fallback false
  });

  it('filters out rows with null author', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        posts: {
          data: [
            makeRawPost({ id: 'p-with-author' }),
            makeRawPost({ id: 'p-without-author', author: null }),
          ],
          error: null,
        },
      },
    });

    const result = await getForYouFeed();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p-with-author');
  });
});

// -----------------------------------------------------------------------------
// getFollowingFeed
// -----------------------------------------------------------------------------

describe('getFollowingFeed', () => {
  it('returns [] when viewer is not signed in', async () => {
    setupSupabase({ auth: { user: null } });
    const result = await getFollowingFeed();
    expect(result).toEqual([]);
  });

  it('returns [] when authed viewer follows nobody', async () => {
    setupSupabase({
      auth: { user: { id: 'viewer-1' } },
      tables: {
        follows: { data: [], error: null },
      },
    });
    const result = await getFollowingFeed();
    expect(result).toEqual([]);
  });

  it('returns [] when follows-query errors (treated same as empty)', async () => {
    setupSupabase({
      auth: { user: { id: 'viewer-1' } },
      tables: {
        follows: { data: null, error: { code: '500', message: 'boom' } },
      },
    });
    const result = await getFollowingFeed();
    expect(result).toEqual([]);
  });

  it('marks all returned posts as following_author: true by definition', async () => {
    setupSupabase({
      auth: { user: { id: 'viewer-1' } },
      tables: {
        // follows wird 2× gelesen: einmal für den Pre-Query, einmal im
        // batchEngagement (nach authorIds). Beide Calls gleiche Response.
        follows: { data: [{ following_id: 'author-1' }], error: null },
        posts: {
          data: [
            makeRawPost({ id: 'p-follow' }),
          ],
          error: null,
        },
        likes: { data: [], error: null },
        bookmarks: { data: [], error: null },
      },
    });

    const result = await getFollowingFeed();
    expect(result).toHaveLength(1);
    expect(result[0].following_author).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// getSuggestedFollows
// -----------------------------------------------------------------------------

describe('getSuggestedFollows', () => {
  it('returns profiles with follower_count placeholder 0', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        profiles: {
          data: [
            {
              id: 'u1',
              username: 'a',
              display_name: 'Alice',
              avatar_url: null,
              verified: true,
              created_at: '2026-04-20',
            },
            {
              id: 'u2',
              username: 'b',
              display_name: null,
              avatar_url: null,
              verified: null,
              created_at: '2026-04-19',
            },
          ],
          error: null,
        },
      },
    });

    const result = await getSuggestedFollows(5);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'u1', follower_count: 0, verified: true });
    expect(result[1]).toMatchObject({ id: 'u2', follower_count: 0, verified: false });
  });

  it('excludes self and already-followed users', async () => {
    const client = setupSupabase({
      auth: { user: { id: 'viewer-1' } },
      tables: {
        follows: { data: [{ following_id: 'author-x' }], error: null },
        profiles: { data: [], error: null },
      },
    });

    await getSuggestedFollows(5);

    const chain = client.from.mock.results.find(
      (r, i) => client.from.mock.calls[i][0] === 'profiles',
    )?.value as { not: jest.Mock };
    expect(chain).toBeDefined();
    expect(chain.not).toHaveBeenCalledWith('id', 'in', '(viewer-1,author-x)');
  });
});

// -----------------------------------------------------------------------------
// getTrendingHashtags
// -----------------------------------------------------------------------------

describe('getTrendingHashtags', () => {
  it('returns RPC result when RPC succeeds', async () => {
    setupSupabase({
      rpcs: {
        get_trending_hashtags: {
          data: [
            { tag: 'vibes', post_count: 10, total_views: 1000 },
            { tag: 'live', post_count: 5, total_views: 500 },
          ],
          error: null,
        },
      },
    });

    const result = await getTrendingHashtags(20);
    expect(result).toEqual([
      { tag: 'vibes', post_count: 10, total_views: 1000 },
      { tag: 'live', post_count: 5, total_views: 500 },
    ]);
  });

  it('falls back to client-side aggregation when RPC fails', async () => {
    setupSupabase({
      rpcs: {
        get_trending_hashtags: {
          data: null,
          error: { code: '42883', message: 'function does not exist' },
        },
      },
      tables: {
        posts: {
          data: [
            { tags: ['#Vibes', 'live'], view_count: 100 },
            { tags: ['vibes'], view_count: 250 },
            { tags: ['LIVE', 'party'], view_count: 30 },
            { tags: null, view_count: 5 }, // skipped
          ],
          error: null,
        },
      },
    });

    const result = await getTrendingHashtags(10);
    // Sortierung: total_views DESC
    expect(result[0]).toMatchObject({ tag: 'vibes', post_count: 2, total_views: 350 });
    expect(result[1]).toMatchObject({ tag: 'live', post_count: 2, total_views: 130 });
    expect(result[2]).toMatchObject({ tag: 'party', post_count: 1, total_views: 30 });
    // Hashtag-Normalisierung: '#Vibes' und 'vibes' wurden gemerged zu 'vibes'.
    expect(result.some((r) => r.tag.startsWith('#'))).toBe(false);
    expect(result.some((r) => /[A-Z]/.test(r.tag))).toBe(false);
  });

  it('respects the limit parameter in the fallback path', async () => {
    setupSupabase({
      rpcs: {
        get_trending_hashtags: { data: null, error: { code: 'X', message: 'y' } },
      },
      tables: {
        posts: {
          data: [
            { tags: ['a'], view_count: 10 },
            { tags: ['b'], view_count: 20 },
            { tags: ['c'], view_count: 30 },
          ],
          error: null,
        },
      },
    });

    const result = await getTrendingHashtags(2);
    expect(result).toHaveLength(2);
    expect(result[0].tag).toBe('c');
    expect(result[1].tag).toBe('b');
  });
});

// -----------------------------------------------------------------------------
// searchAll
// -----------------------------------------------------------------------------

describe('searchAll', () => {
  it('returns empty buckets for short queries (<2 chars)', async () => {
    const result = await searchAll('a');
    expect(result).toEqual({ users: [], posts: [], hashtags: [] });
    // Kein Supabase-Call.
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('trims whitespace before the length check', async () => {
    const result = await searchAll('   ');
    expect(result.users).toEqual([]);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('executes all three sub-queries in parallel for valid queries', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        profiles: {
          data: [
            {
              id: 'u1',
              username: 'alice',
              display_name: 'Alice',
              avatar_url: null,
              verified: true,
              created_at: '2026-04-20',
            },
          ],
          error: null,
        },
        posts: [
          // 1. Call: searchAll post-suche
          { data: [makeRawPost()], error: null },
          // 2. Call: getTrendingHashtags fallback (nur falls RPC fehlschlägt)
          { data: [{ tags: ['alice-tag'], view_count: 1 }], error: null },
        ],
      },
      rpcs: {
        get_trending_hashtags: {
          data: [
            { tag: 'alice-fan', post_count: 3, total_views: 30 },
            { tag: 'bob-fan', post_count: 2, total_views: 20 },
          ],
          error: null,
        },
      },
    });

    const result = await searchAll('alice', 12);
    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toMatchObject({ id: 'u1', follower_count: 0, verified: true });
    expect(result.posts).toHaveLength(1);
    // Hashtag-Substring-Match: 'alice' in 'alice-fan' → enthält, 'bob-fan' → nicht.
    expect(result.hashtags).toEqual([
      { tag: 'alice-fan', post_count: 3, total_views: 30 },
    ]);
  });

  it('strips % and _ wildcards from the user-provided query (SQL-injection hardening)', async () => {
    const client = setupSupabase({
      auth: { user: null },
      tables: {
        profiles: { data: [], error: null },
        posts: { data: [], error: null },
      },
      rpcs: {
        get_trending_hashtags: { data: [], error: null },
      },
    });

    await searchAll('a%b_c');

    // profiles-Chain: or() muss die gecleanten Wildcards bekommen.
    const profilesChain = client.from.mock.results.find(
      (_r, i) => client.from.mock.calls[i][0] === 'profiles',
    )?.value as { or: jest.Mock };
    expect(profilesChain.or).toHaveBeenCalledWith(
      expect.stringContaining('%abc%'), // a%b_c → abc, dann Like-Wrap
    );
  });
});

// -----------------------------------------------------------------------------
// searchPaginated
// -----------------------------------------------------------------------------

describe('searchPaginated', () => {
  it('returns empty result with hasMore:false for short queries (<2 chars)', async () => {
    const result = await searchPaginated('a', 'users', 0);
    expect(result).toEqual({ type: 'users', users: [], posts: [], hashtags: [], hasMore: false });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('type=users: queries profiles, maps shape, returns hasMore', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        profiles: {
          data: Array.from({ length: 20 }, (_, i) => ({
            id: `u${i}`,
            username: `user${i}`,
            display_name: null,
            avatar_url: null,
            verified: null,
          })),
          error: null,
        },
      },
    });

    const result = await searchPaginated('alice', 'users', 0);

    expect(result.type).toBe('users');
    expect(result.users).toHaveLength(20);
    expect(result.users![0]).toMatchObject({
      id: 'u0',
      username: 'user0',
      follower_count: 0,
      verified: false,
    });
    // 20 >= SEARCH_PAGE_LIMIT (20) → hasMore: true
    expect(result.hasMore).toBe(true);
    expect(result.posts).toBeUndefined();
  });

  it('type=users: hasMore:false when fewer than page limit returned', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        profiles: {
          data: [{ id: 'u1', username: 'bob', display_name: 'Bob', avatar_url: null, verified: true }],
          error: null,
        },
      },
    });

    const result = await searchPaginated('bob', 'users', 0);
    expect(result.hasMore).toBe(false);
  });

  it('type=posts: normalizes rows and returns hasMore', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        posts: { data: [makeRawPost()], error: null },
      },
    });

    const result = await searchPaginated('hello', 'posts', 0);

    expect(result.type).toBe('posts');
    expect(result.posts).toHaveLength(1);
    expect(result.posts![0]).toMatchObject({ id: 'p-1', caption: 'hello' });
    expect(result.hasMore).toBe(false); // 1 < 20
  });

  it('type=posts: no results when posts table returns empty', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        posts: { data: [], error: null },
      },
    });

    const result = await searchPaginated('hello', 'posts', 0);
    expect(result.posts).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it('type=hashtags: filters trending tags by substring and paginates in-memory', async () => {
    setupSupabase({
      rpcs: {
        get_trending_hashtags: {
          data: [
            { tag: 'vibes', post_count: 5, total_views: 500 },
            { tag: 'vibeszz', post_count: 3, total_views: 300 },
            { tag: 'live', post_count: 2, total_views: 200 },
          ],
          error: null,
        },
      },
    });

    const result = await searchPaginated('vibe', 'hashtags', 0);

    expect(result.type).toBe('hashtags');
    // 'vibes' and 'vibeszz' include 'vibe'; 'live' does not
    expect(result.hashtags).toHaveLength(2);
    expect(result.hashtags![0]).toMatchObject({ tag: 'vibes' });
    expect(result.hashtags![1]).toMatchObject({ tag: 'vibeszz' });
    expect(result.hasMore).toBe(false); // 2 total, offset=0+20=20 > 2
  });

  it('type=hashtags: hasMore:true when more filtered results exist beyond offset+limit', async () => {
    // Generate 25 matching tags so offset=0 hits 20-item page with hasMore:true
    const manyTags = Array.from({ length: 25 }, (_, i) => ({
      tag: `vibes${i}`,
      post_count: 1,
      total_views: 10,
    }));
    setupSupabase({
      rpcs: { get_trending_hashtags: { data: manyTags, error: null } },
    });

    const result = await searchPaginated('vibe', 'hashtags', 0);
    expect(result.hashtags).toHaveLength(20);
    expect(result.hasMore).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// getSuggestedFollowsPage
// -----------------------------------------------------------------------------

describe('getSuggestedFollowsPage', () => {
  it('returns paginated people for anon user (no exclusion filter)', async () => {
    const client = setupSupabase({
      auth: { user: null },
      tables: {
        profiles: {
          data: [
            { id: 'u1', username: 'alice', display_name: 'Alice', avatar_url: null, verified: true, follower_count: 100 },
            { id: 'u2', username: 'bob',   display_name: null,    avatar_url: null, verified: null, follower_count: null },
          ],
          error: null,
        },
      },
    });

    const result = await getSuggestedFollowsPage(0);

    expect(result.people).toHaveLength(2);
    expect(result.people[0]).toMatchObject({ id: 'u1', follower_count: 100, verified: true });
    expect(result.people[1]).toMatchObject({ id: 'u2', follower_count: 0, verified: false });
    // Anon: no follows lookup
    expect(client._calls.tables.follows).toBeUndefined();
  });

  it('excludes self and already-followed accounts when authed', async () => {
    const client = setupSupabase({
      auth: { user: { id: 'viewer-1' } },
      tables: {
        follows: { data: [{ following_id: 'already-followed' }], error: null },
        profiles: { data: [], error: null },
      },
    });

    await getSuggestedFollowsPage(0);

    const profilesChain = client.from.mock.results.find(
      (_r, i) => (client.from.mock.calls[i] as unknown[])[0] === 'profiles',
    )?.value as { not: jest.Mock };
    expect(profilesChain).toBeDefined();
    expect(profilesChain.not).toHaveBeenCalledWith(
      'id', 'in', '(viewer-1,already-followed)',
    );
  });

  it('returns hasMore:true when result count equals limit', async () => {
    const limit = 3;
    setupSupabase({
      auth: { user: null },
      tables: {
        profiles: {
          data: Array.from({ length: limit }, (_, i) => ({
            id: `u${i}`, username: `user${i}`, display_name: null,
            avatar_url: null, verified: null, follower_count: 0,
          })),
          error: null,
        },
      },
    });

    const result = await getSuggestedFollowsPage(0, limit);
    expect(result.people).toHaveLength(limit);
    expect(result.hasMore).toBe(true);
  });

  it('returns hasMore:false when result count is below limit', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        profiles: {
          data: [
            { id: 'u1', username: 'alice', display_name: null, avatar_url: null, verified: null, follower_count: 5 },
          ],
          error: null,
        },
      },
    });

    const result = await getSuggestedFollowsPage(0, 10);
    expect(result.hasMore).toBe(false);
  });

  it('returns { people: [], hasMore: false } when data is null', async () => {
    setupSupabase({
      auth: { user: null },
      tables: {
        profiles: { data: null, error: null },
      },
    });

    const result = await getSuggestedFollowsPage(0);
    expect(result).toEqual({ people: [], hasMore: false });
  });

  it('passes offset correctly to range query', async () => {
    const client = setupSupabase({
      auth: { user: null },
      tables: {
        profiles: { data: [], error: null },
      },
    });

    await getSuggestedFollowsPage(24, 24);

    const profilesChain = client.from.mock.results.find(
      (_r, i) => (client.from.mock.calls[i] as unknown[])[0] === 'profiles',
    )?.value as { range: jest.Mock };
    // range(offset, offset + limit - 1) = range(24, 47)
    expect(profilesChain.range).toHaveBeenCalledWith(24, 47);
  });
});
