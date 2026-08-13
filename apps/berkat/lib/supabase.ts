// Supabase-Client für Berkat — dieselbe Datenbank wie Serlo.
//
// Übernommen aus lib/supabase.ts der Serlo-App. Zwei Eigenschaften daran sind
// teuer erkauft und dürfen nicht "vereinfacht" werden:
//
//  1. Chunked SecureStore. iOS begrenzt einen Keychain-Eintrag auf 2048 Byte,
//     Supabase-Sessions sind größer. Ohne Chunking geht die Session verloren.
//     AFTER_FIRST_UNLOCK, weil der Keychain sonst im Hintergrund sperrt und
//     getItemAsync wirft.
//  2. Lazy Singleton mit Guard. Fehlt eine Env-Variable, darf createClient
//     NICHT werfen — eine Exception hier killt den JS-Thread und die App
//     startet mit schwarzem Bildschirm statt mit einer Fehlermeldung.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const memoryCache: Record<string, string> = {};
const CHUNK_SIZE = 1800;
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
  // Ein gesperrter Keychain darf nie fatal werden: Fehlschlag = "keine Session".
  try {
    const countStr = await SecureStore.getItemAsync(`${key}__count`);
    if (!countStr) return null;
    const count = parseInt(countStr, 10);
    if (Number.isNaN(count) || count <= 0) return null;
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
  const countStr = await SecureStore.getItemAsync(`${key}__count`).catch(() => null);
  if (!countStr) return;
  const count = parseInt(countStr, 10);
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(`${key}__${i}`).catch(() => {});
  }
  await SecureStore.deleteItemAsync(`${key}__count`).catch(() => {});
}

const StorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return Promise.resolve(localStorage.getItem(key));
    if (memoryCache[key] !== undefined) return Promise.resolve(memoryCache[key]);
    return getLargeItem(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return Promise.resolve();
    }
    memoryCache[key] = value;
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

let client: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (client) return client;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (__DEV__) {
      console.warn(
        '[Berkat] EXPO_PUBLIC_SUPABASE_URL oder EXPO_PUBLIC_SUPABASE_ANON_KEY fehlt — ' +
          'lege apps/berkat/.env nach dem Muster von .env.example an.',
      );
    }
    client = createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        storage: StorageAdapter,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    return client;
  }

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: StorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
