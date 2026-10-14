/**
 * @jest-environment node
 *
 * Auszahlungs-Server-Actions — Guthaben-Quelle + Fail-Closed.
 *
 * Bis 14.10.2026 lasen `getMyDiamondsBalance` und die Sicherheits-Prüfung in
 * `requestPayout` die Spalte `profiles.diamonds_balance`, die es nicht gibt
 * (Live: 400 / 42703). Der Fehler wurde verschluckt, das Guthaben war immer 0,
 * und jeder Auszahlungsantrag scheiterte mit „Guthaben reicht nicht aus“.
 *
 * Geprüft wird hier:
 *   - Guthaben kommt aus RPC `get_creator_earnings` (wie die App), nie aus `profiles`.
 *   - Lesefehler werden nicht als 0 bzw. „keine offene Anfrage“ gelesen.
 *   - Der eingefügte Betrag ist das serverseitig gelesene Guthaben.
 */

jest.mock('@/lib/auth/session', () => ({
  getUser: jest.fn(),
}));

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

import { getUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getMyDiamondsBalance, requestPayout } from '../payout';

const mockGetUser = getUser as jest.MockedFunction<typeof getUser>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// -----------------------------------------------------------------------------
// Mini-Supabase-Mock: `rpc()` für das Guthaben, `from('payout_requests')` für
// Pending-Count (select … head) und Insert. Jeder Builder ist thenable.
// -----------------------------------------------------------------------------

type Res = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

function makeSupabaseMock(opts: { rpc?: Res; pending?: Res; insert?: Res } = {}) {
  const calls = {
    tables: [] as string[],
    rpcs: [] as Array<[string, unknown]>,
    inserts: [] as unknown[],
  };

  const client = {
    rpc: jest.fn((name: string, args: unknown) => {
      calls.rpcs.push([name, args]);
      return Promise.resolve({ data: null, error: null, ...opts.rpc });
    }),
    from: jest.fn((table: string) => {
      calls.tables.push(table);
      let result: Res = { data: null, error: null };
      const chain: Record<string, unknown> = {};
      chain.select = jest.fn(() => {
        result = { data: null, error: null, count: 0, ...opts.pending };
        return chain;
      });
      chain.insert = jest.fn((payload: unknown) => {
        calls.inserts.push(payload);
        result = { data: null, error: null, ...opts.insert };
        return chain;
      });
      for (const m of ['eq', 'in', 'order', 'limit', 'maybeSingle']) {
        chain[m] = jest.fn(() => chain);
      }
      chain.then = (onFulfilled: (v: Res) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(onFulfilled, onRejected);
      return chain;
    }),
  };

  return { client, calls };
}

function setClient(mock: ReturnType<typeof makeSupabaseMock>) {
  mockCreateClient.mockResolvedValue(mock.client as never);
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const ibanForm = () =>
  makeFormData({ method: 'iban', iban: 'de89 3704 0044 0532 0130 00', balance: '3000' });

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ id: 'user-1' } as never);
});

// -----------------------------------------------------------------------------

describe('getMyDiamondsBalance', () => {
  it('liest das Guthaben über get_creator_earnings (wie die App), nicht aus profiles', async () => {
    const mock = makeSupabaseMock({ rpc: { data: [{ diamonds_balance: 3200 }] } });
    setClient(mock);

    await expect(getMyDiamondsBalance()).resolves.toBe(3200);
    expect(mock.calls.rpcs).toEqual([
      ['get_creator_earnings', { p_user_id: 'user-1', p_days: 28 }],
    ]);
    expect(mock.calls.tables).not.toContain('profiles');
  });

  it('gibt null zurück, wenn das Guthaben nicht gelesen werden kann (statt still 0)', async () => {
    const mock = makeSupabaseMock({
      rpc: { data: null, error: { code: '42501', message: 'permission denied' } },
    });
    setClient(mock);

    await expect(getMyDiamondsBalance()).resolves.toBeNull();
  });

  it('wertet eine leere RPC-Antwort als 0', async () => {
    setClient(makeSupabaseMock({ rpc: { data: [] } }));
    await expect(getMyDiamondsBalance()).resolves.toBe(0);
  });

  it('ohne Login: 0, ohne Datenbank-Abfrage', async () => {
    mockGetUser.mockResolvedValue(null);
    await expect(getMyDiamondsBalance()).resolves.toBe(0);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});

describe('requestPayout', () => {
  it('fügt den Antrag mit dem serverseitig gelesenen Guthaben ein', async () => {
    // Bigint kommt je nach Treiber auch als String — beides muss gehen.
    const mock = makeSupabaseMock({ rpc: { data: [{ diamonds_balance: '3000' }] } });
    setClient(mock);

    const result = await requestPayout(ibanForm());

    expect(result).toEqual({ ok: true, data: null });
    expect(mock.calls.rpcs[0]).toEqual([
      'get_creator_earnings',
      { p_user_id: 'user-1', p_days: 28 },
    ]);
    expect(mock.calls.tables).not.toContain('profiles');
    expect(mock.calls.inserts).toEqual([
      {
        creator_id: 'user-1',
        diamonds_amount: 3000,
        euro_amount: 60,
        iban: 'DE89 3704 0044 0532 0130 00',
        paypal_email: null,
        note: null,
      },
    ]);
  });

  it('nimmt den Server-Wert, nicht den vom Browser mitgeschickten', async () => {
    const mock = makeSupabaseMock({ rpc: { data: [{ diamonds_balance: 2600 }] } });
    setClient(mock);

    const fd = ibanForm();
    fd.set('balance', '999999');
    await requestPayout(fd);

    expect(mock.calls.inserts).toEqual([
      expect.objectContaining({ diamonds_amount: 2600, euro_amount: 52 }),
    ]);
  });

  it('lehnt ab, wenn das echte Guthaben unter dem Mindestbetrag liegt', async () => {
    const mock = makeSupabaseMock({ rpc: { data: [{ diamonds_balance: 2499 }] } });
    setClient(mock);

    const result = await requestPayout(ibanForm());

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/reicht nicht aus/);
    expect(mock.calls.inserts).toHaveLength(0);
  });

  it('Fail-Closed: Guthaben nicht lesbar → kein Antrag, eigene Meldung', async () => {
    const mock = makeSupabaseMock({
      rpc: { data: null, error: { code: '42703', message: 'column does not exist' } },
    });
    setClient(mock);

    const result = await requestPayout(ibanForm());

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/nicht geprüft werden/);
    expect(!result.ok && result.error).not.toMatch(/reicht nicht aus/);
    expect(mock.calls.inserts).toHaveLength(0);
  });

  it('Fail-Closed: Prüfung auf offene Anfragen schlägt fehl → kein Antrag', async () => {
    const mock = makeSupabaseMock({
      rpc: { data: [{ diamonds_balance: 3000 }] },
      pending: { count: null, error: { message: 'timeout' } },
    });
    setClient(mock);

    const result = await requestPayout(ibanForm());

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Offene Anfragen/);
    expect(mock.calls.inserts).toHaveLength(0);
  });

  it('lehnt ab, wenn schon eine offene Anfrage existiert', async () => {
    const mock = makeSupabaseMock({
      rpc: { data: [{ diamonds_balance: 3000 }] },
      pending: { count: 1 },
    });
    setClient(mock);

    const result = await requestPayout(ibanForm());

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/bereits eine offene/);
    expect(mock.calls.inserts).toHaveLength(0);
  });
});
