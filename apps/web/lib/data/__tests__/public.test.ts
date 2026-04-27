/**
 * @jest-environment node
 *
 * getPostComments — Migration-Rollout-Safety-Net.
 *
 * Scope: Verifiziert das Verhalten des `getPostComments`-Fallbacks nach v1.w.UI.84.
 * Der Fallback greift NUR bei PostgREST-Error-Code `42703` ("column does not
 * exist"). Jeder andere Fehler darf nicht maskiert werden — wir geben statt-
 * dessen die leere Liste zurück (konsistent mit `feed.ts`-Pattern), damit
 * der Server-Side-Supabase-Client den Error in Logs/Sentry sichtbar lässt.
 *
 * Mocking-Strategie identisch zu `feed.test.ts`:
 *  - `@/lib/supabase/server` wird gestubbed via `createSupabaseMock`
 *  - React `cache()` wird auf Identity gepatcht, damit Tests sich nicht
 *    gegenseitig durch Request-Scope-Memoization beeinflussen
 *  - `next/headers` ist neutralisiert (defense-in-depth)
 */

// -----------------------------------------------------------------------------
// Mocks — MÜSSEN vor den Imports aus dem SUT stehen.
// -----------------------------------------------------------------------------

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    getAll: () => [],
    set: jest.fn(),
  }),
}));

import { createClient } from '@/lib/supabase/server';
import { createSupabaseMock, type SupabaseMockConfig } from '@/test-utils/supabase-mock';
import { getPostComments } from '../public';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function setupSupabase(config: SupabaseMockConfig = {}) {
  const client = createSupabaseMock(config);
  mockCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

function makeCommentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c-1',
    post_id: 'p-1',
    user_id: 'u-1',
    parent_id: null,
    text: 'hello',
    created_at: '2026-04-26T10:00:00Z',
    reply_count: [{ count: 3 }],
    author: {
      id: 'u-1',
      username: 'alice',
      display_name: 'Alice',
      avatar_url: null,
      verified: true,
    },
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe('getPostComments', () => {
  test('happy path: returns top-level comments with reply_count when primary query succeeds', async () => {
    setupSupabase({
      tables: {
        comments: { data: [makeCommentRow()], error: null },
        comment_likes: { data: [], error: null },
      },
    });

    const result = await getPostComments('p-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'c-1',
      parent_id: null,
      reply_count: 3,
      body: 'hello',
      author: { username: 'alice' },
    });
  });

  test('fallback ONLY on Postgres 42703 (column missing): flat list, reply_count=0, parent_id=null', async () => {
    const client = setupSupabase({
      tables: {
        comments: [
          // Primary query — column missing
          {
            data: null,
            error: {
              code: '42703',
              message: 'column comments.parent_id does not exist',
            },
          },
          // Fallback query — flat comments without parent_id filter
          {
            data: [
              makeCommentRow({
                id: 'c-flat-1',
                // Im Fallback liefert die DB keine parent_id-Spalte und kein
                // reply_count-Embed — wir simulieren das, indem die Felder
                // nicht im Row sind. Der SUT pickt sie via Optional-Chaining.
                parent_id: undefined,
                reply_count: undefined,
              }),
            ],
            error: null,
          },
        ],
        comment_likes: { data: [], error: null },
      },
    });

    const result = await getPostComments('p-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'c-flat-1',
      parent_id: null, // im Fallback erzwungen, unabhängig von DB-Wert
      reply_count: 0, // immer 0 im Fallback
    });
    // Primary + Fallback = 2 Calls auf comments.
    expect(client._calls.tables.comments).toBe(2);
  });

  test('non-42703 PostgREST errors do NOT trigger fallback — returns [] and surfaces silently', async () => {
    // PGRST200 ist genau der Fehler, der heute auf Production gefeuert hat
    // (FK-Hint nicht gefunden). Vor v1.w.UI.84 hat der lockere Fallback ihn
    // maskiert, danach NICHT mehr.
    const client = setupSupabase({
      tables: {
        comments: [
          {
            data: null,
            error: {
              code: 'PGRST200',
              message:
                "Could not find a relationship between 'comments' and 'comments'",
            },
          },
          // Falls der Fallback FÄLSCHLICH greift, würden hier Daten zurück-
          // kommen — der Test würde dann mit toHaveLength(0) failen.
          { data: [makeCommentRow({ id: 'c-should-not-leak' })], error: null },
        ],
        comment_likes: { data: [], error: null },
      },
    });

    const result = await getPostComments('p-1');

    expect(result).toEqual([]);
    // Genau 1 Comments-Call: primary failed, fallback nicht angefasst.
    expect(client._calls.tables.comments).toBe(1);
  });

  test('generic non-PostgREST error (no code) does NOT trigger fallback', async () => {
    // Belt-and-suspenders: Fehler ohne `.code` (z.B. Network-Error) muss
    // ebenfalls leere Liste liefern, nicht Fallback.
    const client = setupSupabase({
      tables: {
        comments: [
          { data: null, error: { message: 'network unreachable' } },
          { data: [makeCommentRow()], error: null },
        ],
        comment_likes: { data: [], error: null },
      },
    });

    const result = await getPostComments('p-1');

    expect(result).toEqual([]);
    expect(client._calls.tables.comments).toBe(1);
  });
});
