/** Bound each discovery source so one stalled request cannot hold the feed. */
export async function withDiscoveryDeadline<T>(signal: AbortSignal, read: (requestSignal: AbortSignal) => Promise<T>, timeoutMs = 8_000): Promise<T> {
  if (signal.aborted) throw new Error('discovery_aborted');
  const request = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort = () => {};
  const deadline = new Promise<never>((_, reject) => {
    abort = () => { request.abort(); reject(new Error('discovery_aborted')); };
    signal.addEventListener('abort', abort);
    timer = setTimeout(() => { request.abort(); reject(new Error('discovery_timeout')); }, timeoutMs);
  });
  try { return await Promise.race([read(request.signal), deadline]); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
