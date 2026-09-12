import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronRight, RefreshCw } from 'lucide-react-native';
import { usePurchaseStatus, purchasePresentation } from '../lib/usePurchaseStatus';
import { usePurchaseClock } from '../lib/usePurchaseClock';
import { PressFeedback } from './PressFeedback';
import { ui, radius, space } from '../theme/tokens';

export function PurchaseStatusCard({ auctionId, userId, localPackage, onRefreshPackage }: { auctionId: string; userId: string | null; localPackage?: 'visible' | 'loading' | 'error' | 'missing'; onRefreshPackage?: () => void }) {
  const focused = useIsFocused();
  const query = usePurchaseStatus(auctionId, userId, focused);
  const serverNow = usePurchaseClock(focused && Boolean(query.data?.cart && ['open', 'checkout_pending'].includes(query.data.cart.status)), query.data?.cart ? [query.data.cart.closes_at] : []);
  const { fontScale } = useWindowDimensions();
  const router = useRouter();
  useFocusEffect(useCallback(() => {
    if (userId) void query.refetch({ cancelRefetch: false });
  }, [userId, query.refetch]));
  const loading = query.isPending;
  const failed = query.isError;
  const copy = purchasePresentation(query.data ?? null, serverNow());
  const localCart = Boolean(localPackage && copy.target?.startsWith('/purchases?'));
  const localBody = localPackage === 'visible' ? 'Dein zugehöriges Paket steht unter „Deine Pakete“ an erster Stelle.' : localPackage === 'loading' ? 'Dein Paket wird geladen …' : 'Das zugehörige Paket ist gerade nicht verfügbar. Aktualisiere die Pakete, um den Stand abzugleichen.';
  const hideAction = !failed && localPackage && (copy.target === '/purchases' || (localCart && ['visible', 'loading'].includes(localPackage)));
  const retry = () => { void query.refetch({ cancelRefetch: false }); if (localCart) onRefreshPackage?.(); };
  const success = !loading && !failed && copy.tone === 'success';
  return <View key={fontScale} style={[styles.card, success && styles.success]}>
    <View style={styles.copy}>
      <Text style={[styles.title, success && styles.successText]} accessibilityRole="header">
        {loading ? 'Kaufstatus wird geladen' : failed ? 'Kaufstatus gerade nicht erreichbar' : copy.title}
      </Text>
      <Text style={styles.body}>{loading ? 'Einen Moment …' : failed ? 'Bitte lade den Status erneut. Deine Bestellung bleibt erhalten.' : localCart ? localBody : copy.body}</Text>
    </View>
    {loading ? <ActivityIndicator color={ui.brand} /> : hideAction ? null : <PressFeedback
      style={styles.action} disabled={query.isFetching} accessibilityRole="button"
      accessibilityState={{ disabled: query.isFetching, busy: query.isFetching }}
      onPress={() => failed || !copy.target || localCart ? retry() : router.push(copy.target as never)}>
      <Text style={styles.actionText}>{failed ? 'Erneut laden' : localCart ? 'Pakete aktualisieren' : copy.action}</Text>
      {query.isFetching ? <ActivityIndicator size="small" color={ui.brand} /> : failed || !copy.target ? <RefreshCw size={16} color={ui.brand} /> : <ChevronRight size={16} color={ui.brand} />}
    </PressFeedback>}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: space.md, borderRadius: radius.lg, backgroundColor: ui.card, borderWidth: StyleSheet.hairlineWidth, borderColor: ui.line, gap: space.xs },
  success: { borderColor: ui.success },
  copy: { gap: 4 },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.text },
  successText: { color: ui.success },
  body: { fontSize: 13, lineHeight: 19, color: ui.textMuted },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  actionText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '700', color: ui.brand },
});
