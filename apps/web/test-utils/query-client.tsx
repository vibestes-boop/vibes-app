import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

// -----------------------------------------------------------------------------
// renderWithQueryClient — Test-Utility für Komponenten/Hooks die TanStack
// Query brauchen.
//
// Jeder Test bekommt einen frischen QueryClient (keine Cross-Test-Leaks).
// - `retry: false` verhindert dass Mutation-Reject-Pfade 3× retrien und den
//   Jest-Default-Timeout (5s) sprengen.
// - `gcTime: Infinity` — Queries die nur via setQueryData (ohne queryFn und
//   ohne Observer) geseedet wurden, sollen während des Tests nicht
//   garbage-collected werden. Ohne dieses Override hätten wir Flaky-Reads,
//   weil TanStack Query nach Mutation-Lifecycle manchmal kurz ohne Observer
//   steht und der Default-GC-Timer (5 min in Prod) in Jest-Tests wegen
//   Fake-Timers / Runner-Semantik anders triggert.
// - staleTime nicht gesetzt — Default 0 ist OK, wir refetchen in Tests nie.
// -----------------------------------------------------------------------------

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

interface RenderWithQueryClientResult extends RenderResult {
  client: QueryClient;
}

export function renderWithQueryClient(
  ui: ReactElement,
  options: { client?: QueryClient; renderOptions?: Omit<RenderOptions, 'wrapper'> } = {},
): RenderWithQueryClientResult {
  const client = options.client ?? createTestQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const utils = render(ui, {
    ...options.renderOptions,
    wrapper: Wrapper,
  });
  return { ...utils, client };
}
