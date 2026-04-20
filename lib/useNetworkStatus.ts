import { useEffect, useRef, useState } from 'react';
// expo-network: 'import * as' → _interopRequireWildcard → TypeError in Hermes HBC.
// Load lazily inside the async check function via require() to bypass wildcard interop.

/**
 * Gibt zurück ob das Gerät gerade Internetzugang hat.
 * `null` = noch nicht bekannt (kurz nach App-Start).
 *
 * Nutzt expo-network (Expo Go kompatibel) mit Polling:
 *   - Offline → alle 3s prüfen (schnelle Wiederherkennung)
 *   - Online  → alle 10s prüfen (spart Akku)
 */
export function useNetworkStatus(): boolean | null {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    const check = async (): Promise<boolean> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
        const Network = require('expo-network') as typeof import('expo-network');
        const state = await Network.getNetworkStateAsync();
        const connected = (state.isConnected ?? true) && (state.isInternetReachable ?? true);
        // Nur setState wenn noch gemounted — verhindert Leck nach Unmount
        if (active) setIsConnected(connected);
        return connected;
      } catch {
        return true; // Im Fehlerfall nicht fälschlicherweise Offline anzeigen
      }
    };

    const poll = async () => {
      if (!active) return;
      const connected = await check();
      if (!active) return;
      // Offline: schnell prüfen; Online: langsam prüfen
      timerRef.current = setTimeout(poll, connected ? 10_000 : 3_000);
    };

    poll();

    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return isConnected;
}
