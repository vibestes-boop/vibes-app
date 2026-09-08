import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decodePreferences, normalizePreferences, type DiscoveryPreferences } from './discovery';

export const preferenceKey = (userId: string | null) => ['berkat', 'discovery-preferences', userId] as const;
export const preferenceStorageKey = (userId: string | null) => `berkat.discovery.v1.${userId ?? 'guest'}`;

export function useDiscoveryPreferences(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: preferenceKey(userId), enabled, staleTime: Infinity, retry: false,
    queryFn: async ({ signal }) => {
      const key = preferenceStorageKey(userId);
      const raw = Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
      if (signal.aborted) throw new Error('discovery_preferences_aborted');
      return decodePreferences(raw);
    },
  });
}

export function useSaveDiscoveryPreferences(userId: string | null) {
  const client = useQueryClient();
  return useMutation({
    // Serialize writes from two open preference screens belonging to one account.
    scope: { id: preferenceStorageKey(userId) },
    mutationFn: async ({ owner, preferences }: { owner: string | null; preferences: DiscoveryPreferences }) => {
      const normalized = normalizePreferences(preferences);
      const raw = JSON.stringify({ version: 1, ...normalized });
      const key = preferenceStorageKey(owner);
      if (Platform.OS === 'web') localStorage.setItem(key, raw);
      else await SecureStore.setItemAsync(key, raw, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
      return { owner, preferences: normalized };
    },
    onSuccess: async ({ owner, preferences }) => {
      // The owner comes from the completed write, even if the active account changed.
      await client.cancelQueries({ queryKey: preferenceKey(owner), exact: true });
      client.setQueryData(preferenceKey(owner), preferences);
      void client.invalidateQueries({ queryKey: ['berkat', 'discovery', owner] });
    },
  });
}
