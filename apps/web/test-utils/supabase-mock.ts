/**
 * Supabase-Client Mock-Factory für Server-Data-Layer-Tests.
 *
 * Der Server-Code in `lib/data/*` nutzt den PostgREST-Builder-Pattern:
 *   supabase.from('t').select(...).eq(...).order(...).limit(...)
 *   → thenable, `await` liefert `{ data, error }`.
 *
 * Wir bauen hier einen chainable Mock, der jede Method-Chain schluckt und
 * am Ende eine konfigurierbare Response auflöst. Keine echte
 * Query-Parameter-Validierung — wir vertrauen auf PostgREST.
 *
 * Fixture-driven: pro `from('table')`-Call wird die erste (oder in
 * sequential-mode: nächste) Response aus der Config zurückgegeben. Das ist
 * pragmatisch genug für die aktuellen Feed-Tests; wenn ein einzelner
 * `createClient()`-Aufruf mehrere Queries auf dieselbe Tabelle feuert (z.B.
 * Read-then-Write), kann als Config ein Array übergeben werden und der
 * Counter zieht weiter.
 *
 * NICHT verwenden für RPC-nur-Tests, die ohne Table-Queries auskommen
 * (dafür reicht `rpc`-only-Config).
 */

export type TableResponse<T = unknown> = {
  data?: T[] | null;
  // `details` darf `null` sein — echte PostgREST-Fehler liefern
  // `string | null` (nicht `undefined`); Test-Fixtures spiegeln das.
  error?: { code?: string; message?: string; details?: string | null } | null;
};

export type RpcResponse<T = unknown> = {
  data?: T | null;
  error?: { code?: string; message?: string } | null;
};

export type SupabaseMockConfig = {
  /**
   * Auth-Kontext. Wenn `user` nicht gesetzt ist, liefert `auth.getUser()`
   * `{ data: { user: null } }` — der Code-Pfad für anonyme Viewer.
   */
  auth?: { user: { id: string } | null };
  /**
   * Pro-Table-Response. Ein Einzelwert gilt für ALLE Calls auf diese
   * Tabelle (stabile Response), ein Array rotiert durch (erst[0], dann [1]
   * etc.) — wenn der Counter überläuft, wird die letzte Response recycelt.
   */
  tables?: Record<string, TableResponse | TableResponse[]>;
  /**
   * Pro-RPC-Response. Analog zu `tables`.
   */
  rpcs?: Record<string, RpcResponse | RpcResponse[]>;
};

export type SupabaseMockClient = {
  auth: { getUser: jest.Mock };
  from: jest.Mock;
  rpc: jest.Mock;
  /** Test-Observability: wie oft wurde welche Tabelle angefragt. */
  _calls: {
    tables: Record<string, number>;
    rpcs: Record<string, number>;
  };
};

// Alle Chain-Methoden die der Feed-Data-Layer (und generell PostgREST) nutzt.
// Liste bewusst breit gewählt, damit künftige Data-Layer-Tests ohne
// Erweiterung laufen.
const CHAIN_METHODS = [
  'select',
  'eq',
  'neq',
  'in',
  'not',
  'or',
  'ilike',
  'like',
  'gte',
  'lte',
  'lt',
  'gt',
  'is',
  'contains',
  'containedBy',
  'order',
  'limit',
  'range',
  'single',
  'maybeSingle',
  'returns',
  'filter',
  'match',
  'textSearch',
] as const;

function createChainable<T>(response: TableResponse<T>): PromiseLike<TableResponse<T>> {
  // Jede Chain-Method gibt `this` zurück; erst `await` oder `.then()`
  // löst die Promise auf.
  const chain = {
    then<R1, R2>(
      onFulfilled?: ((value: TableResponse<T>) => R1 | PromiseLike<R1>) | null,
      onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
    ): Promise<R1 | R2> {
      return Promise.resolve(response).then(onFulfilled, onRejected);
    },
  } as Record<string, unknown> & PromiseLike<TableResponse<T>>;

  for (const m of CHAIN_METHODS) {
    chain[m] = jest.fn(() => chain);
  }

  return chain;
}

function pickResponse<T extends TableResponse | RpcResponse>(
  cfg: T | T[] | undefined,
  idx: number,
  fallback: T,
): T {
  if (!cfg) return fallback;
  if (Array.isArray(cfg)) {
    return cfg[Math.min(idx, cfg.length - 1)] ?? fallback;
  }
  return cfg;
}

export function createSupabaseMock(config: SupabaseMockConfig = {}): SupabaseMockClient {
  const calls = {
    tables: {} as Record<string, number>,
    rpcs: {} as Record<string, number>,
  };

  const mock: SupabaseMockClient = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: config.auth?.user ?? null },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      const idx = calls.tables[table] ?? 0;
      calls.tables[table] = idx + 1;
      const response = pickResponse(config.tables?.[table], idx, {
        data: [],
        error: null,
      });
      return createChainable(response);
    }),
    rpc: jest.fn((name: string) => {
      const idx = calls.rpcs[name] ?? 0;
      calls.rpcs[name] = idx + 1;
      const response = pickResponse(config.rpcs?.[name], idx, {
        data: null,
        error: { code: 'RPC_NOT_MOCKED', message: `No mock for rpc('${name}')` },
      });
      return Promise.resolve(response);
    }),
    _calls: calls,
  };

  return mock;
}
