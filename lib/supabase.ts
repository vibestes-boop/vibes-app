import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Hybrid Storage: In-Memory (schnell, immer aktuell) + SecureStore (Persistenz).
// Liest aus Memory zuerst → kein async Lag bei authed Requests.
// Schreibt in BEIDE → Session überlebt App-Neustart über SecureStore.
const memoryCache: Record<string, string> = {};

const StorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return Promise.resolve(localStorage.getItem(key));
    }
    // Memory zuerst: immer verfügbar, kein Hang
    if (memoryCache[key] !== undefined) {
      return Promise.resolve(memoryCache[key]);
    }
    // Fallback: SecureStore (für Cold-Start nach App-Neustart)
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return Promise.resolve();
    }
    memoryCache[key] = value;
    // Async in SecureStore speichern — nicht awaiten um Requests nicht zu blockieren
    SecureStore.setItemAsync(key, value).catch(() => {
      // SecureStore kann bei sehr großen Tokens fehlschlagen (iOS Limit) → ignorieren
    });
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return Promise.resolve();
    }
    delete memoryCache[key];
    SecureStore.deleteItemAsync(key).catch(() => {});
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
