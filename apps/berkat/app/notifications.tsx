import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { NotificationInbox } from '../components/NotificationInbox';
import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { notificationTarget, useBerkatNotifications, useMarkNotificationsRead, type BerkatNotification } from '../lib/useNotifications';

export default function NotificationsScreen() {
  const userId = useSession(state => state.userId);
  const loading = useSession(state => state.loading);
  return <InboxSession key={userId ?? 'guest'} userId={userId} sessionLoading={loading} />;
}

function InboxSession({ userId, sessionLoading }: { userId: string | null; sessionLoading: boolean }) {
  const query = useBerkatNotifications(sessionLoading ? null : userId);
  const markRead = useMarkNotificationsRead(userId);
  const [pulling, setPulling] = useState(false);
  const pullingRef = useRef(false);
  const readBusy = useRef(false);
  const items = query.data?.items ?? [];
  useFocusEffect(useCallback(() => {
    if (userId && !sessionLoading) void query.refetch({ cancelRefetch: false });
  }, [userId, sessionLoading, query.refetch]));
  const refresh = async () => {
    if (!userId || pullingRef.current) return;
    pullingRef.current = true;
    setPulling(true);
    try { await query.refetch({ cancelRefetch: false }); }
    finally { pullingRef.current = false; setPulling(false); }
  };
  const read = async (ids: string[]) => {
    if (readBusy.current || !ids.length) return;
    readBusy.current = true;
    try { await markRead.mutateAsync(ids); }
    catch { /* The mutation retains the error for the inline notice. */ }
    finally { readBusy.current = false; }
  };
  const open = (item: BerkatNotification) => {
    if (!item.read) void read([item.id]);
    router.push(notificationTarget({ type: item.type, sessionId: item.session_id, senderId: item.sender_id,
      query: item.product_name, auctionId: item.auction_id, liveStatus: item.live_status }, 'list') as never);
  };
  return <NotificationInbox items={sessionLoading ? [] : items}
    loading={sessionLoading || query.isLoading} guest={!userId && !sessionLoading}
    error={query.isError} partial={query.data?.partial} refreshing={pulling}
    marking={markRead.isPending} readError={markRead.isError}
    onBack={() => goBack('/(tabs)/')} onOpen={open}
    onReadAll={() => void read(items.filter(item => !item.read).map(item => item.id))}
    onRefresh={() => void refresh()} onLogin={() => router.push('/login')}
    onExplore={() => router.push('/')} />;
}
