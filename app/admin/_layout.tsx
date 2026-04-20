/**
 * app/admin/_layout.tsx — Admin-Guard
 *
 * Doppelter Schutz:
 *  1. Client: prüft profile.is_admin — non-admins werden sofort zurückgeleitet
 *  2. Server: RLS + SECURITY DEFINER RPCs erlauben Admin-Queries nur mit is_admin = true
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/lib/authStore';
import { useTheme } from '@/lib/useTheme';

export default function AdminLayout() {
  const router = useRouter();
  const { profile, loading } = useAuthStore();
  const { colors } = useTheme();

  useEffect(() => {
    if (loading) return;
    // Kein Admin → zurück
    if (!profile || !(profile as any).is_admin) {
      router.replace('/(tabs)');
    }
  }, [profile, loading, router]);

  if (loading || !profile || !(profile as any).is_admin) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
