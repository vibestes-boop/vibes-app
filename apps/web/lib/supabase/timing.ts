type SupabaseTimingRuntime = 'server' | 'browser';
type FetchLike = typeof fetch;

interface TimingFetchOptions {
  runtime: SupabaseTimingRuntime;
  baseFetch?: FetchLike;
}

const DEFAULT_SLOW_MS = 250;

function readTimingMode(runtime: SupabaseTimingRuntime): string | null {
  const raw =
    runtime === 'browser'
      ? process.env.NEXT_PUBLIC_SUPABASE_QUERY_TIMING
      : process.env.SUPABASE_QUERY_TIMING;
  return raw?.trim().toLowerCase() || null;
}

function readSlowThresholdMs(): number {
  const raw = process.env.SUPABASE_QUERY_TIMING_SLOW_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SLOW_MS;
}

function isEnabledMode(mode: string | null): boolean {
  return mode === '1' || mode === 'true' || mode === 'all' || mode === 'slow';
}

function shouldLog(mode: string | null, durationMs: number, slowMs: number): boolean {
  if (!isEnabledMode(mode)) return false;
  if (mode === 'slow') return durationMs >= slowMs;
  return true;
}

function getRequestMethod(input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function getRequestUrl(input: Parameters<FetchLike>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return String(input);
}

function describeSupabaseUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const path = url.pathname;
    const parts = path.split('/').filter(Boolean);
    const queryKeys = Array.from(new Set(Array.from(url.searchParams.keys())))
      .filter((key) => !/token|key|secret|password|email/i.test(key))
      .sort();

    if (parts[0] === 'rest' && parts[1] === 'v1' && parts[2] === 'rpc') {
      return {
        endpoint: `rpc:${parts[3] ?? 'unknown'}`,
        path: `/rest/v1/rpc/${parts[3] ?? 'unknown'}`,
        queryKeys,
      };
    }

    if (parts[0] === 'rest' && parts[1] === 'v1') {
      return {
        endpoint: `table:${parts[2] ?? 'unknown'}`,
        path: `/rest/v1/${parts[2] ?? 'unknown'}`,
        queryKeys,
      };
    }

    if (parts[0] === 'auth' && parts[1] === 'v1') {
      return {
        endpoint: `auth:${parts[2] ?? 'unknown'}`,
        path: `/${parts.slice(0, 3).join('/')}`,
        queryKeys,
      };
    }

    if (parts[0] === 'storage' && parts[1] === 'v1') {
      return {
        endpoint: `storage:${parts[2] ?? 'unknown'}`,
        path: `/${parts.slice(0, 3).join('/')}`,
        queryKeys,
      };
    }

    if (parts[0] === 'functions' && parts[1] === 'v1') {
      return {
        endpoint: `function:${parts[2] ?? 'unknown'}`,
        path: `/${parts.slice(0, 3).join('/')}`,
        queryKeys,
      };
    }

    return {
      endpoint: parts.slice(0, 3).join(':') || 'unknown',
      path,
      queryKeys,
    };
  } catch {
    return {
      endpoint: 'unknown',
      path: 'unknown',
      queryKeys: [] as string[],
    };
  }
}

function writeTimingLog(payload: Record<string, unknown>) {
  // Single-line JSON keeps Vercel logs searchable without leaking headers,
  // auth tokens, query values or response bodies.
  console.info('[supabase:timing]', JSON.stringify(payload));
}

export function createSupabaseTimingFetch({
  runtime,
  baseFetch = globalThis.fetch.bind(globalThis),
}: TimingFetchOptions): FetchLike | undefined {
  const mode = readTimingMode(runtime);
  if (!isEnabledMode(mode)) return undefined;

  const slowMs = readSlowThresholdMs();

  return (async (input, init) => {
    const method = getRequestMethod(input, init);
    const url = describeSupabaseUrl(getRequestUrl(input));
    const startedAt = performance.now();

    try {
      const response = await baseFetch(input, init);
      const durationMs = Math.round(performance.now() - startedAt);

      if (shouldLog(mode, durationMs, slowMs)) {
        writeTimingLog({
          runtime,
          method,
          status: response.status,
          ok: response.ok,
          durationMs,
          slow: durationMs >= slowMs,
          endpoint: url.endpoint,
          path: url.path,
          queryKeys: url.queryKeys,
        });
      }

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      writeTimingLog({
        runtime,
        method,
        status: 'FETCH_ERROR',
        ok: false,
        durationMs,
        slow: true,
        endpoint: url.endpoint,
        path: url.path,
        queryKeys: url.queryKeys,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      throw error;
    }
  }) as FetchLike;
}
