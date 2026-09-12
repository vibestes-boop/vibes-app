import { useEffect, useState } from 'react';
import { useServerClock } from './useAuction';

/** Refresh payment windows while visible; stop the timer off-screen. */
export function usePurchaseClock(enabled: boolean, deadlines: string[]) {
  const { serverNow, synced } = useServerClock();
  const [, tick] = useState(0);
  const active = enabled && deadlines.some(value => Date.parse(value) > serverNow());
  useEffect(() => {
    if (!active) return;
    tick(value => value + 1);
    const timer = setInterval(() => tick(value => value + 1), 15_000);
    return () => clearInterval(timer);
  }, [active, synced]);
  return serverNow;
}
