/**
 * @jest-environment node
 *
 * Kein Teip (Clan) im öffentlichen Profil.
 *
 * Der Teip verrät die ethnische Herkunft (Art. 9 DSGVO). Seit Migration
 * 20261015110000 ist er ohne Anmeldung nicht mehr lesbar: anon hat kein
 * Spaltenrecht auf profiles.teip, und get_public_profile_web gibt ihn nur mit
 * auth.uid() zurück. Die Profilseite zeigt ihn wie die App gar nicht mehr.
 *
 * Abgesichert wird hier:
 *  1. Der anonyme Rückfall-Select fragt teip nicht an. Sonst scheitert er nach
 *     der Migration mit 42501, und die Profilseite meldet „nicht gefunden".
 *  2. getPublicProfile (anonym, über unstable_cache für alle Besucher geteilt)
 *     trägt keinen Teip — auch nicht, solange die RPC vor der Migration noch
 *     einen liefert.
 */

// -----------------------------------------------------------------------------
// Mocks — MÜSSEN vor den Imports aus dem SUT stehen.
// -----------------------------------------------------------------------------

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/supabase/public', () => ({
  createPublicClient: jest.fn(),
}));

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    getAll: () => [],
    set: jest.fn(),
  }),
}));

import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import {
  createSupabaseMock,
  type SupabaseMockClient,
  type SupabaseMockConfig,
} from '@/test-utils/supabase-mock';
import { getPublicProfile } from '../public';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreatePublicClient = createPublicClient as jest.MockedFunction<typeof createPublicClient>;

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

// fetchPublicProfile ruft `rpc(...).maybeSingle()` — der Standard-Mock liefert
// bei rpc() ein nacktes Promise ohne maybeSingle. Deshalb hier ausdrücklich.
function setupPublicClient(config: SupabaseMockConfig, rpc: RpcResult) {
  const client = createSupabaseMock(config);
  client.rpc.mockImplementation(() => ({
    maybeSingle: () => Promise.resolve(rpc),
  }));
  mockCreatePublicClient.mockReturnValue(
    client as unknown as ReturnType<typeof createPublicClient>,
  );
  return client;
}

/** Spaltenlisten aller select()-Aufrufe auf `table`, in Aufrufreihenfolge. */
function selectedColumns(client: SupabaseMockClient, table: string): string[][] {
  return client.from.mock.calls
    .map(([name]: [string], i: number) => ({ name, chain: client.from.mock.results[i]?.value }))
    .filter(({ name }: { name: string }) => name === table)
    .map(({ chain }: { chain: { select: jest.Mock } }) =>
      String(chain.select.mock.calls[0]?.[0] ?? '')
        .split(',')
        .map((column) => column.trim()),
    );
}

const PROFILE_ROW = {
  id: 'u-1',
  username: 'alice',
  display_name: 'Alice',
  avatar_url: null,
  bio: null,
  is_verified: false,
  is_private: false,
  is_banned: false,
  is_shadow_banned: false,
  website: null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getPublicProfile — kein Teip im anonymen, geteilten Profil', () => {
  test('anonymer Rückfall-Select fragt teip nicht an', async () => {
    const client = setupPublicClient(
      {
        tables: {
          // maybeSingle() liefert ein Objekt, kein Array.
          profiles: { data: PROFILE_ROW as unknown as unknown[], error: null },
          live_sessions: { data: null, error: null },
        },
      },
      // RPC noch nicht eingespielt → Rückfallweg.
      { data: null, error: { code: 'PGRST202', message: 'function not found' } },
    );

    const profile = await getPublicProfile('Alice');

    expect(profile).not.toBeNull();
    expect(profile?.username).toBe('alice');

    const profileSelects = selectedColumns(client, 'profiles');
    expect(profileSelects).toHaveLength(1);
    // Gegenprobe: Wir sehen wirklich die Profil-Spaltenliste.
    expect(profileSelects[0]).toEqual(expect.arrayContaining(['id', 'username', 'website']));
    expect(profileSelects[0]).not.toContain('teip');
    expect(profile).not.toHaveProperty('teip');
  });

  test('liefert die RPC (vor der Migration) noch einen Teip, landet er nicht im Profil', async () => {
    const client = setupPublicClient(
      {},
      {
        data: {
          ...PROFILE_ROW,
          teip: 'Beispiel-Teip',
          follower_count: '3',
          following_count: 2,
          post_count: 1,
          is_live: false,
          live_session_id: null,
        },
        error: null,
      },
    );

    const profile = await getPublicProfile('alice');

    expect(profile).toMatchObject({ id: 'u-1', username: 'alice', follower_count: 3 });
    expect(profile).not.toHaveProperty('teip');
    // Schneller Pfad hat geklappt → kein Rückfall-Select.
    expect(client._calls.tables.profiles ?? 0).toBe(0);
    // Und angemeldet wird hier nie gelesen: nur der anonyme Client.
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
