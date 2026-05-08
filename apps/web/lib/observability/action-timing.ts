type TimingMode = 'all' | 'slow' | null;
type TimingValue = string | number | boolean | null;
type TimingPayload = Record<string, TimingValue | undefined>;

interface TimingStep {
  name: string;
  durationMs: number;
  ok: boolean;
  error?: string;
}

const DEFAULT_SLOW_MS = 250;

function readTimingMode(): TimingMode {
  const raw = process.env.SERLO_TIMING_LOGS ?? process.env.SERVER_ACTION_TIMING;
  const normalized = raw?.trim().toLowerCase();

  if (normalized === '1' || normalized === 'true' || normalized === 'all') return 'all';
  if (normalized === 'slow') return 'slow';
  return null;
}

function readSlowThresholdMs(): number {
  const raw = process.env.SERLO_TIMING_SLOW_MS ?? process.env.SUPABASE_QUERY_TIMING_SLOW_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SLOW_MS;
}

function summarizeError(error: unknown): string {
  if (error instanceof Error) return error.name;
  return 'UnknownError';
}

function compactPayload(payload: TimingPayload): Record<string, TimingValue> {
  return Object.fromEntries(
    Object.entries(payload).filter((entry): entry is [string, TimingValue] => entry[1] !== undefined),
  );
}

function shouldLog(
  mode: TimingMode,
  durationMs: number,
  slowMs: number,
  steps: TimingStep[],
  ok: boolean | undefined,
) {
  if (!mode) return false;
  if (mode === 'all') return true;
  if (ok === false) return true;
  return durationMs >= slowMs || steps.some((step) => step.durationMs >= slowMs);
}

function writeActionTiming(payload: Record<string, unknown>) {
  // Single-line JSON keeps Vercel logs searchable without logging request
  // bodies, auth headers, cookies, e-mails, or secret values.
  console.info('[action:timing]', JSON.stringify(payload));
}

export function createActionTiming(action: string, labels: TimingPayload = {}) {
  const mode = readTimingMode();
  const slowMs = readSlowThresholdMs();
  const startedAt = performance.now();
  const steps: TimingStep[] = [];
  let finished = false;

  async function measure<T>(name: string, work: () => Promise<T> | T): Promise<T> {
    const stepStartedAt = performance.now();

    try {
      const result = await work();
      steps.push({
        name,
        durationMs: Math.round(performance.now() - stepStartedAt),
        ok: true,
      });
      return result;
    } catch (error) {
      steps.push({
        name,
        durationMs: Math.round(performance.now() - stepStartedAt),
        ok: false,
        error: summarizeError(error),
      });
      throw error;
    }
  }

  function finish(extra: TimingPayload = {}) {
    if (finished) return;
    finished = true;

    const durationMs = Math.round(performance.now() - startedAt);
    const ok = typeof extra.ok === 'boolean' ? extra.ok : undefined;

    if (!shouldLog(mode, durationMs, slowMs, steps, ok)) return;

    writeActionTiming({
      action,
      durationMs,
      slow: durationMs >= slowMs || steps.some((step) => step.durationMs >= slowMs),
      slowMs,
      ...compactPayload(labels),
      ...compactPayload(extra),
      steps,
    });
  }

  return {
    measure,
    finish,
  };
}
