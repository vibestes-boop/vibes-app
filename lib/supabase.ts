import { createClient,SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Hybrid Storage: In-Memory (schnell, immer aktuell) + Chunked SecureStore (Persistenz).
// Liest aus Memory zuerst → kein async Lag bei authed Requests.
// Schreibt in BEIDE → Session überlebt App-Neustart. Chunks umgehen das 2048-Byte-Limit.
const memoryCache: Record<string, string> = {};

// Chunked SecureStore: iOS hat ein 2048-Byte-Limit pro Key.
// Supabase JWT-Sessions können dieses Limit überschreiten.
// Lösung: Große Werte in 1800-Byte-Chunks aufteilen und separat speichern.
const CHUNK_SIZE = 1800;

// keychainAccessible: AFTER_FIRST_UNLOCK — der Keychain-Eintrag bleibt lesbar,
// solange das Gerät seit dem Boot einmal entsperrt wurde, auch während die App
// im Hintergrund läuft. Default (WHEN_UNLOCKED) sperrt den Zugriff beim
// Backgrounding → `SecureStore.getItemAsync` wirft „Calling the 'get' function
// has failed" (Crash-Fix 2026-07-03, Sentry EXC ExpoModules-'get').
const KEYCHAIN_OPTS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

async function setLargeItem(key: string, value: string): Promise<void> {
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${key}__count`, String(chunks), KEYCHAIN_OPTS);
  for (let i = 0; i < chunks; i++) {
    await SecureStore.setItemAsync(
      `${key}__${i}`,
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      KEYCHAIN_OPTS,
    );
  }
}

async function getLargeItem(key: string): Promise<string | null> {
  // Try/catch: Ein gesperrter Keychain (App im Hintergrund + Default-
  // Accessibility auf Altdaten) darf NIE fatal werfen. Fehlschlag → null =
  // „keine Session", non-fatal — Supabase lädt sie beim nächsten Foreground neu.
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return null;
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) return null;
    const chunks: string[] = [];
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}__${i}`);
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  } catch {
    return null;
  }
}

async function deleteLargeItem(key: string): Promise<void> {
  const countStr = await SecureStore.getItemAsync(`${key}__count`);
  if (countStr) {
    const count = parseInt(countStr, 10);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}__${i}`).catch(() => {});
    }
    await SecureStore.deleteItemAsync(`${key}__count`).catch(() => {});
  }
}

const StorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return Promise.resolve(localStorage.getItem(key));
    }
    // Memory zuerst: immer verfügbar, kein Hang
    if (memoryCache[key] !== undefined) {
      return Promise.resolve(memoryCache[key]);
    }
    // Fallback: Chunked SecureStore (für Cold-Start nach App-Neustart)
    return getLargeItem(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return Promise.resolve();
    }
    memoryCache[key] = value;
    // Async in Chunked SecureStore speichern — nicht awaiten
    setLargeItem(key, value).catch(() => {});
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return Promise.resolve();
    }
    delete memoryCache[key];
    deleteLargeItem(key).catch(() => {});
    return Promise.resolve();
  },
};




// KRITISCH: Wenn Umgebungsvariablen fehlen (z. B. in Quarantäne-Builds oder CI),
// darf createClient() NICHT geworfen werden — das killt den gesamten JS-Thread.
// ExceptionsManager.reportException wirft dann seinerseits eine ObjC-Exception
// auf einem Background-Thread → Patch fängt sie zwar ab, aber die JS-Runtime ist
// danach tot → schwarzer Bildschirm.
//
// Lösung: Lazy Singleton + Guard. Das exportierte Objekt ist immer ein gültiger
// Proxy, der Operationen graceful abbricht wenn die URL fehlt.
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey) {
      // Env-Vars fehlen — passiert in Quarantäne-Builds oder wenn Secrets nicht gesetzt.
      // Wir WERFEN NICHT, damit die JS-Runtime am Leben bleibt.
      __DEV__ && console.warn(
        '[Supabase] EXPO_PUBLIC_SUPABASE_URL oder EXPO_PUBLIC_SUPABASE_ANON_KEY fehlt. ' +
          'Auth-Funktionen sind deaktiviert. Bitte EAS Secrets prüfen.'
      );
      // Erstelle einen Dummy-Client mit Placeholder-URL damit createClient()
      // nicht wirft - der Client wird nie echte Requests machen.
      _supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
        auth: {
          storage: StorageAdapter,
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    } else {
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: StorageAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });
    }
  }
  return _supabase;
}

// Legacy-kompatibler Export: Verhält sich wie bisher, aber mit Guard.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
