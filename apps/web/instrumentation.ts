// -----------------------------------------------------------------------------
// Next.js 15 instrumentation hook.
//
// Keep Sentry imports dynamic so the Edge runtime does not eagerly pull the full
// Node-oriented package graph. Node server errors are enabled when a DSN exists.
// Edge capture remains opt-in because the project previously hit an Edge
// `__dirname` runtime crash from eager Sentry imports.
// -----------------------------------------------------------------------------

type RequestErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
  revalidateReason?: string;
};

type RequestLike = {
  method?: string;
  url?: string;
  headers?: unknown;
};

export async function register(): Promise<void> {
  if (!hasSentryDsn()) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    return;
  }

  if (process.env.NEXT_RUNTIME === 'edge' && process.env.SENTRY_ENABLE_EDGE === '1') {
    await import('./sentry.edge.config');
  }
}

export async function onRequestError(
  error: unknown,
  request: RequestLike,
  context: RequestErrorContext,
): Promise<void> {
  if (!hasSentryDsn()) return;

  if (process.env.NEXT_RUNTIME === 'edge' && process.env.SENTRY_ENABLE_EDGE !== '1') {
    return;
  }

  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(error, request as never, context as never);
}

function hasSentryDsn(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}
