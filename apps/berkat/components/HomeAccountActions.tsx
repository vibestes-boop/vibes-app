import { StyleSheet, Text, View } from 'react-native';
import { Bell, Heart, MessageSquare } from 'lucide-react-native';
import { PressFeedback } from './PressFeedback';
import { radius, space, ui } from '../theme/tokens';

/** Guests can browse immediately; account tools appear once a session is known. */
export function HomeAccountActions({ loading, signedIn, unread, unreadMessages, onLogin, onSaved, onMessages, onNotifications }: {
  loading: boolean; signedIn: boolean; unread: number; unreadMessages: number;
  onLogin: () => void; onSaved: () => void; onMessages: () => void; onNotifications: () => void;
}) {
  if (loading) return <View style={s.pending} />;
  if (!signedIn) return <PressFeedback onPress={onLogin} style={s.login}
    accessibilityRole="button" accessibilityLabel="Anmelden">
    <Text style={s.loginText}>Anmelden</Text>
  </PressFeedback>;
  return <View style={s.actions}>
    <PressFeedback onPress={onSaved} style={s.icon} accessibilityRole="button" accessibilityLabel="Merkliste öffnen">
      <Heart size={21} color={ui.text} />
    </PressFeedback>
    <PressFeedback onPress={onMessages} style={s.icon} accessibilityRole="button"
      accessibilityLabel={unreadMessages > 0 ? `Nachrichten, ${unreadMessages} ungelesen` : 'Nachrichten'}>
      <MessageSquare size={21} color={ui.text} />
      {unreadMessages > 0 ? <Badge count={unreadMessages} /> : null}
    </PressFeedback>
    <PressFeedback onPress={onNotifications} style={s.icon} accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Meldungen, ${unread} neue` : 'Meldungen'}>
      <Bell size={21} color={ui.text} />
      {unread > 0 ? <Badge count={unread} /> : null}
    </PressFeedback>
  </View>;
}

function Badge({ count }: { count: number }) {
  return <View style={s.badge}><Text allowFontScaling={false} style={s.badgeText}>{count > 9 ? '9+' : count}</Text></View>;
}

const s = StyleSheet.create({
  pending: { width: 100, height: 44 },
  login: { minHeight: 44, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill,
    backgroundColor: ui.card, alignItems: 'center', justifyContent: 'center' },
  loginText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.brand },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  icon: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 3, right: 2, minWidth: 16, height: 16, paddingHorizontal: 4,
    borderRadius: radius.pill, backgroundColor: ui.gold, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800', color: ui.goldInk },
});
